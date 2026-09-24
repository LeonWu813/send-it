/**
 * HomeNavigator — Tab 1 content navigator.
 *
 * HomeScreen is the only view for Tab 1 in Phase 1. Future enhancements
 * (e.g. notification tray, gym detail deep-link from saved-gyms strip) can
 * be added as additional view states here without changing AppShell.
 *
 * Props forwarded from AppShell:
 *   session       — active Supabase session.
 *   onViewAllGyms — switches AppShell activeTab to 'gyms'.
 *   onSelectGym   — switches AppShell activeTab to 'gyms' (deep-link into a
 *                   specific gym is a future enhancement; GymNavigator manages
 *                   its own navigation state).
 */

import type { Session } from '@supabase/supabase-js';
import React from 'react';

import HomeScreen from './screens/HomeScreen';

interface HomeNavigatorProps {
  session: Session;
  isActive: boolean;
  onViewAllGyms: () => void;
  onSelectGym: (gymId: string) => void;
}

export default function HomeNavigator({
  session,
  isActive,
  onViewAllGyms,
  onSelectGym,
}: HomeNavigatorProps): React.JSX.Element {
  return (
    <HomeScreen
      session={session}
      isActive={isActive}
      onViewAllGyms={onViewAllGyms}
      onSelectGym={onSelectGym}
    />
  );
}
