/**
 * GymDetailScreen stories — gym detail page with cover photo, map pin, and
 * the "View Routes" CTA (AC-005).
 *
 * States:
 *  Populated   — full gym record, bookmark saved, "View Routes" CTA visible
 *  Loading     — skeleton shown during the initial fetch
 *  Error       — block error when the fetch fails
 *
 * Navigation: this module uses custom state-machine navigation — no
 * @react-navigation/native hooks are used or mocked.
 */

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';
import { View } from 'react-native';

import { resetStubData, setStubData } from '../../../../.storybook/stubs/supabase';
import { InlineError, Skeleton, SkeletonGroup } from '../../../components/ui';
import { useLayout, useTheme } from '../../../lib/theme';
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

// ── Shared frame ──────────────────────────────────────────────────────────────

function ScreenFrame({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <View style={{ width: 390, height: 844 }}>{children}</View>;
}

// ── Meta ──────────────────────────────────────────────────────────────────────

const meta: Meta = {
  title: 'GymDirectory/GymDetailScreen',
  parameters: { layout: 'fullscreen' },
  decorators: [(Story) => <ScreenFrame><Story /></ScreenFrame>],
};
export default meta;
type Story = StoryObj;

// ── Populated ─────────────────────────────────────────────────────────────────
// Full gym record: name, address, cover photo, Google attribution, saved bookmark,
// and the "View Routes" CTA at the bottom (AC-005, AC-120, AC-121, AC-196).

export const Populated: Story = {
  decorators: [
    (Story) => {
      resetStubData();
      // loadGym uses .single() — the stub returns the first element of the array
      setStubData('gyms', [GYM_FIXTURE]);
      // gym-001 is saved — bookmark shows filled
      setStubData('saved_gyms', [{ gym_id: 'gym-001' }]);
      return <Story />;
    },
  ],
  render: () => (
    <GymDetailScreen
      gymId="gym-001"
      onBack={() => console.log('onBack')}
      onViewRoutes={(gymId, gymName) => console.log('onViewRoutes', gymId, gymName)}
    />
  ),
};

// ── Loading Skeleton ──────────────────────────────────────────────────────────
// Shows the skeleton rendered during the initial gym-detail fetch.

function LoadingShell(): React.JSX.Element {
  const { theme } = useTheme();
  const { screenMargin } = useLayout();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.colors.background,
        paddingHorizontal: screenMargin,
        paddingTop: theme.spacing.sm,
      }}
    >
      <SkeletonGroup label="Loading gym detail">
        <Skeleton shape="card" surface="page" height={160} />
        <Skeleton shape="text" textVariant="title1" width="70%" surface="page" />
        <Skeleton shape="text" textVariant="title3" width="45%" surface="page" />
        <Skeleton shape="text" textVariant="title3" width="30%" surface="page" />
        <Skeleton shape="text" textVariant="body" width="60%" surface="page" />
        <Skeleton shape="text" textVariant="body" width="80%" surface="page" />
      </SkeletonGroup>
    </View>
  );
}

export const Loading: Story = {
  render: () => <LoadingShell />,
};

// ── Error ─────────────────────────────────────────────────────────────────────
// Block error shown when the gym-detail fetch fails.

function ErrorShell(): React.JSX.Element {
  const { theme } = useTheme();
  const { screenMargin } = useLayout();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.colors.background,
        paddingHorizontal: screenMargin,
        paddingTop: theme.spacing.sm,
      }}
    >
      <InlineError
        variant="block"
        message="Gym details could not be loaded. Please try again."
        actionLabel="Retry"
        onAction={() => console.log('retry')}
      />
    </View>
  );
}

export const Error: Story = {
  render: () => <ErrorShell />,
};
