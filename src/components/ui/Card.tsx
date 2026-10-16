import React from 'react';
import { View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { useTheme } from '../../lib/theme';
import { PressableScale } from './PressableScale';

export type CardVariant = 'static' | 'pressable' | 'elevated';

export interface CardProps {
  /**
   * static: display only (StatsPanel). pressable: whole card navigates (RouteCard), colour wash only,
   * never scales. elevated: floating card (surfaceElevated; celebration card).
   */
  variant?: CardVariant;
  /** Inner padding. Default `cardPadding` (16); RouteCard uses 12 (`smd`). */
  padding?: number;
  onPress?: () => void;
  /** pressable inside a ScrollView / FlatList: delays the pressed state by 50ms. */
  inScroll?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

/**
 * `lg` radius container. Light theme: soft shadow, NO border (raised shadow for elevated). Dark
 * theme: 1pt `border`, NO shadow (ELEVATION resolves to none in dark). Pressed = surfacePressed.
 * Margins belong to the parent (`gap: cardGap`), never to the card. Interactive children must be
 * siblings of a pressable card's body, not nested inside it.
 */
export function Card({
  variant = 'static',
  padding,
  onPress,
  inScroll,
  accessibilityLabel,
  accessibilityHint,
  style,
  children,
}: CardProps): React.JSX.Element {
  const { theme } = useTheme();
  const c = theme.colors;
  const elevated = variant === 'elevated';
  const base: ViewStyle = {
    backgroundColor: elevated ? c.surfaceElevated : c.surface,
    borderRadius: theme.borderRadius.lg,
    padding: padding ?? theme.layout.cardPadding,
    borderWidth: theme.isDark ? theme.stroke.thin : 0,
    borderColor: c.border,
    ...theme.elevation[elevated ? 'raised' : 'card'],
  };

  if (variant === 'pressable' && onPress) {
    return (
      <PressableScale
        feedback="row"
        inScroll={inScroll}
        onPress={onPress}
        pressedColor={c.surfacePressed}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        style={[base, style]}
      >
        {children}
      </PressableScale>
    );
  }
  return (
    <View accessibilityLabel={accessibilityLabel} style={[base, style]}>
      {children}
    </View>
  );
}
