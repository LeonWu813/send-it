/**
 * ProfileHistoryScreen — send history + stats for a user profile.
 *
 * AC-061: stats panel (v2.2: top-grade hero, sends / days tiles, sends-by-grade bars).
 *         Bars hidden when total_sends = 0; zero records -> ONE EmptyState `prompt`
 *         replaces the stats panel AND the history section (spec 32.5).
 * AC-062: stats recalculate immediately after a new send is logged (via
 *         refetchKey prop — parent bumps it when MOD-004 logs a new ascent).
 * AC-064: followers_only privacy gate (server-side via RPC; client shows
 *         hidden state when RPC returns zero rows due to privacy).
 *
 * History is grouped into route cards by route_id. Grade tabs above the list
 * allow filtering by grade. FilterBar has been removed.
 *
 * Can render for the current user (own profile) or another user (other profile
 * subject to privacy). The `isOwnProfile` flag skips privacy checks for self.
 *
 * Safe area: uses useSafeAreaInsets() + makeStyles(theme, topInset) pattern.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, ScrollView, StyleSheet, View } from 'react-native';
import type { FlatListProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import SharedRouteCard from '../../../components/RouteCard';
import { AppText, Chip, EmptyState, InlineError, Spinner } from '../../../components/ui';
import { ICON } from '../../../lib/icons';
import { useLayout, useTheme } from '../../../lib/theme';
import { useTabBarInset } from '@/lib/AppHeaderContext';
import StatsPanel from '../components/StatsPanel';
import {
  fetchProfileHistory,
  fetchProfileStats,
  groupToRouteCards,
} from '../history-service';
import type { RouteCard as RouteCardData } from '../history-service';
import type { HistoryAscent, HistoryVisibility, ProfileStats } from '../types';
import { GRADE_ORDER } from '../types';

// ── Types ─────────────────────────────────────────────────────────────────────

/** Scroll props forwarded to the list (e.g. the AppShell `useAppHeaderRoot()` binding). */
export type ForwardedScrollProps = Pick<
  FlatListProps<unknown>,
  | 'onScroll'
  | 'onContentSizeChange'
  | 'onLayout'
  | 'scrollEventThrottle'
  | 'contentContainerStyle'
  | 'scrollIndicatorInsets'
>;

interface ProfileHistoryScreenProps {
  /** UUID of the user whose history is being displayed. */
  userId: string;
  /** True when the viewer is the same as userId. */
  isOwnProfile: boolean;
  /**
   * Bump this key to force a stats + history refetch (AC-062).
   * Parent increments it after a new ascent is logged.
   */
  refetchKey?: number;
  /**
   * Optional element rendered above the stats panel inside
   * ListHeaderComponent. Allows the host screen (MOD-001 ProfileScreen) to
   * pass profile-header content so it scrolls with the FlatList instead of
   * requiring a wrapping ScrollView (which would cause a VirtualizedList
   * nesting warning).
   */
  extraListHeader?: React.ReactElement;
  /**
   * Optional element rendered as the FlatList's ListFooterComponent.
   * Allows the host screen to inject footer content (e.g. Logout button).
   */
  extraListFooter?: React.ReactElement;
  /**
   * Optional callback invoked when the user taps a route card.
   * Passes both the routeId and the gymId so the caller can navigate to the
   * route detail screen within the correct gym's route list.
   */
  onNavigateToRoute?: (routeId: string, gymId: string) => void;
  /** Primary action of the zero-records prompt ("Find routes"). Omitted -> the prompt has no button. */
  onLogSend?: () => void;
  /** True when a nested AppHeader already owns the top safe area (pushed view): no top inset padding. */
  headerHandled?: boolean;
  /** Optional pass-through scroll props. Caller padding in contentContainerStyle overrides the TabBar inset. */
  scrollProps?: ForwardedScrollProps;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ProfileHistoryScreen({
  userId,
  isOwnProfile,
  refetchKey = 0,
  extraListHeader,
  extraListFooter,
  onNavigateToRoute,
  onLogSend,
  headerHandled = false,
  scrollProps,
}: ProfileHistoryScreenProps): React.JSX.Element {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const { screenMargin } = useLayout();
  const insets = useSafeAreaInsets();
  const tabInset = useTabBarInset();
  // When extraListHeader is provided, the host element already applies the
  // top-inset padding inside its container. Pass 0 so we don't double-pad.
  const topInsetForStyles = extraListHeader !== undefined || headerHandled ? 0 : insets.top;
  const styles = makeStyles(theme, topInsetForStyles, screenMargin);

  // ── State ──────────────────────────────────────────────────────────────────

  const [activeGrade, setActiveGrade] = useState<string>('all');
  const [ascents, setAscents] = useState<HistoryAscent[]>([]);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [visibility, setVisibility] = useState<HistoryVisibility>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ── Data fetch ─────────────────────────────────────────────────────────────

  const loadData = useCallback(async (): Promise<void> => {
    setVisibility('loading');
    setErrorMessage(null);

    try {
      const [historyData, statsData] = await Promise.all([
        fetchProfileHistory(userId),
        fetchProfileStats(userId),
      ]);

      setAscents(historyData);
      setStats(statsData);

      // Determine visibility: if privacy blocked, the RPC returns zeros.
      // We detect this by checking: non-own profile + zero total sends + empty history.
      if (!isOwnProfile && statsData.total_sends === 0 && historyData.length === 0) {
        setVisibility('hidden');
      } else {
        setVisibility('visible');
      }
    } catch (err) {
      // Never surface err.message: show the translated sentence only.
      void err;
      setErrorMessage(t('profileHistory.errors.loadFailed'));
      setVisibility('error');
    }
  }, [userId, isOwnProfile, t]);

  // Refetch on mount or when parent bumps refetchKey (AC-062).
  useEffect(() => {
    void loadData();
  }, [loadData, refetchKey]);

  // ── Render helpers ─────────────────────────────────────────────────────────

  if (visibility === 'loading') {
    return (
      <View style={styles.centered}>
        <Spinner />
      </View>
    );
  }

  if (visibility === 'error') {
    return (
      <View style={styles.centered}>
        <InlineError
          variant="block"
          message={errorMessage ?? t('profileHistory.errors.loadFailed')}
          actionLabel={t('common.retry')}
          onAction={() => void loadData()}
        />
      </View>
    );
  }

  if (visibility === 'hidden') {
    return (
      <View style={styles.hiddenContainer}>
        <EmptyState
          variant="private"
          title={t('profileHistory.hiddenTitle')}
          description={t('profileHistory.hiddenBody')}
        />
      </View>
    );
  }

  // ── Grade tabs + route card data ───────────────────────────────────────────

  const routeCards: RouteCardData[] = groupToRouteCards(ascents);

  const uniqueGrades = [...new Set(routeCards.map((c) => c.grade))].sort(
    (a, b) => GRADE_ORDER.indexOf(a as typeof GRADE_ORDER[number]) - GRADE_ORDER.indexOf(b as typeof GRADE_ORDER[number]),
  );
  const tabs = ['all', ...uniqueGrades];

  const filtered: RouteCardData[] =
    activeGrade === 'all'
      ? routeCards
      : routeCards.filter((c) => c.grade === activeGrade);

  // ── Grade tab bar ──────────────────────────────────────────────────────────

  const GradeTabBar = (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.tabRow}
      contentContainerStyle={styles.tabRowContent}
    >
      {tabs.map((tab) => {
        const isActive = tab === activeGrade;
        return (
          <Chip
            key={tab}
            variant="choice"
            on="background"
            label={tab === 'all' ? t('home.projectingRoutes.allGrades') : tab}
            selected={isActive}
            onPress={() => setActiveGrade(tab)}
          />
        );
      })}
    </ScrollView>
  );

  // ── List header (optional host content + stats panel + grade tabs) ───────────

  // Zero records (not even attempts): one prompt replaces the stats AND the history section.
  const hasRecords = ascents.length > 0 || (stats?.total_sends ?? 0) > 0;

  const ListHeader = (
    <View>
      {extraListHeader ?? null}
      {stats !== null && (
        <StatsPanel stats={stats} hasRecords={hasRecords} onLogSend={onLogSend} />
      )}
      {hasRecords ? (
        <>
          <AppText variant="pageSection" style={styles.sectionTitle} accessibilityRole="header">
            {t('profile.sendHistory')}
          </AppText>
          {GradeTabBar}
        </>
      ) : null}
    </View>
  );

  const ListEmpty = (
    <View style={styles.emptyContainer}>
      <EmptyState variant="inline" description={t('profileHistory.empty')} icon={ICON.sends.outline} />
    </View>
  );

  return (
    <Animated.FlatList
      {...scrollProps}
      style={styles.root}
      contentContainerStyle={[
        styles.contentContainer,
        tabInset.contentBottom > 0 && { paddingBottom: tabInset.contentBottom },
        scrollProps?.contentContainerStyle,
      ]}
      scrollIndicatorInsets={scrollProps?.scrollIndicatorInsets ?? { bottom: tabInset.indicatorBottom }}
      data={filtered}
      keyExtractor={(item) => item.route_id}
      renderItem={({ item }) => {
        // Build the route display name per production.md Route Display Name Format:
        // "{grade} {LocalizedColor}" with section in parentheses when non-null.
        // e.g. "V3 Blue (Cave)"
        const colorLabel = item.color_tag
          ? t(`routeCatalog.colors.${item.color_tag}`)
          : '';
        const sectionSuffix = item.section_label ? ` (${item.section_label})` : '';
        const routeName = `${item.grade}${colorLabel ? ` ${colorLabel}` : ''}${sectionSuffix}`;

        return (
          <SharedRouteCard
            route={{
              id: item.route_id,
              name: routeName,
              grade: item.grade,
              photo_url: item.photo_url,
              gymName: item.gym_name,
            }}
            onPress={() => onNavigateToRoute?.(item.route_id, item.gym_id)}
          />
        );
      }}
      ItemSeparatorComponent={() => <View style={{ height: theme.layout.cardGap }} />}
      ListHeaderComponent={ListHeader}
      ListEmptyComponent={hasRecords ? ListEmpty : null}
      ListFooterComponent={extraListFooter ?? null}
      showsVerticalScrollIndicator={false}
    />
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function makeStyles(theme: ReturnType<typeof useTheme>['theme'], topInset: number, screenMargin: number) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    contentContainer: {
      paddingTop: topInset + theme.spacing.md,
      paddingBottom: theme.spacing.xxl,
      paddingHorizontal: screenMargin,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.background,
      paddingTop: topInset + theme.spacing.md,
      paddingHorizontal: screenMargin,
    },
    // R0: the list's contentContainer owns the screenMargin (16); sections never add their own.
    sectionTitle: {
      marginBottom: theme.layout.sectionHeaderGap,
    },
    tabRow: {
      flexGrow: 0,
      marginHorizontal: -screenMargin, // chips scroll edge to edge, start aligned at the margin
      marginBottom: theme.spacing.md,
    },
    tabRowContent: {
      columnGap: theme.spacing.sm,
      paddingHorizontal: screenMargin,
      paddingVertical: theme.spacing.xs,
    },
    emptyContainer: {},
    hiddenContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.background,
      paddingTop: topInset + theme.spacing.md,
      paddingHorizontal: screenMargin,
    },
  });
}
