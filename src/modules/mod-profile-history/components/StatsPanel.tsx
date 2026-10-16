/**
 * StatsPanel — displays aggregate send stats for a profile (spec §32.5).
 *
 * Renders:
 *   - Summary row: total sends, accumulated days, highest grade
 *   - Sends-by-grade bars (V0 up to the highest grade; highest = textPrimary + label,
 *     the rest = border; no track, bars are not tappable so never `primary`)
 *
 * Motion D7: bars grow scaleX 0 -> 1 once per session (low to high, stagger 30,
 * max 8 steps, highest last with `settle`). Numbers never roll.
 *
 * Tokens only: no hex, font sizes or radii.
 */

import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, StyleSheet, useWindowDimensions, View } from 'react-native';

import { AppText, EmptyState } from '../../../components/ui';
import { ICON } from '../../../lib/icons';
import { SPRING_REST, USE_NATIVE_DRIVER, bezierFor, useMotion } from '../../../lib/motion';
import { useTheme } from '../../../lib/theme';
import type { ProfileStats } from '../types';
import { GRADE_ORDER } from '../types';

// ── Constants ──────────────────────────────────────────────────────────────────

/** Bar height (spec 12). */
const BAR_HEIGHT = 12;
/** Width of the starting nub for a grade with 0 sends (spec 4). */
const BAR_ZERO_WIDTH = 4;
/** Summary column divider height (spec 1x40). */
const DIVIDER_HEIGHT = 40;
/** Max staggered bars; the 9th onward start with the 8th. */
const MAX_STAGGER = 8;
/** AX threshold: summary goes from 3 columns to 2. */
const AX_FONT_SCALE = 1.6;

/** Bars animate once per app session. */
let barsPlayed = false;

/** Test / story helper: lets the bar-grow play again. */
export function resetStatsBarAnimation(): void {
  barsPlayed = false;
}

// ── Bar ────────────────────────────────────────────────────────────────────────

interface BarProps {
  pct: number;
  highest: boolean;
  zero: boolean;
  order: number;
  play: boolean;
}

function Bar({ pct, highest, zero, order, play }: BarProps): React.JSX.Element {
  const { theme } = useTheme();
  const { duration, spring, reduceMotion } = useMotion();
  const grow = useRef(new Animated.Value(play && !reduceMotion ? 0 : 1)).current;

  useEffect(() => {
    if (!play || reduceMotion) {
      grow.setValue(1);
      return;
    }
    grow.setValue(0);
    const delay = Math.min(order, MAX_STAGGER - 1) * duration.stagger;
    const anim = highest
      ? Animated.spring(grow, { toValue: 1, ...spring.settle, ...SPRING_REST, delay, useNativeDriver: USE_NATIVE_DRIVER })
      : Animated.timing(grow, {
          toValue: 1,
          delay,
          duration: duration.long,
          easing: bezierFor('enter'),
          useNativeDriver: USE_NATIVE_DRIVER,
        });
    anim.start();
    return () => anim.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play, reduceMotion]);

  const style = zero
    ? { width: BAR_ZERO_WIDTH }
    : { width: `${Math.max(pct, 1)}%` as `${number}%` };

  return (
    <Animated.View
      style={[
        {
          height: BAR_HEIGHT,
          borderRadius: theme.borderRadius.sm,
          backgroundColor: highest ? theme.colors.textPrimary : theme.colors.border,
          transform: [{ scaleX: grow }],
          transformOrigin: 'left',
        },
        style,
      ]}
    />
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

interface StatsPanelProps {
  stats: ProfileStats;
}

export default function StatsPanel({ stats }: StatsPanelProps): React.JSX.Element {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const { fontScale } = useWindowDimensions();
  const styles = makeStyles(theme);
  const ax = fontScale >= AX_FONT_SCALE;

  // Only the first mounted panel of the session plays the bar-grow.
  const play = useRef(!barsPlayed).current;
  useEffect(() => {
    if (stats.total_sends > 0) barsPlayed = true;
  }, [stats.total_sends]);

  if (stats.total_sends === 0) {
    return (
      <View style={styles.container}>
        <EmptyState
          variant="firstUse"
          icon={ICON.sends.outline}
          title={t('profileHistory.empty')}
          description={t('profileHistory.stats.emptyBody')}
          on="surface"
          style={styles.empty}
        />
      </View>
    );
  }

  const countOf = (grade: string): number =>
    stats.sends_by_grade.find((g) => g.grade === grade)?.count ?? 0;
  // Same source as the summary: highest_grade; fall back to the top non-zero count.
  const summaryTop = GRADE_ORDER.indexOf(stats.highest_grade as (typeof GRADE_ORDER)[number]);
  const topIndex =
    summaryTop >= 0
      ? summaryTop
      : Math.max(...GRADE_ORDER.map((g, i) => (countOf(g) > 0 ? i : -1)));
  const v0Index = GRADE_ORDER.indexOf('V0');
  // V0 .. highest are always shown (zero = 4pt nub); VB only when it has sends.
  const rows = GRADE_ORDER.map((grade, i) => ({ grade, i, count: countOf(grade) })).filter(
    ({ i, count }) => count > 0 || (i >= v0Index && i <= topIndex),
  );
  const maxCount = Math.max(...rows.map((r) => r.count), 1);

  const summary = [
    { key: 'total', value: String(stats.total_sends), label: t('profileHistory.stats.totalSends') },
    { key: 'days', value: String(stats.accumulated_days), label: t('profileHistory.stats.accumulatedDays') },
    {
      key: 'top',
      value: stats.highest_grade ?? t('profileHistory.stats.noGrade'),
      label: t('profileHistory.stats.highestGrade'),
    },
  ];

  return (
    <View style={styles.container}>
      {/* ── Summary row ──────────────────────────────────────────────────── */}
      <View style={[styles.summaryRow, ax && styles.summaryRowAx]}>
        {summary.map((s, idx) => (
          <React.Fragment key={s.key}>
            {idx > 0 && !ax && <View style={styles.statDivider} />}
            <View style={[styles.statItem, ax && styles.statItemAx]}>
              <AppText variant="title2" numeric align="center">
                {s.value}
              </AppText>
              <AppText variant="caption1" color="textSecondary" align="center" style={styles.statLabel}>
                {s.label}
              </AppText>
            </View>
          </React.Fragment>
        ))}
      </View>

      {/* ── Bars ─────────────────────────────────────────────────────────── */}
      <AppText variant="sectionHeader" style={styles.chartTitle} accessibilityRole="header">
        {t('profileHistory.stats.chartTitle')}
      </AppText>
      <View style={styles.chart} accessibilityLabel={t('profileHistory.stats.chartA11y')}>
        {rows.map(({ grade, i, count }, order) => {
          const highest = i === topIndex;
          const a11y = t(highest ? 'profileHistory.stats.barA11yHighest' : 'profileHistory.stats.barA11y', {
            grade,
            count,
          });
          return (
            <View key={grade} style={styles.barRow} accessible accessibilityLabel={a11y}>
              <AppText variant="caption2" numeric color="textSecondary" style={styles.gradeLabel}>
                {grade}
              </AppText>
              <View style={styles.barArea}>
                <Bar pct={(count / maxCount) * 100} highest={highest} zero={count === 0} order={order} play={play} />
              </View>
              <View style={styles.countCell}>
                <AppText variant="caption2" numeric color="textSecondary" align="right">
                  {count}
                </AppText>
                {highest && (
                  <AppText variant="caption1" color="textPrimary" style={styles.highestLabel}>
                    {t('profileHistory.stats.highestBadge')}
                  </AppText>
                )}
              </View>
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
      padding: theme.layout.cardPadding,
      marginBottom: theme.layout.sectionGap,
    },
    empty: {
      paddingVertical: theme.spacing.md,
    },
    summaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: theme.layout.sectionGap,
    },
    summaryRowAx: {
      flexWrap: 'wrap',
      rowGap: theme.spacing.md,
    },
    statItem: {
      flex: 1,
      alignItems: 'center',
    },
    statItemAx: {
      flexBasis: '50%',
      flexGrow: 0,
    },
    statLabel: {
      marginTop: theme.spacing.xs,
    },
    statDivider: {
      width: theme.stroke.thin,
      height: DIVIDER_HEIGHT,
      backgroundColor: theme.colors.divider,
    },
    chartTitle: {
      marginBottom: theme.layout.sectionHeaderGap,
    },
    chart: {
      gap: theme.spacing.xs,
    },
    barRow: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: theme.layout.minTouchTarget / 2,
    },
    gradeLabel: {
      minWidth: 32,
    },
    barArea: {
      flex: 1,
      justifyContent: 'center',
    },
    countCell: {
      minWidth: 28,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      paddingLeft: theme.spacing.sm,
    },
    highestLabel: {
      marginLeft: theme.spacing.xs,
    },
  });
}
