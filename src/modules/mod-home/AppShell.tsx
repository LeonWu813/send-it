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
 * Global app-level header (AC-184, v2.2 §30): rendered by `HeaderHost` from the AppHeaderContext store
 *   (screens register via `useAppHeader` / `useAppHeaderRoot`; default = tab-root large title).
 *   AppHeader is mounted inside UnreadCountProvider, above the tab-content area.
 *   It renders on all non-exempt screens. The fullscreen reel viewer (AC-133) is
 *   exempt — it renders as a full-screen overlay above AppShell, so the header
 *   is naturally hidden. Auth screens are outside AppShell entirely.
 *
 * UnreadCountProvider (AC-173, AC-184):
 *   Wraps the entire AppShell content so that AppHeader (bell badge) and
 *   NotificationInboxScreen (post-batch-read refresh) share the same context.
 *
 * Notifications overlay (AC-184):
 *   Tapping the bell icon in AppHeader opens NotificationsNavigator as a
 *   full-screen overlay (same pattern as the climber profile overlay).
 *
 * Settings overlay (AC-184):
 *   Tapping the settings icon in AppHeader opens SettingsScreen as a
 *   full-screen overlay.
 *
 * Deep-link note (onSelectGym / AC-176):
 *   Tapping a saved gym chip on HomeScreen switches to the Gyms tab AND passes
 *   gymId + gymName via initialRoutesGymId/initialRoutesGymName props so
 *   GymNavigator opens that gym's RouteListScreen directly. Back from
 *   RouteListScreen returns to the gym list (no GymDetailScreen in the stack).
 *
 * Route deep-link (onSelectRoute / AC-178):
 *   Tapping a projecting route card on HomeScreen switches to the Gyms tab
 *   and opens RouteDetailScreen within the correct gym.
 *
 * Climber profile overlay (onSelectClimber / AC-182):
 *   Tapping a following-activity row opens UserProfileScreen as an overlay.
 *
 * Feedback hosts (design system v1.2, MIGRATION.md §3):
 *   ToastProvider and CelebrationHost are mounted exactly once, here, above the tab bar and all
 *   screens/overlays. Toasts sit `tabBarHeight + toastOffsetAboveTabBar` above the bottom edge.
 *
 * Cross-module imports:
 *   - GymNavigator from mod-gym-directory (public entry-point component).
 *   - ProfileNavigator from mod-auth-profile (public entry-point component).
 *   - UserProfileNavigator from mod-social-feed (public module-root entry point).
 *   - NotificationsNavigator from mod-notifications (public entry-point component).
 *   - UnreadCountProvider from mod-notifications/UnreadCountProvider.
 *   - SettingsScreen from mod-localization-theme/SettingsScreen (module-root
 *     public entry-point; does not reach into screens/).
 *   - AppHeader from this module's components.
 */

import type { Session } from '@supabase/supabase-js';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CelebrationHost } from '../../components/ui/CelebrationHost';
import { ToastProvider } from '../../components/ui/Toast';
import { loadLanguageForUser } from '../../lib/i18n';
import { useTheme } from '../../lib/theme';
import { UnreadCountProvider } from '../mod-notifications/UnreadCountProvider';
import ProfileNavigator from '../mod-auth-profile/ProfileNavigator';
import GymNavigator from '../mod-gym-directory/GymNavigator';
import NotificationsNavigator from '../mod-notifications/NotificationsNavigator';
import UserProfileScreen from '../mod-social-feed/UserProfileNavigator';
import SettingsScreen from '../mod-localization-theme/SettingsScreen';
import AppHeader from './components/AppHeader';
import {
  AppHeaderProvider,
  AppHeaderStore,
  AppHeaderTabScope,
  tabBarBottomGap,
  useAppHeaderStoreVersion,
} from './components/AppHeaderContext';
import { AppHeaderOverlayScope } from './components/AppHeaderOverlayScope';
import TabBar, { TabBarFade, type TabKey } from './components/TabBar';
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

// ── Header host + tab chrome (subscribe to the header store; never wrap the tab content) ──────

interface ChromeProps {
  store: AppHeaderStore;
  activeTab: TabKey;
}

/** Renders the global header for the active tab from whatever its screens registered. */
function HeaderHost({
  store,
  activeTab,
  onNavigateToNotifications,
  onNavigateToSettings,
}: ChromeProps & { onNavigateToNotifications: () => void; onNavigateToSettings: () => void }): React.JSX.Element {
  const { t } = useTranslation('common');
  useAppHeaderStoreVersion(store);
  const entry = store.top(activeTab);
  const config = entry?.config;
  const nested = config?.onBack !== undefined;
  return (
    <AppHeader
      variant={nested ? 'nested' : 'root'}
      title={config?.title ?? t(`tabs.${activeTab}`)}
      onBack={config?.onBack}
      trailing={config?.trailing}
      scrollY={nested ? config?.scrollY : store.rootScrollFor(activeTab)}
      topInset={store.topInset}
      onNavigateToNotifications={onNavigateToNotifications}
      onNavigateToSettings={onNavigateToSettings}
    />
  );
}

/** Floating TabBar + its bottom fade. */
function TabChrome({
  store,
  activeTab,
  onTabPress,
  onBarLayout,
}: ChromeProps & { onTabPress: (tab: TabKey) => void; onBarLayout: (h: number) => void }): React.JSX.Element {
  useAppHeaderStoreVersion(store);
  const hidden = store.isTabBarHidden(activeTab);
  return (
    <>
      <TabBarFade show={!hidden && store.canScrollDown(activeTab)} bottomInset={store.bottomInset} />
      <TabBar
        activeTab={activeTab}
        onTabPress={onTabPress}
        bottomInset={store.bottomInset}
        hidden={hidden}
        onLayout={(e) => onBarLayout(e.nativeEvent.layout.height)}
      />
    </>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AppShell({ session }: AppShellProps): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<TabKey>('home');
  const insets = useSafeAreaInsets();
  const { theme, setThemeUserId } = useTheme();

  // Once the session is known, apply per-user preferences stored in AsyncStorage.
  // - setThemeUserId: tells ThemeProvider to load and persist the user-scoped
  //   theme override key (app_theme_override_<userId>).
  // - loadLanguageForUser: applies the user-scoped language key (app_language_<userId>)
  //   so the i18n language is per-user rather than device-global.
  // Both run once per session — AppShell unmounts on sign-out, which causes
  // ThemeProvider to reset to 'system' on the next login if no preference is saved.
  useEffect(() => {
    setThemeUserId(session.user.id);
    void loadLanguageForUser(session.user.id);
  }, [session.user.id, setThemeUserId]);

  /** Measured TabBar height — toasts float `toastOffsetAboveTabBar` above it. */
  const [tabBarHeight, setTabBarHeight] = useState<number | null>(null);
  const headerStore = useMemo(() => new AppHeaderStore(insets.top, insets.bottom), [insets.top, insets.bottom]);
  const toastBottomOffset =
    tabBarHeight === null
      ? undefined
      : tabBarHeight + tabBarBottomGap(insets.bottom) + theme.componentSize.toastOffsetAboveTabBar;

  /** Non-null while a climber profile overlay is open (AC-182). */
  const [targetUserId, setTargetUserId] = useState<string | null>(null);

  /** Non-null while the notifications overlay is open (AC-184). */
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  /** Non-null while the settings overlay is open (AC-184). */
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Gym deep-link state (AC-114, AC-176): tap a saved gym → Gyms tab + RouteListScreen.
  const [selectedGymId, setSelectedGymId] = useState<string | undefined>(undefined);
  const [gymNavKey, setGymNavKey] = useState(0);

  // AC-176: Routes deep-link state — tap a saved gym chip → Gyms tab + RouteListScreen directly.
  const [selectedRoutesGymId, setSelectedRoutesGymId] = useState<string | undefined>(undefined);
  const [selectedRoutesGymName, setSelectedRoutesGymName] = useState<string | undefined>(undefined);
  const [routesNavKey, setRoutesNavKey] = useState(0);

  // Route deep-link state (AC-178): tap a projecting route → Gyms tab + RouteDetailScreen.
  const [routeDeepLinkId, setRouteDeepLinkId] = useState<string | undefined>(undefined);
  const [gymDeepLinkId, setGymDeepLinkId] = useState<string | undefined>(undefined);
  const [routeNavKey, setRouteNavKey] = useState(0);

  // ── Tab navigation ────────────────────────────────────────────────────────

  function handleViewAllGyms(): void {
    setSelectedGymId(undefined);
    setActiveTab('gyms');
  }

  function handleSelectGym(gymId: string, gymName: string): void {
    // AC-176: Navigate directly to that gym's RouteListScreen via the new
    // initialRoutesGymId prop on GymNavigator. Back from RouteListScreen returns
    // to the gym list (not a GymDetailScreen) since the user came from Home.
    setSelectedRoutesGymId(gymId);
    setSelectedRoutesGymName(gymName);
    setRoutesNavKey((k) => k + 1);
    setActiveTab('gyms');
  }

  const handleSelectRoute = useCallback((routeId: string, gymId: string): void => {
    // Navigate to RouteDetailScreen within the correct gym (AC-178).
    setRouteDeepLinkId(routeId);
    setGymDeepLinkId(gymId);
    setRouteNavKey((k) => k + 1);
    setActiveTab('gyms');
  }, []);

  // ── Overlay callbacks ─────────────────────────────────────────────────────

  function handleSelectClimber(userId: string): void {
    setTargetUserId(userId);
  }

  function handleClimberProfileBack(): void {
    setTargetUserId(null);
  }

  function handleNavigateToNotifications(): void {
    // Close Settings if open so only one overlay is ever active at a time.
    // This gives replace-semantics: the back button always returns to PagePrev,
    // never to a stacked Settings screen.
    setSettingsOpen(false);
    setNotificationsOpen(true);
  }

  function handleNotificationsBack(): void {
    setNotificationsOpen(false);
  }

  function handleNavigateToSettings(): void {
    // Close Notifications if open so only one overlay is ever active at a time.
    setNotificationsOpen(false);
    setSettingsOpen(true);
  }

  function handleSettingsBack(): void {
    setSettingsOpen(false);
  }

  const handleNavigateToRoute = useCallback((routeId: string, gymId: string): void => {
    setRouteDeepLinkId(routeId);
    setGymDeepLinkId(gymId);
    setRouteNavKey((k) => k + 1);
    setActiveTab('gyms');
  }, []);

  return (
    <UnreadCountProvider session={session}>
      <AppHeaderProvider value={headerStore}>
      <ToastProvider bottomOffset={toastBottomOffset}>
        <CelebrationHost>
          <View style={styles.root}>
            {/* Global app-level header (AC-184) — above tab content on all non-exempt screens */}
            <HeaderHost
              store={headerStore}
              activeTab={activeTab}
              onNavigateToNotifications={handleNavigateToNotifications}
              onNavigateToSettings={handleNavigateToSettings}
            />

            <View style={styles.tabContentArea}>
              {/* Tab 1 — Home */}
              <View style={[styles.tabContent, activeTab !== 'home' && styles.hidden]}>
                <AppHeaderTabScope tab="home">
                <HomeNavigator
                  session={session}
                  isActive={activeTab === 'home'}
                  onViewAllGyms={handleViewAllGyms}
                  onSelectGym={handleSelectGym}
                  onSelectRoute={handleSelectRoute}
                  onSelectClimber={handleSelectClimber}
                  onNavigateToNotifications={handleNavigateToNotifications}
                  onNavigateToSettings={handleNavigateToSettings}
                />
                </AppHeaderTabScope>
              </View>

              {/* Tab 2 — Gyms */}
              <View style={[styles.tabContent, activeTab !== 'gyms' && styles.hidden]}>
                <AppHeaderTabScope tab="gyms">
                <GymNavigator
                  session={session}
                  initialGymId={selectedGymId}
                  gymNavKey={gymNavKey}
                  initialRoutesGymId={selectedRoutesGymId}
                  initialRoutesGymName={selectedRoutesGymName}
                  routesNavKey={routesNavKey}
                  routeDeepLinkId={routeDeepLinkId}
                  gymDeepLinkId={gymDeepLinkId}
                  routeNavKey={routeNavKey}
                  onNavigateToUser={handleSelectClimber}
                />
                </AppHeaderTabScope>
              </View>

              {/* Tab 3 — Profile */}
              <View style={[styles.tabContent, activeTab !== 'profile' && styles.hidden]}>
                <AppHeaderTabScope tab="profile">
                <ProfileNavigator
                  session={session}
                  isActive={activeTab === 'profile'}
                  onNavigateToRoute={handleNavigateToRoute}
                  onNavigateToUser={handleSelectClimber}
                />
                </AppHeaderTabScope>
              </View>
            </View>

            <TabChrome
              store={headerStore}
              activeTab={activeTab}
              onTabPress={setActiveTab}
              onBarLayout={setTabBarHeight}
            />

            {/* Climber profile overlay (AC-182) */}
            {targetUserId !== null && (
              <View style={styles.overlayContainer}>
                <AppHeaderOverlayScope
                  topInset={insets.top}
                  bottomInset={insets.bottom}
                  onNavigateToNotifications={handleNavigateToNotifications}
                  onNavigateToSettings={handleNavigateToSettings}
                >
                <UserProfileScreen
                  targetUserId={targetUserId}
                  session={session}
                  onBack={handleClimberProfileBack}
                />
                </AppHeaderOverlayScope>
              </View>
            )}

            {/* Notifications overlay (AC-184) */}
            {notificationsOpen && (
              <View style={styles.overlayContainer}>
                <AppHeaderOverlayScope
                  topInset={insets.top}
                  bottomInset={insets.bottom}
                  onNavigateToNotifications={handleNavigateToNotifications}
                  onNavigateToSettings={handleNavigateToSettings}
                >
                <NotificationsNavigator
                  session={session}
                  initialView="inbox"
                  isActive={notificationsOpen}
                  onBack={handleNotificationsBack}
                  onNavigateToUser={handleSelectClimber}
                />
                </AppHeaderOverlayScope>
              </View>
            )}

            {/* Settings overlay (AC-184) */}
            {settingsOpen && (
              <View style={styles.overlayContainer}>
                <AppHeaderOverlayScope
                  topInset={insets.top}
                  bottomInset={insets.bottom}
                  onNavigateToNotifications={handleNavigateToNotifications}
                  onNavigateToSettings={handleNavigateToSettings}
                >
                <SettingsScreen onBack={handleSettingsBack} />
                </AppHeaderOverlayScope>
              </View>
            )}
          </View>
        </CelebrationHost>
      </ToastProvider>
      </AppHeaderProvider>
    </UnreadCountProvider>
  );
}
