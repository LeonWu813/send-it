import React, { useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import type { LayoutChangeEvent, StyleProp, ViewStyle } from 'react-native';

import { useTheme } from '../../lib/theme';

/** True inside a ChoiceGrid: a Chip fills its cell, centres its label and uses tight side padding. */
export const ChoiceGridContext = React.createContext(false);

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
 * left-aligned, no outer margin. Each child fills its column width. Rows are `flex: 1` cells (never
 * pixel-rounded widths), so N columns always fit the row exactly.
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

  const onLayout = (e: LayoutChangeEvent): void => {
    const w = e.nativeEvent.layout.width;
    setWidth((prev) => (prev === w ? prev : w));
  };

  const items = React.Children.toArray(children);
  const rows: React.ReactNode[][] = [];
  for (let i = 0; i < items.length; i += columns) rows.push(items.slice(i, i + columns));

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      onLayout={onLayout}
      style={[{ rowGap: inlineGap, opacity: width === null ? 0 : 1 }, style]}
    >
      <ChoiceGridContext.Provider value>
        {rows.map((row, r) => (
          <View key={r} style={{ flexDirection: 'row', columnGap: inlineGap }}>
            {Array.from({ length: columns }, (_, c) => (
              <View key={c} style={{ flex: 1 }}>
                {row[c] ?? null}
              </View>
            ))}
          </View>
        ))}
      </ChoiceGridContext.Provider>
    </View>
  );
}
