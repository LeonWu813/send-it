/**
 * NotificationsNavigator — Entry-point navigator for MOD-007.
 *
 * Manages the local view state for the notifications module using the
 * state-machine-per-navigator pattern (useState<NotificationsView>).
 *
 * Views:
 *   'inbox'      — NotificationInboxScreen (in-app notification list)
 *   'preferences' — NotificationPreferenceScreen (push preference toggles, AC-057)
 *
 * This component is the public navigator entry point for MOD-007.
 * Other modules mount this component; they do not import screens directly.
 */

import type { Session } from '@supabase/supabase-js';
import React, { useState } from 'react';

import NotificationInboxScreen from './screens/NotificationInboxScreen';
import NotificationPreferenceScreen from './screens/NotificationPreferenceScreen';

// ── Types ─────────────────────────────────────────────────────────────────────

export type NotificationsView = 'inbox' | 'preferences';

interface NotificationsNavigatorProps {
  session: Session;
  /** Initial view — defaults to 'inbox'. */
  initialView?: NotificationsView;
  isActive?: boolean;
  /**
   * Callback invoked when the user taps the back button in the nested header (inbox or preferences).
   * Returns the caller (e.g. ProfileNavigator) to its previous view.
   */
  onBack?: () => void;
  /**
   * Callback invoked when the user taps a notification row to navigate to the
   * actor's UserProfileScreen (AC-058, Rev 32). The actor_user_id is resolved
   * directly from the Notification row. Threaded from AppShell via
   * handleSelectClimber — opens MOD-006's UserProfileScreen overlay.
   */
  onNavigateToUser?: (userId: string) => void;
}

// ── Navigator ─────────────────────────────────────────────────────────────────

export default function NotificationsNavigator({
  session,
  initialView = 'inbox',
  isActive = true,
  onBack,
  onNavigateToUser,
}: NotificationsNavigatorProps): React.JSX.Element {
  const [view, setView] = useState<NotificationsView>(initialView);

  switch (view) {
    case 'preferences':
      return (
        <NotificationPreferenceScreen
          session={session}
          // N-1: back returns to the opener (Settings) via the overlay's onBack.
          onBack={onBack}
        />
      );

    case 'inbox':
    default:
      return (
        <NotificationInboxScreen
          session={session}
          isActive={isActive}
          onBack={onBack}
          onNavigateToUser={onNavigateToUser}
        />
      );
  }
}
