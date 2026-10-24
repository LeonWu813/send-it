import React from 'react';
import { Platform, View } from 'react-native';
import type { TextStyle } from 'react-native';

import { useTheme } from '../../lib/theme';

/**
 * Inner focus ring (`STROKE.focusRing`) for text inputs and the stepper. Absolutely positioned inside the
 * container's padding box and `pointerEvents="none"`: it takes no layout space, so focusing never shifts anything.
 * Render it as the container's last child. `radius` = the container radius minus its border width.
 */
export function FocusRing({ color, radius }: { color: string; radius: number }): React.JSX.Element {
  const { theme } = useTheme();
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        borderWidth: theme.stroke.focusRing,
        borderColor: color,
        borderRadius: radius,
        borderCurve: 'continuous',
      }}
    />
  );
}

/** RN-web only: drop the browser's default focus outline. Spread it ONLY on inputs that also draw a FocusRing. */
export const NO_WEB_OUTLINE: TextStyle | null = Platform.OS === 'web' ? ({ outlineStyle: 'none', outlineWidth: 0 } as unknown as TextStyle) : null;
