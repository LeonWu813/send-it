/**
 * Storybook stories for ProfileHistoryScreen (MOD-008).
 *
 * Fake data only — the Supabase stub (stubs/supabase.ts) intercepts all
 * network calls. `setStubData` seeds each story's expected RPC rows.
 *
 * Stories:
 *   Loading       — static Spinner, matching the screen's loading-state UI.
 *   Populated     — StatsPanel + grade tabs + 4 route cards (4-5 ascents).
 *   Empty         — zero-records state: single EmptyState prompt (AC-061).
 *   FilteredEmpty — hasRecords=true, no flash/top sends: route card list is
 *                   empty (grade tab shows "All", inline empty state renders).
 */

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';
import { View } from 'react-native';

import { resetStubData, setStubData } from '../../../../.storybook/stubs/supabase';
import { Spinner } from '../../../components/ui';
import { useTheme } from '../../../lib/theme';
import ProfileHistoryScreen from '../screens/ProfileHistoryScreen';
import { GRADE_ORDER } from '../types';

// ── Fake data ──────────────────────────────────────────────────────────────────

/** 4 flash/top sends across 2 gyms (V2/V3/V4/V5) + 1 attempt (V6, excluded from route cards). */
const MOCK_ASCENTS = [
  {
    ascent_id: 'a1', route_id: 'r1', gym_id: 'g1', gym_name: 'Boulder Planet',
    grade: 'V4', color_tag: 'blue', section_label: 'Cave', photo_url: null,
    style: 'flash', attempts: 1, note: null,
    logged_at: '2026-10-20T14:00:00Z', is_private: true,
  },
  {
    ascent_id: 'a2', route_id: 'r2', gym_id: 'g1', gym_name: 'Boulder Planet',
    grade: 'V3', color_tag: 'red', section_label: null, photo_url: null,
    style: 'top', attempts: 3, note: null,
    logged_at: '2026-10-19T12:00:00Z', is_private: true,
  },
  {
    ascent_id: 'a3', route_id: 'r3', gym_id: 'g2', gym_name: 'Camp 4 Climbing',
    grade: 'V5', color_tag: 'green', section_label: null, photo_url: null,
    style: 'top', attempts: 5, note: null,
    logged_at: '2026-10-18T10:00:00Z', is_private: true,
  },
  {
    ascent_id: 'a4', route_id: 'r4', gym_id: 'g1', gym_name: 'Boulder Planet',
    grade: 'V2', color_tag: 'yellow', section_label: null, photo_url: null,
    style: 'flash', attempts: 1, note: null,
    logged_at: '2026-10-17T09:00:00Z', is_private: true,
  },
  {
    ascent_id: 'a5', route_id: 'r5', gym_id: 'g2', gym_name: 'Camp 4 Climbing',
    grade: 'V6', color_tag: 'purple', section_label: 'Overhang', photo_url: null,
    style: 'attempt', attempts: 8, note: null,
    logged_at: '2026-10-16T08:00:00Z', is_private: true,
  },
];

/** Stats matching MOCK_ASCENTS: 4 sends, 4 accumulated days, highest V5. */
const MOCK_STATS = {
  total_sends: 4,
  sends_by_grade: GRADE_ORDER.map((g) => ({
    grade: g,
    count: (['V2', 'V3', 'V4', 'V5'] as string[]).includes(g) ? 1 : 0,
  })),
  accumulated_days: 4,
  highest_grade: 'V5',
};

/** Two attempt-only ascents: groupToRouteCards skips them, so routeCards is empty while hasRecords=true. */
const ATTEMPT_ASCENTS = [
  {
    ascent_id: 'b1', route_id: 'r10', gym_id: 'g1', gym_name: 'Boulder Planet',
    grade: 'V7', color_tag: 'black', section_label: null, photo_url: null,
    style: 'attempt', attempts: 12, note: null,
    logged_at: '2026-10-20T09:00:00Z', is_private: true,
  },
  {
    ascent_id: 'b2', route_id: 'r11', gym_id: 'g1', gym_name: 'Boulder Planet',
    grade: 'V8', color_tag: 'white', section_label: 'Overhang', photo_url: null,
    style: 'attempt', attempts: 20, note: null,
    logged_at: '2026-10-19T11:00:00Z', is_private: true,
  },
];

const ZERO_STATS = {
  total_sends: 0,
  sends_by_grade: GRADE_ORDER.map((g) => ({ grade: g, count: 0 })),
  accumulated_days: 0,
  highest_grade: null,
};

// ── Meta ──────────────────────────────────────────────────────────────────────

const meta: Meta = {
  title: 'Profile/ProfileHistoryScreen',
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

// ── Loading ───────────────────────────────────────────────────────────────────

/**
 * Loading — static Spinner matching what ProfileHistoryScreen renders while
 * `visibility === 'loading'`. The Supabase stub resolves synchronously so the
 * screen is shown as a static composition.
 */
export const Loading: Story = {
  decorators: [
    (Story) => {
      resetStubData();
      return <Story />;
    },
  ],
  render: () => <LoadingShell />,
};

function LoadingShell(): React.JSX.Element {
  const { theme } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.background,
      }}
    >
      <Spinner />
    </View>
  );
}

// ── Populated ─────────────────────────────────────────────────────────────────

/**
 * Populated — StatsPanel with 4 sends (V2 flash, V3 top, V4 flash, V5 top),
 * grade tabs (All / V2 / V3 / V4 / V5), and four route cards. The fifth
 * ascent (V6 attempt) is excluded from route cards by groupToRouteCards.
 *
 * Switch the grade tab chips to see per-grade filtered views.
 */
export const Populated: Story = {
  decorators: [
    (Story) => {
      resetStubData();
      setStubData('rpc:get_profile_history', MOCK_ASCENTS);
      setStubData('rpc:get_profile_stats', MOCK_STATS);
      return <Story />;
    },
  ],
  render: () => (
    <ProfileHistoryScreen
      userId="user-123"
      isOwnProfile
      onNavigateToRoute={() => {}}
      onLogSend={() => {}}
    />
  ),
};

// ── Empty ─────────────────────────────────────────────────────────────────────

/**
 * Empty — own profile with no ascent records at all. The StatsPanel is
 * replaced by a single EmptyState prompt with an "onLogSend" button (AC-061
 * zero-records state: one prompt replaces the stats AND the history section).
 */
export const Empty: Story = {
  decorators: [
    (Story) => {
      resetStubData();
      setStubData('rpc:get_profile_history', []);
      setStubData('rpc:get_profile_stats', ZERO_STATS);
      return <Story />;
    },
  ],
  render: () => (
    <ProfileHistoryScreen
      userId="user-123"
      isOwnProfile
      onLogSend={() => {}}
    />
  ),
};

// ── FilteredEmpty ─────────────────────────────────────────────────────────────

/**
 * FilteredEmpty — attempt-only ascents: hasRecords=true but groupToRouteCards
 * yields no route cards, so the grade tab shows only "All" and the list renders
 * the inline EmptyState (sends attempted, none completed yet).
 */
export const FilteredEmpty: Story = {
  decorators: [
    (Story) => {
      resetStubData();
      setStubData('rpc:get_profile_history', ATTEMPT_ASCENTS);
      setStubData('rpc:get_profile_stats', ZERO_STATS);
      return <Story />;
    },
  ],
  render: () => (
    <ProfileHistoryScreen
      userId="user-123"
      isOwnProfile
      onLogSend={() => {}}
    />
  ),
};
