/**
 * Social Feed service — all Supabase data access for MOD-006.
 *
 * Public API surface:
 *   follow(followeeId)         — follow a user (AC-050)
 *   unfollow(followeeId)       — unfollow a user (AC-050)
 *   fetchIsFollowing(...)      — check follow state
 *   fetchFollowerCounts(...)   — get follower/following counts (AC-050)
 *   fetchActivityFeed(...)     — chronological feed via SECURITY INVOKER RPC (AC-051)
 *   likeBetaVideo(targetId)    — like a beta video (AC-052, idempotent)
 *   unlikeBetaVideo(targetId)  — unlike a beta video
 *   fetchLikeInfo(targetId)    — like count + own-like state (AC-052)
 *   fetchFollowing(userId)     — list of users the given user follows
 *                                (public service function for MOD-012 Following strip)
 *
 * Rules:
 * - Uses the shared Supabase singleton from src/lib/supabase.ts.
 * - Never calls createClient() directly.
 * - The activity feed uses the `get_activity_feed` SECURITY INVOKER RPC —
 *   raw client-side SELECT on ascents/beta_videos is NOT permitted (spec hard req).
 * - Block check is enforced at the DB level inside the RPC (MOD-009 owns blocks).
 * - Privacy filter (followers_only) is enforced inside the RPC.
 */

import { supabase } from '../../lib/supabase';
import type {
  FeedItem,
  FollowerCounts,
  FollowingUser,
  LikeInfo,
} from './types';

// ── Follow / Unfollow ─────────────────────────────────────────────────────────

/**
 * Follow a user.
 *
 * Inserts a row into `follows`. The DB unique constraint on (follower_id,
 * followee_id) prevents duplicate follows; a conflict is treated as a no-op.
 * Block check is enforced by an RLS policy on the follows table (the insert
 * will fail if either party has blocked the other, as the RPC for the feed
 * filters those out; the DB-level block enforcement lives in MOD-009).
 *
 * AC-050: follow/unfollow must reflect immediately in profile counts.
 *
 * @param followeeId  UUID of the user to follow.
 * @throws {Error}    with a user-facing message on failure.
 */
export async function follow(followeeId: string): Promise<void> {
  const { error } = await supabase
    .from('follows')
    .insert({ followee_id: followeeId });

  if (error) {
    // 23505 = unique_violation — already following, treat as success (idempotent)
    if (error.code === '23505') {
      return;
    }
    throw new Error('Failed to follow user. Please try again.');
  }
}

/**
 * Unfollow a user.
 *
 * Deletes the follow row. If no row exists, this is a no-op.
 *
 * AC-050: follow/unfollow must reflect immediately in profile counts.
 *
 * @param followeeId  UUID of the user to unfollow.
 * @throws {Error}    with a user-facing message on failure.
 */
export async function unfollow(followeeId: string): Promise<void> {
  const { data: session } = await supabase.auth.getSession();
  const followerId = session?.session?.user?.id;
  if (!followerId) {
    throw new Error('Not authenticated.');
  }

  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', followerId)
    .eq('followee_id', followeeId);

  if (error) {
    throw new Error('Failed to unfollow user. Please try again.');
  }
}

/**
 * Check whether the current user is following a given user.
 *
 * @param followeeId  UUID of the user to check.
 * @returns           true if the current user follows followeeId.
 * @throws {Error}    on Supabase failure.
 */
export async function fetchIsFollowing(followeeId: string): Promise<boolean> {
  const { data: session } = await supabase.auth.getSession();
  const followerId = session?.session?.user?.id;
  if (!followerId) return false;

  const { data, error } = await supabase
    .from('follows')
    .select('follower_id')
    .eq('follower_id', followerId)
    .eq('followee_id', followeeId)
    .maybeSingle();

  if (error) {
    throw new Error('Failed to check follow status. Please try again.');
  }

  return data !== null;
}

/**
 * Fetch follower and following counts for a given user.
 *
 * Uses the `get_follower_counts` SECURITY INVOKER RPC.
 *
 * AC-050: counts must update immediately after follow/unfollow.
 *
 * @param userId  UUID of the user.
 * @returns       { follower_count, following_count }
 * @throws {Error} on failure.
 */
export async function fetchFollowerCounts(userId: string): Promise<FollowerCounts> {
  const { data, error } = await supabase
    .rpc('get_follower_counts', { p_user_id: userId })
    .single();

  if (error) {
    throw new Error('Failed to load follower counts. Please try again.');
  }

  const row = data as { follower_count: number; following_count: number } | null;
  return {
    follower_count: row?.follower_count ?? 0,
    following_count: row?.following_count ?? 0,
  };
}

// ── Activity Feed ─────────────────────────────────────────────────────────────

/**
 * Fetch the chronological activity feed for the current user.
 *
 * This MUST use the `get_activity_feed` SECURITY INVOKER RPC — the spec
 * explicitly prohibits raw client-side SELECT on ascents/beta_videos for the
 * feed. The RPC composes Follow ∩ (¬Block, symmetric) ∩ privacy.
 *
 * AC-051: new sends/beta videos from followed users appear within one refresh.
 *
 * @param limit   Number of items to fetch (default 20).
 * @param offset  Pagination offset (default 0).
 * @returns       Chronological array of FeedItem rows.
 * @throws {Error} with a user-facing message on failure.
 */
export async function fetchActivityFeed(
  limit: number = 20,
  offset: number = 0,
): Promise<FeedItem[]> {
  const { data, error } = await supabase.rpc('get_activity_feed', {
    p_limit: limit,
    p_offset: offset,
  });

  if (error) {
    throw new Error('Failed to load activity feed. Please try again.');
  }

  return (data ?? []) as FeedItem[];
}

// ── Like / Unlike (AC-052) ────────────────────────────────────────────────────

/**
 * Like a beta video. Idempotent — the unique constraint on
 * (user_id, target_type, target_id) prevents double-likes at the DB level.
 *
 * AC-052: one like per user per beta video; like count updates immediately in UI.
 *
 * @param betaVideoId  UUID of the beta_video to like.
 * @throws {Error}     with a user-facing message on failure (excluding conflict).
 */
export async function likeBetaVideo(betaVideoId: string): Promise<void> {
  const { error } = await supabase.from('reactions').insert({
    target_type: 'beta_video',
    target_id: betaVideoId,
  });

  if (error) {
    // 23505 = unique_violation — already liked, treat as success (idempotent)
    if (error.code === '23505') {
      return;
    }
    throw new Error('Failed to like video. Please try again.');
  }
}

/**
 * Unlike a beta video. If no like row exists, this is a no-op.
 *
 * @param betaVideoId  UUID of the beta_video to unlike.
 * @throws {Error}     with a user-facing message on failure.
 */
export async function unlikeBetaVideo(betaVideoId: string): Promise<void> {
  const { data: session } = await supabase.auth.getSession();
  const userId = session?.session?.user?.id;
  if (!userId) {
    throw new Error('Not authenticated.');
  }

  const { error } = await supabase
    .from('reactions')
    .delete()
    .eq('user_id', userId)
    .eq('target_type', 'beta_video')
    .eq('target_id', betaVideoId);

  if (error) {
    throw new Error('Failed to unlike video. Please try again.');
  }
}

/**
 * Fetch the like count and whether the current user has liked a given beta video.
 *
 * Uses the `get_like_info` SECURITY INVOKER RPC so RLS scopes automatically.
 *
 * AC-052: like count must update immediately in UI on like/unlike.
 *
 * @param betaVideoId  UUID of the beta_video.
 * @returns            { like_count, user_has_liked }
 * @throws {Error}     on failure.
 */
export async function fetchLikeInfo(betaVideoId: string): Promise<LikeInfo> {
  const { data, error } = await supabase
    .rpc('get_like_info', {
      p_target_type: 'beta_video',
      p_target_id: betaVideoId,
    })
    .single();

  if (error) {
    throw new Error('Failed to load like info. Please try again.');
  }

  const row = data as { like_count: number; user_has_liked: boolean } | null;
  return {
    like_count: row?.like_count ?? 0,
    user_has_liked: row?.user_has_liked ?? false,
  };
}

// ── Public service function for MOD-012 ───────────────────────────────────────

/**
 * Fetch the list of users that `userId` is following.
 *
 * Public service function consumed by MOD-012 (HomeScreen) to populate
 * the Following Climbers strip. Returns minimal user info (id, display_name,
 * avatar_url) sufficient for rendering avatar chips.
 *
 * AC-123, AC-124: MOD-012 shows a strip of followed climbers on the Home tab.
 *
 * @param userId  UUID of the user whose following list to fetch.
 * @returns       Array of FollowingUser rows ordered by follow creation date DESC.
 * @throws {Error} with a user-facing message on failure.
 */
export async function fetchFollowing(userId: string): Promise<FollowingUser[]> {
  const { data, error } = await supabase
    .from('follows')
    .select('followee_id, users!follows_followee_id_fkey(id, display_name, avatar_url)')
    .eq('follower_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error('Failed to load following list. Please try again.');
  }

  if (!data) return [];

  // Flatten the joined user record out of the nested shape.
  // The Supabase client types the joined relation as an array; we cast through
  // unknown to get the scalar shape we know the FK join returns.
  const results: FollowingUser[] = [];
  for (const row of data) {
    const rawUser = (row as unknown as { users: unknown }).users;
    if (!rawUser) continue;
    const user = rawUser as { id: string; display_name: string; avatar_url: string | null };
    results.push({ id: user.id, display_name: user.display_name, avatar_url: user.avatar_url });
  }
  return results;
}
