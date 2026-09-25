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
}

// ── Navigator ─────────────────────────────────────────────────────────────────

export default function NotificationsNavigator({
  session,
  initialView = 'inbox',
  isActive = true,
}: NotificationsNavigatorProps): React.JSX.Element {
  const [view, setView] = useState<NotificationsView>(initialView);

  switch (view) {
    case 'preferences':
      return (
        <NotificationPreferenceScreen
          session={session}
          // Preferences screen can navigate back via a future onBack prop —
          // added as a TODO when integrated into the app shell.
        />
      );

    case 'inbox':
    default:
      return (
        <NotificationInboxScreen
          session={session}
          isActive={isActive}
        />
      );
  }
}
