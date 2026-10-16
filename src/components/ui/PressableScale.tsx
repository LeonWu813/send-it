import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet } from 'react-native';
import type { PressableProps, StyleProp, ViewStyle } from 'react-native';

import { bezierFor, USE_NATIVE_DRIVER, useMotion } from '../../lib/motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface PressableScaleProps extends Omit<PressableProps, 'style' | 'children'> {
  /**
   * 'control' (buttons, chips, icon buttons, tiles): scale to 0.96 + colour wash.
   * 'row' (cards, list rows): colour wash only, never scales.
   */
  feedback?: 'control' | 'row';
  /** The matching *Pressed colour (never opacity). Shown as a wash: in micro, out short. */
  pressedColor?: string;
  /** Row inside a scroll container: delays the pressed state by pressDelayInScroll. */
  inScroll?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

/** Shared press feedback. Reduce Motion: colour only, no scale. 44pt is the caller's job. */
export function PressableScale({
  feedback = 'control',
  pressedColor,
  inScroll,
  style,
  children,
  onPressIn,
  onPressOut,
  accessibilityRole = 'button',
  ...rest
}: PressableScaleProps): React.JSX.Element {
  const { duration, scale, spring, reduceMotion } = useMotion();
  const wash = useRef(new Animated.Value(0)).current;
  const size = useRef(new Animated.Value(1)).current;
  const scales = feedback === 'control' && !reduceMotion;

  useEffect(() => {
    if (!scales) size.setValue(1);
  }, [scales, size]);

  const radius = StyleSheet.flatten(style)?.borderRadius;

  return (
    <AnimatedPressable
      {...rest}
      accessibilityRole={accessibilityRole}
      unstable_pressDelay={inScroll ? duration.pressDelayInScroll : undefined}
      onPressIn={(e) => {
        Animated.timing(wash, {
          toValue: 1,
          duration: duration.micro,
          easing: bezierFor('standard'),
          useNativeDriver: USE_NATIVE_DRIVER,
        }).start();
        if (scales) {
          Animated.timing(size, {
            toValue: scale.pressControl,
            duration: duration.micro,
            easing: Easing.out(Easing.quad),
            useNativeDriver: USE_NATIVE_DRIVER,
          }).start();
        }
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        Animated.timing(wash, {
          toValue: 0,
          duration: duration.short,
          easing: bezierFor('standard'),
          useNativeDriver: USE_NATIVE_DRIVER,
        }).start();
        if (scales) {
          Animated.spring(size, { toValue: 1, ...spring.grip, useNativeDriver: USE_NATIVE_DRIVER }).start();
        }
        onPressOut?.(e);
      }}
      style={[style, scales ? { transform: [{ scale: size }] } : null]}
    >
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
