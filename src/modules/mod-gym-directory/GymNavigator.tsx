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
  | { name: 'routes'; gymId: string; gymName: string };

interface GymNavigatorProps {
  session: Session;
  /** When provided, the navigator opens directly on the detail view for this
   *  gym rather than the list. Used by AppShell when the user taps a saved
   *  gym chip on the Home screen (AC-114 deep-link).
   *  `gymNavKey` is incremented by AppShell on every tap so the useEffect
   *  fires even when the same gym is tapped twice after navigating back. */
  initialGymId?: string;
  gymNavKey?: number;
}

export default function GymNavigator({
  session,
  initialGymId,
  gymNavKey,
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
    setView({ name: 'routes', gymId, gymName });
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
          onBackToGym={() => setView({ name: 'detail', gymId: view.gymId })}
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
