/**
 * Pages/Profile/Edit Profile: the real EditProfileScreen inside the phone frame.
 * Save is the header trailing icon button (disabled until the form changes); back asks before discarding.
 * Saving/error are only reachable by interaction; Unsaved and Discard drive the real screen through the DOM.
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

/** Header Save is disabled (textDisabled glyph) until something changes. */
function typeIntoName(canvasElement: HTMLElement): void {
  const input = canvasElement.querySelector<HTMLInputElement>('input');
  if (!input) return;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, `${PROFILE.display_name} 2`);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

/** The name was edited: header Save is enabled. */
export const Unsaved: Story = {
  play: async ({ canvasElement }) => {
    await new Promise((r) => setTimeout(r, 300));
    typeIntoName(canvasElement);
  },
};

/** Back on an edited form opens the discard confirmation sheet. */
export const Discard: Story = {
  play: async ({ canvasElement }) => {
    await new Promise((r) => setTimeout(r, 300));
    typeIntoName(canvasElement);
    await new Promise((r) => setTimeout(r, 200));
    const back = canvasElement.ownerDocument.querySelector<HTMLElement>('[aria-label="返回"], [aria-label="Back"]');
    back?.click();
  },
};
