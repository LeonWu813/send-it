/**
 * ProfileNavigator.
 *
 * Self-contained navigator for Tab 3 (Profile).
 * Mounted by AppShell (MOD-012) as the Profile tab entry point.
 *
 * State machine:
 *   'profile'     → ProfileScreen (default)
 *   'editProfile' → EditProfileScreen
 *   'settings'    → SettingsScreen
 *   'notifications' → NotificationsNavigator
 *   'followers'   → FollowersListScreen (AC-145)
 *   'following'   → FollowingListScreen (AC-145)
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
import React, { useEffect, useState } from 'react';

import { FollowersListScreen, FollowingListScreen } from '../mod-social-feed';
import { NotificationsNavigator } from '../mod-notifications';
import SettingsScreen from '../mod-localization-theme/screens/SettingsScreen';
import { useSession } from './hooks/useSession';
import EditProfileScreen from './screens/EditProfileScreen';
import ProfileScreen from './screens/ProfileScreen';

type ProfileView = 'profile' | 'editProfile' | 'settings' | 'notifications' | 'followers' | 'following';

interface ProfileNavigatorProps {
  /** The active Supabase session, threaded from AppShell. */
  session: Session;
  /** True when the Profile tab is the active tab (keep-alive pattern). */
  isActive?: boolean;
  /**
   * Callback invoked when the user taps a route card in the profile history
   * surface. Switches to the Gyms tab and opens the route detail screen within
   * the correct gym's route list.
   */
  onNavigateToRoute?: (routeId: string, gymId: string) => void;
  /**
   * Callback invoked when the user taps a climber card in the Followers or
   * Following list screens. Opens the target user's profile overlay (AC-123).
   * Threaded from AppShell which owns the single "open another user's profile"
   * action per the User-Profile Navigation convention.
   */
  onNavigateToUser?: (userId: string) => void;
}

export default function ProfileNavigator({
  session,
  isActive = false,
  onNavigateToRoute,
  onNavigateToUser,
}: ProfileNavigatorProps): React.JSX.Element {
  const [view, setView] = useState<ProfileView>('profile');
  const { profile } = useSession();

  // Reset to the main profile view each time the Profile tab becomes active.
  // The keep-alive mount strategy (display:none) preserves component state
  // across tab switches, so without this reset the user would return to
  // whichever sub-view (settings, notifications, followers, following) they
  // left the tab on — rather than the expected main profile surface.
  useEffect(() => {
    if (isActive) setView('profile');
  }, [isActive]);

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

  if (view === 'settings') {
    return <SettingsScreen onBack={() => setView('profile')} />;
  }

  if (view === 'notifications') {
    return (
      <NotificationsNavigator
        session={session}
        isActive={isActive}
        onBack={() => setView('profile')}
        onNavigateToUser={onNavigateToUser}
      />
    );
  }

  if (view === 'followers') {
    return (
      <FollowersListScreen
        userId={session.user.id}
        onBack={() => setView('profile')}
        onNavigateToUser={onNavigateToUser ?? ((_id: string) => undefined)}
      />
    );
  }

  if (view === 'following') {
    return (
      <FollowingListScreen
        userId={session.user.id}
        onBack={() => setView('profile')}
        onNavigateToUser={onNavigateToUser ?? ((_id: string) => undefined)}
      />
    );
  }

  return (
    <ProfileScreen
      session={session}
      isActive={isActive}
      onNavigateEditProfile={() => setView('editProfile')}
      onNavigateToRoute={onNavigateToRoute}
      onNavigateToFollowers={() => setView('followers')}
      onNavigateToFollowing={() => setView('following')}
    />
  );
}
