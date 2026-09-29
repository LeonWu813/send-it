-- ──────────────────────────────────────────────────────────────────────────────
-- MOD-006: Social Graph & Feed — Report-exclusion filter (AC-141)
-- ──────────────────────────────────────────────────────────────────────────────
-- Replaces `get_activity_feed` to add the beta-video report-exclusion filter
-- to the `video_items` CTE (AC-141, PRD Revision 16).
--
-- Ordering dependency: this migration MUST run after
--   20260928000001_mod_005_video_reports.sql
-- which adds the `is_reported` and `report_dismissed` columns to
-- `public.beta_videos`. Filename ordering guarantees this.
--
-- Change: `video_items` CTE gains a WHERE clause:
--   WHERE (bv.is_reported = FALSE OR bv.report_dismissed = TRUE)
-- This excludes any beta video that is reported AND not yet admin-dismissed
-- (AC-141). Admin-dismissed videos (report_dismissed = TRUE) reappear in the
-- feed per AC-143. The `ascent_items` CTE is unchanged — ascents are not
-- reportable in Phase 1.
--
-- The predicate is the single canonical beta-video exclusion filter shared with
-- `fetchBetaVideosForRoute` (AC-142). Do NOT simplify to a bare
-- `bv.is_reported = FALSE` — that would permanently hide admin-dismissed videos
-- and violate AC-143.
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
  --   1. Users the caller has blocked (blocks.blocker_id = caller)
  --   2. Users who have blocked the caller (blocks.blocker_id = followee)
  --   3. Users with followers_only privacy where caller is not a follower
  --      (already satisfied because we start from follows, but re-enforced
  --       for robustness if the follower relationship is somehow stale)
  WITH qualifying_followees AS (
    SELECT f.followee_id
    FROM public.follows f
    JOIN public.users u ON u.id = f.followee_id
    WHERE
      f.follower_id = auth.uid()
      -- Block filter: caller blocked them
      AND NOT EXISTS (
        SELECT 1 FROM public.blocks b
        WHERE b.blocker_id = auth.uid() AND b.blocked_id = f.followee_id
      )
      -- Block filter: they blocked the caller (symmetric)
      AND NOT EXISTS (
        SELECT 1 FROM public.blocks b
        WHERE b.blocker_id = f.followee_id AND b.blocked_id = auth.uid()
      )
      -- Privacy filter: if followers_only, the caller must be following them
      -- (this is always true here since we join from follows, but kept explicit
      --  for correctness when privacy_setting changes after the follow)
      AND (
        u.privacy_setting = 'public'
        OR EXISTS (
          SELECT 1 FROM public.follows f2
          WHERE f2.follower_id = auth.uid() AND f2.followee_id = u.id
        )
      )
  ),

  -- ── Ascent feed items ────────────────────────────────────────────────────
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
  ),

  -- ── Beta video feed items ────────────────────────────────────────────────
  -- AC-141: exclude beta videos that are reported and not yet admin-dismissed.
  -- Predicate: (bv.is_reported = FALSE OR bv.report_dismissed = TRUE)
  --   - is_reported = FALSE  → video was never reported; include it.
  --   - report_dismissed = TRUE → admin reviewed and dismissed; re-include per AC-143.
  --   - is_reported = TRUE AND report_dismissed = FALSE → hidden until admin acts.
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
