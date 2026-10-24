import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';
import { fn } from 'storybook/test';

import { resetStubData, setStubData } from '../../../../.storybook/stubs/supabase';
import { Card, ToastProvider } from '../../../components/ui';
import ModerationActions from '../components/ModerationActions';

/**
 * Off-spec design tooling. Fake data only; supabase is stubbed (never networked).
 * Try: tap Block (confirm sheet), confirm, then Unblock; turn on `fail` and tap again for the error path.
 */

interface Args {
  isBlocked: boolean;
  isOwnProfile: boolean;
  /** Name shown in the blocked notice ("You blocked {name}"). */
  targetName: string;
  /** Simulates a failing request (no auth session: block/unblock throw). */
  fail: boolean;
  onBlock: () => void;
  onUnblock: () => void;
}

function Demo({ isBlocked, isOwnProfile, targetName, fail, onBlock, onUnblock }: Args): React.JSX.Element {
  // Re-seed on every render of the story (Controls remount via key below).
  resetStubData();
  if (!fail) setStubData('auth:session', { user: { id: 'user-me' } });
  if (isBlocked) setStubData('blocks', [{ blocker_user_id: 'user-me', blocked_user_id: 'user-target' }]);
  return (
    <ToastProvider>
      <div style={{ width: 392, padding: 16 }}>
        <Card variant="static">
        <ModerationActions
          targetName={targetName || undefined}
          key={`${isBlocked}-${isOwnProfile}-${fail}-${targetName}`}
          targetUserId={isOwnProfile ? 'user-me' : 'user-target'}
          currentUserId="user-me"
          onBlock={onBlock}
          onUnblock={onUnblock}
        />
        </Card>
      </div>
    </ToastProvider>
  );
}

const meta: Meta<Args> = {
  title: 'Patterns/ModerationActions',
  render: (args) => <Demo {...args} />,
  args: { isBlocked: false, isOwnProfile: false, targetName: 'Ming', fail: false, onBlock: fn(), onUnblock: fn() },
  argTypes: {
    isBlocked: { control: 'boolean' },
    isOwnProfile: { control: 'boolean', description: 'Renders nothing on your own profile' },
    targetName: { control: 'text' },
    fail: { control: 'boolean', description: 'Block / unblock requests fail' },
    onBlock: { table: { disable: true } },
    onUnblock: { table: { disable: true } },
  },
};
export default meta;

type Story = StoryObj<Args>;

/** Profile context (inside the header Card). Tap Block to open the floating confirm sheet; toggle isBlocked / isOwnProfile / fail in Controls. */
export const Playground: Story = {};
