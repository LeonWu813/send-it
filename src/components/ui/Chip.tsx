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
  /** Tape swatch fill (14x14, radius `minor`) for colour filters. Pops when the chip becomes selected. */
  swatch?: string;
  /** Surface the chip sits on: `background` (default, chip = surface) or `surface` (chip = surfaceAlt). */
  on?: 'background' | 'surface';
  /** Leading glyph (sm 16; md 20 for size="large"). */
  icon?: IoniconName;
  /** Glyph used while selected (e.g. filled variant). Defaults to `icon`. */
  iconSelected?: IoniconName;
  /** The glyph scales 0.6 -> 1 (`grip`) when it becomes selected (send-style picker). */
  iconPop?: boolean;
  /**
   * default: 36pt chip (+4pt hitSlop top/bottom), `subhead` 500. large: minHeight 44, md glyph;
   * for equal-width choice rows, set `style={{ flex: 1 }}`.
   */
  size?: 'default' | 'large';
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Capsule, visual height 36 (`chipHeight`) with vertical hitSlop so the touch height is >= 44. Space
 * chips with `columnGap` 8 / `rowGap` 8. Selected = INVERTED (textPrimary fill, `background` text);
 * no outline, no bold copy, weight 500 in both states. Fill AND text colour are two stacked layers
 * driven by one Animated.Value (`micro` + `standard`, opacity only) so light text never lands on a light
 * fill. Pressed: unselected `surfaceAltPressed`, selected `textSecondary`. `primary` is never used here.
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
  on = 'background',
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

  const { chipHeight, tapeSwatch } = theme.componentSize;
  const large = size === 'large';
  const height = large ? theme.layout.minTouchTarget : chipHeight;
  const slop = large ? 0 : Math.max(0, (theme.layout.minTouchTarget - chipHeight) / 2);
  const glyph = large ? theme.iconSize.md : theme.iconSize.sm;
  const textVariant = 'subhead';
  const offText = disabled ? 'textDisabled' : 'textPrimary';
  const onText = disabled ? 'textDisabled' : 'background';
  const textColor = selected ? onText : offText;
  const role = variant === 'choice' ? 'radio' : variant === 'multi' ? 'checkbox' : 'button';
  const showClear = variant === 'filter' && selected && !!onClear;

  const chip = (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={role}
      hitSlop={{ top: slop, bottom: slop, left: 0, right: 0 }}
      pressedColor={disabled ? undefined : selected ? c.textSecondary : c.surfaceAltPressed}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={variant === 'filter' ? { selected, disabled } : { checked: selected, disabled }}
      underlay={
        <>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: on === 'surface' ? c.surfaceAlt : c.surface }]} />
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: c.textPrimary, opacity: disabled ? 0 : fill }]} />
        </>
      }
      style={[{ borderRadius: theme.radius.full, overflow: 'hidden' }, style]}
    >
      <View
        style={{
          minHeight: height,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 14,
        }}
      >
        {swatch ? (
          <Animated.View
            style={{
              width: tapeSwatch,
              height: tapeSwatch,
              borderRadius: theme.radius.minor,
              backgroundColor: swatch,
              marginRight: 6,
              transform: [{ scale: pop }],
            }}
          >
            {/* selected: 1pt `background` ring fades in (keeps black tape visible on the black fill) */}
            <Animated.View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                { borderRadius: theme.radius.minor, borderWidth: theme.stroke.thin, borderColor: c.background, opacity: fill },
              ]}
            />
          </Animated.View>
        ) : null}
        {icon ? (
          <Animated.View style={{ marginRight: 6, transform: [{ scale: iconScale }] }}>
            <Ionicons name={selected && iconSelected ? iconSelected : icon} size={glyph} color={c[textColor]} />
          </Animated.View>
        ) : null}
        <View style={{ flexShrink: 1 }}>
          <AppText variant={textVariant} weight="500" color={offText} numberOfLines={1}>
            {label}
          </AppText>
          <Animated.View
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{ position: 'absolute', left: 0, right: 0, opacity: disabled ? 0 : fill }}
          >
            <AppText variant={textVariant} weight="500" color={onText} numberOfLines={1}>
              {label}
            </AppText>
          </Animated.View>
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
        marginLeft: theme.spacing.sm,
        opacity: p,
        transform: reduceMotion ? [] : [{ scale: grow.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
      }}
    >
      <IconButton
        variant="small"
        name={ICON.close.outline}
        onPress={() => onPress?.()}
        accessibilityLabel={accessibilityLabel}
      />
    </Animated.View>
  );
}
