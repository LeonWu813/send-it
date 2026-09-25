/**
 * Notification service — all Supabase data access for MOD-007.
 *
 * Public API surface:
 *   registerDeviceToken(deviceToken, expoPushToken?)
 *       — upsert an iOS device token on sign-in (AC-054)
 *   fetchNotifications()
 *       — fetch the in-app inbox for the current user, most-recent first
 *   markNotificationsRead()
 *       — mark all unread notifications as read (called when inbox opens)
 *   fetchNotificationPreference()
 *       — load the user's beta_video_like preference (AC-057)
 *   updateNotificationPreference(betaVideoLike)
 *       — update the beta_video_like toggle (AC-057)
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
  const { data, error } = await supabase
    .from('notifications')
    .select(
      `
      id,
      recipient_user_id,
      actor_user_id,
      type,
      target_type,
      target_id,
      is_read,
      created_at,
      users!notifications_actor_user_id_fkey (
        display_name,
        avatar_url
      )
      `.trim(),
    )
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error('Failed to load notifications. Please try again.');
  }

  if (!data) return [];

  // Flatten the joined actor user record.
  // The Supabase client types the joined relation as a nested object; we cast through
  // unknown to extract the flat shape we need.
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
      users: { display_name: string; avatar_url: string | null } | null;
    };

    results.push({
      id: row.id,
      recipient_user_id: row.recipient_user_id,
      actor_user_id: row.actor_user_id,
      actor_display_name: row.users?.display_name,
      actor_avatar_url: row.users?.avatar_url ?? null,
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
    throw new Error('Failed to mark notifications as read. Please try again.');
  }
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
    throw new Error('Failed to update notification preferences. Please try again.');
  }
}
