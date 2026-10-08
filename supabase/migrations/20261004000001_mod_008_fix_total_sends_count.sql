-- ──────────────────────────────────────────────────────────────────────────────
-- MOD-008 v4: Fix total_sends to count distinct routes, not ascent rows
-- ──────────────────────────────────────────────────────────────────────────────
-- Problem: The v3 send_rows CTE selected one row per ascent, so logging the
-- same route multiple times inflated total_sends (e.g. 3 logs on 1 route = 3).
-- Correct definition: the number of distinct routes where the user has at least
-- one send with style = 'flash' or 'top'.
--
-- Changes from v3:
--   1. send_rows CTE: added a.route_id to the SELECT list.
--   2. total_sends: COUNT(*) → COUNT(DISTINCT route_id).
-- Everything else is identical to 20260929000003_mod_008_fix_accumulated_days.
-- ──────────────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.get_profile_stats(uuid);

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

  -- ── Accumulated days calculation (Asia/Taipei local calendar days) ─────────
  -- TIMESTAMPTZ AT TIME ZONE 'Asia/Taipei' converts to the local timestamp;
  -- DATE(...) then extracts the local calendar date for DISTINCT counting.
  SELECT COUNT(DISTINCT DATE(logged_at AT TIME ZONE 'Asia/Taipei'))::int
  INTO v_accumulated_days
  FROM public.ascents
  WHERE user_id = p_user_id
    AND style IN ('flash', 'top');

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
      COUNT(*)    AS cnt
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
