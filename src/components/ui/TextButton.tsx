import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, StyleSheet } from 'react-native';
import type { Insets, LayoutChangeEvent } from 'react-native';

import { ICON } from '../../lib/icons';
import { USE_NATIVE_DRIVER, bezierFor, useMotion } from '../../lib/motion';
import { useTheme } from '../../lib/theme';
import { AppText } from './AppText';
import type { ButtonProps, TextPlacement } from './Button';
import { PressableScale } from './PressableScale';

/** Bottom slop of a T1 slot: stops at the top edge of the content under the header row (spec 2.6). */
const TRAILING_BOTTOM_SLOP = 9;
/** Top slop of a T3 under a primary button: stops at the button's bottom edge (spec 2.6). */
const CENTERED_TOP_SLOP = 8;

/** hitSlop for a role (text-button spec 1.4 / 2.6); `labelWidth` lets trailing / inline pad a short label up to 44. */
export function textHitSlop(
  placement: TextPlacement,
  lineHeight: number,
  touch: number,
  labelWidth: number | null,
  afterPrimary = true,
): Insets {
  const total = touch - lineHeight;
  const half = total / 2;
  const free = (side: number): number => (labelWidth === null ? side : Math.max(side, touch - labelWidth));
  switch (placement) {
    case 'trailing':
      return { top: total - TRAILING_BOTTOM_SLOP, bottom: TRAILING_BOTTOM_SLOP, left: free(8), right: 0 };
    case 'inline':
      return { top: half, bottom: half, left: 0, right: free(8) };
    case 'centered':
      return afterPrimary
        ? { top: CENTERED_TOP_SLOP, bottom: total - CENTERED_TOP_SLOP, left: 8, right: 8 }
        : { top: half, bottom: half, left: 8, right: 8 };
    case 'bar':
      return { top: half, bottom: half, left: 16, right: 8 };
    case 'container':
      return { top: half, bottom: half, left: 8, right: 8 };
  }
}

const AnimatedText = Animated.createAnimatedComponent(AppText);

const DEFAULT_LINES: Record<TextPlacement, number> = { trailing: 1, bar: 1, inline: 0, centered: 0, container: 2 };

/**
 * `Button variant="text"`: the one text button (text-button spec 2). No padding, no minHeight, no wash: the layout box is
 * the line box and 44pt comes from hitSlop. The first child is always the text layer (so a row with
 * `alignItems: 'baseline'` finds the text baseline); the spinner is absolute and takes no part in layout.
 */
export function TextButton({
  label,
  onPress,
  size,
  trailingIcon,
  loading = false,
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
  labelLines,
  placement = 'inline',
  afterPrimary = true,
  on,
  icon,
  style,
}: ButtonProps): React.JSX.Element {
  const { theme } = useTheme();
  const { duration } = useMotion();
  const c = theme.colors;
  const inactive = disabled || loading;
  const spin = useRef(new Animated.Value(loading ? 1 : 0)).current;
  const press = useRef(new Animated.Value(0)).current;
  const [labelWidth, setLabelWidth] = useState<number | null>(null);

  if (__DEV__) {
    if (size === 'lg') console.warn('Button variant="text" has no lg size; rendering md.');
    if (icon) console.warn('Button variant="text" takes no leading icon.');
    if (trailingIcon && trailingIcon !== ICON.external.outline) console.warn('Button variant="text" only allows ICON.external as a trailing icon.');
    if (on === 'media') console.warn('Button variant="text" is not defined on media.');
  }

  useEffect(() => {
    Animated.timing(spin, { toValue: loading ? 1 : 0, duration: duration.short, easing: bezierFor('standard'), useNativeDriver: USE_NATIVE_DRIVER }).start();
  }, [loading, spin, duration.short]);

  const small = size === 'sm';
  const typeKey = small ? 'footnote' : 'subhead';
  const lineHeight = theme.typeScale[typeKey].lineHeight;
  const touch = theme.layout.minTouchTarget;
  const shortLabelAware = placement === 'trailing' || placement === 'inline';
  const hitSlop = textHitSlop(placement, lineHeight, touch, shortLabelAware ? labelWidth : null, afterPrimary);
  const showIcon = trailingIcon === ICON.external.outline;
  const iconSize = theme.iconSize.xs;
  const fg = disabled ? c.textDisabled : c.primary;
  const lines = labelLines ?? DEFAULT_LINES[placement];
  // a T1 slot sits in a baseline row; every other role hugs its content on the start keyline (centered: the middle)
  const alignSelf = placement === 'trailing' ? 'baseline' : placement === 'centered' ? 'center' : 'flex-start';

  const onLayout = shortLabelAware
    ? (e: LayoutChangeEvent) => {
        const w = Math.round(e.nativeEvent.layout.width);
        setLabelWidth((prev) => (prev === w ? prev : w));
      }
    : undefined;

  // colour cannot run on the native driver; one 15pt label is cheap on the JS thread
  const tween = (toValue: number, ms: number) =>
    Animated.timing(press, { toValue, duration: ms, easing: bezierFor('standard'), useNativeDriver: false }).start();

  return (
    <PressableScale
      onPress={onPress}
      onPressIn={() => tween(1, duration.press)}
      onPressOut={() => tween(0, duration.release)}
      onLayout={onLayout}
      disabled={inactive}
      hitSlop={hitSlop}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={[{ alignSelf, flexShrink: placement === 'trailing' ? 0 : undefined }, style]}
    >
      <Animated.View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          opacity: spin.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
        }}
      >
        <AnimatedText
          variant={typeKey}
          weight="600"
          style={{ color: inactive ? fg : press.interpolate({ inputRange: [0, 1], outputRange: [c.primary, c.primaryPressed] }), flexShrink: 1 }}
          numberOfLines={lines}
        >
          {label}
        </AnimatedText>
        {showIcon ? <Ionicons name={trailingIcon} size={iconSize} color={fg} style={{ marginLeft: theme.layout.iconTextGap }} /> : null}
      </Animated.View>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.center, { opacity: spin }]}>
        <ActivityIndicator color={fg} size="small" />
      </Animated.View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({ center: { alignItems: 'center', justifyContent: 'center' } });
