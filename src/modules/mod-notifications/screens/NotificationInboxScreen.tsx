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
  FistBumpIcon,
  InlineError,
  PageLoading,
  PressableScale,
  useLoadingPhase,
} from '../../../components/ui';
import { ICON } from '../../../lib/icons';
import { CONTINUOUS, ICON_SIZE, useLayout, useTheme } from '../../../lib/theme';
import { useAppHeader } from '@/lib/AppHeaderContext';
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

/** L-1 (page-review): fixed two-line row height. */
const INBOX_ROW_HEIGHT = 72;

// ── Component ─────────────────────────────────────────────────────────────────

export default function NotificationInboxScreen({
  session: _session,
  isActive = true,
  onBack,
  onNavigateToUser,
}: NotificationInboxScreenProps): React.JSX.Element {
  const { t, i18n } = useTranslation('common');
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
  // v2.2: the AppShell overlay scope renders the nested header (back + title); no-op outside AppShell.
  useAppHeader({ title: t('notifications.title'), onBack });

  const { refresh: refreshUnreadCount } = useUnreadCountContext();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadingPhase = useLoadingPhase(loading);

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

  // Full-page loading: PageLoading after 300ms; after 10s E4 replaces it (a late success swaps back to content).
  if (loading) {
    if (loadingPhase === 'loading') return <PageLoading />;
    if (loadingPhase === 'timeout') {
      return (
        <View style={styles.root}>
          <EmptyState
            variant="error"
            title={t('notifications.loadErrorTitle')}
            description={t('notifications.loadErrorDescription')}
            primaryLabel={t('common.retry')}
            onPrimary={() => void handleRefresh()}
          />
        </View>
      );
    }
    return <View style={styles.root} />;
  }

  // Whole-page failure (nothing to show): E4. With rows on screen a failed refresh keeps the block notice below.
  if (error !== null && notifications.length === 0) {
    return (
      <View style={styles.root}>
        <EmptyState
          variant="error"
          title={t('notifications.loadErrorTitle')}
          description={t('notifications.loadErrorDescription')}
          primaryLabel={t('common.retry')}
          onPrimary={() => void handleRefresh()}
        />
      </View>
    );
  }

  return (
    <SwipeBackWrapper onBack={onBack ?? (() => {})} enabled={onBack !== undefined}>
      <View style={styles.root}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={
            onBack !== undefined ? styles.contentContainerNested : styles.contentContainer
          }
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void handleRefresh()}
              tintColor={theme.colors.textSecondary}
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
            <EmptyState
              variant="page"
              icon={ICON.notifications.outline}
              title={t('notifications.emptyTitle')}
              description={t('notifications.emptyDescription')}
            />
          )}

          {/* L-1: grouped 今天 / 本週 / 更早; each group is a surface card, never on the sand page */}
          {groupNotifications(notifications, new Date()).map((group) => (
            <View key={group.key}>
              <AppText variant="groupHeader" accessibilityRole="header" style={styles.sectionHeader}>
                {t(`notifications.section.${group.key}`)}
              </AppText>
              <View style={styles.list}>
                {group.items.map((item, index) => (
                  <NotificationRow
                    key={item.id}
                    item={item}
                    styles={styles}
                    theme={theme}
                    t={t}
                    language={i18n.language}
                    divider={index < group.items.length - 1}
                    onPress={handleNotificationPress}
                  />
                ))}
              </View>
            </View>
          ))}
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
  t: (key: string, opts?: Record<string, unknown>) => string;
  language: string;
  divider: boolean;
  onPress: (notification: Notification) => void;
}

function NotificationRow({
  item,
  styles,
  theme,
  t,
  language,
  divider,
  onPress,
}: NotificationRowProps): React.JSX.Element {
  const actorName = item.actor_display_name ?? t('notifications.unknownActor');
  const date = formatDate(item.created_at, language);
  const routeLabel =
    item.route_grade && item.route_color
      ? `${item.route_grade} ${t(`routeCatalog.colors.${item.route_color}`)}`
      : null;
  const contextLine = routeLabel ? `${routeLabel} · ${date}` : date;

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
        {/* Actor avatar */}
        <View style={styles.avatarContainer}>
          <Avatar size="md" uri={item.actor_avatar_url} name={actorName} decorative />
        </View>

        {/* Notification body: line 1 sentence, line 2 object context (L-1) */}
        <View style={styles.body}>
          <AppText variant="subhead" numberOfLines={1}>
            <AppText variant="subhead" weight="600">{actorName}</AppText>
            {' '}
            <AppText variant="subhead">{t('notifications.betaVideoLikedBody')}</AppText>
          </AppText>
          <AppText variant="footnote" color="textSecondary" numberOfLines={1}>
            {contextLine}
          </AppText>
        </View>

        {/* Type marker: custom fist-bump glyph, no chip text (L-1) */}
        <View style={styles.typeBadge}>
          <FistBumpIcon variant="outline" size={ICON_SIZE.sm} color={theme.colors.textSecondary} />
        </View>

        {/* Unread dot: trailing, centred, right edge on R16 (audit C1/C4). The slot is
            always reserved so the like icons stay aligned across read/unread rows. */}
        <View style={styles.unreadSlot}>
          {!item.is_read && <View testID="unread-dot" style={styles.unreadDot} />}
        </View>
      </PressableScale>
      {divider && <View style={styles.divider} />}
    </View>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Format an ISO timestamp as a short readable date, e.g. 10月20日 / Oct 20. */
function formatDate(iso: string, language?: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(language, { month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

type SectionKey = 'today' | 'thisWeek' | 'earlier';

/** L-1: bucket most-recent-first notifications into today / last 7 days / earlier. */
export function groupNotifications(
  items: Notification[],
  now: Date,
): { key: SectionKey; items: Notification[] }[] {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const weekAgo = startOfToday - 6 * 24 * 60 * 60 * 1000;
  const buckets: Record<SectionKey, Notification[]> = { today: [], thisWeek: [], earlier: [] };
  for (const item of items) {
    const ts = new Date(item.created_at).getTime();
    if (ts >= startOfToday) buckets.today.push(item);
    else if (ts >= weekAgo) buckets.thisWeek.push(item);
    else buckets.earlier.push(item);
  }
  return (['today', 'thisWeek', 'earlier'] as const)
    .filter((key) => buckets[key].length > 0)
    .map((key) => ({ key, items: buckets[key] }));
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
    scrollView: {
      flex: 1,
    },
    contentContainer: {
      paddingTop: topInset + theme.spacing.md,
      paddingBottom: theme.spacing.xxl,
    },
    // R0: the section header carries the top gap, so no extra padding here
    contentContainerNested: {
      paddingBottom: theme.spacing.xxl,
    },
    screenTitle: {
      paddingHorizontal: screenMargin,
      marginBottom: theme.spacing.md,
    },
    errorBlock: {
      marginTop: theme.spacing.md,
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
    // L-1: fixed 72pt two-line row (Avatar md 48)
    notificationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      height: INBOX_ROW_HEIGHT,
      paddingHorizontal: theme.spacing.md,
    },
    sectionHeader: {
      paddingHorizontal: screenMargin,
      paddingTop: theme.spacing.md,
      paddingBottom: theme.spacing.sm,
    },
    divider: {
      height: theme.stroke.hairline,
      marginLeft: theme.spacing.md + avatarWidth + theme.spacing.smd,
      backgroundColor: theme.colors.divider,
    },
    unreadSlot: {
      width: theme.componentSize.unreadDot,
      height: theme.componentSize.unreadDot,
      marginLeft: theme.spacing.smd,
    },
    unreadDot: {
      width: theme.componentSize.unreadDot,
      height: theme.componentSize.unreadDot,
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors.error,
    },
    avatarContainer: {
      marginRight: theme.spacing.smd,
    },
    body: {
      flex: 1,
      gap: theme.spacing.xxs,
    },
    typeBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.layout.iconTextGap,
      marginLeft: theme.spacing.sm,
    },
  });
}
