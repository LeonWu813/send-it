-- ──────────────────────────────────────────────────────────────────────────────
-- MOD-001 AC-201: Extend handle_new_auth_user() to prefill display_name and
-- avatar_url from the Google provider on new account creation.
--
-- The trigger fires only on INSERT into auth.users (brand-new accounts).
-- ON CONFLICT (id) DO NOTHING on the public.users INSERT ensures existing
-- profile rows are never touched — satisfying AC-201: "a field that already
-- holds a value is never overwritten."
--
-- Google: reads raw_user_meta_data->>'full_name' (or 'name') → display_name;
--         reads raw_user_meta_data->>'avatar_url' (or 'picture') → avatar_url.
--         avatar_url is a Google CDN URL at this point; the app copies it to
--         the avatars Storage bucket after sign-in completes (Q-B in
--         auth-service.ts signInWithGoogle).
--
-- Apple:  The Supabase JWT does not carry the user's Apple-provided name —
--         Apple sends the PersonNameComponents only to the native SDK on the
--         first sign-in. display_name is filled in-app inside signInWithApple()
--         in auth-service.ts after signInWithIdToken succeeds (Q-A hybrid).
--
-- Email / other providers: display_name from raw_user_meta_data->>'display_name'
--         (unchanged from the original trigger behaviour).
--
-- This migration replaces the function body only; the trigger
-- (on_auth_user_created) already points to handle_new_auth_user() by name and
-- does not need to be re-created.
-- ──────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_provider     TEXT;
  v_display_name TEXT;
  v_avatar_url   TEXT;
BEGIN
  -- Prefer raw_app_meta_data->>'provider' (set by Supabase Auth on OAuth
  -- sign-ins). Fall back to empty string so comparisons below are safe.
  v_provider := COALESCE(NEW.raw_app_meta_data->>'provider', '');

  IF v_provider = 'google' THEN
    -- Google supplies the user's name and profile photo in raw_user_meta_data.
    -- Prefer full_name; fall back to name; then to display_name (set by email
    -- sign-up if somehow a hybrid account exists); final fallback is ''.
    v_display_name := COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'),    ''),
      NULLIF(TRIM(NEW.raw_user_meta_data->>'name'),         ''),
      NULLIF(TRIM(NEW.raw_user_meta_data->>'display_name'), ''),
      ''
    );
    -- Prefer avatar_url (Supabase normalised key); fall back to picture (the
    -- OIDC standard key Google sets in its ID token claims).
    v_avatar_url := COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'avatar_url'), ''),
      NULLIF(TRIM(NEW.raw_user_meta_data->>'picture'),    '')
    );

  ELSE
    -- Email / Apple / other providers.
    -- For Apple: display_name is set in-app after signInWithIdToken succeeds
    -- (see signInWithApple → fillDisplayNameIfEmpty in auth-service.ts).
    -- For email: the signUpWithEmail call already stores display_name in
    -- raw_user_meta_data, so this COALESCE picks it up correctly.
    v_display_name := COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'display_name'), ''),
      ''
    );
    v_avatar_url := NULL; -- no photo from Apple or email signup
  END IF;

  INSERT INTO public.users (id, display_name, avatar_url)
  VALUES (NEW.id, v_display_name, v_avatar_url)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;
