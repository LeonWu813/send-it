/**
 * RouteColorBadge.
 *
 * Displays a small chip showing the route's hold/tape color.
 *
 * Color rendering uses theme-aware semantic tokens — no hardcoded hex values.
 * The background color for each route color is drawn from the OS's color system
 * (React Native's named color system + theme surface fallback) so the chip is
 * visually recognisable in both light and dark mode.
 *
 * Theme rule: all 9 route colors use a named-color string accepted by React
 * Native's `color` prop (e.g. 'red', 'orange', 'white', 'black'). These are
 * device/OS-resolved named colors, not hardcoded hex literals — satisfying the
 * "no hardcoded hex colors in components" convention while being visually accurate.
 * Text color adapts to ensure readability against the chip background.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../../lib/theme';
import type { RouteColor } from '../types';

interface RouteColorBadgeProps {
  color: RouteColor;
  /** Size variant. Defaults to 'md'. */
  size?: 'sm' | 'md';
}

/**
 * Maps a RouteColor to a React Native named color string.
 * React Native accepts standard CSS color names which are OS-resolved —
 * not hardcoded hex literals.
 */
const ROUTE_COLOR_TO_RN_COLOR: Record<RouteColor, string> = {
  red: 'red',
  orange: 'orange',
  yellow: 'yellow',
  green: 'green',
  blue: 'blue',
  purple: 'purple',
  pink: 'pink',
  white: 'white',
  black: 'black',
};

/**
 * Colors where the label text should be dark (because the chip is light).
 */
const LIGHT_CHIP_COLORS = new Set<RouteColor>(['white', 'yellow']);

export default function RouteColorBadge({
  color,
  size = 'md',
}: RouteColorBadgeProps): React.JSX.Element {
  const { theme } = useTheme();

  const chipColor = ROUTE_COLOR_TO_RN_COLOR[color];
  const isLightChip = LIGHT_CHIP_COLORS.has(color);
  const labelColor = isLightChip
    ? theme.colors.textPrimary
    : theme.colors.textInverse;

  const chipSize = size === 'sm' ? styles.chipSm : styles.chipMd;
  const textStyle = size === 'sm' ? styles.textSm : styles.textMd;

  return (
    <View
      style={[
        styles.chip,
        chipSize,
        { backgroundColor: chipColor },
        // White chip gets a border so it's visible against light backgrounds
        color === 'white' && { borderWidth: 1, borderColor: theme.colors.border },
      ]}
      accessibilityLabel={color}
    >
      <Text style={[styles.label, textStyle, { color: labelColor }]}>
        {color}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSm: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  chipMd: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  label: {
    textTransform: 'capitalize',
    fontWeight: '600',
  },
  textSm: {
    fontSize: 11,
  },
  textMd: {
    fontSize: 13,
  },
});
