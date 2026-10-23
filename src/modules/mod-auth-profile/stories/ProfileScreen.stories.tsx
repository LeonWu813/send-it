/**
 * Pages/Profile/Profile: the real ProfileScreen (own profile) inside the phone frame, Profile tab active.
 * Data comes from the supabase stub, seeded synchronously per state.
 * No Error story: ProfileScreen has no error UI (failed fetches keep zero counts / empty lists).
 */

import type { Session } from '@supabase/supabase-js';
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';

import { resetStubData, setStubData, STUB_PENDING } from '../../../../.storybook/stubs/supabase';
import { withPhoneFrame } from '../../../../.storybook/PhoneFrame';
import ProfileScreen from '../screens/ProfileScreen';

// Off-spec design tooling. Fake data only; supabase stub never touches the network.
const ME = 'story-user-me';
const fakeSession = { user: { id: ME } } as unknown as Session;

type StubState = 'populated' | 'empty' | 'loading';

const GRADES = ['VB', 'V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10'];

function setupStubs(state: StubState): void {
  resetStubData();
  setStubData('auth:session', { user: { id: ME, email: 'guanyu@example.com' } });
  if (state === 'loading') {
    // Profile row never resolves: header stays in its placeholder state.
    setStubData('users', STUB_PENDING);
    setStubData('rpc:get_follower_counts', STUB_PENDING);
    setStubData('rpc:get_profile_stats', STUB_PENDING);
    setStubData('beta_videos', STUB_PENDING);
    setStubData('ascents', STUB_PENDING);
    return;
  }
  const populated = state === 'populated';
  setStubData('users', [
    {
      id: ME,
      display_name: '林冠宇',
      avatar_url: null,
      bio: populated ? '熱愛抱石，台北攀岩愛好者。V5 是我的目標。' : null,
      privacy_setting: 'public',
      created_at: '2026-01-15T00:00:00Z',
    },
  ]);
  setStubData('rpc:get_follower_counts', {
    follower_count: populated ? 42 : 0,
    following_count: populated ? 17 : 0,
  });
  const counts = [2, 8, 15, 20, 18, 12, 7, 3, 0, 0, 0, 0];
  setStubData('rpc:get_profile_stats', {
    total_sends: populated ? 85 : 0,
    sends_by_grade: GRADES.map((grade, i) => ({ grade, count: populated ? counts[i] : 0 })),
    accumulated_days: populated ? 30 : 0,
    highest_grade: populated ? 'V6' : null,
  });
}

function WithStubs({ state, children }: { state: StubState; children: React.ReactNode }): React.JSX.Element {
  setupStubs(state);
  return <>{children}</>;
}

type Args = { state: StubState };

const meta: Meta<Args> = {
  title: 'Pages/Profile/Profile',
  component: ProfileScreen as never, // real component; story args only drive the stub data
  tags: ['!autodocs'],
  parameters: { layout: 'centered', page: { tab: 'profile' } },
  decorators: [
    (Story, ctx) => (
      <WithStubs state={(ctx.args as Args).state}>
        <Story />
      </WithStubs>
    ),
    withPhoneFrame,
  ],
  argTypes: { state: { control: false } },
  render: () => <ProfileScreen session={fakeSession} isActive onNavigateEditProfile={() => {}} />,
};
export default meta;

type Story = StoryObj<Args>;

/** Own profile loaded: name, bio, follower/following counts, stats panel. */
export const Populated: Story = { args: { state: 'populated' } };

/** New climber: no bio, zero counts, zero stats, empty send history. */
export const Empty: Story = { args: { state: 'empty' } };

/** Profile and stats queries never resolve: header placeholders and loading stats. */
export const Loading: Story = { args: { state: 'loading' } };
