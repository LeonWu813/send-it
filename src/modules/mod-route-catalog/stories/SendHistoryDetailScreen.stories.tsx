import type { Session } from '@supabase/supabase-js';
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';

import { withPhoneFrame } from '../../../../.storybook/PhoneFrame';
import { resetStubData, setStubData, STUB_PENDING } from '../../../../.storybook/stubs/supabase';
import SendHistoryDetailScreen from '../screens/SendHistoryDetailScreen';

// Off-spec design tooling. Fake data only; the supabase stub resolves all queries.

const ME = 'story-user-me';
const session = { user: { id: ME } } as unknown as Session;
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

function ascent(i: number, over: Partial<AscentRow>): AscentRow {
  return {
    id: `ascent-${i}`,
    user_id: ME,
    route_id: ROUTE_ID,
    style: 'top',
    attempts: 1,
    note: null,
    logged_at: new Date(2026, 8, 28 - i * 3, 18, 0).toISOString(),
    is_private: false,
    users: { display_name: '小明' },
    ...over,
  };
}

const MIXED_ASCENTS: AscentRow[] = [
  ascent(0, { style: 'flash', attempts: 1, note: '一次過！腳點很關鍵' }),
  ascent(1, { style: 'top', attempts: 3 }),
  ascent(2, { style: 'attempt', attempts: 7 }),
  ascent(3, { style: 'top', attempts: 2, is_private: true }),
  ascent(4, { style: 'attempt', attempts: 4, note: '下次試試看左側起手' }),
];

const ROUTE = {
  id: ROUTE_ID,
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

function Seeded({ ascents, deleteId }: { ascents: AscentRow[] | typeof STUB_PENDING; deleteId?: string }): React.JSX.Element {
  resetStubData();
  setStubData('auth:session', { user: { id: ME } });
  setStubData('routes', [ROUTE]);
  setStubData('ascents', ascents);
  return (
    <SendHistoryDetailScreen
      routeId={ROUTE_ID}
      session={session}
      gymName="紅石攀岩館"
      onBack={() => {}}
      initialDeleteAscentId={deleteId}
    />
  );
}

const meta: Meta = {
  title: 'Pages/Home/Send History Detail',
  component: SendHistoryDetailScreen as never, // real component; stories only drive the stub data
  tags: ['!autodocs'],
  parameters: { layout: 'centered', page: { tab: 'home' } },
  decorators: [withPhoneFrame],
};
export default meta;
type Story = StoryObj;

/** Route summary card on top, then five ascents (flash, top, private top, two attempts) with badges, attempt counts, dates, notes and a "..." action each. */
export const Populated: Story = { render: () => <Seeded ascents={MIXED_ASCENTS} /> };

/** SH-1: the "..." action was tapped on the first ascent; the delete confirmation sheet is open. */
export const DeleteConfirm: Story = {
  name: 'Delete Confirm',
  render: () => <Seeded ascents={MIXED_ASCENTS} deleteId="ascent-0" />,
};

/** No sends for this route: E2 section sentence with the ghost "Record a send" action. */
export const Empty: Story = { render: () => <Seeded ascents={[]} /> };

/** Single flash send: checks badge spacing and the "1 attempt" label. */
export const SingleFlash: Story = {
  name: 'Single Flash',
  render: () => <Seeded ascents={[ascent(0, { style: 'flash', attempts: 1, note: '閃送！' })]} />,
};

/** Ascent query never resolves: PageLoading after 300ms. */
export const Loading: Story = { render: () => <Seeded ascents={STUB_PENDING} /> };

// No Error story: the stub cannot return query errors.
