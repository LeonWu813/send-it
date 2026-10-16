import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';
import { View } from 'react-native';

import { useTheme } from '../../../lib/theme';
import { ProgressBar } from '../ProgressBar';
import type { ProgressBarProps } from '../ProgressBar';

function Demo(props: ProgressBarProps): React.JSX.Element {
  const { theme } = useTheme();
  return (
    <View style={{ padding: 16, width: 375 }}>
      <View
        style={{
          padding: 16,
          borderRadius: theme.borderRadius.lg,
          backgroundColor: props.tone === 'media' ? theme.colors.mediaBackground : theme.colors.surface,
        }}
      >
        <ProgressBar {...props} />
      </View>
    </View>
  );
}

const meta: Meta<ProgressBarProps> = {
  title: 'UI/ProgressBar',
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
