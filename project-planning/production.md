# Send It — Production Reference

**Project**: Send It (Taiwan-first indoor bouldering app)
**Phase**: 1 — iOS MVP, Taipei + New Taipei launch
**Last synced from PRD**: rev 24 (2026-10-02)
**Last Updated**: 2026-10-04

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
| Video hosting    | Supabase Storage (Phase 1) → AWS S3 + CloudFront + MediaConvert (Phase 2 migrate) | Phase 1 stores original native files as-is in Supabase Storage (no transcoding). Phase 2 migrates video ingest + delivery to AWS (S3 storage, MediaConvert HDR→SDR + H.264 transcode, CloudFront CDN); Supabase keeps Postgres, Auth, RLS, PostgREST, and all non-video storage. This supersedes the previously documented Cloudflare Stream target (PM-logged override, Rev 24). Migration watch trigger: beta-video storage reaches 800 MB of the 1 GB free tier (AC-170). |
| Push             | Apple Push Notification service (APNs) via Expo Push   | Device token table + Supabase Edge Function trigger for beta-video-like events only in Phase 1.                                             |
| Analytics        | PostHog (free tier)                                    | Product analytics + retention cohorts.                                                                                                      |
| Admin tooling    | Supabase Studio                                        | Sole admin surface for Phase 1. No in-app admin UI.                                                                                         |
| Localization     | i18n-js or expo-localization + JSON message catalogs   | Languages: English + Traditional Chinese (zh-TW). Default: device locale; fallback: zh-TW.                                                  |
| Theming          | React Native appearance API + Expo theming             | Light + Dark mode. Follows OS preference by default; manual override in Settings.                                                           |

---

## Architecture Overview

Send It is a mobile client (React Native / Expo, iOS-only for Phase 1) talking directly to Supabase for auth, data, storage, and serverless functions. There is no bespoke backend server in Phase 1.

- The **client** owns rendering, local UI state, client-generated thumbnails, and localization. In Phase 1 the client performs **no** video compression — it uploads the original native video file as-is after an upfront size gate (≥ 45 MB is rejected; see §8 AC-031/AC-169). It authenticates via Supabase Auth (Email / Apple / Google) and stores the session locally.
- The client's top-level UI is a **persistent three-tab bottom navigation shell**. **Tab 1 (Home)** hosts the Home surface (MOD-012). **Tab 2 (Gyms)** hosts the existing gym navigation stack (MOD-002 gym directory + detail, with MOD-003 route catalog reachable beneath it). **Tab 3 (Profile)** hosts the current user's profile surface (MOD-001) with their embedded send history and stats (MOD-008). The Home tab is the default tab after login. The tab shell (`AppShell`) lives in `src/modules/mod-home/` (MOD-012 owns it). Tab state is a local `useState<TabKey>` in `AppShell`. All tab subtrees are kept alive using `display: 'none'` (never conditional unmount). Session is threaded to each tab navigator as a prop; `useSession` remains the singleton for reactive session changes.
- **Supabase Postgres** is the system of record. All tables are protected by Row-Level Security (RLS) policies. Read/write access is scoped per-user for logs, follows, reactions, reports, blocks, and notification preferences; gyms are readable by all authenticated users and writable only by admins; routes are readable by all authenticated users for `active` rows, with `pending` rows visible only to their submitter, and are writable by the submitting user on insert (initial status `active` when auto-approve is ON, else `pending`), while status transitions to `retired` or `rejected` and approval of `pending` routes are admin-only via Supabase Studio.
- **Supabase Storage** hosts avatars, gym photos, route photos, and (Phase 1 only) beta videos + client-generated thumbnails. When the Phase 2 migration is executed, beta-video ingest and delivery cut over to **AWS S3 + CloudFront + MediaConvert** (superseding the previously documented Cloudflare Stream target, Rev 24) while all metadata — including `beta_videos.video_url`, now a CloudFront URL — continues to live in Postgres on Supabase.
- **Supabase Edge Functions** handle event-driven workflows that must not run on the client: on `Reaction` insert with `target_type = beta_video`, an Edge Function inserts a `Notification` row and enqueues an APNs push (respecting `NotificationPreference`) via Expo Push to all `DeviceToken` rows for the recipient.
- **PostHog** SDK ships client-side events (signup, first send, video upload, retention markers). No PII beyond user_id is sent.
- **Admin operations** (adding gyms, reviewing gym requests, reviewing reports, banning users, merging near-duplicate routes, approving/rejecting pending routes, and retiring routes) are performed exclusively through Supabase Studio in Phase 1. In-app admin UI for route status management is planned for Phase 1.5.

**Key data flows:**

1. **Log a send**: client → Supabase Auth (session) → Postgres insert into `Ascent` (RLS-checked) → PostHog event. Grade is read from `Route.grade` at display time, never stored per-log.
2. **Upload beta video → notify**: client generates thumbnail and (Phase 1) uploads the original native video file as-is to Supabase Storage after the upfront 45 MB size gate → insert `BetaVideo` row → other user views + likes → insert `Reaction` row → Edge Function fires → insert `Notification` row + APNs push to recipient's device tokens (if enabled in `NotificationPreference`).

---

## Module Index

| MOD-ID  | Directory              | Module Name                  | One-line description                                                                                      |
|---------|------------------------|------------------------------|-----------------------------------------------------------------------------------------------------------|
| MOD-001 | mod-auth-profile       | Auth & Profile               | Signup, sign-in (Email/Apple/Google), session management, profile CRUD (name/avatar/bio/privacy), Profile tab surface with send history and Logout. |
| MOD-002 | mod-gym-directory      | Gym Directory                | Admin-curated gym directory, gym detail pages, search/filter, "request a gym" form, and saved-gym bookmark toggle (add/remove from saved_gyms). |
| MOD-003 | mod-route-catalog      | Route Catalog                | Route submission with match-before-create, 4-value status lifecycle, submitter-only pending visibility, admin approve/reject/retire via Studio. |
| MOD-004 | mod-send-logging       | Send Logging                 | Send log creation enforcing grade inheritance from route; no per-user grade override; ascent style restricted to {flash, top, attempt}.     |
| MOD-005 | mod-beta-video         | Beta Video                   | Video capture/selection (≤60 sec, 45 MB native-file size gate, no client-side compression), thumbnail, storage upload, inline playback, reel viewer, report flow.             |
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


### Log Raw Supabase Error Before Throwing a User-Facing String

Any Supabase data-access function (service files, RPC wrappers, storage helpers) that catches a Supabase `error` and throws a user-facing `Error` MUST first call `console.error('[functionName] error:', error)` so the raw Supabase/PostgREST diagnostic is visible in device/Metro logs. The user-facing string stays generic; the raw error goes to the console, never to the user. Canonical form:

```ts
if (error) {
  console.error('[fetchBetaVideosByUser] error:', error);
  throw new Error('Failed to load beta videos. Please try again.');
}
```

Applies to every module's service files. Reference implementations: `mod-beta-video/beta-video-service.ts` `uploadBetaVideo` (storage-error, insert-error, and outer-catch sites) and `fetchBetaVideosByUser`. Known existing gap to sweep when this lands: `fetchBetaVideosForRoute` in the same file throws without logging first (follow-up for the owning Engineer, plus a grep for other `throw new Error` sites inside Supabase service functions project-wide).

### Migration Conventions

All schema changes ship as Supabase CLI migrations in `supabase/migrations/`. Never edit tables via Studio in production without a corresponding migration file.

### Environment Variable Rules

Only vars prefixed `EXPO_PUBLIC_` are safe to inline into the client bundle. Any secret (service-role key, Expo access token) lives in `supabase secrets` and is only read inside Edge Functions.

**Critical naming rule**: Edge Functions must read the service-role key from the secret named `SERVICE_ROLE_KEY`, **not** `SUPABASE_SERVICE_ROLE_KEY`. Supabase reserves the `SUPABASE_` prefix for its own injected variables; using the reserved prefix will cause the secret not to be found.

### Video Pipeline Conventions

Accepted upload containers are **MP4 (`.mp4`) and QuickTime (`.mov`)**. Rejection on ingest is codec-based: uploads whose video codec is not H.264 or HEVC, or whose audio codec is not AAC, must be rejected with a clear error surfaced to the user (AC-035). Both `.mp4` and `.mov` files are stored as-is — no server-side transcoding. **Phase 1 performs no client-side compression**: the original native video file is uploaded as-is after an upfront size gate (AC-031, Rev 24). `react-native-compressor` is removed from the project. Thumbnails are generated client-side before upload and uploaded alongside the video artifact.

**Upfront native-file size gate (AC-169, Rev 24)**: before any upload is attempted — after format validation (AC-035) and the duration check (AC-030) — the client reads the native video file's size. If the native file size is 45 MB or greater, or the size cannot be read, the upload is rejected with the bilingual error "影片檔案過大，請壓縮至 45MB 以下 / Video is too large, please keep it under 45 MB". The check fails closed: an unreadable size is treated as oversized and the upload is rejected. The 45 MB threshold sits below the 50 MB Supabase Storage free-tier bucket ceiling to leave a safe margin.

**Storage watch threshold (AC-170)**: when beta-video storage usage in the Supabase `beta-videos` bucket reaches 800 MB — 80% of the 1 GB free-tier total shared across all Supabase Storage buckets — the operator must begin evaluating the Phase 2 video infrastructure migration. This threshold does not block uploads.

**Phase 2 video migration target**: AWS S3 (ingest/storage) + AWS MediaConvert (HDR→SDR tone-map + H.264 transcode) + AWS CloudFront (CDN delivery), superseding the previously documented Cloudflare Stream target (PM-logged override, Rev 24). Supabase remains the system of record for all Postgres data, Auth, RLS, PostgREST, and non-video storage; only beta-video ingest and delivery move to AWS. The project consequently runs two clouds in Phase 2.

**Phase 2 presigned S3 upload security convention (non-negotiable when Phase 2 is built)**: the client→S3 upload must use a short-lived presigned upload minted by a Supabase Edge Function that verifies the caller's Supabase JWT (Supabase Auth stays the identity layer — no Cognito); the presigned upload must enforce the 45 MB cap server-side via a `content-length-range` policy condition; the IAM principal behind the Edge Function must be least-privilege (`s3:PutObject` on the ingest prefix only, credentials in Edge-Function secrets, never in the client or repo); the presigned URL must expire in ≤ 5 minutes; and the S3 object key must be chosen server-side, never client-supplied.

### File Upload to Supabase Storage

All uploads of local device files (photos, videos, any binary asset) must use `expo-file-system`'s `File.bytes()` to obtain a `Uint8Array` and pass it directly to `supabase.storage.from(bucket).upload(path, uint8Array, { contentType })`. The `fetch(uri) + response.blob()` pattern is prohibited: in React Native / Expo SDK 57+, `Response.blob()` routes data through the native blob store via base64 encoding, causing silent upload failures for real-world file sizes. Reference implementations: `mod-beta-video/beta-video-service.ts` (video) and `mod-route-catalog/route-service.ts` (photo).

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

### No `@react-navigation/native` Hooks (App-Wide)

No screen in this app may use `useFocusEffect`, `useNavigation`, `useRoute`, or any other `@react-navigation/native` navigation-context hook.

The app intentionally uses custom state-machine navigators (`GymNavigator`, `RouteNavigator`, `ProfileNavigator`, `HomeNavigator`, `AuthNavigator`) and mounts no `NavigationContainer` anywhere. The composition root is `SafeAreaProvider → ThemeProvider → AuthNavigator → AppShell` — there is no react-navigation `NavigationContainer` at any level. Any `@react-navigation/native` hook requiring navigation context will throw "Couldn't find a navigation object. Is your component inside NavigationContainer?" at runtime.

Rules:
1. **Conditionally-mounted screens** (e.g. `RouteDetailScreen`, `UserProfileScreen`, and any screen rendered with a conditional expression `{condition && <Screen />}`) — use a plain `useEffect` for data loading. These screens unmount and remount on each navigation, so `useEffect` fires on every mount — equivalent to `useFocusEffect` without the crash.
2. **Keep-alive screens** (e.g. `ProfileScreen`, and any screen rendered via AppShell's `display:none`/`display:flex` keep-alive pattern) — use an `isActive: boolean` prop + `useEffect([isActive])` for focus-triggered behavior. These screens never unmount, so remounting is not available as a refresh trigger. Each keep-alive screen must carry a top-of-file comment: _"This screen is rendered via AppShell's keep-alive pattern and has no NavigationContainer ancestor. Do not use useFocusEffect or any other @react-navigation/native hook that requires navigation context. Use the isActive prop instead."_
3. **Tests for any screen** — keep-alive or conditionally-mounted — must NOT mock `@react-navigation/native` or `useFocusEffect`. If a screen's test needed that mock to pass, the mock was hiding a production crash.

### Keep-Alive Screen Test Pattern

Tests for keep-alive screens must **not** mock `useFocusEffect` or `@react-navigation/native` — those screens render in production without a `NavigationContainer`, and the test must reflect that reality so any future navigation-context hook crashes CI immediately. To assert focus-triggered behavior on a keep-alive screen, flip the `isActive` prop (false → true) directly rather than simulating navigation events. Generally: if mocking a dependency makes a test pass that would fail in production, the mock is hiding a real bug — fix the incompatibility, do not mock over it.

### Bottom Safe Area for Pinned Bottom Bars

Any UI element pinned to the bottom of the screen (tab bar, sticky footer) must call `useSafeAreaInsets()` and apply `paddingBottom: insets.bottom` (plus a spacing token for the icon row) to its container so touch targets clear the home indicator. Screens hosted inside a tab whose content scrolls to the bottom should add the tab-bar height plus `insets.bottom` to their scroll `contentContainerStyle` `paddingBottom` so the last row is not hidden behind the bar. This complements the existing top-inset `makeStyles(theme, topInset)` convention.

### Cross-Module Imports

A module may import another module's **public service functions** (data layer) and **navigator entry-point components** (mounting) only — never its internal `screens/` or `components/` subdirectories directly. Aggregator modules (MOD-012) compose other modules exclusively through these two public surfaces.

When two modules must touch the same table, split access by verb and enforce with the shared RLS fence (e.g., MOD-012 reads `saved_gyms` via SELECT, MOD-002 writes `saved_gyms` via INSERT/DELETE). Document the shared-table access in both specs so it is not mistaken for a boundary violation.

### Shared Non-Module Constants

Cross-cutting static data that belongs to no single module (e.g., hardcoded banner definitions) lives in `src/lib/` alongside `theme.ts` and `i18n.ts`. These files hold structure, keys, and image refs only; all user-facing strings stay in the i18n locale catalogs and are never inlined into constant files.

### PG15 Enum Value Removal

To drop a value from an existing Postgres enum (not supported directly), use a **single migration file, single transaction** with these steps in order: (1) `CREATE TYPE <name>_v2 AS ENUM (...)` — the new type without the removed value; (2) `UPDATE` the table to backfill any rows that held the removed value to a valid replacement (this backfill MUST run before the column-type swap); (3) `ALTER TABLE ... ALTER COLUMN ... TYPE <name>_v2 USING col::text::<name>_v2`; (4) `DROP TYPE <name>`; (5) `ALTER TYPE <name>_v2 RENAME TO <name>` — restoring the canonical type name so all downstream references remain unbroken. This is distinct from the two-file `ADD VALUE` rule: `CREATE TYPE` (a new type) is fully committed and usable within the same transaction, so no file split is required. The canary for a mis-ordered migration is `ERROR: invalid input value for enum <name>_v2: "<removed_value>"` — that means the backfill (step 2) was omitted or placed after the column swap (step 3).

### Personal Cross-Module Data Overlays

When one module's screen must display a per-item overlay derived from another module's user-scoped data (e.g. "my achievement on this route" from ascents on a route-catalog screen), the owning module exposes a **batched, own-user-scoped** public service function with the shape `fetch...(ids: string[]): Promise<Record<string, Value>>`, preferably a `SECURITY INVOKER` RPC so RLS scopes it automatically to `auth.uid()`. The consuming screen calls it **once per screen** with all visible ids — never one call per item (N+1). The consuming module must not query the owning module's tables directly.

### Multi-Row Reduction with Defined Precedence

When aggregating multiple user rows per key into a single display value (e.g. best ascent style per route), define an explicit precedence order in the owning module's service so all consuming surfaces render consistently; do not rely on last-write or arbitrary ordering. For ascent style the defined precedence is: `flash > top > attempt` (flash is the strongest achievement). Never reduce client-side without a documented precedence.

### Route Display Name Format

A route's display name is composed at display time from its grade and hold color in the form `"{grade} {LocalizedColor}"` (e.g. "V3 Blue"), with the section label appended in parentheses when `section_label` is non-null (e.g. "V3 Blue (Cave)"). The color segment uses the i18n `routes.colors.<color_tag>` string. The display name is not a stored, user-editable field — it is derived from `grade`, `color_tag`, and optional `section_label`. Use this format consistently wherever a route is labeled (gym route list, route detail screen header, any surfaced route reference).

### saved_routes Migration Ownership

MOD-003 owns the `saved_routes` migration (the same principle as MOD-002 owning `saved_gyms` writes, extended: MOD-003 owns both the `saved_routes` table and the save/unsave verbs for routes). The migration mirrors the `saved_gyms` design exactly: `user_id DEFAULT auth.uid()` FK to `users` ON DELETE CASCADE, `route_id` FK to `routes` ON DELETE CASCADE, composite PK `(user_id, route_id)`, own-rows RLS SELECT/INSERT/DELETE, `GRANT SELECT, INSERT, DELETE` to `authenticated`, no UPDATE. Migration file: `2026XXXXXX_mod_003_saved_routes.sql`.

### Native Dependency Installation

All Expo native dependencies must be installed via `npx expo install <package>`, never `npm install <package>`. Expo resolves the SDK-compatible version automatically; `npm install` can silently install an SDK-incompatible version that passes Jest (via mocks) but fails the native iOS build. Hand-pinning a native module's version string in `package.json` is prohibited.

### Native Build Gate Before QA Handoff

When a module adds or changes a native dependency (a package with iOS/Android native code), the module's engineer must run the native build (`npx expo run:ios`, or the platform equivalent) and confirm it compiles before marking the module QA-ready. Unit tests alone are insufficient because Jest mocks native modules.

### Custom Fullscreen Media Viewers

When a fullscreen viewer needs custom in-viewer gestures or navigation (e.g. swipe-to-next), size the player/image to fill an RN `<Modal>` (`presentationStyle="overFullScreen"`) rather than calling the media library's `enterFullscreen()`, which imposes non-overridable native controls/dismiss chrome and (on some platforms) pauses the JS runtime. Native OS fullscreen is only appropriate for a plain single-clip player with no custom in-viewer interaction.

### Prefer RN PanResponder for Simple Swipe Gestures

Do not add `react-native-gesture-handler` (a native dependency requiring a rebuild + root provider) for gestures expressible with core `PanResponder` (single-axis swipe, threshold-based dismiss/advance). Reserve gesture-handler for genuinely complex multi-touch/reanimated interactions. Always pair a dismiss gesture with an explicit on-screen control as the accessible fallback.

### Orientation Owned by App Manifest

Phase 1 is globally portrait-locked via `app.json` `"orientation": "portrait"`; components must not programmatically lock/unlock orientation and must not rely on a media library's per-view fullscreen orientation option to enforce portrait. Any future per-screen orientation need is an explicit, separately-reviewed change.

### Thumbnail Grids Never Mount Video Players Per Cell

A grid or list of videos renders `<Image>`/placeholder cells (with an affordance icon), never one `VideoView` per cell; instantiate at most one active video player at a time (in the opened viewer). This protects the cold-start / scroll-performance NFRs and battery.

### Client-Side Aggregation Over Already-Fetched Arrays

When a screen needs both a raw per-item list and a summary of the same single-owner/single-parent set (e.g. "my sends on this route" + "my send count / attempt sum on this route"), fetch the raw set once via the owning module's existing public service and derive the summary client-side (a pure helper in the owning module owns the domain reduction rule). Do not add a server-side aggregate RPC for a single-parent slice — it risks the aggregate disagreeing with the list and adds a redundant round-trip. Reserve batched service functions (`fetch...(ids[])`) for genuine N-across-items reads where a per-item fetch would be N+1.

### Relocated Cross-Module Entry Points Are Removed from the Old Location

When an AC relocates an action entry point (e.g. moving log-send and upload-beta-video into a dedicated action row), the prior affordance must be removed from its old host so exactly one entry path exists. Two entry points to the same flow is a defect, not redundancy. Where the entry point renders in one module's screen but launches another module's flow, the button lives in the host screen and the flow stays owned by the flow's module (host-screen/owning-module split), coordinated across both engineers.

### User-Owned Tables That Participate in PostgREST Joins Reference public.users

User-owned `public` tables that participate in PostgREST embedded joins or feed/profile joins must reference `public.users(id)`, not `auth.users(id)`. PostgREST can only embed a related resource (`select('*, users(...)')`) when the FK targets a table in the exposed `public` schema. `public.users.id` mirrors `auth.users.id` (same UUID), so referencing `public.users(id)` is equivalent for integrity and additionally enables embedded joins. New user-owned tables should reference `public.users(id)`; when an existing table (e.g. `beta_videos`) needs an embedded user join, repoint its FK (value-preserving, no data migration).


### Manually Verify Every New or Modified PostgREST Embed/Join String

Whenever an engineer adds or modifies an embedded join in a `.select()` string — especially a nested embed, and most especially an FK-hinted embed nested inside another embed (e.g. `routes!beta_videos_route_id_fkey(name, gyms(name))`) — they MUST exercise the string against the live or local Supabase instance before marking the AC done: either run the equivalent query in the Studio SQL Editor, or hit the raw PostgREST endpoint directly. A `.select()` embed string is an untyped query DSL that neither TypeScript nor a mocked Supabase client can validate — mocked unit tests short-circuit before the string is ever parsed by PostgREST and therefore CANNOT substitute for this step. This is the data-access corollary of the existing "tests must not mock away a production incompatibility" convention. Nested FK-hinted embeds (more than one level of `!fk_name`) should be avoided in favour of a single disambiguated outer hint or a server-side RPC. Recommended (advisory): note the verification — the equivalent SQL or the PostgREST URL hit — in the module `status.md` Engineering Progress entry so the check is auditable.

### Beta-Video Visibility Has One Canonical Exclusion Predicate

A beta video is visible iff `is_reported = false OR report_dismissed = true` (hidden iff `is_reported = true AND report_dismissed = false`). This predicate must be reused verbatim by every listing path — never use a bare `is_reported = false`, which would permanently hide admin-dismissed videos and violate the re-appear-on-dismiss rule (AC-143). Concrete forms: Client (PostgREST): `.or('is_reported.eq.false,report_dismissed.eq.true')`. Server (SQL, e.g. the feed RPC): `WHERE (is_reported = FALSE OR report_dismissed = TRUE)`. Any new beta-video listing surface (route detail grid, fullscreen viewer set, activity feed RPC, future profile grid, search) must copy this exact predicate.

### Cross-User Field Flips Use a Single-Purpose SECURITY DEFINER RPC

When a user must set a flag on a row they do not own (e.g. a reporter flipping `is_reported` on another user's video), expose a narrow `SECURITY DEFINER` RPC (`SET search_path = public`, EXECUTE to `authenticated` only, revoked from `anon`/`public`, no `user_id` parameter) that writes exactly the required field(s) plus its own audit row, guarded by `ON CONFLICT DO NOTHING` for idempotency and by explicit checks (e.g. forbid self-action, require the row to exist). Never widen a DEFINER function to a general table-update helper, and never let it touch admin-only fields (e.g. `report_dismissed` is Studio/service-role only and must never be writable by the RPC).

### Cross-Module RPC Edits Ship in the Owning Module's Migration

When one module (e.g. MOD-005) adds columns another module's RPC (e.g. MOD-006 `get_activity_feed`) must reference, the RPC change is a `CREATE OR REPLACE` in the owning module's own migration, filename-dated after the prerequisite column-add migration so `supabase db reset` applies them in dependency order. Do not edit another module's owned object inside your migration.

### RN-Core Marquee for Text-Overflow Scroll

Simple text-scroll/marquee animations use RN core `Animated` (`translateX` loop in an `overflow:'hidden'` container, gated on measured overflow — `onLayout` or `onTextLayout` to compare text width against container width), never a native marquee/animation package. Extends the existing "prefer RN built-ins for simple effects; no native rebuild for a small UI behavior" convention to text-overflow marquee.

### User-Profile Navigation from Deeply-Mounted Screens

Navigating to another user's profile is a shell-owned action reached via a callback prop; deeply-mounted screens never import the profile screen. Any screen that needs to open another user's profile must accept an `onNavigateToUser?: (userId: string) => void` callback prop and call it with the target user's `user_id`, then dismiss itself if it is a modal/overlay. The prop is threaded down the mount chain to `AppShell` (MOD-012), which owns the single "open another user's profile" action — in Phase 1 this opens MOD-006's `UserProfileScreen` (via `UserProfileNavigator`) as a modal-style overlay (the same mechanism as the AC-123 climber-chip tap: `setTargetUserId(userId)`). A deeply-mounted screen must NEVER import `UserProfileScreen`/`UserProfileNavigator` directly — that both violates the Cross-Module Imports rule and inverts the dependency direction. This mirrors the existing `onNavigateToRoute` callback pattern for route navigation. The "other user's profile" is an overlay, not the Profile tab (Tab 3 is the current user's own profile); do not deep-link another user's id into Tab 3 in Phase 1.

### Per-User Stats on User Lists

Per-user stats on any list of users are sourced per-card from MOD-008's `get_profile_stats` public service (`fetchProfileStats(userId)`), never from a client-side `ascents`/`routes` query and never from a bespoke batch RPC in Phase 1. Consuming modules (e.g. MOD-006's Followers/Following cards) import `fetchProfileStats` from `mod-profile-history/history-service.ts` and call it lazily per visible card. The RPC is `SECURITY INVOKER STABLE` with a built-in privacy gate, so a `followers_only` non-follower correctly receives zeroed stats with no consumer-side privacy logic. Deriving "total sends" or "highest grade" client-side is prohibited (it risks disagreeing with the canonical `get_profile_stats` definition — total_sends = count of `flash`+`top`, highest_grade = `MAX(grade)` under the same privacy gate). A batch `get_profile_stats_batch(user_ids[])` is a Phase 2 optimization to revisit only if real list sizes exceed ~200; do not build it for Phase 1.

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
- **Video storage watch threshold**: When beta-video storage in the Supabase `beta-videos` bucket reaches 800 MB (80% of the 1 GB free-tier total shared across all Supabase Storage buckets), the operator must begin evaluating the Phase 2 video infrastructure migration (AC-170). This does not block uploads. Phase 2 migration target: AWS S3 + CloudFront + MediaConvert, superseding the previously documented Cloudflare Stream target (Rev 24).
- **Apple Sign-In**: Required by the App Store because Google Sign-In is offered. Apple Sign-In must be visually equivalent to Google Sign-In (not smaller or hidden) per App Store review guidelines.
