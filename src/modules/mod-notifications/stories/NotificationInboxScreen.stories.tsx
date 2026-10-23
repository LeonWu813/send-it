// Fake data only — the Supabase stub intercepts all network calls.

import type { Session } from '@supabase/supabase-js';
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';

import { resetStubData, setStubData, STUB_PENDING } from '../../../../.storybook/stubs/supabase';
import { withPhoneFrame } from '../../../../.storybook/PhoneFrame';
import NotificationInboxScreen from '../screens/NotificationInboxScreen';

const session = { user: { id: 'story-user-me' } } as unknown as Session;

// Four beta-video-like notifications: rows 0 and 2 unread, rows 1 and 3 read.
const FAKE_NOTIFICATIONS = [
  {
    id: 'n1',
    recipient_user_id: 'story-user-me',
    actor_user_id: 'u-alice',
    type: 'beta_video_like',
    target_type: 'beta_video',
    target_id: 'vid-001',
    is_read: false,
    created_at: '2026-10-20T10:00:00Z',
  },
  {
    id: 'n2',
    recipient_user_id: 'story-user-me',
    actor_user_id: 'u-bob',
    type: 'beta_video_like',
    target_type: 'beta_video',
    target_id: 'vid-002',
    is_read: true,
    created_at: '2026-10-19T10:00:00Z',
  },
  {
    id: 'n3',
    recipient_user_id: 'story-user-me',
    actor_user_id: 'u-cindy',
    type: 'beta_video_like',
    target_type: 'beta_video',
    target_id: 'vid-003',
    is_read: false,
    created_at: '2026-10-18T10:00:00Z',
  },
  {
    id: 'n4',
    recipient_user_id: 'story-user-me',
    actor_user_id: 'u-david',
    type: 'beta_video_like',
    target_type: 'beta_video',
    target_id: 'vid-004',
    is_read: true,
    created_at: '2026-10-17T10:00:00Z',
  },
];

const FAKE_ACTORS = [
  { id: 'u-alice', display_name: '林雅婷', avatar_url: null },
  { id: 'u-bob', display_name: '陳柏宇', avatar_url: null },
  { id: 'u-cindy', display_name: '吳欣怡', avatar_url: null },
  { id: 'u-david', display_name: '王大明', avatar_url: null },
];

type StubState = 'populated' | 'empty' | 'loading';

/** Seed stubs synchronously so the screen's first fetch sees the data. */
function WithStubs({ state, children }: { state: StubState; children: React.ReactNode }): React.JSX.Element {
  resetStubData();
  setStubData('auth:session', { user: { id: 'story-user-me' } });
  if (state === 'populated') {
    setStubData('notifications', FAKE_NOTIFICATIONS);
    setStubData('users', FAKE_ACTORS);
  } else if (state === 'loading') {
    setStubData('notifications', STUB_PENDING);
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

/** 4 notifications, 2 unread (dot visible) and 2 read. */
export const Populated: Story = { args: { state: 'populated' } };

/** No notifications: empty-state UI. */
export const Empty: Story = { args: { state: 'empty' } };

/** Fetch never resolves: skeleton rows. */
export const Loading: Story = { args: { state: 'loading' } };

// No Error story: the stub cannot return query errors.
