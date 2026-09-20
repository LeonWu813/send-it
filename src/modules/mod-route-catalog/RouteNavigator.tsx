/**
 * RouteNavigator.
 *
 * Root navigator for the route catalog module (MOD-003).
 * Manages local navigation state across four views:
 *   - list   → RouteListScreen (filterable route list for a gym)
 *   - detail → RouteDetailScreen (single route)
 *   - submit → RouteSubmitScreen (match-before-create flow)
 *
 * This navigator is rendered from within the gym detail context (e.g. a tab
 * or section within GymDetailScreen in MOD-002). It receives gymId + gymName
 * from the parent and the user session from the app shell.
 *
 * Note: Phase 1 uses local state for navigation within the module to avoid
 * introducing a navigation library dependency not yet in the production.md
 * tech stack.
 */

import type { Session } from '@supabase/supabase-js';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '../../lib/theme';
import RouteDetailScreen from './screens/RouteDetailScreen';
import RouteListScreen from './screens/RouteListScreen';
import RouteSubmitScreen from './screens/RouteSubmitScreen';

type RouteView =
  | { name: 'list' }
  | { name: 'detail'; routeId: string }
  | { name: 'submit' };

interface RouteNavigatorProps {
  gymId: string;
  gymName: string;
  session: Session;
  onBackToGym: () => void;
}

export default function RouteNavigator({
  gymId,
  gymName,
  session,
  onBackToGym,
}: RouteNavigatorProps): React.JSX.Element {
  const { theme } = useTheme();
  const styles = makeStyles(theme);

  const [view, setView] = useState<RouteView>({ name: 'list' });

  function navigateToDetail(routeId: string): void {
    setView({ name: 'detail', routeId });
  }

  function navigateToSubmit(): void {
    setView({ name: 'submit' });
  }

  function navigateToList(): void {
    setView({ name: 'list' });
  }

  function handleSubmitSuccess(routeId: string): void {
    // After successful submission, navigate to the new route's detail page
    setView({ name: 'detail', routeId });
  }

  return (
    <View style={styles.root}>
      {view.name === 'list' && (
        <RouteListScreen
          gymId={gymId}
          gymName={gymName}
          onSelectRoute={navigateToDetail}
          onSubmitRoute={navigateToSubmit}
          onBack={onBackToGym}
        />
      )}
      {view.name === 'detail' && (
        <RouteDetailScreen
          routeId={view.routeId}
          gymName={gymName}
          session={session}
          onBack={navigateToList}
        />
      )}
      {view.name === 'submit' && (
        <RouteSubmitScreen
          gymId={gymId}
          gymName={gymName}
          session={session}
          onBack={navigateToList}
          onSuccess={handleSubmitSuccess}
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
