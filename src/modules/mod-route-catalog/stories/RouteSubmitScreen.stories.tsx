import type { Session } from '@supabase/supabase-js';
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';
import { View } from 'react-native';

import { setStubData } from '../../../../.storybook/stubs/supabase';
import RouteSubmitScreen from '../screens/RouteSubmitScreen';
import type { RouteSummary } from '../types';

// Off-spec design tooling. Fake data only; the supabase stub resolves all queries.

const session = { user: { id: 'user-me' } } as unknown as Session;

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

/** Existing routes used to trigger the AC-187 duplicate notice/sheet. */
const EXISTING_ROUTES: RouteSummary[] = [
  makeRoute('route-dup-1', 'V4', 'red'),
  makeRoute('route-dup-2', 'V4', 'red'),
  makeRoute('route-1', 'V3', 'blue'),
  makeRoute('route-2', 'V5', 'green'),
];

type ScreenState = 'empty' | 'with-duplicates';

interface PlaygroundArgs {
  state: ScreenState;
  prefillGrade: 'none' | 'V4';
  prefillColor: 'none' | 'red' | 'blue';
}

function Seeded({ state, prefillGrade, prefillColor }: PlaygroundArgs): React.JSX.Element {
  setStubData('routes', state === 'with-duplicates' ? EXISTING_ROUTES : []);
  return (
    <View style={{ width: 390, height: 780 }}>
      <RouteSubmitScreen
        gymId={GYM_ID}
        gymName={GYM_NAME}
        session={session}
        onBack={() => {}}
        onSuccess={() => {}}
        initialGrade={prefillGrade === 'none' ? undefined : prefillGrade}
        initialColorTag={prefillColor === 'none' ? undefined : prefillColor}
      />
    </View>
  );
}

const meta: Meta<PlaygroundArgs> = {
  title: 'Route Catalog/RouteSubmitScreen',
  parameters: { layout: 'fullscreen' },
  args: { state: 'empty', prefillGrade: 'none', prefillColor: 'none' },
  argTypes: {
    state: { control: 'inline-radio', options: ['empty', 'with-duplicates'] },
    prefillGrade: { control: 'inline-radio', options: ['none', 'V4'] },
    prefillColor: { control: 'inline-radio', options: ['none', 'red', 'blue'] },
  },
  render: (args) => <Seeded key={`${args.state}-${args.prefillGrade}-${args.prefillColor}`} {...args} />,
};
export default meta;
type Story = StoryObj<PlaygroundArgs>;

/**
 * Try: select grade V4 + color Red — the AC-187 Layer 1 duplicate notice appears
 * (only when state is "with-duplicates"). Tap "Add Route" without a photo to see
 * the validation error. Toggle prefillGrade / prefillColor for pre-selection.
 */
export const Playground: Story = {};

/** Empty form — no pre-fills, no duplicates at the gym. Grade and color chips are unselected. */
export const DefaultEmptyForm: Story = {
  render: () => {
    setStubData('routes', []);
    return (
      <View style={{ width: 390, height: 780 }}>
        <RouteSubmitScreen
          gymId={GYM_ID}
          gymName={GYM_NAME}
          session={session}
          onBack={() => {}}
          onSuccess={() => {}}
        />
      </View>
    );
  },
};

/**
 * Grade V4 pre-filled; two existing V4 Red routes exist at this gym.
 * Select the "Red" color chip to trigger the AC-187 Layer 1 inline notice
 * ("2 matching routes at this gym").
 */
export const WithDuplicateCandidates: Story = {
  render: () => {
    setStubData('routes', EXISTING_ROUTES);
    return (
      <View style={{ width: 390, height: 780 }}>
        <RouteSubmitScreen
          gymId={GYM_ID}
          gymName={GYM_NAME}
          session={session}
          onBack={() => {}}
          onSuccess={() => {}}
          initialGrade="V4"
          initialColorTag="red"
        />
      </View>
    );
  },
};

/**
 * Auto-approve OFF scenario: the submit_route RPC returns status = 'pending'.
 * The form is pre-filled with V3 / Blue. Tapping "Add Route" (with no photo)
 * will hit the photo-required validation first; the pending-approval message
 * is shown after a successful submit with auto-approve OFF.
 */
export const PendingApproval: Story = {
  render: () => {
    setStubData('routes', []);
    // The only field RouteSubmitScreen reads from the returned route is `status`.
    setStubData('rpc:submit_route', { id: 'new-route', status: 'pending' });
    return (
      <View style={{ width: 390, height: 780 }}>
        <RouteSubmitScreen
          gymId={GYM_ID}
          gymName={GYM_NAME}
          session={session}
          onBack={() => {}}
          onSuccess={() => {}}
          initialGrade="V3"
          initialColorTag="blue"
        />
      </View>
    );
  },
};
