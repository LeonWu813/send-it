/**
 * GymNavigator.
 *
 * Root navigator for the gym directory module.
 * Manages local navigation state across three views:
 *   - list   → GymListScreen (searchable directory)
 *   - detail → GymDetailScreen (single gym)
 *   - request → RequestGymScreen ("request a gym" form)
 *
 * This component is rendered by the AppShell (App.tsx) once the user is
 * authenticated and has completed onboarding. Future modules will add tabs
 * alongside this navigator.
 *
 * Note: Phase 1 uses local state for navigation within the gym directory
 * to avoid introducing a navigation library dependency not yet in the
 * production.md tech stack. The AppShell can later wrap this in a tab
 * navigator when downstream modules ship.
 */

import type { Session } from '@supabase/supabase-js';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '../../lib/theme';
import RouteNavigator from '../mod-route-catalog/RouteNavigator';
import GymDetailScreen from './screens/GymDetailScreen';
import GymListScreen from './screens/GymListScreen';
import RequestGymScreen from './screens/RequestGymScreen';

type GymView =
  | { name: 'list' }
  | { name: 'detail'; gymId: string }
  | { name: 'request' }
  /**
   * `fromHome: true`  — arrived via AC-176 Saved Gyms deep-link; back goes to list.
   * `fromHome: false` — arrived via GymDetailScreen "View Routes" button; back goes to detail.
   */
  | { name: 'routes'; gymId: string; gymName: string; fromHome: boolean }
  /**
   * Direct route deep-link view: shows RouteNavigator initialized to a specific
   * route's detail screen. gymId is the real gym ID passed from AppShell so
   * that back from the route detail goes to the route list for that gym.
   */
  | { name: 'route-direct'; routeId: string; gymId: string; routeNavKey: number };

interface GymNavigatorProps {
  session: Session;
  /** When provided, the navigator opens directly on the detail view for this
   *  gym rather than the list. Used by AppShell when the user taps a saved
   *  gym chip on the Home screen (AC-114 deep-link).
   *  `gymNavKey` is incremented by AppShell on every tap so the useEffect
   *  fires even when the same gym is tapped twice after navigating back. */
  initialGymId?: string;
  gymNavKey?: number;
  /**
   * AC-176: When provided, the navigator opens directly on RouteListScreen for
   * this gym, bypassing GymDetailScreen. Used by AppShell when the user taps a
   * saved gym chip on the Home screen Saved Gyms strip. Back from RouteListScreen
   * returns to the gym list (not a detail), since the user arrived from the Home
   * tab with no prior GymDetailScreen in the back stack.
   * `routesNavKey` is incremented on every tap so the useEffect fires even when
   * the same gym is tapped twice after navigating back.
   */
  initialRoutesGymId?: string;
  initialRoutesGymName?: string;
  routesNavKey?: number;
  /**
   * When provided, the navigator opens directly on the route detail screen
   * for this route ID. Used by AppShell when the user taps a route card in
   * the MOD-008 profile history surface.
   * `routeNavKey` is incremented on every tap so the useEffect fires even
   * when the same route is tapped twice after navigating back.
   */
  routeDeepLinkId?: string;
  /**
   * The gym ID for the route identified by routeDeepLinkId. Passed from
   * AppShell alongside the route ID so RouteNavigator can show the correct
   * route list when the user presses back from the route detail screen.
   */
  gymDeepLinkId?: string;
  routeNavKey?: number;
  /**
   * AC-135 (revised): Called when the user taps Row 1 of the reel viewer.
   * Receives the user_id of the video poster. Threaded through to RouteNavigator.
   */
  onNavigateToUser?: (userId: string) => void;
}

export default function GymNavigator({
  session,
  initialGymId,
  gymNavKey,
  initialRoutesGymId,
  initialRoutesGymName,
  routesNavKey,
  routeDeepLinkId,
  gymDeepLinkId,
  routeNavKey,
  onNavigateToUser,
}: GymNavigatorProps): React.JSX.Element {
  const { theme } = useTheme();
  const styles = makeStyles(theme);

  const [view, setView] = useState<GymView>({ name: 'list' });

  // When AppShell passes a new gymNavKey (incremented each time the user taps
  // a saved gym chip on the Home screen), navigate directly to that gym's
  // detail screen. gymNavKey ensures the effect fires even when the same gym
  // is tapped again after navigating back to the list, because gymNavKey
  // always changes while initialGymId might stay the same.
  // initialGymId is read inside the effect but intentionally omitted from
  // deps — gymNavKey is the trigger; initialGymId is just the payload.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (initialGymId) {
      setView({ name: 'detail', gymId: initialGymId });
    }
  }, [gymNavKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // AC-176: Deep-link to a gym's RouteListScreen directly from the Home tab
  // Saved Gyms strip, bypassing GymDetailScreen.
  // routesNavKey is the trigger; initialRoutesGymId and initialRoutesGymName
  // are the payload. Back from RouteListScreen returns to the gym list (not
  // to GymDetailScreen) because the user arrived from the Home tab.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (initialRoutesGymId) {
      setView({
        name: 'routes',
        gymId: initialRoutesGymId,
        gymName: initialRoutesGymName ?? '',
        fromHome: true,
      });
    }
  }, [routesNavKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Deep-link to a specific route detail from MOD-008 profile history.
  // routeNavKey is the trigger; routeDeepLinkId and gymDeepLinkId are the payload.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (routeDeepLinkId) {
      setView({
        name: 'route-direct',
        routeId: routeDeepLinkId,
        gymId: gymDeepLinkId ?? '',
        routeNavKey: routeNavKey ?? 0,
      });
    }
  }, [routeNavKey]); // eslint-disable-line react-hooks/exhaustive-deps

  function navigateToDetail(gymId: string): void {
    setView({ name: 'detail', gymId });
  }

  function navigateToRequest(): void {
    setView({ name: 'request' });
  }

  function navigateToList(): void {
    setView({ name: 'list' });
  }

  function navigateToRoutes(gymId: string, gymName: string): void {
    setView({ name: 'routes', gymId, gymName, fromHome: false });
  }

  return (
    <View style={styles.root}>
      {view.name === 'list' && (
        <GymListScreen
          onSelectGym={navigateToDetail}
          onRequestGym={navigateToRequest}
        />
      )}
      {view.name === 'detail' && (
        <GymDetailScreen
          gymId={view.gymId}
          onBack={navigateToList}
          onViewRoutes={navigateToRoutes}
        />
      )}
      {view.name === 'request' && (
        <RequestGymScreen session={session} onBack={navigateToList} />
      )}
      {view.name === 'routes' && (
        <RouteNavigator
          gymId={view.gymId}
          gymName={view.gymName}
          session={session}
          onBackToGym={
            view.fromHome
              ? navigateToList
              : () => setView({ name: 'detail', gymId: view.gymId })
          }
          onNavigateToUser={onNavigateToUser}
        />
      )}
      {view.name === 'route-direct' && (
        <RouteNavigator
          gymId={view.gymId}
          gymName=""
          session={session}
          onBackToGym={navigateToList}
          initialRouteId={view.routeId}
          routeNavKey={view.routeNavKey}
          onNavigateToUser={onNavigateToUser}
        />
      )}
    </View>
  );
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function makeStyles(theme: ReturnType<typeof useTheme>['theme']) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
  });
}
