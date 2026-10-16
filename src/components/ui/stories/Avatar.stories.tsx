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
  title: 'UI/Avatar',
  component: Demo,
  args: { size: 'md', name: '小明', uri: '' },
  argTypes: {
    size: { control: 'inline-radio', options: ['xs', 'sm', 'md', 'xl'] },
    name: { control: 'text', description: 'Empty -> person glyph. Chinese: first character; Latin: first letter uppercased' },
    uri: { control: 'text', description: 'Photo URL (empty or failing -> default avatar)' },
  },
};
export default meta;

export const Playground: StoryObj<AvatarProps> = {};
