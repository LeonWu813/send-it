import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, View, useWindowDimensions } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { ICON } from '../../lib/icons';
import { USE_NATIVE_DRIVER, bezierFor, useMotion } from '../../lib/motion';
import { useTheme } from '../../lib/theme';
import { AppText } from './AppText';
import { Button } from './Button';

export type InlineErrorVariant = 'field' | 'block' | 'notice' | 'warning';

export interface InlineErrorProps {
  /**
   * field: under a TextField (icon sm + footnote, no container). block: replaces a region's content, or
   * sits above a sheet's primary action: `surface` card (radius 20) on the page, `surfaceAlt` radius 12
   * in a sheet (`on="elevated"`); red icon + headline title + description, the action `sm` on the same
   * row. notice: NEUTRAL heads-up (`surfaceAlt`, radius 12, info icon). warning: a real warning
   * (`noticeContainer`, warning icon). No colour bars. Prefer <NoticeBox>.
   */
  variant?: InlineErrorVariant;
  /** block: bold title ("Route failed to load"); `message` then becomes the description under it. */
  title?: string;
  /** Already-translated, human sentence: what happened + what to do. Never `err.message`. */
  message: string;
  /** `sm` action: Retry / Open Settings / Choose another. Same row as the text; under it at font scale >= 1.6. */
  actionLabel?: string;
  onAction?: () => void;
  actionLoading?: boolean;
  /** block only: the surface it sits on (page card = surface, inside a BottomSheet = elevated). */
  on?: 'surface' | 'elevated';
  /** notice only (legacy): same as variant="warning". */
  warning?: boolean;
  /** Announce to VoiceOver on appear (default true for field and block). */
  announce?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Error shown next to where it happened: always icon + text, never an Alert. Fades in (`short`,
 * `enter`). Haptic `error` and any shake are the caller's job (see useShake()).
 */
export function InlineError({
  variant = 'block',
  title,
  message,
  actionLabel,
  onAction,
  actionLoading,
  on = 'surface',
  warning = false,
  announce,
  style,
}: InlineErrorProps): React.JSX.Element {
  const { theme } = useTheme();
  const { duration } = useMotion();
  const { fontScale } = useWindowDimensions();
  const c = theme.colors;
  const appear = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    appear.setValue(0);
    Animated.timing(appear, { toValue: 1, duration: duration.short, easing: bezierFor('enter'), useNativeDriver: USE_NATIVE_DRIVER }).start();
    if (announce ?? (variant !== 'notice' && variant !== 'warning')) AccessibilityInfo.announceForAccessibility(title ? `${title}. ${message}` : message);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message]);

  if (variant === 'field') {
    return (
      <Animated.View accessibilityLiveRegion="polite" style={[{ flexDirection: 'row', alignItems: 'flex-start', opacity: appear }, style]}>
        <Ionicons
          name={ICON.error.outline}
          size={theme.iconSize.xs}
          color={c.error}
          style={{ marginTop: (theme.typeScale.footnote.lineHeight - theme.iconSize.xs) / 2, marginRight: theme.layout.iconTextGap }}
          accessibilityElementsHidden
        />
        <AppText variant="footnote" color="error" style={{ flex: 1 }}>
          {message}
        </AppText>
      </Animated.View>
    );
  }

  const warn = variant === 'warning' || (variant === 'notice' && warning);
  const notice = variant === 'notice' || variant === 'warning';
  const stacked = fontScale >= 1.6;
  const page = !notice && on === 'surface';
  const iconName = warn ? ICON.warning.outline : notice ? ICON.info.outline : ICON.error.outline;
  const iconColor = warn ? c.warning : notice ? c.textSecondary : c.error;
  const iconSize = notice ? theme.iconSize.md : 22;
  const bg = warn ? c.noticeContainer : page ? c.surface : c.surfaceAlt;
  const radius = page ? theme.radius.card : theme.radius.control;
  const textColor = warn ? 'onNoticeContainer' : 'textPrimary';
  const iconTop = ((notice ? theme.typeScale.subhead.lineHeight : theme.typeScale.headline.lineHeight) - iconSize) / 2;
  const action = actionLabel ? (
    <Button variant={notice || !page ? 'ghost' : 'secondary'} size="sm" on="tinted" label={actionLabel} loading={actionLoading} onPress={() => onAction?.()} />
  ) : null;

  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      style={[
        {
          backgroundColor: bg,
          borderRadius: radius,
          borderCurve: 'continuous',
          borderWidth: theme.isDark && page ? theme.stroke.thin : 0,
          borderColor: c.border,
          paddingVertical: page ? theme.layout.cardPadding : notice ? 12 : 14,
          paddingHorizontal: page ? theme.layout.cardPadding : 14,
          opacity: appear,
        },
        page ? theme.elevation.card : null,
        style,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <Ionicons
          name={iconName}
          size={iconSize}
          color={iconColor}
          style={{ marginTop: iconTop, marginRight: notice ? 10 : theme.spacing.smd }}
          accessibilityElementsHidden
        />
        <View style={{ flex: 1 }}>
          {title ? (
            <AppText variant="headline" accessibilityRole="header">
              {title}
            </AppText>
          ) : null}
          <AppText
            variant={notice || !title ? 'subhead' : 'footnote'}
            color={notice ? textColor : title ? 'textSecondary' : 'textPrimary'}
            style={{ marginTop: title ? 2 : 0 }}
          >
            {message}
          </AppText>
          {action && stacked ? <View style={{ marginTop: theme.spacing.sm, alignItems: 'flex-start' }}>{action}</View> : null}
        </View>
        {action && !stacked ? <View style={{ marginLeft: theme.spacing.smd, alignSelf: 'center' }}>{action}</View> : null}
      </View>
    </Animated.View>
  );
}

export interface NoticeBoxProps extends Omit<InlineErrorProps, 'variant' | 'on'> {
  /** Real warning (review pending, offline): `noticeContainer`. Default is the neutral notice. */
  tone?: 'neutral' | 'warning';
}

/** Neutral heads-up box (e.g. "we'll review this account; this won't block them"). */
export function NoticeBox({ tone = 'neutral', ...props }: NoticeBoxProps): React.JSX.Element {
  return <InlineError {...props} variant={tone === 'warning' ? 'warning' : 'notice'} />;
}
