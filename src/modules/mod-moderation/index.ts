/**
 * Public API barrel for mod-moderation (MOD-009 — Moderation: Report & Block).
 *
 * Other modules must import from this barrel rather than reaching into
 * internal files directly.
 */

export {
  reportUser,
  blockUser,
  unblockUser,
  fetchBlockedUserIds,
  isBlocked,
  fetchMyBlockedUsers,
} from './moderation-service';

export type { BlockedUser } from './moderation-service';

export type { ReportCategory, BlockStatus, Report, Block } from './types';
