/**
 * Types for MOD-006: Social Graph & Feed.
 *
 * Follow: a directed follow relationship between two users.
 * Reaction: a like on a beta video (Phase 1 only; one per user per video).
 * FeedItem: a single chronological item in the activity feed (ascent or beta_video).
 * FollowerCounts: follower + following counts for a user profile.
 * LikeInfo: like count + whether the current user has liked a given item.
 */

/** A row from the `follows` table. */
export interface Follow {
  follower_id: string;
  followee_id: string;
  created_at: string;
}

/** A row from the `reactions` table. */
export interface Reaction {
  id: string;
  user_id: string;
  target_type: 'beta_video';
  target_id: string;
  created_at: string;
}

/**
 * A single item in the activity feed, returned by the `get_activity_feed` RPC.
 *
 * item_type discriminates between 'ascent' and 'beta_video' feed cards.
 * Fields specific to one type are null for the other.
 */
export interface FeedItem {
  item_type: 'ascent' | 'beta_video';
  item_id: string;
  actor_user_id: string;
  actor_name: string;
  actor_avatar_url: string | null;
  route_id: string;
  route_grade: string;
  created_at: string;
  // Ascent-specific (null for beta_video items)
  ascent_style: string | null;
  ascent_attempts: number | null;
  ascent_note: string | null;
  // Beta-video-specific (null for ascent items)
  video_url: string | null;
  thumbnail_url: string | null;
  video_caption: string | null;
}

/** Follower and following counts for a user. */
export interface FollowerCounts {
  follower_count: number;
  following_count: number;
}

/** Like count and whether the current user has liked a given item. */
export interface LikeInfo {
  like_count: number;
  user_has_liked: boolean;
}

/**
 * Minimal user summary for the Following Climbers strip (MOD-012 public API).
 * Exposed via the `fetchFollowing` public service function.
 */
export interface FollowingUser {
  id: string;
  display_name: string;
  avatar_url: string | null;
}
