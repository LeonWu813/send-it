import type { Session } from '@supabase/supabase-js';
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React, { useEffect } from 'react';

import { resetStubData, setStubData, STUB_PENDING } from '../../../../.storybook/stubs/supabase';
import { withPhoneFrame } from '../../../../.storybook/PhoneFrame';
import type { RouteSummary } from '../../mod-route-catalog';
import RouteSearchScreen from '../screens/RouteSearchScreen';

// Stub session — no NavigationContainer or real navigator in Storybook.
const session = { user: { id: 'user-me' } } as unknown as Session;

/** Five sample routes shown in the Results state. */
const sampleRoutes: RouteSummary[] = [
  {
    id: 'r1',
    gym_id: 'gym-001',
    grade: 'V3',
    color_tag: 'red',
    section_label: 'A 區',
    photo_url: '',
    status: 'active',
    created_at: '2026-10-01T10:00:00Z',
  },
  {
    id: 'r2',
    gym_id: 'gym-001',
    grade: 'V5',
    color_tag: 'blue',
    section_label: null,
    photo_url: '',
    status: 'active',
    created_at: '2026-10-02T10:00:00Z',
  },
  {
    id: 'r3',
    gym_id: 'gym-001',
    grade: 'V6',
    color_tag: 'yellow',
    section_label: 'B 區',
    photo_url: '',
    status: 'active',
    created_at: '2026-10-03T10:00:00Z',
  },
  {
    id: 'r4',
    gym_id: 'gym-001',
    grade: 'V7',
    color_tag: 'green',
    section_label: null,
    photo_url: '',
    status: 'active',
    created_at: '2026-10-04T10:00:00Z',
  },
  {
    id: 'r5',
    gym_id: 'gym-001',
    grade: 'V9',
    color_tag: 'black',
    section_label: 'Cave',
    photo_url: '',
    status: 'active',
    created_at: '2026-10-05T10:00:00Z',
  },
];

type SearchState = 'default' | 'results' | 'loading' | 'noResults';

interface Args {
  state: SearchState;
}

/**
 * Seeds the stubs synchronously, then auto-triggers a gym-ID search so the screen shows the requested phase.
 * `key={state}` remounts this wrapper on every state change.
 */
function Seeded({ state }: Args): React.JSX.Element {
  resetStubData();
  setStubData('auth:session', { user: { id: 'story-user-me' } });
  if (state === 'results') setStubData('routes', sampleRoutes);
  if (state === 'noResults') setStubData('routes', []);
  if (state === 'loading') setStubData('routes', STUB_PENDING);

  useEffect(() => {
    if (state === 'default') return;
    // react-native-web renders TextInput as <input>. Poll for ~6s: the frame can mount (or remount) the screen
    // after this effect, so re-fill whenever the input is found empty.
    let tries = 0;
    const timer = setInterval(() => {
      if (++tries > 60) clearInterval(timer);
      const input = document.querySelector('input') as HTMLInputElement | null;
      if (!input || input.value !== '') return;
      const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      nativeSetter?.call(input, 'gym-001');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      // Enter runs onSubmitEditing -> search (a synthetic click on the Pressable is not picked up).
      setTimeout(() => {
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      }, 50);
    }, 100);
    return () => clearInterval(timer);
  }, [state]);

  return <RouteSearchScreen session={session} onRouteSelected={() => {}} onCancel={() => {}} />;
}

const meta: Meta<Args> = {
  title: 'Pages/Home/Route Search',
  component: RouteSearchScreen as never, // real component; story args only drive the search phase
  tags: ['!autodocs'],
  parameters: { layout: 'centered', page: { chrome: false } },
  decorators: [withPhoneFrame],
  argTypes: { state: { control: false } },
  render: (args) => <Seeded key={args.state} {...args} />,
};
export default meta;
type Story = StoryObj<Args>;

/** Search bar with no query run yet. */
export const Default: Story = { args: { state: 'default' } };

/** Search returned five routes from gym-001. */
export const Populated: Story = { args: { state: 'results' } };

/** Search returned nothing: inline empty state. */
export const Empty: Story = { args: { state: 'noResults' } };

/** Request in flight: skeleton rows. */
export const Loading: Story = { args: { state: 'loading' } };
