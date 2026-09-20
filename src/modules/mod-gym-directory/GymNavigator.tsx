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
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '../../lib/theme';
import GymDetailScreen from './screens/GymDetailScreen';
import GymListScreen from './screens/GymListScreen';
import RequestGymScreen from './screens/RequestGymScreen';

type GymView =
  | { name: 'list' }
  | { name: 'detail'; gymId: string }
  | { name: 'request' };

interface GymNavigatorProps {
  session: Session;
}

export default function GymNavigator({
  session,
}: GymNavigatorProps): React.JSX.Element {
  const { theme } = useTheme();
  const styles = makeStyles(theme);

  const [view, setView] = useState<GymView>({ name: 'list' });

  function navigateToDetail(gymId: string): void {
    setView({ name: 'detail', gymId });
  }

  function navigateToRequest(): void {
    setView({ name: 'request' });
  }

  function navigateToList(): void {
    setView({ name: 'list' });
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
        <GymDetailScreen gymId={view.gymId} onBack={navigateToList} />
      )}
      {view.name === 'request' && (
        <RequestGymScreen session={session} onBack={navigateToList} />
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
