/**
 * Tests for SettingsScreen (MOD-010).
 *
 * Covers: handleLogout (INT-031) — signOut() is called regardless of whether
 * the device-preference saves (saveDeviceLanguage / saveDeviceTheme) succeed
 * or throw. Also verifies that a signOut failure surfaces an error message.
 *
 * Mocks:
 *   - @/lib/AppHeaderContext (useAppHeader, useHeaderContentInset, useTabBarInset)
 *   - @expo/vector-icons (Ionicons)
 *   - src/lib/supabase (auth.getSession — no session so useEffects are minimal)
 *   - src/lib/devicePrefs (saveLanguage, saveTheme — the functions under test)
 *   - src/modules/mod-auth-profile (signOut, updateBetaVideoPrivacy)
 *   - src/components/ui/Button (simplified Pressable so tests can press it)
 *   - src/components/SwipeBackWrapper (pass-through View)
 *   - src/modules/mod-localization-theme/settings-storage (load/save stubs)
 *   - src/modules/mod-localization-theme/screens/BlockedAccountsScreen (stub View)
 */

// ── Mocks (must be declared before any module imports) ────────────────────────

jest.mock('@/lib/AppHeaderContext', () => ({
  useAppHeader: jest.fn(),
  useHeaderContentInset: jest.fn(() => 0),
  useTabBarInset: jest.fn(() => ({ contentBottom: 0, indicatorBottom: 0 })),
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

jest.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null }),
    })),
  },
}));

// devicePrefs: the two save helpers are the functions under test in INT-031.
jest.mock('../../../lib/devicePrefs', () => ({
  saveLanguage: jest.fn(),
  saveTheme: jest.fn(),
  loadLanguage: jest.fn().mockResolvedValue(null),
  loadTheme: jest.fn().mockResolvedValue(null),
}));

jest.mock('../../mod-auth-profile', () => ({
  signOut: jest.fn(),
  updateBetaVideoPrivacy: jest.fn(),
}));

// Simplified Button: renders a pressable whose accessible name equals its label.
// This avoids coupling the test to PressableScale internals.
jest.mock('../../../components/ui/Button', () => {
  const React = require('react');
  const { Pressable, Text } = require('react-native');
  return {
    Button: ({
      label,
      onPress,
    }: {
      label: string;
      onPress: () => void;
    }) =>
      React.createElement(
        Pressable,
        {
          onPress,
          accessibilityRole: 'button',
          accessibilityLabel: label,
        },
        React.createElement(Text, null, label),
      ),
  };
});

// SwipeBackWrapper: pass-through so tests render the screen content directly.
jest.mock('../../../components/SwipeBackWrapper', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) =>
      React.createElement(View, null, children),
  };
});

// settings-storage: stub all four helpers so mount effects are no-ops.
jest.mock('../settings-storage', () => ({
  loadLanguage: jest.fn().mockResolvedValue(null),
  saveLanguage: jest.fn().mockResolvedValue(undefined),
  loadThemeOverride: jest.fn().mockResolvedValue(null),
  saveThemeOverride: jest.fn().mockResolvedValue(undefined),
}));

// BlockedAccountsScreen: stub so the sub-view early-return path is inert.
// Path is relative to the test file (in __tests__/), so '../screens/' resolves
// to the same module that SettingsScreen imports as './BlockedAccountsScreen'.
jest.mock('../screens/BlockedAccountsScreen', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { __esModule: true, default: () => React.createElement(View, null) };
});

// ── Imports ───────────────────────────────────────────────────────────────────
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

import { ThemeProvider } from '../../../lib/theme';
import SettingsScreen from '../screens/SettingsScreen';
import * as devicePrefs from '../../../lib/devicePrefs';
import * as authProfile from '../../mod-auth-profile';

// ── Typed mock helpers ────────────────────────────────────────────────────────
const mockSaveLanguage = devicePrefs.saveLanguage as jest.MockedFunction<
  typeof devicePrefs.saveLanguage
>;
const mockSaveTheme = devicePrefs.saveTheme as jest.MockedFunction<
  typeof devicePrefs.saveTheme
>;
const mockSignOut = authProfile.signOut as jest.MockedFunction<typeof authProfile.signOut>;

// ── Test wrapper ──────────────────────────────────────────────────────────────
function TestWrapper({ children }: { children: React.ReactNode }): React.JSX.Element {
  return React.createElement(ThemeProvider, null, children);
}

// Logout is a destructive row: the first press opens a confirm sheet, the last 'Log Out' button confirms.
function pressLogoutAndConfirm(): void {
  fireEvent.press(screen.getByRole('button', { name: 'Log Out' }));
  const buttons = screen.getAllByRole('button', { name: 'Log Out' });
  fireEvent.press(buttons[buttons.length - 1]);
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('SettingsScreen — handleLogout (INT-031)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSaveLanguage.mockResolvedValue(undefined);
    mockSaveTheme.mockResolvedValue(undefined);
    mockSignOut.mockResolvedValue(undefined);
  });

  it('calls signOut after both device-preference saves succeed', async () => {
    render(<SettingsScreen onBack={jest.fn()} />, { wrapper: TestWrapper });

    pressLogoutAndConfirm();

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalledTimes(1);
    });
    expect(mockSaveLanguage).toHaveBeenCalledTimes(1);
    expect(mockSaveTheme).toHaveBeenCalledTimes(1);
  });

  it('calls signOut even when saveDeviceLanguage rejects', async () => {
    mockSaveLanguage.mockRejectedValue(new Error('AsyncStorage failure'));

    render(<SettingsScreen onBack={jest.fn()} />, { wrapper: TestWrapper });

    pressLogoutAndConfirm();

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalledTimes(1);
    });
  });

  it('calls signOut even when saveDeviceTheme rejects', async () => {
    mockSaveTheme.mockRejectedValue(new Error('AsyncStorage failure'));

    render(<SettingsScreen onBack={jest.fn()} />, { wrapper: TestWrapper });

    pressLogoutAndConfirm();

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalledTimes(1);
    });
  });

  it('calls signOut even when both device-preference saves reject', async () => {
    mockSaveLanguage.mockRejectedValue(new Error('Language save failed'));
    mockSaveTheme.mockRejectedValue(new Error('Theme save failed'));

    render(<SettingsScreen onBack={jest.fn()} />, { wrapper: TestWrapper });

    pressLogoutAndConfirm();

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalledTimes(1);
    });
  });

  it('displays the error message returned by signOut when signOut fails', async () => {
    mockSignOut.mockRejectedValue(new Error('Network unavailable'));

    render(<SettingsScreen onBack={jest.fn()} />, { wrapper: TestWrapper });

    pressLogoutAndConfirm();

    // Assert: error text is surfaced to the user.
    await waitFor(() => {
      expect(screen.getByText('Network unavailable')).toBeTruthy();
    });
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });
});
