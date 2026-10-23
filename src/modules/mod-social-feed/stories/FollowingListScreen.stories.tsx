/**
 * Pages/Profile/Following: someone's following list.
 * Fake data only; the supabase stub never touches the network.
 * No Error story: the screen's error branch cannot be driven through the stub.
 */

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

import { withPhoneFrame } from '../../../../.storybook/PhoneFrame';
import { resetStubData, setStubData, STUB_PENDING } from '../../../../.storybook/stubs/supabase';
import FollowingListScreen from '../screens/FollowingListScreen';

const VIEWED_USER_ID = 'story-user-alice';

// Rows mimic the PostgREST embedded-join shape (`row.users`).
const FOLLOWING_ROWS = [
  { followee_id: 'user-010', users: { id: 'user-010', display_name: '黃柏諺', avatar_url: null } },
  { followee_id: 'user-011', users: { id: 'user-011', display_name: '朴莎拉', avatar_url: null } },
  { followee_id: 'user-012', users: { id: 'user-012', display_name: '陳威宇', avatar_url: null } },
];

function seed(state: 'populated' | 'empty' | 'loading'): void {
  resetStubData();
  setStubData('auth:session', { user: { id: 'story-user-me' } });
  setStubData('follows', state === 'populated' ? FOLLOWING_ROWS : state === 'loading' ? STUB_PENDING : []);
}

const meta: Meta = {
  title: 'Pages/Profile/Following',
  component: FollowingListScreen as never,
  tags: ['!autodocs'],
  parameters: { layout: 'centered', page: { tab: 'profile' } },
  decorators: [withPhoneFrame],
};
export default meta;

const screen = (
  <FollowingListScreen userId={VIEWED_USER_ID} onBack={() => {}} onNavigateToUser={() => {}} />
);

/** Three cards: circular avatar + display name only (AC-148). */
export const Populated: StoryObj = {
  render: () => {
    seed('populated');
    return screen;
  },
};

/** First-use empty state. */
export const Empty: StoryObj = {
  render: () => {
    seed('empty');
    return screen;
  },
};

/** List query never resolves. */
export const Loading: StoryObj = {
  render: () => {
    seed('loading');
    return screen;
  },
};
