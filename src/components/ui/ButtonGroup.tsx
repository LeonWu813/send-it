import React, { useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';

import type { IoniconName } from '../../lib/icons';
import { useTheme } from '../../lib/theme';
import { AppText } from './AppText';
import { Button, buttonDims } from './Button';
import type { ButtonSize, ButtonVariant, OnSurface } from './Button';

/**
 * ButtonGroup: the app-wide rule for two related text buttons (page-review B-1, R12).
 *
 * API
 *   <ButtonGroup buttons={[primary, secondary]} />
 *   buttons   1 or 2 items, in STACKED order: primary first (it ends up on top). Max 2 text
 *             buttons per row; a third action belongs in a ghost button or a "..." menu.
 *             Item: { label, onPress, variant?, icon?, loading?, disabled?, accessibilityLabel?,
 *             accessibilityHint? }. Default variants: first 'primary', second 'secondary'.
 *   size      one size for the whole group (same size is part of the rule). Default 'lg' when the
 *             first item is primary, otherwise 'md'.
 *   on        surface under the group (forwarded to every Button).
 *   fontScale override for the system font scale (stories / tests only; default is the device's).
 *   style     container style. The parent owns the margins (R0); the group sets none.
 *
 * Rule
 *   1. Side by side (equal width, gap inlineGap 8) only when BOTH labels fit on ONE line:
 *      max(2 x padH + icon + iconGap + labelWidth) <= (containerWidth - inlineGap) / 2.
 *      Labels are measured with hidden one-line text (onLayout), so it works on device and web
 *      and re-measures on locale / label / font-scale change.
 *   2. Otherwise stacked: full width, same size, first item on top, gap inlineGap 8. A stacked
 *      label may wrap but is never truncated.
 *   3. Always stacked when fontScale >= 1.35.
 *   The group is invisible for the first frame until it has measured (no layout flash).
 */
export interface ButtonGroupItem {
  label: string;
  onPress: () => void;
  variant?: Exclude<ButtonVariant, 'text'>;
  icon?: IoniconName;
  loading?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

export interface ButtonGroupProps {
  buttons: [ButtonGroupItem] | [ButtonGroupItem, ButtonGroupItem];
  size?: ButtonSize;
  on?: OnSurface;
  fontScale?: number;
  style?: React.ComponentProps<typeof View>['style'];
}

/** At or above this font scale (HIG AX sizes) the group always stacks. */
export const BUTTON_GROUP_STACK_FONT_SCALE = 1.35;

export function ButtonGroup({ buttons, size, on, fontScale, style }: ButtonGroupProps): React.JSX.Element {
  const { theme } = useTheme();
  const window = useWindowDimensions();
  const scale = fontScale ?? window.fontScale;
  const [width, setWidth] = useState<number | null>(null);
  const [labelWidths, setLabelWidths] = useState<Record<number, number>>({});

  const first = buttons[0];
  const resolvedSize: ButtonSize = size ?? ((first.variant ?? 'primary') === 'primary' ? 'lg' : 'md');
  const dims = buttonDims(theme, resolvedSize);
  const gap = theme.layout.inlineGap;

  const measured = buttons.every((_, i) => labelWidths[i] !== undefined);
  let stacked = buttons.length < 2 || scale >= BUTTON_GROUP_STACK_FONT_SCALE;
  if (!stacked && width !== null && measured) {
    const slot = (width - gap) / 2;
    stacked = buttons.some((b, i) => {
      const iconExtra = b.icon ? dims.icon + theme.layout.iconTextGapInButton : 0;
      return 2 * dims.padH + iconExtra + (labelWidths[i] ?? 0) > slot;
    });
  }
  const ready = stacked || (width !== null && measured);

  const onLabelLayout = (i: number) => (e: LayoutChangeEvent): void => {
    const w = Math.ceil(e.nativeEvent.layout.width);
    setLabelWidths((prev) => (prev[i] === w ? prev : { ...prev, [i]: w }));
  };

  return (
    <View
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        setWidth((prev) => (prev === w ? prev : w));
      }}
      style={[{ alignSelf: 'stretch', opacity: ready ? 1 : 0 }, style]}
    >
      {/* Hidden one-line measurers: natural label width at the current font scale. */}
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ position: 'absolute', top: 0, left: 0, opacity: 0 }}
      >
        {buttons.map((b, i) => (
          <View key={`m${i}`} onLayout={onLabelLayout(i)} style={{ alignSelf: 'flex-start' }}>
            <AppText variant={dims.text} weight="600" numberOfLines={1}>
              {b.label}
            </AppText>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: stacked ? 'column' : 'row', gap }}>
        {buttons.map((b, i) => (
          <Button
            key={i}
            label={b.label}
            onPress={b.onPress}
            variant={b.variant ?? (i === 0 ? 'primary' : 'secondary')}
            size={resolvedSize}
            on={on}
            icon={b.icon}
            loading={b.loading}
            disabled={b.disabled}
            accessibilityLabel={b.accessibilityLabel}
            accessibilityHint={b.accessibilityHint}
            fullWidth
            labelLines={stacked ? 0 : 1}
            style={stacked ? undefined : { flex: 1 }}
          />
        ))}
      </View>
    </View>
  );
}
