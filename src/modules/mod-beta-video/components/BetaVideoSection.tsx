/**
 * BetaVideoSection — the public entry point for MOD-005 on RouteDetailScreen.
 *
 * This component:
 *   1. Fetches beta videos for the given route.
 *   2. Renders a three-column thumbnail grid via the shared BetaVideoGrid component (AC-038).
 *   3. Opens the fullscreen reel viewer when a grid cell is tapped (AC-039).
 *   4. Exposes upload flow via BetaVideoUploader (AC-037 / AC-130).
 *
 * RouteDetailScreen imports ONLY this component from mod-beta-video (cross-module
 * import rule: never import internal screens/ or components/ directly from another
 * module — import only the public entry-point component).
 *
 * AC-032: each BetaVideo is attached to exactly one route (route_id pre-filled).
 * AC-033: inline playback without leaving the app.
 * AC-036: upload progress overlay owned entirely by BetaVideoUploader (single
 *         implementation, no duplicate modal here).
 * AC-037: upload flow is owned entirely by BetaVideoUploader — this component
 *         never contains picker/upload logic of its own.
 * AC-038: three-column thumbnail grid with camera-icon overlay (shared BetaVideoGrid).
 * AC-039: fullscreen reel viewer opened on thumbnail tap.
 *
 * AC-130: When `onRegisterUploadLauncher` is provided, BetaVideoUploader's
 * handleSelectVideo is registered via onRegisterSelectHandler so the AC-130
 * header button in RouteDetailScreen invokes the single, canonical upload
 * implementation — with AC-166 dialog, AC-169 size gate, and all other ACs.
 * BetaVideoUploader is always in the render tree; hideButton=true suppresses
 * its visible button in AC-130 mode (trigger is the header button).
 *
 * Tech Lead decisions (Rev 13):
 * - Grid cells show a neutral placeholder + camera icon (no VideoView per cell,
 *   no frame-extraction library — AC-031 Phase 1 simplification). Cell rendering
 *   is now delegated to the shared BetaVideoGrid component (Fix 3).
 * - Signed URLs for grid thumbnails are not fetched (thumbnail_url is a video
 *   path, not an image — Phase 1 placeholder). The reel viewer lazy-loads the
 *   signed video URL for the current video only.
 * - openIndex state: null = closed, N = viewer open at index N.
 */

import type { Session } from '@supabase/supabase-js';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { supabase } from '../../../lib/supabase';
import { useTheme } from '../../../lib/theme';
import { fetchBlockedUserIds } from '../../mod-moderation/moderation-service';
import { fetchBetaVideosForRoute } from '../beta-video-service';
import type { BetaVideo } from '../types';
import BetaVideoGrid from './BetaVideoGrid';
import BetaVideoReelViewer from './BetaVideoReelViewer';
import BetaVideoUploader from './BetaVideoUploader';

/** Horizontal padding applied to the section container (matches paddingHorizontal in styles). */
const GRID_PADDING = 16;

interface BetaVideoSectionProps {
  /** The route whose beta videos to display. Pre-attached to the uploader (AC-037). */
  routeId: string;
  /** Authenticated session — used to derive userId for uploads. */
  session: Session;
  /**
   * AC-130: When provided, BetaVideoSection registers its upload launcher with the
   * parent so that the AC-130 action row button in RouteDetailScreen can trigger the
   * MOD-005 upload flow. No internal upload button is rendered in this section in
   * that case — the trigger lives in RouteDetailScreen's action row only.
   * The upload flow itself remains owned by MOD-005 (this component).
   */
  onRegisterUploadLauncher?: (launcher: () => void) => void;
  /**
   * AC-134: Route name displayed in Row 2 of the reel viewer overlay.
   * Passed through to BetaVideoReelViewer.
   */
  routeName?: string;
  /**
   * AC-134: Gym name displayed in Row 2 of the reel viewer overlay.
   * Passed through to BetaVideoReelViewer.
   */
  gymName?: string;
  /**
   * AC-136: Called when the user taps Row 2 in the reel viewer. Receives the
   * route_id of the current video. Omit when the host screen is already the
   * route detail screen (tap becomes a no-op).
   */
  onNavigateToRoute?: (routeId: string) => void;
  /**
   * AC-135 (revised): Called when the user taps Row 1 (avatar or display_name)
   * in the reel viewer. Receives the user_id of the poster.
   * Passed through to BetaVideoReelViewer unchanged.
   */
  onNavigateToUser?: (userId: string) => void;
  /**
   * Fix 2 (error placement): When provided, upload errors are forwarded to this
   * callback instead of being displayed inline inside BetaVideoSection. The
   * caller (RouteDetailScreen) renders the error message in its own action row.
   * When absent, the inline error message inside BetaVideoUploader is shown.
   */
  onUploadError?: (message: string) => void;
}

export default function BetaVideoSection({
  routeId,
  session,
  onRegisterUploadLauncher,
  routeName,
  gymName,
  onNavigateToRoute,
  onNavigateToUser,
  onUploadError,
}: BetaVideoSectionProps): React.JSX.Element {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const styles = makeStyles(theme);

  const [betaVideos, setBetaVideos] = useState<BetaVideo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // AC-039: null = viewer closed, N = viewer open at grid index N.
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  /**
   * AC-130: ref that holds BetaVideoUploader's handleSelectVideo once it
   * registers via onRegisterSelectHandler. When onRegisterUploadLauncher is
   * provided, BetaVideoSection wires this ref through to the parent so the
   * header button calls the single canonical upload implementation.
   */
  const selectHandlerRef = useRef<(() => Promise<void>) | null>(null);

  const loadVideos = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setLoadError(null);
    try {
      // AC-154: fetch beta videos and blocked user IDs in parallel to avoid
      // adding latency. If fetchBlockedUserIds fails, log and default to an
      // empty set so video loading is not broken.
      const [rows, blockedIds] = await Promise.all([
        fetchBetaVideosForRoute(routeId),
        fetchBlockedUserIds().catch((err: unknown) => {
          console.error('[BetaVideoSection] fetchBlockedUserIds failed:', err);
          return new Set<string>();
        }),
      ]);

      // AC-154: filter out videos uploaded by blocked users (either direction).
      const afterBlockFilter = rows.filter((v) => !blockedIds.has(v.user_id));

      // AC-158: filter out followers-only videos from non-followers.
      // Collect poster IDs whose privacy is 'followers_only' and who are not the
      // current viewer (viewers always see their own videos).
      const currentUserId = session.user.id;
      const followersOnlyPosterIds = afterBlockFilter
        .filter(
          (v) =>
            v.beta_video_privacy === 'followers_only' && v.user_id !== currentUserId,
        )
        .map((v) => v.user_id);

      // Batch-check follow status for all affected poster IDs in one query.
      let followedPosterIds = new Set<string>();
      if (followersOnlyPosterIds.length > 0) {
        const { data: followRows } = await supabase
          .from('follows')
          .select('followee_id')
          .eq('follower_id', currentUserId)
          .in('followee_id', followersOnlyPosterIds);
        followedPosterIds = new Set(
          (followRows ?? []).map((r: { followee_id: string }) => r.followee_id),
        );
      }

      // Apply AC-158 filter: exclude videos where poster is followers_only AND
      // viewer is not the poster AND viewer does not follow the poster.
      const afterPrivacyFilter = afterBlockFilter.filter((v) => {
        if (v.beta_video_privacy !== 'followers_only') return true;
        if (v.user_id === currentUserId) return true; // viewer is the poster
        return followedPosterIds.has(v.user_id); // viewer follows the poster
      });

      setBetaVideos(afterPrivacyFilter);
    } catch {
      setLoadError(t('betaVideo.errors.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [routeId, session.user.id, t]);

  useEffect(() => {
    void loadVideos();
  }, [loadVideos]);

  /**
   * AC-037: after a successful upload, prepend the new video to the list so it
   * appears without a full reload (newest-first order matches fetchBetaVideosForRoute).
   *
   * Fix 1 (stale UI after replace): On a replace (upsert), the old row for the same
   * (user_id, route_id) pair is already gone at the DB level. Filter it out of local
   * state before prepending the new video so we never show two rows for the same pair.
   */
  const handleUploadSuccess = useCallback((video: BetaVideo): void => {
    setBetaVideos((prev) => [
      video,
      ...prev.filter(
        (v) => !(v.user_id === video.user_id && v.route_id === video.route_id),
      ),
    ]);
  }, []);

  /**
   * AC-130: Called by BetaVideoUploader once handleSelectVideo is stable.
   * Stores the function in selectHandlerRef, then registers it with the parent
   * (onRegisterUploadLauncher) so the header button invokes the single canonical
   * upload implementation — including AC-166 dialog and AC-169 size gate.
   * Uses a stable ref wrapper to avoid re-registering on every render.
   */
  const handleRegisterSelectHandler = useCallback(
    (fn: () => Promise<void>): void => {
      selectHandlerRef.current = fn;
      if (onRegisterUploadLauncher) {
        onRegisterUploadLauncher(() => { void selectHandlerRef.current?.(); });
      }
    },
    [onRegisterUploadLauncher],
  );

  /** AC-039: called by BetaVideoGrid when a cell is tapped. */
  const handlePressVideo = useCallback((index: number): void => {
    setOpenIndex(index);
  }, []);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={theme.colors.primary} size="small" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Section header */}
      <Text style={styles.sectionTitle}>{t('betaVideo.sectionTitle')}</Text>

      {/* Load error (non-fatal) */}
      {loadError ? (
        <Text style={styles.errorText}>{loadError}</Text>
      ) : null}

      {/*
       * AC-038: Three-column thumbnail grid — shared BetaVideoGrid component (Fix 3).
       * horizontalPadding={GRID_PADDING} matches the container's paddingHorizontal so
       * cell sizes are computed correctly for this context.
       * emptyState renders the "no videos" message when the list is empty.
       */}
      <BetaVideoGrid
        videos={betaVideos}
        onPressVideo={handlePressVideo}
        horizontalPadding={GRID_PADDING}
        emptyState={
          !loadError ? (
            <Text style={styles.emptyText}>{t('betaVideo.noVideos')}</Text>
          ) : undefined
        }
      />

      {/*
       * AC-037 / AC-130: BetaVideoUploader is always in the render tree so that
       * handleSelectVideo (the single upload implementation with AC-166 dialog,
       * AC-169 size gate, and all other ACs) is always active.
       * - AC-130 mode (onRegisterUploadLauncher provided): hideButton=true
       *   suppresses the visible button; the upload trigger is the header button
       *   in RouteDetailScreen, wired via onRegisterSelectHandler → selectHandlerRef
       *   → onRegisterUploadLauncher. Progress modal and all AC logic remain in
       *   BetaVideoUploader.
       * - Legacy mode (no onRegisterUploadLauncher): hideButton defaults to false
       *   and BetaVideoUploader renders its own "Add beta video" button as before.
       * Fix 2: suppressInlineError={!!onUploadError} forwards errors to the parent
       * when the parent handles display; otherwise inline error is shown as before.
       */}
      <BetaVideoUploader
        routeId={routeId}
        userId={session.user.id}
        onUploadSuccess={handleUploadSuccess}
        onUploadError={onUploadError}
        onRegisterSelectHandler={
          onRegisterUploadLauncher ? handleRegisterSelectHandler : undefined
        }
        hideButton={!!onRegisterUploadLauncher}
        suppressInlineError={!!onUploadError}
      />

      {/* AC-039: Fullscreen reel viewer (Modal) */}
      <BetaVideoReelViewer
        videos={betaVideos}
        initialIndex={openIndex ?? 0}
        visible={openIndex !== null}
        onDismiss={() => { setOpenIndex(null); }}
        session={session}
        routeName={routeName}
        gymName={gymName}
        onNavigateToRoute={onNavigateToRoute}
        onNavigateToUser={onNavigateToUser}
      />
    </View>
  );
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function makeStyles(theme: ReturnType<typeof useTheme>['theme']) {
  return StyleSheet.create({
    container: {
      marginTop: theme.spacing.xl,
      paddingHorizontal: GRID_PADDING,
    },
    loadingContainer: {
      marginTop: theme.spacing.xl,
      alignItems: 'center',
      paddingVertical: theme.spacing.md,
    },
    sectionTitle: {
      fontSize: theme.fontSize.xs,
      fontWeight: theme.fontWeight.semibold,
      color: theme.colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: theme.spacing.md,
    },
    emptyText: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.textDisabled,
      marginBottom: theme.spacing.sm,
    },
    errorText: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.error,
      marginBottom: theme.spacing.sm,
    },
  });
}
