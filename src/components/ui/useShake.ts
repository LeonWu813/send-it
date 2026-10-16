import { useCallback, useRef } from 'react';
import { Animated } from 'react-native';

import { USE_NATIVE_DRIVER, bezierFor, useMotion } from '../../lib/motion';

/**
 * Unified failure shake (§10.5, MOTION.shake): translateX 0 -> +d -> -d -> +d -> 0 in
 * `shake.segments` linear steps over `duration.short`. Only the failed element shakes (button,
 * row, toast icon at half distance) and it only reinforces an error message that is always shown.
 * Reduce Motion: no shake. Pair with `haptic('error')` at the call site.
 *
 *   const { translateX, shake } = useShake();
 *   <Animated.View style={{ transform: [{ translateX }] }} />
 */
export function useShake(): { translateX: Animated.Value; shake: (scaleDistance?: number) => void } {
  const { duration, shake: cfg, reduceMotion } = useMotion();
  const translateX = useRef(new Animated.Value(0)).current;
  const shake = useCallback(
    (scaleDistance = 1) => {
      if (reduceMotion) return;
      const d = cfg.distancePt * scaleDistance;
      // 4 segments: +d, -d, +d, 0
      const stops = [d, -d, d, 0].slice(0, cfg.segments);
      translateX.setValue(0);
      Animated.sequence(
        stops.map((toValue) =>
          Animated.timing(translateX, {
            toValue,
            duration: duration.short / cfg.segments,
            easing: bezierFor('linear'),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
        ),
      ).start();
    },
    [cfg.distancePt, cfg.segments, duration.short, reduceMotion, translateX],
  );
  return { translateX, shake };
}
