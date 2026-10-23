import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';
import { View } from 'react-native';

import { useTheme } from '../../../lib/theme';
import { ProgressBar, UploadProgressCard } from '../ProgressBar';
import type { ProgressBarProps } from '../ProgressBar';

function Demo(props: ProgressBarProps): React.JSX.Element {
  const { theme } = useTheme();
  return (
    <View style={{ padding: 16, width: 375 }}>
      <View
        style={{
          padding: 16,
          borderRadius: theme.radius.card,
          backgroundColor: props.tone === 'media' ? theme.colors.mediaBackground : theme.colors.surface,
        }}
      >
        <ProgressBar {...props} />
      </View>
    </View>
  );
}

const meta: Meta<ProgressBarProps> = {
  title: 'Components/ProgressBar',
  component: Demo,
  args: { value: 62, tone: 'default', failed: false, showPercent: true, accessibilityLabel: '上傳中' },
  argTypes: {
    value: { control: { type: 'range', min: 0, max: 100, step: 1 } },
    tone: { control: 'inline-radio', options: ['default', 'media'] },
  },
};
export default meta;

/** Drag the value: the fill tweens linearly (<= 200ms). failed turns the fill red and keeps its position. */
export const Playground: StoryObj<ProgressBarProps> = {};

/** Upload modal: thumbnail of the chosen video + route + percent + bar. Failure keeps the video and offers Retry / Cancel. */
export const UploadModal: StoryObj<ProgressBarProps> = {
  render: () => (
    <View style={{ padding: 16, width: 375, rowGap: 16 }}>
      <UploadProgressCard title="上傳中…" routeName="V4 紅色・紅石岩館" percent={62} caption="上傳完成前請不要離開這個畫面。" progressLabel="上傳中" />
      <UploadProgressCard
        title="上傳失敗"
        routeName="V4 紅色・紅石岩館"
        percent={62}
        failed
        errorCaption="上傳中斷了，影片還在。"
        retryLabel="重試"
        cancelLabel="取消"
        progressLabel="上傳失敗"
      />
    </View>
  ),
};
