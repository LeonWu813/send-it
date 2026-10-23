/**
 * Storybook stories for NotificationInboxScreen (MOD-007).
 *
 * Fake data only — the Supabase stub (stubs/supabase.ts) intercepts all
 * network calls. `setStubData` seeds each story's expected table rows.
 *
 * The screen uses useUnreadCountContext(); a real UnreadCountProvider is
 * mounted in the shared decorator so the context is available.
 *
 * Stories:
 *   Loading           — isActive=false keeps the screen in its loading state.
 *   Populated         — 4 beta-video-like notifications (2 unread, 2 read).
 *   Empty             — no notifications (empty-state UI).
 */

import type { Session } from '@supabase/supabase-js';
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';
import { View } from 'react-native';

import { resetStubData, setStubData } from '../../../../.storybook/stubs/supabase';
import NotificationInboxScreen from '../screens/NotificationInboxScreen';
import { UnreadCountProvider } from '../UnreadCountProvider';

// ── Fake session ──────────────────────────────────────────────────────────────

const session = { user: { id: 'user-me' } } as unknown as Session;

// ── Fake data ─────────────────────────────────────────────────────────────────

/** Four beta-video-like notifications: rows 0 and 2 unread, rows 1 and 3 read. */
const FAKE_NOTIFICATIONS = [
  {
    id: 'n1',
    recipient_user_id: 'user-me',
    actor_user_id: 'u-alice',
    type: 'beta_video_like',
    target_type: 'beta_video',
    target_id: 'vid-001',
    is_read: false,
    created_at: '2026-10-20T10:00:00Z',
  },
  {
    id: 'n2',
    recipient_user_id: 'user-me',
    actor_user_id: 'u-bob',
    type: 'beta_video_like',
    target_type: 'beta_video',
    target_id: 'vid-002',
    is_read: true,
    created_at: '2026-10-19T10:00:00Z',
  },
  {
    id: 'n3',
    recipient_user_id: 'user-me',
    actor_user_id: 'u-cindy',
    type: 'beta_video_like',
    target_type: 'beta_video',
    target_id: 'vid-003',
    is_read: false,
    created_at: '2026-10-18T10:00:00Z',
  },
  {
    id: 'n4',
    recipient_user_id: 'user-me',
    actor_user_id: 'u-david',
    type: 'beta_video_like',
    target_type: 'beta_video',
    target_id: 'vid-004',
    is_read: true,
    created_at: '2026-10-17T10:00:00Z',
  },
];

const FAKE_ACTORS = [
  { id: 'u-alice', display_name: 'Alice Lin', avatar_url: null },
  { id: 'u-bob', display_name: 'Bob Chen', avatar_url: null },
  { id: 'u-cindy', display_name: 'Cindy Wu', avatar_url: null },
  { id: 'u-david', display_name: 'David Wang', avatar_url: null },
];

// ── Meta ──────────────────────────────────────────────────────────────────────

const meta: Meta = {
  title: 'Notifications/NotificationInboxScreen',
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <View style={{ width: 390, height: 780 }}>
        {/* UnreadCountProvider required: useUnreadCountContext() is called by the screen. */}
        <UnreadCountProvider session={session}>
          <Story />
        </UnreadCountProvider>
      </View>
    ),
  ],
};

export default meta;
type Story = StoryObj;

// ── Stories ───────────────────────────────────────────────────────────────────

/**
 * Loading skeleton.
 *
 * isActive=false prevents the data-fetch effect from running, holding the
 * screen in its initial loading state indefinitely. The skeleton animates in
 * after the skeletonDelay threshold.
 */
export const Loading: Story = {
  decorators: [
    (Story) => {
      resetStubData();
      return <Story />;
    },
  ],
  render: () => (
    <NotificationInboxScreen
      session={session}
      isActive={false}
    />
  ),
};

/**
 * Populated inbox — 4 beta-video-like notifications, 2 unread (unread dot
 * visible on rows 1 and 3) and 2 read. Mirrors AC-055 / AC-058 inbox layout.
 */
export const Populated: Story = {
  decorators: [
    (Story) => {
      setStubData('notifications', FAKE_NOTIFICATIONS);
      setStubData('users', FAKE_ACTORS);
      return <Story />;
    },
  ],
  render: () => (
    <NotificationInboxScreen
      session={session}
      isActive={true}
      onBack={() => {}}
      onNavigateToUser={() => {}}
    />
  ),
};

/**
 * Empty inbox — no notifications received yet (AC-055 empty state).
 */
export const Empty: Story = {
  decorators: [
    (Story) => {
      setStubData('notifications', []);
      return <Story />;
    },
  ],
  render: () => (
    <NotificationInboxScreen
      session={session}
      isActive={true}
      onBack={() => {}}
    />
  ),
};
