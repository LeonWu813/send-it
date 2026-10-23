/**
 * Tests for ThemeProvider — setThemeUserId stability (INT-030 regression pin).
 *
 * Verifies that setThemeUserId is referentially stable across ThemeProvider
 * re-renders so that AppShell's useEffect([session.user.id, setThemeUserId])
 * does NOT trigger its cleanup (setThemeUserId(null) + applySignedOutLanguage())
 * on unrelated re-renders (e.g. a theme-override state change).
 *
 * Root cause of INT-030: without useCallback, every ThemeProvider render
 * creates a new setThemeUserId function reference. AppShell's useEffect has
 * setThemeUserId in its deps, so the changed reference triggers the cleanup
 * path — running applySignedOutLanguage() while the user is still signed in.
 *
 * Fix: wrap setThemeUserId in useCallback(fn, []) — empty deps are correct
 * because setUserId (the inner useState setter) is stable per React guarantee.
 */

// jest.mock must hoist above imports.
jest.mock('../i18n', () => {
  const actual = jest.requireActual('../i18n');
  return {
    ...actual,
    applySignedOutLanguage: jest.fn().mockResolvedValue(undefined),
    loadLanguageForUser: jest.fn().mockResolvedValue(undefined),
  };
});

import React, { useEffect } from 'react';
import { act, render } from '@testing-library/react-native';

import { ThemeProvider, useTheme } from '../theme';
import type { ThemeOverride } from '../theme';
import { applySignedOutLanguage, loadLanguageForUser } from '../i18n';

// ─── Test helpers ─────────────────────────────────────────────────────────────

/**
 * Mirrors AppShell's useEffect pattern (the source of INT-030).
 * When setThemeUserId is not stable, changing any ThemeProvider state (e.g.
 * setOverride) causes a re-render that generates a new function reference,
 * which triggers this effect's cleanup → applySignedOutLanguage() is called
 * while the user is still signed in.
 */
function SessionEffect({ userId }: { userId: string }) {
  const { setThemeUserId } = useTheme();
  useEffect(() => {
    setThemeUserId(userId);
    void loadLanguageForUser(userId);
    return () => {
      setThemeUserId(null);
      void applySignedOutLanguage();
    };
  }, [userId, setThemeUserId]);
  return null;
}

/**
 * Captures setOverride so tests can trigger a ThemeProvider re-render
 * without an additional useEffect that would interfere with the assertion.
 */
let capturedSetOverride: ((v: ThemeOverride) => void) | null = null;
function SetOverrideCapture() {
  const { setOverride } = useTheme();
  capturedSetOverride = setOverride;
  return null;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ThemeProvider — setThemeUserId stability (INT-030)', () => {
  beforeEach(() => {
    capturedSetOverride = null;
    (applySignedOutLanguage as jest.Mock).mockClear();
    (loadLanguageForUser as jest.Mock).mockClear();
  });

  it(
    'does not call applySignedOutLanguage when ThemeProvider re-renders without a session change',
    async () => {
      // Arrange: render ThemeProvider with a session active.
      // render() from RNTL already wraps in act; no outer act wrapper needed.
      render(
        <ThemeProvider>
          <SessionEffect userId="user-abc" />
          <SetOverrideCapture />
        </ThemeProvider>,
      );

      // Wait for initial async effects (loadTheme, loadLanguageForUser) to settle.
      await act(async () => {
        await Promise.resolve();
      });

      // Clear initial-mount calls before the re-render assertion.
      (applySignedOutLanguage as jest.Mock).mockClear();

      // Act: force a ThemeProvider re-render by changing the theme override.
      // With the bug: setThemeUserId is a new function on each render →
      //   useEffect deps changed → cleanup runs → applySignedOutLanguage() called.
      // With the fix: setThemeUserId is stable → deps unchanged → no cleanup.
      await act(async () => {
        capturedSetOverride?.('dark');
      });

      // Assert: applySignedOutLanguage must NOT have been called.
      // A call here means the sign-out cleanup path ran while the user was
      // still signed in — the INT-030 regression.
      expect(applySignedOutLanguage).not.toHaveBeenCalled();
    },
  );

  it('setThemeUserId reference is stable across ThemeProvider re-renders', async () => {
    const refs: Array<(v: string | null) => void> = [];

    function CaptureRef() {
      const { setThemeUserId } = useTheme();
      refs.push(setThemeUserId);
      return null;
    }

    render(
      <ThemeProvider>
        <CaptureRef />
        <SetOverrideCapture />
      </ThemeProvider>,
    );

    await act(async () => {
      await Promise.resolve();
    });

    const refBeforeRerender = refs[refs.length - 1];

    // Force a re-render of ThemeProvider via setOverride state change.
    await act(async () => {
      capturedSetOverride?.('dark');
    });

    const refAfterRerender = refs[refs.length - 1];

    // The function reference must be the same object — useCallback identity.
    expect(refAfterRerender).toBe(refBeforeRerender);
  });
});
