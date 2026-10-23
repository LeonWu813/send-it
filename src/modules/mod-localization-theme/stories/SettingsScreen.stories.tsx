/**
 * SettingsScreen stories — design review for MOD-010.
 *
 * States:
 *   Populated  — all controls visible: language picker, appearance picker,
 *                Blocked Accounts row, Beta Video Privacy toggle, Logout button.
 *   Logging Out — Logout button shows spinner (disabled/loading state). Achieved by
 *                patching supabase.auth.signOut to never resolve, then
 *                programmatically clicking the button after mount.
 *
 * Supabase is replaced by the Storybook stub (no network). Auth session and
 * user data are seeded synchronously during render so the component's effects
 * see the data immediately.
 * */

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';

import { supabase } from '../../../lib/supabase';
import { withPhoneFrame } from '../../../../.storybook/PhoneFrame';
import { resetStubData, setStubData } from '../../../../.storybook/stubs/supabase';
import SettingsScreen from '../screens/SettingsScreen';

// ── Helpers ───────────────────────────────────────────────────────────────────

const FAKE_USER_ID = 'story-user-me';
const FAKE_SESSION = { user: { id: FAKE_USER_ID } };
const FAKE_USERS_ROW = { id: FAKE_USER_ID, beta_video_privacy: 'public' };

/** Seeds stub data synchronously during render so component effects see it. */
function seedPopulated(): void {
  resetStubData();
  setStubData('auth:session', FAKE_SESSION);
  setStubData('users', FAKE_USERS_ROW);
}

function PopulatedWrapper(): React.JSX.Element {
  seedPopulated();
  return <SettingsScreen onBack={() => {}} />;
}

/**
 * Patches supabase.auth.signOut to never resolve so the Logout button stays in
 * its loading state after it is pressed. The button is clicked via the DOM after
 * mount. The patch is removed when the story unmounts.
 */
function LoggingOutWrapper(): React.JSX.Element {
  seedPopulated();

  React.useEffect(() => {
    const origSignOut = supabase.auth.signOut;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.auth as Record<string, any>).signOut = (): Promise<never> =>
      new Promise<never>(() => {});

    const timer = setTimeout(() => {
      // Logout button is the last [role="button"] element on the page.
      const allButtons = document.querySelectorAll('[role="button"]');
      const logoutBtn = allButtons[allButtons.length - 1] as HTMLElement | undefined;
      logoutBtn?.click();
    }, 200);

    return () => {
      clearTimeout(timer);
      supabase.auth.signOut = origSignOut;
    };
  }, []);

  return <SettingsScreen onBack={() => {}} />;
}

// ── Meta ───────────────────────────────────────────────────────────────────────

const meta: Meta = {
  title: 'Pages/Settings & Notifications/Settings',
  component: SettingsScreen as never, // real component; stories only drive the stub data
  tags: ['!autodocs'],
  parameters: { layout: 'centered', page: { overlay: true } },
  decorators: [withPhoneFrame],
};
export default meta;

type Story = StoryObj;

/** All controls visible: language picker, appearance picker, Blocked Accounts row, Beta Video Privacy toggle, Logout button. */
export const Populated: Story = {
  render: () => <PopulatedWrapper />,
};

/** Logout button is disabled and shows a loading spinner: the state while signOut is in flight. */
export const LoggingOut: Story = {
  name: 'Logging Out',
  render: () => <LoggingOutWrapper />,
};
