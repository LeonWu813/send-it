# MOD-001: Auth & Profile — Spec

**Module ID**: MOD-001
**Module Name**: Auth & Profile
**Phase**: 1
**Dependencies**: none

---

## Purpose

Handle signup, sign-in (email, Apple, Google), session management, and user profile CRUD including privacy setting, home gym selection, avatar, bio, and highest-grade display.

---

## Context

New climbers need a fast, trustworthy onboarding path that lets them complete signup, pick a home gym, and start logging — all within 3 minutes (project goal). Send It supports Email, Apple Sign-In, and Google Sign-In; Apple Sign-In is required by the App Store because a third-party sign-in (Google) is offered. After auth, the user selects a home gym from the curated directory, which is then persisted on their profile. Profile privacy (`public` | `followers_only`) controls whether non-followers can view a user's logs and beta video listings; this setting is required for US-012 and enforced in RLS across multiple downstream modules. Home gym is nullable (`home_gym_id FK Gym`) so partial profiles are possible but the happy-path onboarding drives users to set it immediately.

**Non-goals for this module:**
- Android support (Phase 2).
- Official gym partnerships or route-setter accounts (Phase 3).
- Per-user grade systems other than V-scale (Phase 1 only uses V-scale).
- In-app admin tooling.
- User-editable grade overrides.

---

## User Stories Covered

- **US-001**: Sign up and set home gym
- **US-012**: Set profile privacy

---

## Acceptance Criteria Covered

**AC-001**: The system shall allow a new user to complete signup via Email, Apple Sign-In, or Google Sign-In and reach the home gym selection screen when they open the app for the first time.

**AC-002**: The system shall allow a signed-in user to select exactly one home gym from the curated directory and persist that selection to their profile.

**AC-003**: The system shall complete signup + home gym selection in under 60 seconds of user-perceived interaction time for a user on a normal 4G/LTE connection when they follow the happy path.

**AC-063**: The system shall enforce a profile privacy setting of `public` (default) or `followers_only`, and when set to `followers_only` shall return 403/hidden for logs and beta video listings requested by non-followers.

---

## Data Model (relevant tables)

```
User
 - id, display_name, avatar_url, home_gym_id (nullable, FK Gym),
   bio, privacy_setting (public | followers_only), created_at
```

All tables guarded by Supabase Row-Level Security policies. `home_gym_id` FK references the `Gym` table owned by MOD-002.

---

## Input / Output Contract

**Inputs:**
- Supabase Auth sign-up/sign-in payload (email+password, Apple identity token, Google OAuth token)
- Home gym selection: `gym_id` (FK from the curated directory)
- Profile fields: `display_name`, `avatar_url` (Storage URL), `bio`, `privacy_setting`

**Outputs:**
- Authenticated Supabase session stored locally on the device
- `User` row created/updated in Postgres
- `home_gym_id` persisted on `User`
- `privacy_setting` persisted on `User` (controls downstream RLS behaviour in MOD-004, MOD-005, MOD-006, MOD-008)

---

## Key Implementation Notes

- Apple Sign-In must be visually equivalent to Google Sign-In (not smaller or hidden) per App Store review guidelines — this is a hard App Store requirement.
- Session is stored locally by the Supabase client singleton (`src/lib/supabase.ts`); never call `createClient()` at individual call sites.
- On first launch after signup, the app must navigate the user to the home gym selection screen (AC-001) before the main app shell.
- `privacy_setting` defaults to `public`. When set to `followers_only`, all downstream modules (MOD-004 send history, MOD-005 beta video listings, MOD-008 profile stats) must respect this via RLS policies or RPC guards — MOD-001 owns the column, downstream modules enforce it.
- Avatar upload path: client uploads to Supabase Storage, then writes the resulting URL into `User.avatar_url`.
- No per-user grade system override in Phase 1 — V-scale is forced across all gyms.

---

## Out of Scope for This Module

- Android configuration (Phase 2).
- Official gym partnerships and route-setter account types (Phase 3).
- Per-user grade system selection (Phase 1 forces V-scale).
- In-app admin UI (Supabase Studio only for Phase 1).
- User-editable grade overrides on send logs (grade always comes from `Route.grade`).
- Payments, subscriptions, or monetization.
