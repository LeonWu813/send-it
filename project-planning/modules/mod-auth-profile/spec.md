# MOD-001: Auth & Profile — Spec

**Module ID**: MOD-001
**Module Name**: Auth & Profile
**Phase**: 1
**Dependencies**: none
**Last Synced from PRD Revision**: 7

---

## Purpose

Handle signup, sign-in (email, Apple, Google), session management, and user profile CRUD including privacy setting, avatar, bio, and display name. Own the Profile tab surface: display the current user's display name, avatar, and bio; expose an Edit Profile entry point (display name, avatar, bio, privacy setting); embed the current user's send history (MOD-008 surface); and expose a Logout control. There is no home gym concept — saved gyms live in MOD-012.

---

## Context

New climbers need a fast, trustworthy onboarding path that lets them complete signup and start logging. Send It supports Email, Apple Sign-In, and Google Sign-In; Apple Sign-In is required by the App Store because a third-party sign-in (Google) is offered. After auth, the user lands directly on the Home tab without requiring any gym selection step (AC-001 revised). Profile privacy (`public` | `followers_only`) controls whether non-followers can view a user's logs and beta video listings; this setting is required for US-012 and enforced in RLS across multiple downstream modules.

The MOD-001 engineer must also execute the `home_gym_id` removal: add a forward migration to DROP COLUMN `home_gym_id` from `public.users` and remove all source references listed in the Impact Map (auth-service.ts, types.ts, AuthNavigator.tsx, HomeGymSelectionScreen.tsx, test files, i18n catalogs). This removal is required because the `SavedGym` join table (owned by MOD-012) replaces the single `home_gym_id` field.

**Non-goals for this module:**
- Android support (Phase 2).
- Official gym partnerships or route-setter accounts (Phase 3).
- Per-user grade systems other than V-scale (Phase 1 only uses V-scale).
- In-app admin tooling.
- User-editable grade overrides.
- Saved gyms (owned by MOD-012).

---

## Related User Stories

- **US-001**: Sign up and start using the app
- **US-011**: View my profile history and stats
- **US-012**: Set profile privacy

---

## Acceptance Criteria Covered

**AC-001** (revised): On first run, the app shall navigate the user directly to the Home tab without requiring gym selection.

**AC-063**: The system shall enforce a profile privacy setting of `public` (default) or `followers_only`, and when set to `followers_only` shall return 403/hidden for logs and beta video listings requested by non-followers.

**AC-116** (new): The Profile screen shall display the current user's display name, avatar, and bio.

**AC-117** (new): The Profile screen shall expose an Edit Profile entry point that opens editing of the current user's display name, avatar, bio, and privacy setting.

**AC-118** (new): The Profile screen shall embed the current user's send history (the MOD-008 profile-history-and-stats surface).

**AC-119** (new): The Profile screen shall expose a Logout control at the bottom that ends the session and returns the user to the signed-out state.

---

## Integration Points

1. MOD-001 must expose a `ProfileNavigator` entry-point component. `AppShell` (owned by MOD-012) mounts `ProfileNavigator` as Tab 3. The MOD-001 engineer must confirm the navigator is exposed as a public entry point before MOD-012 QA handoff.

2. The Profile screen (AC-118) embeds MOD-008's send history surface. The MOD-001 engineer must integrate the MOD-008 surface component when MOD-008 ships.

---

## Data Model (relevant tables)

```
User
 - id, display_name, avatar_url,
   bio, privacy_setting (public | followers_only), created_at
```

Note: `home_gym_id` has been removed from the User entity as of PRD Revision 7. The MOD-001 engineer must add a forward migration to `DROP COLUMN home_gym_id` from `public.users`. The dependent FK (`users_home_gym_id_fkey`) drops automatically with the column (Postgres behavior). No RLS policy or trigger references `home_gym_id` (verified clean).

All tables guarded by Supabase Row-Level Security policies.

---

## Input / Output Contract

**Inputs:**
- Supabase Auth sign-up/sign-in payload (email+password, Apple identity token, Google OAuth token)
- Profile fields: `display_name`, `avatar_url` (Storage URL), `bio`, `privacy_setting`

**Outputs:**
- Authenticated Supabase session stored locally on the device
- `User` row created/updated in Postgres
- `privacy_setting` persisted on `User` (controls downstream RLS behaviour in MOD-004, MOD-005, MOD-006, MOD-008)
- Profile screen rendering display name, avatar, bio, embedded send history (MOD-008), and Logout control

---

## Requirements

- Signup via Email, Apple Sign-In, and Google Sign-In must be supported (AC-001).
- On first run, the app navigates the user directly to the Home tab without requiring any gym selection step (AC-001 revised).
- Profile privacy must be enforced as `public` (default) or `followers_only`; when `followers_only`, logs and beta video listings must return 403/hidden to non-followers (AC-063).
- The Profile screen must display the current user's display name, avatar, and bio (AC-116).
- The Profile screen must expose an Edit Profile entry point for editing display name, avatar, bio, and privacy setting (AC-117).
- The Profile screen must embed the current user's send history (MOD-008 surface) (AC-118).
- The Profile screen must expose a Logout control at the bottom that ends the session and returns the user to the signed-out state (AC-119).
- The MOD-001 engineer must add a migration to DROP COLUMN `home_gym_id` from `public.users` and remove all source references listed in the Impact Map (auth-service.ts, types.ts, AuthNavigator.tsx, HomeGymSelectionScreen.tsx, test files, i18n catalogs).

---

## Key Implementation Notes

- Apple Sign-In must be visually equivalent to Google Sign-In (not smaller or hidden) per App Store review guidelines — this is a hard App Store requirement.
- Session is stored locally by the Supabase client singleton (`src/lib/supabase.ts`); never call `createClient()` at individual call sites.
- `privacy_setting` defaults to `public`. When set to `followers_only`, all downstream modules (MOD-004 send history, MOD-005 beta video listings, MOD-008 profile stats) must respect this via RLS policies or RPC guards — MOD-001 owns the column, downstream modules enforce it.
- Avatar upload path: client uploads to Supabase Storage, then writes the resulting URL into `User.avatar_url`.
- No per-user grade system override in Phase 1 — V-scale is forced across all gyms.
- **`home_gym_id` removal impact map** — the following six source sites must be updated atomically with the DROP COLUMN migration:
  - `src/modules/mod-auth-profile/auth-service.ts` — remove `home_gym_id` from SELECT queries and delete the `setHomeGym` function.
  - `src/modules/mod-auth-profile/types.ts` — remove `home_gym_id` from the `UserProfile` type.
  - `src/modules/mod-auth-profile/AuthNavigator.tsx` — remove the onboarding gate that shows `HomeGymSelectionScreen` (this is the revised AC-001: first run goes directly to the Home tab).
  - `src/modules/mod-auth-profile/screens/HomeGymSelectionScreen.tsx` — delete the file entirely.
  - `src/modules/mod-auth-profile/__tests__/` — update relevant test files (remove `setHomeGym` imports, `home_gym_id` fixtures, and the `describe('setHomeGym')` block).
  - `src/lib/i18n/` locale catalogs — remove `homeGym` keys from both zh-TW and en-US.
- `ProfileNavigator` must be exposed as a public entry-point component so that `AppShell` (MOD-012) can mount it as Tab 3.

---

## Out of Scope for This Module

- Android configuration (Phase 2).
- Official gym partnerships and route-setter account types (Phase 3).
- Per-user grade system selection (Phase 1 forces V-scale).
- In-app admin UI (Supabase Studio only for Phase 1).
- User-editable grade overrides on send logs (grade always comes from `Route.grade`).
- Payments, subscriptions, or monetization.
- Saved gyms (owned by MOD-012 — the `SavedGym` join table replaces the removed `home_gym_id` field).
