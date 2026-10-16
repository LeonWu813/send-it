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
  title: 'UI/EmptyState',
  component: Demo,
  args: {
    variant: 'firstUse',
    icon: ICON.sends.outline,
    title: '還沒有完攀紀錄',
    description: '你的完攀紀錄會出現在這裡。去岩館爬一條，記下來。',
    primaryLabel: '找路線',
    secondaryLabel: '',
  },
  argTypes: {
    variant: { control: 'inline-radio', options: ['firstUse', 'filtered', 'private', 'inline'] },
    icon: { control: 'select', options: Object.keys(glyphs), mapping: glyphs },
    onPrimary: { action: 'primary' },
    onSecondary: { action: 'secondary' },
  },
};
export default meta;

/** inline: only `description` + `secondaryLabel` (ghost) are used. No illustrations, ever. */
export const Playground: StoryObj<EmptyStateProps> = {};
