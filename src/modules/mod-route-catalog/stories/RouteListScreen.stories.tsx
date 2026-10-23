import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';
import { View } from 'react-native';

import { setStubData } from '../../../../.storybook/stubs/supabase';
import RouteListScreen from '../screens/RouteListScreen';
import type { RouteGrade, RouteSummary } from '../types';

// Off-spec design tooling. Fake data only; the supabase stub resolves all queries.

const GYM_ID = 'gym-1';
const GYM_NAME = '紅石攀岩館';

const GRADES = ['V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7'] as const;
const COLORS = ['red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink', 'white', 'black'] as const;

function makeRoute(i: number, over: Partial<RouteSummary> = {}): RouteSummary {
  return {
    id: `route-${i}`,
    gym_id: GYM_ID,
    grade: GRADES[i % GRADES.length]!,
    color_tag: COLORS[i % COLORS.length]!,
    section_label: i % 3 === 0 ? 'Cave' : null,
    photo_url: '',
    status: 'active',
    created_at: new Date(2026, 8, 1 + (i % 28)).toISOString(),
    ...over,
  };
}

function seedRoutes(routes: RouteSummary[]): void {
  setStubData('routes', routes);
  setStubData('saved_routes', [{ route_id: 'route-0' }, { route_id: 'route-3' }]);
  setStubData('ascents', []);
  setStubData('auth:session', { user: { id: 'user-me' } });
  setStubData('rpc:count_beta_videos_by_routes', [
    { route_id: 'route-0', beta_count: 3 },
    { route_id: 'route-2', beta_count: 1 },
  ]);
  setStubData('rpc:routes_with_new_beta', []);
}

const POPULATED_ROUTES: RouteSummary[] = Array.from({ length: 8 }, (_, i) => makeRoute(i));

type ScreenState = 'populated' | 'empty' | 'filtered-empty';

interface PlaygroundArgs {
  state: ScreenState;
  routeCount: number;
}

function Seeded({ state, routeCount }: PlaygroundArgs): React.JSX.Element {
  seedRoutes(state === 'populated' ? Array.from({ length: routeCount }, (_, i) => makeRoute(i)) : []);
  // filtered-empty: pass a grade that matches no seeded route.
  const gradeFilter = state === 'filtered-empty' ? ('V9' as const) : undefined;

  return (
    <View style={{ width: 390, height: 780 }}>
      <RouteListScreen
        gymId={GYM_ID}
        gymName={GYM_NAME}
        onSelectRoute={() => {}}
        onSubmitRoute={() => {}}
        onBack={() => {}}
        gradeFilter={gradeFilter}
      />
    </View>
  );
}

const meta: Meta<PlaygroundArgs> = {
  title: 'Route Catalog/RouteListScreen',
  parameters: { layout: 'fullscreen' },
  args: { state: 'populated', routeCount: 8 },
  argTypes: {
    state: { control: 'inline-radio', options: ['populated', 'empty', 'filtered-empty'] },
    routeCount: { control: { type: 'range', min: 1, max: 20, step: 1 } },
  },
  render: (args) => <Seeded key={`${args.state}-${args.routeCount}`} {...args} />,
};
export default meta;
type Story = StoryObj<PlaygroundArgs>;

/**
 * Toggle state between populated / empty / filtered-empty, and drag route count.
 * Saved indicator (filled bookmark) appears on routes 0 and 3.
 * Beta count subtitle appears on routes 0 (3 videos) and 2 (1 video).
 */
export const Playground: Story = {};

function Screen({ gradeFilter }: { gradeFilter?: RouteGrade }): React.JSX.Element {
  return (
    <View style={{ width: 390, height: 780 }}>
      <RouteListScreen
        gymId={GYM_ID}
        gymName={GYM_NAME}
        onSelectRoute={() => {}}
        onSubmitRoute={() => {}}
        onBack={() => {}}
        gradeFilter={gradeFilter}
      />
    </View>
  );
}

/** Eight active routes spanning multiple grades and colors; routes 0 and 3 are bookmarked. */
export const Populated: Story = {
  render: () => { seedRoutes(POPULATED_ROUTES); return <Screen />; },
};

/** No routes at this gym — shows the empty state with the "Add a route" CTA. */
export const Empty: Story = {
  render: () => { seedRoutes([]); return <Screen />; },
};

/**
 * Grade filter V9 active; the seeded routes contain no V9 routes so the list is empty.
 * The grade chip is pre-selected; the "Add a route" CTA remains visible.
 */
export const FilteredEmpty: Story = {
  render: () => { seedRoutes([]); return <Screen gradeFilter="V9" />; },
};
