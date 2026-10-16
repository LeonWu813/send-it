import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { Animated, View, useWindowDimensions } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { ICON } from '../../lib/icons';
import type { IoniconName } from '../../lib/icons';
import { USE_NATIVE_DRIVER, bezierFor, useMotion } from '../../lib/motion';
import { useTheme } from '../../lib/theme';
import { AppText } from './AppText';
import { Button } from './Button';
import type { OnSurface } from './Button';

export type EmptyStateVariant = 'firstUse' | 'filtered' | 'private' | 'inline';

export interface EmptyStateProps {
  /**
   * firstUse: fills the whole screen, centred, icon + title + description + primary. filtered: centred,
   * title + [Clear filters] primary + optional ghost. private: centred, lock icon + title + description +
   * [Follow]. inline: ONE region of a screen: left-aligned sentence + ghost button, no icon, never primary.
   */
  variant?: EmptyStateVariant;
  /** Concept glyph (`ICON.route.outline`, `ICON.betaVideo.outline`, ...). private defaults to the lock. No illustrations. */
  icon?: IoniconName;
  /** Centred variants: what is empty (title2). inline: omit and put the sentence in `description`. */
  title?: string;
  /** One or two lines: what the user can do about it. */
  description?: string;
  /** Primary action (centred variants only; fills the width, lg). */
  primaryLabel?: string;
  onPrimary?: () => void;
  /** Ghost action (centred: under the primary; inline: the only action). */
  secondaryLabel?: string;
  onSecondary?: () => void;
  /** Surface behind the ghost button (it decides the pressed colour). Default 'background'. */
  on?: OnSurface;
  style?: StyleProp<ViewStyle>;
}

/**
 * Only shown when it is certain there is no data (never while loading, never on error). Fades in over
 * `short` (enter). Title + description read as one VoiceOver node. At font scale >= 1.6 the icon is hidden.
 */
export function EmptyState({
  variant = 'firstUse',
  icon,
  title,
  description,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
  on = 'background',
  style,
}: EmptyStateProps): React.JSX.Element {
  const { theme } = useTheme();
  const { duration } = useMotion();
  const { fontScale } = useWindowDimensions();
  const appear = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(appear, { toValue: 1, duration: duration.short, easing: bezierFor('enter'), useNativeDriver: USE_NATIVE_DRIVER }).start();
  }, [appear, duration.short]);

  const inline = variant === 'inline';
  const glyph = icon ?? (variant === 'private' ? ICON.locked.outline : variant === 'filtered' ? ICON.filter.outline : undefined);
  const showIcon = !!glyph && !inline && fontScale < 1.6;
  const label = [title, description].filter(Boolean).join('. ');

  if (inline) {
    return (
      <Animated.View style={[{ paddingVertical: theme.spacing.md, opacity: appear }, style]}>
        <AppText variant="subhead" color="textSecondary">
          {description ?? title}
        </AppText>
        {secondaryLabel ? (
          <View style={{ marginTop: theme.spacing.sm }}>
            <Button variant="ghost" size="md" on={on} label={secondaryLabel} onPress={() => onSecondary?.()} style={{ marginLeft: -theme.spacing.md }} />
          </View>
        ) : null}
      </Animated.View>
    );
  }

  return (
    <Animated.View
      style={[
        {
          width: '100%',
          maxWidth: theme.componentSize.emptyStateMaxWidth,
          alignSelf: 'center',
          alignItems: 'center',
          paddingVertical: theme.spacing.xl,
          opacity: appear,
        },
        style,
      ]}
    >
      <View accessible accessibilityLabel={label} style={{ alignItems: 'center' }}>
        {showIcon ? (
          <Ionicons
            name={glyph as IoniconName}
            size={theme.iconSize.xl}
            color={theme.colors.textSecondary}
            style={{ marginBottom: theme.spacing.smd }}
          />
        ) : null}
        {title ? (
          <AppText variant="title2" align="center" accessibilityRole="header">
            {title}
          </AppText>
        ) : null}
        {description ? (
          <AppText variant="subhead" color="textSecondary" align="center" style={{ marginTop: title ? theme.spacing.xs : 0 }}>
            {description}
          </AppText>
        ) : null}
      </View>
      {primaryLabel || secondaryLabel ? (
        <View style={{ alignSelf: 'stretch', marginTop: theme.spacing.lg }}>
          {primaryLabel ? <Button variant="primary" size="lg" fullWidth label={primaryLabel} onPress={() => onPrimary?.()} /> : null}
          {secondaryLabel ? (
            <View style={{ marginTop: primaryLabel ? theme.spacing.sm : 0, alignItems: 'center' }}>
              <Button variant="ghost" size="md" on={on} label={secondaryLabel} onPress={() => onSecondary?.()} />
            </View>
          ) : null}
        </View>
      ) : null}
    </Animated.View>
  );
}
