import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';
import { View } from 'react-native';

import { IconButton } from '../IconButton';
import type { IconButtonProps } from '../IconButton';

const meta: Meta<IconButtonProps> = {
  title: 'UI/IconButton',
  component: IconButton,
  decorators: [(Story) => <View style={{ padding: 16 }}><Story /></View>],
  args: { name: 'notifications-outline', accessibilityLabel: '通知', color: 'textPrimary', disabled: false },
  argTypes: {
    name: { control: 'select', options: ['notifications-outline', 'settings-outline', 'bookmark-outline', 'bookmark', 'close'] },
    color: { control: 'select', options: ['textPrimary', 'textSecondary', 'primary', 'error'] },
    onPress: { action: 'pressed' },
  },
};
export default meta;

export const Playground: StoryObj<IconButtonProps> = {};
