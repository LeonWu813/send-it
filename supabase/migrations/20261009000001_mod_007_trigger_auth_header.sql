-- ──────────────────────────────────────────────────────────────────────────────
-- MOD-007: Trigger Auth Header Fix
-- ──────────────────────────────────────────────────────────────────────────────
-- Problem: `trigger_notify_beta_video_like` called net.http_post without an
-- Authorization header. The Edge Function has `verify_jwt: true`, so the
-- Supabase gateway rejected every trigger call with 401 before the function
-- body ran — no Notification rows were ever created.
--
-- Fix: Read the service-role JWT from Supabase Vault (secret name:
-- `notify_trigger_service_role_key`) and attach it as an Authorization Bearer
-- header on the net.http_post call.
--
-- Vault access requirement: vault.decrypted_secrets is only readable from
-- SECURITY DEFINER functions. The trigger function is already SECURITY DEFINER,
-- so this works without any privilege change.
--
-- The net.http_post call is now gated on BOTH the URL and the key being
-- non-empty. If the secret is not yet added to Vault, the trigger is a graceful
-- no-op (same behavior as before for unconfigured URLs).
--
-- IMPORTANT — manual step required before this migration takes effect:
--   The Vault secret must be added by a project admin in the Supabase Dashboard.
--   See the instructions in project-planning/modules/mod-notifications/status.md
--   Engineering Progress section.
-- ──────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.trigger_notify_beta_video_like()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_edge_function_url  TEXT;
  v_service_role_key   TEXT;
  v_payload            JSONB;
BEGIN
  -- Only fan out for beta_video reactions.
  IF NEW.target_type::TEXT <> 'beta_video' THEN
    RETURN NEW;
  END IF;

  -- Build the payload. The Edge Function resolves the recipient from the DB.
  v_payload := jsonb_build_object(
    'reaction_id',  NEW.id,
    'actor_id',     NEW.user_id,
    'target_id',    NEW.target_id,
    'target_type',  NEW.target_type
  );

  -- Read the Edge Function URL from app_settings.
  SELECT value INTO v_edge_function_url
  FROM public.app_settings
  WHERE key = 'notify_edge_function_url';

  -- Read the service-role JWT from Supabase Vault.
  -- The secret must be stored under name 'notify_trigger_service_role_key'.
  -- vault.decrypted_secrets is accessible only from SECURITY DEFINER functions.
  -- If the secret does not exist yet, v_service_role_key remains NULL and the
  -- net.http_post call below is skipped (graceful no-op).
  SELECT decrypted_secret INTO v_service_role_key
  FROM vault.decrypted_secrets
  WHERE name = 'notify_trigger_service_role_key';

  -- Fire the Edge Function only when both the URL and the key are configured.
  -- Without the Authorization header, the gateway returns 401 before the
  -- function body runs (verify_jwt: true), so we must have the key before
  -- attempting the call.
  IF v_edge_function_url IS NOT NULL AND v_edge_function_url <> ''
     AND v_service_role_key IS NOT NULL AND v_service_role_key <> '' THEN
    PERFORM net.http_post(
      url     := v_edge_function_url,
      body    := v_payload,
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || v_service_role_key
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

-- The trigger itself (reactions_notify_beta_video_like) is unchanged — it
-- already points to this function. No DROP/CREATE TRIGGER is needed because
-- CREATE OR REPLACE FUNCTION replaces the function body in place and the
-- existing trigger continues to call it.
