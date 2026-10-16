import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';
import { Text, View } from 'react-native';

import { ForcedTheme } from '../../../../.storybook/ForcedTheme';
import { useTheme } from '../../../lib/theme';
import BetaVideoGrid from '../components/BetaVideoGrid';
import type { BetaVideo } from '../types';

// Fake data only. The Phase 1 grid renders placeholder cells (no real thumbnails),
// so thumbnail_url is never fetched.
function makeVideos(count: number, privacy: 'public' | 'followers_only' = 'public'): BetaVideo[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `video-${i + 1}`,
    route_id: 'route-1',
    user_id: 'user-1',
    video_url: `fake/video-${i + 1}.mp4`,
    thumbnail_url: `https://placehold.co/300x300?text=${i + 1}`,
    duration_seconds: 20 + i,
    caption: null,
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
    is_reported: false,
    report_dismissed: false,
    display_name: '小明',
    avatar_url: null,
    beta_video_privacy: privacy,
    route_name: 'V3 測試路線',
    gym_name: '測試岩館',
  }));
}

function EmptyState(): React.JSX.Element {
  const { theme } = useTheme();
  return (
    <View style={{ padding: theme.spacing.xl, alignItems: 'center' }}>
      <Text style={{ color: theme.colors.textSecondary, fontSize: theme.fontSize.md }}>
        還沒有 Beta 影片
      </Text>
    </View>
  );
}

function Frame({ children, padding = 0 }: { children: React.ReactNode; padding?: number }): React.JSX.Element {
  const { theme } = useTheme();
  return <View style={{ padding, backgroundColor: theme.colors.background }}>{children}</View>;
}

const meta: Meta<typeof BetaVideoGrid> = {
  title: 'Beta Video/BetaVideoGrid',
  component: BetaVideoGrid,
  args: {
    videos: makeVideos(3),
    onPressVideo: (index: number) => console.log('onPressVideo', index),
  },
  decorators: [(Story) => <Frame><Story /></Frame>],
};
export default meta;

type Story = StoryObj<typeof BetaVideoGrid>;

export const OneVideo: Story = { args: { videos: makeVideos(1) } };
export const ThreeVideos: Story = { args: { videos: makeVideos(3) } };
export const NineVideos: Story = { args: { videos: makeVideos(9) } };
export const ManyVideosPartialLastRow: Story = { args: { videos: makeVideos(14) } };

export const EmptyWithEmptyState: Story = {
  args: { videos: [], emptyState: <EmptyState /> },
};

/** No emptyState prop: component renders nothing. */
export const EmptyWithoutEmptyState: Story = { args: { videos: [] } };

/** Route-detail context: parent has 16dp horizontal padding. */
export const WithHorizontalPadding: Story = {
  args: { videos: makeVideos(6), horizontalPadding: 16 },
  decorators: [(Story) => <View style={{ padding: 16 }}><Story /></View>],
};

/** Followers-only videos (privacy is filtered by the caller; the grid renders them identically). */
export const FollowersOnlyVideos: Story = { args: { videos: makeVideos(4, 'followers_only') } };

export const LightAndDark: Story = {
  args: { videos: makeVideos(5) },
  render: (args) => (
    <View>
      {(['light', 'dark'] as const).map((mode) => (
        <ForcedTheme key={mode} mode={mode}>
          <Frame>
            <BetaVideoGrid {...args} />
          </Frame>
        </ForcedTheme>
      ))}
    </View>
  ),
};
