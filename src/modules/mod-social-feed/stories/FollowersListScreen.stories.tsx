/**
 * Pages/Profile/Followers: someone's followers list.
 * Fake data only; the supabase stub never touches the network.
 * No Error story: the screen's error branch cannot be driven through the stub.
 */

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

import { withPhoneFrame } from '../../../../.storybook/PhoneFrame';
import { resetStubData, setStubData, STUB_PENDING } from '../../../../.storybook/stubs/supabase';
import FollowersListScreen from '../screens/FollowersListScreen';

const VIEWED_USER_ID = 'story-user-alice';

// Rows mimic the PostgREST embedded-join shape (`row.users`).
const FOLLOWER_ROWS = [
  { follower_id: 'user-001', users: { id: 'user-001', display_name: '陳柏翰', avatar_url: null } },
  { follower_id: 'user-002', users: { id: 'user-002', display_name: '林美玲', avatar_url: null } },
  { follower_id: 'user-003', users: { id: 'user-003', display_name: '吳家豪', avatar_url: null } },
];

function seed(state: 'populated' | 'empty' | 'loading'): void {
  resetStubData();
  setStubData('auth:session', { user: { id: 'story-user-me' } });
  setStubData('follows', state === 'populated' ? FOLLOWER_ROWS : state === 'loading' ? STUB_PENDING : []);
}

const meta: Meta = {
  title: 'Pages/Profile/Followers',
  component: FollowersListScreen as never,
  tags: ['!autodocs'],
  parameters: { layout: 'centered', page: { tab: 'profile' } },
  decorators: [withPhoneFrame],
};
export default meta;

const screen = (
  <FollowersListScreen userId={VIEWED_USER_ID} onBack={() => {}} onNavigateToUser={() => {}} />
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
