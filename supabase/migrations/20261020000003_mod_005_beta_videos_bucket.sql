-- ──────────────────────────────────────────────────────────────────────────────
-- MOD-005: Beta Video — L-2 bucket migration
-- Ensures the `beta-videos` Supabase Storage bucket exists and has RLS policies.
-- ──────────────────────────────────────────────────────────────────────────────
--
-- Problem (L-2): The beta_videos table migration (20260924000005_mod_005_beta_video.sql)
-- deferred bucket creation to Supabase Studio/CLI separately, stating:
--   "Bucket creation and RLS policies for the bucket are managed via
--    Supabase Studio / CLI separately from this migration."
-- On `supabase db reset` in a fresh dev/staging environment the bucket does not
-- exist, causing all video uploads and signed-URL fetches to fail with 404.
--
-- Fix: Create the bucket idempotently (ON CONFLICT DO NOTHING) and apply the
-- matching RLS policies on storage.objects so the bucket survives a db reset.
--
-- Bucket spec (from spec.md / production.md):
--   - id/name: 'beta-videos'
--   - public: false — signed URLs are required to access objects; raw URLs are
--     not publicly accessible. This aligns with AC-169 upfront size gate and the
--     RLS policy that requires auth.role() = 'authenticated' for SELECT.
--   - No MIME or size constraint here: the 45 MB native-file size gate (AC-169)
--     and codec validation (AC-035) are enforced client-side before upload. A
--     50 MB file_size_limit would mirror the Supabase Storage free-tier ceiling
--     but the client-side gate (45 MB) already sits below that margin; omitting
--     the server-side limit keeps the bucket simple and avoids an inconsistent
--     error surface if the thresholds diverge in Phase 2.
--
-- RLS policies mirror the beta_videos table policies (production.md convention:
-- "All Storage buckets have RLS policies aligned with corresponding table policies"):
--   SELECT: any authenticated user (reads video/thumbnail for playback + signed URLs)
--   INSERT: authenticated user whose folder prefix matches their auth.uid() (own rows)
--   UPDATE: authenticated user whose folder prefix matches their auth.uid() (own rows)
--   DELETE: authenticated user whose folder prefix matches their auth.uid() (own rows)
--
-- Folder layout convention: objects are stored as {user_id}/{route_id}/{filename}.
-- The INSERT/UPDATE/DELETE policies enforce (storage.foldername(name))[1] = auth.uid()::text
-- so a user can only write to their own prefix.
-- ──────────────────────────────────────────────────────────────────────────────

-- ── Bucket creation ───────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('beta-videos', 'beta-videos', false)
ON CONFLICT (id) DO NOTHING;

-- ── RLS policies on storage.objects for the beta-videos bucket ────────────────
-- Pattern mirrors the avatars bucket in 20260920000001_mod_001_user_profile.sql,
-- adjusted for a private (non-public) bucket requiring authenticated access.

-- SELECT: any authenticated user may read beta-video and thumbnail objects.
-- Signed URLs for private buckets are generated server-side; this policy covers
-- direct RLS-authenticated reads (e.g. from the Supabase client with a valid JWT).
CREATE POLICY "beta_videos_objects_select_authenticated"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'beta-videos'
    AND auth.role() = 'authenticated'
  );

-- INSERT: authenticated users may upload to their own user-id-prefixed folder.
-- Convention: storage path = {user_id}/{route_id}/{filename}.
-- (storage.foldername(name))[1] returns the first path segment (user_id).
CREATE POLICY "beta_videos_objects_insert_own"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'beta-videos'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- UPDATE: authenticated users may replace objects in their own folder.
-- Required for the AC-166 upsert/replace flow (delete-old + insert, or
-- ON CONFLICT DO UPDATE) — the storage object may need to be replaced on upsert.
CREATE POLICY "beta_videos_objects_update_own"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'beta-videos'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- DELETE: authenticated users may delete their own objects.
-- Required when a user's beta video row is deleted (ON DELETE CASCADE propagates
-- via the application layer; the storage objects must be cleaned up separately).
CREATE POLICY "beta_videos_objects_delete_own"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'beta-videos'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
