/**
 * GymListScreen stories — gym directory list with search and filter.
 *
 * States:
 *  Populated   — 5 gyms (gym-001 saved, gym-003 has a cover photo)
 *  Empty       — no gyms match (empty stub)
 *  Loading     — skeleton cards shown during the initial fetch
 *  Error       — block error when the gym-list fetch fails
 *
 * Navigation: this module uses custom state-machine navigation — no
 * @react-navigation/native hooks are used or mocked.
 */

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';
import { View } from 'react-native';

import { resetStubData, setStubData } from '../../../../.storybook/stubs/supabase';
import { Card, InlineError, Skeleton, SkeletonGroup } from '../../../components/ui';
import { useLayout, useTheme } from '../../../lib/theme';
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

// ── Shared frame ──────────────────────────────────────────────────────────────

function ScreenFrame({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <View style={{ width: 390, height: 844 }}>{children}</View>;
}

// ── Meta ──────────────────────────────────────────────────────────────────────

const meta: Meta = {
  title: 'GymDirectory/GymListScreen',
  parameters: { layout: 'fullscreen' },
  decorators: [(Story) => <ScreenFrame><Story /></ScreenFrame>],
};
export default meta;
type Story = StoryObj;

// ── Populated ─────────────────────────────────────────────────────────────────
// 5 gyms; gym-001 shows the saved bookmark indicator (AC-122).
// gym-003 has a cover photo, triggering the "Photos from Google" attribution (AC-197).

export const Populated: Story = {
  decorators: [
    (Story) => {
      resetStubData();
      setStubData('gyms', GYM_FIXTURES);
      // gym-001 is saved — it floats to the top and shows the bookmark indicator
      setStubData('saved_gyms', [{ gym_id: 'gym-001' }]);
      return <Story />;
    },
  ],
  render: () => (
    <GymListScreen
      onSelectGym={(id) => console.log('onSelectGym', id)}
      onRequestGym={() => console.log('onRequestGym')}
    />
  ),
};

// ── Empty State ───────────────────────────────────────────────────────────────
// No gyms match — the EmptyState component is shown.

export const Empty: Story = {
  decorators: [
    (Story) => {
      resetStubData();
      setStubData('gyms', []);
      setStubData('saved_gyms', []);
      return <Story />;
    },
  ],
  render: () => (
    <GymListScreen
      onSelectGym={(id) => console.log('onSelectGym', id)}
      onRequestGym={() => console.log('onRequestGym')}
    />
  ),
};

// ── Loading Skeleton ──────────────────────────────────────────────────────────
// Shows the skeleton state rendered during the initial gym-list fetch.
// (The real screen transitions through this state on every mount.)

function LoadingShell(): React.JSX.Element {
  const { theme } = useTheme();
  const { screenMargin } = useLayout();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.colors.background,
        paddingHorizontal: screenMargin,
        paddingTop: theme.spacing.md,
      }}
    >
      <SkeletonGroup label="Loading gyms">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} style={{ marginBottom: theme.layout.cardGap }}>
            <Skeleton shape="text" textVariant="headline" width="60%" />
            <Skeleton shape="text" textVariant="footnote" width="30%" />
            <View style={{ marginTop: theme.spacing.xs }}>
              <Skeleton shape="text" textVariant="subhead" width="45%" />
            </View>
          </Card>
        ))}
      </SkeletonGroup>
    </View>
  );
}

export const Loading: Story = {
  render: () => <LoadingShell />,
};

// ── Error ─────────────────────────────────────────────────────────────────────
// Block error shown when the gym-list fetch fails.

function ErrorShell(): React.JSX.Element {
  const { theme } = useTheme();
  const { screenMargin } = useLayout();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.colors.background,
        paddingHorizontal: screenMargin,
        paddingTop: theme.spacing.md,
      }}
    >
      <InlineError
        variant="block"
        message="Gyms could not be loaded. Please try again."
        actionLabel="Retry"
        onAction={() => console.log('retry')}
      />
    </View>
  );
}

export const Error: Story = {
  render: () => <ErrorShell />,
};
