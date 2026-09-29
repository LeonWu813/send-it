/**
 * ProfileHistoryScreen — send history + stats for a user profile.
 *
 * AC-060: filterable send history (gym, grade, date range).
 * AC-061: stats panel (total sends, sends-by-grade bar chart, streak, highest grade).
 * AC-062: stats recalculate immediately after a new send is logged (via
 *          refetchKey prop — parent bumps it when MOD-004 logs a new ascent).
 * AC-064: followers_only privacy gate (server-side via RPC; client shows
 *          hidden state when RPC returns zero rows due to privacy).
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
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../../lib/theme';
import AscentHistoryItem from '../components/AscentHistoryItem';
import FilterBar from '../components/FilterBar';
import StatsPanel from '../components/StatsPanel';
import {
  fetchHistoryGyms,
  fetchProfileHistory,
  fetchProfileStats,
} from '../history-service';
import type { GymSummary } from '../history-service';
import type { HistoryAscent, HistoryFilters, HistoryVisibility, ProfileStats } from '../types';
import { EMPTY_FILTERS } from '../types';

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
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ProfileHistoryScreen({
  userId,
  isOwnProfile,
  refetchKey = 0,
}: ProfileHistoryScreenProps): React.JSX.Element {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme, insets.top);

  // ── State ──────────────────────────────────────────────────────────────────

  const [filters, setFilters] = useState<HistoryFilters>(EMPTY_FILTERS);
  const [history, setHistory] = useState<HistoryAscent[]>([]);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [gyms, setGyms] = useState<GymSummary[]>([]);
  const [visibility, setVisibility] = useState<HistoryVisibility>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ── Data fetch ─────────────────────────────────────────────────────────────

  const loadData = useCallback(async (): Promise<void> => {
    setVisibility('loading');
    setErrorMessage(null);

    try {
      const [historyData, statsData, gymsData] = await Promise.all([
        fetchProfileHistory(userId, filters),
        fetchProfileStats(userId),
        fetchHistoryGyms(userId),
      ]);

      setHistory(historyData);
      setStats(statsData);
      setGyms(gymsData);

      // Determine visibility: if privacy blocked, the RPC returns zeros.
      // We detect this by checking: non-own profile + zero total sends + empty history.
      // The server enforces privacy — if access is denied, RPC returns zero rows.
      // A non-follower of a followers_only profile cannot be distinguished from a
      // profile with genuinely zero sends by the row count alone; we treat this
      // case as hidden so the client renders the privacy banner rather than an
      // empty list (AC-064). Own-profile views never hit this branch.
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
  }, [userId, filters, isOwnProfile, t]);

  // Refetch on mount, filter change, or when parent bumps refetchKey (AC-062).
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

  // ── List header (stats panel + filter bar) ─────────────────────────────────

  const ListHeader = (
    <View>
      {stats !== null && <StatsPanel stats={stats} />}
      <FilterBar
        filters={filters}
        gyms={gyms}
        onFiltersChange={(updated) => setFilters(updated)}
      />
      <Text style={styles.sectionTitle}>
        {t('profile.sendHistory')}
      </Text>
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
      data={history}
      keyExtractor={(item) => item.ascent_id}
      renderItem={({ item }) => <AscentHistoryItem item={item} />}
      ListHeaderComponent={ListHeader}
      ListEmptyComponent={ListEmpty}
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
