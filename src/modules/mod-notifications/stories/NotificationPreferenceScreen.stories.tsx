/**
 * Storybook stories for NotificationPreferenceScreen (MOD-007).
 *
 * Fake data only — the Supabase stub (stubs/supabase.ts) intercepts all
 * network calls. `setStubData` seeds notification_preferences rows so the
 * screen loads the toggle in the expected on/off state.
 *
 * Stories:
 *   Loaded           — preference loaded, beta_video_like toggle ON (default).
 *   PreferenceOff    — preference loaded, beta_video_like toggle OFF.
 */

import type { Session } from '@supabase/supabase-js';
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';
import { View } from 'react-native';

import { setStubData } from '../../../../.storybook/stubs/supabase';
import NotificationPreferenceScreen from '../screens/NotificationPreferenceScreen';

// ── Fake session ──────────────────────────────────────────────────────────────

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

/**
 * Loaded — preference row exists with beta_video_like = true (push enabled).
 * The toggle is ON. Matches the default opt-in state (AC-057).
 */
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

/**
 * PreferenceOff — beta_video_like = false (push disabled).
 * The toggle is OFF. In-app Notification rows are still created; push is not
 * enqueued (AC-057).
 */
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
