/**
 * RouteColorBadge (TapeBadge), design system v1.2 chapter 17 / 32.2.
 *
 * Route tape colour label: the only square-cornered (radius sm) label with text.
 * Fill / label / hairline come from `TAPE_DISPLAY` / `TAPE_HAIR` (display only; stored colour
 * names are unchanged). Colour names go through i18n. Static: not pressable, no motion.
 * Unknown colours render `surfaceAlt` / `textPrimary` / hairline with the "Other" label.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText } from '../../../components/ui';
import { useTheme } from '../../../lib/theme';
import { TAPE_HAIR, resolveTape } from '../tape';
import type { RouteColor } from '../types';

interface RouteColorBadgeProps {
  /** Stored colour name. Anything outside the 9-colour enum is shown as "Other". */
  color: RouteColor | (string & {});
  /** Size variant. Defaults to 'md'. */
  size?: 'sm' | 'md';
}

/** Fill / hairline for the 11x11 tape swatch (colour-filter chip, thumbnail dot). */
export function useTapeSwatch(color: string): { fill: string; hair?: string } {
  const { theme } = useTheme();
  const mode = theme.isDark ? 'dark' : 'light';
  const tape = resolveTape(mode, color);
  if (!tape.known) return { fill: theme.colors.surfaceAlt, hair: TAPE_HAIR[mode] };
  return { fill: tape.entry.fill, hair: tape.entry.hair ? TAPE_HAIR[mode] : undefined };
}

export default function RouteColorBadge({
  color,
  size = 'md',
}: RouteColorBadgeProps): React.JSX.Element {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const mode = theme.isDark ? 'dark' : 'light';
  const tape = resolveTape(mode, color);

  const fill = tape.known ? tape.entry.fill : theme.colors.surfaceAlt;
  const labelColor = tape.known ? tape.entry.label : theme.colors.textPrimary;
  const hasHair = tape.known ? !!tape.entry.hair : true;

  const name = t(`routeCatalog.colors.${tape.known ? color : 'other'}`);

  return (
    <View
      accessible
      accessibilityLabel={t('routeCatalog.tapeLabel', { color: name })}
      style={[
        styles.chip,
        {
          backgroundColor: fill,
          borderRadius: theme.borderRadius.sm,
          paddingHorizontal: theme.componentSize.tapePadH[size],
          paddingVertical: size === 'sm' ? theme.spacing.xxs : theme.spacing.xs,
        },
      ]}
    >
      <AppText variant="caption1" weight="600" style={{ color: labelColor }} numberOfLines={1}>
        {name}
      </AppText>
      {hasHair ? (
        // Overlay so the 1pt hairline never changes the 22 / 26 visual height.
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              borderWidth: theme.stroke.thin,
              borderColor: TAPE_HAIR[mode],
              borderRadius: theme.borderRadius.sm,
            },
          ]}
        />
      ) : null}
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
