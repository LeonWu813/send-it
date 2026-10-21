/**
 * mod-notifications public barrel (MOD-007).
 *
 * Re-exports the public API surface consumed by other modules.
 * Internal implementation files (screens/, test-utils.tsx) are not re-exported.
 *
 * Consumers should import from this barrel, not from private sub-paths:
 *   import NotificationsNavigator from 'src/modules/mod-notifications';
 *   import { UnreadCountProvider, useUnreadCount } from 'src/modules/mod-notifications';
 *   import { registerDeviceToken } from 'src/modules/mod-notifications';
 */

// ── Navigator entry point ─────────────────────────────────────────────────────
export { default as NotificationsNavigator } from './NotificationsNavigator';
export type { NotificationsView } from './NotificationsNavigator';

// ── UnreadCount context (AC-173) ──────────────────────────────────────────────
export { UnreadCountProvider, useUnreadCount, useUnreadCountContext } from './UnreadCountProvider';

// ── Service functions ─────────────────────────────────────────────────────────
export {
  registerDeviceToken,
  fetchNotifications,
  markNotificationsRead,
  fetchUnreadNotificationCount,
  fetchNotificationPreference,
  updateNotificationPreference,
} from './notification-service';

// ── Types ─────────────────────────────────────────────────────────────────────
export type {
  Notification,
  NotificationType,
  NotificationPreference,
  DeviceToken,
} from './types';
