/**
 * RouteDetailScreen.
 *
 * Shows the full detail of a single route:
 *   - Large title "{Colour} · {Section}" (RD-2: no grade, the badge carries it, AC-191) with the gym
 *     name as subtitle beneath it (AC-125). The header title appears only after the large title
 *     scrolls off.
 *   - Photo, status (active/retired)
 *   - One inline send-summary line "Sends 2 · Attempts 4" (RD-4, AC-127 wording), tappable (AC-128)
 *   - One full-width primary Record Send button (RD-1, AC-130 change). The upload entry lives in the
 *     Beta section header / empty-state tile owned by BetaVideoSection.
 *   - Beta video section (MOD-005)
 *   - Added date as footer at the bottom (AC-126)
 *
 * Data refresh: uses a plain useEffect on mount. RouteNavigator renders this
 * screen conditionally (unmounts on navigate-away, remounts on navigate-back),
 * so useEffect fires on every mount — equivalent to the "every focus" behaviour
 * useFocusEffect would provide, without requiring a NavigationContainer ancestor
 * (which RouteNavigator, a useState-based state machine, does not provide).
 * The loading spinner is shown only on the very first mount (when no data is
 * cached); subsequent mount-triggered refreshes update state in the background
 * without resetting data to null/[].
 *
 * AC-045: route display name composed as "{grade} {LocalizedColor} ({section_label}?)".
 * AC-046: bookmark toggle (filled yellow = saved; outline gray = unsaved) in header;
 *         optimistic update; achievement icon next to route name.
 * AC-125: gym name as subtitle directly beneath the route name; no "岩館" section label.
 * AC-126: added date as footer at the very bottom of the ScrollView.
 * AC-127: inline send summary (Sends / Attempts) from summarizeAscents.
 * AC-128: tapping the summary line navigates to SendHistoryDetailScreen.
 * AC-130 (page-review RD-1): a single primary Record Send button. BetaVideoSection renders the
 *         upload entry itself once it has a launcher registered (onRegisterUploadLauncher).
 *
 * Note: Route retirement is now admin-only via Supabase Studio (AC-024b).
 * The retire button and retireRoute() call have been removed.
 *
 * Ascent fetch: uses fetchMyAscentsForRoute instead of loadAscentsForRoute so the
 * list is scoped to the current user's own sends.
 */

import type { Session } from '@supabase/supabase-js';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Image, Modal, ScrollView, StyleSheet, View } from 'react-native';
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

import SwipeBackWrapper from '../../../components/SwipeBackWrapper';
import {
  AppText,
  Button,
  IconButton,
  InlineError,
  PressableScale,
  Spinner,
} from '../../../components/ui';
import { ICON } from '../../../lib/icons';
import { CONTINUOUS, useLayout, useTheme } from '../../../lib/theme';
import { useAppHeader, useTabBarInset } from '@/lib/AppHeaderContext';
import RouteColorBadge from '../components/RouteColorBadge';
import { BetaVideoSection } from '../../mod-beta-video';
import { LogSendScreen } from '../../mod-send-logging';
import {
  fetchMyAscentsForRoute,
  fetchUserAchievements,
  summarizeAscents,
} from '../../mod-send-logging';
import type { AscentWithProfile } from '../../mod-send-logging';
import { fetchSavedRouteIds, getPhotoSignedUrl, loadRoute, saveRoute, unsaveRoute, upsertRouteVisit } from '../route-service';
import type { Route, RouteColor } from '../types';

/**
 * AC-045: Compose the display name for a route at render time.
 * Format: "{grade} {LocalizedColor}" or "{grade} {LocalizedColor} ({section_label})".
 * The color string uses the i18n routeCatalog.colors.<color_tag> key.
 */
function formatRouteName(
  grade: string,
  colorTag: RouteColor,
  sectionLabel: string | null,
  t: TFunction,
): string {
  const color = t(`routeCatalog.colors.${colorTag}`);
  const base = `${grade} ${color}`;
  return sectionLabel ? `${base} (${sectionLabel})` : base;
}

type AchievementStyle = 'flash' | 'top' | 'attempt';

interface RouteDetailScreenProps {
  routeId: string;
  gymName: string;
  session: Session;
  onBack: () => void;
  /** AC-128: navigates to the Send History Detail screen for this route. */
  onViewSendHistory: (routeId: string) => void;
  /**
   * AC-135 (revised): Called when the user taps Row 1 of the reel viewer.
   * Receives the user_id of the video poster. Threaded through to BetaVideoSection
   * and then to BetaVideoReelViewer.
   */
  onNavigateToUser?: (userId: string) => void;
}

export default function RouteDetailScreen({
  routeId,
  gymName,
  session,
  onBack,
  onViewSendHistory,
  onNavigateToUser,
}: RouteDetailScreenProps): React.JSX.Element {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const { screenMargin } = useLayout();
  const styles = makeStyles(theme, screenMargin);
  const tabInset = useTabBarInset();

  const [route, setRoute] = useState<Route | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLogSendVisible, setIsLogSendVisible] = useState(false);

  // AC-046: bookmark state
  const [isSaved, setIsSaved] = useState(false);

  // AC-046: achievement icon for this route
  const [achievement, setAchievement] = useState<AchievementStyle | null>(null);

  // My sends — scoped to the current user only (fetchMyAscentsForRoute).
  // Used to compute the AC-127 summary cards via summarizeAscents.
  const [myAscents, setMyAscents] = useState<AscentWithProfile[]>([]);

  // Upload error message — shown between the Record Send button and BetaVideoSection.
  // Set by onUploadError from BetaVideoSection; cleared when a new upload attempt begins.
  const [uploadErrorMessage, setUploadErrorMessage] = useState<string | null>(null);

  /**
   * Tracks whether at least one successful data fetch has completed.
   * Used to suppress the loading spinner on re-focus background refreshes —
   * the spinner is shown only during the very first load (when no route data
   * is cached yet). A ref (not state) avoids triggering an extra re-render.
   */
  const hasLoadedOnceRef = useRef<boolean>(false);

  /**
   * RD-1: upload entry lives inside BetaVideoSection (section header + empty tile). Passing
   * onRegisterUploadLauncher puts the section in "host-driven" mode: it hides the legacy inline
   * button and renders its own header / empty-state triggers. The launcher itself is not needed here.
   */
  const handleRegisterUploadLauncher = useCallback((): void => {
    // intentionally empty: BetaVideoSection invokes its own launcher
  }, []);

  // RD-2: the header title appears only once the large title has scrolled off.
  const titleBottomRef = useRef<number>(48);
  const [showHeaderTitle, setShowHeaderTitle] = useState(false);
  const handleTitleLayout = useCallback((e: LayoutChangeEvent): void => {
    titleBottomRef.current = e.nativeEvent.layout.y + e.nativeEvent.layout.height;
  }, []);
  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>): void => {
    setShowHeaderTitle(e.nativeEvent.contentOffset.y > titleBottomRef.current);
  }, []);

  /**
   * Fetch the current user's ascents for this route.
   * Separated from fetchRoute so it can be re-called independently after
   * a successful log (AC-013) without reloading the full route detail.
   * Result is used to compute the AC-127 summary cards via summarizeAscents.
   */
  const fetchMyAscents = useCallback(async (): Promise<void> => {
    try {
      const data = await fetchMyAscentsForRoute(routeId);
      setMyAscents(data);
    } catch {
      // Non-fatal: summary cards will show 0 if fetch fails.
    }
  }, [routeId]);

  const fetchRoute = useCallback(async (): Promise<void> => {
    // Only show the loading spinner on the very first load. On re-focus
    // refetches (after navigating back to this screen) the spinner is suppressed
    // so existing data remains visible while fresh data loads in the background.
    if (!hasLoadedOnceRef.current) {
      setIsLoading(true);
    }
    setErrorMessage(null);
    try {
      // Fetch route detail, saved status, and current user's ascents in parallel.
      const [data, savedIds] = await Promise.all([
        loadRoute(routeId),
        fetchSavedRouteIds(),
      ]);

      if (!data) {
        setErrorMessage(t('routes.errors.notFound'));
      } else {
        // Mark that we have successfully loaded data at least once. After this
        // point, re-focus refetches will update state silently (no spinner).
        hasLoadedOnceRef.current = true;
        setRoute(data);
        setIsSaved(savedIds.includes(routeId));

        // Generate a signed URL for the private route-photos bucket.
        if (data.photo_url) {
          try {
            const signed = await getPhotoSignedUrl(data.photo_url);
            setPhotoUri(signed);
          } catch {
            // Non-fatal: photo simply won't render if signing fails.
            setPhotoUri(null);
          }
        } else {
          setPhotoUri(null);
        }

        // AC-046: fetch achievement icon for this route
        try {
          const ach = await fetchUserAchievements([routeId]);
          const style = ach[routeId] as AchievementStyle | undefined;
          setAchievement(style ?? null);
        } catch {
          // Achievement overlay is best-effort — silently ignore failures
        }
      }
    } catch {
      setErrorMessage(t('routes.errors.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [routeId, t]);

  // Fetch data on mount. RouteNavigator renders RouteDetailScreen conditionally
  // (unmounts on navigate-away, remounts on navigate-back), so a plain useEffect
  // fires on every mount — equivalent to useFocusEffect without requiring a
  // NavigationContainer ancestor (which this navigator does not provide).
  //
  // AC-179: fire-and-forget upsert of the user_route_visits row so that
  // last_viewed_at is stamped whenever this screen opens. The upsert is
  // non-blocking and non-critical — errors are swallowed inside upsertRouteVisit.
  useEffect(() => {
    void fetchRoute();
    void fetchMyAscents();
    upsertRouteVisit(routeId);
  }, [fetchRoute, fetchMyAscents, routeId]);

  /**
   * AC-046: Optimistic bookmark toggle.
   * Flips the icon immediately, fires the DB write async, reverts on error.
   */
  const handleBookmarkToggle = useCallback(async (): Promise<void> => {
    const wasSaved = isSaved;
    setIsSaved(!wasSaved);
    try {
      if (wasSaved) {
        await unsaveRoute(routeId);
      } else {
        await saveRoute(routeId);
      }
    } catch {
      // Revert optimistic update on failure
      setIsSaved(wasSaved);
    }
  }, [routeId, isSaved]);

  function handleLogSendPress(): void {
    setIsLogSendVisible(true);
  }

  function handleLogSendSuccess(): void {
    setIsLogSendVisible(false);
    // AC-013: re-fetch the user's own ascents so the list reflects the new send.
    void fetchMyAscents();
  }

  function handleLogSendCancel(): void {
    setIsLogSendVisible(false);
  }

  useAppHeader({
    title: route && showHeaderTitle ? formatRouteName(route.grade, route.color_tag, route.section_label, t) : '',
    onBack,
    trailing: route ? (
      <IconButton
        variant="float"
        name={isSaved ? ICON.bookmark.filled : ICON.bookmark.outline}
        size={24}
        onPress={() => { void handleBookmarkToggle(); }}
        accessibilityLabel={
          isSaved
            ? t('routeCatalog.bookmark.unsave')
            : t('routeCatalog.bookmark.save')
        }
      />
    ) : undefined,
  });

  if (isLoading) {
    return (
      <SwipeBackWrapper onBack={onBack}>
        <View style={styles.centeredContainer}>
          <Spinner />
        </View>
      </SwipeBackWrapper>
    );
  }

  if (errorMessage || !route) {
    return (
      <SwipeBackWrapper onBack={onBack}>
        <View style={styles.root}>
          <View style={styles.errorBlock}>
            <InlineError
              variant="block"
              message={errorMessage ?? t('common.error')}
              actionLabel={t('common.retry')}
              onAction={fetchRoute}
            />
          </View>
        </View>
      </SwipeBackWrapper>
    );
  }

  const isRetired = route.status === 'retired';
  // AC-045: composed route display name
  const routeName = formatRouteName(route.grade, route.color_tag, route.section_label, t);

  // AC-127: derive send summary client-side from already-fetched ascents
  const summary = summarizeAscents(myAscents);

  // RD-2: large title is "{Colour} · {Section}" (grade lives in the badge); AC-045 name stays for the
  // collapsed header title, the Log Send card and the reel viewer.
  const colourName = t(`routeCatalog.colors.${route.color_tag}`);
  const largeTitle = route.section_label ? `${colourName} · ${route.section_label}` : colourName;
  const summaryLabel = `${t('routeCatalog.detail.sends')} ${summary.sends}, ${t('routeCatalog.detail.attemptsShort')} ${summary.attempts}`;

  // AC-126: format the added date
  const addedDateStr = new Date(route.created_at).toISOString().slice(0, 10); // YYYY-MM-DD
  const addedDateLabel = t('routeCatalog.detail.addedDate', { date: addedDateStr });

  return (
    <SwipeBackWrapper onBack={onBack} enabled={!isLogSendVisible}>
    <View style={styles.root}>
      <ScrollView
        style={styles.scrollView}
        testID="route-detail-scroll"
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={[styles.contentContainer, { paddingBottom: theme.spacing.xxl + tabInset.contentBottom }]}
        scrollIndicatorInsets={{ bottom: tabInset.indicatorBottom }}
      >

      {/* Route photo — rendered only when a signed URL was successfully generated. */}
      {photoUri ? (
        <Image
          source={{ uri: photoUri }}
          style={styles.photo}
          accessibilityLabel={`${route.grade} ${t(`routeCatalog.colors.${route.color_tag}`)} route photo`}
          accessibilityIgnoresInvertColors
          resizeMode="cover"
        />
      ) : null}

      {/* Title block: RD-2 large title "{Colour} · {Section}" (no grade) + AC-046 achievement icon,
           AC-125 gym subtitle with the tape badge (the badge carries the grade, AC-191). */}
      <View style={styles.titleBlock} onLayout={handleTitleLayout}>
        {/* Status badge (retired only — active is the default state) */}
        {isRetired && (
          <View style={styles.retiredStatusBadge}>
            <AppText variant="footnote" weight="600" color="textSecondary">
              {t('routes.status.retired')}
            </AppText>
          </View>
        )}
        <View style={styles.routeNameRow}>
          <AppText variant="title1" style={styles.routeNameText}>{largeTitle}</AppText>
          {achievement === 'flash' ? (
            <Ionicons name={ICON.sendFlash.filled} size={theme.iconSize.md} color={theme.colors.sendFlash} />
          ) : achievement === 'top' ? (
            <Ionicons name={ICON.sendTop.filled} size={theme.iconSize.md} color={theme.colors.sendTop} />
          ) : achievement === 'attempt' ? (
            <Ionicons name={ICON.sendAttempt.outline} size={theme.iconSize.md} color={theme.colors.textSecondary} />
          ) : null}
        </View>
        <View style={styles.subtitleRow}>
          <RouteColorBadge color={route.color_tag} grade={route.grade} size="lg" />
          <AppText variant="body" color="textSecondary" style={styles.gymSubtitle}>{gymName}</AppText>
        </View>
      </View>

      {/* Retired info */}
      {isRetired && route.retired_at ? (
        <View>
          <AppText variant="pageSection">{t('routes.detail.retiredOn')}</AppText>
          <AppText variant="body">{new Date(route.retired_at).toLocaleDateString()}</AppText>
        </View>
      ) : null}

      {/* ── RD-4 / AC-127: one inline send summary line, tap → Send History (AC-128) ── */}
      <PressableScale
        feedback="row"
        pressedColor={theme.colors.surfacePressed}
        style={styles.summaryLine}
        onPress={() => { onViewSendHistory(route.id); }}
        accessibilityRole="button"
        accessibilityLabel={summaryLabel}
        testID="send-summary-line"
      >
        <AppText variant="subhead" color="textSecondary" style={styles.summaryText}>
          {t('routeCatalog.detail.sends')}{' '}
          <AppText variant="subhead" weight="600" numeric>{summary.sends}</AppText>
          {' · '}
          {t('routeCatalog.detail.attemptsShort')}{' '}
          <AppText variant="subhead" weight="600" numeric>{summary.attempts}</AppText>
        </AppText>
        <Ionicons name={ICON.forward.outline} size={theme.iconSize.sm} color={theme.colors.textSecondary} />
      </PressableScale>

      {/* ── RD-1 / AC-130: one full-width primary action ─────────────────────── */}
      <Button
        variant="primary"
        size="lg"
        fullWidth
        icon={ICON.log.outline}
        label={t('routeCatalog.detail.recordSend')}
        onPress={handleLogSendPress}
      />

      {/* Log Send modal — opens on tap of the AC-130 "Record Send" button */}
      <Modal
        visible={isLogSendVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleLogSendCancel}
      >
        <LogSendScreen
          routeId={route.id}
          routeGrade={route.grade}
          routeSummary={{
            color: route.color_tag,
            grade: route.grade,
            title: routeName,
            subtitle: gymName,
            photoUri: photoUri ?? undefined,
          }}
          session={session}
          onSuccess={handleLogSendSuccess}
          onCancel={handleLogSendCancel}
        />
      </Modal>

      {/* Upload error — rendered between the Record Send button and BetaVideoSection
           so it is visible without scrolling into the beta video section. */}
      {uploadErrorMessage ? (
        <InlineError variant="block" message={uploadErrorMessage} />
      ) : null}

      {/* ── Beta Videos (MOD-005) — AC-033, AC-037 ───────────────────────────
           BetaVideoSection is the public entry point imported from mod-beta-video.
           RD-1: onRegisterUploadLauncher puts the section in host-driven mode; it
           renders the upload entry in its own header / empty-state tile.
           onUploadError: forwards file-too-large / video-too-long errors to
           this screen so they render between the Record Send button and the section. */}
      <BetaVideoSection
        routeId={route.id}
        session={session}
        onRegisterUploadLauncher={handleRegisterUploadLauncher}
        onUploadError={(msg) => { setUploadErrorMessage(msg || null); }}
        routeName={routeName}
        routeColor={route.color_tag}
        routeGrade={route.grade}
        gymName={gymName}
        onNavigateToUser={onNavigateToUser}
      />

      {/* ── AC-126: Added date footer ─────────────────────────────────────── */}
      <AppText variant="footnote" color="textSecondary" align="center">
        {addedDateLabel}
      </AppText>

      </ScrollView>
    </View>
    </SwipeBackWrapper>
  );
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function makeStyles(theme: ReturnType<typeof useTheme>['theme'], screenMargin: number) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollView: {
      flex: 1,
    },
    // R0: the scroll container owns the margin and the gaps; children set none.
    contentContainer: {
      paddingTop: theme.spacing.md,
      paddingHorizontal: screenMargin,
      paddingBottom: theme.spacing.xxl,
      gap: theme.layout.sectionGap,
    },
    centeredContainer: {
      flex: 1,
      backgroundColor: theme.colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: screenMargin,
    },
    errorBlock: {
      paddingHorizontal: screenMargin,
      paddingTop: theme.spacing.md,
    },
    photo: {
      width: '100%',
      height: 280,
      borderRadius: theme.radius.card,
      ...CONTINUOUS,
      backgroundColor: theme.colors.surfaceAlt,
    },
    titleBlock: {
      gap: theme.spacing.xs,
    },
    retiredStatusBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xxs,
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors.surfaceAlt,
    },
    routeNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    // AC-125: large title for the route name
    routeNameText: {
      flexShrink: 1,
    },
    // AC-125: gym name as subtitle beneath the route name; tape badge before it
    subtitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      columnGap: theme.layout.inlineGap,
    },
    gymSubtitle: {
      flexShrink: 1,
    },
    // ── RD-4: inline send summary (44pt hit area) ─────────────────────────────
    summaryLine: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: theme.layout.minTouchTarget,
    },
    summaryText: {
      flexShrink: 1,
    },
  });
}
