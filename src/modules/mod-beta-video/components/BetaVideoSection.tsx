/**
 * BetaVideoSection — the public entry point for MOD-005 on RouteDetailScreen.
 *
 * This component:
 *   1. Fetches beta videos for the given route.
 *   2. Renders a three-column thumbnail grid (AC-038).
 *   3. Opens the fullscreen reel viewer when a grid cell is tapped (AC-039).
 *   4. Exposes the "Add beta video" upload launcher (AC-037).
 *
 * RouteDetailScreen imports ONLY this component from mod-beta-video (cross-module
 * import rule: never import internal screens/ or components/ directly from another
 * module — import only the public entry-point component).
 *
 * AC-032: each BetaVideo is attached to exactly one route (route_id pre-filled).
 * AC-033: inline playback without leaving the app.
 * AC-036: upload progress overlay is owned by BetaVideoUploader.
 * AC-037: "Add beta video" entry point visible on route detail screen.
 * AC-038: three-column thumbnail grid with camera-icon overlay.
 * AC-039: fullscreen reel viewer opened on thumbnail tap.
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
import React, { useCallback, useEffect, useState } from 'react';
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
import { useTheme } from '../../../lib/theme';
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
}

export default function BetaVideoSection({
  routeId,
  session,
}: BetaVideoSectionProps): React.JSX.Element {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const styles = makeStyles(theme);

  const [betaVideos, setBetaVideos] = useState<BetaVideo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // AC-039: null = viewer closed, N = viewer open at grid index N.
  const [openIndex, setOpenIndex] = useState<number | null>(null);

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

      {/* AC-037: "Add beta video" entry point with route context pre-attached */}
      <BetaVideoUploader
        routeId={routeId}
        userId={session.user.id}
        onUploadSuccess={handleUploadSuccess}
      />

      {/* AC-039: Fullscreen reel viewer (Modal) */}
      <BetaVideoReelViewer
        videos={betaVideos}
        initialIndex={openIndex ?? 0}
        visible={openIndex !== null}
        onClose={() => { setOpenIndex(null); }}
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
