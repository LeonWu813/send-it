# QA Regression Report: MOD-001 Safe Area Inset Bugfix

**Date:** 2026-09-21
**Type:** Static code review — regression test
**Fix scope:** SafeAreaProvider added to root; dynamic `useSafeAreaInsets()` replaces fixed `paddingTop` values across 4 screens

---

## File Results

### 1. App.tsx — PASS

| Check | Result | Detail |
|---|---|---|
| `SafeAreaProvider` imported from `react-native-safe-area-context` | PASS | Line 9 |
| `SafeAreaProvider` is outermost wrapper, outside `ThemeProvider` | PASS | Lines 33-39: order is `SafeAreaProvider > ThemeProvider > AuthNavigator` |
| No other logic changed | PASS | `useSession`, `AppShell`, `GymNavigator`, `AuthNavigator` all untouched |

---

### 2. SignInScreen.tsx — PASS

| Check | Result | Detail |
|---|---|---|
| `useSafeAreaInsets` imported from `react-native-safe-area-context` | PASS | Line 33 |
| `const insets = useSafeAreaInsets()` called inside component | PASS | Line 51 |
| `makeStyles` called with `(theme, insets.top)` | PASS | Line 52 |
| `makeStyles` signature accepts `topInset: number` as second param | PASS | Line 248 |
| Root/scroll container `paddingTop` is `topInset + theme.spacing.md` | PASS | Line 257: `scrollContent.paddingTop` |
| No fixed `paddingTop` values remain in root container | PASS | No bare spacing token on root or scrollContent top |
| ScrollView `scrollContent` uses explicit sides, no `padding` shorthand | PASS | Lines 254-259: `paddingHorizontal`, `paddingTop`, `paddingBottom` all explicit |
| All original logic, data fetching, navigation, UI structure unchanged | PASS | Sign-in handlers, Apple/Google auth, error state, navigation — all intact |
| No new TypeScript errors | PASS | `topInset: number` matches `insets.top` (type `number`); no mismatched types visible |

---

### 3. SignUpScreen.tsx — PASS

| Check | Result | Detail |
|---|---|---|
| `useSafeAreaInsets` imported from `react-native-safe-area-context` | PASS | Line 23 |
| `const insets = useSafeAreaInsets()` called inside component | PASS | Line 37 |
| `makeStyles` called with `(theme, insets.top)` | PASS | Line 38 |
| `makeStyles` signature accepts `topInset: number` as second param | PASS | Line 182 |
| Root/scroll container `paddingTop` is `topInset + theme.spacing.md` | PASS | Line 191: `scrollContent.paddingTop` |
| No fixed `paddingTop` values remain in root container | PASS | No bare spacing token on root or scrollContent top |
| ScrollView `scrollContent` uses explicit sides, no `padding` shorthand | PASS | Lines 188-193: `paddingHorizontal`, `paddingTop`, `paddingBottom` all explicit |
| All original logic, data fetching, navigation, UI structure unchanged | PASS | Validation, sign-up handler, error state, navigation — all intact |
| No new TypeScript errors | PASS | `topInset: number` matches `insets.top`; no mismatched types visible |

---

### 4. HomeGymSelectionScreen.tsx — PASS

| Check | Result | Detail |
|---|---|---|
| `useSafeAreaInsets` imported from `react-native-safe-area-context` | PASS | Line 27 |
| `const insets = useSafeAreaInsets()` called inside component | PASS | Line 46 |
| `makeStyles` called with `(theme, insets.top)` | PASS | Line 47 |
| `makeStyles` signature accepts `topInset: number` as second param | PASS | Line 214 |
| Root container `paddingTop` is `topInset + theme.spacing.md` | PASS | Lines 216-221: `root.paddingTop` (this screen uses `View` root, not `ScrollView`) |
| No fixed `paddingTop` values remain in root container | PASS | No bare spacing token on root |
| No `padding` shorthand overriding dynamic top | PASS | `FlatList` `listContent` only has `paddingBottom`; no shorthand `padding` anywhere that would override |
| All original logic, data fetching, navigation, UI structure unchanged | PASS | Supabase gym fetch, search filter, selection, `setHomeGym`, onboarding skip — all intact |
| No new TypeScript errors | PASS | `topInset: number` matches `insets.top`; no mismatched types visible |

---

### 5. EditProfileScreen.tsx — PASS

| Check | Result | Detail |
|---|---|---|
| `useSafeAreaInsets` imported from `react-native-safe-area-context` | PASS | Line 27 |
| `const insets = useSafeAreaInsets()` called inside component | PASS | Line 48 |
| `makeStyles` called with `(theme, insets.top)` | PASS | Line 49 |
| `makeStyles` signature accepts `topInset: number` as second param | PASS | Line 277 |
| Root/scroll container `paddingTop` is `topInset + theme.spacing.md` | PASS | Line 284: `scrollContent.paddingTop` |
| No fixed `paddingTop` values remain in root container | PASS | No bare spacing token on root or scrollContent top |
| ScrollView `scrollContent` uses explicit sides, no `padding` shorthand | PASS | Lines 283-287: `paddingTop`, `paddingHorizontal`, `paddingBottom` all explicit |
| All original logic, data fetching, navigation, UI structure unchanged | PASS | Avatar pick/upload, display name, bio, privacy toggle, `upsertProfile`, `onSaved`/`onCancel` — all intact |
| No new TypeScript errors | PASS | `topInset: number` matches `insets.top`; no mismatched types visible |

---

## Overall Verdict: PASS

All 5 files pass all verification checks. The fix is correctly and consistently applied:

- `SafeAreaProvider` correctly wraps the entire tree at root level in `App.tsx`.
- All 4 screens import `useSafeAreaInsets`, call it inside the component, pass `insets.top` to `makeStyles`, and apply `topInset + theme.spacing.md` as `paddingTop` on their root or scroll containers.
- No screen uses a bare spacing token (e.g., `theme.spacing.xl`) alone as `paddingTop` on the root container.
- No screen uses a `padding` shorthand that would override the dynamic top inset.
- No original logic, data fetching, navigation, or UI structure was altered by the fix.
- No TypeScript type mismatches introduced.
