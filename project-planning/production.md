# Send It — Production Reference

**Project**: Send It (Taiwan-first indoor bouldering app)
**Phase**: 1 — iOS MVP, Taipei + New Taipei launch
**Last synced from PRD**: rev 7 (2026-09-24)

---

## Project Overview

Send It is a Taiwan-first mobile app for indoor bouldering climbers. It gives climbers a fast way to log sends (route + grade + attempts + status), share and watch beta videos (short technique clips) tied to specific routes, browse what's currently set at the gyms they follow, and connect with other climbers in the local scene. The app is organized around a persistent three-tab bottom navigation shell — Home, Gyms, and Profile — with the Home tab as the landing screen after login. Rather than a single fixed home gym, each climber maintains a multi-gym saved list: they bookmark any gyms they care about and see them, alongside the climbers they follow, on the Home screen.

Send It's wedge is a lightweight, Taiwan-first version of Kaya's core loop — log, watch beta, see history — built on an admin-curated gym directory (so the app has real coverage on day one) plus a filter-first route submission flow with server-enforced duplicate protection that keeps user-submitted data clean without waiting on official gym partnerships.

---

## Tech Stack

| Component        | Name + Version                                         | Notes                                                                                                                                       |
|------------------|--------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------|
| Language         | TypeScript 5.x                                         | Shared across app and Supabase Edge Functions.                                                                                              |
| App framework    | React Native (Expo SDK 51+)                            | iOS-only build configuration for Phase 1. Android in Phase 2.                                                                               |
| Backend (BaaS)   | Supabase (Postgres 15+, Auth, Storage, Edge Functions) | Postgres with Row-Level Security. Auth: Email + Apple Sign-In + Google Sign-In. Storage for photos and Phase 1 video.                       |
| Video hosting    | Supabase Storage (Phase 1) → Cloudflare Stream (migrate) | Migration trigger: monthly cost > US$25 OR total video storage > 20 GB, whichever comes first.                                              |
| Push             | Apple Push Notification service (APNs) via Expo Push   | Device token table + Supabase Edge Function trigger for beta-video-like events only in Phase 1.                                             |
| Analytics        | PostHog (free tier)                                    | Product analytics + retention cohorts.                                                                                                      |
| Admin tooling    | Supabase Studio                                        | Sole admin surface for Phase 1. No in-app admin UI.                                                                                         |
| Localization     | i18n-js or expo-localization + JSON message catalogs   | Languages: English + Traditional Chinese (zh-TW). Default: device locale; fallback: zh-TW.                                                  |
| Theming          | React Native appearance API + Expo theming             | Light + Dark mode. Follows OS preference by default; manual override in Settings.                                                           |

---

## Architecture Overview

Send It is a mobile client (React Native / Expo, iOS-only for Phase 1) talking directly to Supabase for auth, data, storage, and serverless functions. There is no bespoke backend server in Phase 1.

- The **client** owns rendering, local UI state, client-side video compression, client-generated thumbnails, and localization. It authenticates via Supabase Auth (Email / Apple / Google) and stores the session locally.
- The client's top-level UI is a **persistent three-tab bottom navigation shell**. **Tab 1 (Home)** hosts the Home surface (MOD-012). **Tab 2 (Gyms)** hosts the existing gym navigation stack (MOD-002 gym directory + detail, with MOD-003 route catalog reachable beneath it). **Tab 3 (Profile)** hosts the current user's profile surface (MOD-001) with their embedded send history and stats (MOD-008). The Home tab is the default tab after login. The tab shell (`AppShell`) lives in `src/modules/mod-home/` (MOD-012 owns it). Tab state is a local `useState<TabKey>` in `AppShell`. All tab subtrees are kept alive using `display: 'none'` (never conditional unmount). Session is threaded to each tab navigator as a prop; `useSession` remains the singleton for reactive session changes.
- **Supabase Postgres** is the system of record. All tables are protected by Row-Level Security (RLS) policies. Read/write access is scoped per-user for logs, follows, reactions, reports, blocks, and notification preferences; gyms are readable by all authenticated users and writable only by admins; routes are readable by all authenticated users for `active` rows, with `pending` rows visible only to their submitter, and are writable by the submitting user on insert (initial status `active` when auto-approve is ON, else `pending`), while status transitions to `retired` or `rejected` and approval of `pending` routes are admin-only via Supabase Studio.
- **Supabase Storage** hosts avatars, gym photos, route photos, and (Phase 1 only) beta videos + client-generated thumbnails. When the migration trigger fires, video uploads cut over to Cloudflare Stream while metadata continues to live in Postgres.
- **Supabase Edge Functions** handle event-driven workflows that must not run on the client: on `Reaction` insert with `target_type = beta_video`, an Edge Function inserts a `Notification` row and enqueues an APNs push (respecting `NotificationPreference`) via Expo Push to all `DeviceToken` rows for the recipient.
- **PostHog** SDK ships client-side events (signup, first send, video upload, retention markers). No PII beyond user_id is sent.
- **Admin operations** (adding gyms, reviewing gym requests, reviewing reports, banning users, merging near-duplicate routes, approving/rejecting pending routes, and retiring routes) are performed exclusively through Supabase Studio in Phase 1. In-app admin UI for route status management is planned for Phase 1.5.

**Key data flows:**

1. **Log a send**: client → Supabase Auth (session) → Postgres insert into `Ascent` (RLS-checked) → PostHog event. Grade is read from `Route.grade` at display time, never stored per-log.
2. **Upload beta video → notify**: client compresses video and generates thumbnail → upload to Supabase Storage (Phase 1) → insert `BetaVideo` row → other user views + likes → insert `Reaction` row → Edge Function fires → insert `Notification` row + APNs push to recipient's device tokens (if enabled in `NotificationPreference`).

---

## Module Index

| MOD-ID  | Directory              | Module Name                  | One-line description                                                                                      |
|---------|------------------------|------------------------------|-----------------------------------------------------------------------------------------------------------|
| MOD-001 | mod-auth-profile       | Auth & Profile               | Signup, sign-in (Email/Apple/Google), session management, profile CRUD (name/avatar/bio/privacy), Profile tab surface with send history and Logout. |
| MOD-002 | mod-gym-directory      | Gym Directory                | Admin-curated gym directory, gym detail pages, search/filter, "request a gym" form, and saved-gym bookmark toggle (add/remove from saved_gyms). |
| MOD-003 | mod-route-catalog      | Route Catalog                | Route submission with match-before-create, 4-value status lifecycle, submitter-only pending visibility, admin approve/reject/retire via Studio. |
| MOD-004 | mod-send-logging       | Send Logging                 | Send log creation enforcing grade inheritance from route; no per-user grade override.                     |
| MOD-005 | mod-beta-video         | Beta Video                   | Video capture/selection, client-side compression, thumbnail, storage upload, inline playback.             |
| MOD-006 | mod-social-feed        | Social Graph & Feed          | Follow/unfollow, chronological activity feed via SECURITY INVOKER RPC, beta-video like reactions.        |
| MOD-007 | mod-notifications      | Notifications                | Device token registration, notification preferences, Edge Function push fan-out, in-app inbox.            |
| MOD-008 | mod-profile-history    | Profile History & Stats      | Send history with filters, stats bar chart, streak, highest grade — for self and (per privacy) others.    |
| MOD-009 | mod-moderation         | Moderation (Report & Block)  | Report submission, symmetric block/unblock, feed filtering, scheduled report-digest Edge Function.        |
| MOD-010 | mod-localization-theme | Localization & Theming       | i18n catalog loading, device-locale detection, zh-TW fallback, language toggle, Light/Dark theming.       |
| MOD-011 | mod-analytics          | Analytics                    | PostHog event instrumentation across the app (cross-cutting; no user-facing UI).                          |
| MOD-012 | mod-home               | Home                         | Persistent three-tab bottom navigation shell (AppShell) and Home screen (banners, saved-gyms strip, following-climbers strip). |

---

## Shared Conventions

### Directory Layout

```
src/
  lib/                         # Cross-cutting singletons and providers
    supabase.ts                # Supabase client singleton — only place createClient() is called
    theme.ts                   # Theme provider / tokens
    i18n.ts                    # i18n initialization
    banners.ts                 # Static banner definitions (structure/keys/image refs; strings in i18n catalogs)
  modules/
    mod-auth-profile/
    mod-gym-directory/
    mod-route-catalog/
    mod-send-logging/
    mod-beta-video/
    mod-social-feed/
    mod-notifications/
    mod-profile-history/
    mod-moderation/
    mod-localization-theme/
    mod-analytics/
    mod-home/
      AppShell.tsx             # Persistent three-tab shell (MOD-012 owns)
      HomeNavigator.tsx        # Tab 1 content navigator
      screens/HomeScreen.tsx
      components/TabBar.tsx
supabase/
  migrations/                  # All schema changes as Supabase CLI migrations
  functions/                   # Edge Functions
```

Module directory names match the Module Map in `project-planning/status.md` exactly.

### Supabase Client Singleton

One singleton exported from `src/lib/supabase.ts`. Never construct `createClient()` at call sites. Never import the `service_role` key in client code. The service-role key lives in `supabase secrets` as `SERVICE_ROLE_KEY` and is only read inside Edge Functions.

### RLS-First Data Access

The client never sends `service_role`-authenticated requests. Every table has RLS enabled from the migration that creates it. Feed and other multi-table reads that must compose Follow, Block, and privacy filters are exposed via Postgres RPC (`SECURITY INVOKER`), not raw table selects.

### Migration Conventions

All schema changes ship as Supabase CLI migrations in `supabase/migrations/`. Never edit tables via Studio in production without a corresponding migration file.

### Environment Variable Rules

Only vars prefixed `EXPO_PUBLIC_` are safe to inline into the client bundle. Any secret (service-role key, Expo access token) lives in `supabase secrets` and is only read inside Edge Functions.

**Critical naming rule**: Edge Functions must read the service-role key from the secret named `SERVICE_ROLE_KEY`, **not** `SUPABASE_SERVICE_ROLE_KEY`. Supabase reserves the `SUPABASE_` prefix for its own injected variables; using the reserved prefix will cause the secret not to be found.

### Video Pipeline Conventions

All client-side video compression outputs **H.264 (baseline profile) + AAC audio in an MP4 container**. Any upload whose muxed output does not conform to H.264/AAC/MP4 must be rejected on ingest with a clear error surfaced to the user (AC-035). The recommended client-side compression library is `ffmpeg-kit-react-native` (H.264 output guaranteed); the final library choice is confirmed in the MOD-005 spec. Thumbnails are generated client-side before upload and uploaded alongside the video artifact.

### match_key Implementation

`Route.match_key` is a Postgres `GENERATED ALWAYS AS (gym_id || grade || color_tag) STORED` column. Uniqueness of active routes is enforced at the database level by a **partial unique index** `UNIQUE (gym_id, grade, color_tag) WHERE status = 'active'`. The partial predicate correctly allows historical retired routes to reuse the same key after a wall reset without colliding.

### Notification Pattern

Any push-triggering event is fired by a **Postgres trigger → Edge Function** sequence, never by the client. The Edge Function fan-out must be idempotent; a unique constraint on `Notification(recipient_user_id, actor_user_id, type, target_id)` prevents duplicate notification rows from double-trigger fires. The Edge Function reads `SERVICE_ROLE_KEY` (not `SUPABASE_SERVICE_ROLE_KEY`).

### i18n Rules

All user-facing strings are pulled through the i18n hook — no inline string literals in components. Message catalogs must be complete (no missing keys) at ship. A CI check fails if any English key lacks a zh-TW counterpart. Default language: device locale, with zh-TW fallback for any non-English locale. Settings screen exposes a language toggle.

### Theming Rules

Every screen uses tokens from the theme provider; no hardcoded hex colors in components. Light and Dark mode follow OS appearance by default; Settings exposes a three-state override (System / Light / Dark) that takes effect immediately without an app restart.

### Screen Layout & Safe Area Insets

Every screen must respect iOS safe area insets so top-bar content clears the Dynamic Island / notch. A fixed `paddingTop` token is not sufficient — the Dynamic Island clearance (~59px) exceeds `theme.spacing.xl` (32px), leaving content hidden underneath.

Rules:

1. **Root provider (one-time)**: `App.tsx` wraps the app root in `SafeAreaProvider` from `react-native-safe-area-context` (already available as a transitive dependency of `react-native-screens`). `SafeAreaProvider` wraps `ThemeProvider`.
2. **Per-screen insets**: every screen calls `useSafeAreaInsets()` and passes `insets.top` into `makeStyles`:
   ```typescript
   const { theme } = useTheme();
   const insets = useSafeAreaInsets();
   const styles = makeStyles(theme, insets.top);
   ```
3. **`makeStyles` signature**: `makeStyles` must accept `topInset: number` as its second parameter:
   ```typescript
   function makeStyles(theme: ReturnType<typeof useTheme>['theme'], topInset: number) { ... }
   ```
4. **`paddingTop` derivation**: the root (and any `ScrollView` `contentContainerStyle`) uses `paddingTop: topInset + theme.spacing.md` — the device safe-area top plus a breathing-room token. When a `ScrollView` `contentContainerStyle` currently uses a `padding` shorthand, expand it to explicit `paddingTop: topInset + theme.spacing.md`, `paddingHorizontal`, and `paddingBottom`.
5. **Never** use a fixed spacing token alone (e.g. `paddingTop: theme.spacing.xl`) as the `paddingTop` of a screen root or scroll content container.

Notes:
- Modal sheets (`presentationStyle="pageSheet"`) are positioned below the Dynamic Island by iOS automatically, so `insets.top` is `0` inside them. The pattern is therefore safe to apply uniformly to every screen, including modal sheets.
- iOS-only project — no Android status-bar handling is required.

### Enum Migration Ordering

When adding values to a Postgres enum, always use two separate migration files (separate timestamps). File 1: `ALTER TYPE ... ADD VALUE IF NOT EXISTS`. File 2 (new timestamp): everything that uses the new values. Never add and use an enum value in the same transaction on PG15/Supabase. The canary error for a violation is `ERROR: unsafe use of new value "<value>" of enum type`.

### Admin Identity

All admin-gated RLS policies use `public.is_admin()` (a STABLE helper that checks `COALESCE((auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin'`). Do not inline the JWT check in policies directly. The helper is shipped even when no admin exists (returns false for all Phase 1 clients); Phase 1.5 grants the `app_metadata.role = 'admin'` claim to the admin user (set only by service_role) with zero policy migration needed.

### SECURITY DEFINER RPCs

Use `SECURITY DEFINER` functions for any server-side enforcement that the client must not bypass (auto-approve toggle, status gating). Always set `SET search_path = public` to prevent search-path injection. Never accept `user_id` as a parameter — always derive from `auth.uid()`. Grant EXECUTE to `authenticated` only; revoke from `anon` and `public`.

### app_settings Table Pattern

For admin-controlled feature toggles read server-side, use a single `public.app_settings (key TEXT PRIMARY KEY, value TEXT)` table with NO client-facing grants or RLS policies. RLS is enabled with no policies so authenticated and anon users receive zero rows. Read only inside DEFINER functions. Do not expose the table to authenticated users. Admin manages values via Supabase Studio (service_role bypasses RLS).

### App Shell & Tab Navigation

The persistent tab shell lives in the module that owns it (MOD-012, `src/modules/mod-home/`), not a separate top-level directory. Tab state is a local `useState<TabKey>` in the shell component (`AppShell.tsx`), defaulting to `'home'` (AC-110: Home tab is the default after login). This follows the state-machine-per-navigator convention already used by `GymNavigator`, `RouteNavigator`, and `AuthNavigator`.

Tabs use a **keep-alive mount strategy**: all three tab subtrees are rendered simultaneously and toggled with `display: activeTab === key ? 'flex' : 'none'`. Do NOT use conditional unmount (component state is lost) and do NOT use `flex: 0` (still lays out, leaks touch targets). Keep-alive preserves each tab's internal navigation stack and scroll position across tab switches. Session is threaded to tab navigators as a prop; `useSession` remains the singleton for reactive session changes.

### Bottom Safe Area for Pinned Bottom Bars

Any UI element pinned to the bottom of the screen (tab bar, sticky footer) must call `useSafeAreaInsets()` and apply `paddingBottom: insets.bottom` (plus a spacing token for the icon row) to its container so touch targets clear the home indicator. Screens hosted inside a tab whose content scrolls to the bottom should add the tab-bar height plus `insets.bottom` to their scroll `contentContainerStyle` `paddingBottom` so the last row is not hidden behind the bar. This complements the existing top-inset `makeStyles(theme, topInset)` convention.

### Cross-Module Imports

A module may import another module's **public service functions** (data layer) and **navigator entry-point components** (mounting) only — never its internal `screens/` or `components/` subdirectories directly. Aggregator modules (MOD-012) compose other modules exclusively through these two public surfaces.

When two modules must touch the same table, split access by verb and enforce with the shared RLS fence (e.g., MOD-012 reads `saved_gyms` via SELECT, MOD-002 writes `saved_gyms` via INSERT/DELETE). Document the shared-table access in both specs so it is not mistaken for a boundary violation.

### Shared Non-Module Constants

Cross-cutting static data that belongs to no single module (e.g., hardcoded banner definitions) lives in `src/lib/` alongside `theme.ts` and `i18n.ts`. These files hold structure, keys, and image refs only; all user-facing strings stay in the i18n locale catalogs and are never inlined into constant files.

### TypeScript Strict Mode

Strict mode is on for all TypeScript code, including Edge Functions. No `any` without a `// TODO(leon): why` comment.

### Testing Conventions

Jest + React Native Testing Library. One test file per source file. Test behaviour, not implementation.

### Commit Conventions

Follow `~/.claude/skills/coding-conventions/SKILL.md` — conventional commits for code, agent-role prefixed for handoffs.

---

## Build / Lint / Test Commands

| Step  | Command                                      |
|-------|----------------------------------------------|
| Build | `eas build --profile production --platform ios` |
| Lint  | `npm run lint`                               |
| Test  | `npm test`                                   |

---

## Cross-Cutting NFRs

- **Platform**: iOS 16+ (Phase 1). Android is Phase 2.
- **Performance**: App cold start ≤3 seconds on iPhone 12 or newer. Feed initial render ≤2 seconds on a normal 4G/LTE connection with a warm cache.
- **Security**: All Storage buckets have RLS policies aligned with corresponding table policies. All Edge Functions validate the JWT and re-check authorization against Postgres. The service-role key is never inlined into the client bundle.
- **Offline tolerance**: Phase 1 does not queue sends offline. On any network failure, the user sees a clear error message and can retry.
- **Analytics**: PostHog free tier. No PII beyond `user_id` sent to PostHog.
- **Admin tooling**: Supabase Studio only for Phase 1. No in-app admin UI.
- **Video migration trigger**: When monthly video cost exceeds US$25 OR total video storage exceeds 20 GB (whichever comes first), video uploads cut over to Cloudflare Stream. A migration runbook should be drafted before Phase 1 GA.
- **Apple Sign-In**: Required by the App Store because Google Sign-In is offered. Apple Sign-In must be visually equivalent to Google Sign-In (not smaller or hidden) per App Store review guidelines.
