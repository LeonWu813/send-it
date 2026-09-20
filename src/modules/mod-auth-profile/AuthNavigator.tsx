/**
 * AuthNavigator.
 *
 * Root-level navigator for the auth & onboarding flow.
 *
 * Routing logic:
 * - No session → SignIn / SignUp
 * - Session + no home_gym_id → HomeGymSelection (onboarding)
 * - Session + home_gym_id → children (app shell, provided by parent)
 *
 * AC-001: After signup the user is taken to HomeGymSelection before
 * reaching the main app shell.
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useTheme } from '../../lib/theme';
import { useSession } from './hooks/useSession';
import EditProfileScreen from './screens/EditProfileScreen';
import HomeGymSelectionScreen from './screens/HomeGymSelectionScreen';
import SignInScreen from './screens/SignInScreen';
import SignUpScreen from './screens/SignUpScreen';
import type { UserProfile } from './types';

type AuthView = 'signIn' | 'signUp';

interface AuthNavigatorProps {
  /** Rendered when the user is fully authenticated and has selected a home gym (or skipped). */
  children: React.ReactNode;
}

export default function AuthNavigator({
  children,
}: AuthNavigatorProps): React.JSX.Element {
  const { theme } = useTheme();
  const { t } = useTranslation('common');
  const { session, profile, isLoading } = useSession();
  const [authView, setAuthView] = useState<AuthView>('signIn');
  const [localProfile, setLocalProfile] = useState<UserProfile | null>(null);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState(false);

  const styles = StyleSheet.create({
    loadingContainer: {
      flex: 1,
      backgroundColor: theme.colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

  // While initial session is loading, show a spinner
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={theme.colors.primary} size="large" />
      </View>
    );
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

  // Determine the effective profile (prefer localProfile if the user just edited)
  const effectiveProfile = localProfile ?? profile;

  // Session exists but home_gym_id not set AND onboarding not skipped → gym selection
  if (!onboardingComplete && !effectiveProfile?.home_gym_id) {
    return (
      <HomeGymSelectionScreen
        session={session}
        isOnboarding
        onComplete={() => setOnboardingComplete(true)}
      />
    );
  }

  // Edit profile overlay (shown when triggered from the app)
  if (showEditProfile) {
    return (
      <EditProfileScreen
        userId={session.user.id}
        profile={effectiveProfile}
        onSaved={(updated) => {
          setLocalProfile(updated);
          setShowEditProfile(false);
        }}
        onCancel={() => setShowEditProfile(false)}
      />
    );
  }

  // Authenticated and onboarded — render the app shell
  // The children receive the session/profile via their own hooks
  // (useSession is a singleton subscription, not a prop-drilled value)
  return <>{children}</>;
}

// Expose a way to trigger the edit profile flow from child screens.
// This is a simple module-level callback — for Phase 1 a global context
// would be over-engineering; direct navigation props suffice.
// Downstream modules that need to navigate to EditProfile should use
// the navigation stack configured in the root App.tsx.
