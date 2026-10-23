/**
 * PhoneFrame: Storybook decorator that renders a PAGE exactly as it looks inside the app.
 *
 * What it gives a page (mirrors `src/modules/mod-home/AppShell.tsx`):
 *   - iPhone 16 Pro viewport, 393x852, with safe-area insets top 59 / bottom 34 (`useSafeAreaInsets`).
 *   - The real header store (`AppHeaderProvider` + `AppHeaderStore` + `AppHeaderTabScope`), so a screen's
 *     `useAppHeader` / `useAppHeaderRoot` / `useHideTabBar` / `useTabBarInset` behave as in AppShell.
 *   - The real `AppHeader` (rendered from the store, like AppShell's `HeaderHost`).
 *   - The real floating `TabBar` + `TabBarFade`, hidden automatically when the screen calls `useHideTabBar`.
 *   - `ToastProvider`, `CelebrationHost`, and an `UnreadCountProvider` (bell badge) backed by the stubbed supabase.
 *   - The frame background follows the theme toolbar (`theme.colors.background`).
 *
 * API (all under `parameters.page`; usage is `decorators: [withPhoneFrame]` + `layout: 'centered'`):
 *   tab:     'home' | 'gyms' | 'profile'   Active TabBar tab and header tab scope. Default 'home'.
 *   overlay: boolean                        Screen is an AppShell overlay (notifications, settings, other-user
 *                                           profile): wrapped in `AppHeaderOverlayScope`; no shell header/TabBar,
 *                                           the screen's own `useAppHeader` drives the overlay header.
 *   chrome:  boolean                        false = no header, no TabBar (Sign In / Sign Up live outside
 *                                           AppShell). Default true.
 *
 * Do NOT render a second header, TabBar or ToastProvider in the story: the frame already provides them.
 */

import type { Session } from '@supabase/supabase-js';
import type { Decorator } from '@storybook/react-native-web-vite';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { SafeAreaFrameContext, SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { CelebrationHost } from '../src/components/ui/CelebrationHost';
import { ToastProvider } from '../src/components/ui/Toast';
import { useTheme } from '../src/lib/theme';
import AppHeader from '../src/modules/mod-home/components/AppHeader';
import {
  AppHeaderProvider,
  AppHeaderStore,
  AppHeaderTabScope,
  tabBarBottomGap,
  useAppHeaderStoreVersion,
  type HeaderTab,
} from '../src/modules/mod-home/components/AppHeaderContext';
import { AppHeaderOverlayScope } from '../src/modules/mod-home/components/AppHeaderOverlayScope';
import TabBar, { TabBarFade } from '../src/modules/mod-home/components/TabBar';
import { UnreadCountProvider } from '../src/modules/mod-notifications';

/** iPhone 16 Pro portrait. */
export const PHONE = { width: 393, height: 852, insets: { top: 59, bottom: 34, left: 0, right: 0 } } as const;

export interface PageParameters {
  tab?: HeaderTab;
  overlay?: boolean;
  chrome?: boolean;
}

const storyUser = { user: { id: 'story-user-me' } } as unknown as Session;
const noop = (): void => {};

/** Mirrors AppShell `HeaderHost`. */
function HeaderHost({ store, tab }: { store: AppHeaderStore; tab: HeaderTab }): React.JSX.Element {
  const { t } = useTranslation('common');
  useAppHeaderStoreVersion(store);
  const config = store.top(tab)?.config;
  const nested = config?.onBack !== undefined;
  return (
    <AppHeader
      variant={nested ? 'nested' : 'root'}
      title={config?.title ?? t(`tabs.${tab}`)}
      onBack={config?.onBack}
      trailing={config?.trailing}
      scrollY={nested ? config?.scrollY : store.rootScrollFor(tab)}
      topInset={store.topInset}
      onNavigateToNotifications={noop}
      onNavigateToSettings={noop}
    />
  );
}

/** Mirrors AppShell `TabChrome`. */
function TabChrome({ store, tab }: { store: AppHeaderStore; tab: HeaderTab }): React.JSX.Element {
  useAppHeaderStoreVersion(store);
  const hidden = store.isTabBarHidden(tab);
  return (
    <>
      <TabBarFade show={!hidden && store.canScrollDown(tab)} bottomInset={store.bottomInset} />
      <TabBar activeTab={tab} onTabPress={noop} bottomInset={store.bottomInset} hidden={hidden} />
    </>
  );
}

function PhoneFrame({ page, children }: { page: PageParameters; children: React.ReactNode }): React.JSX.Element {
  const { theme } = useTheme();
  const { tab = 'home', overlay = false, chrome = true } = page;
  const { insets } = PHONE;
  const store = useMemo(() => new AppHeaderStore(insets.top, insets.bottom), [insets.top, insets.bottom]);
  const toastBottomOffset = chrome && !overlay
    ? 64 + tabBarBottomGap(insets.bottom) + theme.componentSize.toastOffsetAboveTabBar
    : undefined;

  let body: React.ReactNode;
  if (!chrome) {
    body = children;
  } else if (overlay) {
    body = (
      <AppHeaderOverlayScope topInset={insets.top} bottomInset={insets.bottom} onNavigateToNotifications={noop} onNavigateToSettings={noop}>
        {children}
      </AppHeaderOverlayScope>
    );
  } else {
    body = (
      <AppHeaderProvider value={store}>
        <HeaderHost store={store} tab={tab} />
        <View style={styles.fill}>
          <AppHeaderTabScope tab={tab}>{children}</AppHeaderTabScope>
        </View>
        <TabChrome store={store} tab={tab} />
      </AppHeaderProvider>
    );
  }

  return (
    <SafeAreaFrameContext.Provider value={{ x: 0, y: 0, width: PHONE.width, height: PHONE.height }}>
      <SafeAreaInsetsContext.Provider value={insets}>
        <View
          style={[
            styles.frame,
            { backgroundColor: theme.colors.background, borderColor: theme.colors.border },
          ]}
        >
          <UnreadCountProvider session={storyUser}>
            <ToastProvider bottomOffset={toastBottomOffset}>
              <CelebrationHost>
                <View style={styles.fill}>{body}</View>
              </CelebrationHost>
            </ToastProvider>
          </UnreadCountProvider>
        </View>
      </SafeAreaInsetsContext.Provider>
    </SafeAreaFrameContext.Provider>
  );
}

/** Add to a Pages meta: `decorators: [withPhoneFrame]`. */
export const withPhoneFrame: Decorator = (Story, context) => (
  <PhoneFrame page={(context.parameters.page ?? {}) as PageParameters}>
    <Story />
  </PhoneFrame>
);

const styles = StyleSheet.create({
  frame: {
    width: PHONE.width,
    height: PHONE.height,
    borderRadius: 48,
    borderWidth: StyleSheet.hairlineWidth * 2,
    overflow: 'hidden',
  },
  fill: { flex: 1 },
});
