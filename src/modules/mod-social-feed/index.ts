/**
 * Public API barrel for mod-social-feed (MOD-006 — Social Graph & Feed).
 *
 * Other modules must import from this barrel rather than reaching into
 * internal files (social-feed-service.ts, types.ts, screens/) directly.
 *
 * Cross-module import rule (production.md): other modules may import only
 * public service functions and navigator entry-point components from this
 * barrel — never internal screens/ or components/ subdirectories directly.
 */

// ── Service functions ─────────────────────────────────────────────────────────

export {
  follow,
  unfollow,
  fetchIsFollowing,
  fetchFollowerCounts,
  fetchActivityFeed,
  likeBetaVideo,
  unlikeBetaVideo,
  fetchLikeInfo,
  fetchFollowing,
  fetchFollowersList,
  fetchFollowingList,
  /** AC-186 (deferred): batched like count + own-like state. Not wired in Phase 1. */
  fetchLikeInfoBatch,
} from './social-feed-service';

// ── Navigator entry point ─────────────────────────────────────────────────────

/**
 * Public entry-point for AppShell (MOD-012) to mount the other-user profile
 * overlay. Re-exported here for discoverability; also available via
 * UserProfileNavigator.tsx at the module root.
 */
export { default as UserProfileScreen } from './UserProfileNavigator';

// ── Screen components (public entry points) ───────────────────────────────────

/**
 * Followers list screen (AC-146). Consumed by mod-auth-profile ProfileNavigator.
 */
export { default as FollowersListScreen } from './screens/FollowersListScreen';
export type { FollowersListScreenProps } from './screens/FollowersListScreen';

/**
 * Following list screen (AC-147). Consumed by mod-auth-profile ProfileNavigator.
 */
export { default as FollowingListScreen } from './screens/FollowingListScreen';
export type { FollowingListScreenProps } from './screens/FollowingListScreen';

// ── Types ─────────────────────────────────────────────────────────────────────

export type {
  Follow,
  Reaction,
  FeedItem,
  FollowerCounts,
  LikeInfo,
  FollowingUser,
  UserListItem,
} from './types';
