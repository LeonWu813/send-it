/**
 * App root.
 *
 * Initializes cross-cutting providers (i18n, ThemeProvider) and then
 * renders the AuthNavigator, which handles session detection and routing.
 *
 * Composition hierarchy:
 *   SafeAreaProvider → ThemeProvider → AuthNavigator → AppShell (MOD-012)
 *
 * AppShell owns the persistent three-tab navigation shell (MOD-012, AC-110).
 * App.tsx is the composition root only — navigator-selection logic lives in AppShell.
 */

import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Initialize i18n — must be imported before any component that uses useTranslation
import './src/lib/i18n';
import 'expo-blob';
import AuthNavigator from './src/modules/mod-auth-profile/AuthNavigator';
import { useSession } from './src/modules/mod-auth-profile/hooks/useSession';
import AppShell from './src/modules/mod-home/AppShell';
import { ThemeProvider } from './src/lib/theme';

/**
 * Authenticated shell wrapper — reads the session singleton and passes it
 * to AppShell. Returns null if there is no session (AuthNavigator controls
 * whether this is rendered at all, so null is a safety guard only).
 */
function AuthenticatedApp(): React.JSX.Element | null {
  const { session } = useSession();
  if (!session) {
    return null;
  }
  return <AppShell session={session} />;
}

export default function App(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthNavigator>
          <AuthenticatedApp />
        </AuthNavigator>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
