# Send It

A Taiwan-first iOS app for indoor bouldering climbers — log your sends, share
and watch beta videos, browse what's currently set at the gyms you follow, and
keep up with the local climbing scene.

## What it is

Send It is a React Native (Expo) mobile client that talks directly to Supabase
for auth, data, storage, and serverless functions. It is built around a
persistent three-tab shell (Home / Gyms / Profile) and an admin-curated,
branch-level directory of Taipei and New Taipei bouldering gyms, so the app has
real coverage on day one. Phase 1 is iOS-only.

## Tech Stack

| Component      | Name + Version                                    | Notes                                                                 |
|----------------|---------------------------------------------------|-----------------------------------------------------------------------|
| Language       | TypeScript 5.8                                     | Shared across the app and Supabase Edge Functions.                    |
| App framework  | React Native 0.86 + Expo SDK 57                    | iOS-only build configuration for Phase 1. Android is Phase 2.         |
| Backend (BaaS) | Supabase (Postgres 15, Auth, Storage, Edge Functions) | Row-Level Security on every table. Auth: Email + Apple + Google.  |
| Video          | Supabase Storage + `expo-video`                    | `.mp4` / `.mov` (H.264/HEVC + AAC) stored as-is; inline playback.    |
| Push           | APNs via Expo Push                                 | Beta-video-like events only in Phase 1.                              |
| Analytics      | PostHog (free tier)                               | Product events + retention cohorts; no PII beyond `user_id`.         |
| Localization   | i18next + expo-localization                        | English + Traditional Chinese (zh-TW); device-locale default.        |
| Admin tooling  | Supabase Studio                                    | Sole admin surface for Phase 1; no in-app admin UI.                  |

## Prerequisites

- Node.js 20 LTS (see `.nvmrc`; `nvm use` picks it up)
- Xcode with an iOS Simulator runtime, plus CocoaPods (`sudo gem install cocoapods`)
- Supabase CLI (`brew install supabase/tap/supabase`)
- A Supabase project and a PostHog project (see `project-planning/setup.md` for provisioning)

## Getting started

1. Clone the repository and select the pinned Node version:
   ```bash
   git clone <repo-url> send-it
   cd send-it
   nvm use
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create your local environment file and fill in real values (see `.env.example`
   for every key). `.env` is git-ignored — never commit it.
   ```bash
   cp .env.example .env
   ```
4. Apply database migrations to your linked Supabase project:
   ```bash
   supabase link --project-ref YOUR-PROJECT-REF
   supabase db push
   ```
5. Build and run on the iOS Simulator:
   ```bash
   npx expo run:ios
   ```

For the full environment provisioning runbook (Supabase, PostHog, Expo push
credentials, Apple Developer account), see `project-planning/setup.md`.

## Project structure

```
src/
  lib/                  Cross-cutting singletons: Supabase client, theme, i18n, static banners
  modules/              One directory per feature module (mod-*), matching the Module Map
supabase/
  migrations/           All schema changes as Supabase CLI migrations
  functions/            Edge Functions
locales/                i18n message catalogs (en, zh-TW)
project-planning/       PRD, production architecture, module specs, and status tracking
```

## Module overview

| Module  | Description                                                                        |
|---------|------------------------------------------------------------------------------------|
| MOD-001 | Auth & Profile — signup/sign-in (Email/Apple/Google), session, profile, privacy.  |
| MOD-002 | Gym Directory — curated gym directory, detail pages, "request a gym", saved gyms.  |
| MOD-003 | Route Catalog — route submission, status lifecycle, composed names, saved routes. |
| MOD-004 | Send Logging — quick send logging with route-inherited grade and 3 ascent styles. |
| MOD-005 | Beta Video — capture, client-side compression, thumbnail, upload, inline playback.|
| MOD-006 | Social Graph & Feed — follow/unfollow, chronological feed, beta-video likes.       |
| MOD-007 | Notifications — device tokens, preferences, APNs fan-out, in-app inbox.            |
| MOD-008 | Profile History & Stats — send history filters, stats, per-send achievement icons.|
| MOD-009 | Moderation — report and block flows (App Store Guideline 1.2 compliance).          |
| MOD-010 | Localization & Theming — English/zh-TW catalogs, Light/Dark theming.               |
| MOD-011 | Analytics — PostHog product events wired throughout the app.                       |
| MOD-012 | Home — the persistent three-tab shell and the Home tab surface.                    |

## Scripts

| Command             | What it does                                              |
|---------------------|----------------------------------------------------------|
| `npm start`         | Start the Metro bundler / Expo dev server.               |
| `npm run ios`       | Build and run the native iOS app (`expo run:ios`).       |
| `npm test`          | Run the Jest unit suite.                                  |
| `npm run lint`      | Type-check the project with `tsc --noEmit`.              |

## Development notes

- **Install native dependencies with `npx expo install <package>`**, never
  `npm install <package>`. Expo resolves the SDK-compatible version; a plain
  `npm install` can pin an SDK-incompatible native module that passes Jest (via
  mocks) but fails the native iOS build. Hand-pinning a native module version in
  `package.json` is prohibited.
- **Run the native build before QA when native deps change.** When a module adds
  or changes a package with native code, run `npx expo run:ios` and confirm it
  compiles before marking the module QA-ready. Passing unit tests alone are not
  evidence a native dependency compiles, because Jest mocks native modules.
- **Custom navigation.** The app uses a hand-rolled state-machine navigator
  pattern per navigator (not React Navigation route configs) — the persistent
  tab shell lives in `src/modules/mod-home/AppShell.tsx`.
- **Safe area insets.** Wrap the root once in `SafeAreaProvider`; every screen
  derives `paddingTop` from `useSafeAreaInsets()` (`topInset + theme.spacing.md`)
  rather than hardcoding a top padding, so content clears the Dynamic Island.
- **RLS-first data access.** The client never uses the service-role key. Every
  table enables Row-Level Security from its creating migration; multi-table
  reads that compose follow/block/privacy go through `SECURITY INVOKER` RPCs.

## Environment variables

`.env` is required and is git-ignored — copy `.env.example` and fill in real
values. Only variables prefixed `EXPO_PUBLIC_` are inlined into the client
bundle. The Supabase service-role key must never live in `.env` or client code;
it is set as a Supabase secret named `SERVICE_ROLE_KEY` (not
`SUPABASE_SERVICE_ROLE_KEY` — Supabase reserves the `SUPABASE_` prefix) and is
read only inside Edge Functions. Never commit secrets.
