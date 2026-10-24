import type { Session } from '@supabase/supabase-js';
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';

import { withPhoneFrame } from '../../../../.storybook/PhoneFrame';
import { resetStubData, setStubData, STUB_PENDING } from '../../../../.storybook/stubs/supabase';
import RouteDetailScreen from '../screens/RouteDetailScreen';
import type { Route } from '../types';

// Off-spec design tooling. Fake data only; the supabase stub resolves all queries.

const ME = 'story-user-me';
const session = { user: { id: ME } } as unknown as Session;

const ACTIVE_ROUTE: Route = {
  id: 'route-1',
  gym_id: 'gym-1',
  grade: 'V4',
  color_tag: 'red',
  section_label: 'Cave',
  photo_url: '',
  status: 'active',
  submitted_by_user_id: ME,
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
  { id: 'a1', route_id: 'route-1', user_id: ME, style: 'flash', attempts: 1, note: null, logged_at: new Date(2026, 8, 10).toISOString(), is_private: false, users: { display_name: '小明' } },
  { id: 'a2', route_id: 'route-1', user_id: ME, style: 'top', attempts: 3, note: '第二次完攀', logged_at: new Date(2026, 8, 20).toISOString(), is_private: false, users: { display_name: '小明' } },
];

type State = 'populated' | 'bookmarked' | 'retired' | 'loading' | 'error';

function seed(state: State): Route {
  resetStubData();
  setStubData('auth:session', { user: { id: ME } });
  setStubData('saved_routes', state === 'bookmarked' ? [{ route_id: ACTIVE_ROUTE.id }] : []);
  if (state === 'loading') {
    setStubData('routes', STUB_PENDING);
    return ACTIVE_ROUTE;
  }
  if (state === 'error') {
    // No matching route: the screen shows its "route not found" error block.
    setStubData('routes', []);
    return ACTIVE_ROUTE;
  }
  if (state === 'retired') {
    setStubData('routes', [RETIRED_ROUTE]);
    setStubData('ascents', []);
    return RETIRED_ROUTE;
  }
  setStubData('routes', [ACTIVE_ROUTE]);
  setStubData('ascents', ASCENTS);
  return ACTIVE_ROUTE;
}

function Seeded({ state, gymName = '紅石攀岩館' }: { state: State; gymName?: string }): React.JSX.Element {
  const route = seed(state);
  return (
    <RouteDetailScreen
      routeId={route.id}
      gymName={gymName}
      session={session}
      onBack={() => {}}
      onViewSendHistory={() => {}}
    />
  );
}

const meta: Meta = {
  title: 'Pages/Home/Route Detail',
  component: RouteDetailScreen as never, // real component; stories only drive the stub data
  tags: ['!autodocs'],
  parameters: { layout: 'centered', page: { tab: 'home' } },
  decorators: [withPhoneFrame],
};
export default meta;
type Story = StoryObj;

/** Active route: large title "紅色 · Cave", grade badge + gym subtitle, inline summary "完攀 · 嘗試", one full-width Record Send button, beta section, added-date footer. */
export const Populated: Story = { render: () => <Seeded state="populated" /> };

/** The route is bookmarked, so the header bookmark icon is filled. */
export const Bookmarked: Story = { render: () => <Seeded state="bookmarked" /> };

/** Retired route: shows the "Retired" status badge; the retire date joins the footnote meta ("Added … · Retired …"). */
export const RetiredRoute: Story = { name: 'Retired Route', render: () => <Seeded state="retired" gymName="攀石山" /> };

/** The route query never resolves: PageLoading after 300ms. */
export const Loading: Story = { render: () => <Seeded state="loading" /> };

/** The route cannot be found: E1 "Route not found" (network failures use the E4 error instead; the stub cannot return query errors). */
export const Error: Story = { render: () => <Seeded state="error" /> };
