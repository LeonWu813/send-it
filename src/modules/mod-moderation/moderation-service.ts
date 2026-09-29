/**
 * Moderation service — all Supabase data access for MOD-009.
 *
 * Public API surface:
 *   reportUser(targetUserId, category, note?)  — inserts a Report row (AC-080)
 *   blockUser(blockedUserId)                   — inserts a Block row (AC-082)
 *   unblockUser(blockedUserId)                 — deletes the Block row
 *   fetchBlockedUserIds()                      — returns Set<string> of all user IDs
 *                                                the current user has blocked or is
 *                                                blocked by (both directions, AC-084)
 *   isBlocked(userId)                          — returns boolean
 *
 * Rules:
 * - Uses the shared Supabase singleton from src/lib/supabase.ts.
 * - Never calls createClient() directly.
 * - The `reports` table is INSERT-only for authenticated users; SELECT is
 *   service-role only (admin in Supabase Studio).
 * - The `blocks` table is SELECT/INSERT/DELETE for both parties (RLS: participant).
 */

import { supabase } from '../../lib/supabase';
import type { ReportCategory } from './types';

// ── Report ────────────────────────────────────────────────────────────────────

/**
 * Submit a user-profile report (AC-080).
 *
 * Inserts a row into `reports` with status = 'open'. The reporter immediately
 * receives a confirmation state in the UI (AC-081) — no admin action is needed
 * to complete the user-facing flow.
 *
 * @param targetUserId  UUID of the user being reported.
 * @param category      Report category (inappropriate | spam | harassment | other).
 * @param note          Optional free-text note (max 280 chars, enforced in UI).
 * @throws {Error}      with a user-facing message on failure.
 */
export async function reportUser(
  targetUserId: string,
  category: ReportCategory,
  note?: string,
): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const reporterUserId = sessionData?.session?.user?.id;
  if (!reporterUserId) {
    throw new Error('Not authenticated.');
  }

  const { error } = await supabase.from('reports').insert({
    reporter_user_id: reporterUserId,
    target_type: 'user',
    target_id: targetUserId,
    category,
    note: note ?? null,
    status: 'open',
  });

  if (error) {
    throw new Error('Failed to submit report. Please try again.');
  }
}

// ── Block / Unblock ───────────────────────────────────────────────────────────

/**
 * Block a user (AC-082).
 *
 * Inserts a row into `blocks` as (blocker_user_id = current user, blocked_user_id).
 * The block is symmetric at the feed level — both parties' content is hidden from
 * each other (AC-084), enforced by the get_activity_feed RPC.
 *
 * @param blockedUserId  UUID of the user to block.
 * @throws {Error}       with a user-facing message on failure.
 */
export async function blockUser(blockedUserId: string): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const blockerUserId = sessionData?.session?.user?.id;
  if (!blockerUserId) {
    throw new Error('Not authenticated.');
  }

  const { error } = await supabase.from('blocks').insert({
    blocker_user_id: blockerUserId,
    blocked_user_id: blockedUserId,
  });

  if (error) {
    // 23505 = unique_violation — already blocked, treat as success (idempotent).
    if (error.code === '23505') {
      return;
    }
    throw new Error('Action failed. Please try again.');
  }
}

/**
 * Unblock a user.
 *
 * Deletes the Block row where blocker_user_id = current user AND
 * blocked_user_id = blockedUserId. If no row exists, this is a no-op.
 *
 * @param blockedUserId  UUID of the user to unblock.
 * @throws {Error}       with a user-facing message on failure.
 */
export async function unblockUser(blockedUserId: string): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const blockerUserId = sessionData?.session?.user?.id;
  if (!blockerUserId) {
    throw new Error('Not authenticated.');
  }

  const { error } = await supabase
    .from('blocks')
    .delete()
    .eq('blocker_user_id', blockerUserId)
    .eq('blocked_user_id', blockedUserId);

  if (error) {
    throw new Error('Action failed. Please try again.');
  }
}

/**
 * Fetch the set of all user IDs involved in a block relationship with the
 * current user (both directions — AC-082 + AC-084 symmetric).
 *
 * Used for client-side filtering on surfaces that are not covered by the
 * get_activity_feed RPC.
 *
 * @returns  Set<string> of user IDs that the current user has blocked or
 *           that have blocked the current user.
 * @throws {Error} on failure.
 */
export async function fetchBlockedUserIds(): Promise<Set<string>> {
  const { data: sessionData } = await supabase.auth.getSession();
  const currentUserId = sessionData?.session?.user?.id;
  if (!currentUserId) return new Set();

  const { data, error } = await supabase
    .from('blocks')
    .select('blocker_user_id, blocked_user_id');

  if (error) {
    throw new Error('Failed to load block list. Please try again.');
  }

  const ids = new Set<string>();
  for (const row of data ?? []) {
    const r = row as { blocker_user_id: string; blocked_user_id: string };
    // Both directions: the other party in the block relationship.
    if (r.blocker_user_id === currentUserId) {
      ids.add(r.blocked_user_id);
    } else {
      ids.add(r.blocker_user_id);
    }
  }
  return ids;
}

/**
 * Check whether a block relationship exists between the current user and a
 * given user (either direction).
 *
 * @param userId  UUID of the user to check.
 * @returns       true if any block exists between the current user and userId.
 * @throws {Error} on failure.
 */
export async function isBlocked(userId: string): Promise<boolean> {
  const blockedIds = await fetchBlockedUserIds();
  return blockedIds.has(userId);
}
