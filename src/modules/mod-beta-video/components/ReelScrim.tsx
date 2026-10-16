/**
 * ReelScrim: the bottom 220pt scrim of the Reel (design system v2.2, 32.9): `mediaScrimStrong`
 * fading to transparent. There is no gradient dependency, so it is stacked bands whose opacity
 * steps up toward the bottom. Decorative only: never takes a touch.
 * Kept in its own file (no expo-video import) so Storybook can render it.
 */

import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../../../lib/theme';

export const REEL_SCRIM_HEIGHT = 220;
const BANDS = 22;

export function ReelScrim(): React.JSX.Element {
  const { theme } = useTheme();
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="reel-scrim"
      style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: REEL_SCRIM_HEIGHT }}
    >
      {Array.from({ length: BANDS }).map((_, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            backgroundColor: theme.colors.mediaScrimStrong,
            opacity: (i + 1) / BANDS,
          }}
        />
      ))}
    </View>
  );
}
