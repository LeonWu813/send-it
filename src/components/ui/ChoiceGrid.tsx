import React, { useState } from 'react';
import { PixelRatio, View, useWindowDimensions } from 'react-native';
import type { LayoutChangeEvent, StyleProp, ViewStyle } from 'react-native';

import { useTheme } from '../../lib/theme';

export interface ChoiceGridProps {
  /** Localized field label; announced as the radiogroup name. */
  accessibilityLabel: string;
  children: React.ReactNode;
  /** Test / Storybook override of the system font scale. */
  fontScale?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Layout-only equal-width grid for choice controls (difficulty Chips, colour tiles). 6 columns
 * (`LAYOUT.choiceGridColumns`), 4 (`choiceGridColumnsCompact`) at font scale >= `axFontScale` or when a
 * column would be under `choiceGridMinColumnWidth`. Gap = `inlineGap` both ways, a short last row is
 * left-aligned, no outer margin. Each child fills its column width.
 */
export function ChoiceGrid({ accessibilityLabel, children, fontScale, style }: ChoiceGridProps): React.JSX.Element {
  const { theme } = useTheme();
  const window = useWindowDimensions();
  const scale = fontScale ?? window.fontScale;
  const [width, setWidth] = useState<number | null>(null);
  const { choiceGridColumns, choiceGridColumnsCompact, choiceGridMinColumnWidth, axFontScale, inlineGap } = theme.layout;

  const colWidth = (cols: number, w: number): number => (w - (cols - 1) * inlineGap) / cols;
  let columns: number = choiceGridColumns;
  if (scale >= axFontScale || (width !== null && colWidth(columns, width) < choiceGridMinColumnWidth)) {
    columns = choiceGridColumnsCompact;
  }
  const cellWidth = width === null ? 0 : PixelRatio.roundToNearestPixel(colWidth(columns, width));

  const onLayout = (e: LayoutChangeEvent): void => {
    const w = e.nativeEvent.layout.width;
    setWidth((prev) => (prev === w ? prev : w));
  };

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      onLayout={onLayout}
      style={[{ flexDirection: 'row', flexWrap: 'wrap', columnGap: inlineGap, rowGap: inlineGap, opacity: width === null ? 0 : 1 }, style]}
    >
      {React.Children.toArray(children).map((child, i) => (
        <View key={i} style={{ width: cellWidth }}>
          {child}
        </View>
      ))}
    </View>
  );
}
