/**
 * Pages/Profile/Edit Profile: the real EditProfileScreen inside the phone frame.
 * The form has a single normal state (pre-filled from the current profile); saving/error are only
 * reachable by interaction, so no extra state stories are faked.
 */

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';

import { resetStubData, setStubData } from '../../../../.storybook/stubs/supabase';
import { withPhoneFrame } from '../../../../.storybook/PhoneFrame';
import EditProfileScreen from '../screens/EditProfileScreen';
import type { UserProfile } from '../types';

// Off-spec design tooling. Fake data only; supabase stub never touches the network.
const ME = 'story-user-me';

const PROFILE: UserProfile = {
  id: ME,
  display_name: '林冠宇',
  avatar_url: null,
  bio: '熱愛抱石，台北攀岩愛好者。目標是這季完攀 V5。',
  privacy_setting: 'public',
  created_at: '2026-01-15T00:00:00Z',
};

/** Seed stubs synchronously so the first render sees the data. */
function WithStubs({ children }: { children: React.ReactNode }): React.JSX.Element {
  resetStubData();
  setStubData('auth:session', { user: { id: ME } });
  return <>{children}</>;
}

const meta: Meta = {
  title: 'Pages/Profile/Edit Profile',
  component: EditProfileScreen as never, // real component
  tags: ['!autodocs'],
  parameters: { layout: 'centered', page: { tab: 'profile' } },
  decorators: [
    (Story) => (
      <WithStubs>
        <Story />
      </WithStubs>
    ),
    withPhoneFrame,
  ],
  render: () => (
    <EditProfileScreen userId={ME} profile={PROFILE} onSaved={() => {}} onCancel={() => {}} />
  ),
};
export default meta;

type Story = StoryObj;

/** Form pre-filled with the current display name, bio and avatar placeholder. */
export const Default: Story = {};
