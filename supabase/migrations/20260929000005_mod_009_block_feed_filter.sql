-- ──────────────────────────────────────────────────────────────────────────────
-- MOD-009: Moderation — Block filter for get_activity_feed (AC-082, AC-084)
-- ──────────────────────────────────────────────────────────────────────────────
-- Replaces `get_activity_feed` to:
--   1. Use the full `blocks` schema column names (blocker_user_id, blocked_user_id)
--      — the MOD-006 stub used (blocker_id, blocked_id); the stub was dropped
--        and the full table was created in 20260929000004_mod_009_moderation.sql.
--   2. Add symmetric block filtering to BOTH `ascent_items` and `video_items` CTEs
--      (AC-082: hide blocked user's content from blocker's feed; AC-084: symmetric
--       — also hide blocker's content from blocked user's feed).
--
-- Ordering dependency: MUST run after:
--   20260929000004_mod_009_moderation.sql — which drops the stub and creates the
--     full `blocks` table with (blocker_user_id, blocked_user_id, created_at).
--   20260928000002_mod_006_feed_exclude_reported.sql — which adds the is_reported
--     filter to the video_items CTE; that filter is preserved here.
--
-- Block symmetry (AC-082 + AC-084): both directions must be checked.
-- The `blocks` table stores one row (blocker_user_id, blocked_user_id).
-- Both parties must check:
--   (b.blocker_user_id = auth.uid() AND b.blocked_user_id = actor)  ← caller blocked actor
--   (b.blocker_user_id = actor AND b.blocked_user_id = auth.uid())  ← actor blocked caller
-- ──────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_activity_feed(
  p_limit  INT DEFAULT 20,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  item_type        TEXT,
  item_id          UUID,
  actor_user_id    UUID,
  actor_name       TEXT,
  actor_avatar_url TEXT,
  route_id         UUID,
  route_grade      TEXT,
  created_at       TIMESTAMPTZ,
  -- ascent-specific fields (NULL for beta_video items)
  ascent_style     TEXT,
  ascent_attempts  INT,
  ascent_note      TEXT,
  -- beta_video-specific fields (NULL for ascent items)
  video_url        TEXT,
  thumbnail_url    TEXT,
  video_caption    TEXT
)
LANGUAGE sql
SECURITY INVOKER
STABLE
SET search_path = public
AS $$
  -- ── Qualifying followees ─────────────────────────────────────────────────
  -- Followees = users the caller follows, excluding:
  --   1. Users the caller has blocked (blocks.blocker_user_id = caller)
  --   2. Users who have blocked the caller (blocks.blocker_user_id = followee)
  --   3. Users with followers_only privacy where caller is not a follower
  WITH qualifying_followees AS (
    SELECT f.followee_id
    FROM public.follows f
    JOIN public.users u ON u.id = f.followee_id
    WHERE
      f.follower_id = auth.uid()
      -- Block filter (AC-082): caller blocked the followee
      AND NOT EXISTS (
        SELECT 1 FROM public.blocks b
        WHERE b.blocker_user_id = auth.uid() AND b.blocked_user_id = f.followee_id
      )
      -- Block filter (AC-084): followee blocked the caller (symmetric)
      AND NOT EXISTS (
        SELECT 1 FROM public.blocks b
        WHERE b.blocker_user_id = f.followee_id AND b.blocked_user_id = auth.uid()
      )
      -- Privacy filter
      AND (
        u.privacy_setting = 'public'
        OR EXISTS (
          SELECT 1 FROM public.follows f2
          WHERE f2.follower_id = auth.uid() AND f2.followee_id = u.id
        )
      )
  ),

  -- ── Ascent feed items ────────────────────────────────────────────────────
  -- AC-082, AC-084: additionally filter ascents by block relationship so that
  -- even if qualifying_followees already excludes blocked users, future schema
  -- changes cannot reintroduce blocked content. Defense-in-depth.
  ascent_items AS (
    SELECT
      'ascent'::TEXT           AS item_type,
      a.id                     AS item_id,
      a.user_id                AS actor_user_id,
      u.display_name           AS actor_name,
      u.avatar_url             AS actor_avatar_url,
      a.route_id               AS route_id,
      r.grade                  AS route_grade,
      a.logged_at              AS created_at,
      a.style::TEXT            AS ascent_style,
      a.attempts               AS ascent_attempts,
      a.note                   AS ascent_note,
      NULL::TEXT               AS video_url,
      NULL::TEXT               AS thumbnail_url,
      NULL::TEXT               AS video_caption
    FROM public.ascents a
    JOIN qualifying_followees qf ON qf.followee_id = a.user_id
    JOIN public.users u          ON u.id = a.user_id
    JOIN public.routes r         ON r.id = a.route_id
    WHERE a.is_private = FALSE
      AND NOT EXISTS (
        SELECT 1 FROM public.blocks b
        WHERE (b.blocker_user_id = auth.uid() AND b.blocked_user_id = a.user_id)
           OR (b.blocker_user_id = a.user_id AND b.blocked_user_id = auth.uid())
      )
  ),

  -- ── Beta video feed items ────────────────────────────────────────────────
  -- AC-141: exclude beta videos that are reported and not yet admin-dismissed.
  -- AC-082, AC-084: exclude beta videos from blocked users (both directions).
  video_items AS (
    SELECT
      'beta_video'::TEXT       AS item_type,
      bv.id                    AS item_id,
      bv.user_id               AS actor_user_id,
      u.display_name           AS actor_name,
      u.avatar_url             AS actor_avatar_url,
      bv.route_id              AS route_id,
      r.grade                  AS route_grade,
      bv.created_at            AS created_at,
      NULL::TEXT               AS ascent_style,
      NULL::INT                AS ascent_attempts,
      NULL::TEXT               AS ascent_note,
      bv.video_url             AS video_url,
      bv.thumbnail_url         AS thumbnail_url,
      bv.caption               AS video_caption
    FROM public.beta_videos bv
    JOIN qualifying_followees qf ON qf.followee_id = bv.user_id
    JOIN public.users u          ON u.id = bv.user_id
    JOIN public.routes r         ON r.id = bv.route_id
    WHERE (bv.is_reported = FALSE OR bv.report_dismissed = TRUE)
      AND NOT EXISTS (
        SELECT 1 FROM public.blocks b
        WHERE (b.blocker_user_id = auth.uid() AND b.blocked_user_id = bv.user_id)
           OR (b.blocker_user_id = bv.user_id AND b.blocked_user_id = auth.uid())
      )
  )

  -- ── Union + chronological sort + pagination ──────────────────────────────
  SELECT *
  FROM (
    SELECT * FROM ascent_items
    UNION ALL
    SELECT * FROM video_items
  ) feed
  ORDER BY created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
$$;

-- Only authenticated users may call the feed RPC.
REVOKE EXECUTE ON FUNCTION public.get_activity_feed(INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_activity_feed(INT, INT) TO authenticated;
