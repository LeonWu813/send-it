/**
 * Test utilities for mod-gym-directory screen tests.
 *
 * Provides a wrapper that supplies ThemeProvider and i18n initialization
 * so that components using useTheme() and useTranslation() work in tests.
 */

import React, { useRef } from 'react';
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

/** Minimal stand-in for AppShell's header: renders the registered back button, title and trailing. */
function HeaderHost({ store }: { store: AppHeaderStore }): React.JSX.Element {
  useAppHeaderStoreVersion(store);
  const config = store.top('gyms')?.config;
  return (
    <View>
      {config?.onBack ? (
        <Pressable accessibilityLabel="Back" onPress={config.onBack}>
          <Text>back</Text>
        </Pressable>
      ) : null}
      {config?.onBack ? <View testID="header-title" accessibilityLabel={config.title} /> : null}
      {config?.trailing}
    </View>
  );
}

/**
 * Wraps children with the providers required by gym directory screens:
 * - ThemeProvider (required for useTheme())
 * - AppHeader store + a header host so useAppHeader wiring (back, title, trailing) is testable
 * - i18n (initialized via side-effect import above)
 */
export function TestProviders({ children }: WrapperProps): React.JSX.Element {
  const store = useRef(new AppHeaderStore(0, 0)).current;
  return (
    <ThemeProvider>
      <AppHeaderProvider value={store}>
        <AppHeaderTabScope tab="gyms">
          <HeaderHost store={store} />
          {children}
        </AppHeaderTabScope>
      </AppHeaderProvider>
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
