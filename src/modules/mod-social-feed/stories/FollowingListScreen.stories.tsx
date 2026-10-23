/**
 * Storybook stories for FollowingListScreen (MOD-006, AC-147, AC-148).
 *
 * States:
 *   Loading   — loading spinner while following list is in flight
 *   Populated — 3 following-user cards (circular avatar + display_name only — AC-148)
 *   Empty     — no one followed yet (first-use empty state)
 *
 * No real Supabase calls — all service functions go through the Storybook
 * supabase stub (`.storybook/stubs/supabase.ts`).
 *
 * The 'follows' stub data must include a `users` property on each row because
 * fetchFollowingList reads `row.users` from the joined PostgREST response.
 * fetchBlockedUserIds returns an empty Set by default (no auth session in stub).
 */

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';
import { View } from 'react-native';

import { resetStubData, setStubData } from '../../../../.storybook/stubs/supabase';
import { useTheme } from '../../../lib/theme';
import { Spinner } from '../../../components/ui';
import FollowingListScreen from '../screens/FollowingListScreen';

// ── Constants ─────────────────────────────────────────────────────────────────

const VIEWED_USER_ID = 'story-user-alice';

/**
 * Stub rows that mimic the PostgREST embedded-join shape returned by:
 *   supabase.from('follows').select('followee_id, users!follows_followee_id_fkey(...)')
 *
 * fetchFollowingList reads row.users to build each UserListItem.
 */
const FOLLOWING_ROWS = [
  { followee_id: 'user-010', users: { id: 'user-010', display_name: 'Jason Huang', avatar_url: null } },
  { followee_id: 'user-011', users: { id: 'user-011', display_name: 'Sarah Park', avatar_url: null } },
  { followee_id: 'user-012', users: { id: 'user-012', display_name: 'Chen Wei', avatar_url: null } },
];

// ── Visual wrapper for loading state ──────────────────────────────────────────

/** Mirrors FollowingListScreen's loading branch: spinner centred on background. */
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
  title: 'SocialFeed/FollowingListScreen',
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

/** Loading spinner — shown while fetchFollowingList is in flight. */
export const Loading: StoryObj = {
  render: () => {
    resetStubData();
    return <LoadingWrapper />;
  },
};

/**
 * Populated list — 3 following-user cards showing circular avatar and display_name only.
 * No per-card sends count or highest grade (AC-148).
 */
export const Populated: StoryObj = {
  render: () => {
    resetStubData();
    setStubData('follows', FOLLOWING_ROWS);
    return (
      <FollowingListScreen
        userId={VIEWED_USER_ID}
        onBack={() => {}}
        onNavigateToUser={() => {}}
      />
    );
  },
};

/**
 * Empty state — not following anyone yet.
 * Shows the first-use empty state with a followers icon and prompt text.
 */
export const Empty: StoryObj = {
  render: () => {
    resetStubData();
    setStubData('follows', []);
    return (
      <FollowingListScreen
        userId={VIEWED_USER_ID}
        onBack={() => {}}
        onNavigateToUser={() => {}}
      />
    );
  },
};
