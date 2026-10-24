import type { Session } from '@supabase/supabase-js';
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';
import { fn } from 'storybook/test';

import { resetStubData, setStubData, STUB_PENDING } from '../../../../.storybook/stubs/supabase';
import { withPhoneFrame } from '../../../../.storybook/PhoneFrame';
import OtherUserProfileScreen from '../screens/OtherUserProfileScreen';

// Off-spec design tooling. Fake data only; supabase stub never touches the network.
const ME = 'story-user-me';
const fakeSession = { user: { id: ME } } as unknown as Session;

const PROFILE = {
  id: 'user-target',
  display_name: '林偉明',
  avatar_url: null,
  bio: '台北抱石愛好者 · V5 路線中',
  privacy_setting: 'public',
};

const HISTORY = [
  { ascent_id: 'a1', route_id: 'r1', gym_id: 'g1', gym_name: '紅石攀岩館', grade: 'V5', color_tag: 'red', section_label: '蜘蛛網區', photo_url: null, style: 'flash', attempts: 1, note: null, logged_at: '2026-10-20T10:30:00Z', is_private: false },
  { ascent_id: 'a2', route_id: 'r2', gym_id: 'g1', gym_name: '紅石攀岩館', grade: 'V4', color_tag: 'blue', section_label: null, photo_url: null, style: 'top', attempts: 3, note: null, logged_at: '2026-10-18T14:00:00Z', is_private: false },
  { ascent_id: 'a3', route_id: 'r3', gym_id: 'g2', gym_name: '岩究所攀岩館', grade: 'V3', color_tag: 'green', section_label: null, photo_url: null, style: 'top', attempts: 2, note: null, logged_at: '2026-10-15T09:00:00Z', is_private: false },
];

type StubState = 'populated' | 'blocked' | 'blocked-by-target' | 'loading';

function setupStubs(state: StubState): void {
  resetStubData();
  setStubData('auth:session', { user: { id: ME } });
  if (state === 'loading') {
    ['users', 'blocks', 'rpc:get_profile_history'].forEach((k) => setStubData(k, STUB_PENDING));
    return;
  }
  setStubData('users', [PROFILE]);
  if (state === 'populated') {
    setStubData('rpc:get_profile_history', HISTORY);
  } else if (state === 'blocked') {
    setStubData('blocks', [{ blocker_user_id: ME, blocked_user_id: 'user-target' }]);
    setStubData('rpc:get_profile_history', HISTORY);
  } else {
    // isBlocked() is true in either direction; history is empty (server privacy gate).
    setStubData('blocks', [{ blocker_user_id: 'user-target', blocked_user_id: ME }]);
  }
}

function WithStubs({ state, children }: { state: StubState; children: React.ReactNode }): React.JSX.Element {
  setupStubs(state);
  return <>{children}</>;
}

type Args = { state: StubState };

const meta: Meta<Args> = {
  title: 'Pages/Profile/Other User Profile (dead code)',
  component: OtherUserProfileScreen as never, // real component; story args only drive the stub data
  tags: ['!dev', '!autodocs'], // page-review §6 #7: dead code, hidden from sidebar, file kept
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
  render: (args) => (
    <OtherUserProfileScreen key={args.state} userId="user-target" session={fakeSession} onBack={fn()} />
  ),
};
export default meta;

type Story = StoryObj<Args>;

/** Public profile: avatar, name, bio, send history, Block + Report buttons. */
export const Populated: Story = { args: { state: 'populated' } };

/** Viewer has blocked the target: unblock notice row, history still visible. */
export const Blocked: Story = { args: { state: 'blocked' } };

/** Blocked by the target: same unblock row (isBlocked checks both directions), history empty. */
export const BlockedByTarget: Story = { args: { state: 'blocked-by-target' } };

/** Fetch in flight (queries never resolve). */
export const Loading: Story = { args: { state: 'loading' } };
