-- ──────────────────────────────────────────────────────────────────────────────
-- MOD-009: Moderation (Report & Block)
-- ──────────────────────────────────────────────────────────────────────────────
-- Creates:
--   • `report_category` enum — inappropriate | spam | harassment | other
--   • `reports` — user-profile report submissions (AC-080)
--   • `blocks` — full schema layered on top of the MOD-006 stub
--
-- Ordering dependency: this migration MUST run after
--   20260924000006_mod_006_social_feed.sql
-- which creates the `blocks` stub (blocker_id, blocked_id). This migration
-- drops the stub and recreates the full table with the correct schema
-- (blocker_user_id, blocked_user_id, created_at), RLS policies, and GRANTs.
-- The feed function is updated in the next migration to use the new column names.
--
-- AC-080: report a user profile with category + optional note.
-- AC-082, AC-084: block/unblock; block is stored as (blocker_user_id, blocked_user_id).
-- AC-083: RLS / service-layer prevents blocked user from following blocker.
-- AC-085: report digest Edge Function covers the `reports` table only.
-- ──────────────────────────────────────────────────────────────────────────────

-- ── report_category enum ──────────────────────────────────────────────────────

CREATE TYPE public.report_category AS ENUM (
  'inappropriate',
  'spam',
  'harassment',
  'other'
);

-- ── reports table ─────────────────────────────────────────────────────────────
-- Stores user-profile reports only (AC-080).
-- Beta-video reports are stored in the `video_reports` table (MOD-005).

CREATE TABLE public.reports (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user_id  UUID         NOT NULL REFERENCES public.users(id),
  target_type       TEXT         NOT NULL DEFAULT 'user',  -- always 'user' in Phase 1
  target_id         UUID         NOT NULL,
  category          public.report_category NOT NULL,
  note              TEXT,
  status            TEXT         NOT NULL DEFAULT 'open',  -- open | reviewed | actioned | dismissed
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  reviewed_at       TIMESTAMPTZ
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Authenticated users can INSERT their own reports (AC-080).
CREATE POLICY "reports_insert_own" ON public.reports
  FOR INSERT TO authenticated
  WITH CHECK (reporter_user_id = auth.uid());

-- Only the service role can SELECT reports (admin via Supabase Studio).
-- No SELECT/UPDATE/DELETE policies for authenticated users.

GRANT INSERT ON public.reports TO authenticated;

-- ── blocks table (full schema) ────────────────────────────────────────────────
-- The MOD-006 migration created a stub table `public.blocks` with columns
-- (blocker_id, blocked_id) so that the get_activity_feed function body could
-- be validated at CREATE FUNCTION time. We now drop the stub and create the
-- full table with the canonical column names (blocker_user_id, blocked_user_id)
-- plus the created_at column and full RLS/GRANTs.
--
-- The get_activity_feed function is updated in the next migration
-- (20260929000005_mod_009_block_feed_filter.sql) to use the new column names.

-- Drop the stub (no data; no FKs or indexes beyond the PK).
DROP TABLE IF EXISTS public.blocks;

CREATE TABLE public.blocks (
  blocker_user_id  UUID         NOT NULL REFERENCES public.users(id),
  blocked_user_id  UUID         NOT NULL REFERENCES public.users(id),
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_user_id, blocked_user_id)
);

ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;

-- Blocker can INSERT their own block rows (AC-082).
CREATE POLICY "blocks_insert_own" ON public.blocks
  FOR INSERT TO authenticated
  WITH CHECK (blocker_user_id = auth.uid());

-- Blocker can DELETE their own block rows (unblock, AC-082).
CREATE POLICY "blocks_delete_own" ON public.blocks
  FOR DELETE TO authenticated
  USING (blocker_user_id = auth.uid());

-- Both parties need SELECT for client-side filtering (AC-082, AC-084 symmetric).
CREATE POLICY "blocks_select_participant" ON public.blocks
  FOR SELECT TO authenticated
  USING (blocker_user_id = auth.uid() OR blocked_user_id = auth.uid());

GRANT SELECT, INSERT, DELETE ON public.blocks TO authenticated;
