# MOD-012: Home — Spec

**Module ID**: MOD-012
**Module Name**: Home
**Phase**: 1
**Dependencies**: MOD-001, MOD-002, MOD-003 (saved_routes / route-visit data and route detail navigation for the Projecting Routes section, AC-177/AC-178; shared route card thumbnail source `photo_url`, AC-183), MOD-006 (followed-climbers activity for the Following section, AC-182), MOD-007 (NotificationInboxScreen + unread-count for the global-header bell, AC-184)
**Last Synced from PRD Revision**: 48

---

## Purpose

Own the persistent three-tab bottom navigation shell (Home / Gyms / Profile) and the Home tab surface. The Home surface renders four sections in order — (1) a single admin-managed Events Banner (AC-112/AC-174), (2) the user's Saved Gyms strip (AC-113/AC-114/AC-115), (3) the user's Projecting Routes section sourced from `saved_routes` with V-grade filter tabs (AC-177/AC-178), and (4) a Following activity section with one row per followed climber who has uploaded or replaced at least one beta video — showing a fixed "new video upload" label and the climber's most-recent beta-video activity time computed as `MAX(updated_at)` across their beta videos (AC-182) — and provides navigation from those sections into the gym route list, route detail, and user profile surfaces. Own the global app-level header rendered on all screens except the fullscreen beta-video reel viewer (AC-133) and auth/signed-out screens — left side = screen title or back button, right side = bell and settings icon together as a group, bell wiring to MOD-007's inbox, settings navigating to MOD-010's SettingsScreen; AppHeaderContext pattern applies (AC-184); the shared route card component (88pt standard / 64pt compact thumbnail right-aligned via `size` prop, tape badge showing route grade via `src/lib/tape.ts`, `betaVideoCount` subtitle, `hasSend`/`sendStyle` flash/top badge, interactive bookmark via `isSaved`/`onBookmarkToggle` props, no plain-text grade label, "new beta video" chip removed — AC-183/189/190/191/192, Rev 39/40/41), consumed by the Home Projecting section, RouteListScreen, and the profile send-history section; and the swipe left-to-right back gesture on all screens that have a back icon (AC-185). Own the `src/components/` app-level shared presentational component directory (RouteCard, SwipeBackWrapper).

---

## Context

Climbers who train at multiple gyms need quick access to all their saved gyms without a single fixed home gym. Climbers connected to the local scene want a landing surface that surfaces the gyms, routes, and people most relevant to them. Send It's Home screen addresses these needs by displaying (in fixed order): an admin-managed Events Banner (the section is never fully hidden in Phase 1 — when no active banner exists a visible placeholder card is shown, AC-112), saved gyms (from the `saved_gyms` join table, ordered by most-recently-viewed via `user_route_visits`, AC-175), the user's Projecting Routes (from `saved_routes`, with V-grade tabs, AC-177), and a Following activity section with one row per followed climber who has uploaded or replaced at least one beta video — showing avatar, `display_name`, a fixed "new video upload" label (i18n key `home.following.newUpload`), and the relative timestamp of the climber's most recent beta-video activity computed as `MAX(updated_at)` across their beta videos (AC-182). The app is organized around a persistent three-tab bottom navigation shell (Home, Gyms, Profile), with the Home tab as the default landing screen after login. The former Following Climbers strip (AC-123/AC-124) is replaced by the Following activity section (AC-182). A global app-level header is rendered on all screens except the fullscreen beta-video reel viewer and auth/signed-out screens (AC-184); the header layout has the screen title or back button on the left, and the notification bell and settings icon together as a group on the right; the bell wires to MOD-007's NotificationInboxScreen and carries an unread-count badge sourced from MOD-007's UnreadCountProvider context.

**US-019** (Save multiple gyms for quick access):
As a climber who trains at more than one gym, I want to bookmark any gym and have all my saved gyms available from the Home screen, so that I can quickly jump to the gyms I care about without a single fixed home gym.

**US-020** (See my saved gyms and followed climbers on a Home screen):
As a climber connected to the local scene, I want a Home screen that shows an announcement banner, my saved gyms, my projecting routes, and the activity of the climbers I follow, so that I have a single landing surface that surfaces the gyms, routes, and people most relevant to me.

**US-001** (Sign up and start using the app) applies implicitly because AC-001 (revised) specifies that on first run the app navigates the user directly to the Home tab — the Home tab is the default landing screen.

**Non-goals for this module:**
- A full chronological activity feed on the Home screen — that is MOD-006's surface (deferred Phase 2, AC-159).
- The `saved_gyms` write operations (INSERT/DELETE) — owned by MOD-002.
- The gym detail screen — owned by MOD-002.
- The profile screen — owned by MOD-001.
- The notification inbox screen contents — owned by MOD-007.
- Cities other than Taipei and New Taipei (Phase 1 scope).
- Android support (Phase 2).

---

## Related User Stories

- US-019
- US-020

---

## Acceptance Criteria Covered

**AC-110** (new): The system shall present a persistent bottom tab bar with three icon-only tabs: Home (house icon), Gyms (climb icon), and Profile (person icon). The Home tab is the default tab after login.

**AC-111** (revised, Rev 35): The Home screen shall render four sections in the following order: (1) Events Banner (AC-112), (2) Saved Gyms (AC-113), (3) Projecting Routes (AC-177), and (4) Following activity (AC-182). Any section with no content applies its own empty-state or hidden behavior as defined in its AC; the ordering of the sections that do render is fixed as listed.

**AC-112** (revised, Rev 38): The Events Banner section shall display exactly one banner at a time — a single, admin-managed banner whose content is sourced per AC-174. When the `admin_banners` store returns no active rows (no active banner is defined), the section shall render a visible placeholder card — a surface/gray-colored card with a centered "No active events" label styled in `theme.colors.textSecondary` — rather than hiding. The Events Banner section is never fully hidden in Phase 1. The placeholder label uses the bilingual i18n key `home.banner.noEvents` ("目前沒有活動" / "No active events"). This supersedes the Rev 35 "the section shall be hidden" behavior for the empty state.

**AC-113** (new): The Saved Gyms section shall display a horizontal scroll strip of the current user's saved gyms, each showing the gym's `photo_url` and name. A "View All" control shall navigate to the full gym list (MOD-002).

**AC-114** (revised, Rev 35): Tapping a gym in the Saved Gyms strip shall navigate the user directly to that gym's RouteListScreen (MOD-003), passing the gym context (gym ID and gym name). This supersedes the prior tab-switch-only behavior (Phase 1 originally switched to the Gyms tab without a deep link).

**AC-115** (new): When the current user has no saved gyms, the Saved Gyms section shall display the prompt: "Tap the bookmark on any gym to save it."

**AC-123** (removed, Rev 35): The former Following Climbers horizontal strip is replaced by the Following activity section (AC-182). This AC ID is retired and intentionally not reused.

**AC-124** (removed, Rev 35): The former Following Climbers empty-state criterion is superseded by the Following activity section's empty-state behavior (AC-182). This AC ID is retired and intentionally not reused.

**AC-174** (new, Rev 35): The Events Banner content (AC-112) shall be sourced from an admin-managed store — either the `app_settings` table or a dedicated admin banner table — with row-level security that allows read access to all authenticated users and write access to admins only. The banner content is created and edited by the admin via Supabase Studio in Phase 1; there is no in-app banner-authoring UI. **This introduces an admin-managed content source and requires Tech Lead architecture review** (table choice — `app_settings` vs. dedicated banner table — schema, read-all / write-admin-only RLS, and owning module) before Doc-Sync/Engineering implements it.

**AC-175** (new, Rev 35): The Saved Gyms section (AC-113) shall order the user's saved gyms by most-recently-viewed first. Ordering is derived from the user's own view/visit activity and shall not use GPS or device location. When recency data is unavailable for a saved gym, that gym shall still appear in the strip (ordered after gyms that do have recency data).

**AC-176** (new, Rev 35): Tapping a gym in the Saved Gyms strip shall navigate the user directly to that gym's RouteListScreen (MOD-003), passing the gym context (gym ID and gym name). (This is the same navigation contract as the revised AC-114; AC-176 states it as a standalone criterion for the Saved Gyms interaction.)

**AC-177** (new, Rev 35): The Home screen shall render a Projecting Routes section sourced from the current user's `saved_routes` (MOD-003). The section shall provide V-grade filter tabs that filter the displayed projecting routes by grade. Each projecting route shall be shown using the shared route card (AC-183). When the user has no saved routes, the section shall display an appropriate empty state.

**AC-178** (new, Rev 35): Tapping a projecting route card in the Home Projecting Routes section (AC-177) shall navigate the user to that route's detail screen (RouteDetailScreen, MOD-003), passing the route identifier.

**AC-181** (revised, Rev 39): The shared route card (AC-183) shall no longer render a "new beta video" chip. The `hasNewBetaVideo` prop is removed from the route card's props and no "new beta video" chip is rendered on any surface that uses the card (the Home screen's Projecting Routes section, AC-177; and the gym route list, RouteListScreen, MOD-003). The underlying per-user route-visit data (`user_route_visits`, AC-179) and the `fetchRoutesWithNewBeta` service remain unchanged in the codebase — they are still needed for the most-recently-viewed Saved Gyms ordering (AC-175). (This supersedes the Rev 35 "new beta video" tag rendering: the chip is removed from the card UI while the backing infrastructure is retained.)

**AC-182** (revised, Rev 38): The Home screen shall render a Following activity section with one row per followed climber (sourced from MOD-006) who has uploaded or replaced at least one beta video. Each row shows the climber's avatar, `display_name`, a fixed label "new video upload" (i18n key `home.following.newUpload`, "新影片上傳" / "new video upload") — **no video count is displayed** — and the relative timestamp of that climber's most recent beta-video activity, computed as `MAX(updated_at)` across all of that climber's beta videos (AC-188). Tapping a row shall navigate the user to that climber's `UserProfileScreen` (MOD-006). When the current user follows no one, or no followed climber has any beta video, the section shall display an appropriate empty state. This supersedes the Rev 35 per-user "X new beta video(s)" count design and replaces the former Following Climbers strip (AC-123/AC-124, removed). **Tech Lead review required** — the query now uses `updated_at` (not `created_at`) with a `MAX(updated_at)` aggregate per followed climber.

**AC-183** (new, Rev 35; updated Rev 39): The system shall provide a shared route card component that renders a route with a fixed square thumbnail on the right sourced from the route's existing `photo_url` field (no schema change; thumbnail 80×80, AC-192). The shared route card shall be used in the Home screen's Projecting Routes section (AC-177), the gym route list (RouteListScreen, MOD-003), and the profile send-history section (MOD-008). The card's prop interface as of Rev 39: `betaVideoCount: number` (default 0, AC-189), `hasSend: boolean` (default false, AC-190), `sendStyle: 'flash' | 'top' | null` (default null, AC-190), `isSaved: boolean` (default false, AC-046/047), `onBookmarkToggle: () => void` (AC-046/047), `grade: string` (retained for a11y, not rendered, AC-191). The "new beta video" chip is removed (AC-181, Rev 39). **This is a shared cross-module component and requires Tech Lead architecture review to assign the owning module** (and the consuming modules' import contract) before Doc-Sync/Engineering implements it.

**AC-184** (revised, Rev 41): The system shall render a global app-level header on all screens EXCEPT the fullscreen beta-video reel viewer (AC-133) and the auth/signed-out screens. The header layout is: **left side** = the screen title or a back button (contextual, per screen); **right side** = the notification bell and the settings icon rendered together as a group — bell wired to MOD-007's `NotificationInboxScreen` (AC-171, carrying the unread-count badge per AC-173), settings icon navigating to MOD-010's SettingsScreen. The notification bell and settings icon always appear together on the right; neither appears on the left. **This is an app-level, cross-cutting UI surface and requires Tech Lead architecture review to assign the owning module** (proposed: MOD-012 per `AppHeaderContext` convention — see `src/lib/AppHeaderContext.ts`; screens use `useAppHeader()`; overlays use `AppHeaderOverlayScope`; AppShell root uses `useAppHeaderRoot()`; direct prop-drilling prohibited) and specify where the header mounts relative to the tab shell and each navigator, before Doc-Sync/Engineering implements it.

**AC-185** (new, Rev 35): The system shall support a swipe left-to-right back gesture on every screen that displays a back icon; the gesture shall perform the same navigation-pop action as tapping that screen's back control. This is a behavioral requirement only — the implementation library/approach is deferred to the Tech Lead and recorded in `production.md`. **This is a cross-cutting navigation behavior and requires Tech Lead architecture review to assign the owning module** and choose the gesture implementation approach before Doc-Sync/Engineering implements it.
**AC-189** (new, Rev 39, MOD-012 shared route card — MOD-003 owns RPC + migration + service wrapper): The shared route card (AC-183) shall accept a `betaVideoCount: number` prop (default `0`). When `betaVideoCount > 0`, the card shall render a subtitle line reading "{count} Beta Videos" (i18n key `routeCard.betaCount`, with `{{count}}` interpolation). When `betaVideoCount === 0`, no subtitle line is rendered. Callers (RouteListScreen in MOD-003, HomeScreen in MOD-012) are responsible for fetching and passing this count; the card itself does not fetch it. The count shall be fetched in a single batched call for all visible routes, not per-card (no N+1 lookup), consistent with the §10 batched-reads convention. **Implementation (Rev 40)**: callers reuse MOD-003's `fetchBetaVideoCounts(routeIds)` wrapper (which calls the `count_beta_videos_by_routes` SECURITY INVOKER RPC owned by MOD-003). Callers must NOT use a client-side `.in('route_id', ids)` + JS count reduce — the count must respect the AC-142/154/158 visibility fence.

**AC-190** (new, Rev 39, MOD-012 shared route card): The shared route card (AC-183) shall accept a `hasSend: boolean` prop (default `false`) and a `sendStyle: 'flash' | 'top' | null` prop (default `null`). When `hasSend` is `true`, the card shall render a single small "send" badge: if `sendStyle === 'flash'` a flash badge (gold color), and if `sendStyle === 'top'` a top badge (green/success color). Only one badge is shown at a time (the highest-priority one). "Has sent" means the user has flashed or topped the route (an attempt does not count as a send). Callers fetch the current user's ascents via MOD-004's existing service and derive `hasSend` and `sendStyle` client-side. **Implementation (Rev 40)**: callers reuse MOD-004's existing `fetchUserAchievements(routeIds)` (already in `send-service.ts`) — already batched, user-scoped via an explicit `.eq('user_id', …)` predicate, and enforces flash > top precedence client-side. No new RPC or migration is needed. RouteListScreen and HomeScreen both call it once per load and derive `hasSend` / `sendStyle` per `route_id`. (i18n keys `routeCard.flashSend` / `routeCard.topSend`.)

**AC-191** (revised, Rev 41, MOD-012 shared route card): The shared route card (AC-183) shall display the route's grade on the tape badge (the colored chip rendered using the shared `TapeBadge` component from `src/lib/tape.ts`). The plain-text grade `<Text>` label (the standalone rendered grade string, separate from the badge) shall NOT be rendered in the card UI. The `grade: string` field remains on the card's `RouteCardRoute` interface (retained for accessibility-label composition and for supplying the tape badge). Grade is conveyed visually through the tape badge only — not through a separate plain-text label. (This reverts the Rev 39 "grade hidden" decision: the grade is now shown via the TapeBadge, not via a plain `<Text>` element.)

**AC-192** (revised, Rev 41, MOD-012 shared route card): The shared route card (AC-183) shall accept a `size?: 'standard' | 'compact'` prop (default `'standard'`). In `'standard'` variant the thumbnail (sourced from the route's `photo_url` per AC-183) shall be **88pt × 88pt**; in `'compact'` variant it shall be **64pt × 64pt**. Callers in tight layouts (e.g. send-history) may use `compact`. The card layout shall be: left side = the tape badge (AC-191, displaying the route grade), the route name, the beta-count subtitle (when present, AC-189), the send badge (when `hasSend`, AC-190), and the bookmark icon (AC-046/AC-047); right side = the thumbnail at the size appropriate to the `size` prop. All icons and metadata are grouped on the left side of the card only, not scattered around the card.

**AC-200** (revised, Rev 48, MOD-012 as project files owner; cross-cutting): The app shall be published and identified as "ProjectDay":

(1) **App Store Connect**: the app name shall be "ProjectDay" and the subtitle shall be "Route Tracker & Beta Sharing" (28 characters; App Store Connect allows at most 30). Both values live in App Store Connect, not in the repository, so Leon checks (1) there once the App Store Connect record exists (setup.md 11.5); QA does not test it.

(2) **Repository identifiers**: every app-name identifier in the repository (Expo app name, slug and scheme, iOS bundle identifier, package name, native project names, and code identifiers, comments and documentation) shall use "ProjectDay", or "projectday" where the identifier format does not allow capital letters. The exact values are:
- Expo `name`: `ProjectDay`
- Expo `slug`: `projectday`
- Expo `scheme`: `projectday`
- `ios.bundleIdentifier`: `com.projectday.bouldering`
- `package.json` `name`: `projectday`
- `extra.eas.projectId`: the real EAS project UUID from setup.md 11.4. The current value, `send-it-tw-bouldering-app`, is not a UUID and does not meet this criterion.

(3) **Compliance check**: run at the repository root, the command `git grep -n -i -E "send it|send-it|send_it|sendit" -- . ':!project-planning' ':!README.md'` shall print only lines covered by the four exemptions below. The command searches tracked files only, so `node_modules/`, `ios/Pods/`, `ios/build/` and untracked files are outside the check. `README.md` is renamed at the final checkpoint.
- **Exempt (a)**: migration files under `supabase/migrations/` committed before Rev 47 (commit `1e7f073`), and the one MOD-002 gym-notes rename migration. Applied migrations are never edited, and the rename migration has to name the old text to find it.
- **Exempt (b)**: the path token `send-it-design`, which names an external design repository that this repository does not own. It appears in `src/lib/theme.ts`, `.storybook/MIGRATION.md` and the five design-team agent files. The prose around these paths is still renamed.
- **Exempt (c)**: the English verb phrase "send it back" in the 12 `qa-mod-*` agent files. It is framework template wording, not the app name.
- **Exempt (d)**: the phrase "Send It design team" in the five design-team agent files (`design-lead.md`, `ui-designer.md`, `ux-designer.md`, `ux-researcher.md`, `motion-designer.md`). Those files are outside Doc-Sync's generated set and their internal team-name phrase is exempt from the check.

The check is run only after Leon has renamed the repository folder (setup.md 11.8) and Doc-Sync has run `"template refresh"` to regenerate the 24 engineer and QA agent files.

The climbing verb "send" and identifiers built on it (for example `mod-send-logging`, `send-service.ts`) are not the app name and are unchanged. The new bundle identifier means a new App Store Connect app record, which Leon has accepted.

**Ownership** (Tech Lead change review, 2026-10-21): each row that names a module is part of that module's work for AC-200 (and AC-199 where marked).

| Owner | Files / scope |
|---|---|
| MOD-012 `engineer-mod-home` | `app.json`: `name`, `slug`, `ios.bundleIdentifier`, add `"scheme": "projectday"`, real EAS `extra.eas.projectId` UUID, `photosPermission` copy. `package.json` and `package-lock.json` (name `projectday`). `ios/` regenerated with `expo prebuild --clean` and `pod install` (`SendIt*` becomes `ProjectDay*`). `app.plugin.js`: must strip `aps-environment` from the entitlements, because the Apple Developer account is not active. `.storybook/MIGRATION.md` prose (keep the `send-it-design` path token). `src/lib/theme.ts:2,18` (comments only; keep the `send-it-design` path token). `src/components/ui/Stepper.tsx:38` (`ACCESSORY_ID`). `src/components/ui/ListRow.tsx:21`. `src/components/ui/stories/AppText.stories.tsx:12`. `src/components/ui/stories/ListRow.stories.tsx:73`. `src/modules/mod-home/components/__tests__/AppHeader.test.tsx:11` (stale comment). `.env.example:2` header. Lands first, together with MOD-001, because the scheme change spans both. Native Build Gate required. |
| MOD-001 `engineer-mod-auth-profile` | `src/modules/mod-auth-profile/auth-service.ts:142`: `'send-it'` becomes `'projectday'`. `__tests__/auth-service.test.ts:46` mock becomes `'projectday://auth'`. Same commit batch as MOD-012. |
| MOD-010 `engineer-mod-localization-theme` | `locales/en/common.json:3` and `locales/zh-TW/common.json:3` (`app.name` becomes "ProjectDay" in both). `src/modules/mod-localization-theme/stories/Tokens.stories.tsx:87`. Carries AC-199. Independent of the other owners. |
| MOD-007 `engineer-mod-notifications` | `supabase/functions/notify-beta-video-like/index.ts:185` (push title "ProjectDay"). Needs redeployment. Part of AC-199. |
| MOD-009 `engineer-mod-moderation` | `supabase/functions/report-digest/index.ts:114` (email header "ProjectDay — Open Report Digest"). Needs redeployment. Part of AC-199. |
| MOD-002 `engineer-mod-gym-directory` | New migration `supabase/migrations/<ts>_mod_002_rename_projectday_gym_notes.sql`: `UPDATE gyms SET notes = replace(notes, 'Send It', 'ProjectDay') WHERE notes LIKE '%Send It%'` (safe to re-run; never edit `20260920000002`). `GymDetailScreen.test.tsx:77,118`. Needs `supabase db push`. Part of AC-199. |
| Tech Lead | `.gitignore`: adds a `scratchpad/` entry. The header comment was already renamed in commit `9c2da95`. |
| Doc-Sync | `production.md` app name. The 24 generated engineer and QA agent files, regenerated with `"template refresh"` after Leon renames the folder (setup.md 11.8). They are never hand-edited. |
| Leon | Supabase dashboard, Google consent screen, Expo project, Apple Developer / App Store Connect, folder rename (setup.md section 11). Deletes `PRD_TW_Bouldering_App.md` and `scratchpad/` in a `human:` commit. |
| Out of scope | Supabase and PostHog project names. `README.md` (final checkpoint). `project-planning/`. |

---

## Requirements

- The app shall present a persistent bottom tab bar with three icon-only tabs: Home (house icon), Gyms (climb icon), Profile (person icon). The Home tab is the default tab after login (AC-110).
- The Home screen shall render four sections in order: Events Banner, Saved Gyms, Projecting Routes, Following activity (AC-111).
- The Events Banner section shall display exactly one admin-managed banner at a time sourced per AC-174. When no active banner is defined, the section shall render a visible placeholder card — a surface/gray-colored card with a centered "No active events" label styled in `theme.colors.textSecondary` (i18n key `home.banner.noEvents`, "目前沒有活動" / "No active events"). The section is never fully hidden in Phase 1 (AC-112).
- The Saved Gyms section shall display a horizontal scroll strip of the current user's saved gyms, each showing the gym's `photo_url` and name, ordered by most-recently-viewed first (AC-175). A "View All" control shall navigate to the full gym list (MOD-002) (AC-113).
- Tapping a gym in the Saved Gyms strip shall navigate the user directly to that gym's RouteListScreen (MOD-003), passing the gym context (AC-114, AC-176).
- When the current user has no saved gyms, the Saved Gyms section shall display the prompt: "Tap the bookmark on any gym to save it." (AC-115).
- The Home screen shall render a Projecting Routes section from `saved_routes` (MOD-003) with V-grade filter tabs; each route uses the shared route card (AC-183) — with `betaVideoCount` (AC-189), `hasSend`/`sendStyle` (AC-190), `isSaved`/`onBookmarkToggle` (AC-046/047), tape badge showing grade via `TapeBadge` (AC-191), 88pt standard / 64pt compact thumbnail via `size` prop (AC-192), and no "new beta video" chip (AC-181, Rev 39) — (AC-177).
- Tapping a projecting route card shall navigate to that route's RouteDetailScreen (MOD-003) (AC-178).
- The Home screen shall render a Following activity section with one row per followed climber who has uploaded or replaced at least one beta video. Each row shows the climber's avatar, `display_name`, a fixed label "new video upload" (i18n key `home.following.newUpload`), and the relative timestamp of that climber's most recent beta-video activity computed as `MAX(updated_at)` across their beta videos (AC-188). Tapping a row navigates to that climber's UserProfileScreen (MOD-006). Appropriate empty state when no followed climbers have any beta video (AC-182).
- The system shall render a global app-level header on all screens except the reel viewer and auth/signed-out screens. The header layout: left side = the screen title or back button (contextual); right side = the notification bell and the settings icon together as a group — bell wired to MOD-007 NotificationInboxScreen (with unread-count badge per AC-173), settings icon navigating to MOD-010 SettingsScreen. The AppHeaderContext pattern applies (`src/lib/AppHeaderContext.ts`; screens use `useAppHeader()`; overlays use `AppHeaderOverlayScope`; AppShell root uses `useAppHeaderRoot()`; direct prop-drilling prohibited) (AC-184).
- The system shall support a swipe left-to-right back gesture on every screen with a back icon (AC-185).
- The shared `RouteCard` component and `SwipeBackWrapper` component live at `src/components/` (owned by MOD-012) (AC-183, AC-185).

---

## Input / Output Contract

**Input:**
- Authenticated session (`user_id`)
- Saved gyms list (via `SELECT saved_gyms JOIN gyms WHERE user_id = auth.uid()`, ordered by most-recently-viewed using `user_route_visits` — owned by MOD-003)
- Projecting routes list (via `SELECT saved_routes JOIN routes WHERE user_id = auth.uid()`, owned by MOD-003)
- "New beta video" qualification set (via MOD-003's `routes_with_new_beta` RPC, AC-180; note: the "new beta video" chip is removed from the card per AC-181 Rev 39, but the RPC is retained for AC-175 Saved Gyms ordering)
- Beta video counts per route (via MOD-003's `fetchBetaVideoCounts(routeIds)` wrapper calling `count_beta_videos_by_routes` RPC, AC-189 Rev 39/40; batched once per screen load; passed as `betaVideoCount` to the shared route card)
- Per-route send achievement state (via MOD-004's `fetchUserAchievements(routeIds)` from `send-service.ts`, AC-190 Rev 40; batched once per screen load; derive `hasSend`/`sendStyle` per route_id and pass to shared route card)
- Saved route state (via `fetchSavedRouteIds(visibleRouteIds)` from MOD-003's `route-service.ts`, AC-046/047 Rev 39; passed as `isSaved` + `onBookmarkToggle` to the shared route card)
- Admin banner content (via `admin_banners` table per AC-174 — read-all SELECT, admin-only writes)
- Follow list activity (via MOD-006's public service for the Following activity section — returns followed climbers with at least one beta video, with `MAX(updated_at)` per climber, AC-182/AC-188)
- Unread notification count (via MOD-007's UnreadCountProvider context, AC-173/AC-184)

**Output:**
- Rendered Home screen (Events Banner — active banner card or "No active events" placeholder card (AC-112); Saved Gyms strip; Projecting Routes with V-grade tabs; Following activity section)
- Rendered persistent three-tab bottom navigation bar
- Rendered global app-level header (bell + unread-count badge + settings control) on all non-exempt screens
- Navigation events to RouteListScreen (MOD-003, AC-114/AC-176), RouteDetailScreen (MOD-003, AC-178), UserProfileScreen (MOD-006, AC-182), NotificationInboxScreen (MOD-007, AC-184), SettingsScreen (MOD-010, AC-184), GymNavigator (Tab 2, MOD-002), ProfileNavigator (Tab 3, MOD-001)

---

## Dependencies

- MOD-001 (ProfileNavigator entry point mounted as Tab 3; ProfileScreen no longer owns bell+settings — those moved to MOD-012 global header per AC-184)
- MOD-002 (GymNavigator entry point mounted as Tab 2; "View All" gyms navigation)
- MOD-003 (saved_routes data and RouteDetailScreen navigation for Projecting Routes section, AC-177/AC-178; `routes_with_new_beta` RPC for new-beta tag, AC-180/AC-181; most-recently-viewed gym ordering via `user_route_visits`, AC-175)
- MOD-006 (followed-climbers activity data for the Following activity section, AC-182)
- MOD-007 (NotificationInboxScreen navigation target for global-header bell, AC-184; UnreadCountProvider context for unread-count badge, AC-173)

---

## Integration Points

1. **AppShell mounts MOD-002's GymNavigator (Tab 2)**: MOD-002 engineer must expose `GymNavigator` as a public entry-point component. MOD-012 engineer implements `AppShell` and imports `GymNavigator`. MOD-002 engineer must confirm the navigator entry point is exposed before MOD-012 QA handoff.

2. **AppShell mounts MOD-001's ProfileNavigator (Tab 3)**: MOD-001 engineer must expose a `ProfileNavigator` entry-point component. MOD-012 engineer imports and mounts it. MOD-001 engineer must confirm the navigator entry point is exposed before MOD-012 QA handoff. Note: MOD-001's ProfileScreen header no longer contains the bell or settings icon — those are now on the MOD-012 global header per AC-184.

3. **Saved Gyms strip reads `saved_gyms` table**: MOD-012 engineer implements the read query (`SELECT saved_gyms JOIN gyms WHERE user_id = auth.uid()`) in `mod-home/home-service.ts`. Most-recently-viewed ordering is derived from MOD-003's `user_route_visits` table (per AC-175) — MOD-012 reads this table via a join or RPC owned by MOD-003. The write operations (INSERT/DELETE) on `saved_gyms` are owned by MOD-002.

4. **Projecting Routes section reads `saved_routes` via MOD-003**: MOD-012 must call MOD-003's public service to retrieve the current user's saved routes (with route data). MOD-012 must never query the `saved_routes` table directly — that read must go through MOD-003's service. MOD-003 must be implemented before MOD-012 QA.

5. **New-beta tag qualification via MOD-003's `routes_with_new_beta` RPC**: MOD-012 calls MOD-003's `routes_with_new_beta(route_ids uuid[])` RPC (AC-180) once per screen load to determine which route cards display the new-beta tag (AC-181). MOD-012 must not implement this logic independently — it reads from MOD-003's RPC.

6. **Following activity section reads followed-climbers activity via MOD-006 public service**: MOD-012 must call MOD-006's public service to retrieve the following-activity data (avatar + display_name + `MAX(updated_at)` per climber). MOD-012 must never query the `follows` table directly — that read must go through MOD-006's service to respect block-filtering composition (AC-082/AC-084). MOD-006 must be implemented before MOD-012 QA.

7. **Global header bell wires to MOD-007's NotificationInboxScreen and UnreadCountProvider**: MOD-007 must expose `NotificationInboxScreen` as a navigable target and `UnreadCountProvider` as a React context. MOD-012 mounts `UnreadCountProvider` inside `AppShell` wrapping the global header. The global header subscribes to `unreadCount` for the badge value. `NotificationInboxScreen` calls `refresh()` on the provider after the AC-172 batch mark-read. MOD-007 must be implemented before MOD-012 QA for this integration.

8. **Shared route card component (`src/components/RouteCard.tsx`) consumed by MOD-003 RouteListScreen and MOD-008 send-history section**: MOD-012 owns the file at `src/components/RouteCard.tsx`. Both MOD-003 and MOD-008 import it via the app-level path per the App-Level Shared Presentational Components convention in production.md. MOD-012 must ship `RouteCard` before MOD-003 and MOD-008 QA handoff for any surface that uses it.

---

## Data Model (relevant tables)

```
SavedGym  (join table — a user's bookmarked gyms)
 - user_id (FK User, ON DELETE CASCADE), gym_id (FK Gym, ON DELETE CASCADE),
   created_at
 - PK: (user_id, gym_id)

admin_banners  (admin-managed Events Banner content — NEW, requires Tech Lead review)
 - schema TBD pending Tech Lead architecture review (AC-174)
 - RLS: read-all authenticated SELECT; admin-only INSERT/UPDATE/DELETE (public.is_admin())
 - Owned by MOD-012 pending Tech Lead review confirmation
```

MOD-012 owns the `SavedGym` DDL. The table is created in the MOD-012 migration file (e.g., `20260924000001_mod_012_home.sql`). This migration must run after migrations 001 (users) and 002 (gyms) since both FKs reference them.

RLS policy set for `saved_gyms`:
- SELECT `saved_gyms_select_own`: `USING (user_id = auth.uid())`
- INSERT `saved_gyms_insert_own`: `WITH CHECK (user_id = auth.uid())` (used by MOD-002 write operations)
- DELETE `saved_gyms_delete_own`: `USING (user_id = auth.uid())` (used by MOD-002 write operations)
- No UPDATE policy (unsave = DELETE, not UPDATE)

Grants: `GRANT SELECT, INSERT, DELETE ON public.saved_gyms TO authenticated;` (no UPDATE, no anon).

The composite PK `(user_id, gym_id)` is the only index needed — the leading `user_id` column covers the `WHERE user_id = auth.uid()` filter for the Home strip query.

---

## Key Implementation Notes

- `AppShell` lives in `src/modules/mod-home/AppShell.tsx`. `App.tsx` imports and renders `AppShell`. Tab state: `type TabKey = 'home' | 'gyms' | 'profile'`. State lives in `AppShell` as `const [activeTab, setActiveTab] = useState<TabKey>('home')`. Default is `'home'` (AC-110).
- Keep-alive mount: render all three tab subtrees simultaneously. Wrap each in a `View` whose style toggles `display: activeTab === key ? 'flex' : 'none'`. Do NOT use conditional unmount. Do NOT use `flex: 0`.
- Bottom safe area: the `TabBar` component calls `useSafeAreaInsets()` and applies `paddingBottom: insets.bottom` plus a spacing token.
- **Global app-level header (AC-184, revised Rev 41)**: The global header is mounted at the `AppShell` level, rendering above the tab-content area on all screens except the fullscreen reel viewer (AC-133) and auth/signed-out screens. Header layout: **left side** = the screen title or a back button (contextual, per screen); **right side** = the notification bell and the settings icon rendered together as a group. The bell carries the unread-count badge sourced from `UnreadCountProvider` (MOD-007-owned context). Tapping the bell navigates to MOD-007's `NotificationInboxScreen`. Tapping the settings icon navigates to MOD-010's SettingsScreen. The `AppHeaderContext` pattern applies: screens consume header state via `useAppHeader()`; overlays suppress the header via `AppHeaderOverlayScope`; AppShell root registers via `useAppHeaderRoot()`; direct prop-drilling of header state is prohibited. Architecture review required before implementation to determine exact mount point relative to tab shell and individual navigators.
- **UnreadCountProvider (AC-173/AC-184)**: Mount `UnreadCountProvider` (owned by MOD-007) inside `AppShell` wrapping the global header. Do NOT read the `Notification` table directly from MOD-012 — subscribe only to the context value exposed by MOD-007.
- **Admin banner (AC-112/AC-174)**: The Events Banner reads from the `admin_banners` table (dedicated table with read-all SELECT per the Admin-Managed Content convention in production.md). When an active banner row exists, render the banner card. When no active banner row exists, render a visible placeholder card — a surface/gray-colored card with a centered `home.banner.noEvents` label styled in `theme.colors.textSecondary` ("目前沒有活動" / "No active events"). The section is never fully hidden in Phase 1. Do NOT hide the section when `admin_banners` returns no rows. Architecture review required for table schema/RLS before implementation.
- **Saved Gyms most-recently-viewed ordering (AC-175)**: Derive ordering from `user_route_visits` (owned by MOD-003) via a join on the route's `gym_id`. When a saved gym has no associated route visits, it still appears in the strip, ordered after gyms with recency data.
- **Projecting Routes section (AC-177)**: Source from `saved_routes` via MOD-003's public service. Filter displayed routes by V-grade via tab selector. Each route card uses `src/components/RouteCard.tsx`. The "new beta video" chip is removed from the card (AC-181, Rev 39) — do not pass `hasNewBetaVideo` to the card. Fetch `betaVideoCount` via MOD-003's `fetchBetaVideoCounts(routeIds)` once per load (AC-189). Fetch `hasSend`/`sendStyle` via MOD-004's `fetchUserAchievements(routeIds)` once per load (AC-190 Rev 40). Fetch `isSaved` state via `fetchSavedRouteIds(visibleRouteIds)` from MOD-003 once per load (AC-046/047 Rev 39). Pass all four as props to the shared route card.
- **Following activity section (AC-182/AC-188 — four-point `created_at` → `updated_at` swap)**: The `loadFollowingActivity` query in `HomeScreen.tsx` currently fetches `beta_videos` with `created_at` in four places. All four must be swapped to `updated_at` consistently — a partial swap produces a subtly wrong window that passes mocked unit tests:
  1. `.select('user_id, updated_at')` (was `created_at`)
  2. `.gte('updated_at', cutoff)` window filter (was `.gte('created_at', cutoff)`) — **this is the semantic point of Rev 38**: a video replaced within the last 14 days surfaces even if its original `created_at` is older
  3. `.order('updated_at', { ascending: false })` (was `created_at`)
  4. JS grouping: read `row.updated_at` and compare against `existing.latestAt` (was `row.created_at`)
  The displayed relative timestamp then derives from `latestAt` (now the max `updated_at`). The existing batched-fetch + JS-group pattern (no SQL `MAX()` / `GROUP BY`) is correct and must be preserved. Each row displays the fixed label `home.following.newUpload` ("新影片上傳" / "new video upload") — no video count. **Sequencing**: AC-188 (MOD-005 `beta_videos.updated_at` column + bump mechanism) must land before AC-182 HomeScreen query change — `updated_at` must exist and be bumped on replace for the `MAX(updated_at)` window to be meaningful.
- **Swipe-back gesture (AC-185)**: Implemented via RN core `PanResponder` in `src/components/SwipeBackWrapper.tsx` (per the Prefer RN PanResponder for Simple Swipe Gestures convention in production.md). Gate `onMoveShouldSetPanResponder` on a horizontal, rightward, edge-originating gesture (touch starts near the left edge, `evt.nativeEvent.pageX < ~30`) to avoid stealing horizontal-scroll gestures. Architecture review required before implementation to confirm wrap strategy and assign module ownership.
- **Shared route card (AC-183; redesigned Rev 39, revised Rev 41)**: `src/components/RouteCard.tsx` renders a route. Accepts a `size?: 'standard' | 'compact'` prop (default `'standard'`); `'standard'` thumbnail = 88pt × 88pt; `'compact'` thumbnail = 64pt × 64pt (AC-192). Left side: the tape badge (displaying the route grade via `TapeBadge` from `src/lib/tape.ts`, AC-191), route name, beta-count subtitle when `betaVideoCount > 0` (AC-189), flash/top send badge when `hasSend` (AC-190), bookmark icon via `isSaved`/`onBookmarkToggle` props (AC-046/047 Rev 39). Right side: the `photo_url` thumbnail at the size set by the `size` prop. Grade field (`grade: string`) remains on `RouteCardRoute` for a11y and for supplying the tape badge; the plain-text `<Text>` grade label is not rendered separately. The "new beta video" chip (`hasNewBetaVideo` prop) is removed entirely (AC-181 Rev 39). The component is pure/presentational — it takes data + callbacks as props. Consuming modules (MOD-003 RouteListScreen, MOD-008 send-history section) import via `src/components/RouteCard` per the App-Level Shared Presentational Components convention.
- Cross-module import rule: `mod-home` may import only public service functions and navigator entry-point components from other modules. For shared presentational components, use the `src/components/` app-level path.
- **i18n keys (Rev 39)**: The following i18n keys must be added to both `locales/en/common.json` and `locales/zh-TW/common.json` under the `routeCard` namespace, and the now-obsolete `home.routeCard.newBeta` key must be removed:
  - `routeCard.betaCount` — EN "{{count}} Beta Videos" / zh-TW "{{count}} 條路線影片"
  - `routeCard.saved` — EN "Saved" / zh-TW "已收藏"
  - `routeCard.unsaved` — EN "Save" / zh-TW "收藏"
  - `routeCard.flashSend` — EN "Flash" / zh-TW "閃送"
  - `routeCard.topSend` — EN "Top" / zh-TW "完攀"
  Remove: `home.routeCard.newBeta` (chip removed per AC-181, Rev 39).
- The `saved_gyms` migration (`20260924000001_mod_012_home.sql`) must include: table DDL, both FK constraints with ON DELETE CASCADE, the three RLS policies, RLS enabled, and the explicit GRANT.

---

## Out of Scope for This Module

- A full chronological activity feed (deferred to Phase 2, AC-159; owned by MOD-006).
- The `saved_gyms` INSERT/DELETE write operations (owned by MOD-002).
- The gym detail screen (owned by MOD-002).
- The profile screen content (owned by MOD-001).
- The send history surface (owned by MOD-008, embedded by MOD-001).
- The notification inbox screen contents (owned by MOD-007).
- Android support (Phase 2).
- Cities other than Taipei and New Taipei (Phase 1 scope).
- The bell and settings entry points on MOD-001's ProfileScreen header (those are removed per AC-184 and AC-171 revised; they now live on the MOD-012 global header only).
