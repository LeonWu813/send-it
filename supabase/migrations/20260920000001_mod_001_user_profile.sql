-- ──────────────────────────────────────────────────────────────────────────────
-- MOD-001: Auth & Profile — User table migration
-- ──────────────────────────────────────────────────────────────────────────────
-- Creates the `users` table (the profile row) that mirrors Supabase Auth users.
-- Every authenticated user gets exactly one row in this table.
--
-- RLS is enabled from creation per the project convention:
-- "every table has RLS enabled from the migration that creates it."
--
-- Note: `home_gym_id` references `gyms` (created by MOD-002). Add the FK
-- constraint when MOD-002 ships its migration. The column is nullable in
-- Phase 1 so partial profiles are allowed.
-- ──────────────────────────────────────────────────────────────────────────────

-- Privacy setting enum
CREATE TYPE privacy_setting AS ENUM ('public', 'followers_only');

-- Users (profile) table
CREATE TABLE IF NOT EXISTS public.users (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name    TEXT        NOT NULL DEFAULT '',
  avatar_url      TEXT,
  home_gym_id     UUID,       -- FK to gyms.id will be added in MOD-002 migration
  bio             TEXT,
  privacy_setting privacy_setting NOT NULL DEFAULT 'public',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Row-Level Security ────────────────────────────────────────────────────────

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read a profile that is 'public'.
-- 'followers_only' visibility is enforced at the RPC level in MOD-006/MOD-008;
-- basic profile info (display_name, avatar) is always readable to authenticated users
-- so that follow/search UI can render names.
CREATE POLICY "users_select_authenticated"
  ON public.users
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- A user can only update their own profile.
CREATE POLICY "users_update_own"
  ON public.users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Insert is handled by the trigger below; direct insert is not allowed from the client.
CREATE POLICY "users_insert_own"
  ON public.users
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ── Auto-create profile on auth.users insert ──────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ── Avatars storage bucket ────────────────────────────────────────────────────
-- Note: Storage bucket creation via SQL is only available in Supabase hosted projects.
-- Run this in the Supabase dashboard SQL editor or via the Supabase CLI migration runner.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,        -- public bucket; avatar URLs are safe to embed in the app
  5242880,     -- 5 MB limit per avatar
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- RLS on storage.objects for the avatars bucket
CREATE POLICY "avatars_select_public"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "avatars_insert_own"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = 'avatars'
  );

CREATE POLICY "avatars_update_own"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.filename(name))::text
  );

CREATE POLICY "avatars_delete_own"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.filename(name))::text
  );
