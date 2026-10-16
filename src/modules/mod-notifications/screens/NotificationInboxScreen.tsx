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
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import SwipeBackWrapper from '../../../components/SwipeBackWrapper';
import {
  AppText,
  Avatar,
  EmptyState,
  IconButton,
  InlineError,
  PressableScale,
  Skeleton,
  SkeletonGroup,
  useSkeletonPhase,
} from '../../../components/ui';
import { ICON } from '../../../lib/icons';
import { CONTINUOUS, useLayout, useTheme } from '../../../lib/theme';
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
  const { screenMargin } = useLayout();
  const styles = makeStyles(theme, insets.top, screenMargin);

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
  const skeletonPhase = useSkeletonPhase(loading);

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
      <View style={styles.root}>
        {skeletonPhase !== 'idle' && (
          <SkeletonGroup label={t('notifications.title')} style={styles.skeletonList}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i}>
                <View style={styles.skeletonRow}>
                  <Skeleton shape="circle" width={theme.avatarSize.md} height={theme.avatarSize.md} />
                  <View style={styles.body}>
                    <Skeleton shape="text" textVariant="subhead" width="80%" />
                    <Skeleton shape="text" textVariant="caption1" width="30%" />
                  </View>
                </View>
                {i < 3 && <View style={styles.divider} />}
              </View>
            ))}
          </SkeletonGroup>
        )}
      </View>
    );
  }

  return (
    <SwipeBackWrapper onBack={onBack ?? (() => {})} enabled={onBack !== undefined}>
      <View style={styles.root}>
        {/* Navigation bar with back button */}
        {onBack !== undefined && (
          <View style={styles.navBar}>
            <View style={styles.navSide}>
              <IconButton
                name={ICON.back.outline}
                size={theme.iconSize.lg}
                color="textPrimary"
                on="background"
                accessibilityLabel={t('common.back') ?? 'Back'}
                onPress={onBack}
              />
            </View>
            <AppText variant="headline" align="center" numberOfLines={1} style={styles.navTitle}>
              {t('notifications.title')}
            </AppText>
            <View style={styles.navSide} />
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
            <AppText variant="title1" accessibilityRole="header" style={styles.screenTitle}>
              {t('notifications.title')}
            </AppText>
          )}

          {/* Error block */}
          {error !== null && (
            <InlineError
              variant="block"
              message={error}
              actionLabel={t('common.retry')}
              onAction={() => void handleRefresh()}
              style={styles.errorBlock}
            />
          )}

          {/* Empty state */}
          {error === null && notifications.length === 0 && (
            <View style={styles.emptyCard}>
              <EmptyState variant="inline" title={t('notifications.empty')} />
            </View>
          )}

          {/* Notification list: rows sit on a surface container, never on the sand page */}
          {notifications.length > 0 && (
            <View style={styles.list}>
              {notifications.map((item, index) => (
                <NotificationRow
                  key={item.id}
                  item={item}
                  styles={styles}
                  theme={theme}
                  t={t}
                  divider={index < notifications.length - 1}
                  onPress={handleNotificationPress}
                />
              ))}
            </View>
          )}
        </ScrollView>
      </View>
    </SwipeBackWrapper>
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
  divider: boolean;
  onPress: (notification: Notification) => void;
}

function NotificationRow({
  item,
  styles,
  theme,
  t,
  divider,
  onPress,
}: NotificationRowProps): React.JSX.Element {
  const actorName = item.actor_display_name ?? t('notifications.unknownActor');

  return (
    <View>
      <PressableScale
        feedback="row"
        inScroll
        pressedColor={theme.colors.surfacePressed}
        style={styles.notificationRow}
        onPress={() => onPress(item)}
        accessibilityRole="button"
        accessibilityLabel={t('notifications.betaVideoLikeA11y')}
      >
        {/* Unread indicator dot: 8x8 error (spec 15.9 / COMPONENT_SIZE.unreadDot) */}
        {!item.is_read && <View style={styles.unreadDot} />}

        {/* Actor avatar */}
        <View style={styles.avatarContainer}>
          <Avatar size="md" uri={item.actor_avatar_url} name={actorName} decorative />
        </View>

        {/* Notification body */}
        <View style={styles.body}>
          <AppText variant="subhead">
            <AppText variant="subhead" weight="600">{actorName}</AppText>
            {' '}
            <AppText variant="subhead">{t('notifications.betaVideoLikedBody')}</AppText>
          </AppText>
          <AppText variant="caption1" color="textSecondary" style={styles.timestamp}>
            {formatDate(item.created_at)}
          </AppText>
        </View>

        {/* Type marker: like glyph + text (no emoji / text symbol) */}
        <View style={styles.typeBadge}>
          <Ionicons
            name={ICON.like.filled}
            size={theme.iconSize.sm}
            color={theme.colors.textSecondary}
          />
          <AppText variant="caption1" color="textSecondary">
            {t('notifications.badgeBetaVideoLike')}
          </AppText>
        </View>
      </PressableScale>
      {divider && <View style={styles.divider} />}
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

function makeStyles(
  theme: ReturnType<typeof useTheme>['theme'],
  topInset: number,
  screenMargin: number,
) {
  const avatarWidth = theme.avatarSize.md;
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    navBar: {
      paddingTop: topInset,
      paddingHorizontal: screenMargin - theme.spacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth: theme.stroke.hairline,
      borderBottomColor: theme.colors.border,
      backgroundColor: theme.colors.background,
    },
    navSide: {
      width: theme.layout.minTouchTarget,
      minHeight: theme.layout.minTouchTarget,
      justifyContent: 'center',
    },
    navTitle: {
      flex: 1,
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
    screenTitle: {
      paddingHorizontal: screenMargin,
      marginBottom: theme.spacing.md,
    },
    errorBlock: {
      marginHorizontal: screenMargin,
      marginBottom: theme.spacing.md,
    },
    // Grouped list container: surface, RADIUS.card, clipped (spec 25 / v2.2 ListRow)
    list: {
      backgroundColor: theme.colors.surface,
      marginHorizontal: screenMargin,
      borderRadius: theme.radius.card,
      ...CONTINUOUS,
      overflow: 'hidden',
    },
    emptyCard: {
      backgroundColor: theme.colors.surface,
      marginHorizontal: screenMargin,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.radius.card,
      ...CONTINUOUS,
      overflow: 'hidden',
    },
    skeletonList: {
      backgroundColor: theme.colors.surface,
      marginHorizontal: screenMargin,
      marginTop: theme.spacing.md,
      borderRadius: theme.radius.card,
      ...CONTINUOUS,
      overflow: 'hidden',
    },
    skeletonRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.smd,
      minHeight: theme.layout.listRowMinHeight,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.layout.listRowPaddingV,
    },
    notificationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: theme.layout.listRowMinHeight,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.layout.listRowPaddingV,
    },
    divider: {
      height: theme.stroke.hairline,
      marginLeft: theme.spacing.md + avatarWidth + theme.spacing.smd,
      backgroundColor: theme.colors.divider,
    },
    unreadDot: {
      position: 'absolute',
      left: theme.spacing.xs,
      top: '50%',
      marginTop: -theme.componentSize.unreadDot / 2,
      width: theme.componentSize.unreadDot,
      height: theme.componentSize.unreadDot,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.error,
    },
    avatarContainer: {
      marginRight: theme.spacing.smd,
    },
    body: {
      flex: 1,
      gap: theme.spacing.xxs,
    },
    timestamp: {
      marginTop: theme.layout.stackTight,
    },
    typeBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.layout.iconTextGap,
      marginLeft: theme.spacing.sm,
    },
  });
}
