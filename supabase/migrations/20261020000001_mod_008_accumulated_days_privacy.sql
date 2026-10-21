-- ──────────────────────────────────────────────────────────────────────────────
-- M-1 fix: Apply is_private filter to accumulated_days in get_profile_stats
-- ──────────────────────────────────────────────────────────────────────────────
-- Problem: The accumulated_days calculation in get_profile_stats counted ALL
-- ascents with style IN ('flash', 'top') for the target user, regardless of
-- whether each ascent was marked is_private. Meanwhile total_sends and
-- sends_by_grade in the same function correctly apply the privacy filter
-- (v_is_self OR a.is_private = FALSE). This caused a non-owner viewer of a
-- profile with many private sends to see accumulated_days higher than
-- total_sends warrants — the stats were internally inconsistent.
--
-- Fix: Add AND (v_is_self OR is_private = FALSE) to the accumulated_days
-- SELECT, matching the privacy predicate already applied to total_sends and
-- sends_by_grade.
--
-- Base function body copied from:
--   get_profile_stats — 20261013000006_mod_008_int009_block_filter.sql (lines 101-196)
-- All other logic (signature, SECURITY INVOKER, SET search_path, REVOKE/GRANT,
-- block check, privacy check, send_rows CTE, highest_grade) is unchanged.
-- ──────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_profile_stats(
  p_user_id UUID
)
RETURNS TABLE (
  total_sends      BIGINT,
  sends_by_grade   JSON,
  accumulated_days INT,
  highest_grade    TEXT
)
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
SET search_path = public
AS $$
DECLARE
  v_privacy         TEXT;
  v_is_self         BOOLEAN;
  v_is_follower     BOOLEAN;
  v_is_blocked      BOOLEAN;
  v_accumulated_days INT;
BEGIN
  -- ── Privacy check ──────────────────────────────────────────────────────────
  SELECT u.privacy_setting INTO v_privacy
  FROM public.users u
  WHERE u.id = p_user_id;

  v_is_self     := (auth.uid() = p_user_id);
  v_is_follower := EXISTS (
    SELECT 1 FROM public.follows f
    WHERE f.follower_id = auth.uid()
      AND f.followee_id = p_user_id
  );

  IF v_privacy = 'followers_only' AND NOT v_is_self AND NOT v_is_follower THEN
    RETURN QUERY SELECT 0::BIGINT, '[]'::JSON, 0::INT, NULL::TEXT;
    RETURN;
  END IF;

  -- ── Block check ────────────────────────────────────────────────────────────
  v_is_blocked := NOT v_is_self AND EXISTS (
    SELECT 1 FROM public.blocks b
    WHERE (b.blocker_user_id = auth.uid() AND b.blocked_user_id = p_user_id)
       OR (b.blocker_user_id = p_user_id AND b.blocked_user_id = auth.uid())
  );

  IF v_is_blocked THEN
    RETURN QUERY SELECT 0::BIGINT, '[]'::JSON, 0::INT, NULL::TEXT;
    RETURN;
  END IF;

  -- ── Accumulated days calculation (Asia/Taipei local calendar days) ─────────
  -- TIMESTAMPTZ AT TIME ZONE 'Asia/Taipei' converts to the local timestamp;
  -- DATE(...) then extracts the local calendar date for DISTINCT counting.
  -- Privacy filter matches total_sends / sends_by_grade: owner sees all ascents;
  -- non-owner sees only public (is_private = FALSE) ascents.
  SELECT COUNT(DISTINCT DATE(logged_at AT TIME ZONE 'Asia/Taipei'))::int
  INTO v_accumulated_days
  FROM public.ascents
  WHERE user_id = p_user_id
    AND style IN ('flash', 'top')
    AND (v_is_self OR is_private = FALSE);

  -- ── Return stats row ──────────────────────────────────────────────────────
  RETURN QUERY
  WITH send_rows AS (
    SELECT a.route_id, r.grade
    FROM public.ascents a
    JOIN public.routes r ON r.id = a.route_id
    WHERE a.user_id = p_user_id
      AND (a.style = 'flash' OR a.style = 'top')
      AND (v_is_self OR a.is_private = FALSE)
  ),
  grade_counts AS (
    SELECT
      grade::TEXT AS grade_label,
      COUNT(DISTINCT route_id) AS cnt   -- fix: distinct routes per grade, not ascent rows
    FROM send_rows
    GROUP BY grade
    ORDER BY MIN(grade)
  )
  SELECT
    (SELECT COUNT(DISTINCT route_id) FROM send_rows)::BIGINT  AS total_sends,
    (
      SELECT COALESCE(json_agg(json_build_object('grade', grade_label, 'count', cnt)), '[]'::JSON)
      FROM grade_counts
    )                                                          AS sends_by_grade,
    v_accumulated_days                                         AS accumulated_days,
    (
      SELECT MAX(r2.grade)::TEXT
      FROM public.ascents a2
      JOIN public.routes r2 ON r2.id = a2.route_id
      WHERE a2.user_id = p_user_id
        AND (v_is_self OR a2.is_private = FALSE)
    )                                                          AS highest_grade;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_profile_stats(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_profile_stats(UUID) TO authenticated;
