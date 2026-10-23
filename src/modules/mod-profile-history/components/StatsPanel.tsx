/**
 * StatsPanel — aggregate send stats for a profile (design system v2.2, spec §32.5).
 *
 * Data: existing `ProfileStats` fields only (total_sends, sends_by_grade, accumulated_days,
 * highest_grade). The hero shows "N sends at the top grade", never a date.
 *
 * Layout: tinted hero tile (`display` top grade) + two static tiles (`numeric1` + half-size `unit`)
 * + a distribution card (6pt bars on `surfaceAlt` tracks; neutral `outline` fill, only the top-grade
 * row uses `sendTop` and carries the "Highest" pill in the grade column).
 *
 * States: normal, attempts-only (total_sends = 0 but records exist: structure kept, no button),
 * zero records (`hasRecords = false`: ONE EmptyState `prompt`).
 *
 * Motion D7: displacement reveal. The fill has its final width inside an `overflow: hidden` capsule
 * track and `translateX` runs -W -> 0 (native driver), so the head stays round. `medium` + `enter`,
 * stagger 30, at most 7 steps (<= 510ms), top row last with `settle`. Once per session. Reduce
 * Motion: bars are final, the distribution card fades in over `short`.
 *
 * COMPACT variant (page-review P-1/P-2, spec §32.5 v2.3): `variant="compact"` renders ONE row of three
 * tiles (total sends, days climbed, highest grade) with gap `inlineGap` 8. Numerals are `title3` 20
 * `numeric`, labels `footnote` 13; no 11/12pt text. It is the entry point for the full panel, which
 * lives on Profile History.
 *   <StatsPanel variant="compact" stats={stats} onOpenDetails={openProfileHistory} />
 * Props for compact: `stats` (required), `onOpenDetails` (optional; when set every tile is one
 * pressable card, hint "Opens full stats"; omitted -> static tiles). `hasRecords` / `onLogSend` are
 * ignored. Adopted by Profile (auth-profile) and User Profile (social-feed) in phase 2.
 *
 * Margins: the panel never pads horizontally; the parent owns screenMargin (R0), so content sits at 16.
 *
 * Tokens only: no hex, font sizes or radii.
 */

import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, StyleSheet, useWindowDimensions, View } from 'react-native';

import { AppText, Card, EmptyState } from '../../../components/ui';
import { SPRING_REST, USE_NATIVE_DRIVER, bezierFor, useMotion } from '../../../lib/motion';
import { useTheme } from '../../../lib/theme';
import type { ProfileStats } from '../types';
import { GRADE_ORDER } from '../types';

// ── Constants ──────────────────────────────────────────────────────────────────

/** Stagger steps: the 8th row onward start with the 8th (30 x 7 + 300 = 510ms). */
const MAX_STAGGER_STEPS = 7;
/** AX threshold (spec: fontScale >= 1.6). */
const AX_FONT_SCALE = 1.6;
/** Distribution row layout (spec 32.5). */
const ROW_HEIGHT = 30;
const GRADE_COL_WIDTH = 72;
const COUNT_COL_WIDTH = 26;
const COL_GAP = 12;
/** Hero : small tile ratio on wide screens. */
const HERO_FLEX = 1.1;

/** Bars animate once per app session. */
let barsPlayed = false;

/** Test / story helper: lets the bar reveal play again. */
export function resetStatsBarAnimation(): void {
  barsPlayed = false;
}

// ── Bar ────────────────────────────────────────────────────────────────────────

interface BarProps {
  ratio: number;
  highest: boolean;
  zero: boolean;
  order: number;
  play: boolean;
}

function Bar({ ratio, highest, zero, order, play }: BarProps): React.JSX.Element {
  const { theme } = useTheme();
  const { duration, spring, reduceMotion } = useMotion();
  const animate = play && !reduceMotion && !zero;
  const reveal = useRef(new Animated.Value(animate ? 0 : 1)).current;
  const [trackW, setTrackW] = useState(0);
  const started = useRef(false);
  const c = theme.colors;
  const height = theme.componentSize.statsBarHeight;

  useEffect(() => {
    if (!animate || trackW === 0 || started.current) return;
    started.current = true;
    const delay = Math.min(order, MAX_STAGGER_STEPS) * duration.stagger;
    const anim = highest
      ? Animated.spring(reveal, {
          toValue: 1,
          ...spring.settle,
          ...SPRING_REST,
          overshootClamping: true,
          delay,
          useNativeDriver: USE_NATIVE_DRIVER,
        })
      : Animated.timing(reveal, {
          toValue: 1,
          delay,
          duration: duration.medium,
          easing: bezierFor('enter'),
          useNativeDriver: USE_NATIVE_DRIVER,
        });
    // No cleanup: React strict-mode's double effect would stop it and `started` blocks a restart.
    anim.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animate, trackW]);

  const fillW = trackW * ratio;

  return (
    <View
      onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}
      style={{
        flex: 1,
        height,
        borderRadius: theme.radius.full,
        backgroundColor: c.surfaceAlt,
        overflow: 'hidden',
      }}
    >
      {zero ? (
        // 0 sends: a 6x6 `outline` starting dot on the track, no animation.
        <View style={{ width: height, height, borderRadius: theme.radius.full, backgroundColor: c.outline }} />
      ) : trackW > 0 ? (
        <Animated.View
          style={{
            width: fillW,
            height,
            borderRadius: theme.radius.full,
            backgroundColor: highest ? c.sendTop : c.outline,
            transform: [{ translateX: reveal.interpolate({ inputRange: [0, 1], outputRange: [-fillW, 0] }) }],
          }}
        />
      ) : null}
    </View>
  );
}

// ── Tile number + unit ─────────────────────────────────────────────────────────

/** Number (numeric1) + half-size unit. Same row; at AX the unit wraps below, it is never dropped. */
function NumberUnit({ value, unit }: { value: number; unit: string }): React.JSX.Element {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 4 }}>
      <AppText variant="numeric1" numeric>
        {String(value)}
      </AppText>
      <AppText variant="headline" weight="400" color="textSecondary">
        {unit}
      </AppText>
    </View>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

interface StatsPanelProps {
  stats: ProfileStats;
  /** `full` (default): hero + tiles + distribution. `compact`: one row of three small tiles. */
  variant?: 'full' | 'compact';
  /** Compact only: tap target that opens the full StatsPanel (Profile History). */
  onOpenDetails?: () => void;
  /**
   * False when the user has no ascent records at all (not even attempts): the whole panel becomes one
   * EmptyState `prompt`. Default true (total_sends = 0 then means "attempts only").
   */
  hasRecords?: boolean;
  /** The single primary action of the zero-records prompt ("Find routes"). Omitted -> no button. */
  onLogSend?: () => void;
}

export default function StatsPanel({
  stats,
  variant = 'full',
  onOpenDetails,
  hasRecords = true,
  onLogSend,
}: StatsPanelProps): React.JSX.Element {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const { fontScale, width } = useWindowDimensions();
  const { duration, reduceMotion } = useMotion();
  const styles = makeStyles(theme);
  const ax = fontScale >= AX_FONT_SCALE;
  const narrow = width < theme.layout.compactWidthBreakpoint;
  const c = theme.colors;

  // Only the first mounted panel of the session plays the reveal.
  const play = useRef(!barsPlayed).current;
  useEffect(() => {
    if (stats.total_sends > 0) barsPlayed = true;
  }, [stats.total_sends]);

  // Reduce Motion: the distribution card fades in instead.
  const fade = useRef(new Animated.Value(play && reduceMotion ? 0 : 1)).current;
  useEffect(() => {
    if (!(play && reduceMotion) || stats.total_sends === 0) return;
    Animated.timing(fade, {
      toValue: 1,
      duration: duration.short,
      easing: bezierFor('enter'),
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion]);

  if (variant === 'compact') {
    const items = [
      {
        key: 'sends',
        label: t('profileHistory.stats.totalSends'),
        value: String(stats.total_sends),
        a11y: t('profileHistory.stats.sendsA11y', { count: stats.total_sends }),
      },
      {
        key: 'days',
        label: t('profileHistory.stats.accumulatedDays'),
        value: String(stats.accumulated_days),
        a11y: t('profileHistory.stats.daysA11y', { count: stats.accumulated_days }),
      },
      {
        key: 'highest',
        label: t('profileHistory.stats.highestGrade'),
        value: stats.highest_grade ?? t('profileHistory.stats.noGrade'),
        a11y: `${t('profileHistory.stats.highestGrade')}, ${stats.highest_grade ?? t('profileHistory.stats.noGrade')}`,
      },
    ];
    return (
      <View style={styles.compactRow}>
        {items.map(({ key, label, value, a11y }) => (
          <Card
            key={key}
            variant={onOpenDetails ? 'pressable' : 'static'}
            onPress={onOpenDetails}
            padding={theme.layout.cardPadding}
            accessibilityLabel={`${label}, ${a11y}`}
            accessibilityHint={onOpenDetails ? t('profileHistory.stats.compactHint') : undefined}
            style={styles.compactTile}
          >
            <AppText variant="footnote" weight="600" color="textSecondary">
              {label}
            </AppText>
            <AppText variant="title3" numeric>
              {value}
            </AppText>
          </Card>
        ))}
      </View>
    );
  }

  if (!hasRecords) {
    return (
      <View style={styles.container}>
        <EmptyState
          variant="prompt"
          eyebrow={t('profileHistory.stats.promptEyebrow')}
          title={t('profileHistory.stats.promptTitle')}
          description={t('profileHistory.stats.promptBody')}
          primaryLabel={onLogSend ? t('profileHistory.stats.promptAction') : undefined}
          onPrimary={onLogSend}
        />
      </View>
    );
  }

  const attemptsOnly = stats.total_sends === 0;

  const countOf = (grade: string): number =>
    stats.sends_by_grade.find((g) => g.grade === grade)?.count ?? 0;
  const summaryTop = GRADE_ORDER.indexOf(stats.highest_grade as (typeof GRADE_ORDER)[number]);
  const topIndex =
    summaryTop >= 0
      ? summaryTop
      : Math.max(...GRADE_ORDER.map((g, i) => (countOf(g) > 0 ? i : -1)));
  const v0Index = GRADE_ORDER.indexOf('V0');
  // V0 .. highest are always shown (zero = 6pt dot); VB only when it has sends.
  const rows = GRADE_ORDER.map((grade, i) => ({ grade, i, count: countOf(grade) })).filter(
    ({ i, count }) => count > 0 || (i >= v0Index && i <= topIndex),
  );
  const maxCount = Math.max(...rows.map((r) => r.count), 1);
  const topCount = topIndex >= 0 ? countOf(GRADE_ORDER[topIndex]) : 0;
  const topGrade = stats.highest_grade ?? t('profileHistory.stats.noGrade');

  // ── Hero ───────────────────────────────────────────────────────────────────
  const hero = (
    <Card
      variant="tinted"
      style={[
        styles.hero,
        { flex: ax ? undefined : narrow ? 1 : HERO_FLEX },
        ax ? { alignSelf: 'stretch' } : null,
      ]}
    >
      <View
        style={styles.heroInner}
        accessible
        accessibilityLabel={
          attemptsOnly
            ? `${t('profileHistory.stats.highestGrade')}, ${t('profileHistory.stats.noSendsTitle')}`
            : t('profileHistory.stats.heroA11y', { grade: topGrade, count: topCount })
        }
      >
        <AppText variant="subhead" weight="600" color="onPrimaryContainer">
          {t('profileHistory.stats.highestGrade')}
        </AppText>
        {attemptsOnly ? (
          <View style={styles.heroBottom}>
            <AppText variant="title2" color="onPrimaryContainer">
              {t('profileHistory.stats.noSendsTitle')}
            </AppText>
            <AppText variant="footnote" weight="600" color="onPrimaryContainer" style={styles.heroSub}>
              {t('profileHistory.stats.noSendsBody')}
            </AppText>
          </View>
        ) : (
          <View style={styles.heroBottom}>
            <AppText variant="display" numeric color="onPrimaryContainer">
              {topGrade}
            </AppText>
            <AppText variant="footnote" weight="600" color="onPrimaryContainer" style={styles.heroSub}>
              {t('profileHistory.stats.heroSends', { count: topCount })}
            </AppText>
          </View>
        )}
      </View>
    </Card>
  );

  // ── Small tiles ────────────────────────────────────────────────────────────
  const tile = (
    key: string,
    label: string,
    value: number,
    unit: string,
    a11y: string,
  ): React.JSX.Element => (
    <Card key={key} variant="static" padding={0} style={styles.tile}>
      <View style={styles.tileInner} accessible accessibilityLabel={a11y}>
        <AppText variant="footnote" weight="600" color="textSecondary">
          {label}
        </AppText>
        <NumberUnit value={value} unit={unit} />
      </View>
    </Card>
  );

  const tiles = [
    tile(
      'sends',
      t('profileHistory.stats.totalSends'),
      stats.total_sends,
      t('profileHistory.stats.unitTimes'),
      t('profileHistory.stats.sendsA11y', { count: stats.total_sends }),
    ),
    tile(
      'days',
      t('profileHistory.stats.accumulatedDays'),
      stats.accumulated_days,
      t('profileHistory.stats.unitDays'),
      t('profileHistory.stats.daysA11y', { count: stats.accumulated_days }),
    ),
  ];

  return (
    <View style={styles.container}>
      {ax ? (
        <>
          {hero}
          <View style={styles.row}>{tiles}</View>
        </>
      ) : (
        <View style={styles.row}>
          {hero}
          <View style={styles.tileColumn}>{tiles}</View>
        </View>
      )}

      {/* ── Distribution (hidden when there are no sends) ───────────────────── */}
      {attemptsOnly ? null : (
        <Animated.View style={{ opacity: fade }}>
          <Card variant="static">
            <View style={styles.chartHeader}>
              <AppText variant="title3" accessibilityRole="header" style={styles.flex}>
                {t('profileHistory.stats.chartTitle')}
              </AppText>
              <AppText variant="footnote" color="textSecondary">
                {t('profileHistory.stats.chartTotal')}
              </AppText>
            </View>
            <View accessibilityLabel={t('profileHistory.stats.chartA11y')} style={styles.rows}>
              {rows.map(({ grade, i, count }, order) => {
                const highest = i === topIndex;
                const a11y = t(
                  highest ? 'profileHistory.stats.barA11yHighest' : 'profileHistory.stats.barA11y',
                  { grade, count },
                );
                return (
                  <View key={grade} style={styles.barRow} accessible accessibilityLabel={a11y}>
                    <View style={styles.gradeCol}>
                      <AppText variant="subhead" weight="600" numeric>
                        {grade}
                      </AppText>
                      {highest ? (
                        <View style={[styles.pill, { backgroundColor: c.primaryContainer }]}>
                          <AppText variant="caption1" weight="600" color="onPrimaryContainer">
                            {t('profileHistory.stats.highestBadge')}
                          </AppText>
                        </View>
                      ) : null}
                    </View>
                    <Bar
                      ratio={count / maxCount}
                      highest={highest}
                      zero={count === 0}
                      order={order}
                      play={play}
                    />
                    <View style={styles.countCol}>
                      <AppText variant="subhead" weight="600" numeric align="right">
                        {count}
                      </AppText>
                    </View>
                  </View>
                );
              })}
            </View>
          </Card>
        </Animated.View>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function makeStyles(theme: ReturnType<typeof useTheme>['theme']) {
  return StyleSheet.create({
    // Cards never carry their own margin: the parent gaps them (cardGap 8).
    container: {
      gap: theme.spacing.sm,
      marginBottom: theme.layout.sectionGap,
    },
    compactRow: {
      flexDirection: 'row',
      gap: theme.layout.inlineGap,
    },
    compactTile: {
      flex: 1,
      minWidth: 0,
      gap: theme.spacing.xs,
    },
    row: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
    flex: { flex: 1 },
    hero: {
      minHeight: theme.componentSize.statsPrimaryMinHeight,
    },
    heroInner: {
      flex: 1,
      justifyContent: 'space-between',
    },
    heroBottom: {
      marginTop: theme.spacing.md,
    },
    heroSub: {
      marginTop: theme.spacing.xs,
    },
    tileColumn: {
      flex: 1,
      gap: theme.spacing.sm,
    },
    tile: {
      flex: 1,
      minWidth: 0,
    },
    tileInner: {
      padding: theme.layout.cardPadding,
      gap: theme.spacing.xs,
    },
    chartHeader: {
      flexDirection: 'row',
      alignItems: 'baseline',
      marginBottom: theme.layout.sectionHeaderGap,
    },
    // C3/C1: row slack above the first and below the last bar is pulled out, so the visible gaps are
    // title -> first bar `sectionHeaderGap` 8 and last bar -> card edge `cardPadding` 16.
    rows: {
      marginTop: -(ROW_HEIGHT - theme.componentSize.statsBarHeight) / 2,
      marginBottom: -(ROW_HEIGHT - theme.componentSize.statsBarHeight) / 2,
    },
    barRow: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: ROW_HEIGHT,
      columnGap: COL_GAP,
    },
    gradeCol: {
      width: GRADE_COL_WIDTH,
      flexDirection: 'row',
      alignItems: 'center',
      columnGap: theme.spacing.xs,
    },
    pill: {
      paddingHorizontal: theme.spacing.sm,
      borderRadius: theme.radius.full,
    },
    countCol: {
      width: COUNT_COL_WIDTH,
    },
  });
}
