/**
 * Navigation hook for the Profile History pushed view (page-review P-1).
 *
 * AppShell provides `ProfileHistoryNavProvider` with an `open(userId)` callback that mounts
 * `ProfileHistoryView` as an overlay. Hosts (auth-profile, social-feed) call
 * `useOpenProfileHistory()` and wire it to the compact StatsPanel's `onOpenDetails`:
 *
 *   const openHistory = useOpenProfileHistory();
 *   <StatsPanel variant="compact" stats={stats} onOpenDetails={() => openHistory(profile.id, true)} />
 *
 * Outside AppShell (tests, stories) the hook returns a no-op.
 */

import React, { createContext, useContext } from 'react';

/** Opens Profile History for `userId`; `isOwnProfile` skips the privacy gate for self. */
export type OpenProfileHistory = (userId: string, isOwnProfile: boolean) => void;

const noop: OpenProfileHistory = () => undefined;

const ProfileHistoryNavContext = createContext<OpenProfileHistory>(noop);

export function ProfileHistoryNavProvider({
  open,
  children,
}: {
  open: OpenProfileHistory;
  children: React.ReactNode;
}): React.JSX.Element {
  return <ProfileHistoryNavContext.Provider value={open}>{children}</ProfileHistoryNavContext.Provider>;
}

export function useOpenProfileHistory(): OpenProfileHistory {
  return useContext(ProfileHistoryNavContext);
}
