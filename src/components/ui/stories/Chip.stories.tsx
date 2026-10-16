import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React, { useState } from 'react';
import { View } from 'react-native';

import { Chip } from '../Chip';
import type { ChipProps } from '../Chip';

function Demo({ selected: initial, ...rest }: ChipProps): React.JSX.Element {
  const [selected, setSelected] = useState(!!initial);
  React.useEffect(() => setSelected(!!initial), [initial]);
  return (
    <View style={{ padding: 16, flexDirection: 'row' }}>
      <Chip {...rest} selected={selected} onPress={() => setSelected((s) => !s)} />
    </View>
  );
}

const meta: Meta<ChipProps> = {
  title: 'UI/Chip',
  component: Demo,
  args: { label: 'V4', selected: false },
  argTypes: { swatch: { control: 'color' } },
};
export default meta;

export const Playground: StoryObj<ChipProps> = {};
