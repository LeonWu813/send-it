/**
 * BlockedAccountsScreen stories — design review for MOD-010.
 *
 * States:
 *   Loading   — ActivityIndicator is shown while fetching blocked users.
 *               The blocks query never resolves (STUB_PENDING).
 *   Populated — List of 3 blocked users, each with avatar placeholder, display
 *               name, and secondary Unblock button (capsule).
 *   Empty     — No blocked users; "No blocked accounts" message centred.
 *
 * Supabase is replaced by the Storybook stub (no network). Auth session and
 * query results are seeded synchronously during render.
 *
 * No Error story: the stub cannot return a query error without patching the client.
 */

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';

import { withPhoneFrame } from '../../../../.storybook/PhoneFrame';
import { resetStubData, setStubData, STUB_PENDING } from '../../../../.storybook/stubs/supabase';
import BlockedAccountsScreen from '../screens/BlockedAccountsScreen';

// ── Shared helpers ────────────────────────────────────────────────────────────

const FAKE_SESSION = { user: { id: 'story-user-me' } };

const BLOCKED = [
  { blocked_user_id: 'u1', users: { id: 'u1', display_name: '王小美', avatar_url: null } },
  { blocked_user_id: 'u2', users: { id: 'u2', display_name: 'Bob Chen', avatar_url: null } },
  { blocked_user_id: 'u3', users: { id: 'u3', display_name: '林大維', avatar_url: null } },
];

/** Seeds stubs synchronously during render so the first fetch sees them. */
function WithBlocks({ blocks }: { blocks: unknown }): React.JSX.Element {
  resetStubData();
  setStubData('auth:session', FAKE_SESSION);
  setStubData('blocks', blocks as never);
  return <BlockedAccountsScreen onBack={() => {}} />;
}

// ── Meta ───────────────────────────────────────────────────────────────────────

const meta: Meta = {
  title: 'Pages/Settings & Notifications/Blocked Accounts',
  component: BlockedAccountsScreen as never, // real component; stories only drive the stub data
  tags: ['!autodocs'],
  parameters: { layout: 'centered', page: { overlay: true } },
  decorators: [withPhoneFrame],
};
export default meta;

type Story = StoryObj;

/** Three blocked users with avatar placeholder, display name, and Unblock button. */
export const Populated: Story = {
  render: () => <WithBlocks blocks={BLOCKED} />,
};

/** Current user has blocked no one: empty state message shown. */
export const Empty: Story = {
  render: () => <WithBlocks blocks={[]} />,
};

/** Initial load: ActivityIndicator centred while fetching blocked users. */
export const Loading: Story = {
  render: () => <WithBlocks blocks={STUB_PENDING} />,
};
