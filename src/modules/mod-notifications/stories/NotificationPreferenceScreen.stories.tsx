// Fake data only — the Supabase stub intercepts all network calls.

import type { Session } from '@supabase/supabase-js';
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';
import { View } from 'react-native';

import { setStubData } from '../../../../.storybook/stubs/supabase';
import NotificationPreferenceScreen from '../screens/NotificationPreferenceScreen';

const session = { user: { id: 'user-me' } } as unknown as Session;

// ── Meta ──────────────────────────────────────────────────────────────────────

const meta: Meta = {
  title: 'Notifications/NotificationPreferenceScreen',
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
type Story = StoryObj;

// ── Stories ───────────────────────────────────────────────────────────────────

/** Loaded — toggle ON, default opt-in (beta_video_like = true). */
export const Loaded: Story = {
  decorators: [
    (Story) => {
      setStubData('notification_preferences', [
        {
          user_id: 'user-me',
          beta_video_like: true,
          updated_at: '2026-10-20T10:00:00Z',
        },
      ]);
      return <Story />;
    },
  ],
  render: () => <NotificationPreferenceScreen session={session} />,
};

/** PreferenceOff — toggle OFF (beta_video_like = false, push disabled). */
export const PreferenceOff: Story = {
  decorators: [
    (Story) => {
      setStubData('notification_preferences', [
        {
          user_id: 'user-me',
          beta_video_like: false,
          updated_at: '2026-10-20T10:00:00Z',
        },
      ]);
      return <Story />;
    },
  ],
  render: () => <NotificationPreferenceScreen session={session} />,
};
