import React, { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { USE_NATIVE_DRIVER, useMotion } from '../../lib/motion';
import { useTheme } from '../../lib/theme';
import { AppText } from './AppText';
import { PressableScale } from './PressableScale';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  /** Colour swatch (11x11, radius 3) for colour filters. */
  swatch?: string;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Visual height 32 with vertical hitSlop so the touch height is >= 44. Selected: secondaryContainer
 * fill (cross-faded in `micro`) + 1.5pt primary outline + 600 weight, switched instantly. The label
 * reserves its bold width so selection never shifts layout.
 */
export function Chip({ label, selected = false, onPress, swatch, accessibilityLabel, style }: ChipProps): React.JSX.Element {
  const { theme } = useTheme();
  const { duration } = useMotion();
  const c = theme.colors;
  const fill = useRef(new Animated.Value(selected ? 1 : 0)).current;

  useEffect(() => {
    // backgroundColor interpolation cannot use the native driver
    Animated.timing(fill, { toValue: selected ? 1 : 0, duration: duration.micro, useNativeDriver: false }).start();
  }, [selected, fill, duration.micro]);

  const { chipHeight, chipSelectedBorder, chipBorder } = theme.componentSize;
  const border = selected ? chipSelectedBorder : chipBorder;
  const slop = Math.max(0, (theme.layout.minTouchTarget - chipHeight) / 2);
  const textColor = selected ? 'onSecondaryContainer' : 'textSecondary';

  return (
    <PressableScale
      onPress={onPress}
      hitSlop={{ top: slop, bottom: slop, left: 0, right: 0 }}
      pressedColor={selected ? c.secondaryContainerPressed : c.surfacePressed}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected }}
      style={[{ borderRadius: theme.borderRadius.full, overflow: 'hidden' }, style]}
    >
      <Animated.View
        style={{
          minHeight: chipHeight,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: theme.borderRadius.full,
          borderWidth: border,
          borderColor: selected ? c.primary : c.outline,
          // keep outer size constant between 1pt and 1.5pt borders
          paddingHorizontal: theme.spacing.smd + (chipSelectedBorder - border),
          backgroundColor: fill.interpolate({ inputRange: [0, 1], outputRange: [c.surface, c.secondaryContainer] }),
        }}
      >
        {swatch ? (
          <View style={{ width: 11, height: 11, borderRadius: 3, backgroundColor: swatch, marginRight: theme.layout.iconTextGap }} />
        ) : null}
        <View>
          {/* invisible bold copy reserves the widest width */}
          <AppText variant="footnote" weight="600" style={{ opacity: 0 }} accessibilityElementsHidden importantForAccessibility="no">
            {label}
          </AppText>
          <AppText
            variant="footnote"
            weight={selected ? '600' : '400'}
            color={textColor}
            style={{ position: 'absolute', left: 0, right: 0, textAlign: 'center' }}
          >
            {label}
          </AppText>
        </View>
      </Animated.View>
    </PressableScale>
  );
}
