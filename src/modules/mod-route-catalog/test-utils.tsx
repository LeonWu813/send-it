/**
 * Test utilities for mod-route-catalog screen tests.
 *
 * Provides a wrapper that supplies ThemeProvider and i18n initialization
 * so that components using useTheme() and useTranslation() work in tests.
 *
 * react-native-safe-area-context is mocked globally via moduleNameMapper
 * in package.json (points to the library's own jest/mock.tsx), so
 * SafeAreaProvider does not need to be included here.
 */

import React from 'react';
import { Pressable, Text, View } from 'react-native';

// Initialize i18n before component renders
import '../../lib/i18n';
import { ThemeProvider } from '../../lib/theme';
import {
  AppHeaderProvider,
  AppHeaderStore,
  AppHeaderTabScope,
  useAppHeaderStoreVersion,
} from '@/lib/AppHeaderContext';

interface WrapperProps {
  children: React.ReactNode;
}

/**
 * Wraps children with the providers required by route catalog screens:
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

/**
 * Minimal stand-in for AppShell's header: provides an AppHeaderStore + tab scope and renders the
 * top registered header (title, back button wired to `onBack`, trailing control) so screens that
 * delegate their back/title row to `useAppHeader` can still be asserted on.
 */
function HeaderView({ store }: { store: AppHeaderStore }): React.JSX.Element | null {
  useAppHeaderStoreVersion(store);
  const top = store.top('gyms')?.config;
  if (!top) return null;
  return (
    <View testID="app-header">
      {top.onBack ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={top.onBack} />
      ) : null}
      {top.title ? <Text>{top.title}</Text> : null}
      {top.trailing}
    </View>
  );
}

function HeaderHost({ children }: WrapperProps): React.JSX.Element {
  const store = React.useMemo(() => new AppHeaderStore(0, 0), []);
  return (
    <ThemeProvider>
      <AppHeaderProvider value={store}>
        <HeaderView store={store} />
        <AppHeaderTabScope tab="gyms">{children}</AppHeaderTabScope>
      </AppHeaderProvider>
    </ThemeProvider>
  );
}

/** Like renderOptions() but with a header host, for asserting header wiring (title / onBack / trailing). */
export function renderOptionsWithHeader() {
  return {
    wrapper: HeaderHost,
  };
}
