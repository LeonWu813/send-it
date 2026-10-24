/**
 * RouteColorBadge (TapeBadge), design system v1.2 chapter 17 / 32.2.
 *
 * Route tape colour label: the only tape-radius (6) label with text; v2.2.
 * Fill / label come from `TAPE_DISPLAY` (no outline on the badge) (display only; stored colour
 * names are unchanged). Colour names go through i18n. Static: not pressable, no motion.
 * Unknown colours render `surfaceAlt` / `textPrimary` with the "Other" label.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../../lib/theme';
import { resolveTape } from '../tape';
import type { RouteColor } from '../types';

interface RouteColorBadgeProps {
  /** Stored colour name. Anything outside the 9-colour enum is shown as "Other". */
  color: RouteColor | (string & {});
  /** Size variant. Defaults to 'md' ('lg' = 34 high grade plate, RouteCard title). */
  size?: 'sm' | 'md' | 'lg';
  /**
   * Grade variant: when set, the tape prints this text (e.g. "V4") instead of the colour name.
   * The accessibility label becomes "V4, red". Without `grade`, the colour name is printed.
   */
  grade?: string;
  /** Kept for call-site compatibility; the badge draws no outline (fill only). */
  onMedia?: boolean;
}

/** Fill for the tape swatch (colour-filter chip, thumbnail dot, picker tile) plus the readable mark colour for a checkmark on it. Fill only, no ring. */
export function useTapeSwatch(color: string): { fill: string; mark: string } {
  const { theme } = useTheme();
  const mode = theme.isDark ? 'dark' : 'light';
  const tape = resolveTape(mode, color);
  if (!tape.known) return { fill: theme.colors.surfaceAlt, mark: theme.colors.textPrimary };
  return { fill: tape.entry.fill, mark: tape.entry.label };
}

export default function RouteColorBadge({
  color,
  size = 'md',
  grade,
}: RouteColorBadgeProps): React.JSX.Element {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const mode = theme.isDark ? 'dark' : 'light';
  const tape = resolveTape(mode, color);

  const fill = tape.known ? tape.entry.fill : theme.colors.surfaceAlt;
  const labelColor = tape.known ? tape.entry.label : theme.colors.textPrimary;

  const name = t(`routeCatalog.colors.${tape.known ? color : 'other'}`);
  const tl = theme.typeVariant.tapeLabel[size];
  const text = grade ?? name;
  const label = grade
    ? `${grade}, ${name}`
    : t('routeCatalog.tapeLabel', { color: name });

  return (
    <View
      accessible
      accessibilityLabel={label}
      style={[
        styles.chip,
        {
          backgroundColor: fill,
          borderRadius: theme.radius.tape,
          minHeight: theme.componentSize.tapeHeight[size],
          paddingHorizontal: theme.componentSize.tapePadH[size],
        },
      ]}
    >
      <Text
        numberOfLines={1}
        maxFontSizeMultiplier={tl.maxFontSizeMultiplier}
        style={[
          {
            fontSize: tl.fontSize,
            lineHeight: tl.lineHeight,
            fontWeight: tl.fontWeight,
            color: labelColor,
            letterSpacing: 0,
          },
          grade ? { fontVariant: theme.typeVariant.numeric.fontVariant } : null,
        ]}
      >
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
