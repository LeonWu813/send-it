import type { Session } from '@supabase/supabase-js';
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';

import { withPhoneFrame } from '../../../../.storybook/PhoneFrame';
import { resetStubData, setStubData } from '../../../../.storybook/stubs/supabase';
import RouteSubmitScreen from '../screens/RouteSubmitScreen';
import type { RouteSummary } from '../types';

// Off-spec design tooling. Fake data only; the supabase stub resolves all queries.

const session = { user: { id: 'story-user-me' } } as unknown as Session;

const GYM_ID = 'gym-1';
const GYM_NAME = '紅石攀岩館';

function makeRoute(id: string, grade: RouteSummary['grade'], colorTag: RouteSummary['color_tag']): RouteSummary {
  return {
    id,
    gym_id: GYM_ID,
    grade,
    color_tag: colorTag,
    section_label: null,
    photo_url: '',
    status: 'active',
    created_at: new Date(2026, 8, 1).toISOString(),
  };
}

/** Existing routes used to trigger the AC-187 duplicate notice. */
const EXISTING_ROUTES: RouteSummary[] = [
  makeRoute('route-dup-1', 'V4', 'red'),
  makeRoute('route-dup-2', 'V4', 'red'),
  makeRoute('route-1', 'V3', 'blue'),
  makeRoute('route-2', 'V5', 'green'),
];

interface ScreenProps {
  routes?: RouteSummary[];
  grade?: RouteSummary['grade'];
  color?: RouteSummary['color_tag'];
  pending?: boolean;
}

function Screen({ routes = [], grade, color, pending = false }: ScreenProps): React.JSX.Element {
  resetStubData();
  setStubData('auth:session', { user: { id: 'story-user-me' } });
  setStubData('routes', routes);
  if (pending) setStubData('rpc:submit_route', { id: 'new-route', status: 'pending' });
  return (
    <RouteSubmitScreen
      gymId={GYM_ID}
      gymName={GYM_NAME}
      session={session}
      onBack={() => {}}
      onSuccess={() => {}}
      initialGrade={grade}
      initialColorTag={color}
    />
  );
}

const meta: Meta = {
  title: 'Pages/Gyms/Route Submit',
  component: RouteSubmitScreen as never, // real component; stories only drive the stub data
  tags: ['!autodocs'],
  parameters: { layout: 'centered', page: { tab: 'gyms' } },
  decorators: [withPhoneFrame],
};
export default meta;
type Story = StoryObj;

/** Empty form: no pre-fills, no duplicates at the gym. Grade and color chips are unselected. */
export const Default: Story = { render: () => <Screen /> };

/** Grade V4 and Red are pre-filled; two matching routes exist, so the AC-187 duplicate notice shows. */
export const DuplicateCandidates: Story = {
  name: 'Duplicate Candidates',
  render: () => <Screen routes={EXISTING_ROUTES} grade="V4" color="red" />,
};

/** Auto-approve OFF: submit_route returns status 'pending'. Form is pre-filled with V3 / Blue. */
export const PendingApproval: Story = {
  name: 'Pending Approval',
  render: () => <Screen grade="V3" color="blue" pending />,
};
