-- MOD-002: service_role GRANT on gyms table
--
-- service_role bypasses RLS but still requires table-level GRANTs from PostgreSQL.
-- The gyms table was created with authenticated-role access only. The cover-photo
-- seeder (AC-195) runs under service_role and requires SELECT + UPDATE to populate
-- cover_photo_url and google_place_id.
--
-- This grant was applied manually to the remote DB before this migration was created.
-- After pulling, mark it as already applied:
--   npx supabase migration repair --status applied 20261019000002

GRANT SELECT, UPDATE ON public.gyms TO service_role;
