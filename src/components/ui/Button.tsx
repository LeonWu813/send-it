import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import type { IoniconName } from '../../lib/icons';
import { USE_NATIVE_DRIVER, bezierFor, useMotion } from '../../lib/motion';
import { useTheme } from '../../lib/theme';
import type { PaletteKey } from '../../lib/theme';
import { AppText } from './AppText';
import { PressableScale } from './PressableScale';

export type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'destructiveTonal' | 'ghost';
export type ButtonSize = 'lg' | 'md' | 'sm';
/** Which surface the button sits on; decides the ghost pressed colour (design system §8.5). */
export type OnSurface = 'surface' | 'background' | 'media' | 'tinted';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  /** lg = 52 (primary default, sheet actions, forms; headline), md = 44 (callout), sm = 32 (+6 hitSlop; footnote). All capsules. */
  size?: ButtonSize;
  /**
   * Surface under the button. Only ghost changes: surface -> surfacePressed wash, background ->
   * surfaceAltPressed wash, media -> mediaScrimStrong wash, tinted -> no wash, label turns primaryPressed.
   * Secondary always presses to surfaceAltPressed.
   */
  on?: OnSurface;
  /** Leading icon (use `ICON.*` glyphs). Optional on every variant. */
  icon?: IoniconName;
  /** Trailing icon, only for link-style ghost buttons (`ICON.forward.outline`, `ICON.external.outline`). */
  trailingIcon?: IoniconName;
  /** Spinner cross-fades in over the label; width is locked and the button is not pressable. */
  loading?: boolean;
  disabled?: boolean;
  /** Stretch to the container width. */
  fullWidth?: boolean;
  /** Override minHeight (rare; prefer `size`). */
  minHeight?: number;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}

const COLORS: Record<ButtonVariant, { bg: PaletteKey | null; fg: PaletteKey; pressed: PaletteKey }> = {
  primary: { bg: 'primary', fg: 'onPrimary', pressed: 'primaryPressed' },
  secondary: { bg: 'surfaceAlt', fg: 'textPrimary', pressed: 'surfaceAltPressed' },
  destructive: { bg: 'error', fg: 'onError', pressed: 'errorPressed' },
  destructiveTonal: { bg: 'surfaceAlt', fg: 'error', pressed: 'surfaceAltPressed' },
  ghost: { bg: null, fg: 'primary', pressed: 'surfacePressed' },
};

const GHOST_PRESSED: Record<OnSurface, PaletteKey | null> = {
  surface: 'surfacePressed',
  background: 'surfaceAltPressed',
  media: 'mediaScrimStrong',
  tinted: null,
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size,
  on = 'surface',
  icon,
  trailingIcon,
  loading = false,
  disabled = false,
  fullWidth,
  minHeight,
  accessibilityLabel,
  accessibilityHint,
  style,
}: ButtonProps): React.JSX.Element {
  const { theme } = useTheme();
  const { duration } = useMotion();
  const c = theme.colors;
  const spec = COLORS[variant];
  const inactive = disabled || loading;
  const spin = useRef(new Animated.Value(loading ? 1 : 0)).current;
  const [pressed, setPressed] = useState(false);

  useEffect(() => {
    Animated.timing(spin, {
      toValue: loading ? 1 : 0,
      duration: duration.short,
      easing: bezierFor('standard'),
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, [loading, spin, duration.short]);

  const resolvedSize: ButtonSize = size ?? (variant === 'primary' ? 'lg' : 'md');
  const dims = {
    lg: { minHeight: theme.componentSize.buttonPrimaryMinHeight, padH: theme.spacing.lg, text: 'headline' as const, icon: theme.iconSize.md },
    md: { minHeight: theme.componentSize.buttonMinHeight, padH: theme.spacing.mdl, text: 'callout' as const, icon: theme.iconSize.md },
    sm: { minHeight: theme.componentSize.buttonSmMinHeight, padH: 14, text: 'footnote' as const, icon: theme.iconSize.sm },
  }[resolvedSize];

  const iconName = icon;

  const tintedGhost = variant === 'ghost' && on === 'tinted';
  const pressedKey: PaletteKey | null = variant === 'ghost' ? GHOST_PRESSED[on] : spec.pressed;
  const fgKey: PaletteKey = tintedGhost && pressed ? 'primaryPressed' : spec.fg;
  const fg = disabled ? c.textDisabled : c[fgKey];
  const bg = disabled ? (spec.bg === null ? undefined : c.primaryDisabled) : spec.bg ? c[spec.bg] : undefined;
  const slop = resolvedSize === 'sm' ? Math.max(0, (theme.layout.minTouchTarget - dims.minHeight) / 2) : 0;

  return (
    <PressableScale
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      disabled={inactive}
      hitSlop={slop ? { top: slop, bottom: slop, left: 0, right: 0 } : undefined}
      pressedColor={inactive || !pressedKey ? undefined : c[pressedKey]}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={[
        {
          minHeight: minHeight ?? dims.minHeight,
          borderRadius: theme.radius.full,
          paddingHorizontal: dims.padH,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: bg,
          overflow: 'hidden',
        },
        fullWidth ? { alignSelf: 'stretch' } : { alignSelf: 'flex-start', minWidth: (minHeight ?? dims.minHeight) * 1.5 },
        style,
      ]}
    >
      <Animated.View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: spin.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
        }}
      >
        {iconName ? (
          <Ionicons name={iconName} size={dims.icon} color={fg} style={{ marginRight: theme.layout.iconTextGapInButton }} />
        ) : null}
        <AppText variant={dims.text} weight="600" style={{ color: fg, flexShrink: 1, textAlign: 'center' }} numberOfLines={2}>
          {label}
        </AppText>
        {trailingIcon ? (
          <Ionicons name={trailingIcon} size={dims.icon} color={fg} style={{ marginLeft: theme.layout.iconTextGapInButton }} />
        ) : null}
      </Animated.View>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.center, { opacity: spin }]}>
        <View>
          <ActivityIndicator color={fg} size="small" />
        </View>
      </Animated.View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({ center: { alignItems: 'center', justifyContent: 'center' } });
