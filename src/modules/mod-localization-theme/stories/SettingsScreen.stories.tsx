/**
 * SettingsScreen stories — design review for MOD-010.
 *
 * States:
 *   Loaded     — all controls visible: language picker, appearance picker,
 *                Blocked Accounts row, Beta Video Privacy toggle, Logout button.
 *   LoggingOut — Logout button shows spinner (disabled/loading state). Achieved by
 *                patching supabase.auth.signOut to never resolve, then
 *                programmatically clicking the button after mount.
 *
 * Supabase is replaced by the Storybook stub (no network). Auth session and
 * user data are seeded synchronously during render so the component's effects
 * see the data immediately.
 *
 * AppHeaderContext hooks (useAppHeader / useHeaderContentInset / useTabBarInset)
 * are no-ops / return 0 outside AppShell — safe to call from stories.
 */

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';
import { View } from 'react-native';

import { supabase } from '../../../lib/supabase';
import { setStubData } from '../../../../.storybook/stubs/supabase';
import SettingsScreen from '../screens/SettingsScreen';

// ── Helpers ───────────────────────────────────────────────────────────────────

const FAKE_USER_ID = 'user-storybook';
const FAKE_SESSION = { user: { id: FAKE_USER_ID } };
const FAKE_USERS_ROW = { id: FAKE_USER_ID, beta_video_privacy: 'public' };

/** Seeds stub data synchronously during render so component effects see it. */
function seedLoaded(): void {
  setStubData('auth:session', FAKE_SESSION);
  setStubData('users', FAKE_USERS_ROW);
}

// ── Loaded wrapper ─────────────────────────────────────────────────────────────

function LoadedWrapper(): React.JSX.Element {
  seedLoaded();
  return (
    <View style={{ flex: 1 }}>
      <SettingsScreen onBack={() => {}} />
    </View>
  );
}

// ── LoggingOut wrapper ─────────────────────────────────────────────────────────

/**
 * Patches supabase.auth.signOut to never resolve so the Logout button stays in
 * its loading state after it is pressed. The button is programmatically clicked
 * via the DOM after the component mounts (200 ms delay gives the screen time to
 * render fully).
 *
 * The patch is removed when the story unmounts so other stories are not affected.
 */
function LoggingOutWrapper(): React.JSX.Element {
  seedLoaded();

  React.useEffect(() => {
    const origSignOut = supabase.auth.signOut;

    // Patch signOut to hang → isSigningOut stays true indefinitely
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.auth as Record<string, any>).signOut = (): Promise<never> =>
      new Promise<never>(() => {});

    const timer = setTimeout(() => {
      // Logout button is the last [role="button"] element on the page.
      // Language / appearance options use role="radio"; blocked-accounts
      // row uses role="button"; logout Button also uses role="button".
      const allButtons = document.querySelectorAll('[role="button"]');
      const logoutBtn = allButtons[allButtons.length - 1] as HTMLElement | undefined;
      logoutBtn?.click();
    }, 200);

    return () => {
      clearTimeout(timer);
      supabase.auth.signOut = origSignOut;
    };
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <SettingsScreen onBack={() => {}} />
    </View>
  );
}

// ── Meta ───────────────────────────────────────────────────────────────────────

const meta: Meta = {
  title: 'LocalizationTheme/SettingsScreen',
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

/** All controls visible: language picker, appearance picker, Blocked Accounts row, Beta Video Privacy toggle, Logout button. */
export const Loaded: Story = {
  render: () => <LoadedWrapper />,
};

/** Logout button is disabled and shows a loading spinner — the state while signOut is in flight. */
export const LoggingOut: Story = {
  render: () => <LoggingOutWrapper />,
};
