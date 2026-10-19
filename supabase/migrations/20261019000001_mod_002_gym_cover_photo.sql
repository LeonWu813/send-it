-- MOD-002: Add cover_photo_url and google_place_id to gyms table (AC-194)
-- Both columns are nullable so existing rows are unaffected.
-- cover_photo_url is populated by the one-time Places API seeder (AC-195).
-- google_place_id is stored for potential future use and not surfaced in Phase 1 UI.

ALTER TABLE gyms ADD COLUMN IF NOT EXISTS cover_photo_url TEXT;
ALTER TABLE gyms ADD COLUMN IF NOT EXISTS google_place_id TEXT;
