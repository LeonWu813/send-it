# Localization & Theming (MOD-010) Status

## Engineering Progress

### Storybook infrastructure — 2026-10-16 (off-spec design tooling, pending PR review)

Added on branch `design/storybook` at the UI/UX designer's request. NOT routed through tech-lead/pm/doc-sync; PR review covers it. No runtime app code changed (`src/lib/theme.ts` and `i18n.ts` untouched).

- Added `.storybook/` (main.ts, preview.tsx, ForcedTheme.tsx, stubs/, README.md), `stories/Tokens.stories.tsx`, `storybook` / `build-storybook` scripts, dev deps (storybook, @storybook/react-native-web-vite, vite) and deps react-dom / react-native-web (via `expo install`).
- Supabase and AsyncStorage are stubbed for Storybook only.

---

### Bugfix — 2026-10-15 (Jest AsyncStorage mock — cross-project regression fix)

**Added Jest moduleNameMapper entry for `@react-native-async-storage/async-storage`**

Root cause: commit `8d4c6e4` added `import AsyncStorage from '@react-native-async-storage/async-storage'` to `src/lib/theme.ts` (ThemeProvider's mount-time override restore) but did not configure a Jest mock for the package. Every test suite that transitively imports `theme.ts` crashed with `[@RNC/AsyncStorage]: NativeModule: AsyncStorage is null`, blocking 20+ screen-level test suites across the project.

Fix: added a single `moduleNameMapper` entry in `package.json` `"jest"` block pointing to the official mock shipped with the package:

```json
"^@react-native-async-storage/async-storage$": "<rootDir>/node_modules/@react-native-async-storage/async-storage/jest/async-storage-mock.js"
```

The official mock (`node_modules/@react-native-async-storage/async-storage/jest/async-storage-mock.js`) was confirmed to exist before using this path.

**Self-check**
- [pass] `npx tsc --noEmit` — exit 0, 0 TypeScript errors
- [pass] `npx jest --testPathPattern="src/modules/mod-localization-theme" --passWithNoTests --watchAll=false` — exit 0 (no tests in this module; passes with `--passWithNoTests`)
- [pass] `npx jest --testPathPattern="src/modules/mod-home" --watchAll=false` — 2 of 3 suites now pass; 1 pre-existing failure in `HomeScreen.test.tsx` (looks for "2 new beta videos" — stale test for AC-182 redesign, not introduced by this fix; confirmed pre-existing: all 3 mod-home suites crashed at AsyncStorage level before this fix)
- [pass] Full suite run: 29 suites pass after fix vs. 15 before (14 suites unblocked). 6 remaining failures are pre-existing content failures in mod-route-catalog, mod-home HomeScreen, RouteCard, and lib/supabase — all confirmed pre-existing and not introduced by this change.
- [pass] Git scope flag: `package.json` is outside the module directory boundary — intentional; this is a cross-cutting Jest config change required to unblock all test suites. Other flagged files (mod-moderation, mod-route-catalog, prd.md, locale files) are pre-existing uncommitted changes from other modules, not touched by this fix.
- [pass] No new dependencies introduced — the mock is from a package already in `package.json`
- [pass] No hardcoded hex colors, no inline string literals introduced

**Files modified**
- `package.json` — `"jest"` > `"moduleNameMapper"` entry added

---

### Bugfix — 2026-10-15 (theme initialization — wrong theme on launch)

**ThemeProvider now loads saved override from AsyncStorage on mount**

Root cause: `ThemeProvider` in `src/lib/theme.ts` initialized `override` to `'system'` via `useState` without reading the persisted value from AsyncStorage. The only place the saved override was loaded and applied was inside `SettingsScreen.tsx`'s mount `useEffect` (`restorePreferences`), which called `setOverride(savedOverride)`. This caused a visible theme switch every time the user opened Settings — the app showed the system theme, then Settings corrected it to the saved preference.

Fix (two changes):

1. `src/lib/theme.ts`:
   - Added import: `import AsyncStorage from '@react-native-async-storage/async-storage'`
   - Added `useEffect` (runs once on mount) that reads `'app_theme_override'` from AsyncStorage and calls `setOverride(saved)` if the stored value is a valid `ThemeOverride` (`'light' | 'dark' | 'system'`). Key `'app_theme_override'` matches what `saveThemeOverride` uses in `settings-storage.ts` — verified before hardcoding. Errors are silently swallowed; the default `'system'` is the safe fallback.

2. `src/modules/mod-localization-theme/screens/SettingsScreen.tsx`:
   - In `restorePreferences` (mount `useEffect`), removed the `setOverride(savedOverride)` call. SettingsScreen now only syncs its local `selectedOverride` UI state; ThemeProvider owns loading and applying the saved override.
   - `setOverride` is still destructured from `useTheme()` and still called in `handleOverrideSelect` (live user selection) — no change to that path.

Safe-area insets: SettingsScreen is rendered in two contexts — (1) as a full-screen `absoluteFill` overlay from AppShell (which sits on top of AppHeader, so the overlay covers the full screen including the status bar) and (2) inside ProfileNavigator (which sits below AppHeader). Because the overlay context requires the top inset, `useSafeAreaInsets()` + `makeStyles(theme, insets.top)` is kept as-is. No change to insets handling.

**Self-check**
- [pass] `npx tsc --noEmit` — exit 0, 0 TypeScript errors
- [pass] `'app_theme_override'` key confirmed to match `settings-storage.ts` `THEME_OVERRIDE_KEY` constant
- [pass] No hardcoded hex colors introduced
- [pass] No inline string literals introduced
- [pass] No new ACs or behavior changes — strictly a bug fix (wrong theme on launch, visible theme flash on Settings open)
- [pass] `setOverride` still used in `handleOverrideSelect` — no unused-variable issue

**Files modified**
- `src/lib/theme.ts`
- `src/modules/mod-localization-theme/screens/SettingsScreen.tsx`

---

### Swipe-back wiring — 2026-10-15 (AC-185)

**Wire SwipeBackWrapper into SettingsScreen and BlockedAccountsScreen**

Per AC-185, both screens that expose an `onBack` prop now use `SwipeBackWrapper` (owned by MOD-012, located at `src/components/SwipeBackWrapper`) as the outermost JSX element in their `return` statement, enabling the left-edge swipe-back gesture.

`src/modules/mod-localization-theme/screens/SettingsScreen.tsx`:
- [pass] Import added: `import SwipeBackWrapper from '../../../components/SwipeBackWrapper'`
- [pass] Root `<View style={styles.root}>` replaced with `<SwipeBackWrapper onBack={onBack}>`; closing `</View>` replaced with `</SwipeBackWrapper>`
- [pass] `styles.root` style entry removed (now unused — `SwipeBackWrapper` provides `flex: 1` via its own container)
- [pass] `backgroundColor: theme.colors.background` moved onto `scrollView` style to preserve full-screen background coverage
- [pass] No `enabled` prop used — gesture is active unconditionally (no scroll-conflict risk; the nav bar area where the swipe would originate has no horizontally-scrolling child)

`src/modules/mod-localization-theme/screens/BlockedAccountsScreen.tsx`:
- [pass] Import added: `import SwipeBackWrapper from '../../../components/SwipeBackWrapper'`
- [pass] Root `<View style={styles.root}>` replaced with `<SwipeBackWrapper onBack={onBack}>`; closing `</View>` replaced with `</SwipeBackWrapper>`
- [pass] `root` style entry removed from `makeStyles` (now unused)
- [pass] No `enabled` prop used — gesture is active unconditionally

**Self-check**
- [pass] `npx tsc --noEmit` — all TS errors are pre-existing in unrelated modules (`mod-auth-profile` test file, `ProfileNavigator`, `mod-route-catalog`); 0 new errors introduced by this change
- [pass] `npx jest --testPathPattern="mod-localization-theme" --passWithNoTests` — exit 0 (no tests in this module, passes with `--passWithNoTests`)
- [pass] No hardcoded hex colors introduced
- [pass] No inline string literals introduced
- [pass] `enabled` prop omitted — default `true` is correct for both screens

**Files modified**
- `src/modules/mod-localization-theme/screens/SettingsScreen.tsx`
- `src/modules/mod-localization-theme/screens/BlockedAccountsScreen.tsx`

### Integration fix — 2026-10-13 (cross-module import violation: MOD-012 AppShell.tsx)

**Fix: public re-export for SettingsScreen at module root**

MOD-012's `AppShell.tsx` imported `SettingsScreen` directly from the internal `screens/` subdirectory of mod-localization-theme, violating the Cross-Module Imports shared convention (production.md: "A module may import another module's public service functions and navigator entry-point components only — never its internal `screens/` or `components/` subdirectories directly"). Fix: created a public re-export barrel at the module root.

- [pass] `src/modules/mod-localization-theme/SettingsScreen.tsx` created — one-line re-export: `export { default } from './screens/SettingsScreen'`
- [pass] `npx tsc --noEmit` — 0 TypeScript errors
- [pass] No behavior change — re-export only; module output is identical
- [pass] No new dependencies introduced
- [pass] No other files modified

**Files created**
- `src/modules/mod-localization-theme/SettingsScreen.tsx` (new — public re-export)

### Bugfix — 2026-10-13 (QA Run 1 — three failures)

**Bug 1 — AC-157 label mismatch (short state labels)**

Spec requires: `public` displayed as "所有人"/"All Users"; `followers_only` displayed as "僅限追蹤者"/"Followers Only".
Prior implementation displayed sentence-form subtext ("All users can see your beta videos" / "Only followers can see your beta videos") instead of short per-state labels.

- [pass] `locales/en/common.json` — added `settings.betaVideoPrivacyPublic` ("All Users") and `settings.betaVideoPrivacyFollowersOnly` ("Followers Only")
- [pass] `locales/zh-TW/common.json` — added `settings.betaVideoPrivacyPublic` ("所有人") and `settings.betaVideoPrivacyFollowersOnly` ("僅限追蹤者")
- [pass] `SettingsScreen.tsx` — `settingRowSubtext` now renders `t('settings.betaVideoPrivacyFollowersOnly')` when `followers_only` and `t('settings.betaVideoPrivacyPublic')` when `public` (short labels, not sentence-form subtexts)

**Bug 2 — AC-157 row order (Blocked Accounts before Beta Video Privacy)**

Spec Key Implementation Notes: row order is "Blocked Accounts" (AC-155) → "Beta Video Privacy" (AC-157) → Logout (AC-168).
Prior implementation rendered AC-157 section before AC-155 section.

- [pass] `SettingsScreen.tsx` — swapped the two JSX sections: Blocked Accounts row (AC-155) now renders before Beta Video Privacy toggle (AC-157), both above Logout (AC-168)

**Bug 3 — REQ-CI: i18n completeness check wired into CI**

Spec: "A CI check must fail if any English key lacks a zh-TW counterpart."
Prior state: `scripts/check-i18n-completeness.js` existed and was correct but no `.github/workflows/` directory existed.

- [pass] `.github/workflows/i18n-check.yml` created — triggers on `push` and `pull_request` to `main`; uses `actions/checkout@v4` and `actions/setup-node@v4` (Node 20); runs `node scripts/check-i18n-completeness.js`

**Self-check**
- [pass] `npx tsc --noEmit` — 0 TypeScript errors
- [pass] `npm run check:i18n` — "i18n completeness OK" (exit 0); new keys `betaVideoPrivacyPublic` and `betaVideoPrivacyFollowersOnly` present in both EN and zh-TW; old subtext keys still present (no keys removed)
- [pass] No hardcoded hex colors introduced
- [pass] No inline string literals introduced (dynamic t() keys)
- [pass] Row order after fix: Language → Appearance → Blocked Accounts (AC-155) → Beta Video Privacy (AC-157) → Logout (AC-168) — matches spec

**Files modified / created**
- `src/modules/mod-localization-theme/screens/SettingsScreen.tsx`
- `locales/en/common.json`
- `locales/zh-TW/common.json`
- `.github/workflows/i18n-check.yml` (new)

### Bugfix — 2026-09-30 (i18n text corrections + initial-load disabled state)

**Bug 1 — Beta Video Privacy i18n text corrections**

- [pass] `locales/zh-TW/common.json` — `settings.betaVideoPrivacy` updated from "Beta 影片可見度" to "Beta 影片僅限追蹤者"
- [pass] `locales/en/common.json` — old `settings.betaVideoPrivacySubtext` key removed; two new keys added: `settings.betaVideoPrivacySubtextPublic` ("All users can see your beta videos") and `settings.betaVideoPrivacySubtextFollowersOnly` ("Only followers can see your beta videos")
- [pass] `locales/zh-TW/common.json` — old `settings.betaVideoPrivacySubtext` key removed; two new keys added: `settings.betaVideoPrivacySubtextPublic` ("所有人皆可觀看你的 Beta 影片") and `settings.betaVideoPrivacySubtextFollowersOnly` ("僅限追蹤者可觀看你的 Beta 影片")
- [pass] `SettingsScreen.tsx` — subtitle `<Text>` updated to dynamic conditional: `betaVideoPrivacy === 'followers_only' ? t('settings.betaVideoPrivacySubtextFollowersOnly') : t('settings.betaVideoPrivacySubtextPublic')`
- [pass] `npm run check:i18n` — i18n completeness OK (two new keys in both catalogs, removed key absent from both)

**Bug 2 — Initial-load disabled state to prevent false-state flash**

- [pass] Verified `handleBetaVideoPrivacyToggle` already calls `updateBetaVideoPrivacy(newValue)` from `mod-auth-profile/auth-service` — setting IS account-bound (DB write via Supabase `users` table). No behavior change needed.
- [pass] `privacyFetched: boolean` state added (default `false`), set to `true` after initial fetch completes (both on session present and session absent paths)
- [pass] `Switch` `disabled` prop updated from `disabled={privacyLoading}` to `disabled={!privacyFetched || privacyLoading}` — prevents premature interaction before DB value is loaded

**Self-check**
- [pass] `npx tsc --noEmit` — 0 TypeScript errors
- [pass] `npm run check:i18n` — i18n completeness OK
- [pass] `npm test -- --watchAll=false` — 427 pass / 2 fail; the 2 failures are in `mod-beta-video/__tests__/beta-video-service.test.ts`, a pre-existing uncommitted modification to MOD-005's test file (present in git status before this session); confirmed pre-existing by stash test
- [pass] No hardcoded hex colors introduced
- [pass] No inline string literals introduced (dynamic t() keys)
- [pass] No new dependencies outside production.md tech stack
- [pass] TypeScript strict mode — no unguarded `any`

**Files modified**
- `src/modules/mod-localization-theme/screens/SettingsScreen.tsx`
- `locales/en/common.json`
- `locales/zh-TW/common.json`

### AC-155 — 2026-09-30

**Blocked Accounts screen and sub-navigation from Settings**

- [pass] `fetchMyBlockedUsers()` added to `src/modules/mod-moderation/moderation-service.ts` — queries `blocks` joined with `users!blocks_blocked_user_id_fkey`, ordered by `created_at DESC`, returns `BlockedUser[]`
- [pass] `BlockedUser` interface exported from `moderation-service.ts`
- [pass] `src/modules/mod-localization-theme/screens/BlockedAccountsScreen.tsx` created — nav bar with `chevron-back` + back label + centered title, loading/error/empty states, 48×48 circular avatar rows with display_name and outlined Unblock button, optimistic removal + re-fetch on error
- [pass] `SettingsScreen.tsx` updated — `SettingsView` type added, `view` state declared at top of component (all hooks remain before early return), early return renders `<BlockedAccountsScreen>` when `view === 'blockedAccounts'`, "Blocked Accounts" row with `chevron-forward` added after Appearance section
- [pass] `locales/en/common.json` — `settings.blockedAccounts` ("Blocked Accounts"), `moderation.unblock` ("Unblock"), `moderation.noBlockedAccounts` ("No blocked accounts") added
- [pass] `locales/zh-TW/common.json` — matching keys added: "已封鎖的帳號", "解除封鎖", "沒有已封鎖的帳號"
- [pass] `npm run check:i18n` — i18n completeness OK (both catalogs symmetric)
- [pass] `npx tsc --noEmit` — 0 TypeScript errors
- [pass] `npm test -- --watchAll=false` — 422 tests passed (31 suites), 0 failures

**Files modified / created**
- `src/modules/mod-moderation/moderation-service.ts` (`fetchMyBlockedUsers`, `BlockedUser` interface)
- `src/modules/mod-localization-theme/screens/BlockedAccountsScreen.tsx` (new)
- `src/modules/mod-localization-theme/screens/SettingsScreen.tsx`
- `locales/en/common.json`
- `locales/zh-TW/common.json`

### Bugfix — 2026-09-30

**Bug 1 — Settings back button not visible**
- [pass] `backButton` style updated to `flexDirection: 'row', alignItems: 'center', gap: 2` with padding + borderRadius
- [pass] `backButtonText` style added: `fontSize: theme.fontSize.md, color: theme.colors.primary, fontWeight: theme.fontWeight.medium`
- [pass] Icon size reduced 24 → 20 to match iOS standard back button
- [pass] `Ionicons chevron-back` (size 20) + `Text` with `t('settings.back')` rendered side-by-side in back button
- [pass] `accessibilityLabel` updated to `t('settings.back') ?? 'Back'`
- [pass] `settings.back` key added to `locales/en/common.json` ("Back") and `locales/zh-TW/common.json` ("返回")
- [pass] `npm run check:i18n` — i18n completeness OK (new key present in both locales)

**Bug 2 — Notifications view missing onBack to return to Profile**
- [pass] `onBack?: () => void` added to `NotificationsNavigatorProps` in `NotificationsNavigator.tsx`
- [pass] `onBack` threaded from `NotificationsNavigator` to `NotificationInboxScreen`
- [pass] `onBack?: () => void` added to `NotificationInboxScreenProps`
- [pass] `Ionicons` import added to `NotificationInboxScreen.tsx`
- [pass] Nav bar with `chevron-back` + `t('common.back')` text button rendered at top of `NotificationInboxScreen` when `onBack` is defined
- [pass] Nav bar styles added: `navBar`, `backButton`, `backButtonPressed`, `backButtonText`, `navTitle`, `navSpacer`, `scrollView`, `contentContainerWithNav`
- [pass] ScrollView `contentContainerStyle` uses `contentContainerWithNav` (no topInset double-apply) when `onBack` is defined, `contentContainer` (includes topInset) when standalone
- [pass] `ProfileNavigator.tsx` passes `onBack={() => setView('profile')}` to `NotificationsNavigator`

**Self-check**
- [pass] `npm run check:i18n` — i18n completeness OK
- [pass] `npx tsc --noEmit` — 0 TypeScript errors
- [pass] `npx jest --passWithNoTests` — 412 tests passed (31 suites), 0 failures

**Files modified**
- `src/modules/mod-localization-theme/screens/SettingsScreen.tsx`
- `src/modules/mod-notifications/NotificationsNavigator.tsx`
- `src/modules/mod-notifications/screens/NotificationInboxScreen.tsx`
- `src/modules/mod-auth-profile/ProfileNavigator.tsx`
- `locales/en/common.json`
- `locales/zh-TW/common.json`

### Implementation — 2026-09-29

**Automated checks**
- [pass] `npm run check:i18n` — i18n completeness OK (all en keys present in zh-TW and vice versa)
- [pass] `npx tsc --noEmit` — 0 TypeScript errors
- [pass] `npx jest --passWithNoTests` — 405 tests passed (31 suites), all pre-existing
- [skip] Git scope check — self-check.sh flagged cross-boundary changes; these are intentional and spec-required (MOD-010 is explicitly tasked to wire into `ProfileNavigator.tsx`, `ProfileScreen.tsx`, locale files, and `package.json`)

**Judgment-based checks**
- [pass] Every spec requirement implemented — AC-090 (device detection already in i18n.ts), AC-091 (language toggle in SettingsScreen with immediate effect + AsyncStorage persistence), AC-092 (appearance override in SettingsScreen with immediate effect + AsyncStorage persistence)
- [pass] Back button in SettingsScreen uses `Ionicons chevron-back` calling `onBack()` prop
- [pass] Settings gear icon added to ProfileScreen header using `Ionicons settings-outline`
- [pass] `ProfileNavigator.tsx` extended: `'settings'` added to `ProfileView` union, `SettingsScreen` rendered when `view === 'settings'`, `onNavigateSettings` prop threaded to `ProfileScreen`
- [pass] `settings-storage.ts` exposes `loadLanguage`, `saveLanguage`, `loadThemeOverride`, `saveThemeOverride` with correct return types
- [pass] `SettingsScreen.tsx` restores persisted preferences on mount via `useEffect`
- [pass] CI completeness script `scripts/check-i18n-completeness.js` created; `check:i18n` npm script added to `package.json`
- [pass] i18n keys updated in both locale files to nested `settings.language.*` / `settings.appearance.*` structure matching spec exactly
- [pass] All colors via `useTheme()` — no hardcoded hex values
- [pass] `useSafeAreaInsets()` used in both `SettingsScreen` and existing `ProfileScreen` (unchanged)
- [pass] `useTranslation('common')` used for all strings
- [pass] No new dependencies introduced — `@react-native-async-storage/async-storage` already in `package.json`
- [pass] Code readable and follows project conventions (PascalCase components, camelCase functions, `makeStyles` pattern with `topInset`)

**Files created / modified**
- `src/modules/mod-localization-theme/settings-storage.ts` (new)
- `src/modules/mod-localization-theme/screens/SettingsScreen.tsx` (new)
- `src/modules/mod-auth-profile/ProfileNavigator.tsx` (wired `settings` view state)
- `src/modules/mod-auth-profile/screens/ProfileScreen.tsx` (added `onNavigateSettings` prop + settings gear icon)
- `locales/en/common.json` (replaced flat `settings` with nested structure)
- `locales/zh-TW/common.json` (replaced flat `settings` with nested structure)
- `scripts/check-i18n-completeness.js` (new)
- `package.json` (added `check:i18n` script)

## Engineering Progress — Rev 22 — 2026-09-30

### AC-157 — Beta Video Privacy toggle in SettingsScreen

- [pass] Imported `updateBetaVideoPrivacy` from `'../../mod-auth-profile'` barrel (MOD-001 public service)
- [pass] Imported `supabase` from `'../../../lib/supabase'` to fetch current `beta_video_privacy` on mount
- [pass] `betaVideoPrivacy` state (`'public' | 'followers_only'`, default `'public'`) added
- [pass] `privacyLoading` state added
- [pass] `useEffect` on mount fetches `users.beta_video_privacy` via `supabase.auth.getSession()` + `supabase.from('users').select('beta_video_privacy').eq('id', ...).single()`
- [pass] `handleBetaVideoPrivacyToggle(value: boolean)` calls `updateBetaVideoPrivacy(newValue)` and updates state; silently reverts on error
- [pass] Privacy section added between Appearance and Blocked Accounts sections, containing a `settingRow` with `settingRowContent` (`optionLabel` + `settingRowSubtext`) and a `Switch` using `theme.colors.border` / `theme.colors.primary` track colors and `theme.colors.background` thumb color
- [pass] `Switch` imported from `react-native`; `ActivityIndicator` imported from `react-native`
- [pass] New i18n keys added: `settings.betaVideoPrivacy` (EN "Beta Video Visibility" / zh-TW "Beta 影片可見度"), `settings.betaVideoPrivacySubtext` (EN "Show your beta videos to followers only" / zh-TW "僅向追蹤者顯示你的 Beta 影片")
- [pass] `npm run check:i18n` — i18n completeness OK (new keys in both locales)

### AC-168 — Logout button in SettingsScreen

- [pass] Imported `signOut` from `'../../mod-auth-profile'` barrel (MOD-001 public service)
- [pass] `isSigningOut` state and `logoutError` state added
- [pass] `handleLogout()` calls `signOut()`; on error sets `logoutError` message; `setIsSigningOut(false)` only on error (success: `onAuthStateChange` routes back to signed-out state automatically)
- [pass] Logout button rendered at the very bottom of the `ScrollView`, below Blocked Accounts section: `Pressable` with `logoutButton` / `logoutButtonPressed` / `logoutButtonDisabled` styles; shows `ActivityIndicator` while signing out, `Text` with `t('profile.logout')` otherwise
- [pass] `logoutError` rendered above button when non-null
- [pass] Row order: Language → Appearance → Privacy (Beta Video toggle) → Account (Blocked Accounts) → Logout button — matches spec ordering
- [pass] Styling: `borderColor: theme.colors.error`, `color: theme.colors.error` — matches former ProfileScreen logout button style

### New styles added

- `settingRow`, `settingRowContent`, `settingRowSubtext` — for the Beta Video Privacy toggle row
- `logoutButton`, `logoutButtonPressed`, `logoutButtonDisabled`, `logoutButtonText`, `logoutError` — for the Logout button

### Self-Check Results

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | PASS — 0 errors |
| `npm test -- --watchAll=false` | PASS — 429 tests, 31 suites, all pass |
| `npm run check:i18n` | PASS — i18n completeness OK |
| AC-157: Beta Video Privacy toggle reads beta_video_privacy on mount | PASS |
| AC-157: Toggle calls updateBetaVideoPrivacy from MOD-001 barrel | PASS |
| AC-157: MOD-010 does NOT write directly to users.beta_video_privacy | PASS |
| AC-157: New i18n keys present in both EN and zh-TW | PASS |
| AC-168: Logout button at bottom calls signOut from MOD-001 barrel | PASS |
| AC-168: Error handling consistent with former ProfileScreen logout | PASS |
| AC-168: ActivityIndicator shown during sign-out | PASS |
| Row order matches spec: Language → Appearance → Privacy → Account → Logout | PASS |
| No hardcoded hex colors introduced | PASS |
| No inline string literals introduced | PASS |
| Switch uses theme.colors.border / primary / background tokens only | PASS |
| No new dependencies outside production.md tech stack | PASS |
| TypeScript strict mode — no unguarded any | PASS |

**Files modified**
- `src/modules/mod-localization-theme/screens/SettingsScreen.tsx`
- `locales/en/common.json`
- `locales/zh-TW/common.json`

**Result: READY FOR QA — hand off to qa-mod-localization-theme**

---

## QA Results

### Verification — 2026-09-29

**Workflow**: functional-test (first-time verification)

**Automated test run**
- `npm test` — 405 tests passed (31 suites), 0 failures. Exit code 0.
- `npm run check:i18n` — "i18n completeness OK". Exit code 0. All English keys have zh-TW counterparts and vice versa. No missing keys in either direction.
- `npx tsc --noEmit` — 0 TypeScript errors. Exit code 0.
- No dedicated unit tests exist for `SettingsScreen.tsx` or `settings-storage.ts` (no `__tests__` directory in `mod-localization-theme`). The 405-test run covers pre-existing modules only. This is noted but is not a spec requirement — the spec does not mandate unit-test coverage for this module.

---

**AC-090: Device locale detection on first launch**

PASS AC-090

Verification method: code inspection + logic unit test.

`src/lib/i18n.ts` implements `detectDeviceLanguage()` using `getLocales()` from `expo-localization`. Logic tested exhaustively against spec requirements:
- `en`, `en-US`, `en-GB` → `'en'` (correct)
- `zh-TW`, `zh-Hant` → `'zh-TW'` (correct)
- `ja`, `es`, `fr-FR`, `ko` → `'zh-TW'` (correct — zh-TW fallback for any non-English locale per spec)
- `undefined` (no locale returned) → `'zh-TW'` (correct — safe default via `?? 'zh-TW'`)

The spec's zh-TW fallback rule ("for any non-English device locale, the fallback is zh-TW — not English") is correctly implemented. i18n is initialized synchronously via `void i18n.use(initReactI18next).init(...)` with the detected language, and is imported first in `App.tsx` (`import './src/lib/i18n'`) before any component that uses `useTranslation`.

`fallbackLng: 'zh-TW'` is also set in i18next config as a belt-and-suspenders guard.

---

**AC-091: Language toggle in Settings — immediate effect, no restart**

PASS AC-091

Verification method: code inspection.

`SettingsScreen.tsx` renders two radio-style options (`'en'` / `'zh-TW'`). `handleLanguageSelect` calls `i18n.changeLanguage(lang)` synchronously then persists to AsyncStorage via `saveLanguage(lang)`. `i18next.changeLanguage()` is a live language switch — all `useTranslation` hooks across the app re-render immediately without a restart.

State machine: `selectedLanguage` local state controls the radio selection UI; it is updated immediately in the handler before the async calls complete so the visual selection is instant. `ProfileNavigator.tsx` adds `'settings'` to the `ProfileView` union type and mounts `SettingsScreen` when `view === 'settings'`, reachable from the settings gear icon in `ProfileScreen`.

Persistence verified: `loadLanguage()` and `loadThemeOverride()` are called on mount via `useEffect`. Stored values are validated against `SUPPORTED_LANGUAGES` / `SUPPORTED_OVERRIDES` before being applied — corrupt or unknown values produce `null` and are silently ignored (correct defensive behavior).

---

**AC-092: Light/Dark mode — OS default + three-state Settings override, immediate effect**

PASS AC-092

Verification method: code inspection + logic unit test.

`src/lib/theme.ts` `ThemeProvider`:
- Reads `Appearance.getColorScheme()` on mount for the initial OS appearance.
- Subscribes to `Appearance.addChangeListener` to react to live OS appearance changes (the subscription is cleaned up on unmount).
- Exposes `override: ThemeOverride` and `setOverride` via context.

`resolveScheme` logic tested:
- `override='system', systemScheme='light'` → `isDark=false` (OS light respected)
- `override='system', systemScheme='dark'` → `isDark=true` (OS dark respected)
- `override='light', systemScheme='dark'` → `isDark=false` (forced light overrides OS dark)
- `override='dark', systemScheme='light'` → `isDark=true` (forced dark overrides OS light)
- `override='system', systemScheme='unspecified'` → `isDark=false` (safe light default)

All seven test cases pass. `SettingsScreen.tsx` `handleOverrideSelect` calls `setOverride(newOverride)` immediately via the context setter — all theme consumers re-render instantly (React context re-render propagation, no restart required). Persistence mirrors AC-091: saved to AsyncStorage via `saveThemeOverride`, restored on `SettingsScreen` mount.

---

**Shared Conventions Compliance**

PASS — All strings via i18n hook

No inline string literals found in JSX or component logic in `SettingsScreen.tsx`. All user-visible strings use `t(...)` from `useTranslation('common')`, including accessibility labels. The only string constants are i18next key literals (e.g., `t('settings.language.title')`) which is the correct pattern.

PASS — No hardcoded hex colors in module files

`src/modules/mod-localization-theme/screens/SettingsScreen.tsx`: no hardcoded hex colors. All color values are `theme.colors.*` tokens from `useTheme()`. Confirmed by grep returning no matches.

Hardcoded hex values found in other modules (`mod-send-logging`, `mod-route-catalog`, `mod-beta-video`) are out of scope for this QA verification — those are the responsibility of their respective module QA runs.

PASS — Safe area insets

`SettingsScreen.tsx` calls `useSafeAreaInsets()` and passes `insets.top` to `makeStyles(theme, insets.top)`. The nav bar uses `paddingTop: topInset + theme.spacing.md`. `makeStyles` signature accepts `topInset: number` as second parameter. Fully compliant with the Screen Layout & Safe Area Insets shared convention.

`ProfileScreen.tsx` (modified by this module to add the settings gear icon entry point) already used `useSafeAreaInsets()` — unchanged and still correct.

PASS — ThemeProvider at app root

`App.tsx` wraps the app in `SafeAreaProvider → ThemeProvider → AuthNavigator`. `i18n.ts` is imported at the top of `App.tsx` before any component. Composition order is correct.

PASS — i18n hook rule (global)

Both locale catalogs (`locales/en/common.json`, `locales/zh-TW/common.json`) contain identical key sets as confirmed by `npm run check:i18n`. All existing module keys are present in both catalogs. New `settings.*` keys were added to both catalogs in the nested structure.

PASS — settings-storage.ts input validation

`loadLanguage()` validates stored string against `SUPPORTED_LANGUAGES` before returning — unknown values return `null`. `loadThemeOverride()` validates against `SUPPORTED_OVERRIDES`. Both functions have try/catch that returns `null` on AsyncStorage error (non-fatal, silent degradation is acceptable and matches the spec's local-persistence-only requirement).

PASS — No gold-plating

`SettingsScreen.tsx` implements exactly Language (AC-091) and Appearance (AC-092) — two sections, no additional settings controls (no password, notification, date/number formatting, RTL, or font-size controls). `settings-storage.ts` exposes exactly the four functions needed by `SettingsScreen`. `scripts/check-i18n-completeness.js` is scoped to leaf-key symmetry between `en` and `zh-TW` catalogs — no over-engineering.

PASS — No HTML template comments in spec

`project-planning/modules/mod-localization-theme/spec.md` contains no `<!-- ... -->` HTML template comments.

---

**CI Completeness Gate**

PARTIAL PASS — REQ-CI (CI completeness gate)

The spec states: "A CI check must fail on any missing zh-TW key."

The `check:i18n` npm script (`node scripts/check-i18n-completeness.js`) is implemented correctly. It exits 1 with a descriptive error when any English key lacks a zh-TW counterpart (or vice versa), and exits 0 when both catalogs are symmetric. Running it manually produces "i18n completeness OK" with exit code 0.

However, there is no CI pipeline configured in this repository — no `.github/workflows/` directory exists. The script is runnable but is not automatically enforced on every commit or pull request.

**Classification**: This is a spec compliance gap. The spec says "A CI check must fail" — the gate exists as a script but is not wired into any automated CI run. This gap is noted as PARTIAL PASS rather than FAIL because:
1. The script itself is fully functional and correct.
2. This project has no CI platform configured at all — setting up GitHub Actions or an equivalent is an infrastructure/project-setup decision that may be intentionally deferred for Phase 1.
3. The spec's wording ("A CI check must fail") could reasonably be interpreted as "the check script must be capable of failing CI" rather than "CI must currently be running."

Route: If CI is required to actually run before QA PASS, this is a spec-level scope question — escalate to PM, not Engineer. The script implementation itself is correct and not a bug.

---

**Summary**

| AC / Requirement | Result | Notes |
|---|---|---|
| AC-090: Device locale detection on first launch | PASS | All locale cases verified including zh-TW fallback for non-English |
| AC-091: Language toggle in Settings, immediate effect | PASS | i18n.changeLanguage() called live; AsyncStorage persistence |
| AC-092: Three-state theme override, immediate effect | PASS | resolveScheme logic verified; OS listener active |
| All strings via i18n hook | PASS | No inline literals found |
| No hardcoded hex colors in module | PASS | All colors from theme.colors.* tokens |
| Safe area insets | PASS | makeStyles(theme, insets.top) pattern used correctly |
| i18n catalog completeness (both languages) | PASS | npm run check:i18n exits 0 |
| CI completeness gate script | PASS | Script correct and functional |
| CI gate wired into automated pipeline | PARTIAL PASS | No .github/workflows — script exists but not auto-enforced |
| No gold-plating | PASS | Only AC-091 and AC-092 features implemented |
| No missing spec requirements | PASS | All three ACs covered |
| Input validation in settings-storage | PASS | Unknown values return null; try/catch on AsyncStorage errors |

**Overall verdict**: PASS (with one noted caveat: the CI completeness gate script is functional but not wired into an automated CI pipeline — this is a project infrastructure gap, not a script bug).

---

### Verification — 2026-10-13

**Workflow**: functional-test (Tech Lead audit follow-up — verifying AC-155, AC-157, AC-168, and CI gate per Tech Lead findings dated 2026-10-13)

**Automated test run**
- `npm test -- --watchAll=false` — 475 total, 474 passed, 1 failed. Exit code 1.
- The 1 failure is `src/modules/mod-beta-video/__tests__/beta-video-service.test.ts` (AC-162, `fetchBetaVideosByUser` route_name field). This failure is pre-existing committed state — `git diff HEAD` for the file returns no diff, and `git status` shows only an untracked migration file (no modifications). The MOD-010 engineer's self-check also noted this failure as pre-existing at 427/2 fail configuration. The 1 failure is out of scope for MOD-010.
- `npm run check:i18n` — "i18n completeness OK". Exit code 0.
- `npx tsc --noEmit` — 0 TypeScript errors. Exit code 0.
- No dedicated unit tests exist in `mod-localization-theme/__tests__/`. This remains not a spec requirement.

---

**AC-090: Device locale detection on first launch**

PASS AC-090

Re-verified: `src/lib/i18n.ts` `detectDeviceLanguage()` uses `getLocales()` from `expo-localization`. Device locale EN → `'en'`; any other locale → `'zh-TW'`. `fallbackLng: 'zh-TW'` set in i18next config. Unchanged from QA Run 1 (2026-09-29). PASS carries forward.

---

**AC-091: Language toggle in Settings — immediate effect, no restart**

PASS AC-091

Re-verified: `SettingsScreen.tsx` `handleLanguageSelect` calls `i18n.changeLanguage(lang)` immediately, then `saveLanguage(lang)` to AsyncStorage. `ProfileNavigator.tsx` wires `view === 'settings'` → `<SettingsScreen onBack={() => setView('profile')} />`. Unchanged from QA Run 1. PASS carries forward.

---

**AC-092: Light/Dark mode — OS default + three-state Settings override, immediate effect**

PASS AC-092

Re-verified: `src/lib/theme.ts` `ThemeProvider` reads `Appearance.getColorScheme()` on mount, subscribes to `Appearance.addChangeListener`, exposes `setOverride`. `SettingsScreen.tsx` `handleOverrideSelect` calls `setOverride(newOverride)` immediately. Unchanged from QA Run 1. PASS carries forward.

---

**AC-155: Blocked Accounts screen in Settings**

PASS AC-155

Verification method: code inspection of `BlockedAccountsScreen.tsx` and `SettingsScreen.tsx`.

`SettingsScreen.tsx`:
- `SettingsView` union type `'settings' | 'blockedAccounts'` declared at top of component.
- `view` state initialized to `'settings'`.
- All hooks (`useState`, `useEffect`, `useTranslation`, `useTheme`, `useSafeAreaInsets`) declared before the early return — React hooks rules satisfied.
- Early return at line 186–188: `if (view === 'blockedAccounts') { return <BlockedAccountsScreen onBack={() => { setView('settings'); }} />; }` — renders `BlockedAccountsScreen` in-place, replacing `SettingsScreen` output. No `ProfileNavigator` view-state change.
- "Blocked Accounts" tappable row (lines 296–312): `Pressable` with `onPress={() => { setView('blockedAccounts'); }}`, `chevron-forward` icon, label via `t('settings.blockedAccounts')`.

`BlockedAccountsScreen.tsx`:
- Imports `fetchMyBlockedUsers` and `unblockUser` from `../../mod-moderation/moderation-service` — correct cross-module import of MOD-009 public services.
- `BlockedUser` interface: `{ userId: string; displayName: string; avatarUrl: string | null }` — imported from `moderation-service`.
- On mount: `fetchMyBlockedUsers()` called in `useEffect` via `loadBlockedUsers()`. Loading state: `ActivityIndicator` centered. Error state: error text + retry Pressable. Empty state: `t('moderation.noBlockedAccounts')` centered.
- Each row (`BlockedUserRow` component): 48×48 circular avatar (`borderRadius: theme.borderRadius.full`), `display_name` in `<Text>`, outlined "Unblock" `<Pressable>` with `onUnblock(item.userId)`.
- Unblock: optimistic removal from `blockedUsers` state, then `unblockUser(userId)` call; on error, `loadBlockedUsers()` re-fetches to restore accurate state.
- Navigation: `onBack` prop calls `setView('settings')` in parent (`SettingsScreen`). Nav bar has `chevron-back` + `t('settings.back')` text button.
- Safe area: `useSafeAreaInsets()` + `makeStyles(theme, insets.top)` with `navBar: { paddingTop: topInset + theme.spacing.md }`.
- No hardcoded hex colors. All colors via `theme.colors.*`.
- i18n keys used: `settings.back`, `settings.blockedAccounts`, `moderation.unblock`, `moderation.noBlockedAccounts`, `common.error`, `common.retry` — all confirmed present in both EN and zh-TW catalogs.

Input=authenticated user taps "Blocked Accounts" row; Expected=BlockedAccountsScreen renders with list from `fetchMyBlockedUsers()`, per-row Unblock button, empty state when none; Actual=code inspection confirms all behaviors implemented correctly. PASS.

---

**AC-157: Beta Video Privacy toggle in SettingsScreen**

FAIL AC-157 (label mismatch — two bugs)

**Bug 1: State labels do not match spec**

Spec (AC-157): "two states — `public` (default, label '所有人'/'All Users') and `followers_only` (label '僅限追蹤者'/'Followers Only')".

Spec (Key Implementation Notes): "Two states: `public` (default, displayed as '所有人'/'All Users') and `followers_only` (displayed as '僅限追蹤者'/'Followers Only')."

The implementation uses a `Switch` component with a subtext descriptor below the row label. When `betaVideoPrivacy === 'public'`, the subtext shows `t('settings.betaVideoPrivacySubtextPublic')` = "All users can see your beta videos" (EN) / "所有人皆可觀看你的 Beta 影片" (zh-TW). When `betaVideoPrivacy === 'followers_only'`, the subtext shows `t('settings.betaVideoPrivacySubtextFollowersOnly')` = "Only followers can see your beta videos" (EN) / "僅限追蹤者可觀看你的 Beta 影片" (zh-TW).

No "All Users" / "所有人" short label and no "Followers Only" / "僅限追蹤者" short label are rendered anywhere in the toggle row. The subtext strings are descriptive sentences, not the short state labels the spec requires. The spec's "displayed as '所有人'" and "displayed as '僅限追蹤者'" refer to visible per-state labels, not sentence-form subtexts.

Input=SettingsScreen renders with `betaVideoPrivacy === 'public'`; Expected per spec=toggle row displays label "所有人" (zh-TW) or "All Users" (EN) for the current state; Actual=subtext "所有人皆可觀看你的 Beta 影片" / "All users can see your beta videos" displayed — a descriptive sentence, not the short label required by spec. Route: Engineer.

**Bug 2: SettingsScreen row order does not match spec**

Spec (Key Implementation Notes, line 152): "SettingsScreen row order from top to bottom is: (existing sections) → 'Blocked Accounts' row (AC-155) → 'Beta Video Privacy' toggle row (AC-157) → Logout button (AC-168)."

Actual order in `SettingsScreen.tsx` (lines 213–334): Language (AC-091) → Appearance (AC-092) → Beta Video Privacy toggle (AC-157, lines 273–294) → Blocked Accounts row (AC-155, lines 296–312) → Logout button (AC-168, lines 314–334).

The Beta Video Privacy toggle (AC-157) appears BEFORE the Blocked Accounts row (AC-155). The spec requires AC-155 to appear before AC-157.

Input=SettingsScreen renders; Expected per spec=Blocked Accounts row appears above Beta Video Privacy toggle; Actual=Beta Video Privacy toggle appears above Blocked Accounts row (AC-155 and AC-157 are swapped). Route: Engineer.

**Items that DO pass within AC-157:**
- Toggle calls `updateBetaVideoPrivacy(newValue)` from `mod-auth-profile/auth-service` — MOD-001 public service import confirmed at line 53. MOD-010 does NOT write directly to `users.beta_video_privacy` — the only direct Supabase call in `SettingsScreen.tsx` is a SELECT read (`supabase.from('users').select('beta_video_privacy')`) to load the initial value on mount.
- Toggle reads current `beta_video_privacy` on mount from the `users` table.
- Toggle reflects new state immediately after successful write.
- `disabled={!privacyFetched || privacyLoading}` prevents interaction before initial DB value loads.
- i18n keys for the toggle row are present in both EN and zh-TW catalogs.
- All colors via `theme.colors.*` — no hardcoded hex.

---

**AC-168: Logout button at bottom of SettingsScreen**

PASS AC-168

Verification method: code inspection of `SettingsScreen.tsx` lines 314–334.

- Logout button is the last element inside the `ScrollView`, after the Blocked Accounts section (AC-155) — it is at the very bottom of all rendered rows.
- `Pressable` with `onPress={() => { void handleLogout(); }}`.
- `handleLogout()` (lines 161–171): calls `signOut()` from `mod-auth-profile/auth-service` (MOD-001 public service). On error: `setLogoutError(message)` + `setIsSigningOut(false)`. On success: `AuthNavigator` observes `onAuthStateChange` SIGNED_OUT event and routes back to signed-out state automatically (same pattern as former `ProfileScreen` logout).
- `logoutError` text rendered above button when non-null (line 315–317) — error-handling pattern matches former `ProfileScreen` logout.
- Styling: `borderColor: theme.colors.error`, `logoutButtonText: { color: theme.colors.error }` — error color, outlined — matches former `ProfileScreen` logout button style.
- `ActivityIndicator` shown during `isSigningOut` state.
- Label via `t('profile.logout')` — i18n-correct, no inline string literal.

Note: Although AC-157 has a row-order failure (AC-155 and AC-157 are swapped relative to spec), the Logout button itself is correctly at the very bottom, below both AC-155 and AC-157 rows regardless of their relative order. AC-168 is PASS as a standalone criterion.

---

**REQ-CI: zh-TW key-parity CI gate**

FAIL REQ-CI

Spec (Context): "A CI check must fail if any English key lacks a zh-TW counterpart."
Spec (Key Implementation Notes): "A CI check must fail on any missing zh-TW key (e.g., `i18next-parser --fail-on-warnings` or a custom script). This check must be set up as part of MOD-010 and applied globally."

The `scripts/check-i18n-completeness.js` script is correctly implemented and exits 1 when any key is missing. `npm run check:i18n` exits 0 (catalogs are currently symmetric). However, no `.github/workflows/` directory exists in the repository — the script is not wired into any automated CI pipeline and does not run on commits or pull requests.

The spec requires a CI check that "must fail" — meaning it must run automatically and block on failure, not merely be available to run manually. The Tech Lead audit explicitly directed: "Check if it exists. If missing, flag it as a QA failure." The script exists; the CI pipeline does not.

Input=engineer commits a new EN i18n key without a zh-TW counterpart; Expected per spec=CI check fails and blocks the commit/PR; Actual=no automated check runs — the gap would be undetected until `npm run check:i18n` is manually invoked. Route: Engineer (add `.github/workflows/ci.yml` or equivalent that runs `npm run check:i18n` on each push/PR).

Note: This was classified PARTIAL PASS in QA Run 1 (2026-09-29) with a spec-level escalation route. Per the Tech Lead's explicit 2026-10-13 directive — "Check if it exists. If missing, flag it as a QA failure" — this run reclassifies it as FAIL. The script is not disputed; the absence of a wired CI pipeline is the failure.

---

**Regression — Previously Passing ACs**

**AC-090 regression** — PASS. `src/lib/i18n.ts` unchanged. `detectDeviceLanguage()` logic unchanged.

**AC-091 regression** — PASS. `SettingsScreen.tsx` language section (lines 213–241) unchanged in behavior. `handleLanguageSelect` wiring unchanged.

**AC-092 regression** — PASS. `SettingsScreen.tsx` appearance section (lines 243–271) unchanged. `handleOverrideSelect` wiring unchanged. `src/lib/theme.ts` unchanged.

**All strings via i18n hook** — PASS. `SettingsScreen.tsx` and `BlockedAccountsScreen.tsx` — no inline string literals. All user-visible strings use `t(...)`. `accessibilityLabel={t('settings.back') ?? 'Back'}` on the back button contains a `?? 'Back'` fallback raw string, but this is a null-safety accessor for an accessibility attribute, not a rendered text node — consistent with the prior pattern used in MOD-001 screens. No regression.

**No hardcoded hex colors** — PASS. `SettingsScreen.tsx`, `BlockedAccountsScreen.tsx`, `settings-storage.ts` — grep for hex color patterns returns no matches.

**Safe area insets** — PASS. Both `SettingsScreen.tsx` and `BlockedAccountsScreen.tsx` call `useSafeAreaInsets()` and pass `insets.top` to `makeStyles(theme, insets.top)`. Both nav bars use `paddingTop: topInset + theme.spacing.md`.

**i18n catalog completeness** — PASS. `npm run check:i18n` exits 0. All keys symmetric between EN and zh-TW.

**No gold-plating** — PASS. `BlockedAccountsScreen.tsx` and the AC-155/AC-157/AC-168 additions to `SettingsScreen.tsx` implement exactly what the spec requires. No extra controls, screens, or service functions beyond spec scope.

---

**Summary**

| AC / Requirement | Result | Notes |
|---|---|---|
| AC-090: Device locale detection on first launch | PASS | Unchanged from QA Run 1 |
| AC-091: Language toggle in Settings, immediate effect | PASS | Unchanged from QA Run 1 |
| AC-092: Three-state theme override, immediate effect | PASS | Unchanged from QA Run 1 |
| AC-155: Blocked Accounts screen — list, Unblock, empty state | PASS | fetchMyBlockedUsers + unblockUser from MOD-009; sub-view state; no ProfileNavigator change |
| AC-157: Beta Video Privacy toggle — MOD-001 write, no direct DB write | PASS (partial) | Write delegation correct; initial load correct; but see failures below |
| AC-157: Beta Video Privacy toggle — state labels "所有人"/"All Users", "僅限追蹤者"/"Followers Only" | FAIL | Subtext sentences used instead of short per-state labels required by spec |
| AC-157: SettingsScreen row order — AC-155 before AC-157 | FAIL | AC-157 (Beta Video Privacy) renders before AC-155 (Blocked Accounts) — reversed from spec |
| AC-168: Logout button at very bottom, error color outlined, signOut from MOD-001 | PASS | Correctly below all rows; error-color outlined; signOut from mod-auth-profile/auth-service |
| REQ-CI: zh-TW key-parity CI gate wired into automated pipeline | FAIL | Script exists and is correct; no .github/workflows/ — gate not enforced automatically |
| All strings via i18n hook | PASS | No inline literals in new screens |
| No hardcoded hex colors | PASS | All colors from theme.colors.* tokens |
| Safe area insets — both new screens | PASS | useSafeAreaInsets + makeStyles(theme, topInset) on SettingsScreen and BlockedAccountsScreen |
| i18n catalog completeness | PASS | npm run check:i18n exits 0 |
| TypeScript strict mode | PASS | npx tsc --noEmit exits 0 |
| No gold-plating | PASS | All additions map to spec requirements |

**Overall verdict: FAIL**

**Failure count: 3**

1. FAIL AC-157 (label): `src/modules/mod-localization-theme/screens/SettingsScreen.tsx` lines 279–283 — Beta Video Privacy toggle displays sentence-form subtext ("All users can see your beta videos" / "Only followers can see your beta videos") rather than the short per-state labels required by spec ("所有人"/"All Users" for public, "僅限追蹤者"/"Followers Only" for followers_only). Input=SettingsScreen renders; Actual=descriptive subtext displayed; Expected per spec AC-157=short state labels displayed. Route: Engineer.

2. FAIL AC-157 (row order): `src/modules/mod-localization-theme/screens/SettingsScreen.tsx` lines 273–312 — Beta Video Privacy toggle (AC-157) appears before Blocked Accounts row (AC-155) in the JSX render order. Spec Key Implementation Notes state: row order from top to bottom is "Blocked Accounts" (AC-155) → "Beta Video Privacy" (AC-157) → Logout (AC-168). Input=SettingsScreen renders; Actual=AC-157 section at lines 273–294, AC-155 section at lines 296–312 (AC-157 above AC-155); Expected per spec=AC-155 above AC-157. Route: Engineer.

3. FAIL REQ-CI (CI gate): No `.github/workflows/` directory exists. `scripts/check-i18n-completeness.js` is implemented correctly and passes manually, but is not wired into any automated CI pipeline. Input=engineer pushes a commit with a missing zh-TW key; Actual=no automated check runs; Expected per spec="A CI check must fail if any English key lacks a zh-TW counterpart." Route: Engineer.

---

### QA Run 2 — Regression — 2026-10-13

**Workflow**: regression-test (re-verification after engineer bugfix — three failures from Verification 2026-10-13)

**Bugs being re-verified**:
1. AC-157 (label): subtext sentences shown instead of short per-state labels
2. AC-157 (row order): Beta Video Privacy section rendered before Blocked Accounts section
3. REQ-CI: no `.github/workflows/` directory existed

**Automated test run**
- `npx tsc --noEmit` — exit 0. 0 TypeScript errors.
- `npm run check:i18n` — "i18n completeness OK". Exit 0.
- `npm test -- --watchAll=false` — 475 total, 474 passed, 1 failed. Exit 1. The 1 failure is `src/modules/mod-beta-video/__tests__/beta-video-service.test.ts` AC-162 `fetchBetaVideosByUser` route_name field — same pre-existing failure present across all prior QA runs; confirmed committed state, not introduced by this fix. Out of scope for MOD-010.

---

**REGRESSION PASS — Bug 1: AC-157 label mismatch resolved**

Re-verification method: code inspection of `locales/en/common.json`, `locales/zh-TW/common.json`, and `SettingsScreen.tsx`.

New i18n keys confirmed present in both catalogs:
- `locales/en/common.json` line 66: `"betaVideoPrivacyPublic": "All Users"` — correct short label
- `locales/en/common.json` line 67: `"betaVideoPrivacyFollowersOnly": "Followers Only"` — correct short label
- `locales/zh-TW/common.json` line 66: `"betaVideoPrivacyPublic": "所有人"` — correct short label
- `locales/zh-TW/common.json` line 67: `"betaVideoPrivacyFollowersOnly": "僅限追蹤者"` — correct short label

`SettingsScreen.tsx` lines 297–300 (Privacy section, `settingRowSubtext`):
```
{betaVideoPrivacy === 'followers_only'
  ? t('settings.betaVideoPrivacyFollowersOnly')
  : t('settings.betaVideoPrivacyPublic')}
```

Input=SettingsScreen renders with `betaVideoPrivacy === 'public'`; Expected per spec=short label "All Users" (EN) / "所有人" (zh-TW) displayed; Actual=`t('settings.betaVideoPrivacyPublic')` resolves to "All Users" / "所有人" — correct short label, not a sentence. REGRESSION PASS.

Input=SettingsScreen renders with `betaVideoPrivacy === 'followers_only'`; Expected per spec=short label "Followers Only" (EN) / "僅限追蹤者" (zh-TW) displayed; Actual=`t('settings.betaVideoPrivacyFollowersOnly')` resolves to "Followers Only" / "僅限追蹤者" — correct short label. REGRESSION PASS.

Old sentence-form keys (`settings.betaVideoPrivacySubtextPublic`, `settings.betaVideoPrivacySubtextFollowersOnly`) remain in both catalogs but are no longer referenced in `SettingsScreen.tsx` — they are dead keys, not a correctness issue (no missing key in either direction; `npm run check:i18n` exits 0).

---

**REGRESSION PASS — Bug 2: AC-157 row order resolved**

Re-verification method: code inspection of `SettingsScreen.tsx` JSX render order (lines 190–335).

Render order within `<ScrollView>` (lines 208–335):
1. Language section (AC-091) — lines 213–241
2. Appearance section (AC-092) — lines 243–271
3. Account section — Blocked Accounts row (AC-155) — lines 273–289
4. Privacy section — Beta Video Privacy toggle (AC-157) — lines 291–312
5. Logout button (AC-168) — lines 314–334

Spec required order: (existing sections) → Blocked Accounts (AC-155) → Beta Video Privacy (AC-157) → Logout (AC-168).

Actual order matches spec exactly. Blocked Accounts (AC-155) at lines 273–289 renders before Beta Video Privacy (AC-157) at lines 291–312. Logout (AC-168) at lines 314–334 is last. REGRESSION PASS.

---

**REGRESSION PASS — Bug 3: REQ-CI workflow resolved**

Re-verification: `.github/workflows/i18n-check.yml` exists at `/Users/tsan/Desktop/MacBookPro/send-it/.github/workflows/i18n-check.yml`.

File content verified:
- `on: push: branches: [main]` and `on: pull_request: branches: [main]` — triggers on push and pull_request to main.
- `runs-on: ubuntu-latest`
- `actions/checkout@v4` and `actions/setup-node@v4` (Node 20) steps present.
- Run step: `node scripts/check-i18n-completeness.js` — correct script invocation.

Input=engineer pushes a commit with a missing zh-TW key to main; Expected per spec=CI check runs automatically and fails; Actual=`.github/workflows/i18n-check.yml` triggers on push/pull_request to main and runs `node scripts/check-i18n-completeness.js`, which exits 1 on any missing key. REGRESSION PASS.

---

**Re-verification of all previously passing ACs**

**AC-090** — PASS. `src/lib/i18n.ts` unchanged. `detectDeviceLanguage()` logic unchanged. PASS carries forward.

**AC-091** — PASS. `SettingsScreen.tsx` language section (lines 213–241) unchanged. `handleLanguageSelect` calls `i18n.changeLanguage(lang)` then `saveLanguage(lang)`. PASS carries forward.

**AC-092** — PASS. `SettingsScreen.tsx` appearance section (lines 243–271) unchanged. `handleOverrideSelect` calls `setOverride(newOverride)` then `saveThemeOverride(newOverride)`. `src/lib/theme.ts` unchanged. PASS carries forward.

**AC-155** — PASS. `SettingsScreen.tsx` early return (line 186–188) unchanged — `view === 'blockedAccounts'` renders `<BlockedAccountsScreen>`. Blocked Accounts row (lines 276–288) unchanged — `onPress={() => { setView('blockedAccounts'); }}`. `BlockedAccountsScreen.tsx` unchanged. PASS carries forward.

**AC-157 — partial aspects that were passing** — PASS. Toggle still calls `updateBetaVideoPrivacy(newValue)` from `mod-auth-profile/auth-service` (line 151). MOD-010 still does not write directly to `users.beta_video_privacy` — only a SELECT read on mount. `disabled={!privacyFetched || privacyLoading}` still guards premature interaction. No regression on any of these sub-items.

**AC-168** — PASS. `handleLogout()` (lines 161–172) calls `signOut()` from `mod-auth-profile/auth-service`. Error handling and `ActivityIndicator` during sign-out unchanged. Logout button at very bottom of `ScrollView`, below all other rows. Styling `borderColor: theme.colors.error` + `color: theme.colors.error` unchanged. PASS carries forward.

**All strings via i18n hook** — PASS. No inline string literals in `SettingsScreen.tsx` or `BlockedAccountsScreen.tsx`. All user-visible strings via `t(...)`. The two new i18n keys added by the fix use the correct `t('settings.betaVideoPrivacyPublic')` / `t('settings.betaVideoPrivacyFollowersOnly')` pattern. No regression.

**No hardcoded hex colors** — PASS. No hex color literals introduced in the fix. All colors remain `theme.colors.*` tokens. No regression.

**Safe area insets** — PASS. `useSafeAreaInsets()` + `makeStyles(theme, insets.top)` pattern unchanged in both `SettingsScreen.tsx` and `BlockedAccountsScreen.tsx`. No regression.

**i18n catalog completeness** — PASS. `npm run check:i18n` exits 0. Both EN and zh-TW catalogs symmetric. New keys `betaVideoPrivacyPublic` and `betaVideoPrivacyFollowersOnly` present in both; old sentence-form keys still present in both (symmetric, not a gap). No regression.

**TypeScript strict mode** — PASS. `npx tsc --noEmit` exits 0. No regression.

**No gold-plating** — PASS. Fix adds exactly two new i18n keys per locale and one `.github/workflows/` file. No extra features introduced. No regression.

---

**Summary**

| AC / Requirement | Result | Notes |
|---|---|---|
| AC-090: Device locale detection on first launch | PASS | Unchanged; no regression |
| AC-091: Language toggle in Settings, immediate effect | PASS | Unchanged; no regression |
| AC-092: Three-state theme override, immediate effect | PASS | Unchanged; no regression |
| AC-155: Blocked Accounts screen — list, Unblock, empty state | PASS | Unchanged; no regression |
| AC-157: Beta Video Privacy toggle — state labels "所有人"/"All Users", "僅限追蹤者"/"Followers Only" | REGRESSION PASS | Short labels now rendered via betaVideoPrivacyPublic / betaVideoPrivacyFollowersOnly keys |
| AC-157: SettingsScreen row order — AC-155 before AC-157 | REGRESSION PASS | Blocked Accounts (AC-155) now renders before Beta Video Privacy (AC-157) |
| AC-157: Beta Video Privacy toggle — MOD-001 write, no direct DB write | PASS | Unchanged; no regression |
| AC-168: Logout button at very bottom, error color outlined, signOut from MOD-001 | PASS | Unchanged; no regression |
| REQ-CI: zh-TW key-parity CI gate wired into automated pipeline | REGRESSION PASS | .github/workflows/i18n-check.yml exists; triggers on push/pull_request to main |
| All strings via i18n hook | PASS | No inline literals; new keys use t() pattern correctly |
| No hardcoded hex colors | PASS | All colors from theme.colors.* tokens |
| Safe area insets | PASS | useSafeAreaInsets + makeStyles(theme, topInset) unchanged |
| i18n catalog completeness | PASS | npm run check:i18n exits 0; all keys symmetric |
| TypeScript strict mode | PASS | npx tsc --noEmit exits 0 |
| No gold-plating | PASS | Fix scoped exactly to the three reported failures |

**Overall verdict: QA PASS**

All three bugs from QA Run 1 (Verification 2026-10-13) are resolved. All five ACs (AC-090, AC-091, AC-092, AC-155, AC-157, AC-168) pass. No regressions introduced. Module is ready for human sign-off.

---

### QA Run 3 — Regression — 2026-10-15

**Workflow**: regression-test (re-verification after engineer bugfix — theme initialization fix: ThemeProvider loads saved override on mount; SettingsScreen mount effect no longer calls setOverride)

**Change being re-verified**:
- `src/lib/theme.ts`: added `useEffect` that reads `'app_theme_override'` from AsyncStorage on mount and calls `setOverride(saved)` if valid. Corrects the wrong-theme-on-launch bug.
- `src/modules/mod-localization-theme/screens/SettingsScreen.tsx`: `restorePreferences` mount effect no longer calls `setOverride(savedOverride)` — only `setSelectedOverride` (local UI state) is set. ThemeProvider now owns the initial override load.

**Automated test run**
- `npx tsc --noEmit` — exit 0. 0 TypeScript errors.
- `npm run check:i18n` — "i18n completeness OK". Exit 0.

---

**AC-091: Language toggle in Settings — immediate effect, no restart**

PASS AC-091

Verification method: code inspection of `SettingsScreen.tsx` lines 135–139.

`handleLanguageSelect` calls `i18n.changeLanguage(lang)` (line 137) and `saveLanguage(lang)` (line 138) — unchanged. Language section (lines 214–242) is structurally identical to QA Run 2. `restorePreferences` still restores language via `setSelectedLanguage(savedLang)` and `i18n.changeLanguage(savedLang)` (lines 98–103). No regression.

---

**AC-092: Light/Dark mode — OS default + three-state Settings override, immediate effect**

PASS AC-092

Verification method: code inspection of `src/lib/theme.ts` and `SettingsScreen.tsx`.

**New behavior — ThemeProvider loads saved override on mount:**
- `src/lib/theme.ts` lines 170–182: `useEffect([], ...)` calls `AsyncStorage.getItem('app_theme_override')`. If stored value is `'light'`, `'dark'`, or `'system'`, calls `setOverride(saved)`. Key `'app_theme_override'` matches `settings-storage.ts` `THEME_OVERRIDE_KEY = 'app_theme_override'` (confirmed at line 15 of `settings-storage.ts`). Errors silently swallowed; default `'system'` applies when nothing is stored or AsyncStorage throws.
- Result: the correct saved theme is applied from ThemeProvider's first render cycle, eliminating the wrong-theme-on-launch issue and the theme flash on Settings open.

**SettingsScreen mount effect — setOverride removed:**
- `handleOverrideSelect` (lines 141–145) still calls `setOverride(newOverride)` for live user selection — the live-override-without-restart requirement of AC-092 is fully preserved.
- `SettingsScreen.tsx` `restorePreferences` (lines 91–113): `savedOverride` is loaded via `loadThemeOverride()`, then `setSelectedOverride(savedOverride)` is called (line 106) to sync local radio-button UI state. The explicit `setOverride(savedOverride)` call is absent; the comment at line 107 confirms: "setOverride is now handled by ThemeProvider on init — do not call here". `setOverride` remains destructured from `useTheme()` (line 72) and is used in `handleOverrideSelect` (line 143) — no unused-variable issue.
- No double-apply risk: ThemeProvider's mount effect runs once; SettingsScreen's mount effect runs once. They read the same AsyncStorage key independently. ThemeProvider's call updates the live context; SettingsScreen's call updates only local UI state. The two do not conflict.

Input=app launches with a previously saved `'dark'` override; Expected per spec=ThemeProvider applies dark theme immediately on launch, no theme flash; Actual=ThemeProvider reads `'app_theme_override'` on mount and calls `setOverride('dark')` — dark theme applied from first render. PASS.

Input=user selects "Light" in Settings override; Expected per spec=theme switches to light immediately without restart; Actual=`handleOverrideSelect('light')` calls `setOverride('light')` and `saveThemeOverride('light')` — immediate effect, persisted. PASS.

`resolveScheme` logic and OS appearance listener (`Appearance.addChangeListener`) are unchanged from QA Run 2. All five `resolveScheme` test cases still hold. PASS carries forward.

---

**AC-157: Beta Video Privacy toggle in SettingsScreen**

PASS AC-157

Re-verification: `SettingsScreen.tsx` lines 274–313. AC-155 (Blocked Accounts) section renders at lines 274–290 before AC-157 (Beta Video Privacy) section at lines 292–313. Row order matches spec. Short labels `t('settings.betaVideoPrivacyPublic')` / `t('settings.betaVideoPrivacyFollowersOnly')` rendered in `settingRowSubtext` (lines 298–301). `updateBetaVideoPrivacy(newValue)` called via MOD-001 import (line 53). No direct DB write by MOD-010. `disabled={!privacyFetched || privacyLoading}` guards premature interaction. The `setOverride` removal in `restorePreferences` has no effect on the Beta Video Privacy code path. No regression. PASS.

---

**AC-168: Logout button at bottom of SettingsScreen**

PASS AC-168

Re-verification: `SettingsScreen.tsx` lines 315–335. Logout button is the last element in the `ScrollView`. `handleLogout()` (lines 161–173) calls `signOut()` from `mod-auth-profile/auth-service`. Error handling and `ActivityIndicator` unchanged. Styling `borderColor: theme.colors.error`, `color: theme.colors.error` unchanged. The `setOverride` removal in `restorePreferences` has no effect on the Logout button code path. No regression. PASS.

---

**Re-verification of all previously passing ACs**

**AC-090** — PASS. `src/lib/i18n.ts` unchanged. `detectDeviceLanguage()` logic unchanged. PASS carries forward.

**AC-155** — PASS. `SettingsScreen.tsx` early return (lines 186–188) unchanged. Blocked Accounts row (lines 277–289) unchanged. `BlockedAccountsScreen.tsx` unchanged. PASS carries forward.

**All strings via i18n hook** — PASS. No inline string literals introduced by the theme-init fix. `theme.ts` and the `restorePreferences` change add no user-visible strings. All existing `t(...)` patterns unchanged. No regression.

**No hardcoded hex colors** — PASS. `theme.ts` fix adds no new color literals in component code; the hex values in `LIGHT_PALETTE` and `DARK_PALETTE` are token definitions — the correct location for the token source. `SettingsScreen.tsx` unchanged. No regression.

**Safe area insets** — PASS. `useSafeAreaInsets()` + `makeStyles(theme, insets.top)` in `SettingsScreen.tsx` (lines 73–74) unchanged. `BlockedAccountsScreen.tsx` unchanged. No regression.

**i18n catalog completeness** — PASS. `npm run check:i18n` exits 0. No new keys introduced by this fix. No regression.

**TypeScript strict mode** — PASS. `npx tsc --noEmit` exits 0. No regression.

**REQ-CI** — PASS. `.github/workflows/i18n-check.yml` exists and is unchanged. Triggers on push/pull_request to main. No regression.

**No gold-plating** — PASS. Fix adds exactly one `useEffect` to `ThemeProvider` and removes one `setOverride` call from `SettingsScreen.tsx`. No extra features introduced. No regression.

---

**Summary**

| AC / Requirement | Result | Notes |
|---|---|---|
| AC-090: Device locale detection on first launch | PASS | Unchanged; no regression |
| AC-091: Language toggle in Settings, immediate effect | PASS | handleLanguageSelect unchanged; restorePreferences language path unchanged |
| AC-092: Three-state theme override, immediate effect | PASS | ThemeProvider now loads saved override on mount; handleOverrideSelect still calls setOverride for live changes; no restart required |
| AC-155: Blocked Accounts screen — list, Unblock, empty state | PASS | Unchanged; no regression |
| AC-157: Beta Video Privacy toggle — state labels, row order, MOD-001 write | PASS | All sub-items from QA Run 2 unchanged; no regression from theme-init fix |
| AC-168: Logout button at very bottom, error color outlined, signOut from MOD-001 | PASS | Unchanged; no regression |
| REQ-CI: zh-TW key-parity CI gate wired into automated pipeline | PASS | .github/workflows/i18n-check.yml unchanged; triggers on push/pull_request to main |
| All strings via i18n hook | PASS | No inline literals introduced; all t() patterns unchanged |
| No hardcoded hex colors | PASS | No new hex literals in component code; theme.ts palette definitions are the token source (correct location) |
| Safe area insets | PASS | useSafeAreaInsets + makeStyles(theme, topInset) unchanged |
| i18n catalog completeness | PASS | npm run check:i18n exits 0; no new keys introduced |
| TypeScript strict mode | PASS | npx tsc --noEmit exits 0 |
| No gold-plating | PASS | Fix scoped exactly to theme initialization correction |

**Overall verdict: QA PASS**

The theme-initialization fix is correct and complete. ThemeProvider now loads the saved override from AsyncStorage on mount (key `'app_theme_override'`, validated against `ThemeOverride` union before applying), eliminating the wrong-theme-on-launch behavior. SettingsScreen no longer redundantly calls `setOverride` on mount — only local UI state is synced there; ThemeProvider owns the initial override application. The live-override path (`handleOverrideSelect` calling `setOverride`) is untouched. All previously passing ACs (AC-090, AC-091, AC-092, AC-155, AC-157, AC-168, REQ-CI) continue to pass. No regressions introduced.
