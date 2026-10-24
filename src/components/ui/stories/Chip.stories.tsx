import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';

import { ForcedTheme } from '../../../../.storybook/ForcedTheme';
import { ICON } from '../../../lib/icons';
import { TAPE_DISPLAY } from '../../../lib/tape';
import { useTheme } from '../../../lib/theme';
import { ChoiceGrid } from '../ChoiceGrid';
import { Chip } from '../Chip';
import { Row } from './_helpers';
import type { ChipProps } from '../Chip';

const glyphs = { none: undefined, flash: ICON.sendFlash.outline, filter: ICON.filter.outline, date: ICON.date.outline };

function Demo({ selected: initial, ...rest }: ChipProps): React.JSX.Element {
  const [selected, setSelected] = useState(!!initial);
  useEffect(() => setSelected(!!initial), [initial]);
  return (
    <View style={{ padding: 16, flexDirection: 'row', flexWrap: 'wrap', columnGap: 8, rowGap: 12 }}>
      <Chip
        {...rest}
        selected={selected}
        onPress={() => setSelected((s) => !s)}
        onClear={() => setSelected(false)}
        clearAccessibilityLabel="清除篩選"
      />
    </View>
  );
}

const meta: Meta<ChipProps> = {
  title: 'Components/Chip',
  component: Demo,
  args: { label: 'V4', variant: 'choice', selected: false, disabled: false, size: 'default', on: 'background' },
  argTypes: {
    variant: { control: 'inline-radio', options: ['filter', 'choice', 'multi'], description: 'filter shows the chevron and (when selected) a separate clear button' },
    size: { control: 'inline-radio', options: ['default', 'large'] },
    layout: { control: 'inline-radio', options: ['capsule', 'tile'], description: 'tile = colour-picker cell: swatch 20 above the name, radius 12, minHeight 56; width comes from the parent (ChoiceGrid)' },
    swatch: { control: 'color', description: 'Tape colour swatch (14x14, radius minor 4); pops on select' },
    on: { control: 'inline-radio', options: ['background', 'surface'], description: 'Surface under the chip (unselected fill: surface / surfaceAlt)' },
    icon: { control: 'select', options: Object.keys(glyphs), mapping: glyphs },
  },
};
export default meta;

export const Playground: StoryObj<ChipProps> = {};

/** Selected = inverted (textPrimary fill, background text). Row 3: FilterChip with value + 30pt clear. Row 4: tape swatch chips. */
export const AllStates: StoryObj<ChipProps> = {
  render: () => (
    <View style={{ padding: 16, width: 420 }}>
      <Row label="choice on background: unselected / selected / disabled">
        <View style={{ flexDirection: 'row', columnGap: 8 }}>
          <Chip label="全部" onPress={() => {}} />
          <Chip label="V3" selected onPress={() => {}} />
          <Chip label="V4" onPress={() => {}} />
          <Chip label="V9" disabled onPress={() => {}} />
        </View>
      </Row>
      <Row label="on surface">
        <View style={{ flexDirection: 'row', columnGap: 8 }}>
          <Chip label="V4" on="surface" onPress={() => {}} />
          <Chip label="V3" on="surface" selected onPress={() => {}} />
        </View>
      </Row>
      <Row label="FilterChip: value + clear / empty">
        <View style={{ flexDirection: 'row', columnGap: 8, alignItems: 'center' }}>
          <Chip variant="filter" label="紅石岩館" selected onPress={() => {}} onClear={() => {}} clearAccessibilityLabel="清除" />
          <Chip variant="filter" label="難度" onPress={() => {}} />
          <Chip variant="filter" label="時間" onPress={() => {}} />
        </View>
      </Row>
      <Row label="colour chips: 14x14 swatch, minor 4">
        <View style={{ flexDirection: 'row', columnGap: 8 }}>
          <Chip label="紅色" swatch="#E5483B" selected onPress={() => {}} />
          <Chip label="藍色" swatch="#2F6FDB" onPress={() => {}} />
          <Chip label="白色" swatch="#FFFFFF" onPress={() => {}} />
        </View>
      </Row>
    </View>
  ),
};

const COLORS = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'white', 'black'] as const;
const NAMES = { red: '紅色', orange: '橙色', yellow: '黃色', green: '綠色', blue: '藍色', purple: '紫色', pink: '粉紅色', white: '白色', black: '黑色' };

function TileGrid({ selected, disabled = false, label }: { selected: boolean; disabled?: boolean; label: string }): React.JSX.Element {
  const { theme } = useTheme();
  const mode = theme.isDark ? 'dark' : 'light';
  return (
    <Row label={label}>
      <ChoiceGrid accessibilityLabel="岩點顏色">
        {COLORS.map((c) => (
          <Chip
            key={c}
            layout="tile"
            label={NAMES[c]}
            swatch={TAPE_DISPLAY[mode][c].fill}
            swatchMark={TAPE_DISPLAY[mode][c].label}
            selected={selected}
            disabled={disabled}
            onPress={() => {}}
          />
        ))}
      </ChoiceGrid>
    </Row>
  );
}

function TileSheet(): React.JSX.Element {
  const { theme } = useTheme();
  return (
    <View style={{ padding: 16, width: 393, backgroundColor: theme.colors.background }}>
      <TileGrid label="tile: all 9 unselected" selected={false} />
      <TileGrid label="tile: all 9 selected (2pt outer gap ring + checkmark)" selected />
      <TileGrid label="tile: all 9 selected + disabled (whole-group lock keeps the inverted fill)" selected disabled />
      <TileGrid label="tile: all 9 disabled" selected={false} disabled />
      <Row label="swatch chip (capsule): unselected / selected (1pt outer gap ring)">
        <View style={{ flexDirection: 'row', columnGap: 8 }}>
          <Chip label="黑色" swatch={TAPE_DISPLAY[theme.isDark ? 'dark' : 'light'].black.fill} onPress={() => {}} />
          <Chip label="黑色" swatch={TAPE_DISPLAY[theme.isDark ? 'dark' : 'light'].black.fill} selected onPress={() => {}} />
          <Chip label="黃色" swatch={TAPE_DISPLAY[theme.isDark ? 'dark' : 'light'].yellow.fill} selected onPress={() => {}} />
        </View>
      </Row>
    </View>
  );
}

/** Colour tiles on a 6-column ChoiceGrid (393 wide), light and dark side by side. */
export const ColorTiles: StoryObj<ChipProps> = {
  render: () => (
    <View style={{ flexDirection: 'row' }}>
      <ForcedTheme mode="light">
        <TileSheet />
      </ForcedTheme>
      <ForcedTheme mode="dark">
        <TileSheet />
      </ForcedTheme>
    </View>
  ),
};
