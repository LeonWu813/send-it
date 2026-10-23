import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';
import { View } from 'react-native';

import { ICON } from '../../../lib/icons';
import { Button } from '../Button';
import { Toast, ToastProvider, useToast } from '../Toast';
import { Row } from './_helpers';
import type { ToastTone } from '../Toast';

interface Args {
  message: string;
  tone: ToastTone;
  withIcon: boolean;
  actions: 0 | 1;
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
  title: 'Components/Toast',
  component: Demo,
  args: { message: '已記錄 V4 紅色・完攀', tone: 'default', withIcon: false, actions: 1 },
  argTypes: {
    tone: { control: 'inline-radio', options: ['default', 'flash', 'error'] },
    actions: { control: 'inline-radio', options: [0, 1], description: 'At most one action' },
  },
};
export default meta;

/** Swipe down to dismiss. An error toast is not replaced by a success toast until it is dismissed. Long messages never clamp. */
export const Playground: StoryObj<Args> = {};

/** Static render of every shape: single-line capsule (3 tones, with action) and the two-line card. */
export const AllStates: StoryObj<Args> = {
  render: () => (
    <View style={{ padding: 16, width: 400 }}>
      {(
        [
          ['default', 'default + action', '已刪除', true],
          ['flash', 'flash', '閃攀！V4 紅色', false],
          ['error', 'error', '沒有存起來', true],
          ['default', 'two lines: card 20', '這則訊息比較長，所以會換成兩行的卡片樣式，而不是膠囊。', false],
        ] as const
      ).map(([tone, label, message, action]) => (
        <Row key={label} label={label}>
          <View style={{ height: 96, width: 368 }}>
            <Toast
              visible
              tone={tone}
              message={message}
              actions={action ? [{ label: '復原', onPress: () => {} }] : undefined}
              onDismiss={() => {}}
              bottomOffset={8}
              durationMs={600000}
            />
          </View>
        </Row>
      ))}
    </View>
  ),
};
