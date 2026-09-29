/**
 * StatsPanel — displays aggregate send stats for a profile.
 *
 * Renders:
 *   - Total sends, current streak, highest grade (summary row)
 *   - Sends-by-grade bar chart (horizontal bars, V-scale ordered)
 *
 * Props:
 *   stats — ProfileStats object from fetchProfileStats.
 *
 * Uses theme tokens only — no hardcoded colors or spacing.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../../lib/theme';
import type { ProfileStats } from '../types';

// ── Constants ──────────────────────────────────────────────────────────────────

/** Minimum bar width (px) so zero-count bars are still visible as a hairline. */
const BAR_MIN_WIDTH = 2;
/** Fixed height of each grade bar row. */
const BAR_ROW_HEIGHT = 24;
/** Maximum bar track width — the bar fills proportionally within this. */
const BAR_TRACK_WIDTH = 160;

// ── Component ─────────────────────────────────────────────────────────────────

interface StatsPanelProps {
  stats: ProfileStats;
}

export default function StatsPanel({ stats }: StatsPanelProps): React.JSX.Element {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const styles = makeStyles(theme);

  const maxCount = Math.max(...stats.sends_by_grade.map((g) => g.count), 1);

  return (
    <View style={styles.container}>
      {/* ── Summary row ──────────────────────────────────────────────────── */}
      <View style={styles.summaryRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.total_sends}</Text>
          <Text style={styles.statLabel}>{t('profileHistory.stats.totalSends')}</Text>
        </View>

        <View style={styles.statDivider} />

        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.current_streak}</Text>
          <Text style={styles.statLabel}>{t('profileHistory.stats.streak')}</Text>
        </View>

        <View style={styles.statDivider} />

        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {stats.highest_grade ?? t('profileHistory.stats.noGrade')}
          </Text>
          <Text style={styles.statLabel}>{t('profileHistory.stats.highestGrade')}</Text>
        </View>
      </View>

      {/* ── Bar chart ────────────────────────────────────────────────────── */}
      <Text style={styles.chartTitle}>{t('profileHistory.stats.chartTitle')}</Text>
      <View style={styles.chart} accessibilityLabel={t('profileHistory.stats.chartA11y')}>
        {stats.sends_by_grade.map(({ grade, count }) => {
          const barWidth = Math.max(
            BAR_MIN_WIDTH,
            Math.round((count / maxCount) * BAR_TRACK_WIDTH),
          );
          return (
            <View key={grade} style={styles.barRow}>
              <Text style={styles.gradeLabel}>{grade}</Text>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.bar,
                    { width: barWidth },
                    count === 0 && styles.barEmpty,
                  ]}
                />
              </View>
              <Text style={styles.barCount}>{count}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function makeStyles(theme: ReturnType<typeof useTheme>['theme']) {
  return StyleSheet.create({
    container: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.lg,
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'center',
      marginBottom: theme.spacing.lg,
    },
    statItem: {
      alignItems: 'center',
      flex: 1,
    },
    statValue: {
      fontSize: theme.fontSize.xxl,
      fontWeight: theme.fontWeight.bold,
      color: theme.colors.textPrimary,
    },
    statLabel: {
      fontSize: theme.fontSize.xs,
      color: theme.colors.textSecondary,
      marginTop: theme.spacing.xs,
      textAlign: 'center',
    },
    statDivider: {
      width: 1,
      height: 40,
      backgroundColor: theme.colors.border,
    },
    chartTitle: {
      fontSize: theme.fontSize.sm,
      fontWeight: theme.fontWeight.semibold,
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing.sm,
    },
    chart: {
      gap: theme.spacing.xs,
    },
    barRow: {
      flexDirection: 'row',
      alignItems: 'center',
      height: BAR_ROW_HEIGHT,
    },
    gradeLabel: {
      width: 32,
      fontSize: theme.fontSize.xs,
      color: theme.colors.textSecondary,
    },
    barTrack: {
      flex: 1,
      height: 12,
      backgroundColor: theme.colors.divider,
      borderRadius: theme.borderRadius.sm,
      overflow: 'hidden',
    },
    bar: {
      height: '100%',
      backgroundColor: theme.colors.primary,
      borderRadius: theme.borderRadius.sm,
    },
    barEmpty: {
      backgroundColor: theme.colors.border,
    },
    barCount: {
      width: 28,
      fontSize: theme.fontSize.xs,
      color: theme.colors.textSecondary,
      textAlign: 'right',
    },
  });
}
