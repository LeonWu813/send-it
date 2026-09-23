/**
 * RouteNavigator.
 *
 * Root navigator for the route catalog module (MOD-003).
 * Manages local navigation state across three views:
 *   - list   → RouteListScreen (filterable route list for a gym)
 *   - detail → RouteDetailScreen (single route)
 *   - submit → RouteSubmitScreen (single-page submit flow, AC-020/021/043)
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
import type { RouteColor, RouteGrade } from './types';

type RouteView =
  | { name: 'list' }
  | { name: 'detail'; routeId: string }
  | { name: 'submit'; initialGrade?: RouteGrade; initialColorTag?: RouteColor };

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

  /**
   * AC-043: receives the active filter values from RouteListScreen and threads
   * them through to RouteSubmitScreen as pre-fill props.
   */
  function navigateToSubmit(grade?: RouteGrade, colorTag?: RouteColor): void {
    setView({ name: 'submit', initialGrade: grade, initialColorTag: colorTag });
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
          initialGrade={view.initialGrade}
          initialColorTag={view.initialColorTag}
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
