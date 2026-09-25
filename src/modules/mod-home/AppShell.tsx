/**
 * AppShell — persistent three-tab bottom navigation shell (MOD-012, AC-110).
 *
 * Tab layout:
 *   Tab 1 (home)    → HomeNavigator (this module)
 *   Tab 2 (gyms)    → GymNavigator  (MOD-002 public entry point)
 *   Tab 3 (profile) → ProfileNavigator (MOD-001 public entry point)
 *
 * Keep-alive mount strategy:
 *   All three tab subtrees are rendered simultaneously. The inactive ones get
 *   `style={{ display: 'none' }}` so React component state (navigation stack,
 *   scroll position) is preserved across tab switches.
 *   Never use conditional unmount — loses state.
 *   Never use `flex: 0` — still lays out and leaks touch targets.
 *
 * Deep-link note (onSelectGym / AC-114):
 *   Tapping a saved gym on HomeScreen switches to the Gyms tab AND passes the
 *   gymId to GymNavigator via the `initialGymId` prop so it opens the gym
 *   detail screen directly. `selectedGymId` is cleared after a short delay so
 *   that subsequent tab switches (without a gym selection) land on the list.
 *
 * Climber profile overlay (onSelectClimber / AC-123):
 *   Tapping a climber chip opens UserProfileScreen from MOD-006 as a
 *   modal-style overlay rendered on top of the current tab content.
 *   `targetUserId` state drives visibility: non-null = overlay open.
 *   The overlay's onBack callback clears `targetUserId` to dismiss it.
 *   This is a Phase 1 approach; a dedicated navigator stack is Phase 2.
 *
 * Cross-module imports:
 *   - GymNavigator from mod-gym-directory (public entry-point component).
 *   - ProfileNavigator from mod-auth-profile (public entry-point component).
 *   - UserProfileScreen from mod-social-feed/UserProfileNavigator (public
 *     module-root entry-point component; does not reach into screens/).
 */

import type { Session } from '@supabase/supabase-js';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ProfileNavigator from '../mod-auth-profile/ProfileNavigator';
import GymNavigator from '../mod-gym-directory/GymNavigator';
import UserProfileScreen from '../mod-social-feed/UserProfileNavigator';
import TabBar, { type TabKey } from './components/TabBar';
import HomeNavigator from './HomeNavigator';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AppShellProps {
  session: Session;
}

// ── Styles (static — defined once, not per-render) ────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  tabContentArea: {
    flex: 1,
  },
  tabContent: {
    flex: 1,
  },
  hidden: {
    display: 'none',
  },
  overlayContainer: {
    ...StyleSheet.absoluteFill,
    // The overlay sits on top of tab content and the tab bar. zIndex ensures
    // it receives touches before the tab bar does.
    zIndex: 10,
  },
});

// ── Component ─────────────────────────────────────────────────────────────────

export default function AppShell({ session }: AppShellProps): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<TabKey>('home');
  /** Non-null while a climber profile overlay is open (AC-123). */
  const [targetUserId, setTargetUserId] = useState<string | null>(null);
  /** When the user taps a saved gym chip on the Home screen, this is set to
   *  the gym ID so GymNavigator can open that gym's detail screen directly
   *  (AC-114 deep-link). The `gymNavKey` counter ensures every tap triggers
   *  a fresh useEffect in GymNavigator even if the same gym is tapped twice
   *  in a row after navigating back to the list. */
  const [selectedGymId, setSelectedGymId] = useState<string | undefined>(undefined);
  const [gymNavKey, setGymNavKey] = useState(0);
  const insets = useSafeAreaInsets();

  function handleViewAllGyms(): void {
    setSelectedGymId(undefined);
    setActiveTab('gyms');
  }

  function handleSelectGym(gymId: string): void {
    // Increment gymNavKey so GymNavigator's useEffect fires on every tap,
    // even if the same gym is tapped twice after the user navigated back to
    // the list. The gymId tells GymNavigator which detail screen to open.
    setSelectedGymId(gymId);
    setGymNavKey((k) => k + 1);
    setActiveTab('gyms');
  }

  function handleSelectClimber(userId: string): void {
    // Open the climber's profile as a modal-style overlay (AC-123).
    setTargetUserId(userId);
  }

  function handleClimberProfileBack(): void {
    setTargetUserId(null);
  }

  return (
    <View style={styles.root}>
      <View style={styles.tabContentArea}>
        {/* Tab 1 — Home */}
        <View style={[styles.tabContent, activeTab !== 'home' && styles.hidden]}>
          <HomeNavigator
            session={session}
            isActive={activeTab === 'home'}
            onViewAllGyms={handleViewAllGyms}
            onSelectGym={handleSelectGym}
            onSelectClimber={handleSelectClimber}
          />
        </View>

        {/* Tab 2 — Gyms */}
        <View style={[styles.tabContent, activeTab !== 'gyms' && styles.hidden]}>
          <GymNavigator
            session={session}
            initialGymId={selectedGymId}
            gymNavKey={gymNavKey}
          />
        </View>

        {/* Tab 3 — Profile */}
        <View style={[styles.tabContent, activeTab !== 'profile' && styles.hidden]}>
          <ProfileNavigator session={session} />
        </View>
      </View>

      <TabBar
        activeTab={activeTab}
        onTabPress={setActiveTab}
        bottomInset={insets.bottom}
      />

      {/* Climber profile overlay — rendered above tab content (AC-123) */}
      {targetUserId !== null && (
        <View style={styles.overlayContainer}>
          <UserProfileScreen
            targetUserId={targetUserId}
            session={session}
            onBack={handleClimberProfileBack}
          />
        </View>
      )}
    </View>
  );
}
