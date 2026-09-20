-- ──────────────────────────────────────────────────────────────────────────────
-- MOD-004: Send Logging — ascents table + RLS policies
-- ──────────────────────────────────────────────────────────────────────────────
-- Creates:
--   • `ascent_style` — flash / top / attempt / project enum
--   • `ascents`      — per-user send log rows
--
-- Key design decisions:
--   • Grade is NOT stored on the ascent — always read from route.grade at display
--     time. No grade column exists here by spec (AC-011).
--   • is_private allows users to hide individual sends from other users.
--
-- RLS rules:
--   SELECT own rows: always allowed.
--   SELECT others' public rows: allowed for authenticated users.
--   SELECT others' private rows: denied (is_private = true rows hidden).
--   INSERT: authenticated user may only insert rows with their own user_id.
--   UPDATE: authenticated user may only update their own rows.
--   DELETE: authenticated user may only delete their own rows.
-- ──────────────────────────────────────────────────────────────────────────────

-- ── Ascent style enum ─────────────────────────────────────────────────────────

CREATE TYPE ascent_style AS ENUM ('flash', 'top', 'attempt', 'project');

-- ── Ascents table ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ascents (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  route_id    UUID          NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  style       ascent_style  NOT NULL,
  attempts    INTEGER       NOT NULL CHECK (attempts >= 1),
  note        TEXT,                                             -- nullable; private to the owning user
  logged_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  is_private  BOOLEAN       NOT NULL DEFAULT FALSE
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

-- Primary query pattern: all ascents for a route (route detail page)
CREATE INDEX ascents_route_id_idx  ON public.ascents (route_id, logged_at DESC);

-- Primary query pattern: all ascents by a user (profile history page — MOD-008)
CREATE INDEX ascents_user_id_idx   ON public.ascents (user_id, logged_at DESC);

-- ── Row-Level Security ────────────────────────────────────────────────────────

ALTER TABLE public.ascents ENABLE ROW LEVEL SECURITY;

-- Owning user can always read their own ascents (public and private).
-- Other authenticated users can only read non-private ascents.
CREATE POLICY "ascents_select_own_or_public"
  ON public.ascents
  FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND (
      auth.uid() = user_id         -- own ascents: always visible
      OR is_private = FALSE         -- others' public ascents: visible
    )
  );

-- Authenticated users may only insert ascents with their own user_id.
CREATE POLICY "ascents_insert_own"
  ON public.ascents
  FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND auth.uid() = user_id
  );

-- Authenticated users may only update their own ascents.
CREATE POLICY "ascents_update_own"
  ON public.ascents
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Authenticated users may only delete their own ascents.
CREATE POLICY "ascents_delete_own"
  ON public.ascents
  FOR DELETE
  USING (auth.uid() = user_id);
