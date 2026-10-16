import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { MOTION, USE_NATIVE_DRIVER, bezierFor, useMotion } from '../../lib/motion';
import type { ParticleKind } from '../../lib/motion';
import { useTheme } from '../../lib/theme';
import type { PaletteKey } from '../../lib/theme';

export interface ParticleBurstProps {
  kind: ParticleKind;
  /** newHighest only: swap decorChalk for sendFlashBright (the new top was also a flash). */
  flash?: boolean;
  /** Changing this value replays the burst. */
  playKey?: number | string;
}

interface Spec {
  key: PaletteKey;
  size: number;
  dx: number;
  dy: number;
}

/**
 * Radial particle burst. Transform + opacity only, native driver, hidden from accessibility,
 * plays once, no touch handling. Renders nothing under Reduce Motion. Colours are palette keys
 * resolved from the current theme (never purple).
 */
export function ParticleBurst({ kind, flash, playKey }: ParticleBurstProps): React.JSX.Element | null {
  const { theme } = useTheme();
  const { duration, reduceMotion } = useMotion();
  const cfg = MOTION.particles[kind];
  const progress = useRef(new Animated.Value(0)).current;

  const specs = useMemo<Spec[]>(() => {
    const colors: PaletteKey[] = [];
    (cfg.colors as ReadonlyArray<{ key: PaletteKey; n: number }>).forEach((c) => {
      let k = c.key;
      const swap = 'flashSwap' in cfg ? (cfg.flashSwap as { from: string; to: PaletteKey }) : null;
      if (flash && swap && k === swap.from) k = swap.to;
      for (let i = 0; i < c.n; i += 1) colors.push(k);
    });
    const [minS, maxS] = cfg.sizePt;
    const [minD, maxD] = cfg.distancePt;
    return colors.map((key, i) => {
      const angle = (i / colors.length) * Math.PI * 2 + (i % 2) * 0.3;
      const dist = minD + ((i * 7) % 5) * ((maxD - minD) / 4);
      return {
        key,
        size: minS + ((i * 3) % 5) * ((maxS - minS) / 4),
        dx: Math.cos(angle) * dist,
        dy: Math.sin(angle) * dist,
      };
    });
  }, [cfg, flash]);

  useEffect(() => {
    if (reduceMotion) return;
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: duration.celebrate,
      easing: bezierFor('enter'),
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, [playKey, reduceMotion, progress, duration.celebrate]);

  if (reduceMotion) return null;

  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.layer}>
      {specs.map((s, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            width: s.size,
            height: s.size,
            borderRadius: s.size / 2,
            backgroundColor: theme.colors[s.key],
            opacity: progress.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1, 0] }),
            transform: [
              { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, s.dx] }) },
              { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, s.dy] }) },
              { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.6] }) },
            ],
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
});
