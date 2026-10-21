-- ──────────────────────────────────────────────────────────────────────────────
-- INT-005: Fix avatar storage UPDATE/DELETE policies — extension mismatch
-- ──────────────────────────────────────────────────────────────────────────────
-- Root cause: the original policies compared storage.filename(name) directly
-- against auth.uid()::text.  storage.filename('abc-123.jpg') returns
-- 'abc-123.jpg' (with the extension), while auth.uid()::text returns 'abc-123'
-- (UUID, no extension).  They never match, causing every avatar replacement and
-- deletion to return 403.
--
-- Fix: strip the file extension before comparing by using
--   split_part(storage.filename(name), '.', 1)
-- which returns the UUID portion only (everything before the first dot).
--
-- Only UPDATE and DELETE are affected — INSERT uses a different predicate
-- (foldername check + role check) and is correct as-is.
-- ──────────────────────────────────────────────────────────────────────────────

-- Drop the broken UPDATE policy
DROP POLICY IF EXISTS "avatars_update_own" ON storage.objects;

-- Drop the broken DELETE policy
DROP POLICY IF EXISTS "avatars_delete_own" ON storage.objects;

-- Recreate UPDATE policy with extension-stripped comparison
CREATE POLICY "avatars_update_own"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND split_part(storage.filename(name), '.', 1) = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND split_part(storage.filename(name), '.', 1) = auth.uid()::text
  );

-- Recreate DELETE policy with extension-stripped comparison
CREATE POLICY "avatars_delete_own"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND split_part(storage.filename(name), '.', 1) = auth.uid()::text
  );
