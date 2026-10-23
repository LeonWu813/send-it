/**
 * Pages/Profile/Profile History (MOD-008): the pushed view opened from the compact StatsPanel
 * (page-review P-1): nested header (back + title), the full StatsPanel and the sends list.
 * Fake data only; the Supabase stub intercepts the RPCs. Rendered as an AppShell overlay.
 * No Error story: the stub cannot make an RPC fail.
 */

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';

import { resetStubData, setStubData, STUB_PENDING } from '../../../../.storybook/stubs/supabase';
import { withPhoneFrame } from '../../../../.storybook/PhoneFrame';
import ProfileHistoryView from '../screens/ProfileHistoryView';
import { GRADE_ORDER } from '../types';

const ME = 'story-user-me';

const row = (
  n: number,
  gym: [string, string],
  grade: string,
  color: string,
  style: string,
  attempts: number,
  daysAgo: number,
  section: string | null = null,
) => ({
  ascent_id: `a${n}`, route_id: `r${n}`, gym_id: gym[0], gym_name: gym[1],
  grade, color_tag: color, section_label: section, photo_url: null,
  style, attempts, note: null,
  logged_at: new Date(Date.now() - daysAgo * 86_400_000).toISOString(), is_private: true,
});

const RED_ROCK: [string, string] = ['g1', '紅石攀岩館'];
const B_PUMP: [string, string] = ['g2', 'B-Pump 台北店'];

/** 4 flash/top sends across 2 gyms (V2/V3/V4/V5) + 1 attempt (V6, excluded from route cards). */
const MOCK_ASCENTS = [
  row(1, RED_ROCK, 'V4', 'blue', 'flash', 1, 1, 'Cave'),
  row(2, RED_ROCK, 'V3', 'red', 'top', 3, 2),
  row(3, B_PUMP, 'V5', 'green', 'top', 5, 3),
  row(4, RED_ROCK, 'V2', 'yellow', 'flash', 1, 4),
  row(5, B_PUMP, 'V6', 'purple', 'attempt', 8, 5, '懸岩區'),
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

const ZERO_STATS = {
  total_sends: 0,
  sends_by_grade: GRADE_ORDER.map((g) => ({ grade: g, count: 0 })),
  accumulated_days: 0,
  highest_grade: null,
};

type StubState = 'populated' | 'empty' | 'attemptsOnly' | 'loading';

function setupStubs(state: StubState): void {
  resetStubData();
  setStubData('auth:session', { user: { id: ME } });
  if (state === 'loading') {
    setStubData('rpc:get_profile_history', STUB_PENDING);
    setStubData('rpc:get_profile_stats', STUB_PENDING);
  } else if (state === 'populated') {
    setStubData('rpc:get_profile_history', MOCK_ASCENTS);
    setStubData('rpc:get_profile_stats', MOCK_STATS);
  } else if (state === 'attemptsOnly') {
    setStubData('rpc:get_profile_history', [row(10, RED_ROCK, 'V7', 'black', 'attempt', 12, 1), row(11, RED_ROCK, 'V8', 'white', 'attempt', 20, 2, '懸岩區')]);
    setStubData('rpc:get_profile_stats', ZERO_STATS);
  } else {
    setStubData('rpc:get_profile_history', []);
    setStubData('rpc:get_profile_stats', ZERO_STATS);
  }
}

/** Seed stubs synchronously so the screen's first fetch sees the data. */
function WithStubs({ state, children }: { state: StubState; children: React.ReactNode }): React.JSX.Element {
  setupStubs(state);
  return <>{children}</>;
}

/** The pushed view, as AppShell mounts it from the compact StatsPanel. */
function Host(): React.JSX.Element {
  return <ProfileHistoryView userId={ME} isOwnProfile onBack={() => {}} onNavigateToRoute={() => {}} onLogSend={() => {}} />;
}

type Args = { state: StubState };

const meta: Meta<Args> = {
  title: 'Pages/Profile/Profile History',
  component: ProfileHistoryView as never, // real component; story args only drive the stub data
  tags: ['!autodocs'],
  parameters: { layout: 'centered', page: { tab: 'profile', overlay: true } },
  decorators: [
    (Story, ctx) => (
      <WithStubs state={(ctx.args as Args).state}>
        <Story />
      </WithStubs>
    ),
    withPhoneFrame,
  ],
  argTypes: { state: { control: false } },
  render: () => <Host />,
};
export default meta;

type Story = StoryObj<Args>;

/** StatsPanel, grade tabs (All / V2-V5) and four route cards; the V6 attempt is excluded from the cards. */
export const Populated: Story = { args: { state: 'populated' } };

/** Own profile with no records: one EmptyState prompt replaces stats and history (AC-061). */
export const Empty: Story = { args: { state: 'empty' } };

/** Attempt-only ascents: records exist but no sends, so the list shows the inline empty state. */
export const AttemptsOnly: Story = { args: { state: 'attemptsOnly' } };

/** Queries never resolve: the screen's loading spinner. */
export const Loading: Story = { args: { state: 'loading' } };
