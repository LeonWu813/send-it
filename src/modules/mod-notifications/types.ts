/**
 * Types for MOD-007: Notifications.
 *
 * Notification: an in-app inbox row for a beta-video-like event.
 * DeviceToken: a registered iOS APNs device token for a user.
 * NotificationPreference: per-user push toggle settings.
 */

/** Phase 1 notification type (only beta_video_like). */
export type NotificationType = 'beta_video_like';

/**
 * A single in-app notification inbox row.
 *
 * recipient_user_id: the video uploader who receives the notification.
 * actor_user_id:     the user who liked the video.
 * type:              always 'beta_video_like' in Phase 1.
 * target_type:       always 'beta_video' in Phase 1.
 * target_id:         UUID of the BetaVideo that was liked.
 * is_read:           true after the user opens the inbox.
 */
export interface Notification {
  id: string;
  recipient_user_id: string;
  actor_user_id: string;
  actor_display_name?: string;
  actor_avatar_url?: string | null;
  type: NotificationType;
  target_type: string;
  target_id: string;
  is_read: boolean;
  created_at: string;
}

/**
 * A registered iOS APNs device token for a user.
 *
 * Phase 1: platform = 'ios' only.
 * expo_push_token: Expo Push Token (nullable until the Expo Push SDK registers it).
 * is_active:       false after token is invalidated (e.g., app uninstalled).
 */
export interface DeviceToken {
  id: string;
  user_id: string;
  platform: 'ios';
  device_token: string;
  expo_push_token: string | null;
  is_active: boolean;
  created_at: string;
  last_seen_at: string;
}

/**
 * Per-user push notification preference.
 *
 * beta_video_like:
 *   true  → push is enqueued when a user likes the recipient's beta video.
 *   false → no push, but the in-app Notification row is still inserted (AC-057).
 *
 * The table is designed to be extended in Phase 2 with new columns for additional
 * notification types. Do not add Phase 2 columns in Phase 1.
 */
export interface NotificationPreference {
  user_id: string;
  beta_video_like: boolean;
  updated_at: string;
}
