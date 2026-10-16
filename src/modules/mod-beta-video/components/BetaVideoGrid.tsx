/**
 * BetaVideoGrid — shared 3-column beta video thumbnail grid.
 *
 * AC-160: 3-column grid of beta-video thumbnails. Each cell shows a Phase 1
 * placeholder: gray background with a small camera icon overlaid top-left.
 * Tapping a cell fires onPressVideo(index). If videos.length === 0 and emptyState
 * is provided, renders emptyState instead of the grid.
 *
 * This component is owned by MOD-005 and exported as a public surface consumed by:
 *   - MOD-006 (AC-163)
 *   - MOD-001 (AC-164)
 *
 * Design system v1.2 (§32.9, off-spec design work): tiles measure their own width with
 * onLayout (no module-level Dimensions read); full-bleed grids use gap 2 / radius 0, inset
 * grids (horizontalPadding > 0) use gap 4 / radius sm; the tile carries a videocam corner badge
 * (mediaScrim + onMedia) and the accentIllustration play disc with a surface ring; a real
 * thumbnail (only when thumbnail_url is a loadable URL) fades in over `short` unless it was cached.
 *
 * Tech Lead decisions (Rev 13, point 6):
 * - No VideoView per grid cell (avoid N live decoders).
 * - No frame-extraction library (Phase 2 scope).
 * - Camera icon top-left is the correct Phase 1 affordance (AC-038).
 *   The dark gradient overlay and centered play icon have been replaced with a
 *   small camera icon (Ionicons "videocam") in a rounded top-left container,
 *   matching the route-detail inline cell style (Fix 3).
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Animated,
  PixelRatio,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { PressableScale } from '../../../components/ui/PressableScale';
import { Skeleton, SkeletonGroup, useSkeletonPhase } from '../../../components/ui/Skeleton';
import { ICON } from '../../../lib/icons';
import { USE_NATIVE_DRIVER, bezierFor, useMotion } from '../../../lib/motion';
import { useTheme } from '../../../lib/theme';
import type { BetaVideo } from '../types';

/** Number of columns in the thumbnail grid. */
const NUM_COLUMNS = 3;

/** A thumbnail that is ready this soon after mount is treated as cached: no fade (Motion D5). */
const CACHED_THUMBNAIL_MS = 50;

export interface BetaVideoGridProps {
  /** Ordered array of beta videos to display. */
  videos: BetaVideo[];
  /** Called with the tapped cell's index when a cell is pressed. */
  onPressVideo: (index: number) => void;
  /**
   * Optional empty-state node rendered when videos.length === 0 (use ui/ EmptyState `inline`).
   * If not provided and videos is empty, nothing is rendered.
   */
  emptyState?: React.ReactNode;
  /**
   * Horizontal padding (in dp) applied by the caller's wrapping container on each side of the grid.
   * 0 (default, profile screens, edge-to-edge): gap 2 and square tiles. > 0 (route detail, inset):
   * gap 4 and `sm` rounded tiles. The tile width itself comes from onLayout, not from this value
   * (it is only the first-render estimate before the layout pass).
   */
  horizontalPadding?: number;
  /** Show skeleton tiles instead of the grid (the caller decides when, see useSkeletonPhase). */
  loading?: boolean;
}

/** Only a directly loadable URL can be shown; Phase 1 rows hold a storage path, which stays a placeholder. */
function loadableThumbnailUri(video: BetaVideo): string | null {
  const uri = video.thumbnail_url;
  return uri && /^(https?:|file:|data:)/.test(uri) ? uri : null;
}

interface GridMetrics {
  cellSize: number;
  gap: number;
  radius: number;
}

function useGridMetrics(horizontalPadding: number): {
  metrics: GridMetrics;
  onLayout: (e: LayoutChangeEvent) => void;
} {
  const { theme } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const [measured, setMeasured] = useState<number | null>(null);
  const inset = horizontalPadding > 0;
  const gap = inset ? theme.layout.mediaGridGapInset : theme.layout.mediaGridGapFull;
  const radius = inset ? theme.borderRadius.sm : 0;
  const available = measured ?? Math.max(0, windowWidth - horizontalPadding * 2);
  const cellSize = PixelRatio.roundToNearestPixel(
    Math.max(0, (available - gap * (NUM_COLUMNS - 1)) / NUM_COLUMNS),
  );
  const onLayout = useCallback((e: LayoutChangeEvent): void => {
    const w = e.nativeEvent.layout.width;
    setMeasured((prev) => (prev === w || w <= 0 ? prev : w));
  }, []);
  return { metrics: { cellSize, gap, radius }, onLayout };
}

interface TileProps {
  video: BetaVideo;
  index: number;
  total: number;
  metrics: GridMetrics;
  onPress: (index: number) => void;
}

function Tile({ video, index, total, metrics, onPress }: TileProps): React.JSX.Element {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const { duration } = useMotion();
  const c = theme.colors;
  const uri = loadableThumbnailUri(video);
  const mountedAt = useRef(Date.now()).current;
  const fade = useRef(new Animated.Value(0)).current;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
    fade.setValue(0);
  }, [uri, fade]);

  const handleLoad = (): void => {
    if (Date.now() - mountedAt < CACHED_THUMBNAIL_MS) {
      fade.setValue(1);
      return;
    }
    // Opacity only, so it still plays under Reduce Motion.
    Animated.timing(fade, {
      toValue: 1,
      duration: duration.short,
      easing: bezierFor('linear'),
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  };

  return (
    <PressableScale
      onPress={() => { onPress(index); }}
      accessibilityLabel={t('betaVideo.grid.openVideo', { index: index + 1, total })}
      testID={`beta-video-grid-cell-${video.id}`}
      style={{
        width: metrics.cellSize,
        height: metrics.cellSize,
        borderRadius: metrics.radius,
        overflow: 'hidden',
        backgroundColor: c.border,
      }}
    >
      {uri && !failed ? (
        <Animated.Image
          source={{ uri }}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
          onLoad={handleLoad}
          onError={() => { setFailed(true); }}
          style={[StyleSheet.absoluteFill, { opacity: fade }]}
        />
      ) : null}

      {/* Corner badge: "this is a video" (AC-038). */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: theme.spacing.xs,
          left: theme.spacing.xs,
          backgroundColor: c.mediaScrim,
          borderRadius: theme.borderRadius.sm,
          padding: theme.spacing.xxs,
        }}
      >
        <Ionicons name={ICON.betaVideo.filled} size={theme.iconSize.xs} color={c.onMedia} />
      </View>

      {/* Play disc: the only place accentIllustration is used. The tile already has the label. */}
      <View
        pointerEvents="none"
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
        }}
      >
        <Ionicons
          name={ICON.play.filled}
          size={theme.iconSize.xs}
          color={c.onAccentIllustration}
          style={{ marginLeft: 1 }}
        />
      </View>
    </PressableScale>
  );
}

/** Two rows of skeleton tiles (no pulse colour change: `border` on the page). Wrap-free: use inside the caller. */
function GridSkeleton({ metrics }: { metrics: GridMetrics }): React.JSX.Element {
  const { t } = useTranslation('common');
  const phase = useSkeletonPhase(true);
  return (
    <SkeletonGroup label={t('betaVideo.loadingVideos')}>
      {phase === 'idle'
        ? null
        : [0, 1].map((row) => (
            <View key={row} style={{ flexDirection: 'row', gap: metrics.gap, marginBottom: metrics.gap }}>
              {Array.from({ length: NUM_COLUMNS }).map((_, i) => (
                <Skeleton
                  key={i}
                  surface="page"
                  width={metrics.cellSize}
                  height={metrics.cellSize}
                  radius={metrics.radius}
                />
              ))}
            </View>
          ))}
    </SkeletonGroup>
  );
}

/**
 * BetaVideoGrid renders a 3-column grid of beta-video cells. Tapping fires onPressVideo(index).
 * When videos.length === 0 and emptyState is provided, renders emptyState.
 */
export default function BetaVideoGrid({
  videos,
  onPressVideo,
  emptyState,
  horizontalPadding = 0,
  loading = false,
}: BetaVideoGridProps): React.JSX.Element | null {
  const { metrics, onLayout } = useGridMetrics(horizontalPadding);

  if (loading) {
    return (
      <View onLayout={onLayout} testID="beta-video-grid-skeleton">
        <GridSkeleton metrics={metrics} />
      </View>
    );
  }

  if (videos.length === 0) {
    return emptyState ? <>{emptyState}</> : null;
  }

  // Build rows of NUM_COLUMNS cells.
  const rows: React.JSX.Element[] = [];
  for (let rowStart = 0; rowStart < videos.length; rowStart += NUM_COLUMNS) {
    const rowVideos = videos.slice(rowStart, rowStart + NUM_COLUMNS);
    rows.push(
      <View key={rowStart} style={{ flexDirection: 'row', gap: metrics.gap, marginBottom: metrics.gap }}>
        {rowVideos.map((video, colIdx) => (
          <Tile
            key={video.id}
            video={video}
            index={rowStart + colIdx}
            total={videos.length}
            metrics={metrics}
            onPress={onPressVideo}
          />
        ))}
        {/* Transparent spacers keep the last row aligned to the columns. */}
        {rowVideos.length < NUM_COLUMNS
          ? Array.from({ length: NUM_COLUMNS - rowVideos.length }).map((_, i) => (
              <View key={`spacer-${i}`} style={{ width: metrics.cellSize, height: metrics.cellSize }} />
            ))
          : null}
      </View>,
    );
  }

  return (
    <View onLayout={onLayout} testID="beta-video-grid">
      {rows}
    </View>
  );
}
