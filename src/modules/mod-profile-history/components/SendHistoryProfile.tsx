/**
 * SendHistoryProfile — embeddable profile history + stats surface.
 *
 * This is the public entry point for MOD-008 embedded in the Profile tab
 * (ProfileScreen, MOD-001). It wraps ProfileHistoryScreen and owns the
 * FlatList as the scroll container — the caller must NOT wrap this in a
 * ScrollView (that nests a vertical FlatList inside a vertical ScrollView,
 * which triggers the VirtualizedList warning and breaks scroll).
 *
 * Instead, the caller passes any content that should appear above the list
 * via the `listHeaderComponent` prop — ProfileHistoryScreen prepends it
 * inside the FlatList's ListHeaderComponent so everything scrolls together.
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
  /**
   * Optional element prepended above the stats panel inside the FlatList's
   * ListHeaderComponent. Use this to pass profile-header content (avatar,
   * display name, bio, action buttons) from the host screen so that it
   * scrolls with the list rather than nesting a ScrollView.
   */
  listHeaderComponent?: React.ReactElement;
  /**
   * Optional element rendered as the FlatList's ListFooterComponent.
   * Use this to pass footer content (e.g. Logout button) from the host screen.
   */
  listFooterComponent?: React.ReactElement;
  /**
   * Optional callback invoked when the user taps a route card.
   * Passes both the routeId and the gymId so the caller can navigate to the
   * route detail screen within the correct gym's route list.
   */
  onNavigateToRoute?: (routeId: string, gymId: string) => void;
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
  listHeaderComponent,
  listFooterComponent,
  onNavigateToRoute,
}: SendHistoryProfileProps): React.JSX.Element {
  return (
    <ProfileHistoryScreen
      userId={userId}
      isOwnProfile={isOwnProfile}
      refetchKey={refetchKey}
      extraListHeader={listHeaderComponent}
      extraListFooter={listFooterComponent}
      onNavigateToRoute={onNavigateToRoute}
    />
  );
}
