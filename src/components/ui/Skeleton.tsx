import React, { useEffect, useState } from 'react';
import { Animated, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { MOTION, USE_NATIVE_DRIVER, bezierFor, useMotion } from '../../lib/motion';
import { useTheme } from '../../lib/theme';

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

export interface SkeletonProps {
  width?: ViewStyle['width'];
  height?: ViewStyle['height'];
  radius?: number;
  /** 'card' (inside a card): surfaceAlt. 'page' (directly on the sand background): border. */
  surface?: 'card' | 'page';
  style?: StyleProp<ViewStyle>;
}

/** Placeholder block. Reduce Motion: static. Wrap groups in <SkeletonGroup> for a single busy node. */
export function Skeleton({ width = '100%', height = 16, radius, surface = 'card', style }: SkeletonProps): React.JSX.Element {
  const { theme } = useTheme();
  const { reduceMotion } = useMotion();
  useEffect(() => {
    if (reduceMotion) return undefined;
    retain();
    return release;
  }, [reduceMotion]);
  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: radius ?? theme.borderRadius.md,
          backgroundColor: surface === 'card' ? theme.colors.surfaceAlt : theme.colors.border,
          opacity: reduceMotion ? 1 : pulse,
        },
        style,
      ]}
    />
  );
}

/** One accessibility node (busy) for a set of skeleton blocks. */
export function SkeletonGroup({ label, children, style }: { label?: string; children: React.ReactNode; style?: StyleProp<ViewStyle> }): React.JSX.Element {
  return (
    <View accessible accessibilityLabel={label} accessibilityState={{ busy: true }} style={style}>
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
