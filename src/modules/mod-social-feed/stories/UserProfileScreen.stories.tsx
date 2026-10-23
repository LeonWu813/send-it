/**
 * Pages/Profile/User Profile (AC-050, AC-063, AC-149, AC-150, AC-152, AC-153, AC-163).
 * Fake data only; the supabase stub never touches the network.
 */

import type { Session } from '@supabase/supabase-js';
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';

import { withPhoneFrame } from '../../../../.storybook/PhoneFrame';
import { resetStubData, setStubData, STUB_PENDING } from '../../../../.storybook/stubs/supabase';
import UserProfileScreen from '../screens/UserProfileScreen';

// ── Mock session & user IDs ───────────────────────────────────────────────────

const OWN_USER_ID = 'story-user-me';
const TARGET_USER_ID = 'story-user-alice';
const MOCK_SESSION = { user: { id: OWN_USER_ID } } as unknown as Session;

// ── Seed helpers ──────────────────────────────────────────────────────────────

const ALICE_PROFILE = {
  id: TARGET_USER_ID,
  display_name: '陳怡君',
  avatar_url: null,
  bio: '台北抱石愛好者，2019 年開始攀岩',
  privacy_setting: 'public' as const,
};

const PRIVATE_ALICE_PROFILE = {
  ...ALICE_PROFILE,
  privacy_setting: 'followers_only' as const,
};

const OWN_PROFILE = {
  id: OWN_USER_ID,
  display_name: '我',
  avatar_url: null,
  bio: '住在台北的 V5 攀岩者',
  privacy_setting: 'public' as const,
};

const FOLLOWER_COUNTS = { follower_count: 127, following_count: 44 };

const PROFILE_STATS = {
  total_sends: 42,
  accumulated_days: 18,
  highest_grade: 'V6',
  sends_by_grade: [
    { grade: 'VB', count: 0 },
    { grade: 'V0', count: 2 },
    { grade: 'V1', count: 8 },
    { grade: 'V2', count: 10 },
    { grade: 'V3', count: 9 },
    { grade: 'V4', count: 7 },
    { grade: 'V5', count: 4 },
    { grade: 'V6', count: 2 },
    { grade: 'V7', count: 0 },
    { grade: 'V8', count: 0 },
    { grade: 'V9', count: 0 },
    { grade: 'V10', count: 0 },
  ],
};

const meta: Meta = {
  title: 'Pages/Profile/User Profile',
  component: UserProfileScreen as never,
  tags: ['!autodocs'],
  // AppShell renders this as a climber-profile overlay (AC-182).
  parameters: { layout: 'centered', page: { overlay: true } },
  decorators: [withPhoneFrame],
};
export default meta;

type Seed = 'other' | 'own' | 'private' | 'loading';

function seed(kind: Seed): void {
  resetStubData();
  setStubData('auth:session', { user: { id: OWN_USER_ID } });
  if (kind === 'loading') {
    ['users', 'rpc:get_follower_counts', 'rpc:get_profile_stats', 'follows', 'beta_videos'].forEach((k) =>
      setStubData(k, STUB_PENDING),
    );
    return;
  }
  setStubData('users', [kind === 'own' ? OWN_PROFILE : kind === 'private' ? PRIVATE_ALICE_PROFILE : ALICE_PROFILE]);
  setStubData('rpc:get_follower_counts', kind === 'private' ? { follower_count: 89, following_count: 31 } : FOLLOWER_COUNTS);
  setStubData('rpc:get_profile_stats', PROFILE_STATS);
  // follows defaults to [] -> not following
}

const profile = (id: string): React.JSX.Element => (
  <UserProfileScreen targetUserId={id} session={MOCK_SESSION} onBack={() => {}} />
);

/** Another climber's public profile: Follow button, overflow menu, stats. */
export const Populated: StoryObj = {
  render: () => {
    seed('other');
    return profile(TARGET_USER_ID);
  },
};

/** Viewing your own profile: no Follow button, no overflow menu. */
export const OwnProfile: StoryObj = {
  name: 'Own Profile',
  render: () => {
    seed('own');
    return profile(OWN_USER_ID);
  },
};

/** followers_only profile viewed by a non-follower (AC-063/AC-064): beta-video grid hidden. */
export const PrivateProfile: StoryObj = {
  name: 'Private Profile',
  render: () => {
    seed('private');
    return profile(TARGET_USER_ID);
  },
};

/** Profile queries never resolve. */
export const Loading: StoryObj = {
  render: () => {
    seed('loading');
    return profile(TARGET_USER_ID);
  },
};

// No Error story: the error branch cannot be driven through the stub.
