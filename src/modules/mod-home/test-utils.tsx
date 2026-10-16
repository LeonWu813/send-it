/**
 * Test utilities for mod-home screen tests.
 *
 * Provides a wrapper that supplies ThemeProvider and i18n initialization
 * so that components using useTheme() and useTranslation() work in tests.
 */

import React from 'react';

// Initialize i18n before component renders
import '../../lib/i18n';
import { ToastProvider } from '../../components/ui/Toast';
import { ThemeProvider } from '../../lib/theme';

interface WrapperProps {
  children: React.ReactNode;
}

/**
 * Wraps children with providers required by Home module screens:
 * - ThemeProvider (required for useTheme())
 * - ToastProvider (HomeScreen shows an error toast when a bookmark save fails)
 * - i18n (initialized via side-effect import above)
 */
export function TestProviders({ children }: WrapperProps): React.JSX.Element {
  return (
    <ThemeProvider>
      <ToastProvider>{children}</ToastProvider>
    </ThemeProvider>
  );
}

/**
 * Returns render options with providers pre-configured.
 * Usage: render(<Component />, renderOptions())
 */
export function renderOptions() {
  return {
    wrapper: TestProviders,
  };
}
