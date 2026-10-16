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

export type IconButtonVariant = 'plain' | 'toggle' | 'media';

export interface IconButtonProps {
  /** Glyph (use `ICON.*`). For `toggle` this is the OFF glyph. */
  name: IoniconName;
  /** `toggle` only: the ON glyph (usually the filled one). Defaults to `name`. */
  nameOn?: IoniconName;
  /** Required: icon-only buttons must have a localized accessibility label describing the action. */
  accessibilityLabel: string;
  accessibilityHint?: string;
  onPress: () => void;
  /** plain: transparent, pressed disc. toggle: two stacked glyphs cross-fade. media: scrim disc, onMedia glyph. */
  variant?: IconButtonVariant;
  /** Surface under the button (decides the pressed disc, §8.5). `media` forces 'media'. */
  on?: OnSurface;
  /** Glyph colour (plain / toggle OFF). K2: textPrimary for primary actions, textSecondary for secondary. */
  color?: PaletteKey;
  /** toggle ON colour. Default `primary`. */
  colorOn?: PaletteKey;
  /** Glyph size: md 20 (in-card), lg 24 (header, nav, sheet), xl 28 (Reel). Default lg. */
  size?: number;
  /** toggle: the ON state. Also reported as accessibilityState.selected. */
  selected?: boolean;
  disabled?: boolean;
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
  selected,
  disabled,
  badge,
  badgeLive,
  style,
}: IconButtonProps): React.JSX.Element {
  const { theme } = useTheme();
  const { duration } = useMotion();
  const c = theme.colors;
  const box = theme.layout.minTouchTarget;
  const glyph = size ?? theme.iconSize.lg;
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
    surface === 'surface' ? 'surfacePressed' : surface === 'background' ? 'surfaceAltPressed' : surface === 'media' ? 'mediaScrimStrong' : null;
  const tintedPressed = surface === 'tinted' && pressed;
  const offColor = variant === 'media' ? c.onMedia : disabled ? c.textDisabled : tintedPressed ? c.primaryPressed : c[color];
  const onColor = variant === 'media' ? c.onMedia : disabled ? c.textDisabled : c[colorOn];

  // media: the disc swaps between mediaScrim and mediaScrimStrong (no wash, so the two never stack)
  const mediaBg = variant === 'media' ? (pressed ? c.mediaScrimStrong : c.mediaScrim) : undefined;

  return (
    <PressableScale
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      disabled={disabled}
      pressedColor={disabled || variant === 'media' || !pressedDisc ? undefined : c[pressedDisc]}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled, selected }}
      style={[
        {
          width: box,
          height: box,
          borderRadius: theme.borderRadius.full,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: mediaBg,
        },
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
