import type { Session } from '@supabase/supabase-js';
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';
import { View } from 'react-native';

import { setStubData } from '../../../../.storybook/stubs/supabase';
import SendHistoryDetailScreen from '../screens/SendHistoryDetailScreen';

// Off-spec design tooling. Fake data only; the supabase stub resolves all queries.

const session = { user: { id: 'user-me' } } as unknown as Session;
const ROUTE_ID = 'route-1';

interface AscentRow {
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

const STYLES = ['flash', 'top', 'attempt'] as const;

function makeAscent(i: number, over: Partial<AscentRow> = {}): AscentRow {
  return {
    id: `ascent-${i}`,
    user_id: 'user-me',
    route_id: ROUTE_ID,
    style: STYLES[i % STYLES.length]!,
    attempts: (i % 5) + 1,
    note: i % 4 === 0 ? `備註 / Note #${i + 1}: 這次終於找到關鍵腳點了` : null,
    logged_at: new Date(2026, 8, 28 - (i % 20), 18, 0).toISOString(),
    is_private: i % 7 === 0,
    users: { display_name: 'Me' },
    ...over,
  };
}

const MIXED_ASCENTS: AscentRow[] = [
  makeAscent(0, { style: 'flash', attempts: 1, note: '一次過！腳點很關鍵 / Nailed the heel hook first go.' }),
  makeAscent(1, { style: 'top', attempts: 3 }),
  makeAscent(2, { style: 'attempt', attempts: 7, note: null }),
  makeAscent(3, { style: 'top', attempts: 2, is_private: true }),
  makeAscent(4, { style: 'attempt', attempts: 4, note: '下次試試看左側起手 / Try the left-start variation next time.' }),
];

type ScreenState = 'populated' | 'empty';

interface PlaygroundArgs {
  state: ScreenState;
  rowCount: number;
}

function Seeded({ state, rowCount }: PlaygroundArgs): React.JSX.Element {
  const ascents = state === 'empty'
    ? []
    : Array.from({ length: rowCount }, (_, i) => makeAscent(i));
  setStubData('ascents', ascents);
  return (
    <View style={{ width: 390, height: 780 }}>
      <SendHistoryDetailScreen
        routeId={ROUTE_ID}
        session={session}
        onBack={() => {}}
      />
    </View>
  );
}

const meta: Meta<PlaygroundArgs> = {
  title: 'Route Catalog/SendHistoryDetailScreen',
  parameters: { layout: 'fullscreen' },
  args: { state: 'populated', rowCount: 5 },
  argTypes: {
    state: { control: 'inline-radio', options: ['populated', 'empty'] },
    rowCount: { control: { type: 'range', min: 1, max: 20, step: 1 } },
  },
  render: (args) => <Seeded key={`${args.state}-${args.rowCount}`} {...args} />,
};
export default meta;
type Story = StoryObj<PlaygroundArgs>;

/**
 * Toggle between populated and empty; drag rowCount to add more ascents.
 * Private rows show the "Private" label; flash rows show the flash badge.
 * Tap the trash icon (dustbin) to delete a row — an Alert confirms before deletion.
 */
export const Playground: Story = {};

/**
 * Five ascent records: 1 flash, 1 top (private), 2 attempts, 1 top with a note.
 * Shows style badges, attempt counts, dates, delete buttons, and inline notes.
 */
export const Populated: Story = {
  render: () => {
    setStubData('ascents', MIXED_ASCENTS);
    return (
      <View style={{ width: 390, height: 780 }}>
        <SendHistoryDetailScreen
          routeId={ROUTE_ID}
          session={session}
          onBack={() => {}}
        />
      </View>
    );
  },
};

/** No sends for this route — shows the empty-state copy ("No sends yet"). */
export const Empty: Story = {
  render: () => {
    setStubData('ascents', []);
    return (
      <View style={{ width: 390, height: 780 }}>
        <SendHistoryDetailScreen
          routeId={ROUTE_ID}
          session={session}
          onBack={() => {}}
        />
      </View>
    );
  },
};

/** Single flash send — useful for checking badge spacing and the "1 attempt" label. */
export const SingleFlash: Story = {
  render: () => {
    setStubData('ascents', [makeAscent(0, { style: 'flash', attempts: 1, note: '閃送！/ Flash!' })]);
    return (
      <View style={{ width: 390, height: 780 }}>
        <SendHistoryDetailScreen
          routeId={ROUTE_ID}
          session={session}
          onBack={() => {}}
        />
      </View>
    );
  },
};
