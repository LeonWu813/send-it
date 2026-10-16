import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import { useTheme } from '../../lib/theme';
import type { PaletteKey } from '../../lib/theme';
import { PressableScale } from './PressableScale';

export interface IconButtonProps {
  name: React.ComponentProps<typeof Ionicons>['name'];
  /** Required: icon-only buttons must have a localized accessibility label. */
  accessibilityLabel: string;
  onPress: () => void;
  color?: PaletteKey;
  size?: number;
  selected?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** 44x44 container; pressed state shows a surfacePressed disc and scales 0.96. */
export function IconButton({
  name,
  accessibilityLabel,
  onPress,
  color = 'textPrimary',
  size,
  selected,
  disabled,
  style,
}: IconButtonProps): React.JSX.Element {
  const { theme } = useTheme();
  const box = theme.layout.minTouchTarget;
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      pressedColor={theme.colors.surfacePressed}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled, selected }}
      style={[
        { width: box, height: box, borderRadius: theme.borderRadius.full, alignItems: 'center', justifyContent: 'center' },
        style,
      ]}
    >
      <Ionicons name={name} size={size ?? theme.iconSize.lg} color={disabled ? theme.colors.textDisabled : theme.colors[color]} />
    </PressableScale>
  );
}
