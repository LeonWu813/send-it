import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';

import { withPhoneFrame } from '../../../../.storybook/PhoneFrame';
import { resetStubData, setStubData, STUB_PENDING } from '../../../../.storybook/stubs/supabase';
import RouteListScreen from '../screens/RouteListScreen';
import type { RouteGrade, RouteSummary } from '../types';

// Off-spec design tooling. Fake data only; the supabase stub resolves all queries.

const GYM_ID = 'gym-1';
const GYM_NAME = '紅石攀岩館';

const GRADES = ['V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7'] as const;
const COLORS = ['red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink', 'white', 'black'] as const;

function makeRoute(i: number): RouteSummary {
  return {
    id: `route-${i}`,
    gym_id: GYM_ID,
    grade: GRADES[i % GRADES.length]!,
    color_tag: COLORS[i % COLORS.length]!,
    section_label: i % 3 === 0 ? 'Cave' : null,
    photo_url: '',
    status: 'active',
    created_at: new Date(2026, 8, 1 + (i % 28)).toISOString(),
  };
}

function seed(routes: RouteSummary[] | typeof STUB_PENDING): void {
  resetStubData();
  setStubData('auth:session', { user: { id: 'story-user-me' } });
  setStubData('routes', routes);
  setStubData('saved_routes', [{ route_id: 'route-0' }, { route_id: 'route-3' }]);
  setStubData('ascents', []);
  setStubData('rpc:count_beta_videos_by_routes', [
    { route_id: 'route-0', beta_count: 3 },
    { route_id: 'route-2', beta_count: 1 },
  ]);
  setStubData('rpc:routes_with_new_beta', []);
}

function Screen({ routes, gradeFilter }: { routes: RouteSummary[] | typeof STUB_PENDING; gradeFilter?: RouteGrade }): React.JSX.Element {
  seed(routes);
  return (
    <RouteListScreen
      gymId={GYM_ID}
      gymName={GYM_NAME}
      onSelectRoute={() => {}}
      onSubmitRoute={() => {}}
      onBack={() => {}}
      gradeFilter={gradeFilter}
    />
  );
}

const meta: Meta = {
  title: 'Pages/Gyms/Route List',
  component: RouteListScreen as never, // real component; stories only drive the stub data
  tags: ['!autodocs'],
  parameters: { layout: 'centered', page: { tab: 'gyms' } },
  decorators: [withPhoneFrame],
};
export default meta;
type Story = StoryObj;

/** Eight active routes across grades and colors; routes 0 and 3 are bookmarked, routes 0 and 2 have beta videos. */
export const Populated: Story = {
  render: () => <Screen routes={Array.from({ length: 8 }, (_, i) => makeRoute(i))} />,
};

/** No routes at this gym: empty state with the "Add a route" CTA. */
export const Empty: Story = { render: () => <Screen routes={[]} /> };

/** Route query never resolves. */
export const Loading: Story = { render: () => <Screen routes={STUB_PENDING} /> };

/** Grade filter V9 is active and nothing matches; the "Add a route" CTA remains. */
export const FilteredEmpty: Story = { name: 'Filtered Empty', render: () => <Screen routes={[]} gradeFilter="V9" /> };

// No Error story: the stub cannot return query errors.
