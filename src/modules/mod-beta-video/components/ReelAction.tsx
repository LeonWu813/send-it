/**
 * ReelAction — a like / report control on the Reel viewer (design system v1.2, §32.9).
 *
 * 44pt target on a `mediaScrim` disc (`mediaScrimStrong` while pressed), `xl` glyph, always
 * `onMedia`: on / off is filled vs outline, never a colour (the like is not red). The like is the v6
 * `FistBumpLike` (fist-bump `motion.md`): it plays only when the USER presses like (`bumpKey`), fires the
 * `toggle` haptic at contact, and unlike plays `select`. Reduce Motion is a cross-fade only.
 * The like draws outside its box (left up to 0.75S, top/bottom 0.2S): no `overflow: 'hidden'` up to the root.
 * Kept in its own file (no expo-video import) so Storybook can render it.
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, View } from 'react-native';
import { AppText } from '../../../components/ui/AppText';
import { FistBumpLike } from '../../../components/ui/FistBumpLike';
import { PressableScale } from '../../../components/ui/PressableScale';
import { Spinner } from '../../../components/ui/ProgressBar';
import type { IoniconName } from '../../../lib/icons';
import { USE_NATIVE_DRIVER, bezierFor, useMotion } from '../../../lib/motion';
import { useTheme } from '../../../lib/theme';

/** Touch target of a Reel action (like / report): 44pt, the glyph is `xl` inside it. */
export const ACTION_SIZE = 44;

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
  /** Plays the fist-bump like (and the unlike haptic) when the user presses. */
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
  const { duration, reduceMotion, haptic } = useMotion();
  const c = theme.colors;
  const [pressed, setPressed] = useState(false);
  const [bumpKey, setBumpKey] = useState(0);
  const fade = useRef(new Animated.Value(selected ? 1 : 0)).current;

  // Outline <-> filled cross-fade for the Ionicons actions (the fist cross-fades inside FistBumpLike).
  useEffect(() => {
    Animated.timing(fade, {
      toValue: selected ? 1 : 0,
      duration: reduceMotion ? duration.short : duration.micro,
      easing: bezierFor('standard'),
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, [selected, fade, reduceMotion, duration.micro, duration.short]);

  const glyph = theme.iconSize.xl;
  return (
    <View style={{ alignItems: 'center' }}>
      <PressableScale
        testID={testID}
        onPress={() => {
          if (likeMotion) {
            if (selected) haptic('select', 'reel-like');
            else setBumpKey((k) => k + 1);
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
          <Spinner context="mediaControl" />
        ) : fist ? (
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <FistBumpLike
              liked={selected}
              size={glyph}
              color={c.onMedia}
              playKey={bumpKey}
              onContact={() => haptic('toggle', 'reel-like')}
            />
          </View>
        ) : (
          <Animated.View
            style={{ width: glyph, height: glyph }}
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
