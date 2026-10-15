/**
 * SwipeBackWrapper — App-level shared swipe-back gesture wrapper (AC-185).
 *
 * Owned by MOD-012. Wrap any screen that shows a back icon to enable the
 * swipe left-to-right back gesture.
 *
 * Import path (all consumers): `src/components/SwipeBackWrapper`
 * Per the App-Level Shared Presentational Components convention in production.md.
 *
 * Implementation:
 *   Uses React Native core PanResponder — NOT react-native-gesture-handler.
 *   Per the "Prefer RN PanResponder for Simple Swipe Gestures" convention in
 *   production.md (Rev 35). Do not introduce react-native-gesture-handler.
 *
 * Gesture gate conditions (all must be satisfied to claim the gesture):
 *   1. Touch starts within the left 20% of the screen width.
 *   2. Horizontal movement exceeds 50 px (dx > 50).
 *   3. Rightward velocity exceeds 0.3 (vx > 0.3).
 *   4. Primarily horizontal: dx > dy * 2 (avoids stealing vertical scrolls).
 *
 * Props:
 *   onBack   — called when the swipe gesture is recognised.
 *   children — the screen content.
 *   enabled  — whether the gesture is active (default true).
 */

import React, { useEffect, useRef } from 'react';
import {
  Dimensions,
  PanResponder,
  type PanResponderGestureState,
  StyleSheet,
  View,
} from 'react-native';

// ── Constants ─────────────────────────────────────────────────────────────────

/** Proportion of screen width within which the gesture must start. */
const EDGE_THRESHOLD = 0.20;

/** Minimum horizontal displacement (px) to trigger the back action. */
const MIN_DX = 50;

/** Minimum horizontal velocity to trigger the back action. */
const MIN_VX = 0.3;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SwipeBackWrapperProps {
  onBack: () => void;
  children: React.ReactNode;
  enabled?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SwipeBackWrapper({
  onBack,
  children,
  enabled = true,
}: SwipeBackWrapperProps): React.JSX.Element {
  // Ref keeps the latest `enabled` value inside the PanResponder closure.
  // PanResponder.create() runs once (inside useRef), so the closure would
  // otherwise capture the initial prop value and never see later changes.
  const enabledRef = useRef<boolean>(enabled);
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  // Track where the touch started so we can enforce the left-edge gate.
  const touchStartXRef = useRef<number>(0);

  const panResponder = useRef(
    PanResponder.create({
      // Claim move events when the gesture satisfies the edge + direction gate.
      onMoveShouldSetPanResponder: (
        _evt,
        gestureState: PanResponderGestureState,
      ): boolean => {
        if (!enabledRef.current) return false;

        const { dx, dy, vx } = gestureState;
        const screenWidth = Dimensions.get('window').width;

        // Gate 1: touch origin must be in the left 20% of the screen.
        if (touchStartXRef.current > screenWidth * EDGE_THRESHOLD) return false;

        // Gate 2: horizontal displacement must exceed the minimum.
        if (dx <= MIN_DX) return false;

        // Gate 3: horizontal velocity must exceed the minimum.
        if (vx <= MIN_VX) return false;

        // Gate 4: gesture must be primarily horizontal (avoid stealing scrolls).
        if (Math.abs(dx) <= Math.abs(dy) * 2) return false;

        return true;
      },

      // Record the starting X so we can enforce the edge gate.
      onStartShouldSetPanResponder: (): boolean => false,

      // When we claim the gesture and it's released, fire onBack.
      onPanResponderRelease: (
        _evt,
        gestureState: PanResponderGestureState,
      ): void => {
        const { dx, vx } = gestureState;
        if (dx > MIN_DX && vx > MIN_VX) {
          onBack();
        }
      },
    }),
  ).current;

  return (
    <View
      style={styles.container}
      onTouchStart={(e) => {
        // Capture the initial touch X so onMoveShouldSetPanResponder can gate on it.
        touchStartXRef.current = e.nativeEvent.pageX;
      }}
      {...panResponder.panHandlers}
    >
      {children}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
