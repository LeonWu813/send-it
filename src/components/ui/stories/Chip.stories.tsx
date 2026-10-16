import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';

import { ICON } from '../../../lib/icons';
import { Chip } from '../Chip';
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
  title: 'UI/Chip',
  component: Demo,
  args: { label: 'V4', variant: 'choice', selected: false, disabled: false, size: 'default' },
  argTypes: {
    variant: { control: 'inline-radio', options: ['filter', 'choice', 'multi'], description: 'filter shows the chevron and (when selected) a separate clear button' },
    size: { control: 'inline-radio', options: ['default', 'large'] },
    swatch: { control: 'color', description: 'Tape colour swatch (11x11, radius 3); pops on select' },
    swatchHair: { control: 'color' },
    icon: { control: 'select', options: Object.keys(glyphs), mapping: glyphs },
  },
};
export default meta;

export const Playground: StoryObj<ChipProps> = {};
