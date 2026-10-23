import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { MOTION, USE_NATIVE_DRIVER, bezierFor, useMotion } from '../../lib/motion';
import { innerRadius, useTheme } from '../../lib/theme';
import type { TypeVariant } from '../../lib/theme';

// One shared pulse for every skeleton on screen (opacity 0.5 <-> 1, linear, skeletonPulse per round trip).
const pulse = new Animated.Value(1);
let users = 0;
let loop: Animated.CompositeAnimation | null = null;

function retain(): void {
  users += 1;
  if (users === 1) {
    const half = MOTION.duration.skeletonPulse / 2;
    loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.5, duration: half, easing: bezierFor('linear'), useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(pulse, { toValue: 1, duration: half, easing: bezierFor('linear'), useNativeDriver: USE_NATIVE_DRIVER }),
      ]),
    );
    loop.start();
  }
}

function release(): void {
  users = Math.max(0, users - 1);
  if (users === 0) {
    loop?.stop();
    loop = null;
    pulse.setValue(1);
  }
}

export type SkeletonShape = 'text' | 'circle' | 'thumb' | 'card' | 'tape' | 'rect';

export interface SkeletonProps {
  /**
   * The element being replaced decides the corner radius (22.2): text -> `minor` 4, circle -> full
   * (give width = height = the Avatar size), thumb -> innerRadius(card, 8) = 12 (88 route thumbnail),
   * card -> `card` 20, tape -> `tape` 6 (48x34 lg / 40x24 md), rect (default) -> `media` 12.
   */
  shape?: SkeletonShape;
  /** shape="text": the type role being replaced. Bar height = fontSize - 4, centred in the role's line box. */
  textVariant?: TypeVariant;
  width?: ViewStyle['width'];
  height?: ViewStyle['height'];
  /** Explicit radius override (prefer `shape`). */
  radius?: number;
  /** 'card' (inside a card): surfaceAlt. 'page' (directly on the sand background): border. */
  surface?: 'card' | 'page';
  style?: StyleProp<ViewStyle>;
}

/** Placeholder block. Reduce Motion: static. Wrap groups in <SkeletonGroup> for a single busy node. */
export function Skeleton({
  shape = 'rect',
  textVariant = 'subhead',
  width = '100%',
  height,
  radius,
  surface = 'card',
  style,
}: SkeletonProps): React.JSX.Element {
  const { theme } = useTheme();
  const { reduceMotion } = useMotion();
  useEffect(() => {
    if (reduceMotion) return undefined;
    retain();
    return release;
  }, [reduceMotion]);
  const r =
    radius ??
    (shape === 'text'
      ? theme.radius.minor
      : shape === 'circle'
        ? theme.radius.full
        : shape === 'card'
          ? theme.radius.card
          : shape === 'tape'
            ? theme.radius.tape
            : shape === 'thumb'
              ? innerRadius(theme.radius.card, theme.layout.routeCardPadding)
              : theme.radius.media);
  const role = theme.typeScale[textVariant];
  const bar = (
    <Animated.View
      style={[
        {
          width,
          height: shape === 'text' ? (height ?? role.fontSize - 4) : (height ?? 16),
          borderRadius: r,
          borderCurve: r >= 12 ? 'continuous' : undefined,
          backgroundColor: surface === 'card' ? theme.colors.surfaceAlt : theme.colors.border,
          opacity: reduceMotion ? 1 : pulse,
        },
        shape === 'text' ? null : style,
      ]}
    />
  );
  if (shape !== 'text') return bar;
  // text line: sits centred inside the role's line box so the layout equals the real text
  return <View style={[{ minHeight: role.lineHeight, justifyContent: 'center' }, style]}>{bar}</View>;
}

/**
 * One accessibility node (busy) for a set of skeleton blocks. Pass a label naming the region
 * ("Loading routes", "Loading beta videos"); it falls back to a generic "Loading".
 */
export function SkeletonGroup({ label, children, style }: { label?: string; children: React.ReactNode; style?: StyleProp<ViewStyle> }): React.JSX.Element {
  const { t } = useTranslation('common');
  return (
    <View accessible accessibilityLabel={label ?? t('ui.loading')} accessibilityState={{ busy: true }} style={style}>
      <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {children}
      </View>
    </View>
  );
}

/**
 * Loading phases: nothing until `skeletonDelay` (300ms), then 'skeleton', and 'timeout' after
 * `skeletonTimeout` (10s) so the caller can show an InlineError with retry.
 */
export function useSkeletonPhase(loading: boolean): 'idle' | 'skeleton' | 'timeout' {
  const { duration } = useMotion();
  const [phase, setPhase] = useState<'idle' | 'skeleton' | 'timeout'>('idle');
  useEffect(() => {
    if (!loading) {
      setPhase('idle');
      return undefined;
    }
    const a = setTimeout(() => setPhase('skeleton'), duration.skeletonDelay);
    const b = setTimeout(() => setPhase('timeout'), duration.skeletonTimeout);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [loading, duration.skeletonDelay, duration.skeletonTimeout]);
  return phase;
}

// ─── The four v2.2 layouts (22.2): identical geometry to the real content ─────

/** RouteCard: card 20 (padding 8) + tape lg + 2 text lines + 88 thumbnail (r12). Height 104. */
export function RouteCardSkeleton({ compact = false, style }: { compact?: boolean; style?: StyleProp<ViewStyle> }): React.JSX.Element {
  const { theme } = useTheme();
  const thumb = compact ? theme.componentSize.routeThumbCompact : theme.componentSize.routeThumb;
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radius.card,
          borderCurve: 'continuous',
          padding: theme.layout.routeCardPadding,
          borderWidth: theme.isDark ? theme.stroke.thin : 0,
          borderColor: theme.colors.border,
        },
        style,
      ]}
    >
      <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: theme.spacing.xs, rowGap: 6 }}>
        <Skeleton shape="tape" width={48} height={34} />
        <Skeleton shape="text" textVariant="headline" width="70%" />
        <Skeleton shape="text" textVariant="footnote" width="45%" />
      </View>
      <Skeleton shape="thumb" width={thumb} height={thumb} />
    </View>
  );
}

/** Ascent / list content row: thumbnail 56 (r12) + 2 lines + disc 28. */
export function AscentRowSkeleton({ style }: { style?: StyleProp<ViewStyle> }): React.JSX.Element {
  const { theme } = useTheme();
  const t = theme.componentSize.listThumb;
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          minHeight: theme.layout.listRowMinHeight,
          paddingVertical: theme.layout.listRowPaddingV,
          paddingHorizontal: theme.spacing.md,
          backgroundColor: theme.colors.surface,
        },
        style,
      ]}
    >
      <Skeleton shape="rect" width={t} height={t} />
      <View style={{ flex: 1, marginHorizontal: theme.spacing.smd }}>
        <Skeleton shape="text" textVariant="headline" width="60%" />
        <Skeleton shape="text" textVariant="footnote" width="40%" />
      </View>
      <Skeleton shape="circle" width={theme.componentSize.sendStatusDisc} height={theme.componentSize.sendStatusDisc} />
    </View>
  );
}

/** Beta-video grid cell: 3:4, `border` colour (it sits directly on the page). */
export function VideoCellSkeleton({ style }: { style?: StyleProp<ViewStyle> }): React.JSX.Element {
  const { theme } = useTheme();
  return <Skeleton shape="rect" radius={0} surface="page" width="100%" height="auto" style={[{ aspectRatio: theme.componentSize.mediaTileAspect }, style]} />;
}

/** StatsPanel: primary block (176 min, r20) + 2 secondary blocks stacked, gap 12. */
export function StatsPanelSkeleton({ style }: { style?: StyleProp<ViewStyle> }): React.JSX.Element {
  const { theme } = useTheme();
  const h = theme.componentSize.statsPrimaryMinHeight;
  const gap = theme.layout.cardGap;
  return (
    <View style={[{ flexDirection: 'row', columnGap: gap }, style]}>
      <Skeleton shape="card" width={undefined} height={h} style={{ flex: 1.1 }} />
      <View style={{ flex: 1, rowGap: gap }}>
        <Skeleton shape="card" width="100%" height={(h - gap) / 2} />
        <Skeleton shape="card" width="100%" height={(h - gap) / 2} />
      </View>
    </View>
  );
}
