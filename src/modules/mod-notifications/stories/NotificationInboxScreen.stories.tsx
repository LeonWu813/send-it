// Fake data only — the Supabase stub intercepts all network calls.

import type { Session } from '@supabase/supabase-js';
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';

import { resetStubData, setStubData, STUB_PENDING } from '../../../../.storybook/stubs/supabase';
import { withPhoneFrame } from '../../../../.storybook/PhoneFrame';
import NotificationInboxScreen from '../screens/NotificationInboxScreen';

const session = { user: { id: 'story-user-me' } } as unknown as Session;

const daysAgo = (n: number): string => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();

// Five beta-video-like notifications spread over 今天 / 本週 / 更早 (L-1): rows 0 and 2 unread.
const FAKE_NOTIFICATIONS = [
  {
    id: 'n1',
    recipient_user_id: 'story-user-me',
    actor_user_id: 'u-alice',
    type: 'beta_video_like',
    target_type: 'beta_video',
    target_id: 'vid-001',
    is_read: false,
    created_at: daysAgo(0),
  },
  {
    id: 'n2',
    recipient_user_id: 'story-user-me',
    actor_user_id: 'u-bob',
    type: 'beta_video_like',
    target_type: 'beta_video',
    target_id: 'vid-002',
    is_read: true,
    created_at: daysAgo(2),
  },
  {
    id: 'n3',
    recipient_user_id: 'story-user-me',
    actor_user_id: 'u-cindy',
    type: 'beta_video_like',
    target_type: 'beta_video',
    target_id: 'vid-003',
    is_read: false,
    created_at: daysAgo(4),
  },
  {
    id: 'n4',
    recipient_user_id: 'story-user-me',
    actor_user_id: 'u-david',
    type: 'beta_video_like',
    target_type: 'beta_video',
    target_id: 'vid-004',
    is_read: true,
    created_at: daysAgo(12),
  },
  {
    id: 'n5',
    recipient_user_id: 'story-user-me',
    actor_user_id: 'u-alice',
    type: 'beta_video_like',
    target_type: 'beta_video',
    target_id: 'vid-005',
    is_read: true,
    created_at: daysAgo(30),
  },
];

const FAKE_VIDEOS = [
  { id: 'vid-001', routes: { grade: 'V4', color_tag: 'red' } },
  { id: 'vid-002', routes: { grade: 'V2', color_tag: 'blue' } },
  { id: 'vid-003', routes: { grade: 'V5', color_tag: 'green' } },
  { id: 'vid-004', routes: { grade: 'V3', color_tag: 'yellow' } },
  { id: 'vid-005', routes: { grade: 'V6', color_tag: 'black' } },
];

const FAKE_ACTORS = [
  { id: 'u-alice', display_name: '林雅婷', avatar_url: null },
  { id: 'u-bob', display_name: '陳柏宇', avatar_url: null },
  { id: 'u-cindy', display_name: '吳欣怡', avatar_url: null },
  { id: 'u-david', display_name: '王大明', avatar_url: null },
];

type StubState = 'populated' | 'empty' | 'loading' | 'error';

/** Seed stubs synchronously so the screen's first fetch sees the data. */
function WithStubs({ state, children }: { state: StubState; children: React.ReactNode }): React.JSX.Element {
  resetStubData();
  setStubData('auth:session', { user: { id: 'story-user-me' } });
  if (state === 'populated') {
    setStubData('notifications', FAKE_NOTIFICATIONS);
    setStubData('users', FAKE_ACTORS);
    setStubData('beta_videos', FAKE_VIDEOS);
  } else if (state === 'loading') {
    setStubData('notifications', STUB_PENDING);
  } else if (state === 'error') {
    // The stub cannot return query errors; a non-array payload makes fetchNotifications throw.
    setStubData('notifications', {} as never);
  }
  return <>{children}</>;
}

type Args = { state: StubState };

const meta: Meta<Args> = {
  title: 'Pages/Settings & Notifications/Notification Inbox',
  component: NotificationInboxScreen as never, // real component; story args only drive the stub data
  tags: ['!autodocs'],
  parameters: { layout: 'centered', page: { overlay: true } },
  decorators: [
    (Story, ctx) => (
      <WithStubs state={(ctx.args as Args).state}>
        <Story />
      </WithStubs>
    ),
    withPhoneFrame,
  ],
  argTypes: { state: { control: false } },
  render: () => (
    <NotificationInboxScreen session={session} isActive onBack={() => {}} onNavigateToUser={() => {}} />
  ),
};

export default meta;
type Story = StoryObj<Args>;

/** 5 notifications in 今天 / 本週 / 更早 sections, 2 unread (dot visible). */
export const Populated: Story = { args: { state: 'populated' } };

/** No notifications: empty-state UI. */
export const Empty: Story = { args: { state: 'empty' } };

/** Fetch never resolves: PageLoading (spinner); after 10s it swaps to the E4 error. */
export const Loading: Story = { args: { state: 'loading' } };

/** Whole-page load failure: E4 with retry. */
export const Error: Story = { args: { state: 'error' } };
