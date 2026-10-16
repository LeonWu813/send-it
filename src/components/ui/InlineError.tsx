import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { ICON } from '../../lib/icons';
import { USE_NATIVE_DRIVER, bezierFor, useMotion } from '../../lib/motion';
import { useTheme } from '../../lib/theme';
import { AppText } from './AppText';
import { Button } from './Button';

export type InlineErrorVariant = 'field' | 'block' | 'notice';

export interface InlineErrorProps {
  /**
   * field: under a TextField (icon sm + footnote, no container). block: replaces a region's content,
   * or sits above a sheet's primary action (neutral surface + 4pt error bar). notice: neutral
   * heads-up (noticeContainer + 4pt noticeBorder bar); prefer <NoticeBox>.
   */
  variant?: InlineErrorVariant;
  /** Already-translated, human sentence: what happened + what to do. Never `err.message`. */
  message: string;
  /** Ghost `sm` action under the message: Retry / Open Settings / Choose another. */
  actionLabel?: string;
  onAction?: () => void;
  actionLoading?: boolean;
  /** block only: the surface it sits on (page card = surface, inside a BottomSheet = elevated). */
  on?: 'surface' | 'elevated';
  /** notice only: use the warning glyph/colour instead of the info glyph. */
  warning?: boolean;
  /** Announce to VoiceOver on appear (default true for field and block). */
  announce?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Error shown next to where it happened: always icon + text, never an Alert. Fades in (`short`,
 * `enter`). The left bar is a filled child View clipped by the container (never borderLeftWidth).
 * Haptic `error` and any shake are the caller's job (see useShake()).
 */
export function InlineError({
  variant = 'block',
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
  const c = theme.colors;
  const appear = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    appear.setValue(0);
    Animated.timing(appear, { toValue: 1, duration: duration.short, easing: bezierFor('enter'), useNativeDriver: USE_NATIVE_DRIVER }).start();
    if (announce ?? variant !== 'notice') AccessibilityInfo.announceForAccessibility(message);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message]);

  if (variant === 'field') {
    // footnote line 20, icon 16 -> centre on the first line (marginTop 2)
    const top = (theme.typeScale.footnote.lineHeight - theme.iconSize.sm) / 2;
    return (
      <Animated.View
        accessibilityLiveRegion="polite"
        style={[{ flexDirection: 'row', alignItems: 'flex-start', opacity: appear }, style]}
      >
        <Ionicons
          name={ICON.error.outline}
          size={theme.iconSize.sm}
          color={c.error}
          style={{ marginTop: top, marginRight: theme.layout.iconTextGap }}
          accessibilityElementsHidden
        />
        <AppText variant="footnote" color="error" style={{ flex: 1 }}>
          {message}
        </AppText>
      </Animated.View>
    );
  }

  const notice = variant === 'notice';
  const bar = notice ? c.noticeBorder : c.error;
  const iconName = notice ? (warning ? ICON.warning.outline : ICON.info.outline) : ICON.error.outline;
  const iconColor = notice ? (warning ? c.warning : c.onNoticeContainer) : c.error;
  const bg = notice ? c.noticeContainer : on === 'elevated' ? c.surfaceElevated : c.surface;
  const textColor = notice ? 'onNoticeContainer' : 'textPrimary';
  const iconTop = (theme.typeScale.subhead.lineHeight - theme.iconSize.md) / 2;
  const barW = theme.componentSize.noticeBarWidth;

  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      style={[
        {
          backgroundColor: bg,
          borderRadius: theme.borderRadius.lg,
          overflow: 'hidden',
          borderWidth: theme.isDark && !notice ? theme.stroke.thin : 0,
          borderColor: c.border,
          paddingVertical: theme.layout.cardPadding,
          paddingRight: theme.layout.cardPadding,
          paddingLeft: theme.layout.cardPadding + barW,
          opacity: appear,
        },
        style,
      ]}
    >
      <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: barW, backgroundColor: bar }} />
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <Ionicons
          name={iconName}
          size={theme.iconSize.md}
          color={iconColor}
          style={{ marginTop: iconTop, marginRight: theme.layout.iconTextGapInButton }}
          accessibilityElementsHidden
        />
        <AppText variant="subhead" color={textColor} style={{ flex: 1 }}>
          {message}
        </AppText>
      </View>
      {actionLabel ? (
        <View style={{ marginTop: theme.spacing.sm, marginLeft: theme.iconSize.md + theme.layout.iconTextGapInButton }}>
          <Button
            variant="ghost"
            size="sm"
            on={notice ? 'tinted' : on === 'elevated' ? 'surface' : 'surface'}
            label={actionLabel}
            loading={actionLoading}
            onPress={() => onAction?.()}
            style={{ marginLeft: -theme.spacing.smd }}
          />
        </View>
      ) : null}
    </Animated.View>
  );
}

export interface NoticeBoxProps extends Omit<InlineErrorProps, 'variant' | 'on'> {}

/** Neutral heads-up box (e.g. "we'll review this account; this won't block them"). */
export function NoticeBox(props: NoticeBoxProps): React.JSX.Element {
  return <InlineError {...props} variant="notice" />;
}
