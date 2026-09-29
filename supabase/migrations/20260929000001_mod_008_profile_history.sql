-- ──────────────────────────────────────────────────────────────────────────────
-- MOD-008: Profile History & Stats
-- ──────────────────────────────────────────────────────────────────────────────
-- Creates:
--   • `get_profile_history` — SECURITY INVOKER RPC that returns a user's ascent
--     history joined with route grade and gym info, respecting privacy settings.
--   • `get_profile_stats`   — SECURITY INVOKER RPC that returns aggregate stats
--     (total sends, sends by grade, current streak, highest grade) for a user.
--
-- Privacy enforcement (AC-064):
--   When the target user has `privacy_setting = 'followers_only'`, only followers
--   of that user may view their history. Non-followers receive zero rows.
--   This is enforced server-side inside the RPC — not only client-side.
--
-- Grade join:
--   `Ascent` has no grade column. Grade is always read from `routes.grade` at
--   display time by joining through `route_id → routes.grade` (spec hard req).
-- ──────────────────────────────────────────────────────────────────────────────

-- ── get_profile_history RPC ───────────────────────────────────────────────────
--
-- Returns the send history for a given user, filtered by optional gym_id, grade,
-- and date range. Privacy-gated: if the target user has followers_only privacy and
-- the caller is not a follower, returns zero rows.
--
-- Parameters:
--   p_user_id   UUID — the profile being viewed
--   p_gym_id    UUID — optional gym filter (NULL = no filter)
--   p_grade     TEXT — optional grade filter (NULL = no filter)
--   p_date_from TIMESTAMPTZ — optional start date (NULL = no lower bound)
--   p_date_to   TIMESTAMPTZ — optional end date (NULL = no upper bound)
--   p_limit     INT  — page size (default 50)
--   p_offset    INT  — pagination offset (default 0)
--
-- SECURITY INVOKER: runs under the calling user's permissions (auth.uid()).
-- The `ascents_select_own_or_public` RLS policy restricts:
--   • Own ascents (including private): always visible to the owner.
--   • Others' ascents: only public rows (is_private = FALSE).
-- This RPC adds the additional followers_only privacy gate on top of RLS.
-- ─────────────────────────────────────────────────────────────────────────────

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
  -- Privacy gate: if the target user has followers_only setting,
  -- the caller must be following them (or be themselves).
  -- If not, return zero rows.
  SELECT
    a.id             AS ascent_id,
    a.route_id       AS route_id,
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
    -- Privacy gate: allow if (a) caller is the owner, (b) profile is public,
    -- or (c) caller is a follower of the target user.
    AND (
      auth.uid() = p_user_id
      OR u.privacy_setting = 'public'
      OR EXISTS (
        SELECT 1 FROM public.follows f
        WHERE f.follower_id = auth.uid()
          AND f.followee_id = p_user_id
      )
    )
    -- Optional gym filter
    AND (p_gym_id IS NULL OR r.gym_id = p_gym_id)
    -- Optional grade filter
    AND (p_grade IS NULL OR r.grade::TEXT = p_grade)
    -- Optional date range
    AND (p_date_from IS NULL OR a.logged_at >= p_date_from)
    AND (p_date_to   IS NULL OR a.logged_at <= p_date_to)
  ORDER BY a.logged_at DESC
  LIMIT p_limit
  OFFSET p_offset;
$$;

REVOKE EXECUTE ON FUNCTION public.get_profile_history(UUID, UUID, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_profile_history(UUID, UUID, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, INT, INT) TO authenticated;

-- ── get_profile_stats RPC ─────────────────────────────────────────────────────
--
-- Returns aggregate stats for a given user's send history:
--   total_sends       — count of rows with style in ('flash', 'top')
--   sends_by_grade    — JSON array of { grade, count } objects, ordered by grade
--   current_streak    — consecutive calendar days ending today with ≥1 send
--   highest_grade     — the max V-grade string, ordered by the enum definition
--
-- Privacy gate: same as get_profile_history — followers_only blocks non-followers.
-- Grade ordering uses the Postgres enum ordering for route_grade (VB < V0 < ... < V10).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_profile_stats(
  p_user_id UUID
)
RETURNS TABLE (
  total_sends     BIGINT,
  sends_by_grade  JSON,
  current_streak  BIGINT,
  highest_grade   TEXT
)
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
SET search_path = public
AS $$
DECLARE
  v_privacy      TEXT;
  v_is_self      BOOLEAN;
  v_is_follower  BOOLEAN;
  v_streak       BIGINT;
  v_check_date   DATE;
  v_has_send     BOOLEAN;
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

  -- If followers_only and caller is neither owner nor follower, return empty.
  IF v_privacy = 'followers_only' AND NOT v_is_self AND NOT v_is_follower THEN
    RETURN QUERY SELECT 0::BIGINT, '[]'::JSON, 0::BIGINT, NULL::TEXT;
    RETURN;
  END IF;

  -- ── Current streak calculation ────────────────────────────────────────────
  -- Walk backwards from today; count consecutive days with ≥1 public send
  -- (or any send if the viewer is the owner).
  v_streak     := 0;
  v_check_date := CURRENT_DATE;

  LOOP
    IF v_is_self THEN
      -- Owner sees all their ascents (including private)
      SELECT EXISTS (
        SELECT 1 FROM public.ascents a
        JOIN public.routes r ON r.id = a.route_id
        WHERE a.user_id  = p_user_id
          AND (a.style = 'flash' OR a.style = 'top')
          AND a.logged_at::DATE = v_check_date
      ) INTO v_has_send;
    ELSE
      SELECT EXISTS (
        SELECT 1 FROM public.ascents a
        JOIN public.routes r ON r.id = a.route_id
        WHERE a.user_id  = p_user_id
          AND a.is_private = FALSE
          AND (a.style = 'flash' OR a.style = 'top')
          AND a.logged_at::DATE = v_check_date
      ) INTO v_has_send;
    END IF;

    EXIT WHEN NOT v_has_send;
    v_streak     := v_streak + 1;
    v_check_date := v_check_date - INTERVAL '1 day';
  END LOOP;

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
    ORDER BY MIN(grade)   -- enum ordering preserved via MIN aggregate
  )
  SELECT
    (SELECT COUNT(*) FROM send_rows)::BIGINT               AS total_sends,
    (
      SELECT COALESCE(json_agg(json_build_object('grade', grade_label, 'count', cnt)), '[]'::JSON)
      FROM grade_counts
    )                                                       AS sends_by_grade,
    v_streak                                                AS current_streak,
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
