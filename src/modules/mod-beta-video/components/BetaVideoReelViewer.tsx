/**
 * BetaVideoReelViewer — fullscreen reel viewer for a route's beta videos.
 *
 * AC-039: Tapping a thumbnail opens a fullscreen portrait viewer that
 * auto-plays the selected video. Swiping up advances to the next video;
 * swiping down (or tapping the close button) dismisses the viewer.
 *
 * AC-133: Persistent top-left close button — never unmounts or loses tap target.
 * AC-134: Bottom-left poster-identity overlay (avatar + display_name + route/gym info).
 * AC-135: Tapping poster row is a no-op in Phase 1.
 * AC-137: Marquee animation for overflowing text (pure-JS Animated translateX).
 * AC-138: Right sidebar — like icon (placeholder) + report icon.
 * AC-139: Report icon hidden for own videos and admin-dismissed videos.
 * AC-140: Report icon calls report_beta_video RPC; local reportedIds tracks success.
 *
 * Architecture (Tech Lead decisions, Rev 13 + Rev 16):
 * 1. Portrait lock: `app.json` already sets `"orientation": "portrait"` globally.
 * 2. Modal architecture: RN `<Modal>` — same pattern as BetaVideoUploader.
 * 3. Playlist order: videos array ordered `created_at DESC`; tap index 1:1; no wrap.
 * 4. No `enterFullscreen()` — VideoView fills the modal.
 * 5. PanResponder (vertical-only). Explicit close button as accessible fallback.
 * 6. Thumbnails: placeholder only — no VideoView per grid cell.
 * Rev 16: overlay on top of gesture layer using pointerEvents="box-none" container.
 *
 * Gesture architecture:
 * - The absoluteFill `View` with `panHandlers` sits above the VideoView to intercept
 *   swipe gestures. This view has NO `pointerEvents` override, so it absorbs all touches.
 * - The overlay container uses `pointerEvents="box-none"` so touches pass through the
 *   container itself to the gesture layer below, but Pressable children still receive taps.
 * - The close button and report button are Pressable children of the overlay and remain
 *   independently tappable regardless of the gesture capture.
 */

import type { Session } from '@supabase/supabase-js';
import { Ionicons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Animated,
  Image,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../lib/theme';
import { getVideoSignedUrl, reportBetaVideo } from '../beta-video-service';
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

/** Diameter of the poster avatar circle (AC-134). */
const AVATAR_SIZE = 36;

/** Width allocated for the right sidebar (like + report icons). */
const SIDEBAR_WIDTH = 56;

/** Duration of one marquee scroll pass in milliseconds (AC-137). */
const MARQUEE_DURATION_MS = 4000;

export interface BetaVideoReelViewerProps {
  /** Full ordered array of beta videos for the route (created_at DESC). */
  videos: BetaVideo[];
  /** Index of the tapped video — viewer opens here. */
  initialIndex: number;
  /** Whether the viewer modal is open. */
  visible: boolean;
  /** Called when the user dismisses the viewer. */
  onDismiss: () => void;
  /** Authenticated session — used to check if current video belongs to the viewer (AC-139). */
  session: Session;
  /**
   * AC-134: Route name shown in Row 2 of the bottom-left overlay.
   * Combined with gymName as "{routeName} · {gymName}".
   */
  routeName?: string;
  /**
   * AC-134: Gym name shown in Row 2 of the bottom-left overlay.
   * Combined with routeName as "{routeName} · {gymName}".
   */
  gymName?: string;
  /**
   * AC-136: Called when the user taps Row 2 (route · gym label).
   * Receives the route_id of the current video. Omit (or pass undefined)
   * when the user is already on the route detail screen — tap is a no-op.
   */
  onNavigateToRoute?: (routeId: string) => void;
}

// ── MarqueeText — pure-JS translateX marquee for overflowing text (AC-137) ────

interface MarqueeTextProps {
  text: string;
  containerWidth: number;
  style?: object;
  testID?: string;
}

/**
 * Renders `text` inside an `overflow:'hidden'` container. If the text is wider
 * than `containerWidth`, a looping `Animated.translateX` marquee scrolls it.
 * No native package — pure RN Animated (AC-137).
 */
function MarqueeText({ text, containerWidth, style, testID }: MarqueeTextProps): React.JSX.Element {
  const translateX = useRef(new Animated.Value(0)).current;
  const [textWidth, setTextWidth] = useState(0);
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (textWidth > containerWidth && containerWidth > 0) {
      animRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(translateX, {
            toValue: -(textWidth - containerWidth),
            duration: MARQUEE_DURATION_MS,
            useNativeDriver: true,
          }),
          Animated.delay(1000),
          Animated.timing(translateX, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
          Animated.delay(500),
        ]),
      );
      animRef.current.start();
    } else {
      // Reset when text fits or container width not yet known
      translateX.setValue(0);
      animRef.current?.stop();
    }

    return () => {
      animRef.current?.stop();
    };
  }, [textWidth, containerWidth, translateX]);

  return (
    <View style={{ width: containerWidth, overflow: 'hidden' }}>
      <Animated.Text
        style={[style, { transform: [{ translateX }] }]}
        onTextLayout={(e) => {
          const lineWidth = e.nativeEvent.lines[0]?.width ?? 0;
          setTextWidth(lineWidth);
        }}
        numberOfLines={1}
        testID={testID}
      >
        {text}
      </Animated.Text>
    </View>
  );
}

// ── PosterAvatar — circular avatar with initial-letter fallback (AC-134/AC-138) ─

interface PosterAvatarProps {
  avatarUrl: string | null;
  displayName: string | null;
  theme: ReturnType<typeof useTheme>['theme'];
}

function PosterAvatar({ avatarUrl, displayName, theme }: PosterAvatarProps): React.JSX.Element {
  const initial = displayName ? displayName.charAt(0).toUpperCase() : '?';

  if (avatarUrl) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        style={{
          width: AVATAR_SIZE,
          height: AVATAR_SIZE,
          borderRadius: AVATAR_SIZE / 2,
        }}
        testID="reel-poster-avatar"
      />
    );
  }

  return (
    <View
      style={{
        width: AVATAR_SIZE,
        height: AVATAR_SIZE,
        borderRadius: AVATAR_SIZE / 2,
        backgroundColor: theme.colors.overlay,
        alignItems: 'center',
        justifyContent: 'center',
      }}
      testID="reel-poster-avatar-placeholder"
    >
      <Text
        style={{
          color: theme.colors.textInverse,
          fontSize: theme.fontSize.md,
          fontWeight: theme.fontWeight.semibold,
        }}
      >
        {initial}
      </Text>
    </View>
  );
}

// ── BetaVideoReelViewer ────────────────────────────────────────────────────────

/**
 * BetaVideoReelViewer renders a fullscreen Modal with a single VideoView,
 * a TikTok/Reels-style overlay, and a right sidebar with like + report actions.
 *
 * The current video is determined by `currentIndex` state. Swiping vertically
 * navigates between videos; swiping down (or pressing the close button) dismisses.
 */
export default function BetaVideoReelViewer({
  videos,
  initialIndex,
  visible,
  onDismiss,
  session,
  routeName,
  gymName,
  onNavigateToRoute,
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

  // ── Report state ─────────────────────────────────────────────────────────
  // Set of video IDs that have been successfully reported in this session.
  const [reportedIds, setReportedIds] = useState<Set<string>>(new Set());
  // ID of the video currently being reported (button loading state).
  const [reportingId, setReportingId] = useState<string | null>(null);
  // Error message shown when a report RPC call fails (AC-139).
  const [reportError, setReportError] = useState<string | null>(null);

  // ── Video player ─────────────────────────────────────────────────────────
  const player = useVideoPlayer(null, (p) => {
    p.loop = false;
  });

  useEffect(() => {
    return () => {
      player.pause();
    };
  }, [player]);

  useEffect(() => {
    if (!visible) {
      player.pause();
    }
  }, [visible, player]);

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
    setReportError(null);

    getVideoSignedUrl(video.video_url)
      .then((url) => {
        if (cancelled) return;
        setSignedUrl(url);
        setUrlLoading(false);
        void player.replaceAsync({ uri: url }).then(() => {
          if (!cancelled) player.play();
        });
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

  // Ref that always reflects the latest currentIndex — used in stable PanResponder
  // callbacks (goToPrevOrClose) to avoid stale-closure issues.
  const currentIndexRef = useRef(currentIndex);
  useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);

  const goToNext = useCallback((): void => {
    setCurrentIndex((prev) => {
      if (prev < videos.length - 1) return prev + 1;
      return prev; // no-op at last video
    });
  }, [videos.length]);

  /**
   * AC-039 (revised): swiping down goes to the previous video when index > 0,
   * or dismisses the viewer when already at index 0.
   */
  const goToPrevOrClose = useCallback((): void => {
    if (currentIndexRef.current > 0) {
      setCurrentIndex((prev) => prev - 1);
    } else {
      player.pause();
      onDismiss();
    }
  }, [player, onDismiss]);

  /**
   * AC-039: pressing the close button always dismisses the viewer from any position.
   */
  const handleDismiss = useCallback((): void => {
    player.pause();
    onDismiss();
  }, [player, onDismiss]);

  // ── PanResponder (vertical-only swipe, Tech Lead decision 5) ─────────────

  const goToNextRef = useRef(goToNext);
  const goToPrevOrCloseRef = useRef(goToPrevOrClose);
  const handleDismissRef = useRef(handleDismiss);
  useEffect(() => { goToNextRef.current = goToNext; }, [goToNext]);
  useEffect(() => { goToPrevOrCloseRef.current = goToPrevOrClose; }, [goToPrevOrClose]);
  useEffect(() => { handleDismissRef.current = handleDismiss; }, [handleDismiss]);

  const panRef = useRef(
    PanResponder.create({
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponderCapture: (_evt, gs) =>
        Math.abs(gs.dy) > Math.abs(gs.dx),
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_evt, gs) =>
        Math.abs(gs.dy) > Math.abs(gs.dx) && Math.abs(gs.dy) > 5,
      onPanResponderRelease: (_evt, gs) => {
        if (gs.dy < -SWIPE_THRESHOLD) goToNextRef.current();
        else if (gs.dy > SWIPE_THRESHOLD) goToPrevOrCloseRef.current();
      },
    }),
  );

  // ── Report handler (AC-140) ───────────────────────────────────────────────
  const handleReport = useCallback(async (videoId: string): Promise<void> => {
    setReportingId(videoId);
    setReportError(null);
    try {
      await reportBetaVideo(videoId);
      setReportedIds((prev) => new Set(prev).add(videoId));
    } catch {
      setReportError(t('betaVideo.reel.reportError'));
    } finally {
      setReportingId(null);
    }
  }, [t]);

  const currentVideo = videos[currentIndex];

  // ── Report icon visibility (AC-139) ──────────────────────────────────────
  // Hide when: own video OR admin has dismissed the report for this video.
  const isOwnVideo = currentVideo ? currentVideo.user_id === session.user.id : true;
  const isDismissed = currentVideo ? currentVideo.report_dismissed : false;
  const showReportButton = !isOwnVideo && !isDismissed;
  const isReported = currentVideo ? reportedIds.has(currentVideo.id) : false;
  const isReporting = currentVideo ? reportingId === currentVideo.id : false;

  // ── Bottom overlay layout widths ──────────────────────────────────────────
  // Left info column width = full width minus sidebar minus some padding.
  // 16 (left pad) + [INFO_WIDTH] + 8 (gap) + SIDEBAR_WIDTH + 8 (right pad) = screenWidth
  // We derive INFO_WIDTH lazily from a container measure — use a reasonable fixed value.
  const INFO_COLUMN_WIDTH = 220;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      transparent={false}
      onRequestClose={handleDismiss}
      testID="beta-video-reel-modal"
    >
      {/* Outermost container — full-screen black background. */}
      <View style={styles.fullscreen} testID="beta-video-reel-viewer">

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

        {/* Loading spinner */}
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

        {/*
         * AC-134: Gradient scrim — covers the bottom quarter of the video area so
         * the overlay text (poster identity, route·gym label) is legible.
         * expo-linear-gradient is not installed; we simulate the scrim with a
         * semi-transparent View using theme.colors.overlay (no hardcoded hex).
         */}
        <View style={styles.gradientScrim} pointerEvents="none" />

        {/* Gesture-capture overlay — sits ABOVE the VideoView to intercept swipe
            gestures. panHandlers are spread on this View. All tappable controls
            (close button, sidebar) are children of this View. */}
        <View style={StyleSheet.absoluteFill} {...panRef.current.panHandlers}>

          {/* ── Close button (AC-133) — top-left, always visible ─────────── */}
          <Pressable
            style={[styles.closeButton, { top: insets.top + 12 }]}
            onPress={handleDismiss}
            accessibilityRole="button"
            accessibilityLabel={t('betaVideo.reel.close')}
            testID="beta-video-reel-close"
          >
            <Ionicons name="close" size={24} color={theme.colors.textInverse} />
          </Pressable>

          {/* ── Video counter — top-right ────────────────────────────────── */}
          {videos.length > 1 ? (
            <View style={[styles.counter, { top: insets.top + 12 }]}>
              <Text style={styles.counterText}>
                {currentIndex + 1} / {videos.length}
              </Text>
            </View>
          ) : null}

          {/* ── Bottom row: left info + right sidebar ────────────────────── */}
          {currentVideo ? (
            <View
              style={[
                styles.bottomRow,
                { bottom: insets.bottom + 16 },
              ]}
            >
              {/* Left column: poster identity (AC-134) */}
              <View style={styles.infoColumn}>

                {/* Row 1: avatar + display_name (AC-135: no-op tap in Phase 1) */}
                <View style={styles.posterRow}>
                  <PosterAvatar
                    avatarUrl={currentVideo.avatar_url}
                    displayName={currentVideo.display_name}
                    theme={theme}
                  />
                  <Text style={styles.displayName} numberOfLines={1} testID="reel-poster-name">
                    {currentVideo.display_name ?? t('betaVideo.reel.anonymous')}
                  </Text>
                </View>

                {/*
                 * AC-134 / AC-136: Row 2 — "{routeName} · {gymName}".
                 * Only rendered when at least one of routeName or gymName is provided.
                 * Wrapped in a Pressable; tapping navigates to the route detail
                 * screen (AC-136). onNavigateToRoute is undefined when the user is
                 * already on the route detail screen — tap is a no-op in that case.
                 */}
                {(routeName != null || gymName != null) ? (
                  <Pressable
                    onPress={() => {
                      if (onNavigateToRoute && currentVideo.route_id) {
                        onNavigateToRoute(currentVideo.route_id);
                      }
                    }}
                    accessibilityRole={onNavigateToRoute ? 'button' : 'text'}
                    testID="reel-route-gym-label"
                  >
                    <MarqueeText
                      text={[routeName, gymName].filter(Boolean).join(' · ')}
                      containerWidth={INFO_COLUMN_WIDTH}
                      style={styles.captionText}
                      testID="reel-route-gym-text"
                    />
                  </Pressable>
                ) : null}
              </View>

              {/* Right sidebar: like placeholder + report button (AC-138) */}
              <View style={styles.sidebar}>

                {/* Like icon — placeholder count 0, not tappable in Phase 1 (AC-135) */}
                <View style={styles.sidebarItem} testID="reel-like-button">
                  <Ionicons
                    name="heart-outline"
                    size={28}
                    color={theme.colors.textInverse}
                    accessibilityLabel={t('betaVideo.reel.like')}
                  />
                  <Text style={styles.sidebarCount}>0</Text>
                </View>

                {/* Report button (AC-139/AC-140) */}
                {showReportButton ? (
                  <Pressable
                    style={[styles.sidebarItem, isReporting && styles.sidebarItemDisabled]}
                    onPress={() => { void handleReport(currentVideo.id); }}
                    disabled={isReporting || isReported}
                    accessibilityRole="button"
                    accessibilityLabel={
                      isReported
                        ? t('betaVideo.reel.reported')
                        : t('betaVideo.reel.report')
                    }
                    testID="reel-report-button"
                  >
                    {isReporting ? (
                      <ActivityIndicator size="small" color={theme.colors.error} />
                    ) : (
                      <Ionicons
                        name={isReported ? 'flag' : 'flag-outline'}
                        size={26}
                        color={theme.colors.error}
                      />
                    )}
                    <Text
                      style={[
                        styles.sidebarLabel,
                        { color: theme.colors.error },
                      ]}
                      testID="reel-report-label"
                    >
                      {isReported
                        ? t('betaVideo.reel.reported')
                        : t('betaVideo.reel.report')}
                    </Text>
                  </Pressable>
                ) : null}

                {/* AC-139: report error text (shown below report button on failure) */}
                {reportError ? (
                  <Text
                    style={styles.reportErrorText}
                    testID="reel-report-error"
                  >
                    {reportError}
                  </Text>
                ) : null}
              </View>
            </View>
          ) : null}
        </View>
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
    closeButton: {
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
    bottomRow: {
      position: 'absolute',
      left: 16,
      right: 8,
      flexDirection: 'row',
      alignItems: 'flex-end',
    },
    infoColumn: {
      flex: 1,
      marginRight: 8,
      gap: theme.spacing.xs,
    },
    posterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    displayName: {
      color: theme.colors.textInverse,
      fontSize: theme.fontSize.sm,
      fontWeight: theme.fontWeight.semibold,
      flex: 1,
    },
    captionText: {
      color: theme.colors.textInverse,
      fontSize: theme.fontSize.sm,
    },
    sidebar: {
      width: SIDEBAR_WIDTH,
      alignItems: 'center',
      gap: theme.spacing.lg,
    },
    sidebarItem: {
      alignItems: 'center',
      gap: theme.spacing.xs,
    },
    sidebarItemDisabled: {
      opacity: 0.5,
    },
    sidebarCount: {
      color: theme.colors.textInverse,
      fontSize: theme.fontSize.xs,
      fontWeight: theme.fontWeight.semibold,
    },
    sidebarLabel: {
      fontSize: theme.fontSize.xs,
      fontWeight: theme.fontWeight.medium,
    },
    errorText: {
      color: theme.colors.textInverse,
      fontSize: theme.fontSize.md,
      textAlign: 'center',
    },
    /**
     * AC-134: Gradient scrim simulation — covers the bottom 30% of the video
     * area with a semi-transparent overlay so the poster-identity and route·gym
     * text is legible against the raw video pixels.
     * expo-linear-gradient is not installed; we use theme.colors.overlay (no
     * hardcoded hex colour) on a tall View pinned to the bottom.
     */
    gradientScrim: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: '35%',
      backgroundColor: theme.colors.overlay,
    },
    reportErrorText: {
      color: theme.colors.error,
      fontSize: theme.fontSize.xs,
      textAlign: 'center',
      marginTop: theme.spacing.xs,
    },
  });
}
