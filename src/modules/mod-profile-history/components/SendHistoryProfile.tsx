/**
 * SendHistoryProfile — embeddable profile history + stats surface.
 *
 * This is the public entry point for MOD-008 embedded in the Profile tab
 * (ProfileScreen, MOD-001). It wraps ProfileHistoryScreen for mounting
 * inside a ScrollView-based profile page.
 *
 * When standalone = false (default), it is embedded inline inside
 * ProfileScreen's ScrollView. The screen itself provides top-inset handling,
 * so we do NOT apply topInset here to avoid double padding.
 *
 * AC-062: refetchKey — the parent ProfileScreen can bump this number after
 * a new ascent is logged (from MOD-004 LogSend flow) so stats recalculate
 * without a manual refresh.
 */

import React from 'react';

import ProfileHistoryScreen from '../screens/ProfileHistoryScreen';

interface SendHistoryProfileProps {
  /** UUID of the user whose history to display. */
  userId: string;
  /** True when this is the current user's own profile tab. */
  isOwnProfile: boolean;
  /**
   * Increment to trigger an immediate refetch of history + stats.
   * Parent should bump this after any new ascent is inserted (AC-062).
   */
  refetchKey?: number;
}

/**
 * Embeddable profile history component for the Profile tab (MOD-001).
 *
 * Cross-module import rule: MOD-001 imports this component from the
 * MOD-008 barrel index, not from the internal screens/ path directly.
 */
export default function SendHistoryProfile({
  userId,
  isOwnProfile,
  refetchKey = 0,
}: SendHistoryProfileProps): React.JSX.Element {
  return (
    <ProfileHistoryScreen
      userId={userId}
      isOwnProfile={isOwnProfile}
      refetchKey={refetchKey}
    />
  );
}
