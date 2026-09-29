/**
 * ProfileNavigator.
 *
 * Self-contained navigator for Tab 3 (Profile).
 * Mounted by AppShell (MOD-012) as the Profile tab entry point.
 *
 * State machine:
 *   'profile'     → ProfileScreen (default)
 *   'editProfile' → EditProfileScreen
 *
 * Props:
 *   session — the active Supabase session, threaded from AppShell.
 *
 * This follows the same view state machine pattern used by GymNavigator and
 * RouteNavigator: local useState<ProfileView>, no external navigation library.
 *
 * Integration note: AppShell mounts this component as Tab 3 per the keep-alive
 * strategy (display: flex / display: none). Session changes are reactive via
 * useSession() inside child screens.
 */

import type { Session } from '@supabase/supabase-js';
import React, { useState } from 'react';

import { useSession } from './hooks/useSession';
import EditProfileScreen from './screens/EditProfileScreen';
import ProfileScreen from './screens/ProfileScreen';

type ProfileView = 'profile' | 'editProfile';

interface ProfileNavigatorProps {
  /** The active Supabase session, threaded from AppShell. */
  session: Session;
  /** True when the Profile tab is the active tab (keep-alive pattern). */
  isActive?: boolean;
  /**
   * Callback invoked when the user taps a route card in the profile history
   * surface. Switches to the Gyms tab and opens the route detail screen.
   */
  onNavigateToRoute?: (routeId: string) => void;
}

export default function ProfileNavigator({
  session,
  isActive = false,
  onNavigateToRoute,
}: ProfileNavigatorProps): React.JSX.Element {
  const [view, setView] = useState<ProfileView>('profile');
  const { profile } = useSession();

  if (view === 'editProfile') {
    return (
      <EditProfileScreen
        userId={session.user.id}
        profile={profile}
        onSaved={() => {
          // Profile is updated reactively via useSession() — navigate back
          setView('profile');
        }}
        onCancel={() => setView('profile')}
      />
    );
  }

  return (
    <ProfileScreen
      session={session}
      isActive={isActive}
      onNavigateEditProfile={() => setView('editProfile')}
      onNavigateToRoute={onNavigateToRoute}
    />
  );
}
