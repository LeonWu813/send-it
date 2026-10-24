/**
 * Storybook stories for FeedScreen (MOD-006, AC-051–053).
 *
 * Note (AC-159): FeedScreen is dead code in Phase 1 — it is never imported or
 * rendered in any navigator or shell. These stories exist for design coverage only.
 *
 * States:
 *   Loading   — PageLoading (query never resolves; becomes the Error state after 10s)
 *   Populated — 3 feed items (1 ascent + 2 beta videos) with like counts
 *   Empty     — E1 page empty state
 *   Error     — E4 page error with Retry (visual wrapper)
 *
 * No real Supabase calls — all service functions go through the Storybook
 * supabase stub (`.storybook/stubs/supabase.ts`).
 */

import type { Session } from '@supabase/supabase-js';
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';
import { View } from 'react-native';

import { resetStubData, setStubData, STUB_PENDING } from '../../../../.storybook/stubs/supabase';
import { useTheme } from '../../../lib/theme';
import { EmptyState } from '../../../components/ui';
import FeedScreen from '../screens/FeedScreen';
import type { FeedItem } from '../types';

// ── Mock session ───────────────────────────────────────────────────────────────

const MOCK_SESSION = { user: { id: 'story-user-me' } } as unknown as Session;

// ── Seed data ─────────────────────────────────────────────────────────────────

const MOCK_ASCENT: FeedItem = {
  item_type: 'ascent',
  item_id: 'ascent-001',
  actor_user_id: 'user-002',
  actor_name: 'Alice Chen',
  actor_avatar_url: null,
  route_id: 'route-001',
  route_grade: 'V4',
  created_at: '2026-10-20T10:00:00Z',
  ascent_style: 'flash',
  ascent_attempts: 1,
  ascent_note: null,
  video_url: null,
  thumbnail_url: null,
  video_caption: null,
};

const MOCK_VIDEO_1: FeedItem = {
  item_type: 'beta_video',
  item_id: 'video-001',
  actor_user_id: 'user-003',
  actor_name: 'Bob Tsai',
  actor_avatar_url: null,
  route_id: 'route-002',
  route_grade: 'V6',
  created_at: '2026-10-20T09:00:00Z',
  ascent_style: null,
  ascent_attempts: null,
  ascent_note: null,
  video_url: 'story://mock-video-1.mp4',
  thumbnail_url: null,
  video_caption: 'Sneaky toe hook in the crux!',
};

const MOCK_VIDEO_2: FeedItem = {
  item_type: 'beta_video',
  item_id: 'video-002',
  actor_user_id: 'user-004',
  actor_name: 'Mei Lin',
  actor_avatar_url: null,
  route_id: 'route-003',
  route_grade: 'V5',
  created_at: '2026-10-19T17:30:00Z',
  ascent_style: null,
  ascent_attempts: null,
  ascent_note: null,
  video_url: 'story://mock-video-2.mp4',
  thumbnail_url: null,
  video_caption: null,
};

const POPULATED_FEED: FeedItem[] = [MOCK_ASCENT, MOCK_VIDEO_1, MOCK_VIDEO_2];

// ── Visual wrappers for states that can't be driven through the stub ──────────

/** Mirrors FeedScreen's loading branch: spinner centred on background. */
/** Mirrors FeedScreen's error branch (E4). The stub cannot drive a failing query. */
function ErrorWrapper(): React.JSX.Element {
  const { theme } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <EmptyState
        variant="error"
        title="無法載入此頁"
        description="請檢查網路連線後再試一次。"
        primaryLabel="重試"
        onPrimary={() => {}}
      />
    </View>
  );
}

// ── Meta ──────────────────────────────────────────────────────────────────────

const meta: Meta = {
  title: 'Pages/Profile/Feed (dead code)',
  tags: ['!dev', '!autodocs'], // AC-159: hidden from the sidebar, file kept for Phase 2
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <View style={{ width: 390, height: 780 }}>
        <Story />
      </View>
    ),
  ],
};
export default meta;

// ── Stories ───────────────────────────────────────────────────────────────────

/** PageLoading — shown while the activity feed RPC is in flight. */
export const Loading: StoryObj = {
  render: () => {
    resetStubData();
    setStubData('rpc:get_activity_feed', STUB_PENDING);
    return <FeedScreen session={MOCK_SESSION} />;
  },
};

/**
 * Populated feed with 3 items: one ascent card (no like button — AC-053)
 * and two beta-video cards (each with a like button and count — AC-052).
 */
export const Populated: StoryObj = {
  render: () => {
    resetStubData();
    setStubData('rpc:get_activity_feed', POPULATED_FEED);
    setStubData('rpc:get_like_info', { like_count: 5, user_has_liked: false });
    return <FeedScreen session={MOCK_SESSION} />;
  },
};

/** E1 page empty state: no posts from followed climbers yet. */
export const Empty: StoryObj = {
  render: () => {
    resetStubData();
    setStubData('rpc:get_activity_feed', []);
    return <FeedScreen session={MOCK_SESSION} />;
  },
};

/** E4 page error: feed RPC failed. */
export const Error: StoryObj = {
  render: () => {
    resetStubData();
    return <ErrorWrapper />;
  },
};
