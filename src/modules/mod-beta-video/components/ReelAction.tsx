/**
 * ReelAction — a like / report control on the Reel viewer (design system v1.2, §32.9).
 *
 * 44pt target on a `mediaScrim` disc (`mediaScrimStrong` while pressed), `xl` glyph, always
 * `onMedia`: on / off is filled vs outline, never a colour (the like is not red). The like plays
 * celebratePeak + topOut + particles.like with a `toggle` haptic, plus the 3 FistBumpBurst ticks (200ms:
 * drift 24u outward, opacity 0>1 over 0-60ms, hold to 120ms, out by 200ms) started at the peak, in sync
 * with the swap to filled; Reduce Motion is a cross-fade only (no ticks).
 * `fist` renders the approved custom fist (§9.12) instead of Ionicons.
 * Kept in its own file (no expo-video import) so Storybook can render it.
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, View } from 'react-native';
import { AppText } from '../../../components/ui/AppText';
import { FistBumpBurst, FistBumpIcon } from '../../../components/ui/FistBumpIcon';
import { ParticleBurst } from '../../../components/ui/Particles';
import { PressableScale } from '../../../components/ui/PressableScale';
import { Spinner } from '../../../components/ui/ProgressBar';
import type { IoniconName } from '../../../lib/icons';
import { SPRING_REST, USE_NATIVE_DRIVER, bezierFor, useMotion } from '../../../lib/motion';
import { useTheme } from '../../../lib/theme';

/** Touch target of a Reel action (like / report): 44pt, the glyph is `xl` inside it. */
export const ACTION_SIZE = 44;

/** Burst ticks: 200ms one-shot; opacity 0>1 by 60ms, hold to 120ms, out by 200ms. */
const TICK_MS = 200;
/** Ticks sit 156-204 icon-grid units from the knuckle face (120, 278): a 24u outward drift is a scale about that point. */
const TICK_SCALE = 1 + 24 / 180;
const GRID = 512;
const KNUCKLE = { x: 120, y: 278 };

export interface ReelActionProps {
  testID: string;
  accessibilityLabel: string;
  onPress: () => void;
  /** Outline when off, filled when on (never a colour change). Ignored when `fist` is set. */
  nameOff?: IoniconName;
  /** Ignored when `fist` is set. */
  nameOn?: IoniconName;
  /** Renders the custom fist (outline / filled) instead of Ionicons; `nameOff` / `nameOn` are ignored. */
  fist?: boolean;
  selected: boolean;
  disabled?: boolean;
  /** Replaces the glyph (report in flight). */
  busy?: boolean;
  /** Plays the like motion (celebratePeak + topOut + particles) when it turns on by a press. */
  likeMotion?: boolean;
  /** Small text under the glyph (like count / report label). */
  caption?: string;
  captionTestID?: string;
}

export function ReelAction({
  testID,
  accessibilityLabel,
  onPress,
  nameOff,
  nameOn,
  fist,
  selected,
  disabled,
  busy,
  likeMotion,
  caption,
  captionTestID,
}: ReelActionProps): React.JSX.Element {
  const { theme } = useTheme();
  const { duration, scale, spring, reduceMotion, haptic } = useMotion();
  const c = theme.colors;
  const [pressed, setPressed] = useState(false);
  const [burstKey, setBurstKey] = useState(0);
  const fade = useRef(new Animated.Value(selected ? 1 : 0)).current;
  const pop = useRef(new Animated.Value(1)).current;
  const tick = useRef(new Animated.Value(0)).current;
  const pressedOn = useRef(false);

  // Outline <-> filled cross-fade (also the whole Reduce Motion treatment).
  useEffect(() => {
    Animated.timing(fade, {
      toValue: selected ? 1 : 0,
      duration: reduceMotion ? duration.short : duration.micro,
      easing: bezierFor('standard'),
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, [selected, fade, reduceMotion, duration.micro, duration.short]);

  // Like motion: only when the user's own press turned it on.
  useEffect(() => {
    if (!likeMotion || !selected || !pressedOn.current) return;
    pressedOn.current = false;
    if (reduceMotion) return;
    setBurstKey((k) => k + 1);
    pop.setValue(scale.celebratePeak);
    Animated.spring(pop, { toValue: 1, ...spring.topOut, ...SPRING_REST, useNativeDriver: USE_NATIVE_DRIVER }).start();
    // Fist bump ticks: one 200ms keyframe run, started with the peak (opacity and drift share `tick`).
    tick.setValue(0);
    Animated.timing(tick, { toValue: 1, duration: TICK_MS, easing: bezierFor('linear'), useNativeDriver: USE_NATIVE_DRIVER }).start();
  }, [selected, likeMotion, reduceMotion, pop, tick, scale.celebratePeak, spring.topOut]);

  const glyph = theme.iconSize.xl;
  return (
    <View style={{ alignItems: 'center' }}>
      <PressableScale
        testID={testID}
        onPress={() => {
          if (likeMotion && !selected) {
            pressedOn.current = true;
            haptic('toggle', 'reel-like');
          }
          onPress();
        }}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        disabled={disabled}
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled: !!disabled, selected }}
        style={{
          width: ACTION_SIZE,
          height: ACTION_SIZE,
          borderRadius: theme.borderRadius.full,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: pressed ? c.mediaScrimStrong : c.mediaScrim,
        }}
      >
        {busy ? (
          <Spinner color="onMedia" size="small" />
        ) : fist ? (
          <Animated.View
            style={{ width: glyph, height: glyph, transform: [{ scale: pop }] }}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Animated.View style={{ position: 'absolute', opacity: fade.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }}>
              <FistBumpIcon variant="outline" size={glyph} color={c.onMedia} />
            </Animated.View>
            <Animated.View style={{ position: 'absolute', opacity: fade }}>
              <FistBumpIcon variant="filled" size={glyph} color={c.onMedia} />
            </Animated.View>
            {likeMotion && burstKey > 0 && !reduceMotion ? (
              <Animated.View
                key={burstKey}
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  width: glyph,
                  height: glyph,
                  opacity: tick.interpolate({ inputRange: [0, 0.3, 0.6, 1], outputRange: [0, 1, 1, 0] }),
                  transform: [
                    { translateX: ((KNUCKLE.x - GRID / 2) / GRID) * glyph },
                    { translateY: ((KNUCKLE.y - GRID / 2) / GRID) * glyph },
                    { scale: tick.interpolate({ inputRange: [0, 1], outputRange: [1, TICK_SCALE] }) },
                    { translateX: -((KNUCKLE.x - GRID / 2) / GRID) * glyph },
                    { translateY: -((KNUCKLE.y - GRID / 2) / GRID) * glyph },
                  ],
                }}
              >
                <FistBumpBurst size={glyph} color={c.onMedia} />
              </Animated.View>
            ) : null}
          </Animated.View>
        ) : (
          <Animated.View
            style={{ width: glyph, height: glyph, transform: [{ scale: pop }] }}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Animated.View style={{ position: 'absolute', opacity: fade.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }}>
              <Ionicons name={nameOff!} size={glyph} color={c.onMedia} />
            </Animated.View>
            <Animated.View style={{ position: 'absolute', opacity: fade }}>
              <Ionicons name={nameOn!} size={glyph} color={c.onMedia} />
            </Animated.View>
          </Animated.View>
        )}
        {likeMotion && burstKey > 0 ? <ParticleBurst kind="like" playKey={burstKey} /> : null}
      </PressableScale>
      {caption !== undefined ? (
        <View style={{ marginTop: theme.spacing.xs }}>
          <AppText variant="footnote" weight="600" numeric color="onMedia" testID={captionTestID}>
            {caption}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}
