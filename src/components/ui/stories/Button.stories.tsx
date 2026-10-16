import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';
import { View } from 'react-native';

import { Button } from '../Button';
import type { ButtonProps } from '../Button';

const meta: Meta<ButtonProps> = {
  title: 'UI/Button',
  component: Button,
  decorators: [(Story) => <View style={{ padding: 16, width: 375 }}><Story /></View>],
  args: { label: '儲存', variant: 'primary', loading: false, disabled: false, fullWidth: false },
  argTypes: {
    variant: { control: 'inline-radio', options: ['primary', 'secondary', 'destructive', 'ghost'] },
    icon: { control: 'select', options: [undefined, 'add', 'trash-outline', 'flag-outline', 'log-out-outline'] },
    onPress: { action: 'pressed' },
  },
};
export default meta;

export const Playground: StoryObj<ButtonProps> = {};
