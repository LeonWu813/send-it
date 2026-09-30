/**
 * BetaVideoSection — the public entry point for MOD-005 on RouteDetailScreen.
 *
 * This component:
 *   1. Fetches beta videos for the given route.
 *   2. Renders a three-column thumbnail grid (AC-038).
 *   3. Opens the fullscreen reel viewer when a grid cell is tapped (AC-039).
 *   4. Exposes upload flow via BetaVideoUploader (AC-037).
 *
 * RouteDetailScreen imports ONLY this component from mod-beta-video (cross-module
 * import rule: never import internal screens/ or components/ directly from another
 * module — import only the public entry-point component).
 *
 * AC-032: each BetaVideo is attached to exactly one route (route_id pre-filled).
 * AC-033: inline playback without leaving the app.
 * AC-036: upload progress overlay owned by BetaVideoUploader (legacy) or this
 *         component's own progress modal (when onRegisterUploadLauncher provided).
 * AC-037: upload flow launched via BetaVideoUploader when no launcher registration
 *         is used, or via the registered launcher when the AC-130 action row is
 *         the trigger point.
 * AC-038: three-column thumbnail grid with camera-icon overlay.
 * AC-039: fullscreen reel viewer opened on thumbnail tap.
 *
 * AC-130: When `onRegisterUploadLauncher` is provided, this component registers
 * its own upload handler with the parent so the AC-130 action row button in
 * RouteDetailScreen can trigger the MOD-005 upload flow without rendering an
 * internal upload button inside this section. The upload flow and progress modal
 * remain owned by MOD-005 (implemented here via the same service functions).
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
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTheme } from '../../../lib/theme';
import { fetchBetaVideosForRoute, uploadBetaVideo } from '../beta-video-service';
import type { BetaVideo, UploadProgress } from '../types';
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

/** Maximum allowed video duration in seconds (AC-030). */
const MAX_DURATION_SECONDS = 60;

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

  // Upload state used when onRegisterUploadLauncher is provided (AC-130 mode).
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const loadVideos = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const rows = await fetchBetaVideosForRoute(routeId);
      setBetaVideos(rows);
    } catch {
      setLoadError(t('betaVideo.errors.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [routeId, t]);

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
   * AC-130: Upload launcher used when onRegisterUploadLauncher is provided.
   * Implements the same validation + upload logic as BetaVideoUploader, but
   * the trigger comes from the AC-130 action row rather than an internal button.
   * The upload flow (progress modal, error display) is still owned by this
   * MOD-005 component.
   */
  const handleLaunchUpload = useCallback(async (): Promise<void> => {
    setUploadError(null);

    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      setUploadError(t('betaVideo.errors.permissionDenied'));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      videoMaxDuration: MAX_DURATION_SECONDS,
      allowsEditing: false,
      quality: 0.7,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return;
    }

    const asset = result.assets[0];

    // Duration validation (AC-030)
    const durationMs = asset.duration ?? 0;
    if (durationMs / 1000 > MAX_DURATION_SECONDS) {
      setUploadError(t('betaVideo.errors.tooLong'));
      return;
    }

    // Format validation (AC-035)
    const ACCEPTED_MIME_TYPES = new Set([
      'video/mp4',
      'video/quicktime',
      'video/mov',
    ]);
    const lowerUri = asset.uri.toLowerCase();
    if (
      (asset.mimeType && !ACCEPTED_MIME_TYPES.has(asset.mimeType)) ||
      (!asset.mimeType && !lowerUri.endsWith('.mp4') && !lowerUri.endsWith('.mov'))
    ) {
      setUploadError(t('betaVideo.errors.invalidFormat'));
      return;
    }

    const durationSeconds = Math.max(durationMs / 1000, 0.1);
    const localThumbnailUri = asset.uri; // Phase 1 simplification

    setIsUploading(true);
    setUploadProgress({ percent: 0, phase: 'thumbnail' });

    try {
      const video = await uploadBetaVideo(
        {
          route_id: routeId,
          localVideoUri: asset.uri,
          localThumbnailUri,
          duration_seconds: durationSeconds,
        },
        session.user.id,
        (prog) => { setUploadProgress(prog); },
      );
      handleUploadSuccess(video);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('betaVideo.errors.uploadFailed');
      setUploadError(msg);
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  }, [routeId, session.user.id, t, handleUploadSuccess]);

  /**
   * Register the upload launcher with the parent when onRegisterUploadLauncher
   * is provided. Called once on mount (and when the callback identity changes).
   */
  useEffect(() => {
    if (onRegisterUploadLauncher) {
      onRegisterUploadLauncher(() => { void handleLaunchUpload(); });
    }
  }, [onRegisterUploadLauncher, handleLaunchUpload]);

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
       * AC-037 / AC-130: Upload entry point.
       * When onRegisterUploadLauncher is NOT provided (legacy mode), render
       * BetaVideoUploader with its own button. When it IS provided (AC-130 mode),
       * the trigger lives in RouteDetailScreen's action row — no button here.
       * The progress modal is rendered separately below in AC-130 mode.
       */}
      {onRegisterUploadLauncher ? null : (
        <BetaVideoUploader
          routeId={routeId}
          userId={session.user.id}
          onUploadSuccess={handleUploadSuccess}
        />
      )}

      {/* AC-036 / AC-130: Progress overlay for AC-130 mode uploads */}
      {onRegisterUploadLauncher ? (
        <>
          {uploadError ? (
            <Text style={styles.errorText}>{uploadError}</Text>
          ) : null}
          <Modal
            visible={isUploading}
            transparent
            animationType="fade"
            onRequestClose={() => { /* intentionally non-dismissable during upload */ }}
          >
            <View style={styles.progressOverlay}>
              <View style={styles.progressCard}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={styles.progressTitle}>{t('betaVideo.uploading')}</Text>
                {uploadProgress ? (
                  <Text style={styles.progressPercent}>
                    {t('betaVideo.uploadProgress', { percent: uploadProgress.percent })}
                  </Text>
                ) : null}
              </View>
            </View>
          </Modal>
        </>
      ) : null}

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
    progressOverlay: {
      flex: 1,
      backgroundColor: theme.colors.overlay,
      alignItems: 'center',
      justifyContent: 'center',
    },
    progressCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.xl,
      alignItems: 'center',
      minWidth: 200,
      gap: theme.spacing.md,
    },
    progressTitle: {
      fontSize: theme.fontSize.md,
      fontWeight: theme.fontWeight.semibold,
      color: theme.colors.textPrimary,
    },
    progressPercent: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.textSecondary,
    },
  });
}
