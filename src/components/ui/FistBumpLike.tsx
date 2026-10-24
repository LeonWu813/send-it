/**
 * FistBumpLike — the animated like glyph (fist-bump v6 `motion.md` §1, §4, §7).
 *
 * Rest state is the right fist (outline / filled). A like the user just pressed (`playKey` changed while `liked` turned on)
 * plays: an outline left fist flies in (opacity follows travel), contact at 120ms (`onContact`, the caller's `toggle` haptic),
 * both fists are pushed +24u then `grip` back, tick groups A and B burst from the contact point, the right fist fills, the left
 * fist retreats. About 400ms. Any other `liked` change is a cross-fade. Reduce Motion: `short` cross-fade, no travel, no ticks,
 * `onContact` at 0ms. The unlike haptic (`select`) belongs to the caller, who knows the press was the user's.
 *
 * Layers are one `Animated.View` each around a static `Svg` (transform / opacity only, native driver). The component draws
 * outside its own box (left up to 0.75S, top/bottom 0.2S): no ancestor between it and the row may set `overflow: 'hidden'`.
 * All overlay layers are `pointerEvents="none"` and hidden from accessibility; the caller's pressable keeps its 44pt target.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, View } from 'react-native';

import { MOTION, SPRING_REST, USE_NATIVE_DRIVER, bezierFor, useMotion } from '../../lib/motion';
import { FILLED_MIN_SIZE, FistBumpIcon, FistBumpLeftFist, FistBumpTicks } from './FistBumpIcon';

const GRID = 512;
/** Contact point C in the 512 grid. */
const C = { x: 40, y: 258 };
/** Left fist box sits this far left of the right fist at contact (mirror about x = 40). */
const LEFT_CONTACT_U = -432;
/** A like this soon after the last bump start / cancel only swaps state (hapticThrottle). */
const REPLAY_GUARD_MS = MOTION.duration.hapticThrottle;
const PENDING_MS = 2000;

export interface FistBumpLikeProps {
  /** Decides the rest state: outline or filled (filled only at >= 20pt). */
  liked: boolean;
  size: number;
  color: string;
  /** The caller increments this when the USER pressed like. Other `liked` changes only cross-fade. */
  playKey?: number;
  /** Called at the contact moment (120ms); at 0ms under Reduce Motion. Not called for cross-fades or if interrupted first. */
  onContact?: () => void;
  /** false = never play the bump, only cross-fade (fallback if a host list is too slow). */
  bump?: boolean;
}

export function FistBumpLike({ liked, size, color, playKey = 0, onContact, bump = true }: FistBumpLikeProps): React.JSX.Element {
  const { duration, spring, reduceMotion } = useMotion();
  const t = MOTION.likeBump;
  const k = size / GRID;
  const canFill = size >= FILLED_MIN_SIZE;
  const timeScale = duration.micro / MOTION.duration.micro;
  const ms = (v: number): number => v * timeScale;

  const fill = useRef(new Animated.Value(liked ? 1 : 0)).current;
  const approach = useRef(new Animated.Value(-t.approachU)).current;
  const nudge = useRef(new Animated.Value(0)).current;
  const retreat = useRef(new Animated.Value(0)).current;
  const tickA = useRef(new Animated.Value(0)).current;
  const tickB = useRef(new Animated.Value(0)).current;
  const cancel = useRef(new Animated.Value(1)).current;

  const [run, setRun] = useState(0);
  const [playing, setPlaying] = useState(false);

  const prevLiked = useRef(liked);
  const prevKey = useRef(playKey);
  const pendingAt = useRef<number | null>(null);
  const lastEvent = useRef(-Infinity);
  const anim = useRef<Animated.CompositeAnimation | null>(null);
  const hapticTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onContactRef = useRef(onContact);
  onContactRef.current = onContact;

  const crossFade = useCallback(
    (to: number) => {
      Animated.timing(fill, {
        toValue: to,
        duration: reduceMotion ? duration.short : duration.micro,
        easing: bezierFor('standard'),
        useNativeDriver: USE_NATIVE_DRIVER,
      }).start();
    },
    [fill, reduceMotion, duration.short, duration.micro],
  );

  const stopPlayback = useCallback(() => {
    anim.current?.stop();
    anim.current = null;
    if (hapticTimer.current) clearTimeout(hapticTimer.current);
    hapticTimer.current = null;
  }, []);

  // Decide what a change of `liked` / `playKey` means.
  useEffect(() => {
    const keyChanged = playKey !== prevKey.current;
    const likedChanged = liked !== prevLiked.current;
    prevKey.current = playKey;
    prevLiked.current = liked;
    if (keyChanged) pendingAt.current = Date.now();
    if (!likedChanged) return;

    const now = Date.now();
    if (!liked) {
      pendingAt.current = null;
      if (playing) {
        // Unlike mid-bump: no rewind. Fade the extras, push back to 0, fill -> outline.
        stopPlayback();
        lastEvent.current = now;
        Animated.timing(cancel, { toValue: 0, duration: duration.micro, easing: bezierFor('exit'), useNativeDriver: USE_NATIVE_DRIVER }).start(() =>
          setPlaying(false),
        );
        Animated.spring(nudge, { toValue: 0, ...spring.grip, ...SPRING_REST, useNativeDriver: USE_NATIVE_DRIVER }).start();
      } else {
        lastEvent.current = now;
      }
      crossFade(0);
      return;
    }

    const userPressed = pendingAt.current !== null && now - pendingAt.current < PENDING_MS;
    pendingAt.current = null;
    if (!bump || !userPressed) {
      crossFade(1);
      return;
    }
    if (reduceMotion) {
      crossFade(1);
      onContactRef.current?.();
      return;
    }
    if (now - lastEvent.current < REPLAY_GUARD_MS) {
      crossFade(1);
      return;
    }
    lastEvent.current = now;
    stopPlayback();
    approach.setValue(-t.approachU);
    nudge.setValue(0);
    retreat.setValue(0);
    tickA.setValue(0);
    tickB.setValue(0);
    cancel.setValue(1);
    setPlaying(true);
    setRun((r) => r + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liked, playKey]);

  // Start the choreography once the overlay layers are mounted.
  useEffect(() => {
    if (!playing || run === 0) return;
    const native = USE_NATIVE_DRIVER;
    const after = (delay: number, a: Animated.CompositeAnimation): Animated.CompositeAnimation =>
      Animated.sequence([Animated.delay(ms(delay)), a]);
    const tick = (v: Animated.Value, delay: number): Animated.CompositeAnimation =>
      after(delay, Animated.timing(v, { toValue: 1, duration: ms(t.tickMs), easing: bezierFor('linear'), useNativeDriver: native }));
    const a = Animated.parallel([
      Animated.timing(approach, { toValue: 0, duration: ms(t.approachMs), easing: bezierFor('exit'), useNativeDriver: native }),
      Animated.sequence([
        Animated.delay(ms(t.approachMs)),
        Animated.timing(nudge, { toValue: t.nudgeU, duration: ms(t.nudgeMs), easing: bezierFor('standard'), useNativeDriver: native }),
        Animated.spring(nudge, { toValue: 0, ...spring.grip, ...SPRING_REST, useNativeDriver: native }),
      ]),
      after(t.approachMs, Animated.timing(fill, { toValue: 1, duration: duration.micro, easing: bezierFor('standard'), useNativeDriver: native })),
      tick(tickA, t.approachMs),
      tick(tickB, t.approachMs + MOTION.duration.stagger),
      after(t.holdUntilMs, Animated.timing(retreat, { toValue: -t.retreatU, duration: ms(t.retreatMs), easing: bezierFor('exit'), useNativeDriver: native })),
    ]);
    anim.current = a;
    hapticTimer.current = setTimeout(() => {
      hapticTimer.current = null;
      onContactRef.current?.();
    }, ms(t.approachMs));
    a.start(({ finished }) => {
      if (finished) {
        anim.current = null;
        setPlaying(false);
      }
    });
    // Run once per bump.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run]);

  // Reduce Motion switched on mid-bump, or unmount: drop everything.
  useEffect(() => {
    if (reduceMotion && playing) {
      stopPlayback();
      setPlaying(false);
      fill.setValue(prevLiked.current ? 1 : 0);
    }
  }, [reduceMotion, playing, stopPlayback, fill]);
  useEffect(() => stopPlayback, [stopPlayback]);

  const px = (v: Animated.Animated): Animated.AnimatedMultiplication<number> => Animated.multiply(v, k);
  const nudgeX = px(nudge);
  const leftX = px(Animated.add(Animated.add(approach, nudge), retreat));
  const leftOpacity = Animated.multiply(
    Animated.multiply(
      approach.interpolate({ inputRange: [-t.approachU, -t.approachU / 2, 0], outputRange: [0, 0.5, 1], extrapolate: 'clamp' }),
      retreat.interpolate({ inputRange: [-t.retreatU, -t.retreatU / 2, 0], outputRange: [0, 0, 1], extrapolate: 'clamp' }),
    ),
    cancel,
  );
  const cx = (C.x - GRID / 2) * k;
  const cy = (C.y - GRID / 2) * k;
  const tickLayer = (v: Animated.Value, group: 'a' | 'b'): React.JSX.Element => (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        position: 'absolute',
        width: size,
        height: size,
        opacity: Animated.multiply(v.interpolate({ inputRange: [0, 0.3, 0.6, 1], outputRange: [0, 1, 1, 0] }), cancel),
        transform: [
          { translateX: cx },
          { translateY: cy },
          { scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1 + t.tickDriftU / 288] }) },
          { translateX: -cx },
          { translateY: -cy },
        ],
      }}
    >
      <FistBumpTicks size={size} color={color} group={group} />
    </Animated.View>
  );

  const fixed = { position: 'absolute', width: size, height: size } as const;
  return (
    <View style={{ width: size, height: size }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View
        pointerEvents="none"
        style={[fixed, { opacity: canFill ? fill.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) : 1, transform: [{ translateX: nudgeX }] }]}
      >
        <FistBumpIcon variant="outline" size={size} color={color} />
      </Animated.View>
      {canFill ? (
        <Animated.View pointerEvents="none" style={[fixed, { opacity: fill, transform: [{ translateX: nudgeX }] }]}>
          <FistBumpIcon variant="filled" size={size} color={color} />
        </Animated.View>
      ) : null}
      {playing ? (
        <>
          <Animated.View
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[fixed, { opacity: leftOpacity, transform: [{ translateX: Animated.add(LEFT_CONTACT_U * k, leftX) }] }]}
          >
            <FistBumpLeftFist size={size} color={color} />
          </Animated.View>
          {tickLayer(tickA, 'a')}
          {tickLayer(tickB, 'b')}
        </>
      ) : null}
    </View>
  );
}
