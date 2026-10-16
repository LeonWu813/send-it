import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { USE_NATIVE_DRIVER, useMotion } from '../../lib/motion';
import { useTheme } from '../../lib/theme';
import type { PaletteKey } from '../../lib/theme';
import { AppText } from './AppText';
import { PressableScale } from './PressableScale';

export type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'ghost';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  /** Spinner cross-fades in over the label; the button is not pressable while loading. */
  loading?: boolean;
  disabled?: boolean;
  /** Stretch to the container width. */
  fullWidth?: boolean;
  /** Primary buttons default to minHeight 50, the others to 44. */
  minHeight?: number;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

const COLORS: Record<ButtonVariant, { bg: PaletteKey | null; fg: PaletteKey; pressed: PaletteKey }> = {
  primary: { bg: 'primary', fg: 'onPrimary', pressed: 'primaryPressed' },
  secondary: { bg: 'surfaceAlt', fg: 'textPrimary', pressed: 'surfacePressed' },
  destructive: { bg: 'error', fg: 'onError', pressed: 'errorPressed' },
  ghost: { bg: null, fg: 'primary', pressed: 'surfacePressed' },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  loading = false,
  disabled = false,
  fullWidth,
  minHeight,
  accessibilityLabel,
  style,
}: ButtonProps): React.JSX.Element {
  const { theme } = useTheme();
  const { duration } = useMotion();
  const c = theme.colors;
  const spec = COLORS[variant];
  const inactive = disabled || loading;
  const spin = useRef(new Animated.Value(loading ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(spin, { toValue: loading ? 1 : 0, duration: duration.short, useNativeDriver: USE_NATIVE_DRIVER }).start();
  }, [loading, spin, duration.short]);

  // Destructive buttons always carry an icon.
  const iconName = icon ?? (variant === 'destructive' ? 'trash-outline' : undefined);
  const fg = disabled ? c.textDisabled : c[spec.fg];
  const bg = disabled ? (spec.bg === null ? undefined : c.primaryDisabled) : spec.bg ? c[spec.bg] : undefined;

  return (
    <PressableScale
      onPress={onPress}
      disabled={inactive}
      pressedColor={inactive ? undefined : c[spec.pressed]}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={[
        {
          minHeight: minHeight ?? (variant === 'primary' ? theme.componentSize.buttonPrimaryMinHeight : theme.componentSize.buttonMinHeight),
          borderRadius: theme.borderRadius.lg,
          paddingHorizontal: theme.spacing.md,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: bg,
          overflow: 'hidden',
        },
        fullWidth ? { alignSelf: 'stretch' } : { alignSelf: 'flex-start' },
        style,
      ]}
    >
      <Animated.View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          opacity: spin.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
        }}
      >
        {iconName ? (
          <Ionicons
            name={iconName}
            size={theme.iconSize.md}
            color={fg}
            style={{ marginRight: theme.layout.iconTextGapInButton }}
          />
        ) : null}
        <AppText variant="callout" weight="600" style={{ color: fg }}>
          {label}
        </AppText>
      </Animated.View>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.center, { opacity: spin }]}>
        <View>
          <ActivityIndicator color={fg} />
        </View>
      </Animated.View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({ center: { alignItems: 'center', justifyContent: 'center' } });
