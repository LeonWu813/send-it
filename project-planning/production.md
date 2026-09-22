# Send It — Production Reference

**Project**: Send It (Taiwan-first indoor bouldering app)
**Phase**: 1 — iOS MVP, Taipei + New Taipei launch
**Last synced from PRD**: rev 2 (2026-09-20)

---

## Project Overview

Send It is a Taiwan-first mobile app for indoor bouldering climbers. It gives climbers a fast way to log sends (route + grade + attempts + status), share and watch beta videos (short technique clips) tied to specific routes, browse what's currently set at their home gym, and connect with other climbers in the local scene.

Send It's wedge is a lightweight, Taiwan-first version of Kaya's core loop — log, watch beta, see history — built on an admin-curated gym directory (so the app has real coverage on day one) plus a match-before-create route submission flow that keeps user-submitted data clean without waiting on official gym partnerships.

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
- **Supabase Postgres** is the system of record. All tables are protected by Row-Level Security (RLS) policies. Read/write access is scoped per-user for logs, follows, reactions, reports, blocks, and notification preferences; gym and route tables are readable by all authenticated users, writable only by admins (gyms) or the submitting user + admins (routes).
- **Supabase Storage** hosts avatars, gym photos, route photos, and (Phase 1 only) beta videos + client-generated thumbnails. When the migration trigger fires, video uploads cut over to Cloudflare Stream while metadata continues to live in Postgres.
- **Supabase Edge Functions** handle event-driven workflows that must not run on the client: on `Reaction` insert with `target_type = beta_video`, an Edge Function inserts a `Notification` row and enqueues an APNs push (respecting `NotificationPreference`) via Expo Push to all `DeviceToken` rows for the recipient.
- **PostHog** SDK ships client-side events (signup, first send, video upload, retention markers). No PII beyond user_id is sent.
- **Admin operations** (adding gyms, reviewing gym requests, reviewing reports, banning users, merging near-duplicate routes) are performed exclusively through Supabase Studio in Phase 1.

**Key data flows:**

1. **Log a send**: client → Supabase Auth (session) → Postgres insert into `Ascent` (RLS-checked) → PostHog event. Grade is read from `Route.grade` at display time, never stored per-log.
2. **Upload beta video → notify**: client compresses video and generates thumbnail → upload to Supabase Storage (Phase 1) → insert `BetaVideo` row → other user views + likes → insert `Reaction` row → Edge Function fires → insert `Notification` row + APNs push to recipient's device tokens (if enabled in `NotificationPreference`).

---

## Module Index

| MOD-ID  | Directory              | Module Name                  | One-line description                                                                                      |
|---------|------------------------|------------------------------|-----------------------------------------------------------------------------------------------------------|
| MOD-001 | mod-auth-profile       | Auth & Profile               | Signup, sign-in (Email/Apple/Google), session management, profile CRUD, privacy, home gym selection.      |
| MOD-002 | mod-gym-directory      | Gym Directory                | Admin-curated gym directory, gym detail pages, search/filter, "request a gym" form.                       |
| MOD-003 | mod-route-catalog      | Route Catalog                | Route submission with match-before-create, match key, route detail pages, status flagging, color enum.    |
| MOD-004 | mod-send-logging       | Send Logging                 | Send log creation enforcing grade inheritance from route; no per-user grade override.                     |
| MOD-005 | mod-beta-video         | Beta Video                   | Video capture/selection, client-side compression, thumbnail, storage upload, inline playback.             |
| MOD-006 | mod-social-feed        | Social Graph & Feed          | Follow/unfollow, chronological activity feed via SECURITY INVOKER RPC, beta-video like reactions.        |
| MOD-007 | mod-notifications      | Notifications                | Device token registration, notification preferences, Edge Function push fan-out, in-app inbox.            |
| MOD-008 | mod-profile-history    | Profile History & Stats      | Send history with filters, stats bar chart, streak, highest grade — for self and (per privacy) others.    |
| MOD-009 | mod-moderation         | Moderation (Report & Block)  | Report submission, symmetric block/unblock, feed filtering, scheduled report-digest Edge Function.        |
| MOD-010 | mod-localization-theme | Localization & Theming       | i18n catalog loading, device-locale detection, zh-TW fallback, language toggle, Light/Dark theming.       |
| MOD-011 | mod-analytics          | Analytics                    | PostHog event instrumentation across the app (cross-cutting; no user-facing UI).                          |

---

## Shared Conventions

### Directory Layout

```
src/
  lib/                         # Cross-cutting singletons and providers
    supabase.ts                # Supabase client singleton — only place createClient() is called
    theme.ts                   # Theme provider / tokens
    i18n.ts                    # i18n initialization
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
