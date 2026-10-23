import React from 'react';
import { View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { useTheme } from '../../lib/theme';
import { PressableScale } from './PressableScale';

export type CardVariant = 'static' | 'pressable' | 'elevated' | 'tinted';

export interface CardProps {
  /**
   * static: display only (StatsPanel). pressable: whole card navigates (RouteCard), colour wash only,
   * never scales. elevated: floating card (surfaceElevated; celebration card, upload modal). tinted:
   * `primaryContainer` fill, no shadow / border (StatsPanel primary block, EmptyState prompt).
   */
  variant?: CardVariant;
  /** Inner padding. Default `cardPadding` (16); RouteCard uses `layout.routeCardPadding` (8). */
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
 * `card` (20, continuous) radius container. Super Flat: light theme = white surface only, NO border, NO shadow (raised shadow only for elevated). Dark
 * theme: 1pt `border`, NO shadow. Pressed = surfacePressed.
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
  const tinted = variant === 'tinted';
  const base: ViewStyle = {
    backgroundColor: tinted ? c.primaryContainer : elevated ? c.surfaceElevated : c.surface,
    borderRadius: theme.radius.card,
    borderCurve: 'continuous',
    padding: padding ?? theme.layout.cardPadding,
    borderWidth: theme.isDark && !tinted ? theme.stroke.thin : 0,
    borderColor: c.border,
    ...(elevated ? theme.elevation.raised : null),
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
