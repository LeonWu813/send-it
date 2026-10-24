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
 * Design system v2.3 (§32.9, page-review RD-3): portrait 3:4 tiles (`mediaTileAspect`), gap 2,
 * tiles measure their own width with onLayout (the PARENT owns the screen margin: the grid never adds
 * its own, so tiles are 119pt at x=16 on a 393 screen); an inset grid (horizontalPadding > 0) rounds
 * each tile's OUTER corners individually (`media` 12 + continuous curve) so a short last row still has
 * round corners; no per-tile badge or play disc;
 * press overlays `mediaScrim` (press 100 in, release 120 out, no scale: Motion #12); a real thumbnail
 * fades in over `short` unless cached; with no videos the grid renders the caller's `emptyState` (E2
 * `section`; the upload entry lives in the section header, never in the grid: states-audit-ux #48, the
 * dashed slot tiles are retired); while loading it shows the `section` spinner in a 52pt slot.
 *
 * Tech Lead decisions (Rev 13, point 6):
 * - No VideoView per grid cell (avoid N live decoders).
 * - No frame-extraction library (Phase 2 scope).
 * - Camera icon top-left is the correct Phase 1 affordance (AC-038).
 *   The dark gradient overlay and centered play icon have been replaced with a
 *   small camera icon (Ionicons "videocam") in a rounded top-left container,
 *   matching the route-detail inline cell style (Fix 3).
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Animated,
  PixelRatio,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { Spinner } from '../../../components/ui/ProgressBar';
import { USE_NATIVE_DRIVER, bezierFor, useMotion } from '../../../lib/motion';
import { CONTINUOUS, useTheme } from '../../../lib/theme';
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
   * Optional empty-state node rendered when videos.length === 0 (use ui/ EmptyState `section`).
   * If not provided and videos is empty, nothing is rendered.
   */
  emptyState?: React.ReactNode;
  /**
   * Horizontal padding (in dp) applied by the caller's wrapping container on each side of the grid.
   * 0 (default, profile screens, edge-to-edge): no outer rounding. > 0 (route detail, inset):
   * the grid's outer corners get the `media` radius, per tile. The gap is 2 either way. The tile width comes from onLayout, not from
   * this value (it is only the first-render estimate before the layout pass). The grid adds NO margin of its own.
   */
  horizontalPadding?: number;
  /** Show the `section` spinner (52pt slot) instead of the grid (the caller decides when, see useLoadingPhase). */
  loading?: boolean;
}

/** Only a directly loadable URL can be shown; Phase 1 rows hold a storage path, which stays a placeholder. */
function loadableThumbnailUri(video: BetaVideo): string | null {
  const uri = video.thumbnail_url;
  return uri && /^(https?:|file:|data:)/.test(uri) ? uri : null;
}

interface GridMetrics {
  cellSize: number;
  cellHeight: number;
  gap: number;
  /** Outer corner radius of the whole grid (0 when full-bleed). */
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
  const radius = inset ? theme.radius.media : 0;
  const available = measured ?? Math.max(0, windowWidth - horizontalPadding * 2);
  const cellSize = PixelRatio.roundToNearestPixel(
    Math.max(0, (available - gap * (NUM_COLUMNS - 1)) / NUM_COLUMNS),
  );
  const cellHeight = PixelRatio.roundToNearestPixel(cellSize / theme.componentSize.mediaTileAspect);
  const onLayout = useCallback((e: LayoutChangeEvent): void => {
    const w = e.nativeEvent.layout.width;
    setMeasured((prev) => (prev === w || w <= 0 ? prev : w));
  }, []);
  return { metrics: { cellSize, cellHeight, gap, radius }, onLayout };
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

  const scrim = useRef(new Animated.Value(0)).current;
  const setScrim = (on: boolean): void => {
    Animated.timing(scrim, {
      toValue: on ? 1 : 0,
      duration: on ? duration.press : duration.release,
      easing: bezierFor('standard'),
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  };

  // Each tile rounds only the corners on the grid's outer boundary (no clipping of the bounding box):
  // a short last row also rounds the right side of the tile above the empty cell.
  const rows = Math.ceil(total / NUM_COLUMNS);
  const row = Math.floor(index / NUM_COLUMNS);
  const col = index % NUM_COLUMNS;
  const isLast = index === total - 1;
  const hasTileBelow = index + NUM_COLUMNS < total;
  const r = metrics.radius;
  const topLeftRadius = row === 0 && col === 0 ? r : 0;
  const topRightRadius = row === 0 && (col === NUM_COLUMNS - 1 || isLast) ? r : 0;
  const bottomLeftRadius = row === rows - 1 && col === 0 ? r : 0;
  const bottomRightRadius = isLast || (!hasTileBelow && col === NUM_COLUMNS - 1) ? r : 0;

  return (
    <Pressable
      onPress={() => { onPress(index); }}
      onPressIn={() => { setScrim(true); }}
      onPressOut={() => { setScrim(false); }}
      unstable_pressDelay={50}
      accessibilityRole="button"
      accessibilityLabel={t('betaVideo.grid.openVideo', { index: index + 1, total })}
      testID={`beta-video-grid-cell-${video.id}`}
      style={{
        width: metrics.cellSize,
        height: metrics.cellHeight,
        overflow: 'hidden',
        backgroundColor: theme.isDark ? c.surfaceAlt : c.border,
        borderTopLeftRadius: topLeftRadius,
        borderTopRightRadius: topRightRadius,
        borderBottomLeftRadius: bottomLeftRadius,
        borderBottomRightRadius: bottomRightRadius,
        ...CONTINUOUS,
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
      {/* Pressed: a mediaScrim overlay, never a scale (it would break the outer corners). */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: c.mediaScrim, opacity: scrim }]}
      />
    </Pressable>
  );
}

/** `section` loading: a small textSecondary spinner centred in a 52pt slot (states-audit-ui 1.3). */
function GridLoading(): React.JSX.Element {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={t('betaVideo.loadingVideos')}
      style={{ height: theme.layout.sectionLoadingSlot, alignItems: 'center', justifyContent: 'center' }}
    >
      <Spinner context="section" />
    </View>
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
      <View testID="beta-video-grid-loading">
        <GridLoading />
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
      <View key={rowStart} style={{ flexDirection: 'row', gap: metrics.gap, marginBottom: rowStart + NUM_COLUMNS < videos.length ? metrics.gap : 0 }}>
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
              <View key={`spacer-${i}`} style={{ width: metrics.cellSize, height: metrics.cellHeight }} />
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
