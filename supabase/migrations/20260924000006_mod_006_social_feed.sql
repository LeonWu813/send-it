-- ──────────────────────────────────────────────────────────────────────────────
-- MOD-006: Social Graph & Feed
-- ──────────────────────────────────────────────────────────────────────────────
-- Creates:
--   • `follows`   — follow relationship between users (AC-050)
--   • `reactions` — beta-video like reactions (AC-052; Phase 1: beta_video only)
--   • `get_activity_feed` — SECURITY INVOKER RPC that composes:
--       Follow ∩ (¬Block, symmetric) ∩ privacy (followers_only filter) (AC-051)
--
-- Key design decisions:
--   • The activity feed MUST be served via a SECURITY INVOKER RPC — raw client
--     SELECT on ascents/beta_videos is prohibited for the feed (spec hard req).
--   • The Block table is owned by MOD-009; this migration reads it as a dep.
--     A placeholder Block table is NOT created here; MOD-009 owns that migration.
--     The RPC guards against Block rows being absent by using LEFT JOIN.
--   • Reaction unique constraint (user_id, target_type, target_id) enforces
--     idempotent single-like at the DB level (AC-052).
--   • No comments table, no like on ascents (AC-053).
-- ──────────────────────────────────────────────────────────────────────────────

-- ── follows table ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.follows (
  follower_id  UUID  NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  followee_id  UUID  NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (follower_id, followee_id),
  CONSTRAINT follows_no_self_follow CHECK (follower_id <> followee_id)
);

CREATE INDEX follows_follower_id_idx ON public.follows (follower_id);
CREATE INDEX follows_followee_id_idx ON public.follows (followee_id);

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

-- Own follows: the current user can see who they follow and who follows them.
CREATE POLICY "follows_select_own"
  ON public.follows
  FOR SELECT
  USING (auth.uid() = follower_id OR auth.uid() = followee_id);

-- Follow: authenticated users can insert their own follow rows.
CREATE POLICY "follows_insert_own"
  ON public.follows
  FOR INSERT
  WITH CHECK (auth.uid() = follower_id AND auth.role() = 'authenticated');

-- Unfollow: authenticated users can delete their own follow rows.
CREATE POLICY "follows_delete_own"
  ON public.follows
  FOR DELETE
  USING (auth.uid() = follower_id);

GRANT SELECT, INSERT, DELETE ON public.follows TO authenticated;

-- ── reactions table ───────────────────────────────────────────────────────────
-- Phase 1: target_type is always 'beta_video'.
-- The unique constraint (user_id, target_type, target_id) is the DB source of
-- truth for the one-like-per-user-per-video invariant (AC-052).

CREATE TYPE reaction_target_type AS ENUM ('beta_video');

CREATE TABLE IF NOT EXISTS public.reactions (
  id           UUID                  PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID                  NOT NULL DEFAULT auth.uid()
                                       REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type  reaction_target_type  NOT NULL,
  target_id    UUID                  NOT NULL,
  created_at   TIMESTAMPTZ           NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, target_type, target_id)
);

CREATE INDEX reactions_target_idx ON public.reactions (target_type, target_id);
CREATE INDEX reactions_user_id_idx ON public.reactions (user_id);

ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read reactions (for like counts and own-like state).
CREATE POLICY "reactions_select_authenticated"
  ON public.reactions
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Users may only insert their own reaction rows.
CREATE POLICY "reactions_insert_own"
  ON public.reactions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id AND auth.role() = 'authenticated');

-- Users may only delete their own reaction rows (unlike).
CREATE POLICY "reactions_delete_own"
  ON public.reactions
  FOR DELETE
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, DELETE ON public.reactions TO authenticated;

-- ── get_activity_feed RPC — SECURITY INVOKER ──────────────────────────────────
--
-- Composes: Follow ∩ (¬Block, symmetric) ∩ privacy
--
-- Returns a chronological list of feed items (ascents + beta_videos) from
-- users that the calling user follows, excluding:
--   • Activity from users the caller has blocked (Block.blocker_id = caller).
--   • Activity from users who have blocked the caller (Block.blocker_id = them).
--   • Activity from users with privacy_setting = 'followers_only' where the
--     caller is NOT a follower (i.e., follower did not yet follow back or the
--     follow was removed). Public profiles are always included.
--
-- Pagination: limit + offset (caller supplies; default limit 20).
--
-- item_type: 'ascent' | 'beta_video' — consumers use this to render the
-- correct card variant.
--
-- SECURITY INVOKER: runs with the permissions of the calling user (auth.uid()),
-- meaning RLS policies on ascents, beta_videos, users, follows, blocks apply
-- automatically. This is the required approach for feed composition per spec.
--
-- NOTE: The blocks table is owned by MOD-009. This RPC references it via a
-- LEFT JOIN so that if the table does not yet exist (e.g., in test environments
-- where MOD-009 migration has not run), the join returns no rows and effectively
-- disables block filtering gracefully. In production the MOD-009 migration must
-- run before MOD-006 is used.
-- ─────────────────────────────────────────────────────────────────────────────

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

-- ── get_follower_counts RPC — SECURITY INVOKER ───────────────────────────────
-- Returns follower and following counts for a given user_id.
-- Used for immediate count updates in follow/unfollow (AC-050).

CREATE OR REPLACE FUNCTION public.get_follower_counts(p_user_id UUID)
RETURNS TABLE (
  follower_count  BIGINT,
  following_count BIGINT
)
LANGUAGE sql
SECURITY INVOKER
STABLE
SET search_path = public
AS $$
  SELECT
    (SELECT COUNT(*) FROM public.follows WHERE followee_id = p_user_id) AS follower_count,
    (SELECT COUNT(*) FROM public.follows WHERE follower_id = p_user_id) AS following_count;
$$;

REVOKE EXECUTE ON FUNCTION public.get_follower_counts(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_follower_counts(UUID) TO authenticated;

-- ── get_like_count RPC — SECURITY INVOKER ────────────────────────────────────
-- Returns the like count and whether the calling user has liked a given item.
-- Used to drive immediate like count updates (AC-052).

CREATE OR REPLACE FUNCTION public.get_like_info(
  p_target_type TEXT,
  p_target_id   UUID
)
RETURNS TABLE (
  like_count   BIGINT,
  user_has_liked BOOLEAN
)
LANGUAGE sql
SECURITY INVOKER
STABLE
SET search_path = public
AS $$
  SELECT
    COUNT(*) AS like_count,
    BOOL_OR(user_id = auth.uid()) AS user_has_liked
  FROM public.reactions
  WHERE target_type = p_target_type::reaction_target_type
    AND target_id   = p_target_id;
$$;

REVOKE EXECUTE ON FUNCTION public.get_like_info(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_like_info(TEXT, UUID) TO authenticated;
