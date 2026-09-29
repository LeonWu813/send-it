-- ──────────────────────────────────────────────────────────────────────────────
-- MOD-008 v3: Fix accumulated_days timezone handling
-- ──────────────────────────────────────────────────────────────────────────────
-- Problem: DATE(logged_at) uses the DB server timezone (UTC). For users in
-- Asia/Taipei (UTC+8), a session logged at 23:30 UTC+8 is stored as 15:30 UTC,
-- so DATE(logged_at) in UTC correctly maps to the same calendar day. However,
-- to be explicit and consistent with Taiwan local time, we convert to UTC first
-- using AT TIME ZONE 'UTC' — this is a no-op for TIMESTAMPTZ (already UTC) but
-- makes the intent clear. For correct local-day counting in Taiwan time, we use
-- AT TIME ZONE 'Asia/Taipei'.
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
    SELECT r.grade
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
    (SELECT COUNT(*) FROM send_rows)::BIGINT               AS total_sends,
    (
      SELECT COALESCE(json_agg(json_build_object('grade', grade_label, 'count', cnt)), '[]'::JSON)
      FROM grade_counts
    )                                                       AS sends_by_grade,
    v_accumulated_days                                      AS accumulated_days,
    (
      SELECT MAX(r2.grade)::TEXT
      FROM public.ascents a2
      JOIN public.routes r2 ON r2.id = a2.route_id
      WHERE a2.user_id = p_user_id
        AND (v_is_self OR a2.is_private = FALSE)
    )                                                       AS highest_grade;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_profile_stats(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_profile_stats(UUID) TO authenticated;
