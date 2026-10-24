/**
 * BlockedAccountsScreen stories — design review for MOD-010.
 *
 * States:
 *   Loading   — PageLoading (large textSecondary spinner, 48 below the header) after the 300ms delay.
 *               The blocks query never resolves (STUB_PENDING).
 *   Populated — List of 3 blocked users (52pt rows, Avatar sm 32, display name,
 *               vertically centred secondary Unblock button).
 *   Confirm Unblock — Unblock pressed on the first row: confirm sheet is open.
 *   Empty     — No blocked users; E1 page empty state (ban icon, title, description).
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

/** Presses the first Unblock button after mount to open the confirm sheet. */
function ConfirmUnblockWrapper(): React.JSX.Element {
  React.useEffect(() => {
    const timer = setTimeout(() => {
      const btn = Array.from(document.querySelectorAll('[role="button"]')).find((el) => {
        const label = el.getAttribute('aria-label') ?? '';
        return label === 'Unblock' || label === '解除封鎖';
      });
      (btn as HTMLElement | undefined)?.click();
    }, 300);
    return () => { clearTimeout(timer); };
  }, []);
  return <WithBlocks blocks={BLOCKED} />;
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

/** Unblock pressed: the confirm sheet asks before unblocking. */
export const ConfirmUnblock: Story = {
  name: 'Confirm Unblock',
  render: () => <ConfirmUnblockWrapper />,
};

/** Current user has blocked no one: E1 page empty state. */
export const Empty: Story = {
  render: () => <WithBlocks blocks={[]} />,
};

/** Initial load: PageLoading while fetching blocked users. */
export const Loading: Story = {
  render: () => <WithBlocks blocks={STUB_PENDING} />,
};
