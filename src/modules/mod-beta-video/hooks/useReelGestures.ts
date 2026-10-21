/**
 * useReelGestures — vertical swipe gesture handler for BetaVideoReelViewer.
 *
 * Extracted from BetaVideoReelViewer.tsx (INT-017 refactor, Leon request 2026-10-21).
 * Owns the PanResponder creation and all refs required to keep its callbacks
 * stale-closure-free. Returns `panHandlers` to spread onto the gesture-capture View.
 *
 * Architecture (Tech Lead decision 5, Rev 13):
 * - Vertical-only PanResponder; no react-native-gesture-handler.
 * - onStartShouldSetPanResponderCapture: true lets Layer 3 beat iOS AVFoundation
 *   on the start phase so swipes are not swallowed by the video player.
 * - Tap detection (|dy| < 10 && |dx| < 10): toggle play/pause.
 * - Swipe up   (dy < -SWIPE_THRESHOLD): advance to next video with slide-out animation.
 * - Swipe down (dy > +SWIPE_THRESHOLD): go to previous, or dismiss at index 0.
 * - Snap-back: threshold not crossed → Animated.spring to 0.
 *
 * Stale-closure strategy:
 * - windowHeight and motion are synced into refs on every render (no useEffect)
 *   because React guarantees the render is synchronous and the PanResponder may
 *   fire between renders.
 * - currentIndex, videosLength, handleDismiss, and player are synced via
 *   useEffect (their identities change across renders; the effect runs after
 *   the commit phase, before the next user interaction).
 */

import { useEffect, useRef } from 'react';
import { Animated, PanResponder } from 'react-native';
import type { VideoPlayer } from 'expo-video';
import { SPRING_REST, USE_NATIVE_DRIVER, bezierFor } from '../../../lib/motion';
import type { UseMotion } from '../../../lib/motion';

/** Minimum vertical displacement (px) to register a swipe. */
const SWIPE_THRESHOLD = 50;

export interface UseReelGesturesOptions {
  /** Animated value tracking the vertical finger offset (applied as translateY). */
  dragY: Animated.Value;
  /** Show/hide the loading overlay at the moment a swipe is committed. */
  setIsVideoLoading: (loading: boolean) => void;
  /** Update the active video index. */
  setCurrentIndex: React.Dispatch<React.SetStateAction<number>>;
  /** Total number of videos in the reel. */
  videosLength: number;
  /** Currently active index — synced into a ref for use in stable callbacks. */
  currentIndex: number;
  /** Called when the viewer should be dismissed. */
  handleDismiss: () => void;
  /** Active expo-video player (used for tap-to-play/pause). */
  player: VideoPlayer;
  /** Current window height — used for swipe-animation toValue. */
  windowHeight: number;
  /** Duration and spring tokens from useMotion(). */
  motion: Pick<UseMotion, 'duration' | 'spring'>;
}

export interface ReelGestureHandlers {
  /** Spread onto the gesture-capture View: `<View {...panHandlers} />`. */
  panHandlers: ReturnType<typeof PanResponder.create>['panHandlers'];
}

export function useReelGestures({
  dragY,
  setIsVideoLoading,
  setCurrentIndex,
  videosLength,
  currentIndex,
  handleDismiss,
  player,
  windowHeight,
  motion,
}: UseReelGesturesOptions): ReelGestureHandlers {
  // ── Sync refs (updated on every render, no useEffect) ────────────────────
  // PanResponder reads these inside its callbacks; syncing directly — not via
  // useEffect — ensures the closure never sees a stale render's value even when
  // the animation timer fires synchronously within the same JS call stack.
  const windowHeightRef = useRef(windowHeight);
  windowHeightRef.current = windowHeight;
  const motionRef = useRef({ duration: motion.duration, spring: motion.spring });
  motionRef.current = { duration: motion.duration, spring: motion.spring };

  // ── Effect-synced refs ───────────────────────────────────────────────────
  // Values whose identities change across renders but where a direct assignment
  // inside the render body would be incorrect (callbacks, non-primitive objects
  // whose equality semantics differ from render-to-render).
  const currentIndexRef = useRef(currentIndex);
  useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);

  const videosLengthRef = useRef(videosLength);
  useEffect(() => { videosLengthRef.current = videosLength; }, [videosLength]);

  const handleDismissRef = useRef(handleDismiss);
  useEffect(() => { handleDismissRef.current = handleDismiss; }, [handleDismiss]);

  // playerRef keeps a stable, always-current reference to `player` for use
  // inside the PanResponder closure (created once via useRef — would otherwise
  // see a stale closure over the initial player value).
  const playerRef = useRef(player);
  useEffect(() => { playerRef.current = player; }, [player]);

  // ── PanResponder (created once via useRef) ───────────────────────────────
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

      // Capture on directional vertical move — beats native VideoView on swipes.
      // The 10 px threshold prevents accidental capture on taps or horizontal scrolls.
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
            Animated.spring(dragY, {
              toValue: 0,
              ...motionRef.current.spring.settle,
              ...SPRING_REST,
              useNativeDriver: USE_NATIVE_DRIVER,
            }).start();
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
          Animated.spring(dragY, {
            toValue: 0,
            ...motionRef.current.spring.settle,
            ...SPRING_REST,
            useNativeDriver: USE_NATIVE_DRIVER,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        // Another responder (e.g. a system gesture) took over — snap back.
        Animated.spring(dragY, {
          toValue: 0,
          ...motionRef.current.spring.settle,
          ...SPRING_REST,
          useNativeDriver: USE_NATIVE_DRIVER,
        }).start();
      },
    }),
  );

  return { panHandlers: panRef.current.panHandlers };
}
