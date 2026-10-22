import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';
import { View } from 'react-native';

import { AppText } from '../AppText';
import type { AppTextProps } from '../AppText';

const meta: Meta<AppTextProps> = {
  title: 'UI/AppText',
  component: AppText,
  decorators: [(Story) => <View style={{ padding: 16 }}><Story /></View>],
  args: { variant: 'body', children: 'ProjectDay 攀岩紀錄 The quick brown fox', numeric: false, color: 'textPrimary' },
  argTypes: {
    variant: {
      control: 'select',
      options: ['largeTitle', 'title1', 'title2', 'title3', 'headline', 'body', 'callout', 'subhead', 'footnote', 'caption1', 'caption2', 'sectionHeader'],
    },
    color: { control: 'select', options: ['textPrimary', 'textSecondary', 'primary', 'error', 'sendTop', 'sendFlash'] },
    weight: { control: 'select', options: [undefined, '400', '500', '600'] },
  },
};
export default meta;

export const Playground: StoryObj<AppTextProps> = {};

/** The full scale at once (a genuinely different layout from Playground). */
export const Scale: StoryObj<AppTextProps> = {
  render: () => (
    <View style={{ padding: 16 }}>
      {(['largeTitle', 'title1', 'title2', 'title3', 'headline', 'body', 'callout', 'subhead', 'footnote', 'caption1', 'caption2', 'sectionHeader'] as const).map((v) => (
        <AppText key={v} variant={v}>{`${v} 路線名稱 V4 Route 1234`}</AppText>
      ))}
    </View>
  ),
};
