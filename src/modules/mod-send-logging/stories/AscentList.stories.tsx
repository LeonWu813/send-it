import type { Session } from '@supabase/supabase-js';
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';
import { View } from 'react-native';

import { setStubData } from '../../../../.storybook/stubs/supabase';
import { ToastProvider } from '../../../components/ui';
import AscentList from '../components/AscentList';

/**
 * AscentList fetches its own data via loadAscentsForRoute -> supabase `ascents` table.
 * The Storybook supabase stub returns the same rows for every query, so each story
 * seeds `ascents` (raw DB row shape incl. the `users(display_name)` join) before render.
 */

const ME = 'user-me';
const session = { user: { id: ME } } as unknown as Session;

interface Row {
  id: string;
  user_id: string;
  route_id: string;
  style: 'flash' | 'top' | 'attempt';
  attempts: number;
  note: string | null;
  logged_at: string;
  is_private: boolean;
  users: { display_name: string };
}

const row = (i: number, over: Partial<Row> = {}): Row => ({
  id: `a${i}`,
  user_id: 'user-other',
  route_id: 'route-1',
  style: 'top',
  attempts: 3,
  note: null,
  logged_at: new Date(2026, 8, 30 - (i % 28), 18, 0).toISOString(),
  is_private: false,
  users: { display_name: 'Alex' },
  ...over,
});

const mixed: Row[] = [
  row(1, { user_id: ME, style: 'flash', attempts: 1, note: '一次過！腳點很關鍵 / Great heel hook.', users: { display_name: 'Me' } }),
  row(2, { user_id: 'u2', style: 'top', attempts: 4, users: { display_name: 'Mika' } }),
  row(3, { user_id: ME, style: 'attempt', attempts: 6, note: null, is_private: true, users: { display_name: 'Me' } }),
  row(4, { user_id: 'u3', style: 'flash', attempts: 1, users: { display_name: 'Jordan' } }),
  row(5, { user_id: 'u4', style: 'attempt', attempts: 2, users: { display_name: 'Sam' } }),
];

/** `count` rows: the first five are the hand-written mix above, the rest cycle through styles and authors. */
function rowsFor(count: number): Row[] {
  const styles = ['flash', 'top', 'attempt'] as const;
  return Array.from({ length: count }, (_, i) => {
    if (i < mixed.length) return mixed[i];
    const mine = i % 5 === 0;
    return row(i + 1, {
      user_id: mine ? ME : `u${i}`,
      style: styles[i % 3],
      attempts: (i % 7) + 1,
      note: mine ? `Note #${i + 1}: 這是一段很長的備註，用來測試換行 wrapping of long text in the note box, long enough to run past three lines so the More link appears.` : null,
      is_private: i % 9 === 0,
      users: { display_name: mine ? 'Me' : `Climber ${i + 1}` },
    });
  });
}

type ListState = 'populated' | 'empty' | 'error';

interface PlaygroundArgs {
  state: ListState;
  rowCount: number;
  /** Bump to simulate the parent incrementing refreshKey after a log (plays the new-row landing). */
  refreshKey: number;
}

/** Seeds the stub synchronously during render so the component's fetch effect sees it. */
function Seeded({ state, rowCount, refreshKey }: PlaygroundArgs): React.JSX.Element {
  // The stub returns a non-array for `error`, so the service's `.map` throws and the real error UI shows.
  setStubData('ascents', state === 'error' ? 'boom' : state === 'empty' ? [] : rowsFor(rowCount));
  return (
    <ToastProvider>
      <View style={{ padding: 16, maxWidth: 420 }}>
        <AscentList routeId="route-1" session={session} onLogSend={() => {}} refreshKey={refreshKey} />
      </View>
    </ToastProvider>
  );
}

const meta: Meta<PlaygroundArgs> = {
  title: 'SendLogging/AscentList',
  parameters: { layout: 'fullscreen' },
  args: { state: 'populated', rowCount: 5, refreshKey: 0 },
  argTypes: {
    state: { control: 'inline-radio', options: ['populated', 'empty', 'error'] },
    rowCount: { control: { type: 'range', min: 1, max: 40, step: 1 } },
    refreshKey: { control: { type: 'number', min: 0, max: 20 } },
  },
  // Remount on state / row count so the fetch effect runs against freshly seeded data.
  render: (args) => <Seeded key={`${args.state}-${args.rowCount}`} {...args} />,
};
export default meta;
type Story = StoryObj<PlaygroundArgs>;

/**
 * Try: switch state (populated / empty / error), drag rowCount; press the trash icon on "Me" rows for
 * the confirm sheet; raise refreshKey after adding a row to see the landing motion.
 */
export const Playground: Story = {};
