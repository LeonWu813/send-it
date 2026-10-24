/**
 * SettingsScreen stories — design review for MOD-010.
 *
 * States:
 *   Populated  — all controls visible: language picker, appearance picker,
 *                Notifications + Blocked Accounts rows, Beta Video Privacy toggle (subtitle
 *                states the ON effect), destructive Logout row.
 *   Confirm Logout — Logout row pressed: the confirm sheet is open (destructive + cancel).
 *   Logging Out — Logout confirmed: the sheet stays open with the destructive button loading (the row is unchanged). Achieved by
 *                patching supabase.auth.signOut to never resolve, then
 *                programmatically clicking the row and the sheet's confirm after mount.
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

/** Clicks the last Log Out / 登出 button on the page: the row first, then the sheet's confirm. */
function clickLogout(): void {
  const all = Array.from(document.querySelectorAll('[role="button"]')).filter((el) => {
    const label = el.getAttribute('aria-label') ?? el.textContent ?? '';
    return label === 'Log Out' || label === '登出';
  });
  (all[all.length - 1] as HTMLElement | undefined)?.click();
}

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
  return <SettingsScreen onBack={() => {}} onNavigateToNotificationPreferences={() => {}} />;
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

    const timer = setTimeout(() => { clickLogout(); }, 200);
    const confirmTimer = setTimeout(() => { clickLogout(); }, 1200);

    return () => {
      clearTimeout(timer);
      clearTimeout(confirmTimer);
      supabase.auth.signOut = origSignOut;
    };
  }, []);

  return <SettingsScreen onBack={() => {}} onNavigateToNotificationPreferences={() => {}} />;
}

/** Opens the confirm sheet by pressing the Logout row after mount. */
function ConfirmLogoutWrapper(): React.JSX.Element {
  seedPopulated();
  React.useEffect(() => {
    const timer = setTimeout(() => { clickLogout(); }, 200);
    return () => { clearTimeout(timer); };
  }, []);
  return <SettingsScreen onBack={() => {}} onNavigateToNotificationPreferences={() => {}} />;
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

/** All controls visible: language, appearance, Notifications + Blocked Accounts rows, Beta Video Privacy toggle, destructive Logout row. */
export const Populated: Story = {
  render: () => <PopulatedWrapper />,
};

/** Logout row pressed: confirm sheet with destructive Log Out and Cancel. */
export const ConfirmLogout: Story = {
  name: 'Confirm Logout',
  render: () => <ConfirmLogoutWrapper />,
};

/** Confirm sheet stays open with the destructive button in loading (sheet not dismissible): the state while signOut is in flight. */
export const LoggingOut: Story = {
  name: 'Logging Out',
  render: () => <LoggingOutWrapper />,
};
