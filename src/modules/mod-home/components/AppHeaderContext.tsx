/**
 * AppHeaderContext — lets screens drive the global AppHeader (design system §30).
 *
 * Import path (all modules): `src/modules/mod-home/components/AppHeaderContext`
 * (relative from a module: `../../mod-home/components/AppHeaderContext`).
 *
 * Nested screen (back + title [+ trailing] + action capsule on ONE 44pt row; delete the screen's own
 * back / title row):
 *
 *   useAppHeader({ title: formatRouteName(...), onBack: handleBack, trailing: <IconButton variant="float" .../> });
 *
 * Tab-root screen that wants the large title to scroll away and the small title to fade in
 * (bind it to the ScrollView / FlatList):
 *
 *   const { onScroll, scrollEventThrottle, contentTopInset } = useAppHeaderRoot();
 *   <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={scrollEventThrottle}
 *     contentContainerStyle={{ paddingTop: contentTopInset }} ... />
 *
 * Overlays: AppShell wraps each full-screen overlay (notifications, settings, climber profile) in
 * `AppHeaderOverlayScope`. Inside it `useAppHeader` drives the overlay's OWN nested header (rendered by the
 * scope), `useTabBarInset` returns 0 and `useHideTabBar` is a no-op, so a screen (e.g. SettingsScreen)
 * can call the same hooks whether it is mounted in a tab or in an overlay.
 *
 * Rules:
 *   - Registrations are per tab (AppShell wraps each tab in `AppHeaderTabScope`), so a keep-alive
 *     hidden tab never drives the header of the visible one.
 *   - The most recently MOUNTED registration of a tab wins; unmounting it restores the previous one,
 *     and finally the tab-root large title (the default when nothing is registered).
 *   - `onBack` present => nested row. Absent => root header with `title` (default: the tab name).
 *   - The hook is a no-op outside AppShell (stories / unit tests).
 *   - The store is external (not React state of the screen), so calling the hook with fresh
 *     inline closures every render never re-renders the registering screen.
 */

import React, { createContext, useContext, useEffect, useMemo, useRef } from 'react';
import { Animated, useWindowDimensions } from 'react-native';
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

export type HeaderTab = 'home' | 'gyms' | 'profile';

export interface AppHeaderConfig {
  /** Nested: the screen title (headline, 1 line). Root: overrides the tab name. */
  title?: string;
  /** Present => nested variant (one 44pt row: back, title, capsule). */
  onBack?: () => void;
  /** Extra control shown just left of the action capsule (e.g. a 44pt `float` bookmark IconButton). */
  trailing?: React.ReactNode;
  /** Nested: optional scroll value; fades the bottom hairline in over the first 8pt. */
  scrollY?: Animated.Value;
}

interface Entry {
  id: number;
  config: AppHeaderConfig;
  /** Root screens that own a scroll binding (large title scrolls away, small title fades in). */
  rootScroll?: Animated.Value;
}

type Listener = () => void;

/** Tiny external store: `AppShell` renders the header from it, screens write into it. */
export class AppHeaderStore {
  private entries: Record<HeaderTab, Entry[]> = { home: [], gyms: [], profile: [] };
  private listeners = new Set<Listener>();
  private version = 0;
  readonly topInset: number;
  readonly bottomInset: number;
  /** Whether each tab's root list can still scroll down (drives the TabBar bottom fade). */
  private fade: Record<HeaderTab, boolean> = { home: false, gyms: false, profile: false };
  /** Number of mounted screens per tab that asked for the TabBar to be hidden (forms). */
  private hidden: Record<HeaderTab, number> = { home: 0, gyms: 0, profile: 0 };
  readonly scrollValues: Record<HeaderTab, Animated.Value> = {
    home: new Animated.Value(0),
    gyms: new Animated.Value(0),
    profile: new Animated.Value(0),
  };

  constructor(topInset: number, bottomInset = 0) {
    this.topInset = topInset;
    this.bottomInset = bottomInset;
  }

  canScrollDown(tab: HeaderTab): boolean {
    return this.fade[tab];
  }

  setCanScrollDown(tab: HeaderTab, v: boolean): void {
    if (this.fade[tab] === v) return;
    this.fade[tab] = v;
    this.emit();
  }

  isTabBarHidden(tab: HeaderTab): boolean {
    return this.hidden[tab] > 0;
  }

  adjustHidden(tab: HeaderTab, delta: 1 | -1): void {
    this.hidden[tab] += delta;
    this.emit();
  }

  subscribe = (l: Listener): (() => void) => {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  };

  getVersion = (): number => this.version;

  private emit(): void {
    this.version += 1;
    this.listeners.forEach((l) => l());
  }

  set(tab: HeaderTab, id: number, config: AppHeaderConfig, rootScroll?: Animated.Value): void {
    const list = this.entries[tab];
    const i = list.findIndex((e) => e.id === id);
    if (i === -1) list.push({ id, config, rootScroll });
    else list[i] = { id, config, rootScroll };
    this.emit();
  }

  remove(tab: HeaderTab, id: number): void {
    this.entries[tab] = this.entries[tab].filter((e) => e.id !== id);
    this.emit();
  }

  /** Effective header for a tab: top-most entry, or undefined (default root). */
  top(tab: HeaderTab): Entry | undefined {
    return this.entries[tab][this.entries[tab].length - 1];
  }

  /** Root scroll value registered by the tab root screen (any entry), if any. */
  rootScrollFor(tab: HeaderTab): Animated.Value | undefined {
    const l = this.entries[tab];
    for (let i = l.length - 1; i >= 0; i -= 1) if (l[i].rootScroll) return l[i].rootScroll;
    return undefined;
  }
}

const StoreContext = createContext<AppHeaderStore | null>(null);
const TabContext = createContext<HeaderTab | null>(null);
/** True inside a full-screen overlay (`AppHeaderOverlayScope`): it covers the TabBar. */
export const OverlayContext = createContext<boolean>(false);

export const AppHeaderProvider = StoreContext.Provider;

/** AppShell wraps each tab's subtree in this so registrations are scoped to their tab. */
export function AppHeaderTabScope({ tab, children }: { tab: HeaderTab; children: React.ReactNode }): React.JSX.Element {
  return <TabContext.Provider value={tab}>{children}</TabContext.Provider>;
}

export function useAppHeaderStore(): AppHeaderStore | null {
  return useContext(StoreContext);
}

/** Root header height = insets.top + 6 + 44 + 8 (§30.2). */
const ROOT_HEADER_EXTRA = 58;

let nextId = 1;

function useEntryId(): number {
  const ref = useRef(0);
  if (ref.current === 0) {
    ref.current = nextId;
    nextId += 1;
  }
  return ref.current;
}

/** Register a header for this screen while it is mounted. See the file header for usage. */
export function useAppHeader(config: AppHeaderConfig): void {
  const store = useContext(StoreContext);
  const tab = useContext(TabContext);
  const id = useEntryId();
  // Runs after every render: the store is external, so this never re-renders the screen.
  useEffect(() => {
    if (store && tab) store.set(tab, id, config);
  });
  useEffect(
    () => () => {
      if (store && tab) store.remove(tab, id);
    },
    [store, tab, id],
  );
}

export interface AppHeaderRootBinding {
  /** Pass to an `Animated.ScrollView` / `Animated.FlatList` `onScroll`. */
  onScroll: ReturnType<typeof Animated.event>;
  onContentSizeChange: (w: number, h: number) => void;
  onLayout: (e: LayoutChangeEvent) => void;
  scrollEventThrottle: 16;
  /** paddingTop for the scroll content: the large header floats over the list. 0 outside AppShell. */
  contentTopInset: number;
  /** paddingBottom for the scroll content so the last row clears the floating TabBar (§29.2). */
  contentBottomInset: number;
  /** scrollIndicatorInsets.bottom. */
  indicatorBottomInset: number;
  scrollY: Animated.Value;
}

/** Bottom gap of the floating TabBar: `Math.max(insets.bottom - smd, sm)` (§29.2). */
export function tabBarBottomGap(bottomInset: number): number {
  return Math.max(bottomInset - SMD, SM);
}
const SMD = 12;
const SM = 8;
const TAB_BAR_HEIGHT = 64;
const MD = 16;

/** Insets every scroll container inside a tab must apply so content clears the floating TabBar. */
export function useTabBarInset(): { contentBottom: number; indicatorBottom: number } {
  const store = useContext(StoreContext);
  const overlay = useContext(OverlayContext);
  // An overlay covers the TabBar: nothing to clear.
  if (!store || overlay) return { contentBottom: 0, indicatorBottom: 0 };
  const indicator = TAB_BAR_HEIGHT + tabBarBottomGap(store.bottomInset);
  return { contentBottom: indicator + MD, indicatorBottom: indicator };
}

/** Hide the TabBar while this screen is mounted (log-send style forms; like hidesBottomBarWhenPushed). */
export function useHideTabBar(hidden = true): void {
  const store = useContext(StoreContext);
  const tab = useContext(TabContext);
  const overlay = useContext(OverlayContext);
  useEffect(() => {
    if (!store || !tab || !hidden || overlay) return undefined;
    store.adjustHidden(tab, 1);
    return () => store.adjustHidden(tab, -1);
  }, [store, tab, hidden, overlay]);
}

/**
 * Tab-root screens: bind the large-title collapse AND the TabBar bottom fade to this screen's scroll
 * container. Spread: `onScroll`, `onContentSizeChange`, `onLayout`, `scrollEventThrottle`.
 */
export function useAppHeaderRoot(title?: string): AppHeaderRootBinding {
  const store = useContext(StoreContext);
  const tab = useContext(TabContext);
  const id = useEntryId();
  const fallback = useRef(new Animated.Value(0)).current;
  const scrollY = store && tab ? store.scrollValues[tab] : fallback;
  const metrics = useRef({ y: 0, h: 0, content: 0 });
  useEffect(() => {
    if (store && tab) store.set(tab, id, { title }, scrollY);
  });
  useEffect(
    () => () => {
      if (store && tab) store.remove(tab, id);
    },
    [store, tab, id],
  );
  const update = (): void => {
    const m = metrics.current;
    if (store && tab) store.setCanScrollDown(tab, m.h > 0 && m.y + m.h < m.content - 1);
  };
  const metricsRef = metrics;
  // Native-driven scroll binding; the JS `listener` only feeds the TabBar fade (boolean changes only).
  const onScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
        useNativeDriver: true,
        listener: (e: NativeSyntheticEvent<NativeScrollEvent>) => {
          const n = e.nativeEvent;
          metricsRef.current = { y: n.contentOffset.y, h: n.layoutMeasurement.height, content: n.contentSize.height };
          if (store && tab) store.setCanScrollDown(tab, n.layoutMeasurement.height > 0 && n.contentOffset.y + n.layoutMeasurement.height < n.contentSize.height - 1);
        },
      }),
    [scrollY, store, tab, metricsRef],
  );
  const { fontScale } = useWindowDimensions();
  const gap = store ? TAB_BAR_HEIGHT + tabBarBottomGap(store.bottomInset) : 0;
  return {
    onScroll,
    onContentSizeChange: (_w, h) => {
      metrics.current.content = h;
      update();
    },
    onLayout: (e) => {
      metrics.current.h = e.nativeEvent.layout.height;
      update();
    },
    scrollEventThrottle: 16,
    contentTopInset: store ? rootHeaderHeightFor(store.topInset, fontScale) : 0,
    contentBottomInset: store ? gap + MD : 0,
    indicatorBottomInset: store ? gap : 0,
    scrollY,
  };
}

function rootHeaderHeightFor(topInset: number, fontScale: number): number {
  return topInset + ROOT_HEADER_EXTRA + (fontScale >= 1.6 ? 50 : 0);
}


/** AppShell only: re-render when any registration changes. */
export function useAppHeaderStoreVersion(store: AppHeaderStore): number {
  return React.useSyncExternalStore(store.subscribe, store.getVersion, store.getVersion);
}
