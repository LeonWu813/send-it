import React from 'react';
import { Text } from 'react-native';
import type { TextProps } from 'react-native';

import i18n from '../../lib/i18n';
import { useTheme } from '../../lib/theme';
import type { PaletteKey, TypeVariant } from '../../lib/theme';

export type AppTextVariant = TypeVariant | 'groupHeader' | 'pageSection' | 'fieldLabel' | 'sectionHeader';

export interface AppTextProps extends TextProps {
  variant?: AppTextVariant;
  /** Palette key. Defaults to textPrimary (sectionHeader: textSecondary). */
  color?: PaletteKey;
  /** Emphasis only (400/500/600). 700/800 come from a role (title1, display) or tapeLabel, never from here. */
  weight?: '400' | '500' | '600';
  /** tabular-nums for numbers. */
  numeric?: boolean;
  align?: 'left' | 'center' | 'right';
}

/** Wraps fontSize / lineHeight / weight / maxFontSizeMultiplier. Do not use Text.defaultProps. */
export function AppText({
  variant = 'body',
  color,
  weight,
  numeric,
  align,
  style,
  maxFontSizeMultiplier,
  ...rest
}: AppTextProps): React.JSX.Element {
  const { theme } = useTheme();
  const isSection = variant === 'sectionHeader' || variant === 'groupHeader';
  const derived =
    isSection
      ? theme.typeVariant.groupHeader
      : variant === 'pageSection'
        ? theme.typeVariant.pageSection
        : variant === 'fieldLabel'
          ? theme.typeVariant.fieldLabel
          : null;
  const base = theme.typeScale[derived ? derived.base : (variant as TypeVariant)];
  const isEn = i18n.language === 'en';
  const resolvedColor = theme.colors[color ?? (derived ? derived.color : 'textPrimary')];
  return (
    <Text
      {...rest}
      maxFontSizeMultiplier={maxFontSizeMultiplier ?? base.maxFontSizeMultiplier}
      style={[
        {
          fontSize: base.fontSize,
          lineHeight: base.lineHeight,
          fontWeight: weight ?? (derived ? derived.fontWeight : base.fontWeight),
          color: resolvedColor,
          letterSpacing: 0,
        },
        isSection && isEn
          ? { textTransform: 'uppercase', letterSpacing: theme.typeVariant.groupHeader.enLetterSpacing }
          : null,
        numeric ? { fontVariant: theme.typeVariant.numeric.fontVariant } : null,
        align ? { textAlign: align } : null,
        style,
      ]}
    />
  );
}
