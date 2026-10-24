import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, Animated, View, findNodeHandle, useWindowDimensions } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { ICON } from '../../lib/icons';
import type { IoniconName } from '../../lib/icons';
import { USE_NATIVE_DRIVER, bezierFor, useMotion } from '../../lib/motion';
import { useTheme } from '../../lib/theme';
import { AppText } from './AppText';
import { Button } from './Button';

export type InlineErrorVariant = 'field' | 'block' | 'notice' | 'warning' | 'error' | 'success';

/** Callout severities (states-audit-ux 2.1): the container is always neutral, the level is told by icon, icon colour, bold title and a VoiceOver prefix. */
const CALLOUT = {
  notice: { icon: ICON.info.outline, color: 'textSecondary', prefixKey: null, announce: false },
  warning: { icon: ICON.warning.outline, color: 'warning', prefixKey: 'ui.alertPrefix.warning', announce: true },
  error: { icon: ICON.error.outline, color: 'error', prefixKey: 'ui.alertPrefix.error', announce: true },
  success: { icon: 'checkmark-circle-outline' as IoniconName, color: 'success', prefixKey: null, announce: true },
} as const;
type CalloutVariant = keyof typeof CALLOUT;

export interface InlineErrorProps {
  /**
   * field: under a TextField (icon sm + footnote, no container). block: replaces a region's content, or
   * sits above a sheet's primary action: `surface` card (radius 20) on the page, `surfaceAlt` radius 12
   * in a sheet (`on="elevated"`); red icon + headline title + description, the action `sm` on the same
   * row. Callouts (`surfaceAlt`, radius 12, no colour bars, never a tinted container): notice = info
   * (neutral icon, `title` optional), warning = `warning`-coloured warning-outline, error = `error`-coloured
   * alert-circle, success = `success` check. warning and error need a `title` (bold headline); with a title
   * the body is `subhead` `textSecondary` and the icon aligns to the headline line. Prefer <NoticeBox>.
   */
  variant?: InlineErrorVariant;
  /** block: bold title ("Route failed to load"); `message` then becomes the description under it. */
  title?: string;
  /** Already-translated, human sentence: what happened + what to do. Never `err.message`. */
  message: string;
  /** `sm` action: Retry / Open Settings / Choose another. Same row as the text; under it at font scale >= 1.6. */
  actionLabel?: string;
  onAction?: () => void;
  /** 16pt leading icon on the action. Default `ICON.retry.outline` (every action is a Retry today); pass `null` for none. */
  actionIcon?: IoniconName | null;
  actionLoading?: boolean;
  /** block only: the surface it sits on (page card = surface, inside a BottomSheet = elevated). */
  on?: 'surface' | 'elevated';
  /** notice only. @deprecated use variant="warning" (kept one version). */
  warning?: boolean;
  /**
   * Announce to VoiceOver when it goes from absent to present (mount), once: later message changes do not
   * re-announce (field: each new message does). Default true for field, block, warning (prefixed "Warning:"),
   * error (prefixed "Error:") and success; false for notice.
   */
  announce?: boolean;
  /**
   * Form submit failed: move the screen-reader focus here when it appears (fade start) instead of announcing
   * (no double reading). The container becomes one accessible node labelled `title. message`.
   */
  focusOnAppear?: boolean;
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
  actionIcon,
  actionLoading,
  on = 'surface',
  warning = false,
  announce,
  focusOnAppear = false,
  style,
}: InlineErrorProps): React.JSX.Element {
  const { theme } = useTheme();
  const { duration } = useMotion();
  const { fontScale } = useWindowDimensions();
  const c = theme.colors;
  const appear = useRef(new Animated.Value(0)).current;

  const { t } = useTranslation('common');
  const containerRef = useRef<View>(null);
  const [oneLine, setOneLine] = useState(true);
  const level: CalloutVariant | null = variant === 'notice' && warning ? 'warning' : variant in CALLOUT ? (variant as CalloutVariant) : null;
  const callout = level ? CALLOUT[level] : null;
  const shouldAnnounce = !focusOnAppear && (announce ?? (callout ? callout.announce : true));
  const prefix = callout?.prefixKey ? t(callout.prefixKey) : '';
  const spoken = (title ? `${title}. ${message}` : message);

  useEffect(() => {
    appear.setValue(0);
    Animated.timing(appear, { toValue: 1, duration: duration.short, easing: bezierFor('enter'), useNativeDriver: USE_NATIVE_DRIVER }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message]);

  // absent -> present (mount): announce once. Only `field` re-announces when its message changes.
  useEffect(() => {
    if (shouldAnnounce) AccessibilityInfo.announceForAccessibility(`${prefix}${spoken}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant === 'field' ? message : null]);

  useEffect(() => {
    if (!focusOnAppear) return;
    const handle = containerRef.current ? findNodeHandle(containerRef.current) : null;
    if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const stacked = fontScale >= 1.6;
  const notice = callout !== null;
  const page = !notice && on === 'surface';
  const iconName = callout ? callout.icon : ICON.error.outline;
  const iconColor = callout ? c[callout.color] : c.error;
  const iconSize = notice ? theme.iconSize.md : 22;
  const bg = page ? c.surface : c.surfaceAlt;
  const radius = page ? theme.radius.card : theme.radius.control;
  // icon centred on the headline line when there is a title, else on the first body line
  const iconLine = notice && !title ? theme.typeScale.subhead.lineHeight : theme.typeScale.headline.lineHeight;
  const iconTop = (iconLine - iconSize) / 2;
  const ghostAction = notice || !page;
  const ghostPad = 14; // Button sm side padding (14): glyph lands on the padding line (C4/A8)
  const resolvedActionIcon = actionIcon === null ? undefined : (actionIcon ?? ICON.retry.outline);
  // A4: a single-line message and its action share one centre
  const centreRow = !title && oneLine && !stacked;
  const action = actionLabel ? (
    <Button variant={ghostAction ? 'ghost' : 'secondary'} size="sm" on="tinted" label={actionLabel} icon={resolvedActionIcon} loading={actionLoading} onPress={() => onAction?.()} />
  ) : null;

  return (
    <Animated.View
      ref={containerRef}
      accessibilityLiveRegion="polite"
      accessible={focusOnAppear ? true : undefined}
      accessibilityLabel={focusOnAppear ? `${prefix}${spoken}` : undefined}
      style={[
        {
          backgroundColor: bg,
          borderRadius: radius,
          borderCurve: 'continuous',
          borderWidth: theme.isDark && page ? theme.stroke.thin : 0,
          borderColor: c.border,
          paddingVertical: notice ? theme.layout.listRowPaddingV : theme.layout.cardPadding,
          paddingHorizontal: theme.layout.cardPadding,
          opacity: appear,
        },
        style,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: centreRow ? 'center' : 'flex-start' }}>
        <Ionicons
          name={iconName}
          size={iconSize}
          color={iconColor}
          style={{ marginTop: centreRow ? 0 : iconTop, marginRight: notice ? 10 : theme.spacing.smd }}
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
            color={title ? 'textSecondary' : 'textPrimary'}
            onTextLayout={title ? undefined : (e) => setOneLine(e.nativeEvent.lines.length <= 1)}
            style={{ marginTop: title ? theme.spacing.xs : 0 }}
          >
            {message}
          </AppText>
          {action && stacked ? <View style={{ marginTop: theme.spacing.sm, alignItems: 'flex-start', marginLeft: ghostAction ? -ghostPad : 0 }}>{action}</View> : null}
        </View>
        {action && !stacked ? <View style={{ marginLeft: theme.spacing.smd, alignSelf: 'center', marginRight: ghostAction ? -ghostPad : 0 }}>{action}</View> : null}
      </View>
    </Animated.View>
  );
}

export interface NoticeBoxProps extends Omit<InlineErrorProps, 'variant' | 'on'> {
  /**
   * Callout level. neutral / info = info icon; warning = `warning`-coloured icon + bold `title` (required in
   * practice); error = `error` icon + bold `title`; success = check. The container is `surfaceAlt` for all.
   */
  tone?: 'neutral' | 'info' | 'warning' | 'error' | 'success';
}

/** Neutral-container callout (e.g. "we'll review this account; this won't block them"). */
export function NoticeBox({ tone = 'neutral', ...props }: NoticeBoxProps): React.JSX.Element {
  const variant: InlineErrorVariant = tone === 'neutral' || tone === 'info' ? 'notice' : tone;
  return <InlineError {...props} variant={variant} />;
}
