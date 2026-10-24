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
    variant: { control: 'inline-radio', options: ['field', 'block', 'notice', 'warning', 'error', 'success'], description: 'notice = info callout; warning / error / success callouts: surfaceAlt container, level told by icon + title (never a tinted container)' },
    on: { control: 'inline-radio', options: ['surface', 'elevated'] },
    onAction: { action: 'action' },
  },
};
export default meta;

/** field: icon + text under an input. block: title + description + action on one row (page: card 20, sheet: surfaceAlt 12). callouts (notice / warning / error / success): neutral container, severity icon, optional bold title. */
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
      <Row label="block, single line (action shares the text centre)">
        <InlineError variant="block" message="找不到該岩館。" actionLabel="重試" />
      </Row>
      <Row label="notice / info (no title)"><InlineError variant="notice" message="我們會審核這個帳號，但不會封鎖對方。" /></Row>
    </View>
  ),
};

/** Callout severities with a bold title: surfaceAlt container, icon + colour carry the level, body is textSecondary, icon on the headline line. */
export const Severities: StoryObj<InlineErrorProps> = {
  render: () => (
    <View style={{ padding: 16, width: 375 }}>
      <Row label="info + title">
        <InlineError variant="notice" title="審核中" message="通過後，路線會出現在列表。" />
      </Row>
      <Row label="warning + title (warning-coloured icon, announces once: 'Warning: ...')">
        <InlineError variant="warning" title="已有相似路線" message="這間岩館已有 2 條現役 V3 藍色路線。如果是不同條，請在「區域」填上位置來區分。" />
      </Row>
      <Row label="error + title">
        <InlineError variant="error" title="送出失敗" message="內容還在，請再試一次。" actionLabel="重試" />
      </Row>
      <Row label="success + title">
        <InlineError variant="success" title="已儲存" message="變更已套用。" />
      </Row>
      <Row label="warning, title + long body, action">
        <InlineError variant="warning" title="目前離線" message="你的紀錄會先存在手機上，連上網路後自動同步。" actionLabel="重試" />
      </Row>
    </View>
  ),
};

/** Same severities in the `NoticeBox` wrapper (tone) and a form-submit error that takes screen-reader focus. */
export const FocusOnAppear: StoryObj<InlineErrorProps> = {
  render: () => (
    <View style={{ padding: 16, width: 375 }}>
      <Row label="block + focusOnAppear (no announce, focus moves here)">
        <InlineError variant="block" message="儲存失敗，請稍後再試。" focusOnAppear />
      </Row>
    </View>
  ),
};

