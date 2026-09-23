-- ──────────────────────────────────────────────────────────────────────────────
-- MOD-003 patch B: route approval schema — app_settings, is_admin(), RLS rewrite,
--                  submit_route RPC, and pending partial unique index.
--
-- This file MUST run after 20260923000001_mod_003_route_status_enum.sql so that
-- the 'pending' and 'rejected' enum values are committed and usable.
-- ──────────────────────────────────────────────────────────────────────────────

-- ── 1. app_settings table ─────────────────────────────────────────────────────
-- Client-invisible: RLS enabled, no SELECT/INSERT/UPDATE/DELETE policies,
-- no grants to authenticated or anon. Read only inside SECURITY DEFINER RPCs.

CREATE TABLE IF NOT EXISTS public.app_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Seed: auto-approve ON at Phase 1 launch (routes go active immediately).
INSERT INTO public.app_settings (key, value)
  VALUES ('route_auto_approve', 'true')
  ON CONFLICT (key) DO NOTHING;

-- ── 2. is_admin() helper ──────────────────────────────────────────────────────
-- STABLE SECURITY INVOKER helper used by all admin-gated RLS policies.
-- Returns false for all Phase 1 clients (no user carries the claim).
-- Phase 1.5: grant app_metadata.role = 'admin' to the admin user via service_role;
--             zero policy migration needed — policies already reference this helper.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COALESCE((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
$$;

-- ── 3. Replace all existing RLS policies on routes ───────────────────────────
-- Drop the three policies from the initial migration by their exact names.

DROP POLICY IF EXISTS "routes_select_authenticated" ON public.routes;
DROP POLICY IF EXISTS "routes_insert_own"            ON public.routes;
DROP POLICY IF EXISTS "routes_retire_authenticated"  ON public.routes;

-- SELECT: active routes visible to all; submitter sees their own pending;
--         admin sees all. retired and rejected are invisible to normal users.
CREATE POLICY "routes_select_v2"
  ON public.routes FOR SELECT
  USING (
    status = 'active'
    OR (status = 'pending' AND submitted_by_user_id = auth.uid())
    OR public.is_admin()
  );

-- INSERT: blocked for all clients — submission goes through submit_route RPC only.
REVOKE INSERT ON public.routes FROM authenticated;

-- UPDATE: admin only (Phase 1.5 gate; always false for Phase 1 real clients).
CREATE POLICY "routes_update_admin"
  ON public.routes FOR UPDATE
  USING (public.is_admin());

-- DELETE: submitter can delete their own pending route (withdrawal).
CREATE POLICY "routes_delete_own_pending"
  ON public.routes FOR DELETE
  USING (submitted_by_user_id = auth.uid() AND status = 'pending');

-- Grant DELETE so the withdrawal policy is usable by authenticated users.
GRANT DELETE ON public.routes TO authenticated;

-- Revoke UPDATE grant — UPDATE is now admin-only via Studio/service_role in Phase 1.
REVOKE UPDATE ON public.routes FROM authenticated;

-- ── 4. submit_route SECURITY DEFINER RPC ─────────────────────────────────────
-- Handles all route creation server-side:
--   • Derives caller identity from auth.uid() (never accepts user_id from client).
--   • Reads the route_auto_approve toggle from app_settings.
--   • Enforces one-pending-per-combo per submitter before the index fires.
--   • Returns the inserted route row so the client can read the resulting status.

CREATE OR REPLACE FUNCTION public.submit_route(
  p_gym_id        UUID,
  p_grade         route_grade,
  p_color_tag     route_color,
  p_photo_url     TEXT,
  p_section_label TEXT DEFAULT NULL
)
RETURNS public.routes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id      UUID := auth.uid();
  v_auto_approve TEXT;
  v_status       route_status;
  v_result       public.routes;
BEGIN
  -- Caller must be authenticated
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Guard: photo is required
  IF p_photo_url IS NULL OR trim(p_photo_url) = '' THEN
    RAISE EXCEPTION 'Photo is required to submit a route';
  END IF;

  -- Guard: one pending per (gym, grade, color) per submitter
  IF EXISTS (
    SELECT 1 FROM public.routes
    WHERE gym_id = p_gym_id
      AND grade = p_grade
      AND color_tag = p_color_tag
      AND submitted_by_user_id = v_user_id
      AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'You already have a pending submission for this route combination';
  END IF;

  -- Read auto-approve setting
  SELECT value INTO v_auto_approve
  FROM public.app_settings
  WHERE key = 'route_auto_approve';

  v_status := CASE WHEN v_auto_approve = 'true' THEN 'active'::route_status ELSE 'pending'::route_status END;

  -- Insert and return
  INSERT INTO public.routes (gym_id, grade, color_tag, photo_url, section_label, submitted_by_user_id, status)
  VALUES (p_gym_id, p_grade, p_color_tag, p_photo_url, p_section_label, v_user_id, v_status)
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_route(UUID, route_grade, route_color, TEXT, TEXT) TO authenticated;

-- ── 5. Partial unique index: one pending per (gym, grade, color) per submitter ─
-- Belt-and-suspenders with the RPC pre-check above.
-- Two different users may each hold a pending submission for the same combo.

CREATE UNIQUE INDEX IF NOT EXISTS routes_pending_unique_per_submitter
  ON public.routes (gym_id, grade, color_tag, submitted_by_user_id)
  WHERE status = 'pending';
