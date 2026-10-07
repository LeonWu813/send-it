/**
 * useSession — reactive Supabase session + profile hook.
 *
 * Returns the current session, loading state, and user profile.
 * Subscribes to onAuthStateChange so the UI re-renders automatically
 * when the user signs in or out.
 *
 * AC-054: on SIGNED_IN, requests Expo Push notification permissions and
 * registers the device token (fire-and-forget, never blocks sign-in).
 */

import type { Session } from '@supabase/supabase-js';
import * as Notifications from 'expo-notifications';
import { useEffect, useState } from 'react';

import { supabase } from '../../../lib/supabase';
import { loadProfile } from '../auth-service';
import { registerDeviceToken } from '../../mod-notifications/notification-service';
import type { UserProfile } from '../types';

export interface SessionState {
  session: Session | null;
  profile: UserProfile | null;
  isLoading: boolean;
}

export function useSession(): SessionState {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load initial session
    let cancelled = false;

    async function bootstrap(): Promise<void> {
      try {
        const {
          data: { session: initialSession },
        } = await supabase.auth.getSession();

        if (cancelled) return;

        setSession(initialSession);

        if (initialSession?.user) {
          const userProfile = await loadProfile(initialSession.user.id);
          if (!cancelled) {
            setProfile(userProfile);
          }
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void bootstrap();

    // Subscribe to auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);

      if (newSession?.user) {
        // Reload profile asynchronously; don't block the state update
        void loadProfile(newSession.user.id).then((userProfile) => {
          if (!cancelled) {
            setProfile(userProfile);
          }
        });

        // AC-054: register the device token on every SIGNED_IN event.
        // Fire-and-forget — never block or delay the sign-in flow.
        // Permissions denied or token errors are logged and swallowed.
        if (event === 'SIGNED_IN') {
          void (async () => {
            try {
              const { granted } = await Notifications.requestPermissionsAsync();
              if (!granted) {
                console.log('[useSession] Push notification permission denied — skipping device token registration.');
                return;
              }
              const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync();
              // The expo push token itself serves as the device token for the
              // Expo Push service. The RPC also accepts a raw APNs device_token
              // but Expo Push Token is sufficient for the Expo-managed push path.
              await registerDeviceToken(expoPushToken, expoPushToken);
            } catch (err) {
              // Non-blocking: log the failure and continue. The user is signed in
              // regardless of whether device token registration succeeds.
              console.error('[useSession] Device token registration failed (non-blocking):', err);
            }
          })();
        }
      } else {
        setProfile(null);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return { session, profile, isLoading };
}
