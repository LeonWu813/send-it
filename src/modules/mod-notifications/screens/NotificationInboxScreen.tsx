/**
 * NotificationInboxScreen — In-app notification inbox (MOD-007).
 *
 * AC-055: displays Notification rows for the current user (beta-video-like only
 *          in Phase 1), most-recent first.
 * AC-057: shows the notification even when push is disabled (Notification row
 *          is always inserted; push is the optional layer on top).
 * AC-058 (Rev 32): tapping a beta-video-like notification navigates to the
 *          actor's UserProfileScreen (MOD-006). The actor_user_id is resolved
 *          directly from the Notification row — no additional query needed.
 *          onNavigateToUser(actor_user_id) is called; AppShell opens the profile
 *          overlay. This supersedes the prior route-detail tap-through.
 * AC-172: on mount, all unread Notification rows for the current user are set
 *          to is_read = true in a single batch update via mark_notifications_read.
 *
 * Uses plain useEffect for data loading (conditionally-mounted screen, no
 * NavigationContainer ancestor — do not use useFocusEffect or any
 * @react-navigation/native hook).
 *
 * Safe area: useSafeAreaInsets() + makeStyles(theme, topInset) pattern.
 * i18n: all user-facing strings use useTranslation('common') hook.
 */

import { Ionicons } from '@expo/vector-icons';
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
import { useUnreadCountContext } from '../UnreadCountProvider';
import type { Notification } from '../types';

// ── Types ─────────────────────────────────────────────────────────────────────

interface NotificationInboxScreenProps {
  session: Session;
  isActive?: boolean;
  /**
   * Callback invoked when the user taps the back button in the inbox header.
   * Returns the caller (e.g. ProfileNavigator) to its previous view.
   */
  onBack?: () => void;
  /**
   * Callback invoked when the user taps a beta-video-like notification entry.
   * Receives the actor's user_id (resolved directly from Notification.actor_user_id —
   * no additional query needed). Delegates to AppShell which opens MOD-006's
   * UserProfileScreen overlay for the actor (AC-058, Rev 32).
   */
  onNavigateToUser?: (userId: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function NotificationInboxScreen({
  session: _session,
  isActive = true,
  onBack,
  onNavigateToUser,
}: NotificationInboxScreenProps): React.JSX.Element {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme, insets.top);

  // AC-173 (Rev 35): refresh the unread count after batch mark-read so the
  // bell badge in MOD-012's global header clears when the inbox is opened.
  // useUnreadCountContext() requires UnreadCountProvider in the tree (mounted by
  // MOD-012's AppShell). If the provider is not yet mounted (e.g. in tests that
  // render NotificationInboxScreen in isolation), a fallback no-op is used via
  // the try/catch at call time — see test-utils.tsx for the mock provider.
  const { refresh: refreshUnreadCount } = useUnreadCountContext();

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
      // AC-172: mark all as read in a single batch update when inbox opens.
      await markNotificationsRead();
      // AC-173 (Rev 35): refresh the unread count so the global header badge
      // clears immediately after the batch mark-read completes.
      refreshUnreadCount();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t('notifications.errors.loadFailed');
      setError(message);
    }
  }, [t, refreshUnreadCount]);

  useEffect(() => {
    if (!isActive) return;
    setLoading(true);
    void loadNotifications().finally(() => setLoading(false));
  }, [isActive, loadNotifications]);

  const handleRefresh = useCallback(async (): Promise<void> => {
    setRefreshing(true);
    await loadNotifications().finally(() => setRefreshing(false));
  }, [loadNotifications]);

  // ── Tap-through handler (AC-058, Rev 32) ────────────────────────────────────

  /**
   * Handle tap on a notification row.
   *
   * For beta_video_like notifications: navigate to the actor's UserProfileScreen
   * (MOD-006) by calling onNavigateToUser with the notification's actor_user_id.
   * The actor_user_id is already present on the Notification row — no additional
   * query to MOD-003 or MOD-005 is required (AC-058, Rev 32).
   *
   * AppShell receives the userId and opens the UserProfileScreen overlay, subject
   * to the actor's privacy setting (AC-063).
   */
  const handleNotificationPress = useCallback(
    (notification: Notification): void => {
      if (notification.type === 'beta_video_like' && notification.actor_user_id) {
        onNavigateToUser?.(notification.actor_user_id);
      }
    },
    [onNavigateToUser],
  );

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* Navigation bar with back button */}
      {onBack !== undefined && (
        <View style={styles.navBar}>
          <Pressable
            style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel={t('common.back') ?? 'Back'}
          >
            <Ionicons name="chevron-back" size={20} color={theme.colors.primary} />
            <Text style={styles.backButtonText}>{t('common.back') ?? 'Back'}</Text>
          </Pressable>
          <Text style={styles.navTitle}>{t('notifications.title')}</Text>
          <View style={styles.navSpacer} />
        </View>
      )}

    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={
        onBack !== undefined ? styles.contentContainerWithNav : styles.contentContainer
      }
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void handleRefresh()}
          tintColor={theme.colors.primary}
        />
      }
    >
      {/* Screen title — only shown when there is no nav bar (standalone mount) */}
      {onBack === undefined && (
        <Text style={styles.screenTitle}>{t('notifications.title')}</Text>
      )}

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
        <NotificationRow
          key={item.id}
          item={item}
          styles={styles}
          theme={theme}
          t={t}
          onPress={handleNotificationPress}
        />
      ))}
    </ScrollView>
    </View>
  );
}

// ── NotificationRow ───────────────────────────────────────────────────────────

/**
 * Renders one notification inbox entry.
 *
 * AC-058 (Rev 32): tapping a beta_video_like entry navigates to the actor's
 * UserProfileScreen via onPress(notification). The actor_user_id is read
 * directly from the Notification row — no additional query required.
 */
interface NotificationRowProps {
  item: Notification;
  styles: ReturnType<typeof makeStyles>;
  theme: ReturnType<typeof useTheme>['theme'];
  t: (key: string) => string;
  onPress: (notification: Notification) => void;
}

function NotificationRow({
  item,
  styles,
  theme,
  t,
  onPress,
}: NotificationRowProps): React.JSX.Element {
  const actorName = item.actor_display_name ?? t('notifications.unknownActor');

  return (
    <Pressable
      style={[styles.notificationRow, !item.is_read && styles.notificationRowUnread]}
      onPress={() => onPress(item)}
      accessibilityRole="button"
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
    </Pressable>
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
    navBar: {
      paddingTop: topInset + theme.spacing.md,
      paddingBottom: theme.spacing.md,
      paddingHorizontal: theme.spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      backgroundColor: theme.colors.background,
    },
    backButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      paddingVertical: theme.spacing.xs,
      paddingHorizontal: theme.spacing.xs,
      borderRadius: theme.borderRadius.md,
      minWidth: 60,
    },
    backButtonPressed: {
      backgroundColor: theme.colors.surface,
    },
    backButtonText: {
      fontSize: theme.fontSize.md,
      color: theme.colors.primary,
      fontWeight: theme.fontWeight.medium,
    },
    navTitle: {
      flex: 1,
      textAlign: 'center',
      fontSize: theme.fontSize.lg,
      fontWeight: theme.fontWeight.semibold,
      color: theme.colors.textPrimary,
    },
    navSpacer: {
      minWidth: 60,
    },
    scrollView: {
      flex: 1,
    },
    contentContainer: {
      paddingTop: topInset + theme.spacing.md,
      paddingBottom: theme.spacing.xxl,
    },
    contentContainerWithNav: {
      paddingTop: theme.spacing.md,
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
