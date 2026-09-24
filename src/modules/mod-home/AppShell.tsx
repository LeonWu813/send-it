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
 * Deep-link note (onSelectGym):
 *   Tapping a saved gym on HomeScreen switches to the Gyms tab.
 *   Navigating directly into a specific gym's detail view is a future
 *   enhancement — GymNavigator manages its own internal navigation state.
 *
 * Cross-module imports:
 *   - GymNavigator from mod-gym-directory (public entry-point component).
 *   - ProfileNavigator from mod-auth-profile (public entry-point component).
 */

import type { Session } from '@supabase/supabase-js';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ProfileNavigator from '../mod-auth-profile/ProfileNavigator';
import GymNavigator from '../mod-gym-directory/GymNavigator';
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
});

// ── Component ─────────────────────────────────────────────────────────────────

export default function AppShell({ session }: AppShellProps): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<TabKey>('home');
  const insets = useSafeAreaInsets();

  function handleViewAllGyms(): void {
    setActiveTab('gyms');
  }

  function handleSelectGym(_gymId: string): void {
    // Switch to the Gyms tab. Deep-linking into a specific gym detail is a
    // future enhancement — GymNavigator manages its own internal state.
    setActiveTab('gyms');
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
          />
        </View>

        {/* Tab 2 — Gyms */}
        <View style={[styles.tabContent, activeTab !== 'gyms' && styles.hidden]}>
          <GymNavigator session={session} />
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
    </View>
  );
}
