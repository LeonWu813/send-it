/**
 * UnreadCountProvider — React context that owns the unread notification count
 * for the bell icon badge in MOD-012's global app-level header (AC-173, Rev 35).
 *
 * Provides:
 *   unreadCount: number   — count of Notification rows where is_read = false
 *                           for the current user; 0 when signed out.
 *   refresh(): void       — re-fetches the unread count from the DB; called by
 *                           NotificationInboxScreen after AC-172 batch mark-read
 *                           so the badge clears when the inbox is opened.
 *
 * Lifecycle:
 *   - On mount: fetches initial count via fetchUnreadNotificationCount().
 *   - Polling: re-fetches every 30 seconds to stay live (interval cleared on unmount).
 *   - SIGNED_OUT: resets count to 0 immediately when the user signs out, per the
 *     auth-clear caching convention (AC-173, Rev 35).
 *
 * Mounting point: MOD-012's AppShell (inside the component wrapping the global
 * header) — wired by MOD-012's engineer. Export the provider and hook here;
 * the mount site is owned by MOD-012.
 *
 * Usage:
 *   // In MOD-012's AppShell (mount point, wired by MOD-012):
 *   <UnreadCountProvider session={session}>
 *     ...
 *   </UnreadCountProvider>
 *
 *   // In MOD-012's global header bell icon:
 *   const count = useUnreadCount();
 *
 *   // In NotificationInboxScreen after AC-172 batch mark-read:
 *   const { refresh } = useUnreadCountContext();
 *   refresh();
 */

import type { Session } from '@supabase/supabase-js';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import { supabase } from '../../lib/supabase';
import { fetchUnreadNotificationCount } from './notification-service';

// ── Constants ─────────────────────────────────────────────────────────────────

/** Poll interval in milliseconds (30 seconds). */
const POLL_INTERVAL_MS = 30_000;

// ── Context type ──────────────────────────────────────────────────────────────

interface UnreadCountContextValue {
  /** Current unread notification count for the bell badge. 0 when signed out. */
  unreadCount: number;
  /**
   * Re-fetches the unread count from the DB.
   *
   * Call this after the AC-172 batch mark-read fires on NotificationInboxScreen
   * mount so the badge reflects the post-read state immediately.
   */
  refresh: () => void;
}

// ── Context ───────────────────────────────────────────────────────────────────

const UnreadCountContext = createContext<UnreadCountContextValue | undefined>(undefined);

// ── Provider ──────────────────────────────────────────────────────────────────

interface UnreadCountProviderProps {
  /**
   * The current authenticated session. When null (signed out), the provider
   * resets the count to 0 immediately — no DB query is made.
   */
  session: Session | null;
  children: React.ReactNode;
}

/**
 * UnreadCountProvider — mounts at the AppShell level (wired by MOD-012).
 *
 * Fetches the initial count on mount, then polls every 30 seconds.
 * Resets to 0 on SIGNED_OUT.
 */
export function UnreadCountProvider({
  session,
  children,
}: UnreadCountProviderProps): React.JSX.Element {
  const [unreadCount, setUnreadCount] = useState(0);
  // Track the session user ID to detect sign-out transitions.
  const prevUserIdRef = useRef<string | null | undefined>(session?.user?.id);

  /**
   * Fetch the current unread count from the DB and update state.
   * Silent on error — badge is non-critical (mirrors fetchUnreadNotificationCount).
   */
  const doFetch = useCallback(async (): Promise<void> => {
    const count = await fetchUnreadNotificationCount();
    setUnreadCount(count);
  }, []);

  /**
   * Public refresh function — re-fetches the count.
   * Called by NotificationInboxScreen after AC-172 batch mark-read.
   */
  const refresh = useCallback((): void => {
    void doFetch();
  }, [doFetch]);

  // ── Auth-clear on SIGNED_OUT ──────────────────────────────────────────────

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setUnreadCount(0);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // ── Initial fetch + polling ───────────────────────────────────────────────

  useEffect(() => {
    if (!session?.user?.id) {
      // No authenticated user — reset to 0 and skip fetching.
      setUnreadCount(0);
      prevUserIdRef.current = null;
      return;
    }

    const currentUserId = session.user.id;

    // When the user changes (e.g. account switch), reset before fetching.
    if (prevUserIdRef.current !== currentUserId) {
      setUnreadCount(0);
      prevUserIdRef.current = currentUserId;
    }

    // Initial fetch.
    void doFetch();

    // Poll every 30 seconds to keep the count live without realtime setup.
    const intervalId = setInterval(() => {
      void doFetch();
    }, POLL_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
    };
  }, [session?.user?.id, doFetch]);

  // ── Context value ─────────────────────────────────────────────────────────

  const value: UnreadCountContextValue = {
    unreadCount,
    refresh,
  };

  return (
    <UnreadCountContext.Provider value={value}>
      {children}
    </UnreadCountContext.Provider>
  );
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

/**
 * useUnreadCount — returns the current unread notification count.
 *
 * For consumers that only need the count (e.g. MOD-012's bell badge).
 * Must be called inside a component mounted under UnreadCountProvider.
 *
 * @throws {Error} if called outside UnreadCountProvider.
 */
export function useUnreadCount(): number {
  const ctx = useContext(UnreadCountContext);
  if (ctx === undefined) {
    throw new Error('useUnreadCount must be used within an UnreadCountProvider');
  }
  return ctx.unreadCount;
}

/**
 * useUnreadCountContext — returns the full context value { unreadCount, refresh }.
 *
 * For consumers that need to call refresh() (e.g. NotificationInboxScreen
 * after AC-172 batch mark-read). Must be called inside a component mounted
 * under UnreadCountProvider.
 *
 * @throws {Error} if called outside UnreadCountProvider.
 */
export function useUnreadCountContext(): UnreadCountContextValue {
  const ctx = useContext(UnreadCountContext);
  if (ctx === undefined) {
    throw new Error('useUnreadCountContext must be used within an UnreadCountProvider');
  }
  return ctx;
}
