import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';
import { View } from 'react-native';

import { Button } from '../Button';
import { ToastProvider, useToast } from '../Toast';
import type { ToastContent } from '../Toast';

function Trigger(props: ToastContent): React.JSX.Element {
  const toast = useToast();
  return (
    <View style={{ padding: 16, flex: 1 }}>
      <Button label="Show toast (press twice to see replacement)" onPress={() => toast.show(props)} />
    </View>
  );
}

function Demo(props: ToastContent): React.JSX.Element {
  return (
    <ToastProvider bottomOffset={24}>
      <Trigger {...props} />
    </ToastProvider>
  );
}

const meta: Meta<ToastContent> = {
  title: 'UI/Toast',
  component: Demo,
  args: { message: '已記錄 V4 紅色・完攀', tone: 'default', actionLabel: '復原' },
  argTypes: { tone: { control: 'inline-radio', options: ['default', 'flash', 'error'] }, onAction: { action: 'action' } },
};
export default meta;

export const Playground: StoryObj<ToastContent> = {};
