/**
 * Types for MOD-009: Moderation (Report & Block).
 *
 * ReportCategory: the four categories a user can file a profile report under (AC-080).
 * BlockStatus: the block relationship status between two users.
 * Report: a row from the `reports` table.
 * Block: a row from the `blocks` table.
 */

/** The four categories available when filing a user-profile report (AC-080). */
export type ReportCategory = 'inappropriate' | 'spam' | 'harassment' | 'other';

/**
 * The block status from the perspective of the current user relative to a target.
 *
 * 'none'    — no block relationship exists.
 * 'blocker' — the current user has blocked the target.
 * 'blocked' — the target has blocked the current user.
 */
export type BlockStatus = 'none' | 'blocker' | 'blocked';

/** A row from the `reports` table. */
export interface Report {
  id: string;
  reporter_user_id: string;
  target_type: 'user';
  target_id: string;
  category: ReportCategory;
  note: string | null;
  status: 'open' | 'reviewed' | 'actioned' | 'dismissed';
  created_at: string;
  reviewed_at: string | null;
}

/** A row from the `blocks` table. */
export interface Block {
  blocker_user_id: string;
  blocked_user_id: string;
  created_at: string;
}
