import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';
import { View } from 'react-native';

import { EmptyState } from '../../../components/ui/EmptyState';
import { useLayout, useTheme } from '../../../lib/theme';
import BetaVideoGrid from '../components/BetaVideoGrid';
import type { BetaVideo } from '../types';

// Fake data only. Phase 1 rows hold a storage path (not a loadable image), so by default the tiles
// are placeholders; the `thumbnails` control swaps in placehold.co URLs to preview the fade-in.
function makeVideos(count: number, thumbnails: boolean): BetaVideo[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `video-${i + 1}`,
    route_id: 'route-1',
    user_id: 'user-1',
    video_url: `fake/video-${i + 1}.mp4`,
    thumbnail_url: thumbnails ? `https://placehold.co/300x300?text=${i + 1}` : `fake/thumb-${i + 1}.jpg`,
    duration_seconds: 20 + i,
    caption: null,
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
    is_reported: false,
    report_dismissed: false,
    display_name: '小明',
    avatar_url: null,
    beta_video_privacy: 'public',
    route_name: 'V3 測試路線',
    gym_name: '測試岩館',
  }));
}

interface DemoArgs {
  /** Number of videos (0 shows the empty state or nothing). */
  count: number;
  /** 0 = full-bleed profile grid (gap 2, square). 16 = route-detail inset grid (gap 4, rounded). */
  horizontalPadding: 0 | 16;
  /** Pass the ui/ EmptyState `inline` as `emptyState` (only visible when count is 0). */
  showEmptyState: boolean;
  /** Skeleton tiles (the caller shows these after 300ms of loading). */
  loading: boolean;
  /** Loadable thumbnail URLs, to preview the fade-in (cached images skip the fade). */
  thumbnails: boolean;
  onPressVideo: (index: number) => void;
}

function Demo({ count, horizontalPadding, showEmptyState, loading, thumbnails, onPressVideo }: DemoArgs): React.JSX.Element {
  const { theme } = useTheme();
  const { screenMargin } = useLayout();
  // Same wrapper the real screens use: the inset grid sits inside the screen margin.
  const wrapper = horizontalPadding > 0 ? { paddingHorizontal: screenMargin } : null;
  return (
    <View style={{ width: 390, backgroundColor: theme.colors.background, paddingVertical: theme.spacing.md }}>
      <View style={wrapper}>
        <BetaVideoGrid
          // key: remount when thumbnails toggle so the fade-in replays
          key={String(thumbnails)}
          videos={makeVideos(count, thumbnails)}
          onPressVideo={onPressVideo}
          horizontalPadding={horizontalPadding}
          loading={loading}
          emptyState={
            showEmptyState ? (
              <EmptyState
                variant="inline"
                description="還沒人分享 Beta。"
                secondaryLabel="上傳 Beta"
                onSecondary={() => console.log('upload')}
              />
            ) : undefined
          }
        />
      </View>
    </View>
  );
}

const meta: Meta<DemoArgs> = {
  title: 'Beta Video/BetaVideoGrid',
  component: Demo,
  args: {
    count: 7,
    horizontalPadding: 16,
    showEmptyState: true,
    loading: false,
    thumbnails: false,
    onPressVideo: (index: number) => console.log('onPressVideo', index),
  },
  argTypes: {
    count: { control: { type: 'range', min: 0, max: 30, step: 1 } },
    horizontalPadding: { control: 'inline-radio', options: [0, 16] },
    showEmptyState: { control: 'boolean' },
    loading: { control: 'boolean' },
    thumbnails: { control: 'boolean' },
    onPressVideo: { action: 'pressVideo' },
  },
};
export default meta;

type Story = StoryObj<DemoArgs>;

/** Press a tile (scales to 0.96), drag Item count to 0 for the empty state, toggle Loading for skeletons, Thumbnails for the fade-in. */
export const Playground: Story = {};
