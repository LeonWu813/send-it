/**
 * AuthNavigator.
 *
 * Root-level navigator for the auth flow.
 *
 * Routing logic (AC-001 revised):
 * - No session → SignIn / SignUp screens
 * - Session → children (app shell, provided by parent)
 *
 * On first run, the user goes directly to the Home tab after authentication —
 * no gym selection step is required (AC-001 revised, PRD Rev 7).
 */

import React, { useState } from 'react';
import { View } from 'react-native';

import { useTheme } from '../../lib/theme';
import { useSession } from './hooks/useSession';
import SignInScreen from './screens/SignInScreen';
import SignUpScreen from './screens/SignUpScreen';

type AuthView = 'signIn' | 'signUp';

interface AuthNavigatorProps {
  /** Rendered when the user is fully authenticated. */
  children: React.ReactNode;
}

export default function AuthNavigator({
  children,
}: AuthNavigatorProps): React.JSX.Element {
  const { theme } = useTheme();
  const { session, isLoading } = useSession();
  const [authView, setAuthView] = useState<AuthView>('signIn');

  // While the initial session is loading there is no header and no content to anchor a spinner to
  // (states-audit-ui 1.4 B #9): draw only the page background, matching the launch screen.
  if (isLoading) {
    return <View style={{ flex: 1, backgroundColor: theme.colors.background }} />;
  }

  // No session → show auth screens
  if (!session) {
    if (authView === 'signUp') {
      return (
        <SignUpScreen onNavigateSignIn={() => setAuthView('signIn')} />
      );
    }
    return (
      <SignInScreen
        onNavigateSignUp={() => setAuthView('signUp')}
      />
    );
  }

  // Authenticated — render the app shell (children).
  // Session and profile are available via useSession() singleton in child components.
  return <>{children}</>;
}
