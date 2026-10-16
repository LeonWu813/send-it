/**
 * Motion tokens and useMotion() (design system §10). Identical in both themes.
 *
 * Rules:
 *  - M1: A component leaving the screen is shorter than its entrance. A pressed background
 *    returning to rest (`release`) is not "leaving the screen" and is exempt.
 *  - Anything that blocks interaction is <= `medium` (300ms).
 *  - `topOut` spring is only for "earned" moments (top, flash, new highest, badge 0->n, like);
 *    never for high-frequency interactions.
 *  - M12: Springs drive transforms only; opacity and colour always use timing; position-derived
 *    opacity is clamped.
 *  - Particles animate transform + opacity only, with the native driver.
 *  - Reduce Motion does NOT change token values: components switch to a `short` cross-fade
 *    (no translate/scale/particles/shake). Information and haptics are unchanged.
 *  - Always read durations through useMotion() so Storybook slow-motion and Reduce Motion
 *    overrides apply.
 */

import React, { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from 'react';
import { AccessibilityInfo, Easing, Platform } from 'react-native';

import { getHapticDriver, getHapticsEnabled } from './haptics';
import type { HapticKey } from './haptics';

export const MOTION = {
  duration: {
    instant: 0,
    micro: 100,
    /** Press-in: pressed layer 0 -> 1, scale to pressControl / pressWide. */
    press: 100,
    /** Press-out: pressed layer 1 -> 0 (20ms longer than press so a fast tap is still seen). */
    release: 120,
    short: 200,
    medium: 300,
    long: 450,
    celebrate: 700,
    stagger: 30,
    toast: 5000,
    toastShort: 2000,
    celebrationCard: 5000,
    highlightHold: 600,
    skeletonDelay: 300,
    skeletonPulse: 1200,
    skeletonTimeout: 10000,
    longPress: 500,
    hapticThrottle: 300,
    pressDelayInScroll: 50,
  },
  easing: {
    standard: [0.2, 0, 0, 1],
    enter: [0, 0, 0.2, 1],
    exit: [0.3, 0, 1, 1],
    linear: [0, 0, 1, 1],
  },
  spring: {
    grip: { stiffness: 400, damping: 20, mass: 0.6 },
    topOut: { stiffness: 260, damping: 10, mass: 0.8 },
    settle: { stiffness: 280, damping: 28, mass: 1 },
    /** Selection indicator moving between items (SegmentedControl thumb, TabBar pill). */
    glide: { stiffness: 380, damping: 34, mass: 1 },
  },
  scale: { pressControl: 0.96, pressWide: 0.98, pop: 1.2, celebratePeak: 1.3 },
  /** Failure shake: translateX 0 -> +d -> -d -> +d -> 0 in `segments` linear steps over duration.short. */
  shake: { distancePt: 4, segments: 4 },
  /** Translate distances. Not affected by timeScale; unused under Reduce Motion. */
  distance: { sheetFloatEnter: 24, toastEnter: 8, stepperDigit: 6, bookmarkDrop: 2 },
  particles: {
    flash: {
      count: 10,
      colors: [
        { key: 'sendFlashBright', n: 6 },
        { key: 'sendFlash', n: 4 },
      ],
      sizePt: [4, 8],
      distancePt: [24, 48],
    },
    newHighest: {
      count: 8,
      colors: [
        { key: 'sendTop', n: 4 },
        { key: 'decorChalk', n: 4 },
      ],
      sizePt: [4, 8],
      distancePt: [24, 48],
      flashSwap: { from: 'decorChalk', to: 'sendFlashBright' },
    },
    firstSendDust: { puffs: 2, colors: [{ key: 'decorChalk', n: 2 }], sizePt: [4, 8], distancePt: [24, 48] },
    like: { count: 6, colors: [{ key: 'onMedia', n: 6 }], sizePt: [4, 8], distancePt: [24, 48] },
  },
} as const;

/** Every Animated.spring must set these (avoids a ~900ms callback delay on long tails). */
export const SPRING_REST = { restDisplacementThreshold: 0.5, restSpeedThreshold: 0.5 } as const;

export type MotionTokens = typeof MOTION;
export type EasingName = keyof typeof MOTION.easing;
export type SpringName = keyof typeof MOTION.spring;
export type ParticleKind = keyof typeof MOTION.particles;

/** `Animated` native driver is unavailable on web (Storybook) — fall back to JS there. */
export const USE_NATIVE_DRIVER = Platform.OS !== 'web';

/** Easing.bezier for a named token. */
export function bezierFor(name: EasingName): (t: number) => number {
  const [x1, y1, x2, y2] = MOTION.easing[name];
  return Easing.bezier(x1, y1, x2, y2);
}

// ─── Reduce Motion store (shared by every useMotion() consumer) ──────────────

let systemReduceMotion = false;
let reduceMotionInit = false;
const listeners = new Set<() => void>();
/** Haptic throttle timestamps per source, shared across all components. */
const lastHaptic: Record<string, number> = {};

function emit(): void {
  listeners.forEach((l) => l());
}

function initReduceMotion(): void {
  if (reduceMotionInit) return;
  reduceMotionInit = true;
  try {
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        if (v !== systemReduceMotion) {
          systemReduceMotion = v;
          emit();
        }
      })
      .catch(() => {});
    AccessibilityInfo.addEventListener('reduceMotionChanged', (v: boolean) => {
      systemReduceMotion = v;
      emit();
    });
  } catch {
    // AccessibilityInfo unavailable — keep default (false)
  }
}

function subscribe(listener: () => void): () => void {
  initReduceMotion();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): boolean {
  return systemReduceMotion;
}

// ─── Optional override context (Storybook toolbar; tests) ───────────────────

export interface MotionOverride {
  /** Force reduced mode on/off. undefined = follow the system setting. */
  reduceMotion?: boolean;
  /** Multiply every duration (Storybook slow-motion). Default 1. */
  timeScale?: number;
}

const MotionOverrideContext = createContext<MotionOverride>({});

export function MotionProvider({
  reduceMotion,
  timeScale,
  children,
}: MotionOverride & { children: React.ReactNode }): React.JSX.Element {
  const value = useMemo(() => ({ reduceMotion, timeScale }), [reduceMotion, timeScale]);
  return React.createElement(MotionOverrideContext.Provider, { value }, children);
}

// ─── useMotion ───────────────────────────────────────────────────────────────

export interface UseMotion {
  duration: Record<keyof MotionTokens['duration'], number>;
  easing: MotionTokens['easing'];
  spring: MotionTokens['spring'];
  scale: MotionTokens['scale'];
  shake: MotionTokens['shake'];
  distance: MotionTokens['distance'];
  particles: MotionTokens['particles'];
  reduceMotion: boolean;
  /**
   * Fire a haptic. Honors the app `hapticsEnabled` setting, throttles per `sourceId`
   * (default: the key) at `duration.hapticThrottle`, then calls the current HapticDriver.
   * Call it in the same frame as the visual feedback — never earlier.
   */
  haptic: (key: HapticKey, sourceId?: string) => void;
}

export function useMotion(): UseMotion {
  const system = useSyncExternalStore(subscribe, getSnapshot, () => false);
  const override = useContext(MotionOverrideContext);
  const reduceMotion = override.reduceMotion ?? system;
  const timeScale = override.timeScale ?? 1;

  const duration = useMemo(() => {
    if (timeScale === 1) return MOTION.duration;
    // Only the visual durations scale; throttles, delays and timeouts do not.
    const out: Record<keyof MotionTokens['duration'], number> = { ...MOTION.duration };
    (['micro', 'press', 'release', 'short', 'medium', 'long', 'celebrate'] as const).forEach((k) => {
      out[k] = MOTION.duration[k] * timeScale;
    });
    return out;
  }, [timeScale]);

  const haptic = useCallback((key: HapticKey, sourceId?: string): void => {
    if (!getHapticsEnabled()) return;
    const source = sourceId ?? key;
    const now = Date.now();
    const prev = lastHaptic[source];
    if (prev !== undefined && now - prev < MOTION.duration.hapticThrottle) return;
    lastHaptic[source] = now;
    getHapticDriver().play(key);
  }, []);

  return useMemo(
    () => ({
      duration,
      easing: MOTION.easing,
      spring: MOTION.spring,
      scale: MOTION.scale,
      shake: MOTION.shake,
      distance: MOTION.distance,
      particles: MOTION.particles,
      reduceMotion,
      haptic,
    }),
    [duration, reduceMotion, haptic],
  );
}
