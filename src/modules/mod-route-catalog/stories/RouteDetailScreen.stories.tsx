import type { Session } from '@supabase/supabase-js';
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';
import { View } from 'react-native';

import { setStubData } from '../../../../.storybook/stubs/supabase';
import RouteDetailScreen from '../screens/RouteDetailScreen';
import type { Route } from '../types';

// Off-spec design tooling. Fake data only; the supabase stub resolves all queries.

const session = { user: { id: 'user-me' } } as unknown as Session;

const ACTIVE_ROUTE: Route = {
  id: 'route-1',
  gym_id: 'gym-1',
  grade: 'V4',
  color_tag: 'red',
  section_label: 'Cave',
  photo_url: '',
  status: 'active',
  submitted_by_user_id: 'user-me',
  created_at: new Date(2026, 7, 15).toISOString(),
  retired_at: null,
  retired_by_user_id: null,
};

const RETIRED_ROUTE: Route = {
  ...ACTIVE_ROUTE,
  id: 'route-retired',
  grade: 'V3',
  color_tag: 'blue',
  section_label: null,
  status: 'retired',
  retired_at: new Date(2026, 9, 1).toISOString(),
  retired_by_user_id: 'admin-user',
};

const ASCENTS = [
  { id: 'a1', route_id: 'route-1', user_id: 'user-me', style: 'flash', attempts: 1, note: null, logged_at: new Date(2026, 8, 10).toISOString(), is_private: false, users: { display_name: 'Me' } },
  { id: 'a2', route_id: 'route-1', user_id: 'user-me', style: 'top', attempts: 3, note: '第二次完攀', logged_at: new Date(2026, 8, 20).toISOString(), is_private: false, users: { display_name: 'Me' } },
];

function seedPopulated(): void {
  setStubData('routes', [ACTIVE_ROUTE]);
  setStubData('saved_routes', []);
  setStubData('ascents', ASCENTS);
  setStubData('auth:session', { user: { id: 'user-me' } });
}

function seedRetired(): void {
  setStubData('routes', [RETIRED_ROUTE]);
  setStubData('saved_routes', []);
  setStubData('ascents', []);
  setStubData('auth:session', { user: { id: 'user-me' } });
}

type ScreenState = 'populated' | 'retired';

interface PlaygroundArgs {
  state: ScreenState;
  isSaved: boolean;
}

function Screen({ routeId, gymName = '紅石攀岩館' }: { routeId: string; gymName?: string }): React.JSX.Element {
  return (
    <View style={{ width: 390, height: 780 }}>
      <RouteDetailScreen
        routeId={routeId}
        gymName={gymName}
        session={session}
        onBack={() => {}}
        onViewSendHistory={() => {}}
      />
    </View>
  );
}

function Seeded({ state, isSaved }: PlaygroundArgs): React.JSX.Element {
  if (state === 'retired') {
    seedRetired();
  } else {
    seedPopulated();
    if (isSaved) setStubData('saved_routes', [{ route_id: 'route-1' }]);
  }
  const routeId = state === 'retired' ? RETIRED_ROUTE.id : ACTIVE_ROUTE.id;
  return <Screen routeId={routeId} />;
}

const meta: Meta<PlaygroundArgs> = {
  title: 'Route Catalog/RouteDetailScreen',
  parameters: { layout: 'fullscreen' },
  args: { state: 'populated', isSaved: false },
  argTypes: {
    state: { control: 'inline-radio', options: ['populated', 'retired'] },
    isSaved: { control: 'boolean' },
  },
  render: (args) => <Seeded key={`${args.state}-${String(args.isSaved)}`} {...args} />,
};
export default meta;
type Story = StoryObj<PlaygroundArgs>;

/**
 * Toggle state between populated and retired. Toggle isSaved to see the filled
 * bookmark icon. In populated state: 2 sends (1 flash, 1 top) are shown in the
 * summary cards. The BetaVideoSection renders in its empty state (no videos seeded).
 */
export const Playground: Story = {};

/**
 * Active route: grade, color badge, gym subtitle, send summary (1 flash + 1 top = 2 sends,
 * 4 total attempts), action row (Record Send / Upload Beta Video), beta section, added-date footer.
 */
export const Populated: Story = {
  render: () => { seedPopulated(); return <Screen routeId={ACTIVE_ROUTE.id} />; },
};

/**
 * Retired route: shows the "Retired" status badge; the date and section label are absent
 * since `section_label` is null and `retired_at` is populated. No send summary (no ascents).
 */
export const RetiredRoute: Story = {
  render: () => { seedRetired(); return <Screen routeId={RETIRED_ROUTE.id} gymName="攀石山" />; },
};

/** Bookmarked route — the header bookmark icon is filled (yellow) on load. */
export const Bookmarked: Story = {
  render: () => {
    seedPopulated();
    setStubData('saved_routes', [{ route_id: ACTIVE_ROUTE.id }]);
    return <Screen routeId={ACTIVE_ROUTE.id} />;
  },
};
