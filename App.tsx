/**
 * App root.
 *
 * Initializes cross-cutting providers (i18n, ThemeProvider) and then
 * renders the AuthNavigator, which handles session detection and routing.
 */

import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Initialize i18n — must be imported before any component that uses useTranslation
import './src/lib/i18n';
import AuthNavigator from './src/modules/mod-auth-profile/AuthNavigator';
import { useSession } from './src/modules/mod-auth-profile/hooks/useSession';
import GymNavigator from './src/modules/mod-gym-directory/GymNavigator';
import { ThemeProvider } from './src/lib/theme';

/**
 * Authenticated app shell — rendered once the user is fully authenticated
 * and has a session. Renders the gym directory as the home screen (MOD-002).
 * Future modules (route catalog, send logging, etc.) will add tabs here.
 */
function AppShell(): React.JSX.Element | null {
  const { session } = useSession();
  if (!session) {
    return null;
  }
  return <GymNavigator session={session} />;
}

export default function App(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthNavigator>
          <AppShell />
        </AuthNavigator>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
