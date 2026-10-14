/**
 * ProfileHistoryScreen — send history + stats for a user profile.
 *
 * AC-061: stats panel (total sends, sends-by-grade bar chart, accumulated days,
 *         highest grade). Bar chart hidden when total_sends = 0.
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
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import SharedRouteCard from '../../../components/RouteCard';
import { useTheme } from '../../../lib/theme';
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
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ProfileHistoryScreen({
  userId,
  isOwnProfile,
  refetchKey = 0,
  extraListHeader,
  extraListFooter,
  onNavigateToRoute,
}: ProfileHistoryScreenProps): React.JSX.Element {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  // When extraListHeader is provided, the host element already applies the
  // top-inset padding inside its container. Pass 0 so we don't double-pad.
  const topInsetForStyles = extraListHeader !== undefined ? 0 : insets.top;
  const styles = makeStyles(theme, topInsetForStyles);

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
      const message =
        err instanceof Error ? err.message : t('profileHistory.errors.loadFailed');
      setErrorMessage(message);
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
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (visibility === 'error') {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{errorMessage}</Text>
      </View>
    );
  }

  if (visibility === 'hidden') {
    return (
      <View style={styles.hiddenContainer}>
        <Text style={styles.hiddenTitle}>{t('profileHistory.hiddenTitle')}</Text>
        <Text style={styles.hiddenBody}>{t('profileHistory.hiddenBody')}</Text>
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
          <Pressable
            key={tab}
            style={[styles.tab, isActive && styles.tabActive]}
            onPress={() => setActiveGrade(tab)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
          >
            <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
              {/* "All" is hardcoded by design — intentional exception to i18n */}
              {tab === 'all' ? 'All' : tab}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );

  // ── List header (optional host content + stats panel + grade tabs) ───────────

  const ListHeader = (
    <View>
      {extraListHeader ?? null}
      {stats !== null && <StatsPanel stats={stats} />}
      <Text style={styles.sectionTitle}>
        {t('profile.sendHistory')}
      </Text>
      {GradeTabBar}
    </View>
  );

  const ListEmpty = (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>{t('profileHistory.empty')}</Text>
    </View>
  );

  return (
    <FlatList
      style={styles.root}
      contentContainerStyle={styles.contentContainer}
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
            hasNewBetaVideo={false}
          />
        );
      }}
      ListHeaderComponent={ListHeader}
      ListEmptyComponent={ListEmpty}
      ListFooterComponent={extraListFooter ?? null}
      showsVerticalScrollIndicator={false}
    />
  );
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
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.background,
      paddingTop: topInset + theme.spacing.md,
    },
    errorText: {
      fontSize: theme.fontSize.md,
      color: theme.colors.error,
      textAlign: 'center',
      paddingHorizontal: theme.spacing.lg,
    },
    sectionTitle: {
      fontSize: theme.fontSize.md,
      fontWeight: theme.fontWeight.semibold,
      color: theme.colors.textPrimary,
      paddingHorizontal: theme.spacing.lg,
      marginBottom: theme.spacing.sm,
    },
    tabRow: {
      flexGrow: 0,
      marginBottom: theme.spacing.md,
    },
    tabRowContent: {
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.lg,
    },
    tab: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.borderRadius.full,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    tabActive: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primary,
    },
    tabText: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.textSecondary,
    },
    tabTextActive: {
      color: theme.colors.textInverse,
      fontWeight: theme.fontWeight.medium,
    },
    emptyContainer: {
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.lg,
    },
    emptyText: {
      fontSize: theme.fontSize.md,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    hiddenContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.background,
      paddingTop: topInset + theme.spacing.md,
      paddingHorizontal: theme.spacing.xl,
    },
    hiddenTitle: {
      fontSize: theme.fontSize.lg,
      fontWeight: theme.fontWeight.semibold,
      color: theme.colors.textPrimary,
      textAlign: 'center',
      marginBottom: theme.spacing.sm,
    },
    hiddenBody: {
      fontSize: theme.fontSize.md,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
  });
}
