/**
 * NotificationInboxScreen — In-app notification inbox (MOD-007).
 *
 * AC-055: displays Notification rows for the current user (beta-video-like only
 *          in Phase 1), most-recent first.
 * AC-057: shows the notification even when push is disabled (Notification row
 *          is always inserted; push is the optional layer on top).
 * AC-058: tap-through from a notification to the liked beta video is a Phase 1+
 *          code gap (requires cross-module navigation contract with MOD-003/MOD-005
 *          to resolve target_id → route_id). Tapping an entry is a no-op in Phase 1
 *          (navigation contract flagged as a blocker; see status.md).
 *
 * When the screen mounts, it marks all notifications as read.
 * Uses pull-to-refresh for manual refresh.
 *
 * Safe area: useSafeAreaInsets() + makeStyles(theme, topInset) pattern.
 * i18n: all user-facing strings use useTranslation('common') hook.
 */

import type { Session } from '@supabase/supabase-js';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../../lib/theme';
import {
  fetchNotifications,
  markNotificationsRead,
} from '../notification-service';
import type { Notification } from '../types';

// ── Types ─────────────────────────────────────────────────────────────────────

interface NotificationInboxScreenProps {
  session: Session;
  isActive?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function NotificationInboxScreen({
  session: _session,
  isActive = true,
}: NotificationInboxScreenProps): React.JSX.Element {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme, insets.top);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Load and mark-read ──────────────────────────────────────────────────────

  const loadNotifications = useCallback(async (): Promise<void> => {
    setError(null);
    try {
      const rows = await fetchNotifications();
      setNotifications(rows);
      // Mark all as read once loaded (spec: is_read updated when user opens inbox).
      await markNotificationsRead();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t('notifications.errors.loadFailed');
      setError(message);
    }
  }, [t]);

  useEffect(() => {
    if (!isActive) return;
    setLoading(true);
    void loadNotifications().finally(() => setLoading(false));
  }, [isActive, loadNotifications]);

  const handleRefresh = useCallback(async (): Promise<void> => {
    setRefreshing(true);
    await loadNotifications().finally(() => setRefreshing(false));
  }, [loadNotifications]);

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void handleRefresh()}
          tintColor={theme.colors.primary}
        />
      }
    >
      {/* Screen title */}
      <Text style={styles.screenTitle}>{t('notifications.title')}</Text>

      {/* Error banner */}
      {error !== null && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable
            onPress={() => void handleRefresh()}
            accessibilityRole="button"
            accessibilityLabel={t('common.retry')}
          >
            <Text style={styles.retryText}>{t('common.retry')}</Text>
          </Pressable>
        </View>
      )}

      {/* Empty state */}
      {error === null && notifications.length === 0 && (
        <Text style={styles.emptyText}>{t('notifications.empty')}</Text>
      )}

      {/* Notification list */}
      {notifications.map((item) => (
        <NotificationRow key={item.id} item={item} styles={styles} theme={theme} t={t} />
      ))}
    </ScrollView>
  );
}

// ── NotificationRow ───────────────────────────────────────────────────────────

/**
 * Renders one notification inbox entry.
 *
 * AC-058 tap-through note:
 *   Tapping an entry should navigate to the liked beta video on its route detail
 *   screen (resolving Notification.target_id → route_id → MOD-003 RouteDetailScreen).
 *   This navigation contract is flagged as a Phase 1 blocker — it requires cross-module
 *   navigation to MOD-003/MOD-005 (see status.md Engineering Progress). The row is
 *   rendered but tap is a no-op in Phase 1.
 */
interface NotificationRowProps {
  item: Notification;
  styles: ReturnType<typeof makeStyles>;
  theme: ReturnType<typeof useTheme>['theme'];
  t: (key: string) => string;
}

function NotificationRow({
  item,
  styles,
  theme,
  t,
}: NotificationRowProps): React.JSX.Element {
  const actorName = item.actor_display_name ?? t('notifications.unknownActor');

  return (
    <View
      style={[styles.notificationRow, !item.is_read && styles.notificationRowUnread]}
      accessibilityRole="text"
      accessibilityLabel={t('notifications.betaVideoLikeA11y')}
    >
      {/* Unread indicator dot */}
      {!item.is_read && <View style={styles.unreadDot} />}

      {/* Actor avatar */}
      <View style={styles.avatarContainer}>
        {item.actor_avatar_url ? (
          <Image
            source={{ uri: item.actor_avatar_url }}
            style={styles.avatar}
            accessibilityLabel={actorName}
          />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarInitial}>
              {actorName.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
      </View>

      {/* Notification body */}
      <View style={styles.body}>
        <Text style={styles.bodyText}>
          <Text style={styles.actorName}>{actorName}</Text>
          {' '}
          <Text>{t('notifications.betaVideoLikedBody')}</Text>
        </Text>
        <Text style={styles.timestamp}>{formatDate(item.created_at)}</Text>
      </View>

      {/* Push preference indicator (no UI control here — managed in Settings) */}
      <View
        style={[
          styles.typeBadge,
          { backgroundColor: theme.colors.primary + '20' },
        ]}
      >
        <Text style={[styles.typeBadgeText, { color: theme.colors.primary }]}>
          {t('notifications.badgeBetaVideoLike')}
        </Text>
      </View>
    </View>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Format an ISO timestamp as a short readable date (locale-agnostic). */
function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

// ── Styles ────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function makeStyles(theme: ReturnType<typeof useTheme>['theme'], topInset: number) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    contentContainer: {
      paddingTop: topInset + theme.spacing.md,
      paddingBottom: theme.spacing.xxl,
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.colors.background,
    },
    screenTitle: {
      fontSize: theme.fontSize.xl,
      fontWeight: theme.fontWeight.semibold,
      color: theme.colors.textPrimary,
      paddingHorizontal: theme.spacing.md,
      marginBottom: theme.spacing.md,
    },
    errorContainer: {
      margin: theme.spacing.md,
      padding: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      backgroundColor: theme.colors.error,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    errorText: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.textInverse,
      flex: 1,
    },
    retryText: {
      fontSize: theme.fontSize.sm,
      fontWeight: theme.fontWeight.semibold,
      color: theme.colors.textInverse,
      marginLeft: theme.spacing.sm,
    },
    emptyText: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.textSecondary,
      paddingHorizontal: theme.spacing.md,
      marginTop: theme.spacing.lg,
    },
    notificationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.divider,
      backgroundColor: theme.colors.background,
      position: 'relative',
    },
    notificationRowUnread: {
      backgroundColor: theme.colors.surface,
    },
    unreadDot: {
      position: 'absolute',
      left: theme.spacing.xs,
      top: '50%',
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.colors.primary,
    },
    avatarContainer: {
      marginRight: theme.spacing.sm,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: theme.borderRadius.full,
    },
    avatarPlaceholder: {
      backgroundColor: theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarInitial: {
      fontSize: theme.fontSize.md,
      fontWeight: theme.fontWeight.semibold,
      color: theme.colors.textSecondary,
    },
    body: {
      flex: 1,
    },
    bodyText: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.textPrimary,
      lineHeight: 20,
    },
    actorName: {
      fontWeight: theme.fontWeight.semibold,
      color: theme.colors.textPrimary,
    },
    timestamp: {
      fontSize: theme.fontSize.xs,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    typeBadge: {
      paddingHorizontal: theme.spacing.xs,
      paddingVertical: 2,
      borderRadius: theme.borderRadius.sm,
      marginLeft: theme.spacing.xs,
    },
    typeBadgeText: {
      fontSize: theme.fontSize.xs,
      fontWeight: theme.fontWeight.semibold,
    },
  });
}
