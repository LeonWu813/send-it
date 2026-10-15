-- ──────────────────────────────────────────────────────────────────────────────
-- MOD-005: Beta Video — AC-188 (Rev 38)
-- Add updated_at column to beta_videos + BEFORE UPDATE trigger
-- ──────────────────────────────────────────────────────────────────────────────
--
-- Purpose:
--   Add `updated_at timestamptz NOT NULL DEFAULT now()` to beta_videos.
--   On INSERT, DEFAULT now() sets it correctly.
--   On UPDATE/replace (AC-166 upsert flow), a BEFORE UPDATE trigger sets
--   NEW.updated_at = NOW() automatically, regardless of which write path is used.
--
-- Seeding pre-existing rows:
--   After ADD COLUMN (which defaults pre-existing rows to migration-run timestamp),
--   immediately seed updated_at := created_at so pre-existing rows reflect their
--   true history rather than the migration-run timestamp.
--
-- AC-188 notes:
--   - `created_at` is never changed on replace (it stays fixed at original insert time).
--   - `updated_at` is the authoritative "last activity" / "last changed" timestamp.
--   - Used by AC-182 Home Following section's MAX(updated_at) per climber query.
--   - This migration must land before the AC-182 HomeScreen query change.
--   - Do NOT run supabase db push — apply this migration manually.
-- ──────────────────────────────────────────────────────────────────────────────

-- ── Step 1: Add updated_at column ────────────────────────────────────────────
-- DEFAULT now() gives INSERT-time value for new rows and migration-run time for
-- existing rows (corrected in Step 2).

ALTER TABLE public.beta_videos
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ── Step 2: Seed pre-existing rows ────────────────────────────────────────────
-- Set updated_at = created_at for all rows that were inserted before this
-- migration ran. Because the ADD COLUMN DEFAULT now() set them all to the
-- migration-run timestamp, we overwrite with created_at so existing rows
-- reflect their true creation time rather than the migration timestamp.
-- New rows inserted after this migration will receive updated_at = NOW() from
-- the DEFAULT (on INSERT) or from the trigger (on UPDATE).

UPDATE public.beta_videos
  SET updated_at = created_at;

-- ── Step 3: Create the BEFORE UPDATE trigger function ────────────────────────
-- The trigger sets NEW.updated_at = NOW() on every UPDATE, regardless of which
-- write path fires (PostgREST upsert, a future RPC, or Supabase Studio).
-- This is more robust than a client-supplied value: it is server-authoritative
-- and covers any future write path that forgets to bump updated_at explicitly.

CREATE OR REPLACE FUNCTION public.set_beta_videos_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

-- ── Step 4: Attach the trigger to beta_videos ─────────────────────────────────

CREATE TRIGGER beta_videos_set_updated_at
  BEFORE UPDATE ON public.beta_videos
  FOR EACH ROW EXECUTE FUNCTION public.set_beta_videos_updated_at();
