import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';
import { View } from 'react-native';

import { ICON } from '../../../lib/icons';
import { Button } from '../Button';
import { ToastProvider, useToast } from '../Toast';
import type { ToastTone } from '../Toast';

interface Args {
  message: string;
  tone: ToastTone;
  withIcon: boolean;
  actions: 0 | 1 | 2;
}

function Trigger({ message, tone, withIcon, actions }: Args): React.JSX.Element {
  const toast = useToast();
  return (
    <View style={{ padding: 16, flex: 1 }}>
      <Button
        label="Show toast (press again to see replacement)"
        onPress={() =>
          toast.show({
            message,
            tone,
            icon: withIcon && tone === 'default' ? ICON.block.outline : undefined,
            actions: [
              { label: '重試', onPress: () => {} },
              { label: '補細節', onPress: () => {} },
            ].slice(0, actions),
          })
        }
      />
    </View>
  );
}

function Demo(props: Args): React.JSX.Element {
  return (
    // the toast layer is absolutely positioned over its parent: give it a phone-sized box
    <View style={{ height: 640, width: 400 }}>
      <ToastProvider bottomOffset={24}>
        <Trigger {...props} />
      </ToastProvider>
    </View>
  );
}

const meta: Meta<Args> = {
  title: 'UI/Toast',
  component: Demo,
  args: { message: '已記錄 V4 紅色・完攀', tone: 'default', withIcon: false, actions: 1 },
  argTypes: {
    tone: { control: 'inline-radio', options: ['default', 'flash', 'error'] },
    actions: { control: 'inline-radio', options: [0, 1, 2] },
  },
};
export default meta;

/** Swipe down to dismiss. An error toast is not replaced by a success toast until it is dismissed. Long messages never clamp. */
export const Playground: StoryObj<Args> = {};
