-- ──────────────────────────────────────────────────────────────────────────────
-- MOD-008 v2: Profile History & Stats — accumulated days + route_name
-- ──────────────────────────────────────────────────────────────────────────────
-- Replaces:
--   • `get_profile_stats`   — replaces streak_days with accumulated_days
--                             (total distinct calendar days with ≥1 flash or top)
--   • `get_profile_history` — adds route_name column to the return shape
-- ──────────────────────────────────────────────────────────────────────────────

-- ── get_profile_history RPC (v2) ──────────────────────────────────────────────
--
-- Adds route_name to the return set so client-side route cards can display the
-- route name without a separate lookup.
--
-- All filter parameters are preserved for backwards compatibility but the client
-- no longer sends filter values (always passes NULL for all filter params).
-- ─────────────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.get_profile_history(uuid, uuid, text, timestamp with time zone, timestamp with time zone, integer, integer);

CREATE OR REPLACE FUNCTION public.get_profile_history(
  p_user_id   UUID,
  p_gym_id    UUID        DEFAULT NULL,
  p_grade     TEXT        DEFAULT NULL,
  p_date_from TIMESTAMPTZ DEFAULT NULL,
  p_date_to   TIMESTAMPTZ DEFAULT NULL,
  p_limit     INT         DEFAULT 50,
  p_offset    INT         DEFAULT 0
)
RETURNS TABLE (
  ascent_id    UUID,
  route_id     UUID,
  route_name   TEXT,
  gym_id       UUID,
  gym_name     TEXT,
  grade        TEXT,
  color_tag    TEXT,
  section_label TEXT,
  style        TEXT,
  attempts     INT,
  note         TEXT,
  logged_at    TIMESTAMPTZ,
  is_private   BOOLEAN
)
LANGUAGE sql
SECURITY INVOKER
STABLE
SET search_path = public
AS $$
  SELECT
    a.id             AS ascent_id,
    a.route_id       AS route_id,
    r.name           AS route_name,
    r.gym_id         AS gym_id,
    g.name           AS gym_name,
    r.grade::TEXT    AS grade,
    r.color_tag::TEXT AS color_tag,
    r.section_label  AS section_label,
    a.style::TEXT    AS style,
    a.attempts       AS attempts,
    a.note           AS note,
    a.logged_at      AS logged_at,
    a.is_private     AS is_private
  FROM public.ascents a
  JOIN public.routes r ON r.id = a.route_id
  JOIN public.gyms g   ON g.id = r.gym_id
  JOIN public.users u  ON u.id = a.user_id
  WHERE
    a.user_id = p_user_id
    AND (
      auth.uid() = p_user_id
      OR u.privacy_setting = 'public'
      OR EXISTS (
        SELECT 1 FROM public.follows f
        WHERE f.follower_id = auth.uid()
          AND f.followee_id = p_user_id
      )
    )
    AND (p_gym_id IS NULL OR r.gym_id = p_gym_id)
    AND (p_grade IS NULL OR r.grade::TEXT = p_grade)
    AND (p_date_from IS NULL OR a.logged_at >= p_date_from)
    AND (p_date_to   IS NULL OR a.logged_at <= p_date_to)
  ORDER BY a.logged_at DESC
  LIMIT p_limit
  OFFSET p_offset;
$$;

REVOKE EXECUTE ON FUNCTION public.get_profile_history(UUID, UUID, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_profile_history(UUID, UUID, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, INT, INT) TO authenticated;

-- ── get_profile_stats RPC (v2) ────────────────────────────────────────────────
--
-- Replaces current_streak with accumulated_days:
--   accumulated_days — total distinct calendar days on which the user recorded
--                      at least one flash or top (regardless of recency).
--
-- The streak loop is removed entirely. Privacy gate is unchanged.
-- ─────────────────────────────────────────────────────────────────────────────

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

  -- ── Accumulated days calculation ──────────────────────────────────────────
  SELECT COUNT(DISTINCT DATE(logged_at))::int
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
