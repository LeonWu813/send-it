/**
 * Test utilities for mod-gym-directory screen tests.
 *
 * Provides a wrapper that supplies ThemeProvider and i18n initialization
 * so that components using useTheme() and useTranslation() work in tests.
 */

import React from 'react';

// Initialize i18n before component renders
import '../../lib/i18n';
import { ThemeProvider } from '../../lib/theme';

interface WrapperProps {
  children: React.ReactNode;
}

/**
 * Wraps children with the providers required by gym directory screens:
 * - ThemeProvider (required for useTheme())
 * - i18n (initialized via side-effect import above)
 */
export function TestProviders({ children }: WrapperProps): React.JSX.Element {
  return <ThemeProvider>{children}</ThemeProvider>;
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
