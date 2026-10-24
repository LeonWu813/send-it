/**
 * HomeNavigator — Tab 1 content navigator.
 *
 * HomeScreen is the only view for Tab 1 in Phase 1.
 *
 * Props forwarded from AppShell:
 *   session                   — active Supabase session.
 *   isActive                  — true when Home tab is active (keep-alive pattern).
 *   onViewAllGyms             — switches AppShell activeTab to 'gyms'.
 *   onSelectGym               — navigates directly to that gym's RouteListScreen (AC-114, AC-176).
 *   onSelectRoute             — navigates to RouteDetailScreen (AC-178).
 *   onSelectClimber           — opens that user's UserProfileScreen overlay (AC-182).
 *   onViewAllFollowing        — opens FollowingListScreen for the signed-in user (home-v2 「查看全部」).
 *   onNavigateToNotifications — opens MOD-007 NotificationInboxScreen (AC-184).
 *   onNavigateToSettings      — opens MOD-010 SettingsScreen (AC-184).
 */

import type { Session } from '@supabase/supabase-js';
import React from 'react';

import HomeScreen from './screens/HomeScreen';

interface HomeNavigatorProps {
  session: Session;
  isActive: boolean;
  onViewAllGyms: () => void;
  onSelectGym: (gymId: string, gymName: string) => void;
  onSelectRoute: (routeId: string, gymId: string) => void;
  onSelectClimber: (userId: string) => void;
  onViewAllFollowing?: (userId: string) => void;
  onNavigateToNotifications: () => void;
  onNavigateToSettings: () => void;
}

export default function HomeNavigator({
  session,
  isActive,
  onViewAllGyms,
  onSelectGym,
  onSelectRoute,
  onSelectClimber,
  onViewAllFollowing,
  onNavigateToNotifications,
  onNavigateToSettings,
}: HomeNavigatorProps): React.JSX.Element {
  // HomeNavigator is the future mount point for additional home sub-views
  // (e.g. a dedicated notifications sub-view). For Phase 1, HomeScreen is
  // the only view.
  void onNavigateToNotifications;
  void onNavigateToSettings;

  return (
    <HomeScreen
      session={session}
      isActive={isActive}
      onViewAllGyms={onViewAllGyms}
      onSelectGym={onSelectGym}
      onSelectRoute={onSelectRoute}
      onSelectClimber={onSelectClimber}
      onViewAllFollowing={onViewAllFollowing}
    />
  );
}
