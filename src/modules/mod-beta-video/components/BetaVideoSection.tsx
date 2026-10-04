/**
 * BetaVideoSection — the public entry point for MOD-005 on RouteDetailScreen.
 *
 * This component:
 *   1. Fetches beta videos for the given route.
 *   2. Renders a three-column thumbnail grid (AC-038).
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
 * AC-038: three-column thumbnail grid with camera-icon overlay.
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
 * - Grid cells show a neutral placeholder (#1C1C1E) + camera icon (no VideoView
 *   per cell, no frame-extraction library — AC-031 Phase 1 simplification).
 * - Signed URLs for grid thumbnails are not fetched (thumbnail_url is a video
 *   path, not an image — Phase 1 placeholder). The reel viewer lazy-loads the
 *   signed video URL for the current video only.
 * - openIndex state: null = closed, N = viewer open at index N.
 */

import type { Session } from '@supabase/supabase-js';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { supabase } from '../../../lib/supabase';
import { useTheme } from '../../../lib/theme';
import { fetchBlockedUserIds } from '../../mod-moderation/moderation-service';
import { fetchBetaVideosForRoute } from '../beta-video-service';
import type { BetaVideo } from '../types';
import BetaVideoReelViewer from './BetaVideoReelViewer';
import BetaVideoUploader from './BetaVideoUploader';

/** Number of columns in the thumbnail grid (AC-038). */
const NUM_COLUMNS = 3;

/**
 * Cell size: one third of the screen width minus any padding.
 * This is static (screen width does not change for portrait-locked iOS).
 */
const SCREEN_WIDTH = Dimensions.get('window').width;
const GRID_PADDING = 16; // left + right padding for the section container
const GRID_GAP = 2;      // gap between cells
const CELL_SIZE = (SCREEN_WIDTH - GRID_PADDING * 2 - GRID_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

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
}

export default function BetaVideoSection({
  routeId,
  session,
  onRegisterUploadLauncher,
  routeName,
  gymName,
  onNavigateToRoute,
  onNavigateToUser,
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
   */
  const handleUploadSuccess = useCallback((video: BetaVideo): void => {
    setBetaVideos((prev) => [video, ...prev]);
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

  /** AC-038: render a single grid cell (thumbnail placeholder + camera icon). */
  const renderCell = useCallback(
    ({ item, index }: { item: BetaVideo; index: number }): React.JSX.Element => (
      <Pressable
        style={styles.gridCell}
        onPress={() => { setOpenIndex(index); }}
        accessibilityRole="button"
        accessibilityLabel={t('betaVideo.grid.openVideo', { index: index + 1 })}
        testID={`beta-video-grid-cell-${item.id}`}
      >
        {/* Phase 1: neutral placeholder background (thumbnail_url is a video path,
            not an image — Tech Lead decision 6). */}
        <View style={styles.thumbnailPlaceholder} />
        {/* Camera-icon overlay (top-left) — "this is a video" affordance (AC-038). */}
        <View style={styles.cameraIconContainer}>
          <Ionicons name="videocam" size={14} color={theme.colors.textInverse} />
        </View>
      </Pressable>
    ),
    [styles, t, theme],
  );

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

      {/* Empty state */}
      {!loadError && betaVideos.length === 0 ? (
        <Text style={styles.emptyText}>{t('betaVideo.noVideos')}</Text>
      ) : null}

      {/* AC-038: Three-column thumbnail grid */}
      {betaVideos.length > 0 ? (
        <FlatList
          data={betaVideos}
          keyExtractor={(item) => item.id}
          renderItem={renderCell}
          numColumns={NUM_COLUMNS}
          scrollEnabled={false}
          columnWrapperStyle={styles.gridRow}
          style={styles.grid}
          testID="beta-video-grid"
        />
      ) : null}

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
       */}
      <BetaVideoUploader
        routeId={routeId}
        userId={session.user.id}
        onUploadSuccess={handleUploadSuccess}
        onRegisterSelectHandler={
          onRegisterUploadLauncher ? handleRegisterSelectHandler : undefined
        }
        hideButton={!!onRegisterUploadLauncher}
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
    grid: {
      marginBottom: theme.spacing.sm,
    },
    gridRow: {
      gap: GRID_GAP,
      marginBottom: GRID_GAP,
    },
    gridCell: {
      width: CELL_SIZE,
      height: CELL_SIZE,
      position: 'relative',
      overflow: 'hidden',
      borderRadius: theme.borderRadius.sm,
    },
    thumbnailPlaceholder: {
      width: '100%',
      height: '100%',
      backgroundColor: theme.colors.surface,
    },
    cameraIconContainer: {
      position: 'absolute',
      top: 4,
      left: 4,
      width: 22,
      height: 22,
      borderRadius: 4,
      backgroundColor: theme.colors.overlay,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
