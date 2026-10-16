/**
 * RouteDetailScreen.
 *
 * Shows the full detail of a single route:
 *   - Route name (large font) with gym name as subtitle beneath it (AC-125)
 *   - Grade, color badge, photo, status (active/retired)
 *   - Two-column send-summary section: Sends + Attempts (AC-127)
 *   - Two action buttons: Record Send / Upload Beta Video (AC-130)
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
 * AC-127: two-column send summary (Sends / Attempts) from summarizeAscents.
 * AC-128: tapping either summary card navigates to SendHistoryDetailScreen.
 * AC-130: two action buttons (Record Send, Upload Beta Video) below the summary section;
 *         old entry points ("Log Send" button in ascent header, BetaVideoUploader button
 *         inside BetaVideoSection) have been removed.
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
import BetaVideoSection from '../../mod-beta-video/components/BetaVideoSection';
import LogSendScreen from '../../mod-send-logging/screens/LogSendScreen';
import {
  fetchMyAscentsForRoute,
  fetchUserAchievements,
  summarizeAscents,
} from '../../mod-send-logging/send-service';
import type { AscentWithProfile } from '../../mod-send-logging/types';
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

  // Upload error message — shown between the action buttons row and BetaVideoSection.
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
   * AC-130: ref to the BetaVideoSection's upload launcher.
   * BetaVideoSection registers its launch handler here via onRegisterUploadLauncher.
   * The "Upload Beta Video" action button calls this ref when pressed.
   */
  const uploadLauncherRef = useRef<(() => void) | null>(null);

  const handleRegisterUploadLauncher = useCallback((launcher: () => void): void => {
    uploadLauncherRef.current = launcher;
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

  function handleUploadBetaPress(): void {
    // Clear any previous upload error when a new attempt begins.
    setUploadErrorMessage(null);
    uploadLauncherRef.current?.();
  }

  useAppHeader({
    title: route ? formatRouteName(route.grade, route.color_tag, route.section_label, t) : '',
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

  // AC-126: format the added date
  const addedDateStr = new Date(route.created_at).toISOString().slice(0, 10); // YYYY-MM-DD
  const addedDateLabel = t('routeCatalog.detail.addedDate', { date: addedDateStr });

  return (
    <SwipeBackWrapper onBack={onBack} enabled={!isLogSendVisible}>
    <View style={styles.root}>
      <ScrollView
        style={styles.scrollView}
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

      {/* Status badge (retired only — active is the default state) */}
      {isRetired && (
        <View style={styles.retiredStatusBadge}>
          <AppText variant="caption1" weight="600" color="textSecondary">
            {t('routes.status.retired')}
          </AppText>
        </View>
      )}

      {/* AC-125 / AC-045: route name (large) + AC-046: achievement icon */}
      <View style={styles.routeNameRow}>
        <AppText variant="title1" style={styles.routeNameText}>{routeName}</AppText>
        {achievement === 'flash' ? (
          <Ionicons name={ICON.sendFlash.filled} size={theme.iconSize.md} color={theme.colors.sendFlash} />
        ) : achievement === 'top' ? (
          <Ionicons name={ICON.sendTop.filled} size={theme.iconSize.md} color={theme.colors.sendTop} />
        ) : achievement === 'attempt' ? (
          <Ionicons name={ICON.sendAttempt.outline} size={theme.iconSize.md} color={theme.colors.textSecondary} />
        ) : null}
      </View>

      {/* AC-125: gym name as subtitle directly beneath the route name, with the tape badge */}
      <View style={styles.subtitleRow}>
        <RouteColorBadge color={route.color_tag} grade={route.grade} size="lg" />
        <AppText variant="body" color="textSecondary" style={styles.gymSubtitle}>{gymName}</AppText>
      </View>

      {/* Section label (if present) — keep as informational detail */}
      {route.section_label ? (
        <>
          <AppText variant="pageSection" style={styles.sectionLabel}>
            {t('routes.detail.section')}
          </AppText>
          <AppText variant="body">{route.section_label}</AppText>
        </>
      ) : null}

      {/* Retired info */}
      {isRetired && route.retired_at ? (
        <>
          <AppText variant="pageSection" style={styles.sectionLabel}>
            {t('routes.detail.retiredOn')}
          </AppText>
          <AppText variant="body">
            {new Date(route.retired_at).toLocaleDateString()}
          </AppText>
        </>
      ) : null}

      {/* ── AC-127: Two-column send summary ──────────────────────────────────── */}
      <View style={styles.summaryRow}>
        {/* Sends card */}
        <PressableScale
          feedback="row"
          pressedColor={theme.colors.surfacePressed}
          style={styles.summaryCard}
          onPress={() => { onViewSendHistory(route.id); }}
          accessibilityLabel={t('routeCatalog.detail.sends')}
          testID="sends-summary-card"
        >
          <AppText variant="title1" numeric>{summary.sends}</AppText>
          <AppText variant="footnote" color="textSecondary">{t('routeCatalog.detail.sends')}</AppText>
        </PressableScale>
        {/* Attempts card */}
        <PressableScale
          feedback="row"
          pressedColor={theme.colors.surfacePressed}
          style={styles.summaryCard}
          onPress={() => { onViewSendHistory(route.id); }}
          accessibilityLabel={t('routeCatalog.detail.attempts')}
          testID="attempts-summary-card"
        >
          <AppText variant="title1" numeric>{summary.attempts}</AppText>
          <AppText variant="footnote" color="textSecondary">{t('routeCatalog.detail.attempts')}</AppText>
        </PressableScale>
      </View>

      {/* ── AC-130: Action buttons row ───────────────────────────────────────── */}
      <View style={styles.actionRow}>
        <View style={styles.actionCell}>
          <Button
            variant="primary"
            size="md"
            fullWidth
            icon={ICON.log.outline}
            label={t('routeCatalog.detail.recordSend')}
            onPress={handleLogSendPress}
          />
        </View>
        <View style={styles.actionCell}>
          <Button
            variant="secondary"
            size="md"
            fullWidth
            icon={ICON.upload.outline}
            label={t('routeCatalog.detail.uploadBeta')}
            onPress={handleUploadBetaPress}
          />
        </View>
      </View>

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

      {/* Upload error — rendered between the action buttons row and BetaVideoSection
           so it is visible without scrolling into the beta video section. */}
      {uploadErrorMessage ? (
        <InlineError variant="block" message={uploadErrorMessage} style={styles.uploadError} />
      ) : null}

      {/* ── Beta Videos (MOD-005) — AC-033, AC-037 ───────────────────────────
           BetaVideoSection is the public entry point imported from mod-beta-video.
           AC-130: onRegisterUploadLauncher wires the AC-130 "Upload Beta Video"
           button to BetaVideoSection's upload flow, so no upload button is
           rendered inside the section itself.
           onUploadError: forwards file-too-large / video-too-long errors to
           this screen so they render between the action row and the section. */}
      <BetaVideoSection
        routeId={route.id}
        session={session}
        onRegisterUploadLauncher={handleRegisterUploadLauncher}
        onUploadError={(msg) => { setUploadErrorMessage(msg); }}
        routeName={routeName}
        routeColor={route.color_tag}
        routeGrade={route.grade}
        gymName={gymName}
        onNavigateToUser={onNavigateToUser}
      />

      {/* ── AC-126: Added date footer ─────────────────────────────────────── */}
      <AppText variant="footnote" color="textSecondary" align="center" style={styles.addedDateFooter}>
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
    contentContainer: {
      paddingTop: theme.spacing.md,
      paddingHorizontal: screenMargin,
      paddingBottom: theme.spacing.xxl,
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
      marginBottom: theme.spacing.md,
      backgroundColor: theme.colors.surfaceAlt,
    },
    retiredStatusBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xxs,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.surfaceAlt,
      marginBottom: theme.spacing.sm,
    },
    routeNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.xs,
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
      marginBottom: theme.spacing.md,
    },
    gymSubtitle: {
      flexShrink: 1,
    },
    sectionLabel: {
      marginTop: theme.layout.sectionGap,
      marginBottom: theme.spacing.xs,
    },
    // ── AC-127: send summary ──────────────────────────────────────────────────
    summaryRow: {
      flexDirection: 'row',
      gap: theme.layout.cardGap,
      marginTop: theme.layout.sectionGap,
      marginBottom: theme.spacing.sm,
    },
    summaryCard: {
      flex: 1,
      minHeight: theme.layout.minTouchTarget,
      padding: theme.layout.cardPadding,
      borderRadius: theme.radius.card,
      ...CONTINUOUS,
      backgroundColor: theme.colors.surface,
      borderWidth: theme.isDark ? theme.stroke.thin : 0,
      borderColor: theme.colors.border,
      alignItems: 'center',
      ...theme.elevation.card,
    },
    // ── AC-130: action row ────────────────────────────────────────────────────
    actionRow: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
      marginTop: theme.spacing.sm,
      marginBottom: theme.layout.sectionGap,
    },
    actionCell: {
      flex: 1,
    },
    uploadError: {
      marginBottom: theme.spacing.sm,
    },
    // ── AC-126: added date footer ─────────────────────────────────────────────
    addedDateFooter: {
      marginTop: theme.spacing.xl,
    },
  });
}
