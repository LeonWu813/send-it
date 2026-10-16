import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';
import { View } from 'react-native';

import { InlineError } from '../InlineError';
import type { InlineErrorProps } from '../InlineError';

const meta: Meta<InlineErrorProps> = {
  title: 'UI/InlineError',
  component: (props: InlineErrorProps) => (
    <View style={{ padding: 16, width: 375 }}>
      <InlineError {...props} />
    </View>
  ),
  args: { variant: 'block', message: '影片 72 秒，請剪到 60 秒內。', actionLabel: '重新選擇', on: 'surface', warning: false },
  argTypes: {
    variant: { control: 'inline-radio', options: ['field', 'block', 'notice'], description: 'notice = NoticeBox (neutral heads-up)' },
    on: { control: 'inline-radio', options: ['surface', 'elevated'] },
    onAction: { action: 'action' },
  },
};
export default meta;

/** field: icon + text under an input. block: neutral surface + 4pt error bar. notice: noticeContainer + 4pt bar (use warning for a caution glyph). */
export const Playground: StoryObj<InlineErrorProps> = {};
