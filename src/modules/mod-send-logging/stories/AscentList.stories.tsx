import type { Session } from '@supabase/supabase-js';
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';
import { View } from 'react-native';

import { setStubData } from '../../../../.storybook/stubs/supabase';
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

const long: Row[] = Array.from({ length: 40 }, (_, i) => {
  const styles = ['flash', 'top', 'attempt'] as const;
  const mine = i % 5 === 0;
  return row(i + 1, {
    user_id: mine ? ME : `u${i}`,
    style: styles[i % 3],
    attempts: (i % 7) + 1,
    note: mine ? `Note #${i + 1}: 這是一段很長的備註，用來測試換行 wrapping of long text in the note box.` : null,
    is_private: i % 9 === 0,
    users: { display_name: mine ? 'Me' : `Climber ${i + 1}` },
  });
});

/** Seeds the stub synchronously during render so the component's fetch effect sees it. */
function Seeded({ data, refreshKey }: { data: unknown; refreshKey?: number }): React.JSX.Element {
  setStubData('ascents', data);
  return (
    <View style={{ padding: 16, maxWidth: 420 }}>
      <AscentList routeId="route-1" session={session} onLogSend={() => {}} refreshKey={refreshKey} />
    </View>
  );
}

const meta: Meta<typeof AscentList> = {
  title: 'SendLogging/AscentList',
  component: AscentList,
  parameters: { layout: 'fullscreen' },
};
export default meta;
type Story = StoryObj<typeof AscentList>;

export const Populated: Story = { render: () => <Seeded data={mixed} /> };

export const Empty: Story = { render: () => <Seeded data={[]} /> };

/** Stub returns a non-array so the service's `.map` throws, triggering the real error UI. */
export const ErrorState: Story = { render: () => <Seeded data="boom" /> };

export const LongList: Story = { render: () => <Seeded data={long} /> };
