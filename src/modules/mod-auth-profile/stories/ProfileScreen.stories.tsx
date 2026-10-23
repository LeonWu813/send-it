/**
 * Stories for ProfileScreen.
 *
 * States:
 *   Skeleton     — session not yet resolved; profile is null; the header renders
 *                  with empty placeholder values (no avatar initials, no name, zero counts).
 *   Populated    — own profile fully loaded with display name, bio, follower/following
 *                  counts, and populated stats via the supabase stub.
 *   EmptyAscents — profile loaded but no sends recorded yet; stats show all zeroes and
 *                  the send-history list shows its empty-state placeholder.
 *
 * The supabase stub (aliased in Storybook by the supabaseStubPlugin) is seeded via
 * setStubData/resetStubData in each story's loaders, which run before the component
 * mounts. The useSession() hook then reads from the stub on mount.
 */

import type { Session } from '@supabase/supabase-js';
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';
import { View } from 'react-native';

// Importing directly from the stub path exposes setStubData/resetStubData which are
// not part of the production src/lib/supabase.ts API. This import is intentional and
// only works inside Storybook (Vite bundles from the stub file directly; the
// supabaseStubPlugin only redirects imports of src/lib/supabase via resolver, not
// direct stub imports).
import { resetStubData, setStubData } from '../../../../.storybook/stubs/supabase';

import ProfileScreen from '../screens/ProfileScreen';

// ── Shared fixtures ───────────────────────────────────────────────────────────

const STUB_USER_ID = 'story-user-me';

/** Minimal session object — only user.id is used by ProfileScreen (passed to BetaVideoReelViewer). */
const STUB_SESSION = { user: { id: STUB_USER_ID } } as unknown as Session;

// ── Meta ──────────────────────────────────────────────────────────────────────

const meta: Meta = {
  title: 'AuthProfile/ProfileScreen',
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

/**
 * Before the Supabase session resolves — profile is null.
 * The header shows an empty avatar placeholder, no display name, zero counts.
 * This is the loading/skeleton state the user sees for ~100–200 ms on first open.
 */
export const Skeleton: Story = {
  loaders: [
    async () => {
      resetStubData();
      return {};
    },
  ],
  render: () => (
    <ProfileScreen
      session={STUB_SESSION}
      onNavigateEditProfile={() => {}}
    />
  ),
};

/**
 * Own profile fully loaded — display name, bio, follower/following counts.
 * Stats (total sends, sends-by-grade chart) are seeded with realistic numbers.
 * The send-history list shows the empty-state placeholder (history rows are not seeded
 * in this story to keep the stub setup small; the focus is the profile header + stats panel).
 */
export const Populated: Story = {
  loaders: [
    async () => {
      resetStubData();

      // Seed auth session so useSession() resolves a logged-in user.
      setStubData('auth:session', {
        user: { id: STUB_USER_ID, email: 'leon@example.com' },
      });

      // Seed the users row so loadProfile() returns the user's profile.
      setStubData('users', [
        {
          id: STUB_USER_ID,
          display_name: 'Leon Wu',
          avatar_url: null,
          bio: '熱愛抱石，台北攀岩愛好者。V5 是我的目標。',
          privacy_setting: 'public',
          created_at: '2026-01-15T00:00:00Z',
        },
      ]);

      // Seed follower / following counts (fetchFollowerCounts → rpc:get_follower_counts).
      setStubData('rpc:get_follower_counts', {
        follower_count: 42,
        following_count: 17,
      });

      // Seed profile stats (get_profile_stats → rpc:get_profile_stats).
      setStubData('rpc:get_profile_stats', {
        total_sends: 85,
        sends_by_grade: [
          { grade: 'VB', count: 2 },
          { grade: 'V0', count: 8 },
          { grade: 'V1', count: 15 },
          { grade: 'V2', count: 20 },
          { grade: 'V3', count: 18 },
          { grade: 'V4', count: 12 },
          { grade: 'V5', count: 7 },
          { grade: 'V6', count: 3 },
          { grade: 'V7', count: 0 },
          { grade: 'V8', count: 0 },
          { grade: 'V9', count: 0 },
          { grade: 'V10', count: 0 },
        ],
        accumulated_days: 30,
        highest_grade: 'V6',
      });

      return {};
    },
  ],
  render: () => (
    <ProfileScreen
      session={STUB_SESSION}
      onNavigateEditProfile={() => {}}
    />
  ),
};

/**
 * Profile loaded but no sends recorded yet — the stats bar shows all zeroes and
 * the send-history section shows its empty-state placeholder (e.g. "No sends yet").
 */
export const EmptyAscents: Story = {
  loaders: [
    async () => {
      resetStubData();

      setStubData('auth:session', {
        user: { id: STUB_USER_ID, email: 'leon@example.com' },
      });

      setStubData('users', [
        {
          id: STUB_USER_ID,
          display_name: 'Leon Wu',
          avatar_url: null,
          bio: null,
          privacy_setting: 'public',
          created_at: '2026-01-15T00:00:00Z',
        },
      ]);

      setStubData('rpc:get_follower_counts', {
        follower_count: 0,
        following_count: 0,
      });

      // Zeroed stats — all grades have count 0.
      setStubData('rpc:get_profile_stats', {
        total_sends: 0,
        sends_by_grade: [
          'VB', 'V0', 'V1', 'V2', 'V3', 'V4',
          'V5', 'V6', 'V7', 'V8', 'V9', 'V10',
        ].map((grade) => ({ grade, count: 0 })),
        accumulated_days: 0,
        highest_grade: null,
      });

      return {};
    },
  ],
  render: () => (
    <ProfileScreen
      session={STUB_SESSION}
      onNavigateEditProfile={() => {}}
    />
  ),
};
