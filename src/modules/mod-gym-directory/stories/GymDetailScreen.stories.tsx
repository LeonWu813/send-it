/**
 * Pages/Gyms/Gym Detail: gym detail with cover photo, map pin and the "View Routes" CTA (AC-005).
 * Renders inside PhoneFrame (real AppHeader + TabBar, gyms tab active).
 *
 * Error: the screen shows its block error when the gym row is missing (not found).
 */

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';

import { withPhoneFrame } from '../../../../.storybook/PhoneFrame';
import { resetStubData, setStubData, STUB_PENDING } from '../../../../.storybook/stubs/supabase';
import GymDetailScreen from '../screens/GymDetailScreen';
import type { Gym } from '../types';

// ── Fixture ───────────────────────────────────────────────────────────────────

const GYM_FIXTURE: Gym = {
  id: 'gym-001',
  name: 'MegaSTONE Climbing Gym',
  name_zh: 'MegaSTONE 巨石攀岩館',
  branch_label: null,
  city: 'New Taipei',
  city_zh: '新北市',
  district: 'Xinzhuang',
  district_zh: '新莊區',
  address_text: '248 新北市新莊區中正路 500 號',
  lat: 25.040,
  lng: 121.448,
  gym_type: 'bouldering',
  photo_url: null,
  cover_photo_url: 'https://placehold.co/390x200/cccccc/888888?text=MegaSTONE',
  google_place_id: null,
  official_grading_system: 'V',
  bouldering_only_note: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

type StubState = 'populated' | 'loading' | 'error';

function setupStubs(state: StubState): void {
  resetStubData();
  setStubData('auth:session', { user: { id: 'story-user-me' } });
  if (state === 'loading') {
    setStubData('gyms', STUB_PENDING);
    setStubData('saved_gyms', STUB_PENDING);
  } else if (state === 'populated') {
    // loadGym uses .single(): the stub returns the first element
    setStubData('gyms', [GYM_FIXTURE]);
    setStubData('saved_gyms', [{ gym_id: 'gym-001' }]);
  }
  // error: no gym row -> the screen's not-found block error
}

/** Seed stubs synchronously so the screen's first fetch sees the data. */
function WithStubs({ state, children }: { state: StubState; children: React.ReactNode }): React.JSX.Element {
  setupStubs(state);
  return <>{children}</>;
}

type Args = { state: StubState };

const meta: Meta<Args> = {
  title: 'Pages/Gyms/Gym Detail',
  component: GymDetailScreen as never,
  tags: ['!autodocs'],
  parameters: { layout: 'centered', page: { tab: 'gyms' } },
  decorators: [
    (Story, ctx) => (
      <WithStubs state={(ctx.args as Args).state}>
        <Story />
      </WithStubs>
    ),
    withPhoneFrame,
  ],
  argTypes: { state: { control: false } },
  render: () => (
    <GymDetailScreen
      gymId="gym-001"
      onBack={() => console.log('onBack')}
      onViewRoutes={(gymId, gymName) => console.log('onViewRoutes', gymId, gymName)}
    />
  ),
};
export default meta;

type Story = StoryObj<Args>;

/** Full gym record, saved bookmark, "View Routes" CTA. */
export const Populated: Story = { args: { state: 'populated' } };

/** Initial fetch never resolves: detail skeleton. */
export const Loading: Story = { args: { state: 'loading' } };

/** Gym not found / failed to load: block error. */
export const Error: Story = { args: { state: 'error' } };
