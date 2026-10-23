import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';
import { View } from 'react-native';

import { ICON } from '../../../lib/icons';
import { EmptyState } from '../EmptyState';
import type { EmptyStateProps } from '../EmptyState';

const glyphs = {
  default: undefined,
  route: ICON.route.outline,
  betaVideo: ICON.betaVideo.outline,
  sends: ICON.sends.outline,
  notifications: ICON.notifications.outline,
  followers: ICON.followers.outline,
};

function Demo(props: EmptyStateProps): React.JSX.Element {
  return (
    <View style={{ padding: 16, width: 375 }}>
      <EmptyState {...props} />
    </View>
  );
}

const meta: Meta<EmptyStateProps> = {
  title: 'Components/EmptyState',
  component: Demo,
  args: {
    variant: 'prompt',
    eyebrow: '開始記錄',
    icon: undefined,
    title: '記下你的第一次完攀',
    description: '去岩館爬一條，回來記在這裡。',
    primaryLabel: '找路線',
    secondaryLabel: '',
  },
  argTypes: {
    variant: { control: 'inline-radio', options: ['slot', 'prompt', 'filtered', 'private', 'inline'], description: 'slot = dashed whole-card button; prompt = primaryContainer card (zero records); firstUse is an alias of prompt' },
    icon: { control: 'select', options: Object.keys(glyphs), mapping: glyphs },
    onPrimary: { action: 'primary' },
    onSecondary: { action: 'secondary' },
  },
};
export default meta;

/** inline: only `description` + `secondaryLabel` (ghost) are used. No illustrations, ever. */
export const Playground: StoryObj<EmptyStateProps> = {};

/** The five variants. */
export const AllVariants: StoryObj<EmptyStateProps> = {
  render: () => (
    <View style={{ padding: 16, width: 375, rowGap: 24 }}>
      <EmptyState variant="slot" title="正在 project" description="在路線上點書籤，它就會出現在這裡。" primaryLabel="找路線" />
      <EmptyState variant="prompt" eyebrow="開始記錄" title="記下你的第一次完攀" description="去岩館爬一條，回來記在這裡。" primaryLabel="找路線" />
      <EmptyState variant="filtered" title="沒有符合的紀錄" description="換個篩選條件試試。" primaryLabel="清除篩選" />
      <EmptyState variant="private" title="這個帳號是私人的" description="追蹤後才看得到他的紀錄。" primaryLabel="追蹤" />
      <EmptyState variant="inline" description="還沒有完攀紀錄。" secondaryLabel="記錄一條" />
    </View>
  ),
};
