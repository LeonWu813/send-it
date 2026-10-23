/**
 * Storybook stories for UserProfileScreen (MOD-006, AC-050, AC-063, AC-149,
 * AC-150, AC-152, AC-153, AC-163).
 *
 * States:
 *   Loading          — loading spinner while profile data is in flight
 *   OwnProfile       — current user viewing their own profile (no Follow button,
 *                      no three-dots menu, stats section visible)
 *   OtherUserPublic  — public profile of another user (Follow button + ⋮ menu,
 *                      stats section, empty beta-video grid)
 *   PrivateProfile   — followers_only profile for a non-follower (AC-063/AC-064):
 *                      profile card visible but beta-video grid is hidden
 *
 * No real Supabase calls — all service functions go through the Storybook
 * supabase stub (`.storybook/stubs/supabase.ts`).
 */

import type { Session } from '@supabase/supabase-js';
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';
import { View } from 'react-native';

import { resetStubData, setStubData } from '../../../../.storybook/stubs/supabase';
import { useTheme } from '../../../lib/theme';
import { Spinner } from '../../../components/ui';
import UserProfileScreen from '../screens/UserProfileScreen';

// ── Mock session & user IDs ───────────────────────────────────────────────────

const OWN_USER_ID = 'story-user-me';
const TARGET_USER_ID = 'story-user-alice';
const MOCK_SESSION = { user: { id: OWN_USER_ID } } as unknown as Session;
const OWN_SESSION_AS_OWN = { user: { id: OWN_USER_ID } } as unknown as Session;

// ── Seed helpers ──────────────────────────────────────────────────────────────

const ALICE_PROFILE = {
  id: TARGET_USER_ID,
  display_name: 'Alice Chen',
  avatar_url: null,
  bio: '台北攀岩愛好者 · Taipei bouldering since 2019',
  privacy_setting: 'public' as const,
};

const PRIVATE_ALICE_PROFILE = {
  ...ALICE_PROFILE,
  privacy_setting: 'followers_only' as const,
};

const OWN_PROFILE = {
  id: OWN_USER_ID,
  display_name: 'Story User (Me)',
  avatar_url: null,
  bio: 'V5 climber based in Taipei',
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

// ── Visual wrapper for loading state ──────────────────────────────────────────

/** Mirrors UserProfileScreen's loading branch: spinner centred on background. */
function LoadingWrapper(): React.JSX.Element {
  const { theme } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: theme.colors.background,
      }}
    >
      <Spinner size="large" color="primary" accessibilityLabel="Loading" />
    </View>
  );
}

// ── Meta ──────────────────────────────────────────────────────────────────────

const meta: Meta = {
  title: 'SocialFeed/UserProfileScreen',
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

/** Loading spinner — shown while profile + stats data is in flight. */
export const Loading: StoryObj = {
  render: () => {
    resetStubData();
    return <LoadingWrapper />;
  },
};

/**
 * Own profile — session.user.id === targetUserId.
 * No Follow button, no three-dots (⋮) menu. Stats section and bio visible.
 */
export const OwnProfile: StoryObj = {
  render: () => {
    resetStubData();
    setStubData('users', [OWN_PROFILE]);
    setStubData('rpc:get_follower_counts', FOLLOWER_COUNTS);
    setStubData('rpc:get_profile_stats', PROFILE_STATS);
    return (
      <UserProfileScreen
        targetUserId={OWN_USER_ID}
        session={OWN_SESSION_AS_OWN}
        onBack={() => {}}
      />
    );
  },
};

/**
 * Other user's public profile — Follow button + three-dots (⋮) menu visible.
 * Stats section shown. Beta-video grid shows empty state (no videos in stub).
 */
export const OtherUserPublic: StoryObj = {
  render: () => {
    resetStubData();
    setStubData('users', [ALICE_PROFILE]);
    setStubData('rpc:get_follower_counts', FOLLOWER_COUNTS);
    setStubData('rpc:get_profile_stats', PROFILE_STATS);
    // follows stub returns [] by default → isFollowing = false
    return (
      <UserProfileScreen
        targetUserId={TARGET_USER_ID}
        session={MOCK_SESSION}
        onBack={() => {}}
      />
    );
  },
};

/**
 * Private (followers_only) profile for a non-follower (AC-063, AC-064).
 * Profile card and Follow button are visible; the beta-video grid is hidden
 * because the viewer is not yet a follower.
 */
export const PrivateProfile: StoryObj = {
  render: () => {
    resetStubData();
    setStubData('users', [PRIVATE_ALICE_PROFILE]);
    setStubData('rpc:get_follower_counts', { follower_count: 89, following_count: 31 });
    setStubData('rpc:get_profile_stats', PROFILE_STATS);
    // follows stub returns [] by default → isFollowing = false → video grid hidden
    return (
      <UserProfileScreen
        targetUserId={TARGET_USER_ID}
        session={MOCK_SESSION}
        onBack={() => {}}
      />
    );
  },
};
