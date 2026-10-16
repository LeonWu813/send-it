import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Animated, LayoutAnimation, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { ICON } from '../../lib/icons';
import type { IoniconName } from '../../lib/icons';
import { SPRING_REST, USE_NATIVE_DRIVER, bezierFor, useMotion } from '../../lib/motion';
import { useTheme } from '../../lib/theme';
import { AppText } from './AppText';
import { IconButton } from './IconButton';
import { PressableScale } from './PressableScale';

export type ChipVariant = 'filter' | 'choice' | 'multi';

export interface ChipProps {
  label: string;
  /**
   * filter: opens a BottomSheet menu; selected = a value is applied (label shows the value) and a
   * separate clear button appears next to the chip. choice: single select in a radiogroup.
   * multi: multi select (checkbox).
   */
  variant?: ChipVariant;
  selected?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  /** filter + selected: tap target of the separate 44pt clear IconButton (never nested in the chip). */
  onClear?: () => void;
  /** Localized label of the clear button, e.g. "Clear gym filter". Required when `onClear` is set. */
  clearAccessibilityLabel?: string;
  /** Tape swatch fill (11x11, radius 3) for colour filters. Pops when the chip becomes selected. */
  swatch?: string;
  /** Hairline colour for swatches that need one (white / yellow / pink / black tape). */
  swatchHair?: string;
  /** Leading glyph (sm 16; md 20 for size="large"). */
  icon?: IoniconName;
  /** Glyph used while selected (e.g. filled variant). Defaults to `icon`. */
  iconSelected?: IoniconName;
  /** The glyph scales 0.6 -> 1 (`grip`) when it becomes selected (send-style picker). */
  iconPop?: boolean;
  /**
   * default: 32pt chip (+6pt hitSlop top/bottom), `footnote`. large: minHeight 44, `subhead`, md glyph;
   * for equal-width choice rows, set `style={{ flex: 1 }}`.
   */
  size?: 'default' | 'large';
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Visual height 32 (minHeight) with vertical hitSlop so the touch height is >= 44. Space chips in
 * rows with `columnGap` inlineGap (8) and `rowGap` smd (12) so hit areas never overlap.
 * Selected: secondaryContainer fill cross-faded over `surface` (two layers, opacity only, native
 * driver) + 1.5pt primary outline + 600 weight; outline and weight switch instantly. Padding is
 * smd + (chipSelectedBorder - border) so the outer size never changes. The label reserves its
 * bold width so selection never shifts layout.
 */
export function Chip({
  label,
  variant = 'choice',
  selected = false,
  disabled = false,
  onPress,
  onClear,
  clearAccessibilityLabel,
  swatch,
  swatchHair,
  icon,
  iconSelected,
  iconPop = false,
  size = 'default',
  accessibilityLabel,
  accessibilityHint,
  style,
}: ChipProps): React.JSX.Element {
  const { theme } = useTheme();
  const { duration, spring, scale, reduceMotion } = useMotion();
  const c = theme.colors;
  const fill = useRef(new Animated.Value(selected ? 1 : 0)).current;
  const pop = useRef(new Animated.Value(1)).current;
  const iconScale = useRef(new Animated.Value(1)).current;
  const first = useRef(true);

  useEffect(() => {
    Animated.timing(fill, {
      toValue: selected ? 1 : 0,
      duration: duration.micro,
      easing: bezierFor('standard'),
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, [selected, fill, duration.micro]);

  // Width / neighbours animate when the applied value changes (filter chips).
  useLayoutEffect(() => {
    if (first.current) return;
    if (!reduceMotion) LayoutAnimation.configureNext(LayoutAnimation.create(duration.short, 'easeInEaseOut', 'opacity'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, label]);

  // Colour chips: the swatch pops 1 -> 1.2 -> 1 when selected (not when deselected). It never rotates.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!selected || reduceMotion) return;
    if (iconPop && icon) {
      iconScale.setValue(0.6);
      Animated.spring(iconScale, { toValue: 1, ...spring.grip, ...SPRING_REST, useNativeDriver: USE_NATIVE_DRIVER }).start();
    }
    if (!swatch) return;
    pop.setValue(1);
    Animated.sequence([
      Animated.timing(pop, { toValue: scale.pop, duration: duration.micro, easing: bezierFor('enter'), useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.spring(pop, { toValue: 1, ...spring.grip, ...SPRING_REST, useNativeDriver: USE_NATIVE_DRIVER }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const { chipHeight, chipSelectedBorder, chipBorder, tapeSwatch, tapeSwatchRadius } = theme.componentSize;
  const border = selected ? chipSelectedBorder : chipBorder;
  const large = size === 'large';
  const height = large ? theme.layout.minTouchTarget : chipHeight;
  const slop = large ? 0 : Math.max(0, (theme.layout.minTouchTarget - chipHeight) / 2);
  const glyph = large ? theme.iconSize.md : theme.iconSize.sm;
  const textVariant = large ? 'subhead' : 'footnote';
  const textColor = disabled ? 'textDisabled' : selected ? 'onSecondaryContainer' : 'textSecondary';
  const role = variant === 'choice' ? 'radio' : variant === 'multi' ? 'checkbox' : 'button';
  const showClear = variant === 'filter' && selected && !!onClear;

  const chip = (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={role}
      hitSlop={{ top: slop, bottom: slop, left: 0, right: 0 }}
      pressedColor={disabled ? undefined : selected ? c.secondaryContainerPressed : c.surfacePressed}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={variant === 'filter' ? { selected, disabled } : { checked: selected, disabled }}
      underlay={
        <>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: c.surface }]} />
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: c.secondaryContainer, opacity: fill }]} />
        </>
      }
      style={[{ borderRadius: theme.borderRadius.full, overflow: 'hidden' }, style]}
    >
      <View
        style={{
          minHeight: height,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: theme.borderRadius.full,
          borderWidth: border,
          borderColor: disabled ? c.border : selected ? c.primary : c.outline,
          // keep the outer size constant between the 1pt and 1.5pt outlines
          paddingHorizontal: theme.spacing.smd + (chipSelectedBorder - border),
        }}
      >
        {swatch ? (
          <Animated.View
            style={{
              width: tapeSwatch,
              height: tapeSwatch,
              borderRadius: tapeSwatchRadius,
              backgroundColor: swatch,
              borderWidth: swatchHair ? theme.stroke.thin : 0,
              borderColor: swatchHair,
              marginRight: theme.layout.iconTextGap,
              transform: [{ scale: pop }],
            }}
          />
        ) : null}
        {icon ? (
          <Animated.View style={{ marginRight: theme.layout.iconTextGap, transform: [{ scale: iconScale }] }}>
            <Ionicons name={selected && iconSelected ? iconSelected : icon} size={glyph} color={c[textColor]} />
          </Animated.View>
        ) : null}
        <View style={{ flexShrink: 1 }}>
          {/* invisible bold copy reserves the widest width */}
          <AppText variant={textVariant} weight="600" numberOfLines={1} style={{ opacity: 0 }} accessibilityElementsHidden importantForAccessibility="no">
            {label}
          </AppText>
          <AppText
            variant={textVariant}
            weight={selected ? '600' : '400'}
            color={textColor}
            numberOfLines={1}
            style={{ position: 'absolute', left: 0, right: 0, textAlign: 'center' }}
          >
            {label}
          </AppText>
        </View>
        {variant === 'filter' ? (
          <Ionicons name={ICON.dropdown.outline} size={theme.iconSize.sm} color={c[textColor]} style={{ marginLeft: theme.layout.iconTextGap }} />
        ) : null}
      </View>
    </PressableScale>
  );

  if (variant !== 'filter') return chip;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1 }}>
      <View style={{ flexShrink: 1 }}>{chip}</View>
      <ClearButton visible={showClear} onPress={onClear} accessibilityLabel={clearAccessibilityLabel ?? ''} />
    </View>
  );
}

/** Separate clear IconButton: grips in (scale 0.6 -> 1 + fade), `short` + `exit` out. Collapses when gone. */
function ClearButton({ visible, onPress, accessibilityLabel }: { visible: boolean; onPress?: () => void; accessibilityLabel: string }): React.JSX.Element | null {
  const { theme } = useTheme();
  const { duration, spring, reduceMotion } = useMotion();
  const [mounted, setMounted] = useState(visible);
  const p = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const grow = useRef(new Animated.Value(visible ? 1 : 0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.timing(p, { toValue: 1, duration: duration.micro, easing: bezierFor('standard'), useNativeDriver: USE_NATIVE_DRIVER }),
        reduceMotion
          ? Animated.timing(grow, { toValue: 1, duration: duration.micro, useNativeDriver: USE_NATIVE_DRIVER })
          : Animated.spring(grow, { toValue: 1, ...spring.grip, ...SPRING_REST, useNativeDriver: USE_NATIVE_DRIVER }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(p, { toValue: 0, duration: duration.short, easing: bezierFor('exit'), useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(grow, { toValue: 0, duration: duration.short, easing: bezierFor('exit'), useNativeDriver: USE_NATIVE_DRIVER }),
      ]).start(() => setMounted(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!mounted) return null;
  return (
    <Animated.View
      style={{
        opacity: p,
        transform: reduceMotion ? [] : [{ scale: grow.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
      }}
    >
      <IconButton
        name={ICON.clear.filled}
        size={theme.iconSize.md}
        color="textSecondary"
        on="background"
        onPress={() => onPress?.()}
        accessibilityLabel={accessibilityLabel}
      />
    </Animated.View>
  );
}
