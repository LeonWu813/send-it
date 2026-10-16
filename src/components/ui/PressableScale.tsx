import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';
import type { PressableProps, StyleProp, ViewStyle } from 'react-native';

import { SPRING_REST, bezierFor, USE_NATIVE_DRIVER, useMotion } from '../../lib/motion';

/** Controls at least this wide press to `pressWide` (0.98) instead of `pressControl` (0.96). */
const WIDE_CONTROL = 200;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface PressableScaleProps extends Omit<PressableProps, 'style' | 'children'> {
  /**
   * 'control' (buttons, chips, icon buttons, tiles): scale to 0.96 (0.98 when the control is >= 200pt wide) + colour wash.
   * 'row' (cards, list rows): colour wash only, never scales.
   */
  feedback?: 'control' | 'row';
  /** The matching *Pressed colour (never opacity). Shown as a wash: in micro, out short. */
  pressedColor?: string;
  /**
   * Background layers (e.g. a cross-fading selected fill). Rendered BELOW the pressed wash and
   * the content, so the wash is never hidden by an opaque child background.
   */
  underlay?: React.ReactNode;
  /** Row inside a scroll container: delays the pressed state by pressDelayInScroll. */
  inScroll?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

/** Shared press feedback. Reduce Motion: colour only, no scale. 44pt is the caller's job. */
export function PressableScale({
  feedback = 'control',
  pressedColor,
  underlay,
  inScroll,
  style,
  children,
  onPressIn,
  onPressOut,
  onLayout,
  accessibilityRole = 'button',
  ...rest
}: PressableScaleProps): React.JSX.Element {
  const { duration, scale, spring, reduceMotion } = useMotion();
  const wash = useRef(new Animated.Value(0)).current;
  const size = useRef(new Animated.Value(1)).current;
  const [wide, setWide] = useState(false);
  const scales = feedback === 'control' && !reduceMotion;

  useEffect(() => {
    if (!scales) size.setValue(1);
  }, [scales, size]);

  const radius = StyleSheet.flatten(style)?.borderRadius;

  return (
    <AnimatedPressable
      {...rest}
      accessibilityRole={accessibilityRole}
      onLayout={(e) => {
        setWide(e.nativeEvent.layout.width >= WIDE_CONTROL);
        onLayout?.(e);
      }}
      unstable_pressDelay={inScroll ? duration.pressDelayInScroll : undefined}
      onPressIn={(e) => {
        Animated.timing(wash, {
          toValue: 1,
          duration: duration.press,
          easing: bezierFor('standard'),
          useNativeDriver: USE_NATIVE_DRIVER,
        }).start();
        if (scales) {
          Animated.timing(size, {
            toValue: wide ? scale.pressWide : scale.pressControl,
            duration: duration.press,
            easing: bezierFor('standard'),
            useNativeDriver: USE_NATIVE_DRIVER,
          }).start();
        }
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        Animated.timing(wash, {
          toValue: 0,
          duration: duration.release,
          easing: bezierFor('standard'),
          useNativeDriver: USE_NATIVE_DRIVER,
        }).start();
        if (scales) {
          Animated.spring(size, { toValue: 1, ...spring.grip, ...SPRING_REST, useNativeDriver: USE_NATIVE_DRIVER }).start();
        }
        onPressOut?.(e);
      }}
      style={[style, scales ? { transform: [{ scale: size }] } : null]}
    >
      {underlay}
      {pressedColor ? (
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: pressedColor, opacity: wash },
            typeof radius === 'number' ? { borderRadius: radius } : null,
          ]}
        />
      ) : null}
      {children}
    </AnimatedPressable>
  );
}
