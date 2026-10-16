/**
 * AppHeaderOverlayScope — wraps a full-screen AppShell overlay (notifications, settings, climber
 * profile) so its screens can use the same `useAppHeader` hook as tab screens.
 *
 * @deprecated Import from '@/lib/AppHeaderContext' instead.
 *
 * It owns a private header store: `useAppHeader` registrations inside the scope drive a nested
 * `AppHeader` rendered at the top of the overlay (back, title, optional trailing, action capsule).
 * With no registration the scope renders no header (the overlay draws its own). The scope also marks
 * its subtree as an overlay: `useTabBarInset()` returns 0 and `useHideTabBar()` is a no-op.
 */

import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '../../../lib/theme';
import AppHeader from './AppHeader';
import {
  AppHeaderProvider,
  AppHeaderStore,
  AppHeaderTabScope,
  OverlayContext,
  useAppHeaderStoreVersion,
} from './AppHeaderContext';

interface Props {
  topInset: number;
  bottomInset: number;
  onNavigateToNotifications: () => void;
  onNavigateToSettings: () => void;
  children: React.ReactNode;
}

function OverlayHeaderHost({
  store,
  topInset,
  onNavigateToNotifications,
  onNavigateToSettings,
}: Omit<Props, 'children' | 'bottomInset'> & { store: AppHeaderStore }): React.JSX.Element | null {
  useAppHeaderStoreVersion(store);
  const entry = store.top('home');
  if (!entry) return null;
  return (
    <AppHeader
      variant="nested"
      title={entry.config.title ?? ''}
      onBack={entry.config.onBack}
      trailing={entry.config.trailing}
      scrollY={entry.config.scrollY}
      topInset={topInset}
      onNavigateToNotifications={onNavigateToNotifications}
      onNavigateToSettings={onNavigateToSettings}
    />
  );
}

export function AppHeaderOverlayScope({
  topInset,
  bottomInset,
  onNavigateToNotifications,
  onNavigateToSettings,
  children,
}: Props): React.JSX.Element {
  const { theme } = useTheme();
  const store = useMemo(() => new AppHeaderStore(topInset, bottomInset), [topInset, bottomInset]);
  return (
    <AppHeaderProvider value={store}>
      <AppHeaderTabScope tab="home">
        <OverlayContext.Provider value>
          <View style={[styles.fill, { backgroundColor: theme.colors.background }]}>
            <OverlayHeaderHost
              store={store}
              topInset={topInset}
              onNavigateToNotifications={onNavigateToNotifications}
              onNavigateToSettings={onNavigateToSettings}
            />
            <View style={styles.fill}>{children}</View>
          </View>
        </OverlayContext.Provider>
      </AppHeaderTabScope>
    </AppHeaderProvider>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
