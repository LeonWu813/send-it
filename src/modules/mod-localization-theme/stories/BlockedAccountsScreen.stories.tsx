/**
 * BlockedAccountsScreen stories — design review for MOD-010.
 *
 * States:
 *   Loading   — ActivityIndicator is shown while fetching blocked users.
 *               Achieved by patching supabase.from('blocks') to return a
 *               promise that never resolves, keeping loading=true indefinitely.
 *   Populated — List of 3 blocked users, each with avatar placeholder, display
 *               name, and secondary Unblock button (capsule).
 *   Empty     — No blocked users; "No blocked accounts" message centred.
 *
 * Supabase is replaced by the Storybook stub (no network). Auth session and
 * query results are seeded synchronously during render.
 *
 * AppHeaderContext hooks are no-ops outside AppShell — safe to call from stories.
 */

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';
import { View } from 'react-native';

import { supabase } from '../../../lib/supabase';
import { setStubData } from '../../../../.storybook/stubs/supabase';
import BlockedAccountsScreen from '../screens/BlockedAccountsScreen';

// ── Shared helpers ────────────────────────────────────────────────────────────

const FAKE_SESSION = { user: { id: 'user-storybook' } };

/** Shape returned by fetchMyBlockedUsers → maps to BlockedUser. */
type BlocksRow = {
  blocked_user_id: string;
  users: { id: string; display_name: string; avatar_url: string | null };
};

const THREE_BLOCKED: BlocksRow[] = [
  {
    blocked_user_id: 'u1',
    users: { id: 'u1', display_name: 'Alice Wang', avatar_url: null },
  },
  {
    blocked_user_id: 'u2',
    users: { id: 'u2', display_name: 'Bob Chen', avatar_url: null },
  },
  {
    blocked_user_id: 'u3',
    users: { id: 'u3', display_name: 'Carol Lin', avatar_url: null },
  },
];

// ── Hanging builder (Loading state) ───────────────────────────────────────────

/**
 * A Proxy that behaves like the supabase query builder but whose `.then()`
 * returns a Promise that never resolves. Used to freeze BlockedAccountsScreen
 * in its loading state by preventing the blocks query from completing.
 */
const hangingBuilder: unknown = new Proxy(function noop() {}, {
  get(_t, prop) {
    if (prop === 'then') {
      return (): Promise<never> => new Promise<never>(() => {});
    }
    // All other builder methods (select, eq, order, single, …) return self.
    return () => hangingBuilder;
  },
});

// ── Loading wrapper ───────────────────────────────────────────────────────────

/**
 * Patches supabase.from to hang for the 'blocks' table while passing all
 * other table queries through to the real stub. This keeps BlockedAccountsScreen
 * in its loading state (ActivityIndicator visible) indefinitely.
 * The patch is restored when the component unmounts.
 */
function LoadingWrapper(): React.JSX.Element {
  // Session must be seeded so fetchMyBlockedUsers proceeds to the blocks query.
  setStubData('auth:session', FAKE_SESSION);

  // Synchronously patch supabase.from before any effects run.
  const origFrom = supabase.from.bind(supabase);
  supabase.from = (table: string) => {
    if (table === 'blocks') {
      return hangingBuilder as ReturnType<typeof origFrom>;
    }
    return origFrom(table);
  };

  React.useEffect(() => {
    // Restore on unmount so other stories are unaffected.
    return () => {
      supabase.from = origFrom;
    };
  // origFrom is captured once at render; stable across re-renders.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <BlockedAccountsScreen onBack={() => {}} />
    </View>
  );
}

// ── Populated wrapper ─────────────────────────────────────────────────────────

function PopulatedWrapper(): React.JSX.Element {
  setStubData('auth:session', FAKE_SESSION);
  setStubData('blocks', THREE_BLOCKED);
  return (
    <View style={{ flex: 1 }}>
      <BlockedAccountsScreen onBack={() => {}} />
    </View>
  );
}

// ── Empty wrapper ─────────────────────────────────────────────────────────────

function EmptyWrapper(): React.JSX.Element {
  setStubData('auth:session', FAKE_SESSION);
  setStubData('blocks', []);
  return (
    <View style={{ flex: 1 }}>
      <BlockedAccountsScreen onBack={() => {}} />
    </View>
  );
}

// ── Meta ───────────────────────────────────────────────────────────────────────

const meta: Meta = {
  title: 'LocalizationTheme/BlockedAccountsScreen',
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <View style={{ width: 390, height: 780 }}>
        <Story />
      </View>
    ),
  ],
};
export default meta;

type Story = StoryObj;

// ── Stories ───────────────────────────────────────────────────────────────────

/** Initial load: ActivityIndicator centred while fetching blocked users. */
export const Loading: Story = {
  render: () => <LoadingWrapper />,
};

/** Three blocked users with avatar placeholder, display name, and Unblock button. */
export const Populated: Story = {
  render: () => <PopulatedWrapper />,
};

/** Current user has blocked no one — empty state message shown. */
export const Empty: Story = {
  render: () => <EmptyWrapper />,
};
