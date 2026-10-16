/**
 * RouteCard — App-level shared presentational component (AC-183, Rev 39/40).
 *
 * Owned by MOD-012. Consumed by:
 *   - HomeScreen Projecting Routes section (MOD-012)
 *   - RouteListScreen (MOD-003)
 *   - Send-history section (MOD-008)
 *
 * Import path (all consumers): `src/components/RouteCard`
 * Per the App-Level Shared Presentational Components convention in production.md.
 *
 * Layout (AC-183 / AC-192, design system v1.2 §32.1):
 *   Left column (flex-1, row)
 *     ├── text block (vertically centred)
 *     │     ├── route name (subhead 600, 2 lines) + send-status icon (flash / top only)
 *     │     └── beta count (caption1, hidden when 0 — AC-189)
 *     └── bookmark IconButton (toggle, 44pt, md glyph)
 *   Right column — 80×80 thumbnail (photo, or a tape-colour block when there is no photo)
 *
 * The grade is NOT drawn (AC-191) but is read by VoiceOver, together with the colour, name, gym
 * (when supplied), send status and beta count.
 *
 * The card body (a full-card PressableScale) and the bookmark are SIBLINGS — no nested buttons,
 * no stopPropagation. Visual-only content is layered over the body and hidden from VoiceOver;
 * the body's label carries the information.
 *
 * Pure presentational — all data + callbacks are props. No hex, no raw font sizes.
 */

import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Image, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ICON } from '../lib/icons';
import { SPRING_REST, USE_NATIVE_DRIVER, bezierFor, useMotion } from '../lib/motion';
import { useTheme } from '../lib/theme';
import { resolveTape } from '../modules/mod-route-catalog/tape';
import { getPhotoSignedUrl } from '../modules/mod-route-catalog/route-service';
import { AppText } from './ui/AppText';
import { Card } from './ui/Card';
import { IconButton } from './ui/IconButton';
import { PressableScale } from './ui/PressableScale';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RouteCardRoute {
  id: string;
  name: string;
  /** Retained for the accessibility label — not rendered in the card UI (AC-191). */
  grade: string;
  photo_url: string | null;
  /** Read by VoiceOver only (and only when supplied: cross-gym lists). Never drawn (AC-192). */
  gymName?: string;
  /** Stored tape colour name (e.g. 'red'). Drives the no-photo placeholder fill and the a11y label. */
  colorTag?: string;
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

const THUMB = 80;
/** Font scale from which the thumbnail drops below the text (AX layout, §32.1). */
const AX_FONT_SCALE = 1.6;
/** Bookmark pop (Motion C9) numbers. */
const POP_TRANSLATE_Y = 3;
const POP_ROTATE_DOWN = -12;
const POP_ROTATE_UP = 6;

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
  const { duration, scale, spring, reduceMotion, haptic } = useMotion();
  const { fontScale } = useWindowDimensions();
  const c = theme.colors;
  const isAx = fontScale >= AX_FONT_SCALE;

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
        Animated.timing(popY, { toValue: POP_TRANSLATE_Y, duration: duration.micro, easing: ease, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(popScale, { toValue: scale.pop, duration: duration.micro, easing: ease, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(popRotate, { toValue: POP_ROTATE_DOWN, duration: duration.micro, easing: ease, useNativeDriver: USE_NATIVE_DRIVER }),
      ]),
      Animated.timing(popRotate, { toValue: POP_ROTATE_UP, duration: duration.micro, easing: bezierFor('linear'), useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.parallel([
        Animated.spring(popY, { toValue: 0, ...spring.grip, ...SPRING_REST, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.spring(popScale, { toValue: 1, ...spring.grip, ...SPRING_REST, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.spring(popRotate, { toValue: 0, ...spring.grip, ...SPRING_REST, useNativeDriver: USE_NATIVE_DRIVER }),
      ]),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSaved]);

  const popTransform = [
    { translateY: popY },
    { scale: popScale },
    { rotate: popRotate.interpolate({ inputRange: [-360, 360], outputRange: ['-360deg', '360deg'] }) },
  ];

  // ── Play disc: 0.96 while the card is pressed (no colour change) ────────────
  const discScale = useRef(new Animated.Value(1)).current;
  function pressDisc(down: boolean): void {
    if (reduceMotion) return;
    Animated.timing(discScale, {
      toValue: down ? scale.pressControl : 1,
      duration: down ? duration.micro : duration.short,
      easing: bezierFor('standard'),
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }

  // ── Derived display values ──────────────────────────────────────────────────

  const showStatus = hasSend && (sendStyle === 'flash' || sendStyle === 'top');
  const mode = theme.isDark ? 'dark' : 'light';
  const tape = route.colorTag !== undefined ? resolveTape(mode, route.colorTag) : { known: false as const };
  const placeholderFill = tape.known ? tape.entry.fill : c.surfaceAlt;

  const colorName =
    route.colorTag === undefined
      ? undefined
      : tape.known
        ? t(`routeCatalog.colors.${route.colorTag}`)
        : t('routeCatalog.colors.other');

  // VoiceOver: grade, colour, name. gym. status. beta count (grade is read although hidden).
  const headParts = [route.grade, colorName, route.name].filter((p): p is string => !!p);
  const segments = [headParts.join(', ')];
  if (route.gymName) segments.push(route.gymName);
  if (showStatus) segments.push(sendStyle === 'flash' ? t('routeCard.statusFlash') : t('routeCard.statusTop'));
  if (betaVideoCount > 0) segments.push(t('routeCard.betaCount', { count: betaVideoCount }));
  const bodyLabel = segments.join('. ');

  const hiddenFromAx = {
    accessibilityElementsHidden: true,
    importantForAccessibility: 'no-hide-descendants' as const,
  };

  const thumb = (
    <View style={styles.thumbBox} pointerEvents="none" {...hiddenFromAx}>
      {signedPhotoUrl !== null ? (
        <Image
          source={{ uri: signedPhotoUrl }}
          style={[styles.thumb, { borderRadius: theme.borderRadius.md }]}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
      ) : (
        <View style={[styles.thumb, { borderRadius: theme.borderRadius.md, backgroundColor: placeholderFill }]} />
      )}
      {betaVideoCount > 0 ? (
        <Animated.View
          testID="play-disc"
          style={{
            position: 'absolute',
            right: theme.spacing.xs,
            bottom: theme.spacing.xs,
            width: theme.componentSize.playDisc,
            height: theme.componentSize.playDisc,
            borderRadius: theme.borderRadius.full,
            backgroundColor: c.accentIllustration,
            borderWidth: theme.componentSize.playDiscRing,
            borderColor: c.surface,
            alignItems: 'center',
            justifyContent: 'center',
            transform: [{ scale: discScale }],
          }}
        >
          <Ionicons
            name={ICON.play.filled}
            size={theme.iconSize.xs}
            color={c.onAccentIllustration}
            style={{ marginLeft: 1 }}
          />
        </Animated.View>
      ) : null}
    </View>
  );

  const textBlock = (
    <View style={[styles.textBlock, { gap: theme.layout.stackTight }]} pointerEvents="none" {...hiddenFromAx}>
      <View style={styles.nameRow}>
        <AppText variant="subhead" weight="600" numberOfLines={2} style={styles.nameText}>
          {route.name}
        </AppText>
        {showStatus ? (
          <Ionicons
            testID="send-icon"
            name={sendStyle === 'flash' ? ICON.sendFlash.filled : ICON.sendTop.filled}
            size={theme.iconSize.sm}
            color={sendStyle === 'flash' ? c.sendFlash : c.sendTop}
            // subhead line 22, glyph 16 -> centre on the first line (§9.6)
            style={{ marginLeft: theme.layout.iconTextGap, marginTop: 3 }}
          />
        ) : null}
      </View>
      {betaVideoCount > 0 ? (
        <AppText variant="caption1" color="textSecondary" numberOfLines={1}>
          {t('routeCard.betaCount', { count: betaVideoCount })}
        </AppText>
      ) : null}
    </View>
  );

  const bookmark = (
    <Animated.View
      style={{
        transform: popTransform,
        transformOrigin: 'top',
      }}
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
        onPress={() => {
          haptic(isSaved ? 'select' : 'toggle', `bookmark-${route.id}`);
          onBookmarkToggle?.();
        }}
      />
    </Animated.View>
  );

  return (
    <Card
      variant="static"
      padding={theme.spacing.smd}
      style={{ minHeight: THUMB + 2 * theme.spacing.smd }}
    >
      {/* Card body: a full-card pressable. Siblings (text, bookmark, thumbnail) are layered above. */}
      <PressableScale
        feedback="row"
        inScroll
        pressedColor={c.surfacePressed}
        onPress={onPress}
        onPressIn={() => pressDisc(true)}
        onPressOut={() => pressDisc(false)}
        accessibilityRole="button"
        accessibilityLabel={bodyLabel}
        accessibilityHint={t('routeCard.openHint')}
        style={[StyleSheet.absoluteFill, { borderRadius: theme.borderRadius.lg }]}
      />

      {isAx ? (
        <View pointerEvents="box-none" style={styles.axColumn}>
          <View pointerEvents="box-none" style={styles.leftColumn}>
            {textBlock}
            {bookmark}
          </View>
          <View pointerEvents="none" style={[styles.axThumb, { marginTop: theme.spacing.sm }]}>
            {thumb}
          </View>
        </View>
      ) : (
        <View pointerEvents="box-none" style={styles.row}>
          <View pointerEvents="box-none" style={styles.leftColumn}>
            {textBlock}
            {bookmark}
          </View>
          <View pointerEvents="none" style={{ marginLeft: theme.spacing.smd }}>
            {thumb}
          </View>
        </View>
      )}
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
  axColumn: {
    flex: 1,
  },
  axThumb: {
    alignSelf: 'flex-end',
  },
  leftColumn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  textBlock: {
    flex: 1,
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  nameText: {
    flexShrink: 1,
  },
  thumbBox: {
    width: THUMB,
    height: THUMB,
  },
  thumb: {
    width: THUMB,
    height: THUMB,
  },
});
