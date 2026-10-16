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
import { Card } from './Card';
import { PressableScale } from './PressableScale';
import type { OnSurface } from './Button';

export type EmptyStateVariant = 'slot' | 'prompt' | 'firstUse' | 'filtered' | 'private' | 'inline';

export interface EmptyStateProps {
  /**
   * slot (v2.2): a list region whose shape is known ("Projects"): 1.5pt dashed `outline`, radius 20, the
   * WHOLE card is the pressable (`onPrimary`); `primaryLabel` is a visual `secondary sm` hint, not a
   * separate focus target. prompt: ZERO records: a `primaryContainer` card (eyebrow + title1 + subhead +
   * `primary md`, left aligned), the only prompt / primary on the page. `firstUse` is an alias of prompt.
   * filtered: centred title + [Clear filters] primary. private: lock in a 56 disc + title + description +
   * [Follow]. inline: ONE region of a screen: left-aligned sentence + ghost button.
   */
  variant?: EmptyStateVariant;
  /** Concept glyph (`ICON.route.outline`, `ICON.betaVideo.outline`, ...). private defaults to the lock. No illustrations. */
  icon?: IoniconName;
  /** prompt: small label above the title (`footnote` 600). */
  eyebrow?: string;
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
  variant: variantProp = 'prompt',
  eyebrow,
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
  const variant = variantProp === 'firstUse' ? 'prompt' : variantProp;
  const { fontScale } = useWindowDimensions();
  const appear = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(appear, { toValue: 1, duration: duration.short, easing: bezierFor('enter'), useNativeDriver: USE_NATIVE_DRIVER }).start();
  }, [appear, duration.short]);

  const inline = variant === 'inline';

  if (variant === 'slot') {
    const hint = primaryLabel ? [title, description, primaryLabel].filter(Boolean).join('. ') : [title, description].filter(Boolean).join('. ');
    return (
      <Animated.View style={[{ opacity: appear }, style]}>
        <PressableScale
          feedback="row"
          onPress={onPrimary}
          pressedColor={theme.colors.surfacePressed}
          accessibilityLabel={hint}
          style={{
            borderRadius: theme.radius.card,
            borderCurve: 'continuous',
            borderWidth: theme.stroke.emphasis,
            borderStyle: 'dashed',
            borderColor: theme.colors.outline,
            padding: theme.spacing.mdl,
            alignItems: 'flex-start',
          }}
        >
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ alignSelf: 'stretch' }}>
            {title ? <AppText variant="headline">{title}</AppText> : null}
            {description ? (
              <AppText variant="footnote" color="textSecondary" style={{ marginTop: 2 }}>
                {description}
              </AppText>
            ) : null}
            {primaryLabel ? (
              // visual `secondary sm` hint only: the whole slot is the button (no nested pressable)
              <View
                style={{
                  marginTop: theme.spacing.smd,
                  alignSelf: 'flex-start',
                  minHeight: theme.componentSize.buttonSmMinHeight,
                  paddingHorizontal: 14,
                  borderRadius: theme.radius.full,
                  backgroundColor: theme.colors.surfaceAlt,
                  justifyContent: 'center',
                }}
              >
                <AppText variant="footnote" weight="600">
                  {primaryLabel}
                </AppText>
              </View>
            ) : null}
          </View>
        </PressableScale>
      </Animated.View>
    );
  }

  if (variant === 'prompt') {
    return (
      <Animated.View style={[{ opacity: appear }, style]}>
        <Card variant="tinted" padding={theme.spacing.mdl}>
          <View accessible accessibilityLabel={[eyebrow, title, description].filter(Boolean).join('. ')}>
            {eyebrow ? (
              <AppText variant="footnote" weight="600" color="onPrimaryContainer">
                {eyebrow}
              </AppText>
            ) : null}
            {title ? (
              <AppText variant="title1" color="onPrimaryContainer" numberOfLines={2} accessibilityRole="header" style={{ marginTop: eyebrow ? theme.spacing.xs : 0 }}>
                {title}
              </AppText>
            ) : null}
            {description ? (
              <AppText variant="subhead" color="onPrimaryContainer" style={{ marginTop: theme.spacing.sm }}>
                {description}
              </AppText>
            ) : null}
          </View>
          {primaryLabel ? (
            <View style={{ marginTop: theme.spacing.md, alignSelf: 'flex-start' }}>
              <Button variant="primary" size="md" label={primaryLabel} onPress={() => onPrimary?.()} />
            </View>
          ) : null}
        </Card>
      </Animated.View>
    );
  }

  const glyph = icon ?? (variant === 'private' ? ICON.locked.outline : undefined);
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
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: theme.radius.full,
              backgroundColor: theme.colors.surfaceAlt,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: theme.spacing.smd,
            }}
          >
            <Ionicons name={glyph as IoniconName} size={theme.iconSize.lg} color={theme.colors.textSecondary} />
          </View>
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
