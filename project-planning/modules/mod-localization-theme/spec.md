# MOD-010: Localization & Theming — Spec

**Module ID**: MOD-010
**Module Name**: Localization & Theming
**Phase**: 1
**Dependencies**: MOD-001 (public service to update `beta_video_privacy` for the SettingsScreen beta-video privacy toggle, AC-157), MOD-009 (block-status + unblock public services `fetchMyBlockedUsers` / `unblockUser` for the Blocked Accounts screen, AC-155)
**Last Synced from PRD Revision**: 41
**Last Updated**: 2026-09-30

---

## Purpose

Provide i18n message catalog loading (English, zh-TW), device-locale detection with zh-TW fallback, in-app language toggle, and Light/Dark theming that follows OS preference with a manual Settings override. Own the Settings screen "Blocked Accounts" row and the Blocked Accounts screen (AC-155), which lists the current user's blocked users and offers per-row unblock via MOD-009's public services (`fetchMyBlockedUsers` / `unblockUser`). Own the Settings screen "Beta Video Privacy" toggle row (AC-157), which reads and updates the current user's `beta_video_privacy` setting by calling MOD-001's public service (MOD-001 owns the profile write). Own the SettingsScreen Logout button (AC-168), relocated from the Profile screen (AC-167, MOD-001).

---

## Context

Send It targets the Taiwan indoor bouldering community, so Traditional Chinese (zh-TW) is the primary fallback language. The app supports English and zh-TW only in Phase 1. On first launch, the device locale is detected: if English, the app language is set to English; for any other locale, the fallback is zh-TW. Users can toggle language in Settings with immediate effect (no app restart required). Light/Dark mode follows the OS preference by default; Settings exposes a three-state override (System / Light / Dark) that also takes effect without an app restart. All user-facing strings must be pulled through the i18n hook — no inline string literals in components. Message catalogs must be complete (no missing zh-TW keys) at ship. A CI check must fail on any missing zh-TW key. Every screen must use tokens from the theme provider — no hardcoded hex colors in components.

For US-016, the SettingsScreen presents a "Blocked Accounts" tappable row. Tapping it opens a BlockedAccountsScreen listing the current user's blocked users via MOD-009's `fetchMyBlockedUsers()` public service, with per-row Unblock via MOD-009's `unblockUser(userId)` (AC-152). Navigation is managed as a sub-view state within SettingsScreen.

For US-012, the SettingsScreen presents a "Beta Video Privacy" toggle row (`public` / `followers_only`) reflecting the current user's `users.beta_video_privacy` value (AC-156). Changing the toggle calls MOD-001's public service function to update the column (MOD-001 owns the write, AC-157) and reflects the new state immediately. This row is independent from the profile privacy setting (AC-063).

For AC-168, the SettingsScreen presents a Logout button at the very bottom, below all other rows (including the "Beta Video Privacy" toggle, AC-157, and "Blocked Accounts" row, AC-155). The button uses the same styling as the former ProfileScreen logout button (error color, outlined) and the same `signOut()` call and error-handling pattern. This is the relocation target for the Logout control removed from ProfileScreen (AC-167, MOD-001).

**Non-goals for this module:**
- Languages other than English and zh-TW (out of scope for Phase 1; Phase 2+ backlog for other languages).
- Right-to-left layout support (zh-TW and English are both LTR).
- Per-locale date/number formatting beyond what the i18n library provides (not specified as a requirement).

---

## Related User Stories

- **US-012**: Set profile privacy
- **US-016**: Block another user
- **US-017**: Use the app in Traditional Chinese or English
- **US-018**: Use the app in Dark Mode

**US-012 Acceptance Criteria**: AC-063, AC-156, AC-157, AC-158

**US-016 Acceptance Criteria**: AC-082, AC-083, AC-151, AC-152, AC-155

**US-017 Acceptance Criteria**: AC-090, AC-091

**US-018 Acceptance Criteria**: AC-092

---

## Acceptance Criteria Covered

**AC-090**: The system shall detect the device locale on first launch, set the app language to English if the device locale is English, and otherwise fall back to Traditional Chinese (zh-TW).

**AC-091**: The system shall expose a language toggle in Settings between English and zh-TW that takes effect immediately without an app restart.

**AC-092**: The system shall default to the OS Light/Dark appearance and expose a Settings override with three states (System, Light, Dark) that takes effect immediately without an app restart.

**i18n key rename (Rev 41, AC-061)**: Both `locales/en/common.json` and `locales/zh-TW/common.json` shall rename the i18n key `thisYear` to `lastYear`. The label values displayed to the user are unchanged — only the key name changes. This rename affects the profile history stats section's "this year" display label (AC-061, MOD-008). The CI completeness gate (Key Implementation Notes) must continue to pass after the rename; both locale files must be updated atomically.

**AC-155** (new): The Settings screen (SettingsScreen) shall present a "Blocked Accounts" tappable row at the bottom of its existing sections. Tapping the row shall open a Blocked Accounts screen (BlockedAccountsScreen) that lists the users the current user has blocked (rows where `blocker_user_id = auth.uid()`), each entry showing a circular avatar, the user's `display_name`, and an "Unblock" button. Tapping "Unblock" shall call `unblockUser(userId)` (MOD-009, AC-152) and remove that entry from the list. When the current user has blocked no one, the screen shall display an empty state. Navigation to and from the Blocked Accounts screen is managed internally within SettingsScreen as a sub-view state (the same navigator pattern used elsewhere), with no ProfileNavigator view-state change. The blocked-users list is sourced from MOD-009's public service `fetchMyBlockedUsers()`.

**AC-157** (new): The Settings screen (SettingsScreen) shall present a "Beta Video Privacy" toggle row with two states — `public` (default, label "所有人"/"All Users") and `followers_only` (label "僅限追蹤者"/"Followers Only") — reflecting the current user's `beta_video_privacy` value (AC-156). Changing the toggle shall call MOD-001's public service function to update the current user's `beta_video_privacy` column (MOD-001 owns the write) and reflect the new state immediately. This row is independent from the existing profile privacy setting (AC-063), which is edited via the MOD-001 Edit Profile entry point (AC-117), not here.

**AC-168** (new): The SettingsScreen shall present a Logout button at the very bottom, below all other rows (including the "Beta Video Privacy" toggle, AC-157, and the "Blocked Accounts" row, AC-155). The button shall use the same styling as the former ProfileScreen logout button (error color, outlined) and the same `signOut()` call and error-handling pattern. This is the relocation target for the Logout control removed from ProfileScreen (AC-167).

---

## Integration Points

**MOD-009 public services consumed by AC-155**: `fetchMyBlockedUsers()` (queries `blocks JOIN users` where `blocker_user_id = auth.uid()`, returns `Array<{ userId, displayName, avatarUrl }>`) and `unblockUser(userId)` (AC-152) are direct imports from `mod-moderation/moderation-service`. These are read-only and write-only respectively; no write permissions beyond what AC-152 already grants are needed.

**MOD-001 public service consumed by AC-157**: The "Beta Video Privacy" toggle calls MOD-001's public `updateBetaVideoPrivacy(value)` service (or equivalent) to update `users.beta_video_privacy`. MOD-001 owns the write to this column. MOD-010 does not write directly to `users.beta_video_privacy`. This is a direct import of a public service function from `mod-auth-profile/auth-service` (or equivalent) per the Cross-Module Imports convention.

---

## Data Model

No dedicated Supabase tables for this module. Language preference and theme preference may be persisted locally (e.g., via `AsyncStorage` or Expo SecureStore) or on the `User` profile row if persistence across devices is desired. The PRD does not specify cross-device sync of language/theme preference — the minimal approach is local persistence.

The "Beta Video Privacy" toggle (AC-157) reads from and writes to `users.beta_video_privacy` (owned by MOD-001) via MOD-001's public service — no direct table access by MOD-010.

---

## Input / Output Contract

**Inputs (language detection on first launch):**
- Device locale from `expo-localization` (or equivalent)

**Outputs (language detection):**
- Active language set to `en` if device locale is English; `zh-TW` otherwise
- All user-facing strings loaded from the corresponding message catalog

**Inputs (language toggle in Settings):**
- User selection: English or zh-TW

**Outputs (language toggle):**
- Active language updated immediately — no app restart
- All rendered strings switch to the selected catalog

**Inputs (theme detection on launch):**
- OS appearance value from React Native `Appearance` API

**Outputs (theme detection):**
- Active theme follows OS (Light or Dark) by default

**Inputs (theme override in Settings):**
- User selection: System / Light / Dark

**Outputs (theme override):**
- Active theme updated immediately — no app restart
- All theme tokens update across the app

**Inputs (Blocked Accounts screen — AC-155):**
- Authenticated user session (`auth.uid()`)
- `fetchMyBlockedUsers()` from MOD-009 (`mod-moderation/moderation-service`)

**Outputs (Blocked Accounts screen — AC-155):**
- List of blocked users rendered (circular avatar, `display_name`, Unblock button per row)
- Empty state when the current user has blocked no one
- On Unblock tap: calls `unblockUser(userId)` (MOD-009, AC-152) and removes the entry from the list

**Inputs (Beta Video Privacy toggle — AC-157):**
- Authenticated user session
- Current `users.beta_video_privacy` value (read via MOD-001's public service or from the user profile)

**Outputs (Beta Video Privacy toggle — AC-157):**
- On toggle change: calls MOD-001's public service to update `users.beta_video_privacy`; new value reflected immediately in the toggle state

**Inputs (Logout button — AC-168):**
- Authenticated user session
- User tap on Logout button in SettingsScreen

**Outputs (Logout button — AC-168):**
- `signOut()` called; session ended; user returned to signed-out state
- Error handling consistent with the pattern used in the former ProfileScreen logout

---

## Key Implementation Notes

- **Tech stack**: i18n-js or expo-localization + JSON message catalogs. Final library selection confirmed during MOD-010 engineering; the approach must support immediate language switching without restart.
- **i18n hook**: All user-facing strings must use the i18n hook (e.g., `t('key')`). No inline string literals in JSX or component code. This rule applies to every module.
- **CI completeness gate**: A CI check must fail if any English key lacks a zh-TW counterpart (e.g., `i18next-parser --fail-on-warnings` or a custom script). This check must be set up as part of MOD-010 and applied globally.
- **zh-TW fallback rule**: For any non-English device locale (e.g., Japanese, Spanish), the fallback is zh-TW — not English. English is served only when the device locale is explicitly English.
- **Theme tokens**: Every screen in every module must use tokens from the theme provider (e.g., colors defined as `theme.colors.background`, not `'#FFFFFF'`). MOD-010 owns the theme provider and token definitions. All other modules consume tokens.
- **Three-state override (AC-092)**: The Settings override has three states: System (follows OS), Light (forced), Dark (forced). The override takes effect immediately without an app restart.
- **Dark mode + zh-TW combinatorial testing**: QA must verify every screen in 4 combinations (light/dark × en/zh-TW). This should be incorporated into every module's test plan rather than treated as a one-off audit.
- **No hardcoded hex colors**: Any hardcoded `#RRGGBB` or `rgb()` color in component code is a defect. All colors must come from the theme token system.
- **Blocked Accounts screen sub-view state (AC-155)**: SettingsScreen manages a sub-view state (`'settings' | 'blockedAccounts'`); BlockedAccountsScreen is a new file in `mod-localization-theme/screens/`. No ProfileNavigator view-state change is needed. `fetchMyBlockedUsers` and `unblockUser` are direct imports from `mod-moderation/moderation-service`.
- **"Beta Video Privacy" toggle (AC-157)**: The toggle row is labeled "Beta 影片可見度" (or equivalent). Two states: `public` (default, displayed as "所有人"/"All Users") and `followers_only` (displayed as "僅限追蹤者"/"Followers Only"). Reads the current user's `beta_video_privacy` on Settings screen load. Changing the toggle calls MOD-001's public write service (e.g., `updateBetaVideoPrivacy(value)` imported from `mod-auth-profile/auth-service`). MOD-010 does NOT write directly to `users.beta_video_privacy`. This toggle is independent from the profile privacy setting (AC-063).
- **Logout button at the bottom of SettingsScreen (AC-168)**: Add a Logout button at the very bottom of SettingsScreen, below all other rows — below the "Beta Video Privacy" toggle (AC-157) and below the "Blocked Accounts" row (AC-155). Same styling as the former ProfileScreen logout (error color, outlined). Same `signOut()` call and error-handling pattern. This is the relocation target for AC-167 (Logout removed from ProfileScreen).
- **SettingsScreen row order**: The SettingsScreen row order from top to bottom is: (existing sections) → "Blocked Accounts" row (AC-155) → "Beta Video Privacy" toggle row (AC-157) → Logout button (AC-168).

---

## Out of Scope for This Module

- Languages other than English and zh-TW (Phase 1 only; additional locales are Phase 2+ backlog).
- Right-to-left layout support.
- Per-locale number/date formatting beyond what the i18n library provides out of the box.
- Android-specific locale or theme handling (Phase 2).
- Writing directly to `users.beta_video_privacy` — MOD-010 calls MOD-001's public service; MOD-001 owns the column write.
