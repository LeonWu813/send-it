/**
 * Storybook stories for FollowersListScreen (MOD-006, AC-146, AC-148).
 *
 * States:
 *   Loading   — loading spinner while followers list is in flight
 *   Populated — 3 follower cards (circular avatar + display_name only — AC-148)
 *   Empty     — no followers yet (first-use empty state)
 *
 * No real Supabase calls — all service functions go through the Storybook
 * supabase stub (`.storybook/stubs/supabase.ts`).
 *
 * The 'follows' stub data must include a `users` property on each row because
 * fetchFollowersList reads `row.users` from the joined PostgREST response.
 * fetchBlockedUserIds returns an empty Set by default (no auth session in stub).
 */

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';
import { View } from 'react-native';

import { resetStubData, setStubData } from '../../../../.storybook/stubs/supabase';
import { useTheme } from '../../../lib/theme';
import { Spinner } from '../../../components/ui';
import FollowersListScreen from '../screens/FollowersListScreen';

// ── Constants ─────────────────────────────────────────────────────────────────

const VIEWED_USER_ID = 'story-user-alice';

/**
 * Stub rows that mimic the PostgREST embedded-join shape returned by:
 *   supabase.from('follows').select('follower_id, users!follows_follower_id_fkey(...)')
 *
 * fetchFollowersList reads row.users to build each UserListItem.
 */
const FOLLOWER_ROWS = [
  { follower_id: 'user-001', users: { id: 'user-001', display_name: 'Bob Tsai', avatar_url: null } },
  { follower_id: 'user-002', users: { id: 'user-002', display_name: 'Mei Lin', avatar_url: null } },
  { follower_id: 'user-003', users: { id: 'user-003', display_name: 'Kevin Wu', avatar_url: null } },
];

// ── Visual wrapper for loading state ──────────────────────────────────────────

/** Mirrors FollowersListScreen's loading branch: spinner centred on background. */
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
  title: 'SocialFeed/FollowersListScreen',
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

/** Loading spinner — shown while fetchFollowersList is in flight. */
export const Loading: StoryObj = {
  render: () => {
    resetStubData();
    return <LoadingWrapper />;
  },
};

/**
 * Populated list — 3 follower cards showing circular avatar and display_name only.
 * No per-card sends count or highest grade (AC-148).
 */
export const Populated: StoryObj = {
  render: () => {
    resetStubData();
    setStubData('follows', FOLLOWER_ROWS);
    return (
      <FollowersListScreen
        userId={VIEWED_USER_ID}
        onBack={() => {}}
        onNavigateToUser={() => {}}
      />
    );
  },
};

/**
 * Empty state — no followers yet.
 * Shows the first-use empty state with a followers icon and prompt text.
 */
export const Empty: StoryObj = {
  render: () => {
    resetStubData();
    setStubData('follows', []);
    return (
      <FollowersListScreen
        userId={VIEWED_USER_ID}
        onBack={() => {}}
        onNavigateToUser={() => {}}
      />
    );
  },
};
