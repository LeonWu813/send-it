/**
 * App root.
 *
 * Initializes cross-cutting providers (i18n, ThemeProvider) and then
 * renders the AuthNavigator, which handles session detection and routing.
 */

import React from 'react';
import { Text, View } from 'react-native';

// Initialize i18n — must be imported before any component that uses useTranslation
import './src/lib/i18n';
import AuthNavigator from './src/modules/mod-auth-profile/AuthNavigator';
import { ThemeProvider } from './src/lib/theme';

/**
 * Placeholder for the authenticated app shell.
 * Will be replaced when downstream modules (gym directory, logging, etc.) ship.
 */
function AppShell(): React.JSX.Element {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>Send It — coming soon</Text>
    </View>
  );
}

export default function App(): React.JSX.Element {
  return (
    <ThemeProvider>
      <AuthNavigator>
        <AppShell />
      </AuthNavigator>
    </ThemeProvider>
  );
}
