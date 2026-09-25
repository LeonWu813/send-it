-- ──────────────────────────────────────────────────────────────────────────────
-- MOD-005: Beta Video — beta_videos table + RLS
-- ──────────────────────────────────────────────────────────────────────────────
-- Creates:
--   • `beta_videos` — one beta video per route per upload; attached to exactly
--                     one route via route_id FK. Stores video_url, thumbnail_url,
--                     duration_seconds, and optional caption.
--
-- RLS:
--   SELECT: all authenticated users may read (privacy via uploader's profile
--           privacy_setting is a Phase 1.5 concern; in Phase 1 all beta videos
--           are readable by authenticated users).
--   INSERT: authenticated users — own rows only (user_id = auth.uid()).
--   UPDATE: not permitted in Phase 1.
--   DELETE: authenticated users may delete their own beta video rows.
--
-- Storage:
--   Video and thumbnail files are stored in the `beta-videos` Supabase Storage
--   bucket. Bucket creation and RLS policies for the bucket are managed via
--   Supabase Studio / CLI separately from this migration.
-- ──────────────────────────────────────────────────────────────────────────────

-- ── beta_videos table ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.beta_videos (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id          UUID          NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  user_id           UUID          NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  video_url         TEXT          NOT NULL,       -- storage path to the compressed MP4
  thumbnail_url     TEXT          NOT NULL,       -- storage path to the generated thumbnail
  duration_seconds  NUMERIC(6,2)  NOT NULL CHECK (duration_seconds > 0 AND duration_seconds <= 60),
  caption           TEXT,                         -- optional; user-supplied
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

-- Most common query: fetch all beta videos for a specific route
CREATE INDEX beta_videos_route_id_idx ON public.beta_videos (route_id, created_at DESC);

-- Support for per-user beta video lookups (profile history, delete own)
CREATE INDEX beta_videos_user_id_idx  ON public.beta_videos (user_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE public.beta_videos ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read beta videos
CREATE POLICY "beta_videos_select_authenticated"
  ON public.beta_videos
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Users may only insert their own beta video rows
CREATE POLICY "beta_videos_insert_own"
  ON public.beta_videos
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND auth.role() = 'authenticated'
  );

-- Users may only delete their own beta video rows
CREATE POLICY "beta_videos_delete_own"
  ON public.beta_videos
  FOR DELETE
  USING (auth.uid() = user_id);

-- ── Role privileges ───────────────────────────────────────────────────────────

GRANT SELECT, INSERT, DELETE ON public.beta_videos TO authenticated;
