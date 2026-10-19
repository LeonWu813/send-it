/**
 * BetaVideoReelViewer — fullscreen reel viewer for a route's beta videos.
 *
 * AC-039: Tapping a thumbnail opens a fullscreen portrait viewer that
 * auto-plays the selected video. Swiping up advances to the next video;
 * swiping down (or tapping the close button) dismisses the viewer.
 *
 * AC-133: Persistent top-left close button — never unmounts or loses tap target.
 * AC-134: Bottom-left poster-identity overlay (avatar + display_name + route/gym info).
 * AC-135 (revised): Tapping Row 1 (avatar or display_name) calls onNavigateToUser then onDismiss.
 * AC-137: Marquee animation for overflowing text (pure-JS Animated translateX).
 * AC-138: Right sidebar — like icon (placeholder) + report icon.
 * AC-139: Report icon hidden for own videos and admin-dismissed videos.
 * AC-140: Report icon calls report_beta_video RPC; local reportedIds tracks success.
 *
 * Design system v1.2 (off-spec design work): everything that sits on the video uses the fixed
 * media tokens (`onMedia`, `mediaScrim`, `mediaScrimStrong`, `mediaBackground`) so it stays
 * visible in both themes; controls sit inside the safe area (no `|| 34` fallback, no fixed
 * padding); the like fistbump is `onMedia` (filled vs outline, never red) with the like motion
 * (celebratePeak + topOut + particles, Reduce Motion = cross-fade only).
 *
 * Architecture (Tech Lead decisions, Rev 13 + Rev 16):
 * 1. Portrait lock: `app.json` already sets `"orientation": "portrait"` globally.
 * 2. Modal architecture: RN `<Modal>` — same pattern as BetaVideoUploader.
 * 3. Playlist order: videos array ordered `created_at DESC`; tap index 1:1; no wrap.
 * 4. No `enterFullscreen()` — VideoView fills the modal.
 * 5. PanResponder (vertical-only). Explicit close button as accessible fallback.
 * 6. Thumbnails: placeholder only — no VideoView per grid cell.
 * Rev 16 (updated): four-layer sibling architecture inside the animated content wrapper:
 *   Layer 1 — VideoView (absoluteFill, opacity:0 while loading)
 *   Layer 2 — black loading background (absoluteFill, only when isVideoLoading && !urlError;
 *              covers opacity-0 VideoView; sits below metadata so metadata always visible)
 *   Layer 3 — PanResponder gesture capture (absoluteFill, no children)
 *   Layer 4 — interactive overlay UI (absoluteFill, pointerEvents box-none,
 *              rendered last so its Pressable children win touch delivery;
 *              always rendered so metadata is visible during buffering)
 *
 * Gesture architecture:
 * - Layer 3 (`{...panHandlers}`) intercepts swipe gestures but has NO children,
 *   so it never steals touches from Pressable elements.
 * - Layer 4 uses `pointerEvents="box-none"`: the container itself passes through
 *   non-interactive touches to Layer 3, but its Pressable children (close button,
 *   report button) receive their own taps without PanResponder interference.
 * - This resolves the chevron non-responsive bug (Bug 1 — AC-133).
 *
 * Swipe animation:
 * - `dragY` Animated.Value tracks finger movement during a swipe.
 * - On release: if threshold crossed, `Animated.timing` slides the entire
 *   Animated.View off-screen, then index changes and `dragY` resets to 0.
 * - If threshold not crossed: `Animated.spring` snaps back to 0.
 * - The entire content (all four layers) is wrapped in one `Animated.View`
 *   with `transform: [{ translateY: dragY }]`.
 */

import type { Session } from '@supabase/supabase-js';
import { Ionicons } from '@expo/vector-icons';
import { useEventListener } from 'expo';
import { VideoView, useVideoPlayer } from 'expo-video';
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Animated,
  Modal,
  PanResponder,
  Pressable,
  StatusBar,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../../../components/ui/AppText';
import { Avatar } from '../../../components/ui/Avatar';
import { IconButton } from '../../../components/ui/IconButton';
import { Spinner } from '../../../components/ui/ProgressBar';
import { ICON } from '../../../lib/icons';
import { SPRING_REST, USE_NATIVE_DRIVER, bezierFor, useMotion } from '../../../lib/motion';
import { supabase } from '../../../lib/supabase';
import { useLayout, useTheme } from '../../../lib/theme';
import TapeBadge from '../../mod-route-catalog/components/TapeBadge';
import { ACTION_SIZE, ReelAction } from './ReelAction';
import { ReelScrim } from './ReelScrim';
import { fetchLikeInfo, likeBetaVideo, unlikeBetaVideo } from '../../mod-social-feed/social-feed-service';
import { getVideoSignedUrl, reportBetaVideo } from '../beta-video-service';
import type { BetaVideo } from '../types';

/** Minimum dy (in pixels) to trigger a swipe. */
const SWIPE_THRESHOLD = 50;

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
  /** Optional route tape colour (v2.2 info row: TapeBadge `md` with a white outline). Omitted: no badge. */
  routeColor?: string;
  /** Optional grade printed on the tape (e.g. "V4"). */
  routeGrade?: string;
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
  /**
   * AC-135 (revised): Called when the user taps Row 1 (avatar or display_name).
   * Receives the user_id of the current video's poster.
   * The viewer calls this then onDismiss(). Optional — if omitted, tap is a no-op.
   * MOD-005 must NOT import any profile screen directly; the callback is the only coupling.
   */
  onNavigateToUser?: (userId: string) => void;
  /**
   * AC-164: Controls whether the poster Row 1 is tappable.
   *   'route' (default) — existing behavior: poster row taps navigate to poster's
   *     profile via onNavigateToUser (AC-135).
   *   'profile' — poster row is visible (avatar + display_name rendered) but the
   *     outer Pressable is disabled and onNavigateToUser is never called. Used
   *     when BetaVideoReelViewer is hosted on a profile screen (MOD-001, MOD-006)
   *     where navigating to the same profile would be redundant.
   */
  reelContext?: 'route' | 'profile';
}

// ── MarqueeText — pure-JS translateX marquee for overflowing text (AC-137) ────

interface MarqueeTextProps {
  text: string;
  containerWidth: number;
  style?: object;
  testID?: string;
  /** Reduce Motion: no scrolling, the single line is truncated instead. */
  reduceMotion?: boolean;
}

/**
 * Renders `text` inside an `overflow:'hidden'` container. If the text is wider
 * than `containerWidth`, a looping `Animated.translateX` marquee scrolls it.
 * No native package — pure RN Animated (AC-137).
 */
function MarqueeText({ text, containerWidth, style, testID, reduceMotion = false }: MarqueeTextProps): React.JSX.Element {
  const translateX = useRef(new Animated.Value(0)).current;
  const [textWidth, setTextWidth] = useState(0);
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (!reduceMotion && textWidth > containerWidth && containerWidth > 0) {
      animRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(translateX, {
            toValue: -(textWidth - containerWidth),
            duration: MARQUEE_DURATION_MS,
            easing: bezierFor('linear'),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.delay(1000),
          Animated.timing(translateX, {
            toValue: 0,
            duration: 0,
            easing: bezierFor('linear'),
            useNativeDriver: USE_NATIVE_DRIVER,
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
  }, [textWidth, containerWidth, translateX, reduceMotion]);

  return (
    <View style={{ width: containerWidth, overflow: 'hidden' }}>
      <Animated.Text
        maxFontSizeMultiplier={1.6}
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

// ── PosterAvatar — ui/ Avatar (sm 32) with the initial-letter fallback (AC-134/AC-138) ─

interface PosterAvatarProps {
  avatarUrl: string | null;
  displayName: string | null;
}

function PosterAvatar({ avatarUrl, displayName }: PosterAvatarProps): React.JSX.Element {
  return (
    <View testID={avatarUrl ? 'reel-poster-avatar' : 'reel-poster-avatar-placeholder'}>
      <Avatar size="sm" uri={avatarUrl} name={displayName ?? undefined} decorative />
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
  routeColor,
  routeGrade,
  gymName,
  onNavigateToRoute,
  onNavigateToUser,
  reelContext = 'route',
}: BetaVideoReelViewerProps): React.JSX.Element {
  const { theme } = useTheme();
  const { t } = useTranslation('common');
  const insets = useSafeAreaInsets();
  const { screenMargin } = useLayout();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const { duration, spring, reduceMotion } = useMotion();
  const styles = makeStyles(theme);

  // The PanResponder is created once, so it reads the live window height / motion values
  // through refs instead of capturing the first render's values.
  const windowHeightRef = useRef(windowHeight);
  windowHeightRef.current = windowHeight;
  const motionRef = useRef({ duration, spring });
  motionRef.current = { duration, spring };

  // ── Index state ───────────────────────────────────────────────────────────
  const [currentIndex, setCurrentIndex] = useState<number>(initialIndex);

  // ── Swipe animation ───────────────────────────────────────────────────────
  // Tracks the finger's vertical offset during a swipe gesture.
  // Applied as `translateY` on the entire content Animated.View.
  const dragY = useRef(new Animated.Value(0)).current;

  // ── Video loading overlay (AC-039 / AC-133 timing fix) ────────────────────
  // True from the moment a swipe is committed (set immediately in the swipe
  // handler — Root cause 1 fix) until the player fires statusChange=readyToPlay
  // (Root cause 2 fix: useEventListener replaces the unreliable onFirstFrameRender).
  // The useEffect below is a belt-and-suspenders fallback: for the initial open
  // and any non-swipe index change it ensures the overlay is shown; for swipes it
  // is a no-op (overlay is already true from the swipe handler).
  // The overlay is rendered as a sibling of the dragY-transformed Animated.View
  // (Root cause 3 fix) so it covers the full screen during the slide animation.
  const [isVideoLoading, setIsVideoLoading] = useState(false);

  // Fallback: ensure overlay is on whenever the active index changes.
  useEffect(() => {
    setIsVideoLoading(true);
  }, [currentIndex]);

  // Reset to initialIndex whenever the viewer opens; also reset dragY.
  useEffect(() => {
    if (visible) {
      setCurrentIndex(initialIndex);
      dragY.setValue(0);
    }
  }, [visible, initialIndex, dragY]);

  // ── Signed URL state ─────────────────────────────────────────────────────
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [urlLoading, setUrlLoading] = useState(false);
  const [urlError, setUrlError] = useState(false);

  // ── Current authenticated user ID (Bug 2 — own-video check) ─────────────
  // Fetched once on mount via supabase.auth.getSession(). Used to determine
  // whether the current video belongs to the viewer so the poster row can be
  // made non-tappable and the report button hidden for own videos (AC-139).
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setCurrentUserId(data.session?.user.id ?? null);
    });
  }, []);

  // ── Like state (AC-052) ───────────────────────────────────────────────────
  // Per-video like state. Fetched from the `get_like_info` RPC whenever the
  // currentIndex changes and the viewer is visible.
  const [isLiked, setIsLiked] = useState<boolean>(false);
  const [likeCount, setLikeCount] = useState<number>(0);
  // True while a like/unlike request is in flight — prevents double-tap.
  const [isLikePending, setIsLikePending] = useState<boolean>(false);

  // Fetch like info whenever the active video changes.
  useEffect(() => {
    if (!visible || videos.length === 0) return;
    const video = videos[currentIndex];
    if (!video) return;

    let cancelled = false;
    fetchLikeInfo(video.id)
      .then(({ like_count, user_has_liked }) => {
        if (cancelled) return;
        setLikeCount(like_count);
        setIsLiked(user_has_liked);
      })
      .catch(() => {
        // Non-fatal: keep whatever state was already showing.
      });
    return () => {
      cancelled = true;
    };
  }, [currentIndex, visible, videos]);

  // Reset like UI state when index changes so there is no stale display between
  // the index change and the fetchLikeInfo response.
  useEffect(() => {
    setIsLiked(false);
    setLikeCount(0);
    setIsLikePending(false);
  }, [currentIndex]);

  // ── Like handler (AC-052) ────────────────────────────────────────────────
  const handleLike = useCallback(async (): Promise<void> => {
    if (isLikePending) return;
    const video = videos[currentIndex];
    if (!video) return;

    // Optimistic update.
    const wasLiked = isLiked;
    const prevCount = likeCount;
    setIsLiked(!wasLiked);
    setLikeCount(wasLiked ? prevCount - 1 : prevCount + 1);
    setIsLikePending(true);

    try {
      if (wasLiked) {
        await unlikeBetaVideo(video.id);
      } else {
        await likeBetaVideo(video.id);
      }
      // Re-fetch authoritative count from DB after mutation.
      const { like_count, user_has_liked } = await fetchLikeInfo(video.id);
      setLikeCount(like_count);
      setIsLiked(user_has_liked);
    } catch {
      // Revert optimistic update on error.
      setIsLiked(wasLiked);
      setLikeCount(prevCount);
    } finally {
      setIsLikePending(false);
    }
  }, [isLikePending, isLiked, likeCount, currentIndex, videos]);

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

  /**
   * AC-039 / AC-133 fix (Cause B — revised):
   * Only handle the `error` status here. Clearing the overlay on `readyToPlay`
   * is too early on iOS: `readyToPlay` fires when enough data has buffered to
   * start playback, but AVPlayerLayer still holds the previous source's last
   * decoded frame at that moment — the new frame has not yet been composited.
   * The overlay is now cleared in `onFirstFrameRender` on VideoView instead
   * (see below), which fires after the first frame of the new source has been
   * painted to screen — exactly the right moment to reveal the video.
   */
  useEventListener(player, 'statusChange', ({ status }) => {
    if (status === 'error') {
      setIsVideoLoading(false);
      setUrlError(true);
    }
  });

  useEffect(() => {
    return () => {
      try { player.pause(); } catch { /* native object may be already deallocated */ }
    };
  }, [player]);

  useEffect(() => {
    if (!visible) {
      try { player.pause(); } catch { /* native object may be already deallocated */ }
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
          if (!cancelled) try { player.play(); } catch { /* native object may be already deallocated */ }
        }).catch(() => {
          if (!cancelled) setUrlError(true);
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
      try { player.pause(); } catch { /* native object may be already deallocated */ }
      onDismiss();
    }
  }, [player, onDismiss]);

  /**
   * AC-039: pressing the close button always dismisses the viewer from any position.
   */
  const handleDismiss = useCallback((): void => {
    try { player.pause(); } catch { /* native object may be already deallocated */ }
    onDismiss();
  }, [player, onDismiss]);

  // ── PanResponder (vertical-only swipe, Tech Lead decision 5) ─────────────

  const goToNextRef = useRef(goToNext);
  const goToPrevOrCloseRef = useRef(goToPrevOrClose);
  const handleDismissRef = useRef(handleDismiss);
  useEffect(() => { goToNextRef.current = goToNext; }, [goToNext]);
  useEffect(() => { goToPrevOrCloseRef.current = goToPrevOrClose; }, [goToPrevOrClose]);
  useEffect(() => { handleDismissRef.current = handleDismiss; }, [handleDismiss]);

  // playerRef keeps a stable, always-current reference to `player` for use inside
  // the PanResponder closure (created once via useRef — would otherwise see a
  // stale closure over the initial player value).
  const playerRef = useRef(player);
  useEffect(() => { playerRef.current = player; }, [player]);

  // Keep a stable ref to videos.length so the PanResponder closure (created
  // once via useRef) always sees the latest count without being recreated.
  const videosLengthRef = useRef(videos.length);
  useEffect(() => { videosLengthRef.current = videos.length; }, [videos.length]);

  const panRef = useRef(
    PanResponder.create({
      // Layer 3 and Layer 4 are siblings inside Animated.View — not parent/child.
      // React Native's capture phase only travels through the direct ancestor chain
      // to the target view; siblings do not participate in each other's capture phase.
      // Therefore onStartShouldSetPanResponderCapture: true on Layer 3 does NOT
      // steal taps from Pressables in Layer 4 (those touches never pass through
      // Layer 3 at all). What it DOES do is let Layer 3 beat iOS's native AVFoundation
      // player, which otherwise claims the gesture at the native layer before the JS
      // move-phase can run — causing swipes to be swallowed by the video player.
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,

      // Capture on directional vertical move — this beats native VideoView on swipes.
      // The 10px threshold prevents accidental capture on taps or horizontal scrolls.
      // onMoveShouldSetPanResponderCapture fires after the first move event (not on
      // tap-start), so single taps are never captured.
      onMoveShouldSetPanResponder: (_evt, gs) =>
        Math.abs(gs.dy) > 10 && Math.abs(gs.dy) > Math.abs(gs.dx),
      onMoveShouldSetPanResponderCapture: (_evt, gs) =>
        Math.abs(gs.dy) > 10 && Math.abs(gs.dy) > Math.abs(gs.dx),
      onPanResponderMove: (_evt, gs) => {
        // Track finger movement for the swipe animation.
        dragY.setValue(gs.dy);
      },
      onPanResponderRelease: (_evt, gs) => {
        const { dy, dx } = gs;

        // Tap detection: minimal displacement in both axes = tap, not a swipe.
        // Toggle play/pause on the current video.
        if (Math.abs(dy) < 10 && Math.abs(dx) < 10) {
          if (playerRef.current.playing) {
            try { playerRef.current.pause(); } catch { /* native object may be already deallocated */ }
          } else {
            try { playerRef.current.play(); } catch { /* native object may be already deallocated */ }
          }
          return; // do not process swipe logic
        }

        if (dy < -SWIPE_THRESHOLD) {
          // Swipe up → next video (if one exists).
          if (currentIndexRef.current < videosLengthRef.current - 1) {
            // AC-039 / AC-133 fix (Root cause 1): set the overlay immediately on
            // swipe commit — before the 250 ms slide animation — so the old video
            // is covered by the black overlay from the moment the user lifts their
            // finger, not 250 ms later when the index finally changes.
            setIsVideoLoading(true);
            Animated.timing(dragY, {
              toValue: -windowHeightRef.current,
              duration: motionRef.current.duration.medium,
              easing: bezierFor('exit'),
              useNativeDriver: USE_NATIVE_DRIVER,
            }).start(() => {
              dragY.setValue(0);
              setCurrentIndex((prev) => prev + 1);
            });
          } else {
            // Already at last — snap back.
            Animated.spring(dragY, { toValue: 0, ...motionRef.current.spring.settle, ...SPRING_REST, useNativeDriver: USE_NATIVE_DRIVER }).start();
          }
        } else if (dy > SWIPE_THRESHOLD) {
          // Swipe down → previous video or dismiss.
          if (currentIndexRef.current > 0) {
            // AC-039 / AC-133 fix (Root cause 1): same early overlay for swipe-down.
            setIsVideoLoading(true);
            Animated.timing(dragY, {
              toValue: windowHeightRef.current,
              duration: motionRef.current.duration.medium,
              easing: bezierFor('exit'),
              useNativeDriver: USE_NATIVE_DRIVER,
            }).start(() => {
              dragY.setValue(0);
              setCurrentIndex((prev) => prev - 1);
            });
          } else {
            // At first video — dismiss immediately.
            // No slide-out animation here: the Modal's own animationType="slide"
            // provides the visual dismiss transition, and calling onDismiss
            // synchronously ensures the close gesture is always responsive.
            dragY.setValue(0);
            handleDismissRef.current();
          }
        } else {
          // Threshold not crossed — snap back to resting position.
          Animated.spring(dragY, { toValue: 0, ...motionRef.current.spring.settle, ...SPRING_REST, useNativeDriver: USE_NATIVE_DRIVER }).start();
        }
      },
      onPanResponderTerminate: () => {
        // Another responder (e.g. a system gesture) took over — snap back.
        Animated.spring(dragY, { toValue: 0, ...motionRef.current.spring.settle, ...SPRING_REST, useNativeDriver: USE_NATIVE_DRIVER }).start();
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

  /**
   * AC-135 (revised): tapping Row 1 (avatar or display_name) navigates to the
   * poster's profile and dismisses the viewer. The callback is optional — if
   * onNavigateToUser is not provided, the tap is a no-op.
   */
  const handleNavigateToUser = useCallback((): void => {
    if (!currentVideo || !onNavigateToUser) return;
    onNavigateToUser(currentVideo.user_id);
    handleDismiss();
  }, [currentVideo, onNavigateToUser, handleDismiss]);

  // ── Own-video check (Bug 2 / AC-139) ─────────────────────────────────────
  // isOwnVideo is true when the current video was uploaded by the authenticated
  // viewer. Derived from the session-fetched currentUserId (not from the session
  // prop) so it reflects the actual viewer even when the component is hosted on
  // a profile screen where the session prop may belong to a different user.
  // Falls back to false (show report / allow tap) when currentUserId is not yet
  // loaded — the session fetch is near-instant so this is a momentary state.
  const isOwnVideo = currentUserId !== null && currentVideo
    ? currentVideo.user_id === currentUserId
    : false;

  // ── Report icon visibility (AC-139) ──────────────────────────────────────
  // Hide when: own video OR admin has dismissed the report for this video.
  const isDismissed = currentVideo ? currentVideo.report_dismissed : false;
  const showReportButton = !isOwnVideo && !isDismissed;
  const isReported = currentVideo ? reportedIds.has(currentVideo.id) : false;
  const isReporting = currentVideo ? reportingId === currentVideo.id : false;

  // ── Bug 2 fix: per-video route/gym display values ─────────────────────────
  // In route-detail context, routeName/gymName props are provided by the host
  // (BetaVideoSection) and apply to all videos (they are all for the same route).
  // In profile context, those props are not provided; instead each BetaVideo row
  // carries route_name/gym_name joined by fetchBetaVideosByUser. Fall back to the
  // per-video fields when the props are absent so Row 2 is populated in both
  // contexts while remaining backward-compatible with route-detail callers.
  const displayRouteName = routeName ?? currentVideo?.route_name ?? null;
  const displayGymName = gymName ?? currentVideo?.gym_name ?? null;

  // ── Bottom overlay layout widths ──────────────────────────────────────────
  // Left info column width = full width minus sidebar minus some padding.
  // screenMargin + info column + sm gap + 44pt action column + screenMargin = window width.
  // Measured from the laid-out info column (minus its scrim padding); until then an estimate from the window.
  const estimatedInfoWidth = Math.max(0, windowWidth - screenMargin * 2 - ACTION_SIZE - theme.spacing.sm);
  const [infoWidth, setInfoWidth] = useState<number | null>(null);
  const handleInfoLayout = useCallback((e: LayoutChangeEvent): void => {
    const w = e.nativeEvent.layout.width;
    setInfoWidth((prev) => (prev === w ? prev : w));
  }, []);
  const marqueeWidth = Math.max(0, (infoWidth ?? estimatedInfoWidth) - theme.spacing.sm * 2);

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
      {/*
       * Outermost container — full-screen black background.
       * The Animated.View inside translates with dragY during swipe gestures.
       */}
      <View style={styles.fullscreen} testID="beta-video-reel-viewer">
        {/* Always light content: the viewer is black whatever the app theme is. */}
        <StatusBar barStyle="light-content" />

        {/*
         * Animated content wrapper (Bug 3 — swipe animation).
         * All three layers are children of this wrapper so the entire content
         * slides with the finger and animates off-screen on swipe-out.
         */}
        <Animated.View
          style={[StyleSheet.absoluteFill, { transform: [{ translateY: dragY }] }]}
        >

          {/*
           * Layer 1 — VideoView (Bug 1: now a sibling of the gesture layer, not a child).
           *
           * AC-039 / AC-133 fix (Cause C): VideoView is always mounted — never
           * conditionally rendered — so the player lifecycle is never disrupted by
           * teardown/remount. On iOS, AVPlayerLayer holds the previous source's last
           * decoded frame until the new source composites its first frame. Hiding the
           * VideoView via opacity:0 during loading covers that residual frame.
           * When isVideoLoading is true the VideoView is invisible; when false it is
           * visible. The signedUrl/urlError guards that previously conditionally
           * rendered this element are replaced: the error state view (rendered above
           * the VideoView) covers it when urlError is true; the VideoView player source
           * starts as null and is loaded by the useEffect on currentIndex/visible change.
           *
           * AC-039 / AC-133 fix (Cause B): onFirstFrameRender fires after the first
           * frame of the new source has been composited to screen — the correct moment
           * to reveal the video. This replaces the former readyToPlay listener, which
           * fired before the new frame painted (too early on iOS/AVPlayerLayer).
           */}
          <VideoView
            player={player}
            style={[StyleSheet.absoluteFill, { opacity: isVideoLoading ? 0 : 1 }]}
            contentFit="contain"
            nativeControls={false}
            onFirstFrameRender={() => setIsVideoLoading(false)}
            testID={signedUrl && !urlError ? 'beta-video-reel-video-view' : undefined}
          />

          {/* Loading spinner (absolute, sits above VideoView) */}
          {urlLoading ? (
            <View style={styles.centeredOverlay}>
              <View testID="beta-video-reel-loading">
                <Spinner color="onMedia" size="large" accessibilityLabel={t('ui.loading')} />
              </View>
            </View>
          ) : null}

          {/* Error state (absolute, sits above VideoView) */}
          {urlError ? (
            <View style={styles.centeredOverlay}>
              <AppText variant="callout" color="onMedia" align="center" testID="beta-video-reel-error">
                {t('betaVideo.loadError')}
              </AppText>
            </View>
          ) : null}

          {/*
           * Layer 2 — black loading background (UX enhancement).
           * Covers the VideoView (which is opacity:0 during load) so the user sees
           * a black canvas instead of transparency. Rendered BELOW Layer 3 so the
           * metadata overlay (close button, poster identity, sidebar) always paints
           * on top regardless of isVideoLoading. Moved here from the former external
           * sibling position (Root cause 3 fix) — the VideoView opacity:0 already
           * hides the AVPlayerLayer frame hold, so the overlay no longer needs to
           * cover the full screen from outside the Animated.View.
           * Hidden immediately when isVideoLoading becomes false or when there is a
           * URL error (the error view inside this Animated.View is shown instead).
           */}
          {isVideoLoading && !urlError ? (
            <View style={styles.videoLoadingBackground} />
          ) : null}

          {/*
           * Layer 3 — PanResponder gesture capture (Bug 1 fix).
           * This View has NO children — it purely intercepts swipe gestures.
           * Without onStartShouldSetPanResponderCapture, it no longer steals
           * tap events from sibling Pressables in Layer 4.
           */}
          <View style={StyleSheet.absoluteFill} {...panRef.current.panHandlers} />

          {/*
           * Layer 4 — Interactive overlay UI (Bug 1 fix).
           * Rendered LAST (highest z-order) so its Pressable children receive
           * touches before the gesture layers below. pointerEvents="box-none"
           * means the container itself passes through non-interactive touches
           * to Layer 3, while Pressable children still capture their own taps.
           * This layer is always rendered — not gated on isVideoLoading — so
           * metadata (poster identity, route/gym, like, report) remains visible
           * during video buffering (UX enhancement).
           */}
          <View style={StyleSheet.absoluteFill} pointerEvents="box-none">

            {/* ── Loading spinner — video area center, above metadata row ──── */}
            {/*
             * UX enhancement: ActivityIndicator is positioned at ~40% from the top
             * so it sits in the video frame area without overlapping the bottom
             * metadata/action bar. Only shown when isVideoLoading && !urlError.
             */}
            {isVideoLoading && !urlError ? (
              <View style={styles.videoAreaSpinner} testID="beta-video-reel-video-loading">
                <Spinner color="onMedia" size="large" />
              </View>
            ) : null}

            {/* ── Close button (AC-133) — top-left, always visible ─────────── */}
            <View
              style={[styles.closeButton, { top: insets.top + theme.spacing.smd, left: screenMargin }]}
              testID="beta-video-reel-close"
            >
              <IconButton
                variant="media"
                name={ICON.back.outline}
                size={theme.iconSize.lg}
                accessibilityLabel={t('betaVideo.reel.close')}
                onPress={handleDismiss}
              />
            </View>

            {/* ── Video counter — top-right ────────────────────────────────── */}
            {videos.length > 1 ? (
              <View
                style={[styles.counter, { top: insets.top + theme.spacing.smd, right: screenMargin }]}
                accessible
                accessibilityLabel={`${currentIndex + 1} / ${videos.length}`}
              >
                <AppText variant="footnote" weight="600" numeric color="onMedia">
                  {currentIndex + 1} / {videos.length}
                </AppText>
              </View>
            ) : null}

            {/* Bottom scrim: 220pt mediaScrimStrong -> transparent (v2.2). */}
            <ReelScrim />

            {/* ── Bottom row: left info + right sidebar ────────────────────── */}
            {currentVideo ? (
              <View
                style={[
                  styles.bottomRow,
                  {
                    left: screenMargin,
                    right: screenMargin,
                    bottom: Math.max(insets.bottom, theme.spacing.md) + theme.spacing.md,
                  },
                ]}
              >
                {/* Left column: poster identity (AC-134) */}
                <View style={styles.infoColumn} onLayout={handleInfoLayout}>

                  {/*
                   * AC-134 / AC-136: Row 2 — "{routeName} · {gymName}".
                   * Bug 2 fix: uses displayRouteName/displayGymName which fall back
                   * to per-video route_name/gym_name when host props are absent,
                   * enabling Row 2 in profile context (fetchBetaVideosByUser joins).
                   * Wrapped in a Pressable; tapping navigates to the route detail
                   * screen (AC-136). onNavigateToRoute is undefined when the user is
                   * already on the route detail screen — tap is a no-op in that case.
                   */}
                  {(displayRouteName != null || displayGymName != null) ? (
                    <Pressable
                      style={styles.routeRow}
                      onPress={() => {
                        if (onNavigateToRoute && currentVideo.route_id) {
                          onNavigateToRoute(currentVideo.route_id);
                        }
                      }}
                      accessibilityRole={onNavigateToRoute ? 'button' : 'text'}
                      testID="reel-route-gym-label"
                    >
                      {routeColor ? (
                        <View style={{ marginRight: theme.spacing.sm }}>
                          <TapeBadge color={routeColor} grade={routeGrade} size="md" onMedia />
                        </View>
                      ) : null}
                      <MarqueeText
                        text={[displayRouteName, displayGymName].filter(Boolean).join(' · ')}
                        containerWidth={routeColor ? Math.max(0, marqueeWidth - 64) : marqueeWidth}
                        reduceMotion={reduceMotion}
                        style={styles.captionText}
                        testID="reel-route-gym-text"
                      />
                    </Pressable>
                  ) : null}
                  {/*
                   * Row 1: avatar + display_name (AC-135 revised, AC-164, Bug 2).
                   * When reelContext === 'route' AND !isOwnVideo: tapping navigates
                   *   to the poster's profile via onNavigateToUser, then dismisses.
                   * When reelContext === 'profile': poster row visible, not tappable.
                   * When isOwnVideo: poster row visible, not tappable regardless of
                   *   reelContext (navigating to your own profile from your own video
                   *   is redundant and the report button is already hidden).
                   */}
                  <Pressable
                    style={styles.posterRow}
                    onPress={
                      reelContext === 'route' && !isOwnVideo
                        ? handleNavigateToUser
                        : undefined
                    }
                    disabled={reelContext === 'profile' || isOwnVideo}
                    accessibilityRole={
                      reelContext === 'route' && !isOwnVideo && onNavigateToUser
                        ? 'button'
                        : 'text'
                    }
                    accessibilityLabel={
                      currentVideo.display_name ?? t('betaVideo.reel.anonymous')
                    }
                    testID="reel-poster-row"
                  >
                    <PosterAvatar
                      avatarUrl={currentVideo.avatar_url}
                      displayName={currentVideo.display_name}
                    />
                    <AppText
                      variant="footnote"
                      weight="600"
                      color="onMedia"
                      numberOfLines={1}
                      style={styles.displayName}
                      testID="reel-poster-name"
                    >
                      {currentVideo.display_name ?? t('betaVideo.reel.anonymous')}
                    </AppText>
                  </Pressable>

                </View>

                {/* Right sidebar: like placeholder + report button (AC-138) */}
                <View style={styles.sidebar}>

                  {/* Like button (AC-052): 👊 fistbump emoji, opacity = selected state (never red). */}
                  <ReelAction
                    testID="reel-like-button"
                    accessibilityLabel={t('betaVideo.reel.likeLabel', { count: likeCount })}
                    onPress={() => { void handleLike(); }}
                    emoji="👊"
                    selected={isLiked}
                    disabled={isLikePending}
                    likeMotion
                    caption={String(likeCount)}
                  />

                  {/* Report button (AC-139/AC-140): flag, onMedia (was error red). */}
                  {showReportButton ? (
                    <ReelAction
                      testID="reel-report-button"
                      accessibilityLabel={
                        isReported
                          ? t('betaVideo.reel.reported')
                          : t('betaVideo.reel.report')
                      }
                      onPress={() => { void handleReport(currentVideo.id); }}
                      nameOff={ICON.report.outline}
                      nameOn={ICON.report.filled}
                      selected={isReported}
                      disabled={isReporting || isReported}
                      busy={isReporting}
                      caption={
                        isReported
                          ? t('betaVideo.reel.reported')
                          : t('betaVideo.reel.report')
                      }
                      captionTestID="reel-report-label"
                    />
                  ) : null}

                  {/* AC-139: report error text (shown below report button on failure) */}
                  {reportError ? (
                    <AppText
                      variant="caption1"
                      color="onMedia"
                      align="center"
                      style={styles.reportErrorText}
                      testID="reel-report-error"
                    >
                      {reportError}
                    </AppText>
                  ) : null}
                </View>
              </View>
            ) : null}
          </View>

        </Animated.View>

      </View>
    </Modal>
  );
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function makeStyles(theme: ReturnType<typeof useTheme>['theme']) {
  const c = theme.colors;
  return StyleSheet.create({
    fullscreen: {
      flex: 1,
      backgroundColor: c.mediaBackground,
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
    /** top / left are set inline from the safe-area inset and screenMargin. */
    closeButton: {
      position: 'absolute',
    },
    /** Counter pill on a scrim (top / right set inline). Min height keeps it level with the 44 back button. */
    counter: {
      position: 'absolute',
      minHeight: theme.layout.minTouchTarget,
      justifyContent: 'center',
      backgroundColor: c.mediaScrim,
      borderRadius: theme.borderRadius.full,
      paddingHorizontal: theme.spacing.smd,
    },
    /** left / right / bottom are set inline from screenMargin and the safe-area inset. */
    bottomRow: {
      position: 'absolute',
      flexDirection: 'row',
      alignItems: 'flex-end',
    },
    /** Identity text sits on a scrim so onMedia stays readable on bright footage. */
    infoColumn: {
      flex: 1,
      marginRight: theme.spacing.sm,
      gap: theme.spacing.xs,
    },
    posterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      minHeight: theme.layout.minTouchTarget,
    },
    displayName: {
      flex: 1,
    },
    captionText: {
      color: c.onMedia,
      fontSize: theme.typeScale.footnote.fontSize,
      lineHeight: theme.typeScale.footnote.lineHeight,
      fontWeight: theme.typeScale.footnote.fontWeight,
    },
    sidebar: {
      width: ACTION_SIZE,
      alignItems: 'center',
      gap: theme.spacing.md,
    },
    reportErrorText: {
      marginTop: theme.spacing.xs,
    },
    routeRow: {
      minHeight: theme.layout.minTouchTarget,
      flexDirection: 'row',
      alignItems: 'center',
    },
    /**
     * Loading background inside the Animated.View, below the metadata overlay in z-order. Covers the
     * opacity-0 VideoView with the fixed media black.
     */
    videoLoadingBackground: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: c.mediaBackground,
    },
    /** Spinner at ~40% from the top so it sits in the video area, clear of the bottom bar. */
    videoAreaSpinner: {
      position: 'absolute',
      top: '40%',
      left: 0,
      right: 0,
      alignItems: 'center',
    },
  });
}
