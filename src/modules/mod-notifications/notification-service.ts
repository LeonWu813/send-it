/**
 * Notification service — all Supabase data access for MOD-007.
 *
 * Public API surface:
 *   registerDeviceToken(deviceToken, expoPushToken?)
 *       — upsert an iOS device token on sign-in (AC-054)
 *   fetchNotifications()
 *       — fetch the in-app inbox for the current user, most-recent first
 *   markNotificationsRead()
 *       — mark all unread notifications as read (called when inbox opens, AC-172)
 *   fetchUnreadNotificationCount()
 *       — count of unread notifications for the bell icon badge (AC-173)
 *   fetchNotificationPreference()
 *       — load the user's beta_video_like preference (AC-057)
 *   updateNotificationPreference(betaVideoLike)
 *       — update the beta_video_like toggle (AC-057)
 *   fetchRouteForBetaVideo(betaVideoId)
 *       — (legacy) resolve a beta video's route and gym context; superseded by
 *       Rev 32 which resolves actor_user_id directly from the Notification row
 *
 * Rules:
 * - Uses the shared Supabase singleton from src/lib/supabase.ts.
 * - Never calls createClient() directly.
 * - Never sends user_id as a parameter to RPCs — always derived server-side
 *   from auth.uid().
 * - The push fan-out is NEVER triggered from client code — it is triggered by
 *   the Postgres trigger on reactions INSERT (hard architectural requirement).
 */

import { supabase } from '../../lib/supabase';
import type { Notification, NotificationPreference } from './types';

// ── Device Token Registration (AC-054) ────────────────────────────────────────

/**
 * Register (upsert) an iOS device token for the current user.
 *
 * Called on every successful sign-in. The upsert updates `last_seen_at` on
 * each call and sets `is_active = true`, re-activating a previously invalidated
 * token. The unique constraint on (user_id, device_token) prevents duplicates.
 *
 * AC-054: device token registered on first successful sign-in; deduplicated.
 *
 * @param deviceToken     Raw iOS APNs device token string.
 * @param expoPushToken   Expo Push Token (nullable; populated after Expo SDK registers).
 * @throws {Error}        with a user-facing message on failure.
 */
export async function registerDeviceToken(
  deviceToken: string,
  expoPushToken?: string,
): Promise<void> {
  const { error } = await supabase.rpc('upsert_device_token', {
    p_device_token: deviceToken,
    p_expo_push_token: expoPushToken ?? null,
  });

  if (error) {
    console.error('[registerDeviceToken] error:', error);
    throw new Error('Failed to register device token. Please try again.');
  }
}

// ── Notification Inbox (AC-055, AC-058) ───────────────────────────────────────

/**
 * Fetch the in-app notification inbox for the current user.
 *
 * Returns Notification rows for the current user, most-recent first.
 * Joins actor display_name and avatar_url for rendering.
 *
 * Phase 1: only type = 'beta_video_like' rows.
 *
 * @param limit   Number of notifications to fetch (default 50).
 * @returns       Array of Notification rows, most-recent first.
 * @throws {Error} with a user-facing message on failure.
 */
export async function fetchNotifications(limit: number = 50): Promise<Notification[]> {
  // Step 1: Fetch notification rows (RLS scopes to recipient = current user).
  // Using a simple select without an embedded join avoids PostgREST FK-hint
  // schema-cache issues that can arise when there are multiple FK references
  // from notifications to the same users table.
  const { data, error } = await supabase
    .from('notifications')
    .select('id, recipient_user_id, actor_user_id, type, target_type, target_id, is_read, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[fetchNotifications] error:', error);
    throw new Error('Failed to load notifications. Please try again.');
  }

  if (!data || data.length === 0) return [];

  // Step 2: Batch-fetch actor profiles for all unique actor_user_ids.
  // This replaces the embedded PostgREST join, guaranteeing correct results
  // regardless of PostgREST schema cache state.
  const actorIds = [...new Set(data.map((row) => row.actor_user_id as string))];

  type ActorRow = { id: string; display_name: string; avatar_url: string | null };
  let actorMap: Record<string, ActorRow> = {};

  if (actorIds.length > 0) {
    const { data: actorData, error: actorError } = await supabase
      .from('users')
      .select('id, display_name, avatar_url')
      .in('id', actorIds);

    if (actorError) {
      // Non-fatal: actor info is display-only. Log and continue with empty names.
      console.error('[fetchNotifications] actor fetch error:', actorError);
    } else if (actorData) {
      actorMap = Object.fromEntries(
        (actorData as ActorRow[]).map((u) => [u.id, u]),
      );
    }
  }

  // Step 3: Merge notification rows with actor profile data.
  const results: Notification[] = [];
  for (const rawRow of data) {
    const row = rawRow as unknown as {
      id: string;
      recipient_user_id: string;
      actor_user_id: string;
      type: string;
      target_type: string;
      target_id: string;
      is_read: boolean;
      created_at: string;
    };

    const actor = actorMap[row.actor_user_id];
    results.push({
      id: row.id,
      recipient_user_id: row.recipient_user_id,
      actor_user_id: row.actor_user_id,
      actor_display_name: actor?.display_name,
      actor_avatar_url: actor?.avatar_url ?? null,
      type: row.type as 'beta_video_like',
      target_type: row.target_type,
      target_id: row.target_id,
      is_read: row.is_read,
      created_at: row.created_at,
    });
  }

  return results;
}

/**
 * Mark all unread notifications for the current user as read.
 *
 * Called when the user opens the notification inbox. Uses the
 * `mark_notifications_read` SECURITY DEFINER RPC so user_id is always
 * derived from auth.uid() server-side.
 *
 * @throws {Error} with a user-facing message on failure.
 */
export async function markNotificationsRead(): Promise<void> {
  const { error } = await supabase.rpc('mark_notifications_read');

  if (error) {
    console.error('[markNotificationsRead] error:', error);
    throw new Error('Failed to mark notifications as read. Please try again.');
  }
}

// ── Unread notification count (AC-173) ────────────────────────────────────────

/**
 * Count the current user's unread notifications for the bell icon badge.
 *
 * Returns the number of Notification rows where recipient_user_id = current user
 * and is_read = false. RLS ensures only own rows are counted.
 *
 * Returns 0 on any error (badge is non-critical — failure is silent).
 *
 * AC-173: the badge value equals this count; it clears to 0 after the batch
 * mark-read fires on inbox mount (AC-172).
 */
export async function fetchUnreadNotificationCount(): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('is_read', false);

  if (error) {
    console.error('[fetchUnreadNotificationCount] error:', error);
    return 0;
  }

  return count ?? 0;
}

// ── Route Resolution for Tap-Through (AC-058) ─────────────────────────────────

/**
 * Fetch the route_id and gym_id for a given beta video id.
 * Used by the notification inbox tap handler (AC-058).
 *
 * Resolves Notification.target_id (BetaVideo.id) → route_id + gym_id so the
 * caller can invoke AppShell.handleNavigateToRoute to open the route detail
 * screen in the Gyms tab.
 *
 * @param betaVideoId  UUID of the BetaVideo that was liked (Notification.target_id).
 * @returns            { routeId, gymId } if the video exists and has a route; null otherwise.
 */
export async function fetchRouteForBetaVideo(
  betaVideoId: string,
): Promise<{ routeId: string; gymId: string } | null> {
  const { data, error } = await supabase
    .from('beta_videos')
    .select('route_id, routes(gym_id)')
    .eq('id', betaVideoId)
    .single();

  if (error || !data) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = data as any;
  const routeId = row.route_id as string | null;
  const gymId = row.routes?.gym_id as string | null;

  if (!routeId || !gymId) return null;
  return { routeId, gymId };
}

// ── Notification Preferences (AC-057) ────────────────────────────────────────

/**
 * Fetch the notification preference row for the current user.
 *
 * Returns the preference row, or null if no row exists yet (in which case
 * the caller should treat beta_video_like as the default value: true).
 *
 * @returns NotificationPreference or null if not yet set.
 * @throws {Error} with a user-facing message on failure.
 */
export async function fetchNotificationPreference(): Promise<NotificationPreference | null> {
  const { data, error } = await supabase
    .from('notification_preferences')
    .select('user_id, beta_video_like, updated_at')
    .maybeSingle();

  if (error) {
    console.error('[fetchNotificationPreference] error:', error);
    throw new Error('Failed to load notification preferences. Please try again.');
  }

  if (!data) return null;

  return {
    user_id: data.user_id as string,
    beta_video_like: data.beta_video_like as boolean,
    updated_at: data.updated_at as string,
  };
}

/**
 * Update the beta_video_like push preference for the current user.
 *
 * Uses the `upsert_notification_preference` SECURITY DEFINER RPC.
 * When set to false: the in-app Notification row is still created by the
 * Edge Function, but no APNs push is enqueued (AC-057).
 *
 * @param betaVideoLike  New toggle value (true = push enabled, false = push off).
 * @throws {Error}       with a user-facing message on failure.
 */
export async function updateNotificationPreference(betaVideoLike: boolean): Promise<void> {
  const { error } = await supabase.rpc('upsert_notification_preference', {
    p_beta_video_like: betaVideoLike,
  });

  if (error) {
    console.error('[updateNotificationPreference] error:', error);
    throw new Error('Failed to update notification preferences. Please try again.');
  }
}
