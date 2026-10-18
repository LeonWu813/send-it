/**
 * AppHeader — global app-level header (design system v2.2 §30; AC-184 overridden by the human
 * decision: action capsule on the right, bell + settings, 8pt unread dot).
 *
 * Variants:
 *   root   — ONLY on the three tab roots. `largeTitle` 34/44 left-aligned (the tab name) + the 96x44
 *            action capsule bottom-aligned with the title box. Height = insets.top + 6 + 44 + 8.
 *            With `scrollY`: the title scrolls away with the content and a 44pt small-title bar fades in
 *            (opacity bound to scroll [38, 50] -> [0, 1], clamped; kept under Reduce Motion — it is
 *            direct manipulation). The capsule stays put (it slides 6pt into the small bar row).
 *   nested — every nested screen: ONE 44pt row = back (float IconButton) + centred `headline` title +
 *            optional `trailing` control + the action capsule. Screens do not draw their own back row.
 *
 * Nested screens and tab roots drive the header through `useAppHeader` / `useAppHeaderRoot`
 * (./AppHeaderContext); AppShell renders this component from that store.
 *
 * The bell reads the unread count from UnreadCountProvider (MOD-007). The unread marker is an 8pt dot
 * (`unreadDot`) that pops in with `grip`; the count lives in the bell's accessibility label.
 * Font scale >= 1.6: the root capsule moves to its own row above the title.
 *
 * Theme tokens only. i18n for every accessible label.
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, StyleSheet, View, useWindowDimensions } from 'react-native';

import { AppText } from '../../../components/ui/AppText';
import { IconButton } from '../../../components/ui/IconButton';
import { ICON } from '../../../lib/icons';
import { SPRING_REST, USE_NATIVE_DRIVER, bezierFor, useMotion } from '../../../lib/motion';
import { useLayout, useTheme } from '../../../lib/theme';
import { useUnreadCount } from '../../mod-notifications/UnreadCountProvider';

// ── Types / sizing ────────────────────────────────────────────────────────────

export interface AppHeaderProps {
  variant?: 'root' | 'nested';
  /** root: the tab name (large title). nested: the screen title. */
  title: string;
  /** nested: back handler. */
  onBack?: () => void;
  /** nested: a control (44pt) left of the capsule, e.g. a bookmark `IconButton variant="float"`. */
  trailing?: React.ReactNode;
  /** root: scroll offset of the screen's list. Enables the large-title collapse; the header then overlays the list. */
  scrollY?: Animated.Value;
  onNavigateToNotifications: () => void;
  onNavigateToSettings: () => void;
  /** Top safe-area inset applied as paddingTop (passed from AppShell). */
  topInset: number;
  /** The unread number just arrived live: the dot pops in. Default false (fades in). */
  badgeLive?: boolean;
}

/** Large-title row geometry (§30.2): 6 above, 44 title box, 8 below. */
const ROOT_PAD_TOP = 6;
const ROOT_PAD_BOTTOM = 8;
const ROW = 44;
const AX_FONT_SCALE = 1.6;
/** Scroll range over which the small title fades in (§30.5). */
const FADE_FROM = 38;
const FADE_TO = 50;

/** Total height of the root header (also the list's content top inset when it overlays). */
export function rootHeaderHeight(topInset: number, fontScale: number): number {
  return topInset + ROOT_PAD_TOP + ROW + ROOT_PAD_BOTTOM + (fontScale >= AX_FONT_SCALE ? ROW + ROOT_PAD_TOP : 0);
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AppHeader({
  variant = 'root',
  title,
  onBack,
  trailing,
  scrollY,
  onNavigateToNotifications,
  onNavigateToSettings,
  topInset,
  badgeLive = false,
}: AppHeaderProps): React.JSX.Element {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const { screenMargin } = useLayout();
  const { fontScale } = useWindowDimensions();
  const { spring, duration, reduceMotion } = useMotion();
  const unreadCount = useUnreadCount();
  const c = theme.colors;
  const ax = fontScale >= AX_FONT_SCALE;
  const capsule = theme.componentSize.headerActionGroup;

  // Unread dot: pops in with `grip` (live) or fades in (launch / resume).
  const dotScale = useRef(new Animated.Value(unreadCount > 0 ? 1 : 0)).current;
  const dotOpacity = useRef(new Animated.Value(unreadCount > 0 ? 1 : 0)).current;
  const prevUnread = useRef(unreadCount);
  useEffect(() => {
    const before = prevUnread.current;
    prevUnread.current = unreadCount;
    if (unreadCount > 0 && before === 0) {
      if (badgeLive && !reduceMotion) {
        dotOpacity.setValue(1);
        dotScale.setValue(0);
        Animated.spring(dotScale, { toValue: 1, ...spring.grip, ...SPRING_REST, useNativeDriver: USE_NATIVE_DRIVER }).start();
      } else {
        dotScale.setValue(1);
        dotOpacity.setValue(0);
        Animated.timing(dotOpacity, { toValue: 1, duration: duration.short, easing: bezierFor('standard'), useNativeDriver: USE_NATIVE_DRIVER }).start();
      }
    } else if (unreadCount === 0 && before > 0) {
      Animated.timing(dotOpacity, { toValue: 0, duration: duration.short, easing: bezierFor('exit'), useNativeDriver: USE_NATIVE_DRIVER }).start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadCount]);

  const actionCapsule = (
    <View
      style={{
        width: capsule.width,
        height: capsule.height,
        flexDirection: 'row',
        columnGap: capsule.gap,
        borderRadius: theme.radius.full,
        borderCurve: 'continuous',
        backgroundColor: theme.isDark ? c.surfaceElevated : c.surface,
        borderWidth: theme.isDark ? theme.stroke.thin : 0,
        borderColor: c.border,
        ...theme.elevation.control,
      }}
    >
      <View>
        <IconButton
          name={ICON.notifications.outline}
          on="surface"
          size={theme.iconSize.md + 2}
          accessibilityLabel={
            unreadCount > 0 ? t('home.appHeader.bellA11yUnread', { count: unreadCount }) : t('home.appHeader.bellA11y')
          }
          onPress={onNavigateToNotifications}
        />
        {unreadCount > 0 ? (
          <Animated.View
            testID="unread-dot"
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{
              position: 'absolute',
              top: 9,
              right: 9,
              width: theme.componentSize.unreadDot,
              height: theme.componentSize.unreadDot,
              borderRadius: theme.radius.full,
              backgroundColor: c.error,
              opacity: dotOpacity,
              transform: [{ scale: dotScale }],
            }}
          />
        ) : null}
      </View>
      <IconButton
        name={ICON.settings.outline}
        on="surface"
        size={theme.iconSize.md + 2}
        accessibilityLabel={t('home.appHeader.settingsA11y')}
        onPress={onNavigateToSettings}
      />
    </View>
  );

  // ── nested: one 44pt row ───────────────────────────────────────────────────
  if (variant === 'nested') {
    const side = screenMargin + capsule.width + theme.spacing.sm + (trailing ? ROW + theme.spacing.sm : 0);
    const hairline = scrollY
      ? scrollY.interpolate({ inputRange: [0, 8], outputRange: [0, 1], extrapolate: 'clamp' })
      : 0;
    return (
      <View
        style={{
          paddingTop: topInset,
          backgroundColor: c.background,
        }}
      >
        <View style={[styles.nestedRow, { paddingHorizontal: screenMargin, height: ROW + ROOT_PAD_TOP + ROOT_PAD_BOTTOM }]}>
          <View style={[StyleSheet.absoluteFill, styles.titleWrap, { paddingLeft: screenMargin + ROW + theme.spacing.sm, paddingRight: side }]} pointerEvents="none">
            <AppText variant="headline" align="center" numberOfLines={1} accessibilityRole="header">
              {title}
            </AppText>
          </View>
          {onBack ? (
            <IconButton
              variant="float"
              name={ICON.back.outline}
              accessibilityLabel={t('common.back')}
              onPress={onBack}
            />
          ) : (
            <View style={{ width: ROW }} />
          )}
          <View style={[styles.nestedRight, { columnGap: theme.spacing.sm }]}>
            {trailing}
            {actionCapsule}
          </View>
        </View>
        <Animated.View
          pointerEvents="none"
          style={[styles.hairline, { opacity: hairline, backgroundColor: c.border, height: theme.stroke.hairline }]}
        />
      </View>
    );
  }

  // ── root: large title ──────────────────────────────────────────────────────
  const height = rootHeaderHeight(topInset, fontScale);
  const scroll = scrollY;
  const largeShift = scroll
    ? scroll.interpolate({ inputRange: [0, height], outputRange: [0, -height], extrapolate: 'clamp' })
    : 0;
  // The capsule slides up into the small-bar row during the first 6pt of scroll, then stays.
  const capsuleShift = scroll
    ? scroll.interpolate({ inputRange: [0, ROOT_PAD_TOP], outputRange: [0, -ROOT_PAD_TOP], extrapolate: 'clamp' })
    : 0;
  const smallOpacity = scroll
    ? scroll.interpolate({ inputRange: [FADE_FROM, FADE_TO], outputRange: [0, 1], extrapolate: 'clamp' })
    : 0;
  const capsuleTop = topInset + ROOT_PAD_TOP;

  return (
    <View
      pointerEvents="box-none"
      style={[
        { height },
        scroll ? styles.overlay : { backgroundColor: c.background },
      ]}
    >
      {/* Large title: scrolls away with the content. */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.largeBlock,
          {
            paddingTop: topInset + ROOT_PAD_TOP + (ax ? ROW + ROOT_PAD_TOP : 0),
            paddingHorizontal: screenMargin,
            transform: [{ translateY: largeShift }],
          },
        ]}
      >
        <AppText
          variant="largeTitle"
          numberOfLines={1}
          accessibilityRole="header"
          style={{ paddingRight: ax ? 0 : capsule.width + theme.spacing.sm }}
        >
          {title}
        </AppText>
      </Animated.View>

      {/* Small-title bar: opacity bound to the scroll (hidden from VoiceOver, no touches). */}
      {scroll ? (
        <Animated.View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[
            styles.smallBar,
            {
              height: topInset + ROW,
              paddingTop: topInset,
              backgroundColor: c.background,
              borderBottomWidth: theme.stroke.hairline,
              borderBottomColor: c.border,
              opacity: smallOpacity,
            },
          ]}
        >
          <AppText variant="headline" align="center" numberOfLines={1} style={{ paddingHorizontal: screenMargin + capsule.width + theme.spacing.sm }}>
            {title}
          </AppText>
        </Animated.View>
      ) : null}

      {/* Action capsule (96x44), bottom-aligned with the title box. */}
      <Animated.View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          top: capsuleTop,
          right: screenMargin,
          transform: [{ translateY: capsuleShift }],
        }}
      >
        {actionCapsule}
      </Animated.View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 5,
  },
  largeBlock: {
    ...StyleSheet.absoluteFill,
  },
  smallBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    justifyContent: 'center',
  },
  nestedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleWrap: {
    justifyContent: 'center',
  },
  nestedRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hairline: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
});
