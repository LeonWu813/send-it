/**
 * Pages/Gyms/Gym List: gym directory list with search and filter (AC-122, AC-197).
 * Renders inside PhoneFrame (real AppHeader + TabBar, gyms tab active).
 *
 * The stub cannot return errors, so the Error story waits for the 10s loading timeout (E4).
 */

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';

import { withPhoneFrame } from '../../../../.storybook/PhoneFrame';
import { resetStubData, setStubData, STUB_PENDING } from '../../../../.storybook/stubs/supabase';
import GymListScreen from '../screens/GymListScreen';
import type { GymSummary } from '../types';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const GYM_FIXTURES: GymSummary[] = [
  {
    id: 'gym-001',
    name: 'MegaSTONE Climbing Gym',
    name_zh: 'MegaSTONE 巨石攀岩館',
    branch_label: null,
    city: 'New Taipei',
    city_zh: '新北市',
    district: 'Xinzhuang',
    district_zh: '新莊區',
    gym_type: 'bouldering',
    photo_url: null,
    cover_photo_url: null,
  },
  {
    id: 'gym-002',
    name: 'T-UP 原岩攀岩館',
    name_zh: '原岩攀岩館',
    branch_label: '萬華',
    city: 'Taipei',
    city_zh: '台北市',
    district: 'Wanhua',
    district_zh: '萬華區',
    gym_type: 'bouldering',
    photo_url: null,
    cover_photo_url: null,
  },
  {
    id: 'gym-003',
    name: 'CORNER 角攀岩館',
    name_zh: '角攀岩館',
    branch_label: '中山店',
    city: 'Taipei',
    city_zh: '台北市',
    district: 'Zhongshan',
    district_zh: '中山區',
    gym_type: 'bouldering',
    photo_url: null,
    // AC-197: cover photo triggers the "Photos from Google" attribution label
    cover_photo_url: 'https://placehold.co/56x56/cccccc/888888?text=CO',
  },
  {
    id: 'gym-004',
    name: 'double8 岩究所',
    name_zh: 'double8 岩究所',
    branch_label: null,
    city: 'Taipei',
    city_zh: '台北市',
    district: 'Datong',
    district_zh: '大同區',
    gym_type: 'both',
    photo_url: null,
    cover_photo_url: null,
  },
  {
    id: 'gym-005',
    name: 'RedRock 紅石攀岩',
    name_zh: '紅石攀岩',
    branch_label: '士林',
    city: 'Taipei',
    city_zh: '台北市',
    district: 'Shilin',
    district_zh: '士林區',
    gym_type: 'bouldering',
    photo_url: null,
    cover_photo_url: null,
  },
];

type StubState = 'populated' | 'empty' | 'filtered' | 'loading';

function setupStubs(state: StubState): void {
  resetStubData();
  setStubData('auth:session', { user: { id: 'story-user-me' } });
  if (state === 'loading') {
    setStubData('gyms', STUB_PENDING);
    setStubData('saved_gyms', STUB_PENDING);
  } else if (state === 'filtered') {
    // Taipei-only directory: the New Taipei chip (pressed by the story) excludes everything
    setStubData('gyms', GYM_FIXTURES.filter((g) => g.city === 'Taipei'));
    setStubData('saved_gyms', []);
  } else if (state === 'populated') {
    setStubData('gyms', GYM_FIXTURES);
    // gym-001 is saved: it floats to the top and shows the bookmark indicator
    setStubData('saved_gyms', [{ gym_id: 'gym-001' }]);
  }
}

/** Seed stubs synchronously so the screen's first fetch sees the data. */
function WithStubs({ state, children }: { state: StubState; children: React.ReactNode }): React.JSX.Element {
  setupStubs(state);
  return <>{children}</>;
}

type Args = { state: StubState };

const meta: Meta<Args> = {
  title: 'Pages/Gyms/Gym List',
  component: GymListScreen as never,
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
    <GymListScreen
      onSelectGym={(id) => console.log('onSelectGym', id)}
      onRequestGym={() => console.log('onRequestGym')}
    />
  ),
};
export default meta;

type Story = StoryObj<Args>;

/** 5 gyms; gym-001 saved (bookmark), gym-003 has a cover photo (Google attribution). */
export const Populated: Story = { args: { state: 'populated' } };

/** E1 page empty: the directory has no gyms. No search controls; the icon disc sits 48 below the header. */
export const Empty: Story = { args: { state: 'empty' } };

/** E3 filtered empty: the New Taipei chip is pressed on a Taipei-only directory; controls stay, the anchor is the chip row. */
export const Filtered: Story = {
  args: { state: 'filtered' },
  play: async ({ canvasElement }) => {
    await new Promise((r) => setTimeout(r, 1500));
    const nodes = Array.from(canvasElement.querySelectorAll<HTMLElement>('[role="button"], [role="checkbox"]'));
    nodes.find((n) => /(新北市|New Taipei)/.test(n.textContent ?? '') && n.getAttribute('role') === 'checkbox')?.click();
  },
};

/** First load (queries never resolve): the one full-page PageLoading spinner. Appears after the 300ms delay. */
export const Loading: Story = { args: { state: 'loading' } };

/** E4 page error. Appears 10s after the Loading story starts (queries never resolve); Retry with the reload icon. */
export const Error: Story = { args: { state: 'loading' } };
