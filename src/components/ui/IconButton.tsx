import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import type { IoniconName } from '../../lib/icons';
import { USE_NATIVE_DRIVER, bezierFor, useMotion } from '../../lib/motion';
import { useTheme } from '../../lib/theme';
import type { PaletteKey } from '../../lib/theme';
import { Badge, BadgeAnchor } from './Badge';
import type { OnSurface } from './Button';
import { PressableScale } from './PressableScale';

export type IconButtonVariant = 'plain' | 'toggle' | 'media' | 'tonal' | 'float' | 'small';

export interface IconButtonProps {
  /** Glyph (use `ICON.*`). For `toggle` this is the OFF glyph. */
  name: IoniconName;
  /** `toggle` only: the ON glyph (usually the filled one). Defaults to `name`. */
  nameOn?: IoniconName;
  /** Required: icon-only buttons must have a localized accessibility label describing the action. */
  accessibilityLabel: string;
  accessibilityHint?: string;
  onPress: () => void;
  /**
   * plain: transparent, pressed disc. toggle: two stacked glyphs cross-fade. media: scrim disc, onMedia
   * glyph (visual 32, touch 44). tonal: `surfaceAlt` disc (44 or 52). float: `surface` disc + control
   * shadow (dark: 1pt border), nested-screen back button. small: 30 `surfaceAlt` disc (sheet close,
   * FilterChip clear), touch 44 through hitSlop.
   */
  variant?: IconButtonVariant;
  /** Surface under the button (decides the pressed disc, §8.5). `media` forces 'media'. */
  on?: OnSurface;
  /** Glyph colour (plain / toggle OFF). K2: textPrimary for primary actions, textSecondary for secondary. */
  color?: PaletteKey;
  /** toggle ON colour. Default `primary`. */
  colorOn?: PaletteKey;
  /** tonal only: disc diameter, 44 (default), 52 (next to an `lg` Button) or 32 (inside a row: layout stays 32, touch 44 via hitSlop). */
  diameter?: 32 | 44 | 52;
  /** tonal only: disc colour. `surface` when the button sits inside a `surfaceAlt` container (stepper). */
  tonalBase?: 'surfaceAlt' | 'surface';
  /** Glyph size: md 20 (in-card), lg 24 (header, nav, sheet), xl 28 (Reel). Default lg. */
  size?: number;
  /** toggle: the ON state. Also reported as accessibilityState.selected. */
  selected?: boolean;
  disabled?: boolean;
  /** Press-and-hold hooks (Stepper auto-repeat). */
  onPressIn?: () => void;
  onPressOut?: () => void;
  /** Unread count marker (0 hides it). Put the count in `accessibilityLabel` too. */
  badge?: number;
  /** The badge number arrived live in the foreground: it pops in with `topOut`. */
  badgeLive?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * 44x44 container (never hitSlop), 24pt glyph by default. Pressed: a 44 disc in the colour of the
 * surface it sits on + glyph scale 0.96 (disc never uses opacity). Toggle swaps outline <-> filled
 * by cross-fading two layers in `micro` + `standard` (native driver).
 */
export function IconButton({
  name,
  nameOn,
  accessibilityLabel,
  accessibilityHint,
  onPress,
  variant = 'plain',
  on = 'surface',
  color = 'textPrimary',
  colorOn = 'primary',
  size,
  diameter,
  tonalBase = 'surfaceAlt',
  selected,
  disabled,
  onPressIn,
  onPressOut,
  badge,
  badgeLive,
  style,
}: IconButtonProps): React.JSX.Element {
  const { theme } = useTheme();
  const { duration } = useMotion();
  const c = theme.colors;
  const box = theme.layout.minTouchTarget;
  const sm = theme.componentSize;
  const disc =
    variant === 'small' ? sm.smallButton : variant === 'media' ? sm.mediaButton : variant === 'tonal' ? (diameter ?? box) : box;
  const slop = Math.max(0, (box - disc) / 2);
  const defaultGlyph =
    variant === 'small' ? theme.iconSize.sm : variant === 'media' ? theme.iconSize.md : variant === 'tonal' ? theme.iconSize.md : theme.iconSize.lg;
  const glyph = size ?? defaultGlyph;
  const surface: OnSurface = variant === 'media' ? 'media' : on;
  const [pressed, setPressed] = useState(false);
  const fade = useRef(new Animated.Value(selected ? 1 : 0)).current;

  useEffect(() => {
    if (variant !== 'toggle') return;
    Animated.timing(fade, {
      toValue: selected ? 1 : 0,
      duration: duration.micro,
      easing: bezierFor('standard'),
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, [selected, variant, fade, duration.micro]);

  const pressedDisc: PaletteKey | null =
    variant === 'tonal' || variant === 'small'
      ? 'surfaceAltPressed'
      : variant === 'float'
        ? 'surfacePressed'
        : surface === 'surface' ? 'surfacePressed' : surface === 'background' ? 'surfaceAltPressed' : surface === 'media' ? 'mediaScrimStrong' : null;
  const tintedPressed = surface === 'tinted' && pressed;
  const fixedColor: PaletteKey | null = variant === 'tonal' || variant === 'float' ? 'textPrimary' : variant === 'small' ? 'textSecondary' : null;
  const offColor =
    variant === 'media' ? c.onMedia : disabled ? c.textDisabled : tintedPressed ? c.primaryPressed : c[fixedColor ?? color];
  const onColor = variant === 'media' ? c.onMedia : disabled ? c.textDisabled : c[colorOn];

  // media: the disc swaps between mediaScrim and mediaScrimStrong (no wash, so the two never stack)
  const mediaBg = variant === 'media' ? (pressed ? c.mediaScrimStrong : c.mediaScrim) : undefined;
  const discBg =
    variant === 'tonal'
      ? c[tonalBase]
      : variant === 'small'
        ? c.surfaceAlt
        : variant === 'float'
          ? theme.isDark
            ? c.surfaceElevated
            : c.surface
          : mediaBg;

  return (
    <PressableScale
      onPress={onPress}
      onPressIn={() => {
        setPressed(true);
        onPressIn?.();
      }}
      onPressOut={() => {
        setPressed(false);
        onPressOut?.();
      }}
      disabled={disabled}
      pressedColor={disabled || variant === 'media' || !pressedDisc ? undefined : c[pressedDisc]}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled, selected }}
      hitSlop={slop ? { top: slop, bottom: slop, left: slop, right: slop } : undefined}
      style={[
        {
          width: disc,
          height: disc,
          borderRadius: theme.radius.full,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: discBg,
        },
        variant === 'float'
          ? { ...theme.elevation.control, borderWidth: theme.isDark ? theme.stroke.thin : 0, borderColor: c.border }
          : null,
        style,
      ]}
    >
      {variant === 'toggle' ? (
        <View style={{ width: glyph, height: glyph }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Animated.View style={{ position: 'absolute', opacity: fade.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }}>
            <Ionicons name={name} size={glyph} color={offColor} />
          </Animated.View>
          <Animated.View style={{ position: 'absolute', opacity: fade }}>
            <Ionicons name={nameOn ?? name} size={glyph} color={onColor} />
          </Animated.View>
        </View>
      ) : (
        <Ionicons name={name} size={glyph} color={offColor} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
      )}
      {badge !== undefined ? (
        <BadgeAnchor box={box} glyph={glyph} xs={theme.spacing.xs}>
          <Badge count={badge} live={badgeLive} />
        </BadgeAnchor>
      ) : null}
    </PressableScale>
  );
}

export interface IconButtonGroupItem {
  name: IoniconName;
  accessibilityLabel: string;
  onPress: () => void;
  badge?: number;
}

/**
 * Header action capsule: 96 x 44 (two 44 buttons, 8 between), `float` style. The container is not
 * an accessibility element; each button is. The pressed button shows its own 44 `surfacePressed` disc.
 */
export function IconButtonGroup({ items, style }: { items: [IconButtonGroupItem, IconButtonGroupItem]; style?: StyleProp<ViewStyle> }): React.JSX.Element {
  const { theme } = useTheme();
  const { width, height, gap } = theme.componentSize.headerActionGroup;
  const c = theme.colors;
  return (
    <View
      style={[
        {
          width,
          height,
          flexDirection: 'row',
          columnGap: gap,
          borderRadius: theme.radius.full,
          backgroundColor: theme.isDark ? c.surfaceElevated : c.surface,
          borderWidth: theme.isDark ? theme.stroke.thin : 0,
          borderColor: c.border,
          ...theme.elevation.control,
        },
        style,
      ]}
    >
      {items.map((it) => (
        <IconButton key={it.accessibilityLabel} name={it.name} accessibilityLabel={it.accessibilityLabel} onPress={it.onPress} badge={it.badge} on="surface" size={theme.iconSize.md + 2} />
      ))}
    </View>
  );
}
