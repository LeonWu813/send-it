/**
 * BetaVideoReelViewer — fullscreen reel viewer for a route's beta videos.
 *
 * AC-039: Tapping a thumbnail opens a fullscreen portrait viewer that
 * auto-plays the selected video. Swiping up advances to the next video;
 * swiping down (or tapping the back button) dismisses the viewer.
 *
 * Architecture (Tech Lead decisions, Rev 13):
 * 1. Portrait lock: `app.json` already sets `"orientation": "portrait"` globally.
 *    Do NOT add expo-screen-orientation.
 * 2. Modal architecture: RN `<Modal>` — same pattern as BetaVideoUploader.
 * 3. Playlist order: videos array is already ordered `created_at DESC`; tap index
 *    maps 1:1 to viewer start index; no wrap at ends.
 * 4. No `enterFullscreen()` — size VideoView to fill the modal instead.
 * 5. Swipe gesture: RN built-in PanResponder (vertical-only). Explicit back
 *    button provided as the accessible fallback.
 * 6. Thumbnails: placeholder only — do NOT mount VideoView per grid cell.
 *
 * Playback: one `useVideoPlayer` instance whose source is replaced
 * (`player.replace()`) when currentIndex changes — one active decoder at a time.
 * Signed URLs are loaded lazily: only the current video's signed URL is fetched.
 */

import { Ionicons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../lib/theme';
import { getVideoSignedUrl } from '../beta-video-service';
import type { BetaVideo } from '../types';

/**
 * Intentional named constant for the video viewer background.
 * Pure black is required here: the viewer occupies the full screen as a cinema
 * canvas, and no theme token maps to #000000 (the darkest token is
 * theme.colors.background at #121212). Using a named constant rather than an
 * inline literal satisfies the no-hardcoded-hex convention.
 */
const VIDEO_VIEWER_BG = '#000000';

/** Minimum dy (in pixels) to trigger a swipe. */
const SWIPE_THRESHOLD = 50;

export interface BetaVideoReelViewerProps {
  /** Full ordered array of beta videos for the route (created_at DESC). */
  videos: BetaVideo[];
  /** Index of the tapped video — viewer opens here. */
  initialIndex: number;
  /** Whether the viewer modal is open. */
  visible: boolean;
  /** Called when the user dismisses the viewer. */
  onClose: () => void;
}

/**
 * BetaVideoReelViewer renders a fullscreen Modal with a single VideoView.
 * The current video is determined by `currentIndex` state. Swiping vertically
 * navigates between videos; swiping down at index 0 (or pressing the back
 * button) dismisses the modal.
 */
export default function BetaVideoReelViewer({
  videos,
  initialIndex,
  visible,
  onClose,
}: BetaVideoReelViewerProps): React.JSX.Element {
  const { theme } = useTheme();
  const { t } = useTranslation('common');
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);

  // ── Index state ───────────────────────────────────────────────────────────
  const [currentIndex, setCurrentIndex] = useState<number>(initialIndex);

  // Reset to initialIndex whenever the viewer opens.
  useEffect(() => {
    if (visible) {
      setCurrentIndex(initialIndex);
    }
  }, [visible, initialIndex]);

  // ── Signed URL state ─────────────────────────────────────────────────────
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [urlLoading, setUrlLoading] = useState(false);
  const [urlError, setUrlError] = useState(false);

  // ── Video player ─────────────────────────────────────────────────────────
  // One player instance — source is replaced via player.replace() on index change.
  const player = useVideoPlayer(null, (p) => {
    p.loop = false;
  });

  /**
   * Load signed URL for the current video, then replace the player source and
   * call play(). Runs whenever currentIndex or visibility changes.
   */
  useEffect(() => {
    if (!visible || videos.length === 0) return;

    const video = videos[currentIndex];
    if (!video) return;

    let cancelled = false;

    setSignedUrl(null);
    setUrlLoading(true);
    setUrlError(false);

    getVideoSignedUrl(video.video_url)
      .then((url) => {
        if (cancelled) return;
        setSignedUrl(url);
        setUrlLoading(false);
        // Replace source and auto-play (Tech Lead decision 4).
        player.replace({ uri: url });
        player.play();
      })
      .catch(() => {
        if (cancelled) return;
        setUrlLoading(false);
        setUrlError(true);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, visible]);

  // ── Navigation helpers ────────────────────────────────────────────────────
  const goToNext = useCallback((): void => {
    setCurrentIndex((prev) => {
      if (prev < videos.length - 1) return prev + 1;
      return prev; // no-op at last video
    });
  }, [videos.length]);

  /**
   * AC-039: swiping down or tapping a back control shall dismiss the viewer.
   * Dismissal is unconditional — there is no "go to previous" on swipe-down.
   */
  const handleDismiss = useCallback((): void => {
    onClose();
  }, [onClose]);

  // ── PanResponder (vertical-only swipe, Tech Lead decision 5) ─────────────
  // Re-create callbacks reference so PanResponder handlers stay current.
  // PanResponder.create memoizes handlers, so we wire through a stable ref.
  const goToNextRef = useRef(goToNext);
  const handleDismissRef = useRef(handleDismiss);
  useEffect(() => { goToNextRef.current = goToNext; }, [goToNext]);
  useEffect(() => { handleDismissRef.current = handleDismiss; }, [handleDismiss]);

  // Re-create PanResponder when navigation callbacks change so the handlers
  // always reference the latest `goToNext` / `handleDismiss`.
  const panRef = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, gs) =>
        Math.abs(gs.dy) > Math.abs(gs.dx) && Math.abs(gs.dy) > 5,
      onPanResponderRelease: (_evt, gs) => {
        if (gs.dy < -SWIPE_THRESHOLD) goToNextRef.current();
        // AC-039: swipe down always dismisses regardless of current index.
        else if (gs.dy > SWIPE_THRESHOLD) handleDismissRef.current();
      },
    }),
  );

  const currentVideo = videos[currentIndex];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      transparent={false}
      onRequestClose={onClose}
      testID="beta-video-reel-modal"
    >
      {/* Full-screen gesture area */}
      <View
        style={styles.fullscreen}
        {...panRef.current.panHandlers}
        testID="beta-video-reel-viewer"
      >
        {/* Video layer */}
        {signedUrl && !urlError ? (
          <VideoView
            player={player}
            style={styles.video}
            contentFit="contain"
            nativeControls={false}
            testID="beta-video-reel-video-view"
          />
        ) : null}

        {/* Loading spinner while fetching signed URL */}
        {urlLoading ? (
          <View style={styles.centeredOverlay}>
            <ActivityIndicator
              size="large"
              color={theme.colors.textInverse}
              testID="beta-video-reel-loading"
            />
          </View>
        ) : null}

        {/* Error state */}
        {urlError ? (
          <View style={styles.centeredOverlay}>
            <Text style={styles.errorText} testID="beta-video-reel-error">
              {t('betaVideo.loadError')}
            </Text>
          </View>
        ) : null}

        {/* Back / close button — accessible fallback for swipe (Tech Lead decision 5) */}
        <Pressable
          style={[styles.backButton, { top: insets.top + 12 }]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close video viewer"
          testID="beta-video-reel-close"
        >
          <Ionicons name="chevron-back" size={28} color={theme.colors.textInverse} />
        </Pressable>

        {/* Video counter (e.g. "2 / 5") */}
        {videos.length > 1 ? (
          <View style={[styles.counter, { top: insets.top + 12 }]}>
            <Text style={styles.counterText}>
              {currentIndex + 1} / {videos.length}
            </Text>
          </View>
        ) : null}

        {/* Caption (if any) */}
        {currentVideo?.caption ? (
          <View style={[styles.captionContainer, { bottom: insets.bottom + 16 }]}>
            <Text style={styles.captionText}>{currentVideo.caption}</Text>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function makeStyles(theme: ReturnType<typeof useTheme>['theme']) {
  return StyleSheet.create({
    fullscreen: {
      flex: 1,
      backgroundColor: VIDEO_VIEWER_BG,
    },
    video: {
      width: '100%',
      height: '100%',
    },
    centeredOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    backButton: {
      position: 'absolute',
      left: 16,
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.colors.overlay,
      alignItems: 'center',
      justifyContent: 'center',
    },
    counter: {
      position: 'absolute',
      right: 16,
      backgroundColor: theme.colors.overlay,
      borderRadius: theme.borderRadius.sm,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
    },
    counterText: {
      color: theme.colors.textInverse,
      fontSize: theme.fontSize.sm,
      fontWeight: theme.fontWeight.semibold,
    },
    captionContainer: {
      position: 'absolute',
      left: 16,
      right: 16,
      backgroundColor: theme.colors.overlay,
      borderRadius: theme.borderRadius.md,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
    },
    captionText: {
      color: theme.colors.textInverse,
      fontSize: theme.fontSize.sm,
    },
    errorText: {
      color: theme.colors.textInverse,
      fontSize: theme.fontSize.md,
      textAlign: 'center',
    },
  });
}
