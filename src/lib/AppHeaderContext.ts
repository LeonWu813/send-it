/**
 * Canonical entry point for the AppHeader context API (design system §30).
 *
 * All modules must import from this path: `@/lib/AppHeaderContext`
 * (or the relative path `src/lib/AppHeaderContext`).
 *
 * Do NOT import directly from `src/modules/mod-home/components/AppHeaderContext`
 * or `src/modules/mod-home/components/AppHeaderOverlayScope` — those files are
 * deprecated shims that re-export from here.
 */

export {
  AppHeaderProvider,
  AppHeaderStore,
  AppHeaderTabScope,
  OverlayContext,
  tabBarBottomGap,
  useAppHeader,
  useAppHeaderRoot,
  useAppHeaderStore,
  useAppHeaderStoreVersion,
  useHeaderContentInset,
  useHideTabBar,
  useTabBarInset,
} from '../modules/mod-home/components/AppHeaderContext';

export type {
  AppHeaderConfig,
  AppHeaderRootBinding,
  HeaderTab,
} from '../modules/mod-home/components/AppHeaderContext';

export { AppHeaderOverlayScope } from '../modules/mod-home/components/AppHeaderOverlayScope';
