/**
 * RouteCard — App-level shared presentational component (AC-183, v2.2 design system §32.1).
 *
 * Owned by MOD-012. Consumed by HomeScreen (Projecting Routes), RouteListScreen (MOD-003) and
 * the send-history section. Import path (all consumers): `src/components/RouteCard`.
 *
 * Layout (thumbnail + three lines; AC-191 / AC-192 overridden by the human decision):
 *   Card (surface, radius 20, padding 8, minHeight 104)
 *     ├── text column (flex-1, paddingLeft 8, vertically centred)
 *     │     ├── row 1: TapeBadge lg (grade 24/800, the card's only focal point) + SendStatus tag
 *     │     │          (flash / top only) + flex + bookmark (44pt, IN the text column)
 *     │     ├── row 2: `{colour}・{section}` subhead 600 (+ `・{gym}` 400 textSecondary on cross-gym lists)
 *     │     └── row 3: play-circle icon + beta count (footnote; hidden when 0)
 *     └── thumbnail 88 (64 below 360pt wide), radius innerRadius(card, 8) = 12; missing photo =
 *         surfaceAlt + image icon; play disc (decorative) when beta >= 1 and a photo exists
 *   Font scale >= 1.6: the thumbnail is hidden, the text column is full width, row 1 wraps and the
 *   bookmark is pinned top-right.
 *
 * The card body (a full-card PressableScale) and the bookmark are SIBLINGS — no nested buttons.
 * Everything visual is hidden from VoiceOver; the body label is the one sentence:
 * "{grade}, {colour}, {section}. {gym}. {send state}. {beta count}".
 *
 * Pure presentational — all data + callbacks are props. No hex, no raw font sizes.
 */

import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Image, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ICON } from '../lib/icons';
import { SPRING_REST, USE_NATIVE_DRIVER, bezierFor, useMotion } from '../lib/motion';
import { RADIUS, innerRadius, useTheme } from '../lib/theme';
import { TapeBadge, resolveTape } from '@/lib/tape';
import { getPhotoSignedUrl } from '../modules/mod-route-catalog/route-service';
import { AppText } from './ui/AppText';
import { Card } from './ui/Card';
import { IconButton } from './ui/IconButton';
import { PressableScale } from './ui/PressableScale';
import { SendStatus } from './ui/SendStatus';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RouteCardRoute {
  id: string;
  /** Fallback second-row text when neither `colorTag` nor `section` is supplied. */
  name: string;
  /** Printed on the tape badge (24/800) and read by VoiceOver. */
  grade: string;
  photo_url: string | null;
  /** Shown after the colour on cross-gym lists (Home); spoken by VoiceOver. Omit on single-gym lists. */
  gymName?: string;
  /** Stored tape colour name (e.g. 'red'). Drives the tape badge and the colour name. */
  colorTag?: string;
  /** Wall section / area (e.g. 'A'). Omitted when the route has none. */
  section?: string | null;
}

export interface RouteCardProps {
  route: RouteCardRoute;
  onPress: () => void;
  /** Number of beta videos for this route (AC-189). Default 0. */
  betaVideoCount?: number;
  /** Whether the current user has sent this route (AC-190). Default false. */
  hasSend?: boolean;
  /** The send style — flash or top. Only relevant when hasSend is true (AC-190). Default null. */
  sendStyle?: 'flash' | 'top' | null;
  /** Whether the current user has saved this route (AC-046/047). Default false. */
  isSaved?: boolean;
  /** Called when the bookmark is tapped (AC-046/047). */
  onBookmarkToggle?: () => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

/** Font scale from which the thumbnail is hidden (AX layout, §32.1). */
const AX_FONT_SCALE = 1.6;
/** Bookmark pop (Motion C9) numbers. */
const POP_ROTATE_DOWN = -5;
const POP_ROTATE_UP = 2;
const BOOKMARK_PIVOT_MS = 60;
/** Image glyph in the empty thumbnail (§32.1). */
const PLACEHOLDER_ICON = 26;
/** Beta-count glyph size (§32.1). */
const BETA_ICON = 15;
/** Play disc inset from the thumbnail's bottom-right corner (§32.1). */
const DISC_INSET = 6;

// ── Component ─────────────────────────────────────────────────────────────────

export default function RouteCard({
  route,
  onPress,
  betaVideoCount = 0,
  hasSend = false,
  sendStyle = null,
  isSaved = false,
  onBookmarkToggle,
}: RouteCardProps): React.JSX.Element {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const { duration, scale, spring, distance, reduceMotion, haptic } = useMotion();
  const { fontScale, width } = useWindowDimensions();
  const c = theme.colors;
  const isAx = fontScale >= AX_FONT_SCALE;
  const compact = width < theme.layout.compactWidthBreakpoint;
  const thumbSize = compact ? theme.componentSize.routeThumbCompact : theme.componentSize.routeThumb;
  const pad = theme.layout.routeCardPadding;

  const [signedPhotoUrl, setSignedPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (route.photo_url !== null) {
      getPhotoSignedUrl(route.photo_url)
        .then(setSignedPhotoUrl)
        .catch(() => {
          // Keep signedPhotoUrl as null — the placeholder is shown.
        });
    } else {
      setSignedPhotoUrl(null);
    }
  }, [route.photo_url]);

// ── Bookmark pop (Motion C9) ───────────────────────────────────────────────
  // 1. micro + enter: translateY 0->3, scale 1->pop, rotate 0->-12deg (origin top)
  // 2. micro + linear: rotate -12 -> +6
  // 3. grip: everything back to 0 / 1 / 0
  // Un-saving only cross-fades (done by IconButton). Reduce Motion: cross-fade only.
  const popY = useRef(new Animated.Value(0)).current;
  const popScale = useRef(new Animated.Value(1)).current;
  const popRotate = useRef(new Animated.Value(0)).current;
  const wasSaved = useRef(isSaved);
  const lastPop = useRef(0);

  useEffect(() => {
    const before = wasSaved.current;
    wasSaved.current = isSaved;
    if (before || !isSaved || reduceMotion) return;
    // Repeated toggles inside 300ms only change state; the pop is not replayed.
    const now = Date.now();
    if (now - lastPop.current < duration.medium) return;
    lastPop.current = now;
    const ease = bezierFor('enter');
    Animated.sequence([
      Animated.parallel([
        Animated.timing(popY, { toValue: distance.bookmarkDrop, duration: duration.micro, easing: ease, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(popScale, { toValue: scale.popSoft, duration: duration.micro, easing: ease, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(popRotate, { toValue: POP_ROTATE_DOWN, duration: duration.micro, easing: ease, useNativeDriver: USE_NATIVE_DRIVER }),
      ]),
      Animated.timing(popRotate, { toValue: POP_ROTATE_UP, duration: BOOKMARK_PIVOT_MS, easing: bezierFor('linear'), useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.parallel([
        Animated.spring(popY, { toValue: 0, ...spring.gripSoft, ...SPRING_REST, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.spring(popScale, { toValue: 1, ...spring.gripSoft, ...SPRING_REST, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.spring(popRotate, { toValue: 0, ...spring.gripSoft, ...SPRING_REST, useNativeDriver: USE_NATIVE_DRIVER }),
      ]),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSaved]);

  const popTransform = [
    { translateY: popY },
    { scale: popScale },
    { rotate: popRotate.interpolate({ inputRange: [-360, 360], outputRange: ['-360deg', '360deg'] }) },
  ];

  // ── Derived display values ──────────────────────────────────────────────────

  const showStatus = hasSend && (sendStyle === 'flash' || sendStyle === 'top');
  const mode = theme.isDark ? 'dark' : 'light';
  const tape = route.colorTag !== undefined ? resolveTape(mode, route.colorTag) : { known: false as const };

  const colorName =
    route.colorTag === undefined
      ? undefined
      : tape.known
        ? t(`routeCatalog.colors.${route.colorTag}`)
        : t('routeCatalog.colors.other');
  const section = route.section ? route.section : undefined;
  const hasStructured = colorName !== undefined || section !== undefined;
  const titleLine = hasStructured ? [colorName, section].filter((p): p is string => !!p).join('・') : route.name;

  // VoiceOver: one sentence. "{grade}, {colour}, {section}. {gym}. {send state}. {beta count}"
  const headParts = [route.grade, colorName, hasStructured ? section : route.name].filter((p): p is string => !!p);
  const segments = [headParts.join(', ')];
  if (route.gymName) segments.push(route.gymName);
  if (showStatus) segments.push(sendStyle === 'flash' ? t('routeCard.statusFlash') : t('routeCard.statusTop'));
  if (betaVideoCount > 0) segments.push(t('routeCard.betaCount', { count: betaVideoCount }));
  const bodyLabel = segments.join('. ');

  const hiddenFromAx = {
    accessibilityElementsHidden: true,
    importantForAccessibility: 'no-hide-descendants' as const,
  };

  const toggleBookmark = (): void => {
    haptic(isSaved ? 'select' : 'toggle', `bookmark-${route.id}`);
    onBookmarkToggle?.();
  };

  const thumb = (
    <View
      style={{
        width: thumbSize,
        height: thumbSize,
        borderRadius: innerRadius(RADIUS.card, pad),
        borderCurve: 'continuous',
        overflow: 'hidden',
        backgroundColor: c.surfaceAlt,
        alignItems: 'center',
        justifyContent: 'center',
      }}
      pointerEvents="none"
      {...hiddenFromAx}
    >
      {signedPhotoUrl !== null ? (
        <Image
          source={{ uri: signedPhotoUrl }}
          style={{ width: thumbSize, height: thumbSize }}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
      ) : (
        <Ionicons testID="thumb-placeholder" name={ICON.image.outline} size={PLACEHOLDER_ICON} color={c.outline} />
      )}
      {betaVideoCount > 0 && route.photo_url !== null ? (
        <View
          testID="play-disc"
          style={{
            position: 'absolute',
            right: DISC_INSET,
            bottom: DISC_INSET,
            width: theme.componentSize.playDisc,
            height: theme.componentSize.playDisc,
            borderRadius: theme.radius.full,
            backgroundColor: c.accentIllustration,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name={ICON.play.filled} size={theme.iconSize.xs} color={c.onAccentIllustration} style={{ marginLeft: 1 }} />
        </View>
      ) : null}
    </View>
  );

  const bookmark = (
    <Animated.View
      style={[
        { transform: popTransform, transformOrigin: 'top' },
        // The 44pt touch target keeps its size; negative margins keep row 1 at the badge height.
        isAx ? styles.axBookmark : { marginVertical: -5 },
      ]}
    >
      <IconButton
        variant="toggle"
        name={ICON.bookmark.outline}
        nameOn={ICON.bookmark.filled}
        selected={isSaved}
        size={theme.iconSize.md}
        color="textSecondary"
        colorOn="primary"
        accessibilityLabel={isSaved ? t('routeCard.saved') : t('routeCard.unsaved')}
        onPress={toggleBookmark}
      />
    </Animated.View>
  );

  const textBlock = (
    <View
      style={[
        styles.textBlock,
        { gap: theme.layout.stackTight, paddingLeft: isAx ? theme.spacing.sm : pad },
        isAx ? { paddingRight: theme.layout.minTouchTarget } : null,
      ]}
      pointerEvents="box-none"
    >
      <View style={[styles.row1, { columnGap: theme.spacing.sm }, isAx ? styles.row1Wrap : null]} pointerEvents="box-none">
        <View pointerEvents="none" {...hiddenFromAx}>
          <TapeBadge color={route.colorTag ?? 'other'} size="lg" grade={route.grade} />
        </View>
        {showStatus ? (
          <View testID="send-status" pointerEvents="none" {...hiddenFromAx}>
            <SendStatus sendStyle={sendStyle as 'flash' | 'top'} variant="tag" />
          </View>
        ) : null}
        <View style={styles.flex} pointerEvents="none" />
        {bookmark}
      </View>
      <View pointerEvents="none" {...hiddenFromAx}>
        <AppText variant="subhead" weight="600" numberOfLines={1}>
          {titleLine}
          {route.gymName ? (
            <AppText variant="subhead" weight="400" color="textSecondary">
              {`・${route.gymName}`}
            </AppText>
          ) : null}
        </AppText>
      </View>
      {betaVideoCount > 0 ? (
        <View style={[styles.betaRow, { columnGap: theme.layout.iconTextGap }]} pointerEvents="none" {...hiddenFromAx}>
          <Ionicons name={ICON.betaCount.outline} size={BETA_ICON} color={c.textSecondary} />
          <AppText variant="footnote" color="textSecondary" numberOfLines={1}>
            {t('routeCard.betaCount', { count: betaVideoCount })}
          </AppText>
        </View>
      ) : null}
    </View>
  );

  return (
    <Card variant="static" padding={pad} style={{ minHeight: theme.componentSize.routeThumb + 2 * pad }}>
      {/* Card body: a full-card pressable. Siblings (text, bookmark, thumbnail) are layered above. */}
      <PressableScale
        feedback="row"
        inScroll
        pressedColor={c.surfacePressed}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={bodyLabel}
        accessibilityHint={t('routeCard.openHint')}
        accessibilityActions={[{ name: 'bookmark', label: isSaved ? t('routeCard.unsaveAction') : t('routeCard.saveAction') }]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'bookmark') toggleBookmark();
        }}
        style={[StyleSheet.absoluteFill, { borderRadius: theme.radius.card, borderCurve: 'continuous' }]}
      />

      <View pointerEvents="box-none" style={styles.row}>
        {textBlock}
        {isAx ? null : (
          <View pointerEvents="none" style={{ marginLeft: theme.spacing.xs }}>
            {thumb}
          </View>
        )}
      </View>
    </Card>
  );
}

// ── Styles (static; theme-dependent values are inlined above) ────────────────

const styles = StyleSheet.create({
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  textBlock: {
    flex: 1,
    justifyContent: 'center',
  },
  row1: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  row1Wrap: {
    flexWrap: 'wrap',
  },
  flex: {
    flex: 1,
  },
  axBookmark: {
    position: 'absolute',
    top: 0,
    right: 0,
  },
  betaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
