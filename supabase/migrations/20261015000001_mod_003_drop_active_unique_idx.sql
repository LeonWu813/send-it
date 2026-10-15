-- Migration: MOD-003 Rev 37 — Drop active-route uniqueness constraint; add check_route_duplicate RPC
--
-- Rev 37 removes the UNIQUE partial index on (gym_id, grade, color_tag) WHERE status='active'.
-- Duplicate active routes are now allowed by design (AC-020): a gym can legitimately have
-- two V5 Blue routes on at the same time. Route identity is `id` only.
--
-- A non-blocking soft warning (AC-187) is implemented client-side: after a successful
-- submit_route call, the client calls check_route_duplicate to determine whether
-- another active route with the same combo already existed, and shows an advisory notice
-- if true. The submission is never rejected or blocked.
--
-- The per-submitter pending-routes uniqueness index (routes_pending_unique_per_submitter)
-- is DROPPED per AC-029 (Rev 37): because duplicates are now allowed by design, a user
-- may also submit more than one route with the same gym + grade + color while pending.
--
-- The non-unique partial index routes_active_grade_color_idx is preserved (or created
-- if absent) to back the AC-187 count query efficiently.
--
-- DO NOT run supabase db push — apply this migration manually.

-- ── Step 1: Drop the active-route uniqueness index ────────────────────────────
DROP INDEX IF EXISTS public.routes_active_unique_idx;

-- ── Step 2: Drop the per-submitter pending uniqueness index ───────────────────
-- AC-029 (Rev 37): duplicates are allowed by design; a user may hold more than one
-- pending submission for the same (gym_id, grade, color_tag).
DROP INDEX IF EXISTS public.routes_pending_unique_per_submitter;

-- ── Step 3: Create (or keep) a plain non-unique index for AC-187 queries ──────
-- This index backs the check_route_duplicate RPC and any client-side count query
-- against active routes filtered by (gym_id, grade, color_tag).
CREATE INDEX IF NOT EXISTS routes_active_grade_color_idx
  ON public.routes (gym_id, grade, color_tag)
  WHERE status = 'active';

-- ── Step 4: Add check_route_duplicate RPC ─────────────────────────────────────
-- Called by the client AFTER submit_route succeeds.
-- Returns TRUE when at least one OTHER active route exists at the same gym
-- with the same grade + color_tag (i.e., excluding the just-inserted route id).
--
-- The caller passes the newly inserted route's id as p_exclude_route_id so that
-- the just-created row does not count as its own duplicate.
--
-- SECURITY INVOKER: executes with the caller's RLS context.
-- The routes table RLS SELECT policy allows authenticated users to read active
-- routes, so this function naturally sees only rows the caller is allowed to see.
--
-- GRANT EXECUTE to authenticated only; REVOKE from anon and public.

CREATE OR REPLACE FUNCTION public.check_route_duplicate(
  p_gym_id          UUID,
  p_grade           public.route_grade,
  p_color_tag       public.route_color,
  p_exclude_route_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.routes
    WHERE gym_id   = p_gym_id
      AND grade    = p_grade
      AND color_tag = p_color_tag
      AND status   = 'active'
      AND id       <> p_exclude_route_id
  )
$$;

REVOKE EXECUTE ON FUNCTION public.check_route_duplicate(UUID, public.route_grade, public.route_color, UUID) FROM public;
REVOKE EXECUTE ON FUNCTION public.check_route_duplicate(UUID, public.route_grade, public.route_color, UUID) FROM anon;
GRANT  EXECUTE ON FUNCTION public.check_route_duplicate(UUID, public.route_grade, public.route_color, UUID) TO authenticated;
