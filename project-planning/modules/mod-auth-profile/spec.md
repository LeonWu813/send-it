# MOD-001: Auth & Profile — Spec

**Module ID**: MOD-001
**Module Name**: Auth & Profile
**Phase**: 1
**Dependencies**: MOD-005 (`BetaVideoGrid` component, `fetchBetaVideosByUser` service, and `BetaVideoReelViewer` `profile` context for the own-videos grid on ProfileScreen, AC-164)
**Last Synced from PRD Revision**: 22
**Last Updated**: 2026-09-30

---

## Purpose

Handle signup, sign-in (email, Apple, Google), session management, and user profile CRUD including privacy setting, the separate beta-video privacy setting (`beta_video_privacy`), avatar, bio, and display name. Own the Profile tab surface: display the current user's display name, avatar, and bio; render follower/following count links on the profile (AC-145); expose an Edit Profile entry point (display name, avatar, bio, privacy setting); embed the current user's send history (MOD-008 surface); and render a 3-column beta-video grid of the current user's own beta videos below the send history (MOD-005's `BetaVideoGrid` + `fetchBetaVideosByUser`, opening MOD-005's reel viewer in `profile` context, AC-164). Own the `users.beta_video_privacy` write: expose a public service function that updates the current user's `beta_video_privacy` column, consumed by MOD-010's SettingsScreen (AC-157). The Logout control is no longer on the Profile screen — it moves to MOD-010's SettingsScreen (AC-167/AC-168). There is no home gym concept — saved gyms live in MOD-012.

---

## Context

New climbers need a fast, trustworthy onboarding path that lets them complete signup and start logging. Send It supports Email, Apple Sign-In, and Google Sign-In; Apple Sign-In is required by the App Store because a third-party sign-in (Google) is offered. After auth, the user lands directly on the Home tab without requiring any gym selection step (AC-001 revised). Profile privacy (`public` | `followers_only`) controls whether non-followers can view a user's logs and beta video listings; this setting is required for US-012 and enforced in RLS across multiple downstream modules.

The MOD-001 engineer must also execute the `home_gym_id` removal: add a forward migration to DROP COLUMN `home_gym_id` from `public.users` and remove all source references listed in the Impact Map (auth-service.ts, types.ts, AuthNavigator.tsx, HomeGymSelectionScreen.tsx, test files, i18n catalogs). This removal is required because the `SavedGym` join table (owned by MOD-012) replaces the single `home_gym_id` field.

For US-022, the Profile screen shall display follower and following counts immediately below the user's bio as two tappable count links (followers left, following right), navigating to the Followers list screen (AC-146) and Following list screen (AC-147) respectively. Counts are sourced from MOD-006's social-graph public service. This applies to both the current user's own Profile screen and the MOD-008 other-user profile surface.

For US-012, this module owns the `users.beta_video_privacy` column (enum `public` | `followers_only`, default `public`), separate and independent from `privacy_setting` (AC-063). MOD-001 exposes a public service function to update the current user's `beta_video_privacy` value; MOD-010's SettingsScreen calls this service (AC-157). This setting governs beta-video visibility only and does not affect `privacy_setting`.

For US-011, the Profile screen renders a 3-column `BetaVideoGrid` (AC-160, owned by MOD-005) as a separate section below the full send history, showing the current user's own beta videos via `fetchBetaVideosByUser(currentUserId)` (AC-162, owned by MOD-005). Tapping a cell opens `BetaVideoReelViewer` cycling the current user's own videos from the tapped index, with `reelContext = 'profile'` — the poster-identity row is visible but NOT tappable.

The Logout control is removed from the Profile screen (AC-167) and relocated to MOD-010's SettingsScreen (AC-168). The session-ending behavior is unchanged; only its location moves.

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
- **US-022**: See who follows me and who I follow

**US-001 Acceptance Criteria**: AC-001

**US-011 Acceptance Criteria**: AC-116, AC-117, AC-118, AC-160, AC-162, AC-164

**US-012 Acceptance Criteria**: AC-063, AC-156, AC-157, AC-158

**US-022 Acceptance Criteria**: AC-145, AC-146, AC-147, AC-148

---

## Acceptance Criteria Covered

**AC-001** (revised): On first run, the app shall navigate the user directly to the Home tab without requiring gym selection.

**AC-063**: The system shall enforce a profile privacy setting of `public` (default) or `followers_only`, and when set to `followers_only` shall return 403/hidden for logs and beta video listings requested by non-followers.

**AC-116** (new): The Profile screen shall display the current user's display name, avatar, and bio.

**AC-117** (new): The Profile screen shall expose an Edit Profile entry point that opens editing of the current user's display name, avatar, bio, and privacy setting.

**AC-118** (new): The Profile screen shall embed the current user's send history (the MOD-008 profile-history-and-stats surface).

**AC-145** (new): The Profile screen shall display, immediately below the user's bio, two tappable count links arranged left (followers count, label "追蹤者") and right (following count, label "追蹤中"). Tapping the followers link navigates to the Followers list screen (AC-146); tapping the following link navigates to the Following list screen (AC-147). The counts are sourced from MOD-006's social-graph public service. This applies to both the current user's own Profile screen and the MOD-008 other-user profile surface (AC-064).

**AC-156** (new): The system shall persist a per-user beta-video privacy setting in a new `users.beta_video_privacy` column (enum `public` (default) | `followers_only`), separate and independent from the existing `privacy_setting` column (AC-063). MOD-001 shall expose a public service function that updates the current user's `beta_video_privacy` value; MOD-001 owns this profile write. When `beta_video_privacy = followers_only`, the user's beta videos shall be visible only to the user themselves and to their followers; when `public` (default), the user's beta videos are visible to all users. This setting governs beta-video visibility only and does not affect `privacy_setting` (which governs logs and the profile surface per AC-063). Adding the column requires a migration.

**AC-164** (new): The `ProfileScreen` shall display a 3-column `BetaVideoGrid` (AC-160) as a separate section below the full send history, showing the current user's own beta videos fetched via `fetchBetaVideosByUser(currentUserId)` (AC-162). Tapping a cell shall open `BetaVideoReelViewer` cycling through the current user's own videos, starting at the tapped index. In this context the viewer is passed `reelContext = 'profile'`: the poster-identity row is visible but NOT tappable (no navigation on tap). MOD-005 shall add a `reelContext: 'route' | 'profile'` prop to `BetaVideoReelViewer` — `'route'` keeps the existing behavior (poster row tappable, navigates to the poster's profile per AC-135); `'profile'` renders the poster row visible but not tappable. MOD-001 consumes MOD-005's `BetaVideoGrid`, `fetchBetaVideosByUser`, and `BetaVideoReelViewer` for this section.

**AC-167** (new): The Logout control shall be removed from the `ProfileScreen` `listFooterComponent`. Logout moves to the SettingsScreen (AC-168). This supersedes AC-119's placement of the Logout control on the Profile screen; the session-ending behavior (ends the session and returns the user to the signed-out state) is unchanged — only its location moves.

---

## Integration Points

1. MOD-001 must expose a `ProfileNavigator` entry-point component. `AppShell` (owned by MOD-012) mounts `ProfileNavigator` as Tab 3. The MOD-001 engineer must confirm the navigator is exposed as a public entry point before MOD-012 QA handoff.

2. The Profile screen (AC-118) embeds MOD-008's send history surface. The MOD-001 engineer must integrate the MOD-008 surface component when MOD-008 ships.

3. **MOD-006 follower/following counts (AC-145)**: The Profile screen sources follower and following counts from MOD-006's social-graph public service to render the tappable count links below the user's bio.

4. **MOD-005 beta-video grid (AC-164)**: The Profile screen displays a 3-column `BetaVideoGrid` below the send history. MOD-001 imports `BetaVideoGrid` and `fetchBetaVideosByUser` from MOD-005 (`mod-beta-video`). This is a one-directional presentation/service import: MOD-001 imports MOD-005's public component and service; MOD-005 does NOT import from MOD-001 (it reads auth via `supabase.auth.getSession()` from `lib/supabase` directly). No circular dependency.

5. **MOD-001 `beta_video_privacy` write service (AC-156/AC-157)**: MOD-001 exposes a public service function that updates the current user's `users.beta_video_privacy` column. MOD-010's SettingsScreen calls this service for the "Beta Video Privacy" toggle (AC-157). MOD-001 owns this write; MOD-010 does not write directly to `users.beta_video_privacy`.

---

## Data Model (relevant tables)

```
User
 - id, display_name, avatar_url,
   bio, privacy_setting (public | followers_only),
   beta_video_privacy (public | followers_only, default public), created_at
   -- privacy_setting: governs logs and the profile surface (AC-063).
   --   followers_only → logs and profile hidden/403 to non-followers.
   -- beta_video_privacy: a SEPARATE, independent column (AC-156) governing
   --   beta-video visibility only. followers_only → beta videos visible only
   --   to the poster and their followers (AC-158); public (default) → visible
   --   to all. Written only by MOD-001's public service (consumed by MOD-010,
   --   AC-157). Adding this column requires a migration.
```

Note: `home_gym_id` has been removed from the User entity as of PRD Revision 7. The MOD-001 engineer must add a forward migration to `DROP COLUMN home_gym_id` from `public.users`. The dependent FK (`users_home_gym_id_fkey`) drops automatically with the column (Postgres behavior). No RLS policy or trigger references `home_gym_id` (verified clean).

All tables guarded by Supabase Row-Level Security policies.

---

## Input / Output Contract

**Inputs:**
- Supabase Auth sign-up/sign-in payload (email+password, Apple identity token, Google OAuth token)
- Profile fields: `display_name`, `avatar_url` (Storage URL), `bio`, `privacy_setting`
- `beta_video_privacy` update value (`public` | `followers_only`) — written via MOD-001's public service, called by MOD-010 SettingsScreen (AC-157)

**Outputs:**
- Authenticated Supabase session stored locally on the device
- `User` row created/updated in Postgres
- `privacy_setting` persisted on `User` (controls downstream RLS behaviour in MOD-004, MOD-005, MOD-006, MOD-008)
- `beta_video_privacy` persisted on `User` (controls beta-video visibility across all listing surfaces, AC-158)
- Profile screen rendering: display name, avatar, bio, follower/following count links (AC-145), embedded send history (MOD-008), 3-column `BetaVideoGrid` of own beta videos below send history (AC-164), and Logout control removed from Profile screen (AC-167; now in MOD-010 SettingsScreen)

---

## Requirements

- Signup via Email, Apple Sign-In, and Google Sign-In must be supported (AC-001).
- On first run, the app navigates the user directly to the Home tab without requiring any gym selection step (AC-001 revised).
- Profile privacy must be enforced as `public` (default) or `followers_only`; when `followers_only`, logs and beta video listings must return 403/hidden to non-followers (AC-063).
- The system must persist `users.beta_video_privacy` (enum `public` | `followers_only`, default `public`) and expose a public service function to update it; MOD-001 owns this write (AC-156).
- The Profile screen must display the current user's display name, avatar, and bio (AC-116).
- The Profile screen must expose an Edit Profile entry point for editing display name, avatar, bio, and privacy setting (AC-117).
- The Profile screen must embed the current user's send history (MOD-008 surface) (AC-118).
- The Profile screen must display follower and following count links immediately below the bio, sourced from MOD-006's social-graph public service, navigating to AC-146 and AC-147 screens respectively (AC-145).
- The Profile screen must display a 3-column `BetaVideoGrid` below the full send history, showing own beta videos via `fetchBetaVideosByUser(currentUserId)` (MOD-005), opening `BetaVideoReelViewer` with `reelContext = 'profile'` on cell tap (AC-164).
- The Logout control must be removed from the Profile screen `listFooterComponent`; the session-ending behavior moves to MOD-010's SettingsScreen (AC-167).
- The MOD-001 engineer must add a migration to DROP COLUMN `home_gym_id` from `public.users` and remove all source references listed in the Impact Map (auth-service.ts, types.ts, AuthNavigator.tsx, HomeGymSelectionScreen.tsx, test files, i18n catalogs).

---

## Key Implementation Notes

- Apple Sign-In must be visually equivalent to Google Sign-In (not smaller or hidden) per App Store review guidelines — this is a hard App Store requirement.
- Session is stored locally by the Supabase client singleton (`src/lib/supabase.ts`); never call `createClient()` at individual call sites.
- `privacy_setting` defaults to `public`. When set to `followers_only`, all downstream modules (MOD-004 send history, MOD-005 beta video listings, MOD-008 profile stats) must respect this via RLS policies or RPC guards — MOD-001 owns the column, downstream modules enforce it.
- `beta_video_privacy` defaults to `public`. MOD-001 owns the write via a public service function (e.g., `updateBetaVideoPrivacy(value)`). MOD-010's SettingsScreen calls this function for AC-157. MOD-005's AC-158 filter reads this value via the existing `fetchBetaVideosForRoute` poster join (AC-144). MOD-001 does not import from MOD-005; MOD-005 reads auth via `lib/supabase` directly — no circular dependency.
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
- **Own-videos grid on ProfileScreen (AC-164)**: Import `BetaVideoGrid` and `fetchBetaVideosByUser` from `mod-beta-video`. This is a cross-module import of a public component and service per the Cross-Module Imports convention. MOD-005 does not import from MOD-001 for this feature — it uses `supabase.auth.getSession()` from `lib/supabase` directly, so there is no circular dependency despite the mutual dependency edge.
- **Logout removal (AC-167)**: Remove the Logout `Pressable` / button from the `ProfileScreen` `listFooterComponent`. The `signOut()` call and error-handling pattern move entirely to MOD-010's SettingsScreen (AC-168). The session-ending behavior is unchanged.

---

## Out of Scope for This Module

- Android configuration (Phase 2).
- Official gym partnerships and route-setter account types (Phase 3).
- Per-user grade system selection (Phase 1 forces V-scale).
- In-app admin UI (Supabase Studio only for Phase 1).
- User-editable grade overrides on send logs (grade always comes from `Route.grade`).
- Payments, subscriptions, or monetization.
- Saved gyms (owned by MOD-012 — the `SavedGym` join table replaces the removed `home_gym_id` field).
- Logout control on the Profile screen (removed per AC-167; moved to MOD-010 SettingsScreen per AC-168).
