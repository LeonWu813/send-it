import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';
import { View } from 'react-native';

import { InlineError } from '../InlineError';
import { Row } from './_helpers';
import type { InlineErrorProps } from '../InlineError';

const meta: Meta<InlineErrorProps> = {
  title: 'Components/InlineError',
  component: (props: InlineErrorProps) => (
    <View style={{ padding: 16, width: 375 }}>
      <InlineError {...props} />
    </View>
  ),
  args: { variant: 'block', title: '影片太長', message: '影片 72 秒，請剪到 60 秒內。', actionLabel: '重新選擇', on: 'surface', warning: false },
  argTypes: {
    variant: { control: 'inline-radio', options: ['field', 'block', 'notice', 'warning'], description: 'notice = neutral NoticeBox (surfaceAlt); warning = real warning (noticeContainer)' },
    on: { control: 'inline-radio', options: ['surface', 'elevated'] },
    onAction: { action: 'action' },
  },
};
export default meta;

/** field: icon + text under an input. block: title + description + action on one row (page: card 20, sheet: surfaceAlt 12). notice: neutral. warning: real warning. */
export const Playground: StoryObj<InlineErrorProps> = {};

/** Every variant. */
export const AllStates: StoryObj<InlineErrorProps> = {
  render: () => (
    <View style={{ padding: 16, width: 375 }}>
      <Row label="field"><InlineError variant="field" message="請輸入 1 到 9999 之間的數字。" /></Row>
      <Row label="block (page, card 20)">
        <InlineError variant="block" title="路線載不出來" message="請檢查網路連線後再試一次。" actionLabel="重試" />
      </Row>
      <Row label="block (in a sheet, surfaceAlt 12)">
        <InlineError variant="block" on="elevated" title="送出失敗" message="內容還在，請再試一次。" actionLabel="重試" />
      </Row>
      <Row label="notice (neutral)"><InlineError variant="notice" message="我們會審核這個帳號，但不會封鎖對方。" /></Row>
      <Row label="warning (noticeContainer)"><InlineError variant="warning" message="影片正在審核中，暫時只有你看得到。" /></Row>
    </View>
  ),
};
