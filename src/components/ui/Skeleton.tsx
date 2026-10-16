import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { MOTION, USE_NATIVE_DRIVER, bezierFor, useMotion } from '../../lib/motion';
import { useTheme } from '../../lib/theme';
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

export type SkeletonShape = 'text' | 'circle' | 'thumb' | 'card' | 'rect';

export interface SkeletonProps {
  /**
   * The element being replaced decides the corner radius (§22.2): text -> sm, circle -> full
   * (give width = height = the Avatar size), thumb -> md (80x80 route thumbnail), card -> lg,
   * rect (default) -> md.
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
      ? theme.borderRadius.sm
      : shape === 'circle'
        ? theme.borderRadius.full
        : shape === 'card'
          ? theme.borderRadius.lg
          : theme.borderRadius.md);
  const role = theme.typeScale[textVariant];
  const bar = (
    <Animated.View
      style={[
        {
          width,
          height: shape === 'text' ? (height ?? role.fontSize - 4) : (height ?? 16),
          borderRadius: r,
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
