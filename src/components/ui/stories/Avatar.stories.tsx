import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';
import { View } from 'react-native';

import { Avatar } from '../Avatar';
import type { AvatarProps } from '../Avatar';

function Demo(props: AvatarProps): React.JSX.Element {
  return (
    <View style={{ padding: 16 }}>
      <Avatar {...props} />
    </View>
  );
}

const meta: Meta<AvatarProps> = {
  title: 'Components/Avatar',
  component: Demo,
  args: { size: 'md', name: '小明', uri: '' },
  argTypes: {
    size: { control: 'inline-radio', options: ['xs', 'sm', 'md', 'lg', 'xl'] },
    name: { control: 'text', description: 'Empty -> person glyph. Chinese: first character; Latin: first letter uppercased' },
    uri: { control: 'text', description: 'Photo URL (empty or failing -> default avatar)' },
  },
};
export default meta;

export const Playground: StoryObj<AvatarProps> = {};

/** Five sizes (initial, person glyph when the name is empty). */
export const AllVariants: StoryObj<AvatarProps> = {
  render: () => (
    <View style={{ padding: 16, flexDirection: 'row', columnGap: 12, alignItems: 'flex-end' }}>
      {(['xs', 'sm', 'md', 'lg', 'xl'] as const).map((s) => (
        <Avatar key={s} size={s} name="小明" />
      ))}
      <Avatar size="lg" name="" />
      <Avatar size="lg" name="Alex" />
    </View>
  ),
};
