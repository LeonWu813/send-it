/**
 * BetaVideoGrid — shared 3-column beta video thumbnail grid.
 *
 * AC-160: 3-column grid of beta-video thumbnails. Each cell shows a Phase 1
 * placeholder: gray background + centered play-icon overlay on a dark gradient.
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
 * - Gray background + play icon overlay is the correct Phase 1 affordance.
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

/**
 * Horizontal padding on each side of the grid container.
 * Set to 0 — the grid fills its container edge-to-edge. Callers are responsible
 * for providing horizontal padding via their own container (e.g. a wrapping View
 * with paddingHorizontal: 16 in BetaVideoSection for the route-detail context).
 * Profile-screen callers (MOD-001, MOD-006) already have their own section padding.
 */
const GRID_HORIZONTAL_PADDING = 0;

/** Gap between cells. */
const GRID_GAP = 2;

/**
 * Cell size: one third of the (screenWidth minus total horizontal padding),
 * minus inter-cell gaps. Portrait-locked, so screen width is stable.
 */
const SCREEN_WIDTH = Dimensions.get('window').width;
const CELL_SIZE =
  (SCREEN_WIDTH - GRID_HORIZONTAL_PADDING * 2 - GRID_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

/** Play icon size (centered absolutely over the cell). */
const PLAY_ICON_SIZE = 28;

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
}

/**
 * BetaVideoGrid renders a 3-column grid of beta-video placeholder cells.
 * Each cell: gray background + dark gradient overlay (bottom half) + centered
 * play icon. Tapping fires onPressVideo(index).
 *
 * When videos.length === 0 and emptyState is provided, renders emptyState.
 */
export default function BetaVideoGrid({
  videos,
  onPressVideo,
  emptyState,
}: BetaVideoGridProps): React.JSX.Element | null {
  const { theme } = useTheme();
  const styles = makeStyles(theme);

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
         * Dark gradient overlay — bottom half of cell.
         * Implemented as an absolute View (no LinearGradient dependency).
         */}
        <View style={styles.gradientOverlay} />

        {/*
         * Centered play icon — absolutely positioned over the full cell.
         * Rendered last so it sits above all other layers.
         */}
        <View style={styles.playIconContainer} pointerEvents="none">
          <Ionicons
            name="play"
            size={PLAY_ICON_SIZE}
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
        {/* Fill empty slots in the last row so cells align correctly. */}
        {rowVideos.length < NUM_COLUMNS
          ? Array.from({ length: NUM_COLUMNS - rowVideos.length }).map((_, i) => (
              <View key={`spacer-${i}`} style={styles.cell} />
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
function makeStyles(theme: ReturnType<typeof useTheme>['theme']) {
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
      width: CELL_SIZE,
      height: CELL_SIZE,
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
    gradientOverlay: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: CELL_SIZE / 2,
      backgroundColor: 'rgba(0,0,0,0.35)',
    },
    playIconContainer: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
