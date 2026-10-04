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
 * Tech Lead decisions (Rev 13, point 6):
 * - No VideoView per grid cell (avoid N live decoders).
 * - No frame-extraction library (Phase 2 scope).
 * - Camera icon top-left is the correct Phase 1 affordance (AC-038).
 *   The dark gradient overlay and centered play icon have been replaced with a
 *   small camera icon (Ionicons "videocam") in a rounded top-left container,
 *   matching the route-detail inline cell style (Fix 3).
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useCallback } from 'react';
import {
  Dimensions,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useTheme } from '../../../lib/theme';
import type { BetaVideo } from '../types';

/** Number of columns in the thumbnail grid. */
const NUM_COLUMNS = 3;

/** Gap between cells. */
const GRID_GAP = 2;

/** Screen width — portrait-locked, so this is stable for the app lifetime. */
const SCREEN_WIDTH = Dimensions.get('window').width;

export interface BetaVideoGridProps {
  /** Ordered array of beta videos to display. */
  videos: BetaVideo[];
  /** Called with the tapped cell's index when a cell is pressed. */
  onPressVideo: (index: number) => void;
  /**
   * Optional empty-state node rendered when videos.length === 0.
   * If not provided and videos is empty, nothing is rendered.
   */
  emptyState?: React.ReactNode;
  /**
   * Horizontal padding (in dp) applied by the caller's wrapping container on
   * each side of the grid. Used to compute the correct cell size so the three
   * columns fit exactly within the available width without the third cell
   * clipping.
   *
   * Profile-screen callers (MOD-001, MOD-006) render this grid edge-to-edge
   * inside their own section padding — they should omit this prop (defaults to 0).
   *
   * BetaVideoSection (route-detail context) wraps the grid in a container with
   * paddingHorizontal: 16; it passes horizontalPadding={16} so cell size is
   * reduced accordingly.
   */
  horizontalPadding?: number;
}

/**
 * BetaVideoGrid renders a 3-column grid of beta-video placeholder cells.
 * Each cell: gray background + small camera icon top-left. Tapping fires onPressVideo(index).
 *
 * When videos.length === 0 and emptyState is provided, renders emptyState.
 */
export default function BetaVideoGrid({
  videos,
  onPressVideo,
  emptyState,
  horizontalPadding = 0,
}: BetaVideoGridProps): React.JSX.Element | null {
  const { theme } = useTheme();
  // Cell size accounts for the caller's wrapping container padding so all three
  // columns fit within the available width without the third cell clipping.
  const cellSize =
    (SCREEN_WIDTH - horizontalPadding * 2 - GRID_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;
  const styles = makeStyles(theme, cellSize);

  const renderCell = useCallback(
    (video: BetaVideo, index: number): React.JSX.Element => (
      <Pressable
        key={video.id}
        style={styles.cell}
        onPress={() => { onPressVideo(index); }}
        accessibilityRole="button"
        accessibilityLabel={`Open video ${index + 1}`}
        testID={`beta-video-grid-cell-${video.id}`}
      >
        {/* Gray background placeholder (Phase 1 — no real thumbnail). */}
        <View style={styles.placeholderBg} />

        {/*
         * Camera icon top-left — "this is a video" affordance (AC-038 / Fix 3).
         * Small rounded dark container, same style as the route-detail inline cells.
         */}
        <View style={styles.iconContainer} pointerEvents="none">
          <Ionicons
            name="videocam"
            size={14}
            color="#FFFFFF"
          />
        </View>
      </Pressable>
    ),
    [styles, onPressVideo],
  );

  if (videos.length === 0) {
    return emptyState ? <>{emptyState}</> : null;
  }

  // Build rows of NUM_COLUMNS cells.
  const rows: React.JSX.Element[] = [];
  for (let rowStart = 0; rowStart < videos.length; rowStart += NUM_COLUMNS) {
    const rowVideos = videos.slice(rowStart, rowStart + NUM_COLUMNS);
    rows.push(
      <View key={rowStart} style={styles.row}>
        {rowVideos.map((video, colIdx) => renderCell(video, rowStart + colIdx))}
        {/* Fill empty slots in the last row so cells align correctly.
            Spacers are transparent — they exist only for layout alignment,
            not as visible cells. Without backgroundColor: 'transparent' the
            cell style's surface colour makes them look like broken video slots. */}
        {rowVideos.length < NUM_COLUMNS
          ? Array.from({ length: NUM_COLUMNS - rowVideos.length }).map((_, i) => (
              <View key={`spacer-${i}`} style={[styles.cell, styles.spacerCell]} />
            ))
          : null}
      </View>,
    );
  }

  return (
    <View style={styles.grid} testID="beta-video-grid">
      {rows}
    </View>
  );
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function makeStyles(theme: ReturnType<typeof useTheme>['theme'], cellSize: number) {
  return StyleSheet.create({
    grid: {
      flexDirection: 'column',
    },
    row: {
      flexDirection: 'row',
      gap: GRID_GAP,
      marginBottom: GRID_GAP,
    },
    cell: {
      width: cellSize,
      height: cellSize,
      position: 'relative',
      overflow: 'hidden',
      borderRadius: theme.borderRadius.sm,
      backgroundColor: theme.colors.surface,
    },
    placeholderBg: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: theme.colors.surface,
    },
    /**
     * Camera icon container — top-left corner, small rounded dark background.
     * Matches the inline cell style used in BetaVideoSection (Fix 3).
     */
    iconContainer: {
      position: 'absolute',
      top: 6,
      left: 6,
      backgroundColor: 'rgba(0,0,0,0.45)',
      borderRadius: 4,
      padding: 3,
    },
    /**
     * Spacer cells exist purely for layout alignment in the last row.
     * They must be invisible — backgroundColor: 'transparent' overrides
     * the surface colour from `cell` so they don't look like broken video
     * slots when there are 1 or 2 videos in the last row.
     */
    spacerCell: {
      backgroundColor: 'transparent',
    },
  });
}
