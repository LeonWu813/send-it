# How: Rename "Send It" → "ProjectDay" (Rev 47, AC-199, AC-200)

**Date:** 2026-10-21  
**Scope:** Everything the code touches when renaming the app from "Send It" to "ProjectDay" — identifiers, strings, schemes, config, and external setup steps.

---

## Overview

The rename is governed by two PRD criteria added in Rev 47:

- **AC-199 (MOD-010)** — user-facing text. No locale string, push notification or email may say "Send It". The app's name becomes "ProjectDay" in both English and zh-TW.
- **AC-200 (MOD-012, cross-cutting)** — identifiers. The Expo name and slug, bundle ID, package name, native project names, code identifiers, comments and docs all become `ProjectDay` or `projectday` (where capitals aren't allowed). Clause (3) is a hard check: a case-insensitive grep for `send it|send-it|send_it|sendit` must return nothing outside `project-planning/`, `README.md` and git history. The climbing verb "send" (`mod-send-logging`, etc.) does not change. Final ownership is pending Tech Lead review.

The rename touches five layers:
1. Expo config
2. The committed native iOS project
3. One runtime value — the OAuth redirect scheme
4. User-facing copy: locales, edge functions, and data already in the database
5. Things outside the code: Supabase dashboard, Google Cloud, App Store Connect, and agent files no module owns

Almost nothing reads the app name at runtime. The one runtime value with real behaviour — the OAuth scheme — is **already broken in release builds today**.

---

## Key Concepts

- **app.json is the source and `ios/` is generated, but committed.** `expo prebuild` generates `ios/` from `app.json`. Because `ios/` is checked in, editing `app.json` alone does not change the native build. Either run `expo prebuild --clean` (regenerates `ios/SendIt*` → `ProjectDay*`) or hand-edit ~55 pbxproj entries plus plist, Podfile, and directory names.
- **Two scheme concepts:**
  - `CFBundleURLSchemes` in Info.plist — today the only entry is `com.sendit.twbouldering`. Expo adds the bundle ID automatically when `app.json` has no `scheme`.
  - The scheme the code passes to `makeRedirectUri` — today that is `'send-it'`, which is **not registered anywhere**.
- **"Project files owner"** — the status.md Module Map names mod-home (MOD-012) as owner of root and project files: `app.json`, `package.json`, `ios/`, `src/lib/`, `src/components/`, `App.tsx`.
- **Applied migrations can't be edited.** Seeded rows already in the database only change through a new migration.

---

## How It Works

### 1. Build identity (MOD-012)

`app.json` holds: `name` "Send It", `slug` "send-it-tw-bouldering-app", `ios.bundleIdentifier` "com.sendit.twbouldering", `extra.eas.projectId` "send-it-tw-bouldering-app", and the expo-image-picker `photosPermission` text "Allow Send It…". **There is no `scheme` key.**

`expo prebuild` carries these into:
- `ios/SendIt/Info.plist`: `CFBundleDisplayName`, `CFBundleURLSchemes`, `NSPhotoLibraryUsageDescription`
- `ios/SendIt.xcodeproj/project.pbxproj`: `PRODUCT_BUNDLE_IDENTIFIER`, `PRODUCT_NAME = SendIt` (Debug + Release), ~55 matches
- `ios/SendIt.xcscheme`, workspace data, `Podfile` (`target 'SendIt'`), `Podfile.properties.json` (`mainTarget`)
- Files and directories: `SendIt-Bridging-Header.h`, `SendIt.entitlements`, `ios/SendIt/`

A new bundle ID means a new App Store Connect app record. Leon has accepted this.

Note: `extra.eas.projectId` holds a slug-like string, not an EAS UUID. Until the project is really linked to EAS it is cosmetic, but after linking it must be the real UUID.

### 2. Google OAuth — the scheme bug (MOD-001)

`signInWithGoogle()` in `auth-service.ts`:
1. Builds PKCE nonce
2. `makeRedirectUri({ scheme: 'send-it' })` at line 142 → produces `send-it://`
3. `supabase.auth.signInWithOAuth({ redirectTo })` → gets Google authorize URL
4. `WebBrowser.openAuthSessionAsync(url, redirectUri)` → opens ASWebAuthenticationSession
5. Google → Supabase `/auth/v1/callback` → Supabase redirects to `redirectTo` (only if on dashboard's Redirect URLs allow-list)
6. ASWebAuthenticationSession catches redirect by scheme match (does NOT need scheme in Info.plist)
7. Lines 177–196: merge fragment + query params (INT-021 fix), call `setSession`

**The scheme bug exists today.** `expo-linking/build/Schemes.js` `resolveScheme` reads `Constants.expoConfig.scheme`. If that is empty in a non-`__DEV__` build, it throws: `"Cannot make a deep link into a standalone app with no custom scheme defined"`. In dev it only warns. **Google sign-in throws in production today, before any rename.**

The rename fixes it if three things change together:
- `app.json`: add `"scheme": "projectday"` (MOD-012)
- `auth-service.ts:142`: change `'send-it'` → `'projectday'` (MOD-001)
- `auth-service.test.ts:46`: mock → `'projectday://auth'` (MOD-001)

These three must land together or dev builds keep warning and release builds keep throwing.

### 3. Apple sign-in (MOD-001)

`signInWithApple` (lines 78–120) is fully native: `AppleAuthentication.signInAsync` + `signInWithIdToken`. No scheme or redirect involved. It doesn't work today anyway — `app.plugin.js` strips the `com.apple.developer.applesignin` entitlement. The rename couples to it via the Supabase Apple provider's Client IDs (which hold the bundle ID).

### 4. User-facing copy

| Location | String | Owner |
|---|---|---|
| `locales/en/common.json:3` | `app.name: "Send It"` → "ProjectDay" | MOD-010 |
| `locales/zh-TW/common.json:3` | same | MOD-010 |
| `supabase/functions/notify-beta-video-like/index.ts:185` | push `title: 'Send It'` | MOD-007 |
| `supabase/functions/report-digest/index.ts:114` | email header "Send It — Open Report Digest" | MOD-009 |
| `supabase/migrations/20260920000002_mod_002_gym_directory.sql:246,306` | seeded gym note "…represented in Send It…" — **new UPDATE migration required** | MOD-002 |
| `app.json` photosPermission | "Allow Send It to access your photos…" | MOD-012 |
| `ios/SendIt/Info.plist` NSPhotoLibraryUsageDescription | same | MOD-012 |

`app.name` is consumed by `SignInScreen.tsx:136` and `SignUpScreen.tsx:87` via `t('app.name')` only.

### 5. Internal identifiers and comments the grep catches

| File | Hit | Owner |
|---|---|---|
| `src/lib/theme.ts:2,18` | comments (one references external `send-it-design` repo path) | MOD-012 |
| `src/components/ui/Stepper.tsx:38` | `ACCESSORY_ID = 'send-it-stepper-done'` (internal iOS nativeID) | MOD-012 |
| `src/components/ui/ListRow.tsx:21` | comment | MOD-012 |
| `src/components/ui/stories/AppText.stories.tsx:12` | sample text | MOD-012 |
| `src/components/ui/stories/ListRow.stories.tsx:73` | comment | MOD-012 |
| `src/modules/mod-home/components/__tests__/AppHeader.test.tsx:11` | stale doc comment claiming header renders "Send It" — it renders `title` prop | MOD-012 |
| `package.json`, `package-lock.json` | name "send-it" | MOD-012 |
| `.env.example:2`, `.gitignore:2` | header comments | MOD-012 |
| `.storybook/MIGRATION.md:3,16` | external `send-it-design` repo paths | MOD-012 |
| `src/modules/mod-localization-theme/stories/Tokens.stories.tsx:87` | Storybook sample | MOD-010 |

---

## Where Things Live

| Change | File(s) | Owner |
|---|---|---|
| Expo name, slug, bundle ID, projectId, photo permission; **add `scheme: "projectday"`** | `app.json` | MOD-012 |
| Package name | `package.json`, `package-lock.json` | MOD-012 |
| Native target, product name, bundle ID, display name, URL scheme, permission; dir/file renames | `ios/SendIt/**`, `ios/SendIt.xcodeproj`, `.xcworkspace`, `Podfile`, `Podfile.properties.json` | MOD-012 (prefer `expo prebuild --clean`) |
| Shared UI, theme, stories, root comments | `src/lib/theme.ts`, `src/components/ui/*`, `.env.example`, `.gitignore`, `.storybook/MIGRATION.md`, `AppHeader.test.tsx` | MOD-012 |
| OAuth redirect scheme + test mock | `auth-service.ts:142`, `__tests__/auth-service.test.ts:46` | MOD-001 |
| `app.name` locale strings + Storybook sample | `locales/en/common.json`, `locales/zh-TW/common.json`, `Tokens.stories.tsx` | MOD-010 |
| Push notification title | `supabase/functions/notify-beta-video-like/index.ts:185` | MOD-007 |
| Email digest header | `supabase/functions/report-digest/index.ts:114` | MOD-009 |
| Seeded gym notes — new UPDATE migration + test string | new `*_mod_002_*` migration; `GymDetailScreen.test.tsx:77,118` | MOD-002 |
| Supabase Redirect URLs (`projectday://**`), Apple Client ID, Google consent screen, App Store Connect record | dashboards | Human (Leon) |
| `.claude/agents/*.md` (29 files), root `PRD_TW_Bouldering_App.md`, `scratchpad/*.py` | no module owner | Tech Lead must allocate or carve out |

---

## Gotchas

1. **The OAuth scheme bug exists today, independent of the rename.** Releases throw at `makeRedirectUri` because `app.json` has no `scheme`. The rename is the natural moment to fix it. The `app.json` scheme, `auth-service.ts` literal, and Supabase allow-list must all change together — if any one is missing, Google sign-in silently falls back to the Site URL.

2. **Editing `app.json` alone does nothing to the committed `ios/` project.** Hand-editing ~55 pbxproj entries is error-prone. `expo prebuild --clean` is cleaner but overwrites anything hand-made in `ios/`. Diff afterwards. A new bundle ID also invalidates existing simulator installs, keychain, SecureStore data (users get signed out), and push/signing setup.

3. **The applied seed migration cannot be edited.** Changing `20260920000002_…sql` only affects future `db reset` runs. Live gym rows need a new UPDATE migration. The test asserting the old string must change with it.

4. **AC-200(3) cannot reach zero through module ownership alone.** Unowned hits:
   - 29 `.claude/agents/*.md` files — Doc-Sync generates them, must not be hand-edited. Some hits are the project root path `/send-it`; some are the verb phrase "send it back".
   - Design-team agents reference the external `send-it-design` repo.
   - Root `PRD_TW_Bouldering_App.md` (stale duplicate PRD).
   - `scratchpad/*.py` (tracked scratch files with absolute paths).
   - Renaming the repo folder itself (`/send-it`) affects absolute paths in these files and in the memory system at `~/.claude/projects/-Users-tsan-Desktop-MacBookPro-send-it/`.
   Tech Lead must allocate these or add an explicit carve-out to AC-200(3).

5. **Two `theme.ts` comment lines reference an external `send-it-design` repo.** Renaming the comment text without renaming (or noting) that external repo leaves broken references.

6. **Unrelated defect found:** `signInWithApple` passes `credential.authorizationCode` as the `nonce` argument (around line 114). Semantically wrong. Separate from the rename; should be surfaced to Tech Lead.
