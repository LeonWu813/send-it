/**
 * MOD-005: Beta Video — public module barrel.
 *
 * Only items listed here are accessible to other modules.
 * Cross-module import rule: other modules must import only from this barrel,
 * never from internal paths (components/, screens/, etc.) directly.
 */

// ── Components ────────────────────────────────────────────────────────────────

/** Public entry-point for RouteDetailScreen (AC-037). */
export { default as BetaVideoSection } from './components/BetaVideoSection';

/**
 * Shared 3-column thumbnail grid (AC-160).
 * Consumed by MOD-006 (AC-163) and MOD-001 (AC-164).
 */
export { default as BetaVideoGrid } from './components/BetaVideoGrid';
export type { BetaVideoGridProps } from './components/BetaVideoGrid';

/**
 * Fullscreen reel viewer (AC-039).
 * Consumed by MOD-006 (AC-163) and MOD-001 (AC-164) with reelContext="profile".
 */
export { default as BetaVideoReelViewer } from './components/BetaVideoReelViewer';
export type { BetaVideoReelViewerProps } from './components/BetaVideoReelViewer';

// ── Service functions ─────────────────────────────────────────────────────────

export {
  fetchBetaVideosForRoute,
  uploadBetaVideo,
  getVideoSignedUrl,
  getThumbnailSignedUrl,
  reportBetaVideo,
  /** AC-162: fetch all beta videos for a given user across all routes. */
  fetchBetaVideosByUser,
  /** AC-166: check whether the current user already has a beta video for a route. */
  checkExistingBetaVideo,
} from './beta-video-service';

// ── Types ─────────────────────────────────────────────────────────────────────

export type { BetaVideo, BetaVideoUploadInput, UploadProgress } from './types';
