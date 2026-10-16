import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';
import { fn } from 'storybook/test';

import { resetStubData, setStubData } from '../../../../.storybook/stubs/supabase';
import { ToastProvider } from '../../../components/ui';
import ModerationActions from '../components/ModerationActions';

/**
 * Off-spec design tooling. Fake data only; supabase is stubbed (never networked).
 * Try: tap Block (confirm sheet), confirm, then Unblock; turn on `fail` and tap again for the error path.
 */

interface Args {
  isBlocked: boolean;
  isOwnProfile: boolean;
  /** Simulates a failing request (no auth session: block/unblock throw). */
  fail: boolean;
  onBlock: () => void;
  onUnblock: () => void;
}

function Demo({ isBlocked, isOwnProfile, fail, onBlock, onUnblock }: Args): React.JSX.Element {
  // Re-seed on every render of the story (Controls remount via key below).
  resetStubData();
  if (!fail) setStubData('auth:session', { user: { id: 'user-me' } });
  if (isBlocked) setStubData('blocks', [{ blocker_user_id: 'user-me', blocked_user_id: 'user-target' }]);
  return (
    <ToastProvider>
      <div style={{ width: 360, padding: 16 }}>
        <ModerationActions
          key={`${isBlocked}-${isOwnProfile}-${fail}`}
          targetUserId={isOwnProfile ? 'user-me' : 'user-target'}
          currentUserId="user-me"
          onBlock={onBlock}
          onUnblock={onUnblock}
        />
      </div>
    </ToastProvider>
  );
}

const meta: Meta<Args> = {
  title: 'Moderation/ModerationActions',
  render: (args) => <Demo {...args} />,
  args: { isBlocked: false, isOwnProfile: false, fail: false, onBlock: fn(), onUnblock: fn() },
  argTypes: {
    isBlocked: { control: 'boolean' },
    isOwnProfile: { control: 'boolean', description: 'Renders nothing on your own profile' },
    fail: { control: 'boolean', description: 'Block / unblock requests fail' },
    onBlock: { table: { disable: true } },
    onUnblock: { table: { disable: true } },
  },
};
export default meta;

type Story = StoryObj<Args>;

/** Tap Block to open the confirm sheet; toggle isBlocked / isOwnProfile / fail in Controls. */
export const Playground: Story = {};
