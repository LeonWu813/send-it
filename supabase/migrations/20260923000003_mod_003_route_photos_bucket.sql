-- MOD-003: create route-photos storage bucket and RLS policies.
-- The bucket is referenced by uploadRoutePhoto() in route-service.ts
-- but was never provisioned.

-- ── 1. Bucket ─────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
  VALUES ('route-photos', 'route-photos', false)
  ON CONFLICT (id) DO NOTHING;

-- ── 2. RLS policies on storage.objects ───────────────────────────────────────

-- SELECT: any authenticated user can view route photos (needed to display them in-app)
CREATE POLICY "route_photos_select_authenticated"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'route-photos'
    AND auth.role() = 'authenticated'
  );

-- INSERT: authenticated users can upload under their own userId/ prefix only
CREATE POLICY "route_photos_insert_own"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'route-photos'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- DELETE: users can delete their own photos only
CREATE POLICY "route_photos_delete_own"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'route-photos'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
