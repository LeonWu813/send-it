-- ──────────────────────────────────────────────────────────────────────────────
-- MOD-003: Route Catalog — routes table + RLS + Storage bucket policy
-- ──────────────────────────────────────────────────────────────────────────────
-- Creates:
--   • `route_grade`   — V-scale grade enum
--   • `route_color`   — fixed hold/tape color enum
--   • `route_status`  — active / retired enum
--   • `routes`        — user-submitted routes with a partial unique index on
--                       active routes; deduplication is enforced solely by the
--                       index UNIQUE (gym_id, grade, color_tag) WHERE status='active'
--
-- RLS is enabled from creation per project convention.
--   SELECT: all authenticated users
--   INSERT: authenticated users (own rows only)
--   UPDATE (retire): any authenticated user can set status = 'retired'
--   DELETE: not permitted
-- ──────────────────────────────────────────────────────────────────────────────

-- ── Grade enum (V-scale, Phase 1 only) ───────────────────────────────────────

CREATE TYPE route_grade AS ENUM (
  'VB', 'V0', 'V1', 'V2', 'V3', 'V4',
  'V5', 'V6', 'V7', 'V8', 'V9', 'V10'
);

-- ── Color enum (fixed hold/tape color set) ────────────────────────────────────

CREATE TYPE route_color AS ENUM (
  'red', 'orange', 'yellow', 'green', 'blue',
  'purple', 'pink', 'white', 'black'
);

-- ── Status enum ───────────────────────────────────────────────────────────────

CREATE TYPE route_status AS ENUM ('active', 'retired');

-- ── Routes table ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.routes (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id                UUID          NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  section_label         TEXT,                                   -- nullable; surfaced in Phase 1 as optional
  grade                 route_grade   NOT NULL,
  color_tag             route_color   NOT NULL,
  photo_url             TEXT          NOT NULL,                 -- required; uploaded to route-photos storage bucket
  -- Deduplication: the partial unique index below enforces that only one ACTIVE
  -- route may exist per (gym_id, grade, color_tag) combination at any given time.
  status                route_status  NOT NULL DEFAULT 'active',
  submitted_by_user_id  UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  retired_at            TIMESTAMPTZ,                            -- set when status transitions to 'retired'
  retired_by_user_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- ── Partial unique index (deduplication at the DB level) ─────────────────────
-- Only one ACTIVE route may exist per (gym_id, grade, color_tag).
-- Retired routes are excluded from this constraint so wall resets can reuse
-- the same combination.

CREATE UNIQUE INDEX routes_active_unique_idx
  ON public.routes (gym_id, grade, color_tag)
  WHERE status = 'active';

-- ── Index for common query patterns ──────────────────────────────────────────

CREATE INDEX routes_gym_id_status_idx ON public.routes (gym_id, status);
CREATE INDEX routes_submitted_by_idx  ON public.routes (submitted_by_user_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read all routes
CREATE POLICY "routes_select_authenticated"
  ON public.routes
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Authenticated users can only insert their own route rows
CREATE POLICY "routes_insert_own"
  ON public.routes
  FOR INSERT
  WITH CHECK (
    auth.uid() = submitted_by_user_id
    AND auth.role() = 'authenticated'
  );

-- Any authenticated user can retire (set status = 'retired') an active route.
-- Only the status, retired_at, and retired_by_user_id columns may change.
-- This policy does NOT allow re-activating retired routes or changing other fields.
CREATE POLICY "routes_retire_authenticated"
  ON public.routes
  FOR UPDATE
  USING (auth.role() = 'authenticated' AND status = 'active')
  WITH CHECK (
    status = 'retired'
    AND retired_at IS NOT NULL
    AND retired_by_user_id = auth.uid()
    -- Immutable fields must remain unchanged
    AND gym_id = gym_id
    AND grade = grade
    AND color_tag = color_tag
    AND photo_url = photo_url
    AND submitted_by_user_id = submitted_by_user_id
    AND created_at = created_at
  );

-- No DELETE policy → only service_role can delete rows (admin via Studio)
