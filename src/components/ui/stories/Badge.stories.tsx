import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';
import { View } from 'react-native';

import { Badge } from '../Badge';
import type { BadgeProps } from '../Badge';

const meta: Meta<BadgeProps> = {
  title: 'Components/Badge',
  component: (props: BadgeProps) => (
    <View style={{ padding: 24 }}>
      <Badge {...props} />
    </View>
  ),
  args: { count: 3, live: false },
  argTypes: { count: { control: { type: 'number', min: 0, max: 150 }, description: '0 hides; >99 = 99+' } },
};
export default meta;

/** Change `count`: 0 -> n pops (live) or fades in; n -> n+1 rolls; n -> 0 shrinks. */
export const Playground: StoryObj<BadgeProps> = {};
