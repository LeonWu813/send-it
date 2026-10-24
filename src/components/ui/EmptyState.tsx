import React, { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { ICON } from '../../lib/icons';
import type { IoniconName } from '../../lib/icons';
import { USE_NATIVE_DRIVER, bezierFor, useMotion } from '../../lib/motion';
import { useTheme } from '../../lib/theme';
import { AppText } from './AppText';
import { Button } from './Button';
import { PressableScale } from './PressableScale';
import type { OnSurface } from './Button';

/** The four empty-state variants (states-audit-ux 1.1). */
export type EmptyStateVariantName = 'page' | 'section' | 'filtered' | 'error';
/**
 * @deprecated aliases kept one version so unmigrated screens keep compiling: `prompt` / `firstUse` /
 * `private` render as `page` (no icon; the lime card and `eyebrow` are retired),
 * `inline` renders as `section`, `slot` still draws the old dashed card (retired; do not use).
 */
export type EmptyStateDeprecatedVariant = 'slot' | 'prompt' | 'firstUse' | 'private' | 'inline';
export type EmptyStateVariant = EmptyStateVariantName | EmptyStateDeprecatedVariant;

/** U+2060 WORD JOINER: zero-width, forbids a break on either side. */
const WORD_JOINER = '\u2060';
/** Keeps a quoted 「…」 term on one line: joins every character inside the brackets (CJK has no spaces to hold on to). */
export function keepQuotedTogether(text: string): string {
  return text.replace(/「([^」]*)」/g, (_m, inner: string) => `「${WORD_JOINER}${Array.from(inner).join(WORD_JOINER)}${WORD_JOINER}」`);
}

const ALIAS: Record<EmptyStateDeprecatedVariant, EmptyStateVariantName | 'slot'> = {
  slot: 'slot',
  prompt: 'page',
  firstUse: 'page',
  private: 'page',
  inline: 'section',
};

export interface EmptyStateProps {
  /**
   * E1 page: the whole screen has no content. Centred, top = content top + 48 (not vertically centred),
   * title2 + subhead + optional primary (hug) + optional ghost link. No icon: the text carries it.
   * E2 section: one region of a populated screen. Left aligned on the keyline: one subhead sentence
   * (`description`) + optional ghost `sm` action under it. No icon, no title, no link.
   * E3 filtered: data exists but the filter / search excluded it. Same layout as E1 (no icon); the primary is "clear filters".
   * E4 error: the page failed to load. Same layout as E1 (no icon, title in the default text colour); the primary is a secondary
   * "Retry" (reload icon) in `primaryLabel` / `onPrimary`. No link.
   * The screen decides which one; see the spec before adding a fifth.
   */
  variant?: EmptyStateVariant;
  /**
   * @deprecated no variant draws an icon any more; ignored (kept so callers compile).
   */
  icon?: IoniconName;
  /** @deprecated retired with the lime prompt card; ignored. */
  eyebrow?: string;
  /** page / filtered / error: what is empty (title2, no full stop). section: omit and put the sentence in `description`. */
  title?: string;
  /** page / filtered / error: one or two lines on what to do (end with a full stop). section: the one sentence. */
  description?: string;
  /** Primary action, hugs its content (md). Section: the single ghost sm action's label is `secondaryLabel`. */
  primaryLabel?: string;
  onPrimary?: () => void;
  /** page / filtered: `secondary` instead of `primary` when another primary is already on the page. error is always secondary. */
  primaryTone?: 'primary' | 'secondary';
  /** Leading icon on the primary action (error defaults to the retry glyph). */
  primaryIcon?: IoniconName;
  /** Ghost action: page / filtered = centred link under the primary; section = the only action, under the sentence. */
  secondaryLabel?: string;
  onSecondary?: () => void;
  /** Surface behind the ghost button (it decides the pressed colour). Default 'background'. */
  on?: OnSurface;
  style?: StyleProp<ViewStyle>;
}

/**
 * Only shown when it is certain there is no data (never while loading). Fades in over `short` (enter).
 * Title + description read as one VoiceOver node. Centred
 * variants centre every child, buttons and link included (each action sits in an `alignSelf: center`
 * wrapper because Button itself is `alignSelf: flex-start`).
 */
export function EmptyState({
  variant: variantProp = 'page',
  title,
  description,
  primaryLabel,
  onPrimary,
  primaryTone = 'primary',
  primaryIcon,
  secondaryLabel,
  onSecondary,
  on = 'background',
  style,
}: EmptyStateProps): React.JSX.Element {
  const { theme } = useTheme();
  const { duration } = useMotion();
  const appear = useRef(new Animated.Value(0)).current;
  const variant = variantProp in ALIAS ? ALIAS[variantProp as EmptyStateDeprecatedVariant] : (variantProp as EmptyStateVariantName);

  useEffect(() => {
    Animated.timing(appear, { toValue: 1, duration: duration.short, easing: bezierFor('enter'), useNativeDriver: USE_NATIVE_DRIVER }).start();
  }, [appear, duration.short]);

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

  if (variant === 'section') {
    return (
      <Animated.View style={[{ paddingVertical: theme.spacing.md, opacity: appear }, style]}>
        <AppText variant="subhead" color="textSecondary">
          {description ?? title}
        </AppText>
        {secondaryLabel ? (
          <View style={{ marginTop: theme.spacing.sm }}>
            <Button variant="ghost" size="sm" on={on} label={secondaryLabel} onPress={() => onSecondary?.()} style={{ marginLeft: -14 }} />
          </View>
        ) : null}
      </Animated.View>
    );
  }

  const isError = variant === 'error';
  const label = [title, description].filter(Boolean).join('. ');
  const primaryVariant = isError ? 'secondary' : primaryTone;

  return (
    <Animated.View
      style={[
        {
          width: '100%',
          alignSelf: 'center',
          alignItems: 'center',
          paddingTop: theme.layout.pageLoadingOffset,
          paddingBottom: theme.spacing.xl,
          opacity: appear,
        },
        style,
      ]}
    >
      <View accessible accessibilityLabel={label} style={{ alignItems: 'center' }}>
        {title ? (
          <AppText variant="title2" align="center" accessibilityRole="header">
            {title}
          </AppText>
        ) : null}
        {description ? (
          <AppText
            variant="subhead"
            color="textSecondary"
            align="center"
            style={{ marginTop: title ? theme.spacing.xs : 0 }}
          >
            {keepQuotedTogether(description)}
          </AppText>
        ) : null}
      </View>
      {primaryLabel ? (
        <View style={{ alignSelf: 'center', marginTop: theme.spacing.lg }}>
          <Button
            variant={primaryVariant}
            size="md"
            label={primaryLabel}
            icon={primaryIcon ?? (isError ? ICON.retry.outline : undefined)}
            onPress={() => onPrimary?.()}
          />
        </View>
      ) : null}
      {secondaryLabel && !isError ? (
        <View style={{ alignSelf: 'center', marginTop: primaryLabel ? theme.spacing.sm : theme.spacing.lg }}>
          <Button variant="ghost" size="md" on={on} label={secondaryLabel} onPress={() => onSecondary?.()} />
        </View>
      ) : null}
    </Animated.View>
  );
}
