import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';

import { ICON } from '../../../lib/icons';
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
    swatch: { control: 'color', description: 'Tape colour swatch (14x14, radius minor 4); pops on select' },
    on: { control: 'inline-radio', options: ['background', 'surface'], description: 'Surface under the chip (unselected fill: surface / surfaceAlt)' },
    swatchHair: { control: 'color' },
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
          <Chip label="白色" swatch="#FFFFFF" swatchHair="#B3AA9D" onPress={() => {}} />
        </View>
      </Row>
    </View>
  ),
};
