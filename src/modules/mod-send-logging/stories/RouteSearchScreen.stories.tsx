import type { Session } from '@supabase/supabase-js';
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React, { useEffect } from 'react';
import { View } from 'react-native';

import { setStubData, supabase } from '../../../../.storybook/stubs/supabase';
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

type SearchState = 'default' | 'loading' | 'results' | 'noResults';

interface PlaygroundArgs {
  /** Which search phase to display. */
  state: SearchState;
}

/**
 * Seeds the routes stub and auto-triggers a gym-ID search so the component
 * renders the requested state. For Loading, `supabase.from('routes')` is
 * replaced with a never-settling proxy; the original is restored on cleanup.
 * `key={args.state}` remounts this wrapper on every state change.
 */
function Seeded({ state }: PlaygroundArgs): React.JSX.Element {
  if (state === 'results') setStubData('routes', sampleRoutes);
  if (state === 'noResults') setStubData('routes', []);

  useEffect(() => {
    if (state === 'default') return;

    let originalFrom: typeof supabase.from | null = null;
    if (state === 'loading') {
      originalFrom = supabase.from;
      const neverResolve: unknown = new Proxy({} as object, {
        get(_, prop: string | symbol) {
          if (prop === 'then') return () => {};
          return () => neverResolve;
        },
      });
      supabase.from = (table: string) =>
        table === 'routes' ? neverResolve : originalFrom!(table);
    }

    // react-native-web renders TextInput as <input> and Pressable as [role="button"].
    // Cancel is buttons[0]; Search is buttons[1].
    const input = document.querySelector('input') as HTMLInputElement | null;
    if (input) {
      const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      nativeSetter?.call(input, 'gym-001');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      setTimeout(() => {
        const buttons = document.querySelectorAll<HTMLElement>('[role="button"]');
        buttons[1]?.click();
      }, 0);
    }

    return () => {
      if (originalFrom !== null) supabase.from = originalFrom;
    };
  }, [state]);

  return (
    <RouteSearchScreen
      session={session}
      onRouteSelected={() => {}}
      onCancel={() => {}}
    />
  );
}

const meta: Meta<PlaygroundArgs> = {
  title: 'SendLogging/RouteSearchScreen',
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <View style={{ width: 390, height: 780 }}>
        <Story />
      </View>
    ),
  ],
  args: { state: 'default' },
  argTypes: {
    state: {
      control: 'inline-radio',
      options: ['default', 'loading', 'results', 'noResults'],
    },
  },
  render: (args) => <Seeded key={args.state} {...args} />,
};
export default meta;
type Story = StoryObj<PlaygroundArgs>;

/**
 * Switch the state control to inspect each search phase:
 * - default   — capsule search bar, no results yet
 * - loading   — three AscentRowSkeleton rows while the request is in flight
 * - results   — five ListRow cards with TapeBadge thumbnails from gym-001
 * - noResults — inline EmptyState after a search that returned nothing
 */
export const Playground: Story = {};
