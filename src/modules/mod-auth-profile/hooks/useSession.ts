/**
 * useSession — reactive Supabase session + profile hook.
 *
 * Returns the current session, loading state, and user profile.
 * Subscribes to onAuthStateChange so the UI re-renders automatically
 * when the user signs in or out.
 */

import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';

import { supabase } from '../../../lib/supabase';
import { loadProfile } from '../auth-service';
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
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);

      if (newSession?.user) {
        // Reload profile asynchronously; don't block the state update
        void loadProfile(newSession.user.id).then((userProfile) => {
          if (!cancelled) {
            setProfile(userProfile);
          }
        });
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
