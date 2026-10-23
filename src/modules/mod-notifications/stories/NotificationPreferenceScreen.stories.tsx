// Fake data only — the Supabase stub intercepts all network calls.

import type { Session } from '@supabase/supabase-js';
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';

import { resetStubData, setStubData, STUB_PENDING } from '../../../../.storybook/stubs/supabase';
import { withPhoneFrame } from '../../../../.storybook/PhoneFrame';
import NotificationPreferenceScreen from '../screens/NotificationPreferenceScreen';

const session = { user: { id: 'story-user-me' } } as unknown as Session;

type StubState = 'on' | 'off' | 'loading';

/** Seed stubs synchronously so the screen's first fetch sees the data. */
function WithStubs({ state, children }: { state: StubState; children: React.ReactNode }): React.JSX.Element {
  resetStubData();
  setStubData('auth:session', { user: { id: 'story-user-me' } });
  if (state === 'loading') {
    setStubData('notification_preferences', STUB_PENDING);
  } else {
    setStubData('notification_preferences', [
      { user_id: 'story-user-me', beta_video_like: state === 'on', updated_at: '2026-10-20T10:00:00Z' },
    ]);
  }
  return <>{children}</>;
}

type Args = { state: StubState };

const meta: Meta<Args> = {
  title: 'Pages/Settings & Notifications/Notification Preferences',
  component: NotificationPreferenceScreen as never, // real component; story args only drive the stub data
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
  render: () => <NotificationPreferenceScreen session={session} onBack={() => {}} />,
};

export default meta;
type Story = StoryObj<Args>;

/** Beta-video-like toggle ON (default opt-in). */
export const Populated: Story = { args: { state: 'on' } };

/** Toggle OFF (beta_video_like = false). */
export const PreferenceOff: Story = { name: 'Preference Off', args: { state: 'off' } };

/** Preference fetch never resolves: skeleton. */
export const Loading: Story = { args: { state: 'loading' } };

// No Error story: the stub cannot return query errors.
