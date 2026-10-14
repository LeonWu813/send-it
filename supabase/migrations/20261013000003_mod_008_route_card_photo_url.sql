-- ──────────────────────────────────────────────────────────────────────────────
-- MOD-008 AC-183: add photo_url to get_profile_history RPC
-- ──────────────────────────────────────────────────────────────────────────────
-- The send-history section now renders route cards using the shared RouteCard
-- component (src/components/RouteCard.tsx, owned by MOD-012). RouteCard requires
-- a photo_url field. This migration adds photo_url to the get_profile_history
-- RPC return set so the client can pass it through to RouteCard.
--
-- All other RPC logic (privacy gate, filters, ordering) is unchanged.
-- ──────────────────────────────────────────────────────────────────────────────

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
  ascent_id     UUID,
  route_id      UUID,
  gym_id        UUID,
  gym_name      TEXT,
  grade         TEXT,
  color_tag     TEXT,
  section_label TEXT,
  photo_url     TEXT,
  style         TEXT,
  attempts      INT,
  note          TEXT,
  logged_at     TIMESTAMPTZ,
  is_private    BOOLEAN
)
LANGUAGE sql
SECURITY INVOKER
STABLE
SET search_path = public
AS $$
  SELECT
    a.id              AS ascent_id,
    a.route_id        AS route_id,
    r.gym_id          AS gym_id,
    g.name            AS gym_name,
    r.grade::TEXT     AS grade,
    r.color_tag::TEXT AS color_tag,
    r.section_label   AS section_label,
    r.photo_url       AS photo_url,
    a.style::TEXT     AS style,
    a.attempts        AS attempts,
    a.note            AS note,
    a.logged_at       AS logged_at,
    a.is_private      AS is_private
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
