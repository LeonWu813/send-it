# ProjectDay — Product Requirements Document

**Author**: Leon
**Status**: [SUBSTANTIVE] — Revision 48
**Date**: 2026-10-21
**Revision**: 48

---

## 1. Project Overview

**ProjectDay** is a Taiwan-first mobile app for indoor bouldering climbers. It gives climbers a fast way to log sends (route + grade + attempts + status), share and watch beta videos (short technique clips) tied to specific routes, browse what's currently set at the gyms they follow, and connect with other climbers in the local scene. The app is organized around a persistent three-tab bottom navigation shell — Home, Gyms, and Profile — with the Home tab as the landing screen after login. Rather than a single fixed home gym, each climber maintains a multi-gym saved list: they bookmark any gyms they care about and see them, alongside the climbers they follow, on the Home screen.

Indoor bouldering has grown fast in Taiwan — Taipei and New Taipei have the highest concentration of gyms, with more scattered across Taoyuan, Hsinchu, Taichung, Kaohsiung, Yilan, and Tainan — but climbers currently have no dedicated app that combines send logging, beta video sharing, live gym route lists, and local social features. Today this happens informally through PTT posts, Instagram/Threads stories, or word of mouth, or through global apps (Kaya, Vertical-Life, 27 Crags) that are outdoor-crag-centric, not localized for Taiwan gyms, and don't reflect local color-based tape conventions. One small local app (記石) exists but is log-only — no beta video, no cross-gym route database, no social layer.

ProjectDay's wedge is a lightweight, Taiwan-first version of Kaya's core loop — log, watch beta, see history — built on an admin-curated gym directory (so the app has real coverage on day one) plus a filter-first route submission flow with server-enforced duplicate protection that keeps user-submitted data clean without waiting on official gym partnerships.

---

## 2. Goals & Non-Goals

### Goals

- A new user can complete signup, save a gym, and log their first send in under 3 minutes end-to-end.
- Any climber can log a send in under 30 seconds and ≤4 taps from a known route page.
- Every gym in the seeded directory (Taipei + New Taipei branch-level) has a verified address and map pin before Phase 1 launch.
- Beta videos upload, transcode, and become playable in-app within 60 seconds of upload completion on a normal 4G/LTE connection.
- Week-4 retention of new signups is measurable via PostHog, with a Phase 1 target of ≥25%.
- At Phase 1 GA, at least 5 seeded gyms have ≥10 user-submitted routes each (content-density proxy).
- Beta-video like notifications deliver within 30 seconds of the like event on ≥95% of sends, for users with notifications enabled.

### Non-Goals

- Android support is out of scope for Phase 1 (planned for Phase 2).
- Outdoor crag / GPS topo guidebook is out of scope entirely (Kaya / 27 Crags own this space).
- Official gym partnerships, route-setter accounts, and gym-facing dashboards are out of scope for Phase 1 and Phase 2 (planned for Phase 3).
- Competition and league scoring are out of scope entirely.
- Training plans and workout logging are out of scope entirely (Crimpd's territory).
- Comments on sends or beta videos are out of scope for Phase 1 (revisit in Phase 2 only if community asks and moderation tooling is ready).
- Likes on plain send logs (non-beta) are out of scope for Phase 1.
- Push notifications for events other than beta-video likes are out of scope for Phase 1 (expanded in Phase 2).
- No admin push or email notification for beta-video reports in Phase 1 — the admin reviews reported videos manually in Supabase Studio only. Video reports are explicitly excluded from the AC-085 6-hourly email digest, which remains `Report`-table only (user-profile and beta-video content reports filed via AC-080), and does not include the `VideoReport` table.
- Offline send queueing is out of scope for Phase 1 — Phase 1 must show a clear error message rather than silently fail (planned for Phase 2).
- User-created gyms are out of scope for Phase 1 — missing gyms are captured via a "request a gym" form only.
- User-editable grade overrides are out of scope for Phase 1 — the gym's posted grade is the source of truth.
- Per-user grade systems other than V-scale are out of scope for Phase 1 — all Phase 1 gyms are forced to V-scale mapping.
- A user-editable free-text route name is out of scope for Phase 1 — a route's display name is composed automatically from its grade and hold color (with optional section label), not entered by the submitter.
- A dedicated saved-routes list surface on the Profile tab is out of scope for Phase 1 — on the Profile tab saved routes are surfaced only in the browse flow (a bookmark toggle on the route detail screen and a read-only saved indicator on the gym route list); a dedicated saved-routes list view on the Profile tab is backlog for a later phase. (A Projecting Routes section does appear on the Home tab in Phase 1 — see MOD-012 / AC-177.)
- A "project" ascent style is out of scope — Phase 1 supports exactly three ascent styles (flash, top, attempt); the historical `project` value is removed from the UI and the database enum.
- A public/shared send-record visibility toggle is out of scope for Phase 1 — all sends are private (`is_private = true`).
- Cities other than Taipei and New Taipei are out of scope for Phase 1 (Taoyuan, Hsinchu, Taichung, Kaohsiung, Yilan, Tainan are backlog for a later phase).
- Top-rope-only gyms are excluded from the Phase 1 seed directory (Camp4 達文西攀岩館 and Wusa 攀岩館 are excluded on this basis).
- In-app admin tooling is out of scope for Phase 1 — Supabase Studio is the sole admin surface.
- In-app admin UI for route status management (approve / reject / retire) is out of scope for Phase 1 (planned for Phase 1.5); Supabase Studio is the admin surface for Phase 1.
- Languages other than English and Traditional Chinese (zh-TW) are out of scope for Phase 1.
- Payments, subscriptions, and any monetization are out of scope for Phase 1 and Phase 2.

---

## 3. User Stories

### US-001: Sign up and start using the app

**As a** new climber,
**I want** to sign up (via email, Apple, or Google) and land directly on the Home screen,
**so that** I can start exploring gyms and logging sends without a mandatory setup step.

**Acceptance Criteria**: AC-001

---

### US-002: Log a send quickly

**As a** climber mid-session,
**I want** to log a send (route + style + attempts + optional note) in under 30 seconds and ≤4 taps from a known route page,
**so that** logging doesn't interrupt my climbing rhythm.

**Acceptance Criteria**: AC-010, AC-011, AC-012, AC-014, AC-127, AC-128, AC-129, AC-130, AC-131, AC-132, AC-193

---

### US-003: Submit a new route

**As a** climber whose gym just reset a wall,
**I want** to browse the gym's route list using grade and hold-color filter chips, and — via an always-visible "Can't find it? Add a new route" call-to-action — add a new route (grade + hold color + photo + optional section label) on a single submit screen with the grade and color pre-filled from the filters I already applied,
**so that** the gym's route list stays clean and other climbers can find the same route I'm logging.

The route list uses grade and hold-color filter chips only (no free-text search). The "Can't find it? Add a new route" CTA is always shown at the bottom of the route list — not only when the list is empty — because even when matching routes exist the climber may not find their specific route. The filtered route list is itself the "does this route already exist?" check: the climber filters by grade + color, sees no match, and taps the CTA. There is no separate client-side match-check step. Tapping the CTA opens a single-page submit screen (grade and color chips pre-filled from the active filters) with an "Add Route" button that submits directly. **Duplicate routes are allowed by design** (Rev 37): real gyms routinely set multiple same-grade, same-color routes at once (e.g. two red V5s on different walls), so a route is identified only by its `id`, and there is no database uniqueness constraint on `(gym_id, grade, color_tag)`. Data quality is kept with a **two-layer duplicate guard** at submission (AC-187): (1) while the form is being filled, a neutral-colored inline notice appears when a same-grade/same-color active route already exists at the gym, and (2) if the submitter taps "Add Route" with at least one duplicate candidate present, a non-dismissable confirmation sheet intercepts before any photo upload begins, showing a RouteCard for each matching route and requiring the submitter to choose "Cancel" (return to form) or "Add Route" (proceed with upload and creation). The Submit button is always enabled. Near-duplicates created in error are merged by the admin in Supabase Studio.

**Acceptance Criteria**: AC-020, AC-021, AC-022, AC-023, AC-043, AC-045, AC-187

---

### US-004: Upload a beta video for a route

**As a** climber who figured out a tricky sequence,
**I want** to record or select a short video (≤60 sec), attach it to a specific route, and publish it,
**so that** others attempting the route can learn from my beta.

**Known Phase 1 trade-off (accepted, not a bug)**: Phase 1 performs no client-side compression (AC-031); the app uploads the original native video file as-is, after an upfront 45 MB native-file size gate (AC-169). ~22 s at full 1080p HEVC bitrate hits 45 MB, so clips above roughly that length are rejected with the AC-031 error, and those users are expected to trim the clip or lower their camera's recording quality. This is a deliberate Phase 1 limitation of the no-client-compression approach; the Phase 2 server-side video pipeline (§4, §7) removes it with a proper server-side HDR→SDR tone-map and transcode. HLG/HDR videos recorded with Dolby Vision may appear overexposed in Phase 1 playback — accepted trade-off, fixed in Phase 2.

**Acceptance Criteria**: AC-030, AC-031, AC-032, AC-037, AC-130, AC-161, AC-165, AC-166, AC-169, AC-170, AC-188

---

### US-005: Watch beta inline on a route

**As a** climber projecting a route,
**I want** to open the route detail page and watch all beta videos inline without leaving the app,
**so that** I can study sequences on the wall.

**Acceptance Criteria**: AC-033, AC-034, AC-038, AC-039, AC-133, AC-134, AC-135, AC-136, AC-137, AC-138

---

### US-006: Browse currently active routes at a gym

**As a** climber planning a session,
**I want** to open my gym's page and filter its route list by grade and active status,
**so that** I know what's currently set before I show up.

**Acceptance Criteria**: AC-005, AC-006, AC-040, AC-041, AC-042, AC-045, AC-125, AC-126, AC-194, AC-195, AC-196, AC-197, AC-198

---

### US-007: Follow other climbers and see their activity

**As a** climber connected to the local scene,
**I want** to follow other users and see their sends and beta videos in a chronological feed,
**so that** I can keep up with what my friends and local strong climbers are doing.

**Note (Phase 1)**: the chronological activity feed UI is deferred to Phase 2 (AC-159). Phase 1 ships follow/unfollow and surfaces a Following activity section on the Home screen (US-020, AC-182) — one row per followed climber who has uploaded or replaced a beta video, showing a fixed "new video upload" label and their most-recent beta-video activity time — plus their beta videos on profile grids (US-023, AC-163), but not a dedicated feed screen.

**Acceptance Criteria**: AC-050, AC-051, AC-159

---

### US-008: Like a beta video

**As a** viewer of a helpful beta video,
**I want** to tap a like button (single reaction) on the video,
**so that** the uploader knows their beta helped.

**Acceptance Criteria**: AC-052, AC-053, AC-186

---

### US-009: Receive push notification for beta-video likes

**As a** beta video uploader,
**I want** to receive a push notification when someone likes my video, subject to my notification preferences,
**so that** I get feedback on my contributions.

**Acceptance Criteria**: AC-054, AC-055, AC-056, AC-058, AC-171, AC-172, AC-173, AC-184

---

### US-010: Manage notification preferences

**As a** user who wants control over interruptions,
**I want** a settings screen where I can toggle beta-video-like push notifications on or off,
**so that** I only get pinged for events I care about.

**Acceptance Criteria**: AC-057

---

### US-011: View my profile history and stats

**As a** climber tracking my progress,
**I want** to see my full send history (filterable by gym, grade, date range) and basic stats (sends by grade, total sends, current streak, highest grade), with each logged send showing an achievement icon for its style,
**so that** I can see how I'm improving.

**Acceptance Criteria**: AC-060, AC-061, AC-062, AC-064, AC-065, AC-160, AC-162, AC-164

---

### US-012: Set beta video privacy

**As a** climber concerned about visibility,
**I want** to choose whether my beta videos are visible to everyone or only to my followers,
**so that** I control who sees my beta.

Profile activity is always public; only beta video privacy is user-controlled.

**Acceptance Criteria**: AC-156, AC-157, AC-158

---

### US-013: Request a missing gym

**As a** climber whose gym isn't in the directory,
**I want** to submit a gym request (name + city + optional Google Maps link),
**so that** the admin can review and add it later.

**Acceptance Criteria**: AC-070

---

### US-015: Report inappropriate content

**As a** user who saw an inappropriate beta video or user profile,
**I want** to report the content or user,
**so that** the admin can review and take action (App Store Guideline 1.2 requirement).

For a **user profile** report, I choose a category and add an optional note (AC-080). For a **beta video** report, a single tap on the report icon files the report immediately with no category or note (AC-139/AC-140) and the video is hidden from everyone until an admin reviews it (AC-141).

**Acceptance Criteria**: AC-080, AC-081, AC-139, AC-140, AC-141, AC-142, AC-143

---

### US-016: Block another user

**As a** user who wants to stop seeing another user's activity,
**I want** to block that user,
**so that** their content no longer appears in my feed or on route pages I view, and they cannot follow or interact with me (App Store Guideline 1.2 requirement).

**Acceptance Criteria**: AC-082, AC-083, AC-151, AC-152, AC-155

---

### US-017: Use the app in Traditional Chinese or English

**As a** Taiwan-based climber,
**I want** the app to default to my device locale (with zh-TW fallback) and let me manually toggle language in Settings,
**so that** I can read the UI in the language I prefer.

**Acceptance Criteria**: AC-090, AC-091

---

### US-018: Use the app in Dark Mode

**As a** climber who uses my phone in low light at the gym,
**I want** the app to follow my OS Light/Dark preference by default and let me manually override in Settings,
**so that** the app matches my visual preference.

**Acceptance Criteria**: AC-092

---

### US-019: Save multiple gyms for quick access

**As a** climber who trains at more than one gym,
**I want** to bookmark any gym and have all my saved gyms available from the Home screen,
**so that** I can quickly jump to the gyms I care about without a single fixed home gym.

**Acceptance Criteria**: AC-113, AC-114, AC-115, AC-120, AC-121, AC-122

---

### US-020: See my saved gyms and followed climbers on a Home screen

**As a** climber connected to the local scene,
**I want** a Home screen that shows an announcement banner, my saved gyms, my projecting routes, and the activity of the climbers I follow,
**so that** I have a single landing surface that surfaces the gyms, routes, and people most relevant to me.

**Acceptance Criteria**: AC-110, AC-111, AC-112, AC-113, AC-114, AC-115, AC-150, AC-153, AC-174, AC-175, AC-176, AC-177, AC-178, AC-181, AC-182, AC-183, AC-189, AC-190, AC-191, AC-192

---

### US-021: Bookmark a route while browsing

**As a** climber who wants to keep track of routes I plan to try,
**I want** to bookmark a route from its detail screen and see a read-only saved indicator on that route in the gym route list,
**so that** I can recognize the routes I've saved while browsing without a separate saved-routes screen.

**Acceptance Criteria**: AC-046, AC-047

---

### US-022: See my followers and who I follow

**As a** user,
**I want** to see who follows me and who I follow,
**so that** I can discover and connect with climbers in my community.

**Acceptance Criteria**: AC-145, AC-146, AC-147, AC-148, AC-149

---

### US-023: Open a beta video poster's profile

**As a** user,
**I want** to tap a beta video poster's name or avatar to view their profile,
**so that** I can discover climbers whose content I enjoy.

**Acceptance Criteria**: AC-135, AC-144, AC-154, AC-163

---

## 4. Tech Stack

| Component        | Name + Version                                      | Notes                                                                                                                                       |
|------------------|-----------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------|
| Language         | TypeScript 5.x                                      | Shared across app and Supabase Edge Functions.                                                                                              |
| App framework    | React Native (Expo SDK 51+)                         | iOS-only build configuration for Phase 1. Android in Phase 2.                                                                               |
| Backend (BaaS)   | Supabase (Postgres 15+, Auth, Storage, Edge Functions) | Postgres with Row-Level Security. Auth: Email + Apple Sign-In + Google Sign-In. Storage for photos and Phase 1 video.                       |
| Video hosting    | Supabase Storage (Phase 1) → AWS S3 + CloudFront + MediaConvert (Phase 2 migrate) | Phase 1 stores original native files as-is in Supabase Storage (no transcoding). Phase 2 migrates video ingest + delivery to AWS (S3 storage, MediaConvert HDR→SDR + H.264 transcode, CloudFront CDN); Supabase keeps Postgres, Auth, RLS, PostgREST, and all non-video storage. This supersedes the previously documented Cloudflare Stream target (PM-logged override, Rev 24). Supabase Pro (~US$25/mo, 100 GB, 200 MB/file) was weighed and rejected as the Phase 2 path (see §12). Migration watch trigger: beta-video storage reaches 800 MB of the 1 GB free tier (AC-170). |
| Push             | Apple Push Notification service (APNs) via Expo Push | Device token table + Supabase Edge Function trigger for beta-video-like events only in Phase 1.                                             |
| Analytics        | PostHog (free tier)                                 | Product analytics + retention cohorts.                                                                                                      |
| Admin tooling    | Supabase Studio                                     | Sole admin surface for Phase 1 (gym CRUD, gym request review, report review, user block/ban actions). No in-app admin UI.                   |
| Localization     | i18n-js or expo-localization + JSON message catalogs | Languages: English + Traditional Chinese (zh-TW). Default: device locale; fallback: zh-TW.                                                  |
| Theming          | React Native appearance API + Expo theming          | Light + Dark mode. Follows OS preference by default; manual override in Settings.                                                           |

---

## 5. Architecture Overview

ProjectDay is a mobile client (React Native / Expo, iOS-only for Phase 1) talking directly to Supabase for auth, data, storage, and serverless functions. There is no bespoke backend server in Phase 1.

- The **client** owns rendering, local UI state, client-generated thumbnails, and localization. In Phase 1 the client performs **no** video compression of its own — it uploads the original native video file as-is after an upfront size gate (≥ 45 MB is rejected; see §8 AC-031/AC-169). It authenticates via Supabase Auth (Email / Apple / Google) and stores the session locally.
- The client's top-level UI is a **persistent three-tab bottom navigation shell**. **Tab 1 (Home)** hosts the Home surface (MOD-012). **Tab 2 (Gyms)** hosts the existing gym navigation stack (MOD-002 gym directory + detail, with MOD-003 route catalog reachable beneath it). **Tab 3 (Profile)** hosts the current user's profile surface (MOD-001) with their embedded send history and stats (MOD-008). The Home tab is the default tab after login. This tab shell is an app-level architecture concern: the mount point for each tab's navigator and the module boundaries between the shell and the surfaces it hosts require Tech Lead review before implementation.
- **Supabase Postgres** is the system of record. All tables are protected by Row-Level Security (RLS) policies. Read/write access is scoped per-user for logs, follows, reactions, reports, blocks, saved gyms, saved routes, and notification preferences; gyms are readable by all authenticated users and writable only by admins; routes are readable by all authenticated users for `active` rows, with `pending` rows visible only to their submitter, and are writable by the submitting user on insert (initial status `active` when auto-approve is ON, else `pending`), while status transitions to `retired` or `rejected` and approval of `pending` routes are admin-only via Supabase Studio.
- **Supabase Storage** hosts avatars, gym photos, route photos, and (Phase 1 only) beta videos + client-generated thumbnails. When the Phase 2 migration is executed, beta-video ingest and delivery cut over to **AWS S3 + CloudFront + MediaConvert** (superseding the previously documented Cloudflare Stream target, Rev 24) while all metadata — including `beta_videos.video_url`, now a CloudFront URL — continues to live in Postgres on Supabase.
- **Supabase Edge Functions** handle event-driven workflows that must not run on the client: on `Reaction` insert with `target_type = beta_video`, an Edge Function inserts a `Notification` row and enqueues an APNs push (respecting `NotificationPreference`) via Expo Push to all `DeviceToken` rows for the recipient.
- **PostHog** SDK ships client-side events (signup, first send, video upload, retention markers). No PII beyond user_id is sent.
- **Admin operations** (adding gyms, reviewing gym requests, reviewing reports, banning users, merging near-duplicate routes, approving/rejecting pending routes, and retiring routes) are performed exclusively through Supabase Studio in Phase 1. In-app admin UI for route status management is planned for Phase 1.5.

The data flow for the two most important loops:

1. **Log a send**: client → Supabase Auth (session) → Postgres insert into `Ascent` (RLS-checked) → PostHog event. Grade is read from `Route.grade` at display time, never stored per-log.
2. **Upload beta video → notify**: client generates thumbnail and (Phase 1) uploads the original native video file as-is (AC-031) to Supabase Storage after the upfront 45 MB size gate → insert `BetaVideo` row → other user views + likes → insert `Reaction` row → Edge Function fires → insert `Notification` row + APNs push to recipient's device tokens (if enabled in `NotificationPreference`).

---

## 6. Module Breakdown

### MOD-001: Auth & Profile

**Purpose**: Handle signup, sign-in (email, Apple, Google), session management, and user profile CRUD including the beta-video privacy setting (`beta_video_privacy`), avatar, bio, and display name. Own the Profile tab surface: display the current user's display name, avatar, and bio; render follower/following count links on the profile (AC-145); expose an Edit Profile entry point (display name, avatar, bio); embed the current user's send history (MOD-008 surface); and render a 3-column beta-video grid of the current user's own beta videos below the send history (MOD-005's `BetaVideoGrid` + `fetchBetaVideosByUser`, opening MOD-005's reel viewer in `profile` context, AC-164). Own the `users.beta_video_privacy` write: expose a public service function that updates the current user's `beta_video_privacy` column, consumed by MOD-010's SettingsScreen (AC-157). The `privacy_setting` column is always `public` — there is no user-facing toggle for profile privacy (AC-063). The Logout control is no longer on the Profile screen — it moves to MOD-010's SettingsScreen (AC-167/AC-168). The notification bell is no longer in the ProfileScreen header — it moves to the global app-level header owned by MOD-012 (AC-184), which wires to MOD-007's NotificationInboxScreen. There is no home gym concept — saved gyms live in MOD-012.

**User Stories**: US-001, US-011, US-012, US-022

**Dependencies**: MOD-005 (`BetaVideoGrid` component, `fetchBetaVideosByUser` service, and `BetaVideoReelViewer` `profile` context for the own-videos grid on ProfileScreen, AC-164)

---

### MOD-002: Gym Directory

**Purpose**: Serve the admin-curated gym directory (branch-level rows), gym detail pages, gym search/filter, and the "request a gym" submission form. Own the saved-gym bookmark interaction: a read-only saved indicator on gym list cards and an interactive bookmark toggle on the gym detail screen that adds/removes the gym from the user's saved gyms list.

**User Stories**: US-006, US-013, US-019

**Dependencies**: MOD-001

---

### MOD-003: Route Catalog

**Purpose**: Own the route submission flow (duplicates allowed by design — no database uniqueness constraint; a two-layer duplicate guard on same-grade/same-color at the gym: inline notice + non-dismissable confirmation sheet on submit, AC-187), the composed route display name (grade + color + optional section label), route detail pages, the route status lifecycle (`active` / `pending` / `retired` / `rejected`), submitter-only pending visibility and withdrawal, the fixed hold/tape color enum, the saved-route bookmark interaction (a bookmark toggle on the route detail screen and a read-only saved indicator on the gym route list), the per-user route-visit tracking upsert on route detail open (`user_route_visits`, AC-179), and the "new beta video" qualification logic (AC-180); the "new beta video" chip rendering on route cards is removed (AC-181, Rev 39), while the backing `user_route_visits` data (AC-179) and `fetchRoutesWithNewBeta` service are retained for the Saved Gyms most-recently-viewed ordering (AC-175). Admin approval/rejection/retirement is performed via Supabase Studio in Phase 1.

**User Stories**: US-003, US-006, US-021

**Dependencies**: MOD-001, MOD-002

---

### MOD-004: Send Logging

**Purpose**: Handle send log creation from a route page or global "+" entry point, enforcing that grade is inherited from the route (no per-user override) and restricting the ascent style to the three-value set (flash, top, attempt). `LogSendScreen` displays a read-only route summary card (grade + tape badge via `src/lib/tape.ts`) at the top before the form fields (AC-131). The ascent history list for a route shows an inline delete control (swipe-to-delete or delete icon) on each ascent row; tapping it calls `deleteAscent(ascentId)` with RLS own-rows-only enforcement, optimistic removal, and revert on error (AC-193).

**User Stories**: US-002

**Dependencies**: MOD-001, MOD-003

---

### MOD-005: Beta Video

**Purpose**: Handle video capture/selection (≤60 sec cap), an upfront 45 MB native-file size gate (reject-if-over, fail-closed; no client-side compression in Phase 1, AC-031/AC-169), client-generated thumbnail, upload of the original native file to storage, inline playback on route detail pages and the activity feed, the fullscreen portrait reel viewer (thumbnail grid → swipe-navigable viewer with a persistent back control, poster-identity overlay, and a two-icon action sidebar), and the one-tap beta-video report flow (report icon → `is_reported` flag via SECURITY DEFINER RPC + `VideoReport` insert, with reported videos hidden until an admin dismisses the report), filtering out beta videos uploaded by blocked users (block in either direction) on the route detail screen via MOD-009's `fetchBlockedUserIds()` (AC-154), and filtering out beta videos whose poster has set `beta_video_privacy = followers_only` when the viewer is neither the poster nor a follower (AC-158). Own the shared `BetaVideoGrid` component (3-column thumbnail grid, AC-160) consumed by MOD-006 (AC-163) and MOD-001 (AC-164); the `fetchBetaVideosByUser` service (AC-162) consumed by the same; the `reelContext: 'route' | 'profile'` prop on `BetaVideoReelViewer` (AC-164); the account-level upload flow (per-upload visibility toggle removed, AC-161; one-video-per-route enforced by a DB unique constraint AC-165 with an upsert/replace flow and a replace reminder, AC-166; a `beta_videos.updated_at` column bumped to NOW() on every upsert/replace as the authoritative "last activity" timestamp, AC-188).

**User Stories**: US-004, US-005, US-015, US-023

**Dependencies**: MOD-001, MOD-003, MOD-009 (block-status public service `fetchBlockedUserIds`, AC-154)

---

### MOD-006: Social Graph & Feed

**Purpose**: Handle follow/unfollow, beta-video like reactions, the Followers and Following list screens (AC-146, AC-147), and the other-user `UserProfileScreen` overlay — including its three-dots action sheet (Report / Block / Unblock, AC-150), its blocked-state "This profile isn't available" rendering (AC-153), and a 3-column beta-video grid of that user's beta videos below the stats section (MOD-005's `BetaVideoGrid` + `fetchBetaVideosByUser`, opening MOD-005's reel viewer in `profile` context, AC-163). The report and block actions themselves are performed via MOD-009's public services. The chronological activity feed UI is formally deferred to Phase 2 (AC-159): `FeedScreen.tsx` and the `get_activity_feed` RPC remain in the codebase as dead code, never imported or rendered in any navigator or shell.

**User Stories**: US-007, US-008, US-022

**Dependencies**: MOD-001, MOD-004, MOD-005, MOD-008, MOD-009 (block/unblock actions and block-status service for the UserProfileScreen three-dots sheet + blocked state, AC-150/AC-152/AC-153)

---

### MOD-007: Notifications

**Purpose**: Own the device token registration, notification preference toggles, the Edge Function that fans out beta-video-like events to APNs push, and the in-app notification inbox. Own the `NotificationInboxScreen` (a list of the current user's in-app notifications, most recent first), reached via the notification bell in MOD-012's global app-level header (AC-184; the bell was formerly in MOD-001's ProfileScreen header, AC-171 revised). On inbox mount, batch-mark all of the current user's unread notifications as read in a single update (AC-172). Own the unread-count badge rendered on the global-header bell, which reflects the current user's unread-notification count and clears when the inbox is opened (AC-173 revised; the badge is rendered on MOD-012's global header per AC-184). Tapping a beta-video-like entry in the inbox navigates to the actor's UserProfileScreen (MOD-006), resolved from the notification's existing `actor_user_id` column (AC-058, revised).

**User Stories**: US-009, US-010

**Dependencies**: MOD-001, MOD-006

---

### MOD-008: Profile History & Stats

**Purpose**: Render the current user's (and other users', per privacy) send history with gym/grade/date filters and basic stats (sends by grade bar chart, total sends, current streak, highest grade), displaying an achievement icon for each logged send's ascent style.

**User Stories**: US-011

**Dependencies**: MOD-001, MOD-004

---

### MOD-009: Moderation (Report & Block)

**Purpose**: Provide user-profile report submission (which in Phase 1 both files a report record and blocks the user, AC-151), block/unblock actions (`blockUser` / `unblockUser`, AC-152), a block-status public service (`isBlocked` / `fetchBlockedUserIds` / `fetchMyBlockedUsers`) consumed by MOD-005 (AC-154), MOD-006 (AC-153), and MOD-010's Blocked Accounts screen (AC-155, via `fetchMyBlockedUsers`), and filtering blocked users out of feeds, route pages, and follow flows. Admin review happens in Supabase Studio. Beta-video reporting is owned by MOD-005 (the one-tap report flow, AC-139/AC-140), not MOD-009.

**User Stories**: US-015, US-016

**Dependencies**: MOD-001, MOD-005, MOD-006

---

### MOD-010: Localization & Theming

**Purpose**: Provide i18n message catalog loading (English, zh-TW), device-locale detection with zh-TW fallback, in-app language toggle, and Light/Dark theming that follows OS preference with a manual Settings override. Own the Settings screen "Blocked Accounts" row and the Blocked Accounts screen (AC-155), which lists the current user's blocked users and offers per-row unblock via MOD-009's public services (`fetchMyBlockedUsers` / `unblockUser`). Own the Settings screen "Beta Video Privacy" toggle row (AC-157), which reads and updates the current user's `beta_video_privacy` setting by calling MOD-001's public service (MOD-001 owns the profile write).

**User Stories**: US-017, US-018, US-012

**Dependencies**: MOD-001 (public service to update `beta_video_privacy` for the SettingsScreen beta-video privacy toggle, AC-157), MOD-009 (block-status + unblock public services `fetchMyBlockedUsers` / `unblockUser` for the Blocked Accounts screen, AC-155)

---

### MOD-011: Analytics

**Purpose**: Ship product events (signup, first send, first video, retention markers, like events) to PostHog, wired throughout the app.

**User Stories**: (cross-cutting; supports goals in Section 2 rather than a single US) — **deferred to Phase 2 (Rev 45)**

**Dependencies**: MOD-001

---

### MOD-012: Home

**Purpose**: Own the persistent three-tab bottom navigation shell (Home / Gyms / Profile) and the Home tab surface. The Home surface renders four sections in order — (1) a single admin-managed Events Banner (AC-112/AC-174), (2) the user's Saved Gyms strip (AC-113/AC-114/AC-115), (3) the user's Projecting Routes section sourced from `saved_routes` with V-grade filter tabs (AC-177/AC-178), and (4) a Following activity section with one row per followed climber who has uploaded or replaced a beta video — showing a fixed "new video upload" label and the climber's most-recent beta-video activity time (AC-182) — and provides navigation from those sections into the gym route list, route detail, and user profile surfaces. **Tech-Lead-assigned cross-cutting ownership (pending review)**: MOD-012 is the proposed owner of (a) the global app-level header rendered on all screens except the fullscreen beta-video reel viewer (AC-133) and auth/signed-out screens — bell and settings icon together on the right side (AC-184 revised — left side = screen title/back button; right side = bell + settings as a group); (b) the shared route card component with a `photo_url` thumbnail (88pt standard / 64pt compact per the `size` prop, AC-192 revised), a tape badge showing the route grade via `src/lib/tape.ts` (AC-191 revised — grade shown on badge; no plain-text grade `<Text>` label), a beta-count subtitle (AC-189), a has-sent flash/top badge (AC-190), and an interactive bookmark icon wired to MOD-003's save/unsave backend (AC-046/AC-047); the "new beta video" chip is removed (AC-181, Rev 39) while `user_route_visits`/`fetchRoutesWithNewBeta` are retained for AC-175 ordering. The card is consumed by the Home Projecting section, RouteListScreen, and the profile send-history section (AC-183); and (c) the swipe left-to-right back gesture on all screens that have a back icon (AC-185). Final ownership of (a), (b), and (c) is assigned by the Tech Lead in architecture review.

**User Stories**: US-020, US-019

**Dependencies**: MOD-001, MOD-002, MOD-003 (saved_routes / route-visit data and route detail navigation for the Projecting Routes section, AC-177/AC-178; shared route card thumbnail source `photo_url`, AC-183), MOD-006 (followed-climbers activity for the Following section, AC-182), MOD-007 (NotificationInboxScreen + unread-count for the global-header bell, AC-184)

---

## 7. Phases & Milestones

### Phase 1: iOS MVP — Taipei/New Taipei launch

**Modules**: MOD-001, MOD-002, MOD-003, MOD-004, MOD-005, MOD-006, MOD-007, MOD-008, MOD-009, MOD-010, MOD-012

**Scope summary**: iOS-only React Native + Expo app. Auth (Email + Apple + Google). Admin-curated gym directory seeded with Taipei/New Taipei branch-level rows (top-rope-only gyms excluded). Route submission using fixed hold/tape color enum, V-scale grade forced across all gyms (duplicates allowed by design — no uniqueness constraint; a two-layer duplicate guard on same-grade/same-color at the gym: inline notice + non-dismissable confirmation sheet on submit, AC-187); routes carry a composed display name (grade + color + optional section label). Route bookmarking in the browse flow (bookmark on route detail, read-only saved indicator on the gym route list). Send logging (no offline queue — error message on failure) with a three-value ascent style (flash, top, attempt). Beta video upload (60 sec cap, no client-side compression — original native file uploaded as-is behind a 45 MB size gate, AC-031/AC-169, client-generated thumbnail). Follow + chronological activity feed. Beta-video likes with APNs push notifications + preference toggle. Profile history + basic stats with per-send achievement icons. Report + Block (App Store 1.2 compliance) — user-profile reports (category + note) plus one-tap beta-video reports that hide the video pending admin review. English + zh-TW (device-locale default, zh-TW fallback, Settings toggle). Light + Dark mode (OS preference + Settings override). PostHog analytics is deferred to Phase 2 (MOD-011 moved out of Phase 1, Rev 45). Admin surface = Supabase Studio only. Video hosting = Supabase Storage.

**Milestone**: All Phase 1 acceptance criteria pass on a production Supabase project and a TestFlight build; the seeded gym directory (branch-level Taipei/New Taipei, excluding Camp4 達文西攀岩館 and Wusa 攀岩館) is loaded and every gym has a verified address and map pin; the App Store submission passes Guideline 1.2 review with Report and Block flows functional.

---

### Phase 2: Community depth + Android

**Modules**: MOD-011 (Analytics — deferred from Phase 1, Rev 45), (new modules TBD in a later PRD revision — Android build config, offline send queue, expanded notifications, comments, retire/reset voting, ascent pyramid, gym-info edit suggestions, AWS video pipeline migration (S3 + CloudFront + MediaConvert, superseding Cloudflare Stream) once the storage-watch trigger has fired, dedicated saved-routes list surface, beta-video thumbnail frame extraction)

**Scope summary**: Android build (Expo config extension). Offline send queue with local persistence + sync-on-reconnect. Expanded push notifications (new routes at followed gyms, someone flashed your project, new follower). Comments (if community demand and moderation bandwidth exist). Community-driven route retire/reset workflow with light voting. Ascent pyramid visualization. "Suggest an edit" flow for gym metadata. A dedicated saved-routes list surface (Phase 1 only surfaces saved routes in the browse flow). AWS video pipeline migration (S3 ingest/storage + MediaConvert HDR→SDR + H.264 transcode + CloudFront CDN delivery) executed if Phase 1 crossed the storage-watch trigger (AC-170); this is a conscious override of the previously documented Cloudflare Stream target (Rev 24), with Supabase keeping Postgres/Auth/RLS/PostgREST and all non-video storage. Supabase Pro was weighed and rejected as the Phase 2 path (see §12).

**Milestone**: Android build published to Play Store; offline queue verified across airplane-mode/reconnect cycles; expanded notification types delivering ≥95% within 30 seconds; comments (if shipped) have working report + delete flows.

---

### Phase 3: Gym partnerships

**Modules**: (new modules TBD — Gym Claim, Route-Setter Console, Official Route Publishing, Gym Analytics, Billing)

**Scope summary**: Gyms can claim their gym profile and publish official route lists that supersede user-submitted data. "New set" notifications sourced from the gym. Gym-facing analytics dashboard. Optional gym subscription for the route-setter console; climber app stays free.

**Milestone**: At least one Taiwan gym has claimed its profile, is publishing official routes end-to-end, and the app displays a "verified by gym" badge in place of user-submitted labels.

---

## 8. Acceptance Criteria

### MOD-001 (Auth & Profile) Acceptance Criteria

**AC-001** (revised): On first run, the system shall navigate the user directly to the Home screen after signup via Email, Apple Sign-In, or Google Sign-In, without requiring any gym selection step.

**AC-063**: The `users.privacy_setting` column is always `public`; there is no user-facing toggle to change it to `followers_only`. The column is retained in the schema for potential future use but is not user-controllable in Phase 1. Profile activity (send history, profile surface) is visible to all authenticated users regardless of this value.

**AC-116** (new): The Profile screen shall display the current user's display name, avatar, and bio.

**AC-117** (new): The Profile screen shall expose an Edit Profile entry point that opens editing of the current user's display name, avatar, and bio.

**AC-118** (new): The Profile screen shall embed the current user's send history (the MOD-008 profile-history-and-stats surface).

**AC-119** (new): The Profile screen shall expose a Logout control at the bottom that ends the session and returns the user to the signed-out state.

**AC-145** (new): The Profile screen shall display, immediately below the user's bio, two tappable count links arranged left (followers count, label "追蹤者") and right (following count, label "追蹤中"). Tapping the followers link navigates to the Followers list screen (AC-146); tapping the following link navigates to the Following list screen (AC-147). The counts are sourced from MOD-006's social-graph public service. This applies to both the current user's own Profile screen and the MOD-008 other-user profile surface (AC-064).

**AC-156** (new): The system shall persist a per-user beta-video privacy setting in a new `users.beta_video_privacy` column (enum `public` (default) | `followers_only`), separate and independent from the existing `privacy_setting` column (AC-063). MOD-001 shall expose a public service function that updates the current user's `beta_video_privacy` value; MOD-001 owns this profile write. When `beta_video_privacy = followers_only`, the user's beta videos shall be visible only to the user themselves and to their followers; when `public` (default), the user's beta videos are visible to all users. This setting governs beta-video visibility only and does not affect `privacy_setting` (which governs logs and the profile surface per AC-063). Adding the column requires a migration.

**AC-164** (new, MOD-001 + MOD-005): The `ProfileScreen` shall display a 3-column `BetaVideoGrid` (AC-160) as a separate section below the full send history, showing the current user's own beta videos fetched via `fetchBetaVideosByUser(currentUserId)` (AC-162). Tapping a cell shall open `BetaVideoReelViewer` cycling through the current user's own videos, starting at the tapped index. In this context the viewer is passed `reelContext = 'profile'`: the poster-identity row is visible but NOT tappable (no navigation on tap). MOD-005 shall add a `reelContext: 'route' | 'profile'` prop to `BetaVideoReelViewer` — `'route'` keeps the existing behavior (poster row tappable, navigates to the poster's profile per AC-135); `'profile'` renders the poster row visible but not tappable. MOD-001 consumes MOD-005's `BetaVideoGrid`, `fetchBetaVideosByUser`, and `BetaVideoReelViewer` for this section.

**AC-167** (new): The Logout control shall be removed from the `ProfileScreen` `listFooterComponent`. Logout moves to the SettingsScreen (AC-168). This supersedes AC-119's placement of the Logout control on the Profile screen; the session-ending behavior (ends the session and returns the user to the signed-out state) is unchanged — only its location moves.

---

### MOD-002 (Gym Directory) Acceptance Criteria

**AC-004**: The system shall render the Taipei/New Taipei branch-level gym directory with every gym showing name, city/district, address, map pin, gym type, and (if present) photo when a user opens the Gyms tab.

**AC-005** (new): The system shall present a "View Routes" entry point at the **bottom** of the gym detail screen that navigates the user to that gym's route catalog, passing the gym context (gym ID and gym name). The entry point must be visible without any additional action.

**AC-006** (new): The system shall navigate a user from a gym row in the gym directory list to that gym's detail screen when the user taps the row, passing the selected gym's identifier.

**AC-070**: The system shall accept a "request a gym" submission containing gym name, city, and optional Google Maps link, persist it to a queue readable by admins in Supabase Studio, and show the user a confirmation state when the submission succeeds.

**AC-120** (new): The gym detail screen (GymDetailScreen) shall display a bookmark icon that toggles between a saved state (filled, yellow) and an unsaved state (gray), reflecting whether the gym is in the current user's saved gyms list.

**AC-121** (new): Tapping the bookmark icon on the gym detail screen shall add or remove the gym from the current user's `saved_gyms` list and update the icon state immediately (optimistic update). The gym detail screen is the only save/unsave action point.

**AC-122** (new): The gym list screen shall display a filled yellow bookmark indicator on gym cards that are in the current user's saved gyms list; no indicator is shown for unsaved gyms. The list indicator is read-only — tapping it performs no save/unsave action.

**AC-194** (new, Rev 44, MOD-002 — Data model migration): The system shall add two nullable columns to the `gyms` table via a new migration file (`supabase/migrations/<timestamp>_mod_002_gym_cover_photo.sql`): `cover_photo_url TEXT` and `google_place_id TEXT`. Both columns are nullable so existing rows are unaffected. Gyms with no cover photo continue to render the initials avatar fallback (AC-198). The `cover_photo_url` column is the authoritative cover photo for both the gym list and gym detail screen. A gym's official photo may overwrite `cover_photo_url` in a later cooperation phase without any schema change.

**AC-195** (new, Rev 44, MOD-002 — One-time seeder script): The system shall provide a one-time server-side seeder script that populates `cover_photo_url` and `google_place_id` for each gym in the seeded directory. The script shall: (1) call the Google Places Text Search API with the gym's name and address to obtain a `place_id`; (2) call the Place Details API with the `place_id` to obtain a `photo_reference` list; (3) call the Place Photo API with the first `photo_reference` to download an image; (4) upload the image to Supabase Storage in a bucket named `gym-photos`; (5) store the resulting public URL in `gyms.cover_photo_url` and the resolved `place_id` in `gyms.google_place_id`. The script is run once by the admin before Phase 1 launch and is not triggered from any client flow. The script shall skip gyms that already have a non-null `cover_photo_url`, making it safe to re-run. The Google Places API key used by the seeder must be server-side only — it must never be included in the client bundle, any client environment file, or any file committed to the repository. The key is supplied at script run-time via a secure environment variable (e.g. a `.env` file excluded from source control, or a CI secret).

**AC-196** (new, Rev 44, MOD-002 — Gym detail screen cover photo): The gym detail screen (GymDetailScreen) shall display `cover_photo_url` as a cover photo at the top of the screen when the value is non-null. When `cover_photo_url` is null, the cover photo slot shall not render (the layout falls back gracefully with no blank space). Every screen that displays a gym cover photo sourced from `cover_photo_url` shall show a visible “Photos from Google” attribution label adjacent to or below the image, as required by Google Maps Platform Terms of Service.

**AC-197** (new, Rev 44, MOD-002 — Gym list cover photo thumbnail): The gym list shall display `cover_photo_url` as a thumbnail on each gym card when the value is non-null. When `cover_photo_url` is null, the gym card shall display the initials avatar (AC-198) in the thumbnail slot instead. The “Photos from Google” attribution required by AC-196 shall also be shown on the gym list screen when at least one card is displaying a Google-sourced cover photo.

**AC-198** (new, Rev 44, MOD-002 — Initials avatar fallback): The system shall generate an initials avatar for the gym avatar slot on both the gym list card and the gym detail screen. The initials are derived from the gym's `name` field (first letter of each word, up to two letters, uppercased). The initials avatar is shown whenever `cover_photo_url` is null. It requires no Google API call and no network request. The fallback is purely client-generated and has no external dependency.

---

### MOD-003 (Route Catalog) Acceptance Criteria

**AC-020** (revised, Rev 37): The system shall provide a single-page route submit screen containing grade chips, hold-color chips, an inline photo picker (image preview shown on the same page after selection), an optional section-label text field, and an "Add Route" button at the bottom that submits the route directly via the `submit_route` RPC. There shall be no client-side match-check step and no multi-step submission flow — the RouteListScreen grade + color filter serves as the "does this route already exist?" check before the user opens the submit screen. **Duplicate routes are allowed by design (Rev 37)**: the system shall NOT reject a submission on the grounds that a route with the same `(gym_id, grade, color_tag)` already exists. The `submit_route` RPC shall insert the route without any uniqueness pre-check or uniqueness failure, and there shall be no database uniqueness constraint or unique index on `(gym_id, grade, color_tag)` (the former active-only unique index is dropped; see §9 and the migration note). Data-quality disambiguation is handled by the two-layer duplicate guard in AC-187, not by a hard constraint. **Tech Lead review required** — dropping the existing active-only unique index (`routes_active_unique_idx`) and removing the uniqueness pre-check from the `submit_route` RPC require a migration and an RPC change.

**AC-021** (revised): The system shall block route submission when no photo is attached via the inline photo picker and shall show a validation message indicating the photo is required. The photo requirement is enforced both client-side (the "Add Route" button cannot submit without a photo) and server-side (the `submit_route` RPC rejects a submission with no photo).

**AC-022**: The system shall restrict the hold/tape color selector to the fixed enum {red, orange, yellow, green, blue, purple, pink, white, black}.

**AC-023**: The system shall enforce V-scale as the only grade system available for route creation across all Phase 1 gyms.

**AC-024b** (new): The system shall support an admin-only `retired` status, set exclusively by an admin via Supabase Studio (normal users can no longer retire routes). Setting a route to `retired` shall immediately exclude it from the active route list and from the match pool. The existing `retired_at` / `retired_by_user_id` columns record when and by whom the route was retired.

**AC-025** (new): The system shall set a newly submitted route's initial status to `active` when the auto-approve setting is ON, and to `pending` when auto-approve is OFF. Auto-approve defaults ON at Phase 1 launch. When auto-approve is OFF, after submission the system shall show the message "Your route will appear once approved by the admin" (zh-TW translation [I18N-PENDING]).

**AC-026** (new): The system shall make a `pending` route visible only to its submitter (read-only); a `pending` route shall not appear in the route list shown to any other user.

**AC-027** (new): The system shall allow an admin, via Supabase Studio only in Phase 1, to approve a `pending` route (transition to `active`) or reject it (transition to `rejected`).

**AC-028** (new): The system shall never show `rejected` or `retired` routes to normal users.

**AC-029** (revised, Rev 37): The system shall allow a submitter to withdraw their own `pending` route, which deletes the row (the row is removed, not status-changed). The former restriction preventing a user from holding two `pending` submissions for the same `(gym_id, grade, color_tag)` is **removed** (Rev 37): because duplicates are now allowed by design (AC-020) and the per-submitter partial unique index on pending routes is dropped along with the active-only unique index, a user may submit more than one route with the same gym + grade + color. The duplicate guard (AC-187) applies to each such submission; the submitter may proceed.

**AC-040** (revised): The system shall, on a gym detail page, filter the route list by grade and by hold color using chip selectors. There shall be no free-text search input and no status filter for normal users.

**AC-041** (revised): The system shall show normal users `active` routes only in the gym route list, with no status tag and no status filter surfaced to them.

**AC-042** (new): The system shall navigate a user from a route entry in the gym route list to that route's detail screen when the user taps the entry, passing the selected route's identifier. The route detail screen is the entry point for logging a send (AC-010), uploading beta (AC-037), watching beta (AC-033), and saving the route (AC-046).

**AC-043** (new): The system shall pre-fill the route submit screen's grade and color chips from the RouteListScreen filter state when the user opens the submit screen. RouteListScreen passes its current grade filter and color filter values as optional parameters to the submit screen; if a grade filter was active when the user tapped "Add Route", the corresponding grade chip shall be pre-selected, and if a color filter was active, the corresponding color chip shall be pre-selected. When a filter is unset, the corresponding chip shall open unselected. Pre-filled chips remain editable by the user before submission.

**AC-044** (new): The route detail screen (RouteDetailScreen) shall not display the route's submitter ("由誰新增" / Submitted By). The `submitted_by_user_id` field remains in the data model for RLS and constraint purposes only and is never surfaced in the route detail UI.

**AC-045** (new): The system shall compose a route's display name automatically from its grade and hold color in the form "`<grade> <Color>`" (e.g. "V3 Blue"), appending the section label in parentheses when a section label is present (e.g. "V3 Blue (Cave)"). The display name is not a stored, user-editable field — it is derived from the route's `grade`, `color_tag`, and optional `section_label` at display time. The composed name shall be used consistently wherever a route is labeled (the gym route list, the route detail screen header, and any surfaced reference to the route). There is no free-text route-name input on the submit screen. **Ambiguous names are permitted (Rev 37)**: because duplicate routes are allowed by design (AC-020), two same-grade/same-color routes at one gym with no section label render the same composed display name; this is accepted. `section_label` is the recommended disambiguator (the AC-187 Layer 1 inline notice nudges the submitter to supply one), and the route card's `photo_url` thumbnail (AC-183) further distinguishes same-named routes visually. The display name is NOT made unique and the submitter is never blocked for producing a duplicate name.

**AC-046** (revised, Rev 39): The route detail screen (RouteDetailScreen) shall display a bookmark toggle that reflects whether the route is in the current user's saved routes list and, when tapped, shall add or remove the route from the user's `saved_routes` list and update the toggle state immediately (optimistic update). The route detail screen is the only save/unsave action point for routes. **Shared route card bookmark wiring (Rev 39)**: the shared route card (AC-183) shall also accept an `isSaved: boolean` prop (default `false`) and an `onBookmarkToggle: () => void` prop, rendering a bookmark icon that is filled when `isSaved` and outline when not; tapping the icon calls `onBookmarkToggle`. The route card itself remains purely presentational — it does not call the save/unsave services directly. Callers (RouteListScreen, MOD-003) already have `fetchSavedRouteIds`, `saveRoute`, and `unsaveRoute` from `route-service.ts`; they pass the current saved state (`isSaved`) and a toggle callback (`onBookmarkToggle`) to the card. This wires the card's bookmark icon fully to the existing backend (not a static placeholder).

**AC-047** (revised, Rev 39): The gym route list (RouteListScreen) shall display an interactive bookmark icon on route cards via the shared route card's `isSaved` / `onBookmarkToggle` props (AC-046, AC-183): the icon is filled when the route is in the current user's saved routes list and outline when it is not, and tapping it toggles the saved state by calling the caller-supplied `onBookmarkToggle` callback. RouteListScreen owns the save/unsave calls (`saveRoute` / `unsaveRoute` from `route-service.ts`) and the current saved state (`fetchSavedRouteIds`); the shared route card remains presentational and never calls the services directly. (This supersedes the former read-only saved indicator: the gym route list bookmark is now interactive, wired to the existing backend. Tapping the route card body still navigates to its detail screen per AC-042; tapping the bookmark icon toggles the saved state.)

**AC-187** (revised, Rev 42): On the route submit screen (AC-020), the system shall apply a two-layer duplicate guard when the user selects a grade + color combination that matches one or more existing `active` routes at the same gym. Duplicate candidates are determined client-side from the already-fetched `activeRoutes` list via a `useMemo` — no dedicated server round-trip is needed. The "Add Route" button is always enabled; neither layer blocks or disables submission.

**Layer 1 — Inline notice (proactive, while the form is being filled)**: When the current grade + color selection matches one or more existing `active` routes at the same gym, the system shall display a neutral-colored (not warning-orange — informational only) inline notice below the form fields showing the count of matching routes. The notice shall update as the grade/color selection changes and shall be hidden when no matching active route exists. i18n keys: `routes.duplicateNotice.title` / `routes.duplicateNotice.body`, with `{grade}`, `{color}`, and `{count}` interpolated. The "Add Route" button remains enabled at all times during this phase.

**Layer 2 — Non-dismissable confirmation sheet (on submit tap)**: When the user taps "Add Route" and at least one duplicate candidate exists, the system shall, before any photo upload begins (the intercept point is strictly before `uploadRoutePhoto()` is called):
1. Present a non-dismissable bottom sheet. Swipe-to-dismiss is disabled — the user must tap a button to exit the sheet.
2. Display a `RouteCard` for each matching route. Each card shows: thumbnail photo (`photo_url`), route name (composed display name per AC-045), and section/area label (if present). The `RouteCardRoute` shape used is the existing `id, name, grade, photo_url, gymName` interface — no new data shape.
3. Display exactly two buttons at the bottom of the sheet:
   - **"Cancel"** (i18n key `routes.duplicateSheet.cancel`) — dismisses the sheet and returns the user to the form. No photo upload has started.
   - **"Add Route"** (i18n key `routes.duplicateSheet.confirm`) — dismisses the sheet and proceeds with the normal submit flow: `uploadRoutePhoto()` → route creation → navigation.
4. If the user taps "Add Route" on the sheet, the full submit flow executes as normal.

**When no duplicate candidates exist**: The submit flow proceeds immediately on button tap — no sheet is shown.

**Key constraint**: Photo upload (`uploadRoutePhoto()`) must never be called before the user taps "Add Route" on the confirmation sheet. The intercept must occur at the submit handler, before any upload is initiated.

**What is not changing**: The duplicate detection logic (grade + `color_tag` match within the same gym's `active` routes — the `useMemo` from the original AC-187 is reused). The data shown in RouteCards (existing `RouteCardRoute` shape: `id, name, grade, photo_url, gymName`). The `check_route_duplicate` RPC is already removed (was removed in a prior revision) — detection uses the already-fetched `activeRoutes` list. This is a client-side advisory check only — it is not a server-enforced gate, and a race in which two users submit the same grade + color concurrently is accepted (both routes are created, consistent with duplicates being allowed by design).

**AC-125** (new): The route detail screen shall display the gym's name as a subtitle directly beneath the route display-name title. The route detail screen shall not render a separate "岩館" (gym) section label or header; the gym name appears only as the subtitle.

**AC-126** (new): The route detail screen shall display the route's added date (`Route.created_at`) as a footer at the bottom of the screen, below all other route detail content.

**AC-127** (new): The route detail screen shall display a two-column send-summary section scoped to the logged-in user: a left "Sends" card showing the count of the user's ascents on this route where `style` is `flash` or `top`, and a right "Attempts" card showing the sum of the `attempts` column across all of the user's ascents on this route. Both values are sourced from MOD-004's public service (`fetchMyAscentsForRoute`).

**AC-128** (new): Tapping either summary card (Sends or Attempts, AC-127) on the route detail screen shall navigate the user to a Send History Detail screen for that route, passing the route identifier.

**AC-129** (new): The Send History Detail screen shall list all of the logged-in user's individual ascent records for the route (each showing at minimum style and attempts count), and shall provide a back control that returns the user to the route detail screen. Records are sourced from MOD-004's public service.

**AC-130** (new): The route detail screen shall present two action controls positioned below the send-summary section: a "Record Send History" control that launches the log-send flow (AC-010), and an "Upload Beta Video" control that launches the beta-video upload flow (AC-037). These replace any prior placement of the log-send and add-beta-video entry points on the screen.

---

### MOD-004 (Send Logging) Acceptance Criteria

**AC-010**: The system shall allow a user to log a send from an existing route detail page in ≤4 taps (route → log → style → confirm).

**AC-011**: The system shall save the log with `grade` derived from `Route.grade` at display time; no per-log grade value is stored. The log-send form shall not present a V-grade (or any grade) input field; grade is inherited from `Route.grade` at display time and is not selectable or editable when logging a send.

**AC-012**: The system shall, when the network request to save a send fails, display a clear error message to the user (Phase 1 does not queue sends offline).

**AC-013**: After a send is successfully logged, the ascent list on the route detail screen refreshes immediately to show the new entry without requiring re-navigation.

**AC-014** (new): The system shall restrict the ascent style selector to the fixed three-value enum {flash, top, attempt}. The `project` style is removed — it is not selectable in the UI and is not a valid value in the `ascent_style` database enum. Any historical ascent previously logged with `project` shall be treated as `attempt` (see §9 Data Model migration note).

**AC-131** (revised, Rev 41): `LogSendScreen` (MOD-004) shall display a route summary card at the top of the screen before the log-send form fields. The summary card shall show the route's grade and tape badge using the shared `TapeBadge` component from `src/lib/tape.ts`. The summary card is read-only — it is a contextual display only and is not an input. (Note: AC-011 governs the absence of a grade input field; AC-131 adds the read-only route summary card at the top of the log-send screen.)

**AC-132** (new): The log-send form shall not present a "set as private" (設為私人) toggle. All send records logged in Phase 1 are private: the system shall set `is_private = true` on every ascent insert. The `is_private` column remains in the schema (no migration), but it is not user-controllable in Phase 1.

**AC-193** (new, Rev 41, MOD-004): The ascent history list on the route detail screen (MOD-004) shall display an inline delete control on each ascent row — either a swipe-to-delete gesture or a visible delete icon (implementation choice left to the engineer). Tapping or activating the delete control shall call `deleteAscent(ascentId)` to remove that ascent record from the database; RLS own-rows-only enforcement (the `Ascent` table's RLS policy scopes deletes to `user_id = auth.uid()`) prevents deletion of another user's records. The UI shall apply an **optimistic removal** — the row is immediately hidden from the list before the server call resolves — and shall **revert the removal** (restore the row with an error message) if the `deleteAscent` call fails.

---

### MOD-005 (Beta Video) Acceptance Criteria

**AC-030**: The system shall reject beta video uploads longer than 60 seconds before upload begins.

**AC-031** (revised, Rev 29): The system shall select the beta video from the photo library using `preferredAssetRepresentationMode: Current` on the picker, so PHPickerViewController returns the original representation of the asset without iOS transcoding. The system shall upload the original native file as-is, with no client-side compression and no re-encoding, when the native file's size is under 45 MB. If the native file's size is 45 MB or greater, or the native file's size cannot be read, the system shall reject the upload before any upload attempt and display the bilingual error "影片檔案過大，請壓縮至 45MB 以下 / Video is too large, please keep it under 45 MB". There is no client-side compression step in Phase 1. The uploaded file retains its original container and codec (see AC-035 for the accepted container/codec set). **Phase 1 known limitation (accepted trade-off)**: HLG/HDR videos (BT.2020, Dolby Vision) may appear overexposed during playback in Phase 1 because expo-video's `VideoView` renders HLG content without extended display range (EDR) configuration — AVPlayer's default rendering path does not apply tone-mapping for HLG on SDR displays. This is an accepted Phase 1 limitation. The Phase 2 server-side MediaConvert pipeline (§4, §7) will correctly tone-map HDR→SDR and remove this limitation. The system shall generate a thumbnail on the client and upload it alongside the video. **Phase 1 simplification**: the thumbnail may use the selected video's URI as a placeholder rather than an extracted still frame; true client-side frame extraction is deferred to Phase 2. `BetaVideo.thumbnail_url` must still be populated with a valid, retrievable URL in Phase 1. (The size check and its fail-closed behavior are unchanged — see AC-169 for the gate's timing.)

**AC-032**: The system shall attach a beta video to exactly one `Route` and make it playable inline within 60 seconds of upload completion on a normal 4G/LTE connection.

**AC-033** (revised): The system shall display a route's beta videos on the route detail page and shall play a selected beta video without requiring the user to leave the app or open an external link. Videos are presented as a grid of thumbnails (AC-038) and played in an in-app fullscreen viewer launched on thumbnail tap (AC-039); no external link or browser is used.

**AC-034**: The system shall play beta videos inline in the activity feed for videos posted by followed users.

**AC-035** (revised): The system shall accept beta video uploads in either an MP4 (`.mp4`) or QuickTime (`.mov`) container — `.mov` is included so users can upload iPhone-camera footage without converting it first — and shall reject, on ingest, any upload whose video codec is not H.264 or HEVC or whose audio codec is not AAC, surfacing a clear error to the user rather than storing an unplayable file. Both containers are stored as-is (no server-side transcoding); the ≤60-second duration cap (AC-030) and size constraints apply regardless of container.

**AC-036** (revised, Rev 24): While a beta video is uploading, a progress overlay is displayed showing upload progress (0–100%). The overlay has a single "Uploading…" phase — there is no "Compressing…" phase, because Phase 1 performs no client-side compression (AC-031). The overlay blocks further interaction until the upload completes or fails, preventing double-submission.

**AC-037** (new): The system shall present an "Add beta video" entry point on the route detail screen that launches the beta video capture/selection flow with the route context (route ID) pre-attached, so the resulting upload is bound to that route (AC-032). The entry point must be visible without leaving the route detail screen.

**AC-038** (new): The route detail screen shall display the route's beta videos as a three-column grid. Each grid cell shall show only the video's thumbnail image with a small video-camera icon overlaid in the top-left corner, and no other metadata. Tapping a cell opens the fullscreen beta-video viewer (AC-039) for that video.

**AC-039** (revised): Tapping a beta-video thumbnail on the route detail screen shall open a fullscreen, portrait-orientation video viewer that auto-plays the tapped video. Within the viewer, swiping up shall advance to the next beta video for that route when one exists. Swiping down shall go to the previous beta video when a previous video exists, and otherwise (when the current video is the first in the set) shall dismiss the viewer and return to the route detail screen. Tapping the back control shall always dismiss the viewer and return to the route detail screen, from any position in the set. The viewer navigates only within the set of beta videos for the current route.

**AC-133** (new): The fullscreen beta-video viewer shall display a back control (a `<` chevron) fixed in the top-left corner that remains continuously visible and functional across every video in the reel, including while and after swiping to the next or previous video. The back control shall not unmount, disappear, or lose its tap target during or after a swipe transition.

**AC-134** (new): The fullscreen beta-video viewer shall display a bottom-left overlay, rendered over a gradient scrim for legibility, containing two rows: Row 1 — a small circular avatar (from the poster's `avatar_url`; placeholder circle if absent) and the poster's `display_name`; Row 2 — the composed string `{route_name} · {gym_name}`.

**AC-135** (revised): In the bottom-left overlay of the fullscreen beta-video viewer, tapping Row 1 (the circular avatar or the `display_name` text) shall dismiss the viewer and navigate the user to that video poster's profile (the MOD-008 other-user profile-and-history surface, AC-064), subject to the poster's privacy setting (AC-063). Navigation is threaded from the viewer to the profile surface via a callback prop supplied by the hosting shell, not by MOD-005 importing the profile screen directly.

**AC-136** (new): In the bottom-left overlay, tapping Row 2 (`{route_name} · {gym_name}`) shall navigate the user to the route detail screen for that video's route and dismiss the viewer.

**AC-137** (new): When the Row 2 text is wider than its container, the viewer shall auto-scroll it with a marquee animation implemented purely in JavaScript (React Native `Animated`); no new native package shall be introduced for the marquee. When the text fits, no animation runs.

**AC-138** (new): The fullscreen beta-video viewer's right sidebar shall contain exactly two action icons: the like icon with like count (AC-052), and the report icon (AC-139). The viewer shall not display share, download, comment, three-dot-menu, or any other action icons, and shall not display a bottom comment bar.

**AC-139** (new): The report icon in the right sidebar shall be shown only for beta videos the current user did not upload; it shall be hidden for the current user's own videos. It shall also be hidden (or permanently disabled and non-interactive) for any video where `report_dismissed = true`.

**AC-140** (new): Tapping the report icon on a beta video shall, in a single action: (1) set `beta_videos.is_reported = true` on that video's row via a SECURITY DEFINER RPC (so the reporter can flip a field on a row they do not own), and (2) insert exactly one row into the `video_reports` table capturing `beta_video_id`, `reporter_id`, and `reported_at`. No category or note is collected.

**AC-141** (new): A beta video with `is_reported = true` and `report_dismissed = false` shall be hidden from every user everywhere it is surfaced — route detail grid (AC-038), fullscreen viewer (AC-039), and activity feed (AC-051) — until an admin sets `report_dismissed = true`.

**AC-142** (new): The `fetchBetaVideosForRoute` query and any equivalent beta-video listing query shall exclude rows where `is_reported = true AND report_dismissed = false`.

**AC-143** (new): When an admin sets `beta_videos.report_dismissed = true` (via Supabase Studio), the video shall become visible again to all users on the next fetch, and the report affordance for that video shall be permanently hidden for all users (AC-139), preventing further reports.

**AC-144** (revised): The `fetchBetaVideosForRoute` result shall include the poster's `display_name` and `avatar_url` joined from the user record, so the viewer overlay (AC-134) can render poster identity without a second round-trip. The result shall also include the poster's `user_id` (UUID) on the same join, so the viewer has the poster's identifier for navigation per the revised AC-135. This `user_id` addition is a dependent edit required by the revised AC-135.

---

**AC-154** (new): In the route detail screen's beta-video list, the system shall filter out beta videos uploaded by users the viewer has blocked or who have blocked the viewer (block in either direction) before rendering, using MOD-009's public service `fetchBlockedUserIds()` as a client-side filter over the fetched beta-video set. This filter applies in addition to the reported-video exclusion (AC-142).

**AC-158** (new): The system shall exclude from every beta-video listing (the route-detail grid per AC-038/AC-142, the fullscreen viewer set per AC-039, and the activity feed per AC-051) any beta video whose poster has set `beta_video_privacy = followers_only` (AC-156) when the requesting viewer is neither the poster nor a follower of the poster. A viewer who is the poster, or who follows the poster, continues to see that poster's beta videos. This beta-video privacy filter applies in addition to the reported-video exclusion (AC-142) and the blocked-user filter (AC-154). The `beta_video_privacy` value is read from the poster's user record (joined on the existing `fetchBetaVideosForRoute` poster join, AC-144); the follower relationship is determined via the `Follow` table (the viewer is a follower when a `Follow` row exists with `follower_id = viewer` and `followee_id = poster`).

**AC-160** (new): The system shall provide a shared `BetaVideoGrid` component at `mod-beta-video/components/BetaVideoGrid.tsx` that renders a 3-column grid of beta-video thumbnails. Each cell shall show a Phase 1 placeholder: a gray background with a centered play-icon overlay on a dark gradient. The component's props shall be `videos: BetaVideo[]`, `onPressVideo: (index: number) => void`, and an optional `emptyState?: React.ReactNode`. Tapping a cell shall fire `onPressVideo(index)` with that cell's index. This component is owned by MOD-005 and consumed by MOD-006 (AC-163) and MOD-001 (AC-164).

**AC-161** (new): The system shall remove the per-video visibility toggle from `UploadBetaVideoScreen`. Beta-video visibility is an account-level setting (`beta_video_privacy`, AC-156/AC-157) and shall not be settable per upload.

**AC-162** (new): The system shall add a service function `fetchBetaVideosByUser(userId: string): Promise<BetaVideo[]>` to `mod-beta-video/beta-video-service.ts` that returns all beta videos uploaded by the given user across all routes, ordered by `created_at DESC`. This service is owned by MOD-005 and consumed by MOD-006 (AC-163) and MOD-001 (AC-164). The result remains subject to the existing visibility rules where surfaced (reported-video exclusion AC-142, blocked-user filter AC-154, and beta-video privacy AC-158 as applicable to the viewing context).

**AC-165** (new, DB migration): The system shall add a `UNIQUE (user_id, route_id)` constraint on the `beta_videos` table, enforcing one beta video per user per route at the database level. The migration file shall be `supabase/migrations/20260930000001_mod_005_beta_video_unique_per_route.sql`.

**AC-166** (revised, Rev 28): In `UploadBetaVideoScreen`, the upload control shall always be enabled and shall never be disabled on the basis of the user already having a beta video for the route (`hasExistingVideo`). When the user activates the upload control, the system shall first call the service check `checkExistingBetaVideo(routeId): Promise<boolean>` to determine whether the current user already has a beta video for this route:
- If an existing video is found (`hasExistingVideo === true`), the system shall present a confirmation dialog **before** opening the video picker. The dialog shall show the title "替換 Beta 影片" / "Replace Beta Video" (`betaVideo.replaceConfirmTitle`), the message "你已有此路線的 Beta 影片，繼續操作將會取代現有影片。" / "You already have a beta video for this route. If you proceed, the old video will be replaced." (`betaVideo.replaceConfirmMessage`), and exactly two actions: a destructive confirm "替換" / "Replace" (`betaVideo.replaceConfirmOk`) and a "取消" / "Cancel" (`betaVideo.replaceConfirmCancel`). Activating **Replace** shall dismiss the dialog and proceed with the normal flow (open the picker, select the video, upload). Activating **Cancel** shall dismiss the dialog and take no further action — the picker shall not open.
- If no existing video is found (`hasExistingVideo === false`), the system shall open the video picker directly with no confirmation dialog, as in the ordinary upload flow.

There shall be no disabled-button state and no "delete your existing video first" static message. The upload itself shall continue to use an upsert pattern (delete-old + insert, or `ON CONFLICT (user_id, route_id) DO UPDATE`) consistent with the AC-165 unique constraint — the database upsert (AC-165) handles the replacement. On a replace/upsert the system shall set `updated_at = NOW()` (`ON CONFLICT ... DO UPDATE SET ... updated_at = NOW()`, AC-188) so the beta video's "last activity" timestamp reflects the replacement time while `created_at` stays fixed at the original insert.

**Upload failure behavior (Rev 41)**: When a beta video upload fails, the upload progress modal shall remain open and shall display the error message together with a **Retry** button. The user may tap Retry to re-attempt the upload with the already-selected video file — the user shall not need to re-select the video from the picker to retry. Dismissing the modal manually (e.g. tapping a close/cancel control on the modal) shall cancel the upload and close the modal; no automatic retry is attempted on dismissal.

**AC-188** (new, Rev 38, MOD-005, DB migration): The system shall add an `updated_at timestamptz NOT NULL DEFAULT now()` column to the `beta_videos` table. On every upsert/replace of a beta video (the AC-166 replace flow), the system shall bump `updated_at = NOW()` via `ON CONFLICT (user_id, route_id) DO UPDATE SET ... updated_at = NOW()`, while `created_at` shall remain the original insert time and never change on replace. `updated_at` is the authoritative "last activity" / "last changed" timestamp for a beta video and shall be used anywhere the app needs "when was this video last changed" — notably the Home Following section's most-recent-activity timestamp, which uses `MAX(updated_at)` across a climber's beta videos (AC-182). **Tech Lead review required** — the migration adding the column and the upsert/RPC change to bump `updated_at` on conflict.

**AC-169** (revised, Rev 24): Before any upload is attempted — after format validation (AC-035) and the duration check (AC-030), and before the upload begins — the system shall read the native video file's size. If the native file size is greater than 45 MB, or the size cannot be read, the system shall not attempt the upload and shall reject it with the AC-031 error "影片檔案過大，請壓縮至 45MB 以下 / Video is too large, please keep it under 45 MB". The check shall fail closed: an unreadable size is treated as oversized and the upload is rejected. This upfront source-size gate replaces the former post-compression size guard (Phase 1 performs no compression, AC-031) and prevents an HTTP 413 from ever reaching the user as a cryptic error. The 45 MB threshold sits below the 50 MB Supabase Storage free-tier bucket ceiling to leave a safe margin.

**AC-170** (new, Rev 24): When beta-video storage usage in the Supabase `beta-videos` bucket reaches 800 MB — 80% of the 1 GB free-tier total shared across all Supabase Storage buckets — the system shall surface a storage-watch trigger for the operator (via monitoring and/or manual review) to begin evaluating the Phase 2 video infrastructure migration (§4, §7). This is an operational early-warning threshold; it does not block uploads at 800 MB.

### MOD-006 (Social Graph & Feed) Acceptance Criteria

**AC-050**: The system shall allow a user to follow and unfollow any other user (subject to Block; see AC-083) and reflect the change immediately in the follower's profile counts.

**AC-051**: The system shall include the followed user's subsequent sends and beta videos in the follower's activity feed within one refresh cycle of the follower opening or pull-refreshing the feed.

**AC-052**: The system shall allow a user to like exactly one time per beta video (idempotent) and immediately reflect the like count change on the video.

**AC-053**: The system shall not render a comment UI anywhere in the app in Phase 1 and shall not expose a like affordance on plain send logs.

**AC-146** (revised): The system shall provide a Followers list screen listing all users who follow the profile being viewed. Each list entry is a user card showing the user's circular avatar and `display_name` only — no per-card sends count or highest grade is displayed. Tapping a card navigates to that user's MOD-008 other-user profile surface (AC-064), subject to that user's privacy setting (AC-063). Blocked users are excluded (AC-082, AC-084).

**AC-147** (revised): The system shall provide a Following list screen with the same card layout as the Followers list screen (AC-146) — circular avatar and `display_name` only, no per-card sends count or highest grade — listing all users the profile owner follows. Tapping a card navigates to that user's MOD-008 other-user profile surface (AC-064), subject to privacy (AC-063). Blocked users are excluded.

**AC-148** (revised): The Followers and Following list cards (AC-146, AC-147) shall display the user's avatar and `display_name` only. Per-card sends count and highest grade are removed from the cards, and no per-card profile-stats fetch (`fetchProfileStats` / the `get_profile_stats` RPC) is made on list render. Aggregate profile stats are surfaced on the other-user profile screen instead (AC-149), not on the list cards.


**AC-149** (new): The other-user profile screen (`UserProfileScreen`, the profile overlay reached via `handleSelectClimber`) shall display, immediately after the follow/unfollow button, a stats section sourced from MOD-008's profile-stats public service (`fetchProfileStats(targetUserId)` from `mod-profile-history/history-service`). The section shall show the target user's total sends, accumulated days, highest grade, and a grade bar chart. This section shall not render any route cards. This is subject to the target user's privacy setting (AC-063): a `followers_only` profile requested by a non-follower shows the hidden/403 state per AC-064 rather than the stats section.
**AC-150** (revised, Rev 41): The other-user profile screen (`UserProfileScreen`, the profile overlay reached via `handleSelectClimber`) shall display a three-dots icon (⋮) fixed in the top-right corner. Tapping it shall open a bottom action sheet rendered over a translucent background overlay that blocks interaction with the underlying screen until the sheet is dismissed. The sheet shall contain exactly two options: **"Report and block"** (i18n key `moderation.sheetReport`; underlying action per AC-151 — unchanged: files a report and blocks the user) and a block toggle labeled "Block" when the viewer has not blocked this user or "Unblock" when the viewer has already blocked this user (AC-152). The label change from "Report" to "Report and block" makes the combined report-and-block action (AC-151) explicit to the user; the underlying behavior of AC-151 is unchanged. This three-dots sheet replaces any prior placement of the report and block controls on the other-user profile surface. The three-dots icon is shown even when the profile is in the blocked state (AC-153), so the viewer can unblock.

**AC-152** (new): Selecting the block toggle in the three-dots sheet (AC-150) shall, when labeled "Block", call `blockUser` (MOD-009) to block the target user only, with no admin report; when labeled "Unblock", it shall call `unblockUser` (MOD-009) to remove the block. Block behavior is symmetric per the existing `Block` database trigger: on block, any follow relationship is removed in both directions, and neither party can follow the other while the block is in effect; on unblock, the block is lifted (follows are not automatically restored). After the action completes, the profile shall immediately reflect the new state (blocked → AC-153 unavailable state; unblocked → normal profile content) and the sheet toggle label shall update accordingly.

**AC-153** (new): When `UserProfileScreen` (AC-150) loads, it shall check whether either party has blocked the other using MOD-009's public service (`isBlocked` / `fetchBlockedUserIds`). If a block exists in either direction, the screen shall display a "This profile isn't available" message in place of the profile content: the follow/unfollow button and the stats section (AC-149) shall be hidden. The three-dots icon (AC-150) shall still be shown so the viewer can unblock the user (AC-152).

**AC-159** (new): The social activity feed UI is formally deferred to Phase 2. `FeedScreen.tsx` in `mod-social-feed/screens/` and the `get_activity_feed` RPC shall remain in the codebase as dead code but shall never be imported or rendered in any navigator or shell, with zero runtime impact and no new wiring to `HomeScreen`.

**AC-163** (new, MOD-006 + MOD-005): The `UserProfileScreen` (the other-user profile overlay reached via `handleSelectClimber`) shall display a 3-column `BetaVideoGrid` (AC-160) below the stats section (AC-149), showing all beta videos by that user fetched via `fetchBetaVideosByUser` (AC-162). Tapping a cell shall open `BetaVideoReelViewer` cycling through that user's videos, starting at the tapped index. In this context the viewer is passed `reelContext = 'profile'` (AC-164): the poster-identity row is visible but NOT tappable (no navigation on tap). This grid is subject to the target user's privacy setting (AC-063): a `followers_only` profile requested by a non-follower shows the hidden/403 state (AC-064) rather than the grid. MOD-006 consumes MOD-005's `BetaVideoGrid`, `fetchBetaVideosByUser`, and `BetaVideoReelViewer`.

**AC-186** (new, Rev 36, MOD-006, Phase 1 — deferred): The system shall provide a batched like-info RPC `get_like_info_batch(beta_video_ids uuid[])` that, for the current user, returns in a single round-trip the per-video like count and the current user's own like state (liked / not liked) for each supplied beta-video id, so that a list or grid of beta videos can resolve all like counts and like states without issuing one query per video (eliminating the per-card N+1 like-info lookups). The RPC is `SECURITY INVOKER` and remains subject to the existing beta-video visibility rules (reported-video exclusion AC-142, blocked-user filter AC-154, beta-video privacy AC-158); it does not expose like info for videos the caller cannot see. The single-video like affordance and its idempotent one-like-per-video semantics (AC-052) are unchanged — this AC adds only a batched read path for like info. **Phase 1 status — deferred**: `get_like_info_batch` is introduced now for the data-access/caching convention (§10) and performance of beta-video grids, but its implementation and wiring are deferred within Phase 1; callers continue to use the existing per-video like-info path until the batched RPC is implemented, at which point it supersedes the per-card lookups with zero change to AC-052 behavior. **This is a new Postgres RPC and requires Tech Lead architecture review** (RPC signature/return shape, the visibility-composition inside the RPC, and the `SECURITY INVOKER` + RLS interaction) before Doc-Sync/Engineering implements it.

> **Implementation note (MOD-006 feed query)**: The activity feed must be served by a `SECURITY INVOKER` Postgres RPC that explicitly composes Follow ∩ (¬Block, symmetric) ∩ privacy (followers-only visibility), not by a raw client-side table `SELECT`. RLS remains the security fence; the RPC performs the composition. This is a requirement, not an option, for MOD-006. **Phase 1 status (AC-159)**: the feed UI (`FeedScreen.tsx`) and this `get_activity_feed` RPC are deferred to Phase 2 — they remain in the codebase as dead code and are never imported or rendered in Phase 1.

---

### MOD-007 (Notifications) Acceptance Criteria

**AC-054**: The system shall register the user's iOS device token on first successful sign-in and store it in `DeviceToken`, deduplicated per (user_id, device_token) pair.

**AC-055**: The system shall, on insert of a `Reaction` with `target_type = beta_video`, insert exactly one `Notification` row for the video's uploader and enqueue exactly one APNs push per registered active device token belonging to the uploader, gated by the uploader's `NotificationPreference.beta_video_like`.

**AC-056**: The system shall deliver the beta-video-like push notification within 30 seconds of the like event for ≥95% of likes measured over a 24-hour rolling window.

**AC-057**: The system shall expose a Settings screen toggle for beta-video-like push notifications; when the toggle is off, no push is enqueued for that user for that event type, but the in-app `Notification` row is still created.

**AC-058** (revised, Rev 32): The system shall navigate a user from a beta-video-like entry in the in-app notification inbox to the **UserProfileScreen of the actor** (the user who liked the video) when the user taps the entry, resolving the notification's existing `actor_user_id` column directly — no additional query is required, as `actor_user_id` is already present on the `Notification` row (see §9 Data Model). The destination is MOD-006's `UserProfileScreen` (the other-user profile overlay, AC-064), subject to the actor's privacy setting (AC-063). This supersedes the prior AC-058 behavior of navigating to the liked video's route detail screen. No changes to MOD-003 or MOD-005 are required.

**AC-171** (revised, Rev 41): The system shall present a notification bell in the global app-level header (right side, grouped with the settings icon per AC-184 revised), on every screen where that header is shown. Tapping the bell shall push a new `NotificationInboxScreen` (owned by MOD-007) that lists the current user's in-app notifications, most recent first. The `NotificationInboxScreen` and its contents are owned by MOD-007; the bell entry point now lives in MOD-012's global header (AC-184), not in MOD-001's ProfileScreen header (this supersedes the Rev 33 placement in the ProfileScreen header). The bell is wired to navigate to MOD-007's inbox screen.

**AC-172** (new, Rev 32): When `NotificationInboxScreen` mounts, the system shall mark all of the current user's unread notifications as read in a single batch update — all `Notification` rows where `recipient_user_id` equals the current user and `is_read = false` are set to `is_read = true`. Tapping an individual notification row shall not separately change that row's read state; the batch mark-read on inbox mount is the sole read-state transition in Phase 1.

**AC-173** (revised, Rev 35): The notification bell in the global app-level header (AC-184, AC-171 revised) shall display an unread-count badge when the current user has one or more unread notifications (`Notification` rows where `recipient_user_id` equals the current user and `is_read = false`). The badge value shall equal the number of unread rows. The badge shall disappear when the inbox is opened and the batch mark-read (AC-172) completes. (This supersedes the Rev 32 placement of the badge on the ProfileScreen-header bell.)

> **Implementation note (MOD-007 push idempotency)**: The notification/push fan-out Edge Function must be invoked by a Postgres trigger on `Reaction` INSERT (via `pg_net`/webhook), never triggered from the client. The function must be idempotent: a unique constraint on `Notification(recipient_user_id, actor_user_id, type, target_id)` guarantees a second trigger fire (double-tap / client retry) cannot create a duplicate notification row or a duplicate push. This is a requirement for the MOD-007 spec.

---

### MOD-008 (Profile History & Stats) Acceptance Criteria

**AC-060**: The system shall render the current user's full send history filterable by gym, grade, and date range.

**AC-061**: The system shall render basic stats: total sends, sends by grade (bar chart), current streak (consecutive days with ≥1 send), and highest grade climbed. **i18n key rename (Rev 41)**: the profile history stats section's "this year" display label uses the i18n key `lastYear` (renamed from the former `thisYear`); both `locales/en/common.json` and `locales/zh-TW/common.json` shall rename the key from `thisYear` to `lastYear` (label values unchanged).

**AC-062**: The system shall recalculate stats immediately after a new send log is saved and re-render the stats view without requiring a manual refresh.

**AC-064** (new): The system shall navigate a user from another user's entry in the activity feed (or any surfaced user reference, e.g. a beta video author or follower) to that user's profile and send history, subject to the target's privacy setting (AC-063): a `followers_only` profile requested by a non-follower shows the hidden/403 state rather than the send history.

**AC-065** (new): The system shall display an achievement icon for each logged send in the send history, mapped from the send's ascent style: `flash` → a flash (⚡) achievement icon, `top` → a send/top-out achievement icon, and `attempt` → a project/tried achievement icon (🎯). The icon set covers exactly the three ascent styles (there is no `project` style; the former `project` achievement maps to the `attempt` style per AC-014).

---

### MOD-009 (Moderation — Report & Block) Acceptance Criteria

**AC-080** (revised): The system shall persist a **user-profile** report to the `Report` table for admin review in Supabase Studio. In Phase 1 the profile Report action is invoked from the `UserProfileScreen` three-dots sheet (AC-150) and both files this report record and blocks the reported user in a single action (AC-151); the category defaults to a general "inappropriate" value and no note is collected in that flow (the `category` and `note` columns remain in the `Report` schema for admin/back-compat use). (Beta-video reporting is not handled here — it is handled by the AC-140 one-tap flow in MOD-005, which writes to `beta_videos.is_reported` + the `VideoReport` table with no category or note.)

**AC-081**: The system shall show the reporter a confirmation state after a successful report submission and shall not require admin action to complete the report flow.

**AC-082**: The system shall allow a user to block another user, persist the relationship in the `Block` table, and immediately hide the blocked user's beta videos, sends, and profile from the blocker's feed and route pages.

**AC-083**: The system shall prevent a blocked user from following the blocker, liking the blocker's beta videos, or otherwise interacting with the blocker's content.

**AC-084**: The system shall apply block hiding symmetrically — the blocker's beta videos, sends, and profile shall also be hidden from the blocked user's feed and route pages, in addition to hiding the blocked user's content from the blocker (App Store Guideline 1.2 requirement).

**AC-085** (revised, Rev 34): The system shall run a scheduled Edge Function (every 6 hours) that emails the admin (wu.tsan@northeastern.edu) a digest of all open reports (`Report.status = open`) older than 12 hours, so the solo operator is alerted to unresolved objectionable-content reports within the App Store Guideline 1.2 response window. This digest covers the `Report` table only (user-profile and beta-video content reports filed via AC-080); it does not include the `VideoReport` table (beta-video reports filed via AC-140), which the admin reviews manually in Supabase Studio. **Phase 1 deferral (accepted, not a bug)**: real email delivery (Resend/SMTP) and a registered cron schedule are deferred to post-launch and are NOT required before App Store submission. App Store Guideline 1.2 requires a report UI and a stated commitment to respond within 24 hours — it does not require a technical alerting mechanism. For Phase 1's small user base, the operator (wu.tsan@northeastern.edu) manually checks Supabase Studio for open reports. The `report-digest` Edge Function exists and queries the `Report` table correctly but only `console.log`s the digest in Phase 1; this stub is accepted for Phase 1. Real email delivery and cron registration are deferred post-launch, to be revisited when report volume warrants automation.

---

**AC-151** (new): Selecting "Report" in the three-dots sheet (AC-150) shall, in a single user action, both notify the admin and block the reported user: the system shall call `reportUser` (persisting a report record to the `Report` table for admin review per AC-080) and `blockUser` (AC-082) sequentially for the target user. This report-and-block behavior replaces the prior report-only profile action. The user shall see a confirmation, and the profile shall immediately show the blocked state (AC-153).

### MOD-010 (Localization & Theming) Acceptance Criteria

**AC-090**: The system shall detect the device locale on first launch, set the app language to English if the device locale is English, and otherwise fall back to Traditional Chinese (zh-TW).

**AC-091**: The system shall expose a language toggle in Settings between English and zh-TW that takes effect immediately without an app restart.

**AC-092**: The system shall default to the OS Light/Dark appearance and expose a Settings override with three states (System, Light, Dark) that takes effect immediately without an app restart.

**AC-155** (new): The Settings screen (SettingsScreen) shall present a "Blocked Accounts" tappable row at the bottom of its existing sections. Tapping the row shall open a Blocked Accounts screen (BlockedAccountsScreen) that lists the users the current user has blocked (rows where `blocker_user_id = auth.uid()`), each entry showing a circular avatar, the user's `display_name`, and an "Unblock" button. Tapping "Unblock" shall call `unblockUser(userId)` (MOD-009, AC-152) and remove that entry from the list. When the current user has blocked no one, the screen shall display an empty state. Navigation to and from the Blocked Accounts screen is managed internally within SettingsScreen as a sub-view state (the same navigator pattern used elsewhere), with no ProfileNavigator view-state change. The blocked-users list is sourced from MOD-009's public service `fetchMyBlockedUsers()`.

**AC-157** (new): The Settings screen (SettingsScreen) shall present a "Beta Video Privacy" toggle row with two states — `public` (default) and `followers_only` — reflecting the current user's `beta_video_privacy` value (AC-156). Changing the toggle shall call MOD-001's public service function to update the current user's `beta_video_privacy` column (MOD-001 owns the write) and reflect the new state immediately. This row is the only user-facing privacy control. Profile visibility (`privacy_setting`) is always public and has no user-facing toggle (AC-063).

**AC-168** (new): The SettingsScreen shall present a Logout button at the very bottom, below all other rows (including the "Beta Video Privacy" toggle, AC-157, and the "Blocked Accounts" row, AC-155). The button shall use the same styling as the former ProfileScreen logout button (error color, outlined) and the same `signOut()` call and error-handling pattern. This is the relocation target for the Logout control removed from ProfileScreen (AC-167).

**AC-199** (new, Rev 47, MOD-010): The app's name is "ProjectDay" (one word, capital P and D) in both English and zh-TW; it has no Chinese form. No user-facing text in either locale catalog (English, zh-TW), and no push-notification or email text the system sends, shall contain the phrase "Send It". Where a string used "Send It" as the app's name, it shall say "ProjectDay" instead. The climbing verb "send" (for example "log a send", the Send Logging flow) is not the app name and is unchanged.

---

### MOD-011 (Analytics) Acceptance Criteria

**AC-100**: The system shall emit PostHog events for at minimum: signup completed, gym saved, first send logged, first beta video uploaded, beta video liked, session start.

**AC-101**: The system shall not send PII beyond `user_id` and non-identifying context fields to PostHog.

---

### MOD-012 (Home) Acceptance Criteria

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

**AC-179** (new, Rev 35): When the current user opens a route's detail screen (RouteDetailScreen, MOD-003), the system shall upsert a row into a `user_route_visits` table keyed on `(user_id, route_id)`, setting `last_viewed_at` to the current time. This per-user route-visit record backs the most-recently-viewed ordering (AC-175, via the route's gym) and the "new beta video" tag logic (AC-180). **This introduces a new `user_route_visits` table and requires Tech Lead architecture review** (table placement/ownership, composite-key upsert pattern, read/write-own-rows-only RLS, grants, and the cross-module query that reads it) before Doc-Sync/Engineering implements it.

**AC-180** (new, Rev 35): The system shall determine whether a route has a "new beta video" for the current user by comparing the route's beta videos' `created_at` against the current user's `user_route_visits.last_viewed_at` for that route (AC-179): a route qualifies for the tag when at least one of its visible beta videos has `created_at` greater than the user's `last_viewed_at`, OR when the user has no `user_route_visits` row for that route at all (never visited). The set of "visible beta videos" respects the existing beta-video visibility rules (reported-video exclusion AC-142, blocked-user filter AC-154, and beta-video privacy AC-158). **This logic reads `user_route_visits` (AC-179) and performs a cross-module query against beta videos (MOD-005); it requires Tech Lead architecture review** to assign the owning module for the tag computation and to specify the query shape, consistent with the AC-179 table review. **Clarifying note (Rev 36, visibility-filter scope — Option B)**: the "visible beta videos" set used by this tag computation is scoped per the current viewing user: a beta video counts toward the "new beta video" tag only when it would be visible to that specific user under the full beta-video visibility rules (reported-video exclusion AC-142, blocked-user filter AC-154 evaluated for this viewer, and beta-video privacy AC-158 evaluated for this viewer-vs-poster follower relationship). A route therefore does not qualify for the tag on the strength of a beta video the current user cannot see. This is a scope clarification only — it does not change AC-180's qualification logic (newer `created_at` than `last_viewed_at`, or no visit row) beyond fixing which videos are in scope for the comparison, and it remains subject to the same Tech Lead architecture review as the rest of AC-180.

**AC-181** (revised, Rev 39): The shared route card (AC-183) shall no longer render a "new beta video" chip. The `hasNewBetaVideo` prop is removed from the route card's props and no "new beta video" chip is rendered on any surface that uses the card (the Home screen's Projecting Routes section, AC-177; and the gym route list, RouteListScreen, MOD-003). The underlying per-user route-visit data (`user_route_visits`, AC-179) and the `fetchRoutesWithNewBeta` service remain unchanged in the codebase — they are still needed for the most-recently-viewed Saved Gyms ordering (AC-175). (This supersedes the Rev 35 "new beta video" tag rendering: the chip is removed from the card UI while the backing infrastructure is retained.)

**AC-182** (revised, Rev 38): The Home screen shall render a Following activity section with one row per followed climber (sourced from MOD-006) who has uploaded or replaced at least one beta video. Each row shows the climber's avatar, `display_name`, a fixed label "new video upload" (i18n key `home.following.newUpload`, "新影片上傳" / "new video upload") — **no video count is displayed** — and the relative timestamp of that climber's most recent beta-video activity, computed as `MAX(updated_at)` across all of that climber's beta videos (AC-188). Tapping a row shall navigate the user to that climber's `UserProfileScreen` (MOD-006). When the current user follows no one, or no followed climber has any beta video, the section shall display an appropriate empty state. This supersedes the Rev 35 per-user "X new beta video(s)" count design and replaces the former Following Climbers strip (AC-123/AC-124, removed). **Tech Lead review required** — the query now uses `updated_at` (not `created_at`) with a `MAX(updated_at)` aggregate per followed climber.

**AC-183** (new, Rev 35): The system shall provide a shared route card component that renders a route with a fixed small square thumbnail on the right sourced from the route's existing `photo_url` field (no schema change). The shared route card shall be used in the Home screen's Projecting Routes section (AC-177), the gym route list (RouteListScreen, MOD-003), and the profile send-history section (MOD-008). The card also renders the "new beta video" tag when the route qualifies (AC-181). **This is a shared cross-module component and requires Tech Lead architecture review to assign the owning module** (and the consuming modules' import contract) before Doc-Sync/Engineering implements it.

**AC-184** (revised, Rev 41): The system shall render a global app-level header on all screens EXCEPT the fullscreen beta-video reel viewer (AC-133) and the auth/signed-out screens. The header layout is: **left side** = the screen title or a back button (contextual, per screen); **right side** = the notification bell and the settings icon rendered together as a group — bell wired to MOD-007's `NotificationInboxScreen` (AC-171, carrying the unread-count badge per AC-173), settings icon navigating to MOD-010's SettingsScreen. The notification bell and settings icon always appear together on the right; neither appears on the left. **This is an app-level, cross-cutting UI surface and requires Tech Lead architecture review to assign the owning module** (proposed: MOD-012 per `AppHeaderContext` convention — see `src/lib/AppHeaderContext.ts`; screens use `useAppHeader()`; overlays use `AppHeaderOverlayScope`; AppShell root uses `useAppHeaderRoot()`; direct prop-drilling prohibited) and specify where the header mounts relative to the tab shell and each navigator, before Doc-Sync/Engineering implements it.

**AC-185** (new, Rev 35): The system shall support a swipe left-to-right back gesture on every screen that displays a back icon; the gesture shall perform the same navigation-pop action as tapping that screen's back control. This is a behavioral requirement only — the implementation library/approach is deferred to the Tech Lead and recorded in `production.md`. **This is a cross-cutting navigation behavior and requires Tech Lead architecture review to assign the owning module** and choose the gesture implementation approach before Doc-Sync/Engineering implements it.

**AC-189** (new, Rev 39, MOD-012 shared route card): The shared route card (AC-183) shall accept a `betaVideoCount: number` prop (default `0`). When `betaVideoCount > 0`, the card shall render a subtitle line reading "{count} Beta Videos" (i18n key `routeCard.betaCount`, with `{{count}}` interpolation). When `betaVideoCount === 0`, no subtitle line is rendered. Callers (RouteListScreen in MOD-003, HomeScreen in MOD-012) are responsible for fetching and passing this count; the card itself does not fetch it. The count shall be fetched in a single batched call for all visible routes, not per-card (no N+1 lookup), consistent with the §10 batched-reads convention. **Implementation (Rev 40, Tech Lead review 2026-10-15)**: callers must NOT use a client-side `.in('route_id', ids)` + JS count reduce. The count must respect the same beta-video visibility fence as all other beta reads (reported exclusion AC-142, symmetric block filter AC-154, followers-only privacy AC-158). The correct approach is a new `count_beta_videos_by_routes(route_ids uuid[])` SECURITY INVOKER RPC that clones the visibility predicate body from the `routes_with_new_beta` migration, with `COUNT(*) GROUP BY bv.route_id` replacing the `SELECT DISTINCT` and the recency clause dropped. The RPC returns `{route_id, beta_count}[]`. A new migration is required. MOD-003 owns the migration; the MOD-003 engineer adds a `fetchBetaVideoCounts(routeIds): Promise<Record<string, number>>` wrapper in `route-service.ts`.

**AC-190** (new, Rev 39, MOD-012 shared route card): The shared route card (AC-183) shall accept a `hasSend: boolean` prop (default `false`) and a `sendStyle: 'flash' | 'top' | null` prop (default `null`). When `hasSend` is `true`, the card shall render a single small "send" badge: if `sendStyle === 'flash'` a flash badge (gold color), and if `sendStyle === 'top'` a top badge (green/success color). Only one badge is shown at a time (the highest-priority one). "Has sent" means the user has flashed or topped the route (an attempt does not count as a send). Callers fetch the current user's ascents via MOD-004's existing service and derive `hasSend` and `sendStyle` client-side: the client checks whether any of the user's ascent styles on the route is `flash` or `top`; if both a `flash` and a `top` exist, `sendStyle = 'flash'` (flash takes priority over top). The fetch shall be batched for all visible routes, not per-card (no N+1 lookup), consistent with the §10 batched-reads convention. (i18n keys `routeCard.flashSend` / `routeCard.topSend`.) **Implementation (Rev 40, Tech Lead review 2026-10-15)**: callers reuse MOD-004's existing `fetchUserAchievements(routeIds)` (already in `send-service.ts`) — already batched, user-scoped via an explicit `.eq('user_id', …)` predicate, and enforces flash > top precedence client-side. No new RPC or migration is needed. RouteListScreen and HomeScreen both call it once per load and derive `hasSend` / `sendStyle` per `route_id`.

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

## 9. Data Model

```
User
 - id, display_name, avatar_url,
   bio, privacy_setting (always 'public', no user toggle — retained for schema compat, AC-063),
   beta_video_privacy (public | followers_only, default public), created_at
   -- privacy_setting is ALWAYS 'public' in Phase 1 — there is no user-facing
   --   toggle and no followers_only enforcement (AC-063). The column is retained
   --   in the schema for potential future use only; do not read it as an access
   --   gate in any query or RLS policy.
   -- beta_video_privacy is a SEPARATE, independent control (AC-156) governing
   --   beta-video visibility only: when followers_only, the user's beta videos
   --   are visible only to the user and their followers (AC-158); when public
   --   (default), visible to all. MOD-001 owns the write (public service);
   --   MOD-010's SettingsScreen calls it (AC-157). Adding this column requires
   --   a migration.

Gym  (admin-maintained, branch-level rows for multi-branch gyms)
 - id, name, branch_label (nullable, e.g. "萬華", "南港"), city, district,
   address_text, lat, lng, gym_type (bouldering | top_rope | both),
   photo_url (nullable), official_grading_system (default 'V'),
   cover_photo_url (TEXT, nullable — populated by the one-time Places API seeder,
     AC-195; overwritable by official gym photo in a later cooperation phase.
     NULL = initials avatar fallback shown per AC-197/AC-198.),
   google_place_id (TEXT, nullable — stored by the seeder for future use;
     not surfaced in the UI in Phase 1.),
   created_at, updated_at

SavedGym  (join table — a user's bookmarked gyms)
 - user_id (FK User, ON DELETE CASCADE), gym_id (FK Gym, ON DELETE CASCADE),
   created_at
 - PK: (user_id, gym_id)

SavedRoute  (join table — a user's bookmarked routes)
 - user_id (FK User, ON DELETE CASCADE), route_id (FK Route, ON DELETE CASCADE),
   created_at
 - PK: (user_id, route_id)

UserRouteVisits  (per-user route-visit tracking — NEW, requires Tech Lead review)
 - user_id (FK User, ON DELETE CASCADE), route_id (FK Route, ON DELETE CASCADE),
   last_viewed_at (timestamptz)
 - PK: (user_id, route_id)
   -- Upserted on route detail open (AC-179): on open, set last_viewed_at = now()
   --   for (current user, route). Backs the Home "new beta video" tag (AC-180:
   --   a route qualifies when a visible beta video's created_at > last_viewed_at,
   --   or when no visit row exists for that (user, route)) and the most-recently-
   --   viewed Saved Gyms ordering (AC-175, via the route's gym).
   -- NEW table — requires a migration AND Tech Lead architecture review
   --   (table placement/ownership, composite-key upsert, own-rows-only RLS,
   --   grants, and the cross-module read against beta videos for AC-180).
   -- RLS: own-rows-only — an authenticated user may read and write only rows
   --   where user_id = auth.uid().

GymRequest
 - id, requested_by_user_id, name, city, google_maps_url (nullable),
   status (pending | added | rejected), created_at, reviewed_at (nullable)

Route
 - id, gym_id (FK Gym), section_label (nullable), grade (V-scale enum),
   color_tag (enum: red|orange|yellow|green|blue|purple|pink|white|black — required),
   photo_url (required),
   status (route_status enum: active | pending | retired | rejected),
   -- Route identity is `id` ONLY (Rev 37). There is NO uniqueness constraint and
   --   NO unique index on (gym_id, grade, color_tag): real gyms routinely run
   --   multiple same-grade/same-color routes at once (e.g. two red V5s on different
   --   walls), so duplicates are allowed by design (AC-020). The former active-only
   --   unique index `routes_active_unique_idx` is DROPPED (migration + Tech Lead review).
   -- There is NO `match_key` column: it appeared in earlier planning docs but was
   --   NEVER implemented in the database and has been removed from this PRD (Rev 37).
   -- Data quality is kept with a non-blocking two-layer duplicate guard at submission
   --   (AC-187), not a hard constraint. The AC-187 candidate list uses (gym_id, grade,
   --   color_tag) directly over `active` routes via useMemo on the fetched activeRoutes. A plain (non-unique) index on
   --   (gym_id, grade, color_tag) may back that count query (Tech-Lead-decided).
   submitted_by_user_id (FK User),
   created_at, retired_at (nullable), retired_by_user_id (nullable, FK User)
   -- A route's display name is NOT a stored column. It is composed at display time
   -- from grade + color_tag (+ section_label when present), e.g. "V3 Blue" or
   -- "V3 Blue (Cave)" (AC-045). There is no free-text, user-editable route name.
   -- route_status values:
   --   active   = live and climbable; visible to all users.
   --              Set by the system (auto-approve ON) or by an admin.
   --   pending  = awaiting admin approval; created by the system when
   --              auto-approve is OFF on submission. Visible only to the
   --              submitter (read-only). A submitter may withdraw a pending
   --              route, which DELETES the row. A user cannot hold two pending
   --              submissions for the same (gym_id, grade, color_tag).
   --   retired  = route no longer on the wall (wall reset / removed).
   --              Admin-only, set via Supabase Studio. Never shown to normal users.
   --   rejected = admin-moderated off (bad data / inappropriate). Admin-only,
   --              set via Supabase Studio. Never shown to normal users.
   -- Auto-approve defaults ON at Phase 1 launch. Only 'active' routes appear in
   -- the normal-user route list and in the AC-187 duplicate guard candidate list.

Ascent (a "log")
 - id, user_id (FK User), route_id (FK Route),
   style (ascent_style enum: flash | top | attempt), attempts,
   note, logged_at, is_private
   -- is_private is ALWAYS true in Phase 1 — the system sets it on every insert;
   -- it is NOT user-controllable (no "set as private" toggle in the log-send
   -- form, per AC-132). The column is retained in the schema (no migration) for
   -- Phase 2, when a public/shared visibility toggle may be introduced.
   -- grade is NOT stored per-log; always read from route.grade at display time
   -- The 'project' ascent style is REMOVED. ascent_style has exactly three
   -- values (flash | top | attempt). See migration note below.

BetaVideo
 - id, route_id (FK Route), user_id (FK User),
   video_url, thumbnail_url, duration_seconds, caption, created_at,
   updated_at (timestamptz NOT NULL DEFAULT now()),
   is_reported (boolean NOT NULL DEFAULT false),
   report_dismissed (boolean NOT NULL DEFAULT false)
   -- is_reported: set true via a SECURITY DEFINER RPC when any user files a
   --   one-tap report (AC-140). The reporter does not own the row, so the flip
   --   must go through a SECURITY DEFINER RPC, not a direct UPDATE.
   -- report_dismissed: set true only by an admin via Supabase Studio (AC-143),
   --   which un-hides the video for all users and permanently hides the report
   --   affordance (AC-139), preventing further reports.
   -- Visibility rule (AC-141/AC-142): a row with is_reported = true AND
   --   report_dismissed = false is hidden from every user everywhere it is
   --   surfaced (route detail grid, fullscreen viewer, activity feed).
   --   Requires a migration to add the two new columns.
   -- Unique: (user_id, route_id) -- one beta video per user per route, enforced at
   --   the DB level (AC-165). Migration: 20260930000001_mod_005_beta_video_unique_per_route.sql.
   --   The upload flow is upsert/replace (AC-166): if a user already has a video
   --   for the route, confirming replaces it (delete-old + insert, or ON CONFLICT
   --   DO UPDATE). Per-upload visibility toggle removed (AC-161) -- visibility is the
   --   account-level users.beta_video_privacy setting (AC-156/AC-157).
   -- updated_at (AC-188, Rev 38, requires a migration): the authoritative "last
   --   activity" / "last changed" timestamp for a beta video. On upsert/replace
   --   (AC-166) the upsert bumps updated_at = NOW() via
   --   ON CONFLICT (user_id, route_id) DO UPDATE SET ... updated_at = NOW();
   --   created_at stays fixed at the original insert. Used wherever the app needs
   --   "when was this video last changed", notably the Home Following section's
   --   most-recent-activity timestamp MAX(updated_at) per climber (AC-182).
   --   Tech Lead review required (the column migration + the on-conflict bump).
   -- Upload size (AC-169, Rev 24, no schema change): Phase 1 performs NO
   --   client-side compression (AC-031). Before upload, the client reads the
   --   native file size; if it is >= 45 MB or unreadable (fail-closed), the
   --   upload is blocked with the bilingual "影片檔案過大，請壓縮至 45MB 以下 /
   --   Video is too large, please keep it under 45 MB" error. The 45 MB gate
   --   sits below the 50 MB free-tier bucket ceiling, so HTTP 413 never reaches
   --   the user. react-native-compressor is removed from the project entirely.
   -- Storage watch (AC-170): at 800 MB of beta-video storage (80% of the 1 GB
   --   free-tier total) an operator trigger fires to evaluate the Phase 2
   --   migration (AWS S3 + CloudFront + MediaConvert, see Tech Stack / Phase 2).

VideoReport  (beta-video one-tap reports — App Store Guideline 1.2)
 - id (uuid PK),
   beta_video_id (uuid NOT NULL, FK beta_videos(id) ON DELETE CASCADE),
   reporter_id (uuid NOT NULL, FK users(id)),
   reported_at (timestamptz NOT NULL DEFAULT now())
 - Unique: (beta_video_id, reporter_id) — prevents duplicate reports from the
   same user on the same video.
   -- Written by the AC-140 one-tap report flow (no category, no note).
   -- RLS: authenticated users may INSERT their own rows (reporter_id = auth.uid()).
   -- Reviewed manually by the admin in Supabase Studio; NOT included in the
   --   AC-085 6-hourly email digest (which covers the Report table only).
   -- Coexists with the Report table (Report = user-profile + category/note
   --   reports via AC-080; VideoReport = beta-video one-tap reports via AC-140).

Follow
 - follower_id (FK User), followee_id (FK User), created_at
 - PK: (follower_id, followee_id)

Reaction  (Phase 1: beta videos only)
 - id, user_id (FK User),
   target_type (beta_video),
   target_id, created_at
 - Unique: (user_id, target_type, target_id) — enforces idempotent single like

Notification  (Phase 1: beta-video likes only)
 - id, recipient_user_id (FK User), actor_user_id (FK User),
   type (beta_video_like),
   target_type (beta_video), target_id,
   is_read, created_at

DeviceToken  (Phase 1: iOS APNs via Expo Push)
 - id, user_id (FK User), platform ('ios'),
   device_token, expo_push_token (nullable),
   is_active, created_at, last_seen_at
 - Unique: (user_id, device_token)

NotificationPreference
 - user_id (PK, FK User),
   beta_video_like (bool, default true),
   updated_at

Report  (App Store Guideline 1.2 requirement)
 - id, reporter_user_id (FK User),
   target_type (beta_video | user),
   target_id,
   category (inappropriate | spam | harassment | other),
   note (nullable),
   status (open | reviewed | actioned | dismissed),
   created_at, reviewed_at (nullable)
   -- Phase 1: used for user-profile reports (AC-080). Beta-video reports are
   --   filed to the VideoReport table via the AC-140 one-tap flow, not here.

Block  (App Store Guideline 1.2 requirement)
 - blocker_user_id (FK User), blocked_user_id (FK User), created_at
 - PK: (blocker_user_id, blocked_user_id)
```

**Notes**:

- All tables are guarded by Supabase Row-Level Security policies.
- **`User.beta_video_privacy` is a new column (requires a migration).** It is an enum `public` (default) | `followers_only`, independent from `privacy_setting`. It governs beta-video visibility only (AC-156/AC-158): when `followers_only`, a poster's beta videos are visible only to the poster and their followers; when `public`, to all users. MOD-001 owns the write via a public service function (consumed by MOD-010's SettingsScreen, AC-157). The AC-158 filter reads this value from the poster's user record (via the existing `fetchBetaVideosForRoute` poster join, AC-144) and composes it with the `Follow` relationship across every beta-video listing surface (route-detail grid, fullscreen viewer set, activity feed), in addition to the reported-video (AC-142) and blocked-user (AC-154) exclusions. The migration adds the column with a `public` default so existing rows backfill to the current (public) behavior.
- **`gyms.cover_photo_url` and `gyms.google_place_id` (new columns, requires a migration)**: Both columns are nullable TEXT, added by the Phase 1 one-time seeder migration (AC-194/AC-195). `cover_photo_url` is the authoritative cover photo URL for the gym list and gym detail screen (AC-196/AC-197); null rows display the initials avatar fallback (AC-198). Images are uploaded to Supabase Storage bucket `gym-photos` by the seeder. `google_place_id` is stored for potential future use and is not surfaced in the Phase 1 UI. Any screen displaying a Google-sourced cover photo must show “Photos from Google” attribution (AC-196/AC-197, Google Maps Platform Terms of Service).
- `SavedGym` is the join table backing the multi-gym saved list (it replaces the removed single `User.home_gym_id`). Its RLS policies must scope reads and writes so an authenticated user can only read and write rows where `user_id = auth.uid()` — a user can never see or modify another user's saved gyms.
- `UserRouteVisits` is a **new** per-user route-visit table (AC-179) with composite PK `(user_id, route_id)` and a `last_viewed_at` timestamp, upserted when the user opens a route detail screen. It backs the Home "new beta video" tag (AC-180 — a route qualifies when a visible beta video's `created_at` is newer than the user's `last_viewed_at`, or when no visit row exists) and the most-recently-viewed Saved Gyms ordering (AC-175, derived via each saved gym's routes). **This is a new table and requires Tech Lead architecture review before Doc-Sync/Engineering implements it** — table placement/ownership (candidate: MOD-003), composite-key upsert pattern, own-rows-only SELECT/INSERT/UPDATE RLS (`user_id = auth.uid()`), explicit grants, and the owning module + query shape for the AC-180 cross-module read against beta videos (MOD-005). Mirror the confirmed `saved_gyms` / `saved_routes` RLS design (own-rows-only, dual `ON DELETE CASCADE`).
- `SavedRoute` is the join table backing the saved-routes bookmark (US-021, AC-046/AC-047). Its RLS policies must scope reads and writes so an authenticated user can only read and write rows where `user_id = auth.uid()` — a user can never see or modify another user's saved routes. `route_id` is `ON DELETE CASCADE` so a saved-route row disappears if the underlying route is deleted (e.g. a withdrawn pending route). **This is a new join table and requires Tech Lead architecture review (table placement/ownership, RLS policy set, grants) before Doc-Sync/Engineering implements it** — mirror the confirmed `saved_gyms` design (composite PK, dual `ON DELETE CASCADE`, own-rows-only SELECT/INSERT/DELETE RLS, no UPDATE, explicit grants).
- **`Ascent.is_private` is always `true` in Phase 1** (AC-132): the system sets it on every ascent insert; it is not user-controllable and there is no "set as private" toggle in the log-send form. The column is retained in the schema (no migration) so a public/shared visibility toggle can be introduced in Phase 2.
- A route's **display name is composed, not stored** (AC-045): it is derived at display time from `grade` + `color_tag` (+ `section_label` when present), e.g. "V3 Blue" / "V3 Blue (Cave)". There is no free-text route-name column and no user-editable route name.
- **Beta-video reporting — two new `beta_videos` columns + a new `VideoReport` table (requires Tech Lead architecture review).** The one-tap report flow (AC-139–AC-143) adds `is_reported boolean NOT NULL DEFAULT false` and `report_dismissed boolean NOT NULL DEFAULT false` to `beta_videos` (a **migration** is required for the two new columns), and a new `video_reports` table (`id`, `beta_video_id` FK ON DELETE CASCADE, `reporter_id` FK, `reported_at`, unique on `(beta_video_id, reporter_id)`). This requires Tech Lead architecture review before Doc-Sync/Engineering implements it, covering: (1) the migration for the two new `beta_videos` columns; (2) RLS on `video_reports` (authenticated users INSERT own rows, `reporter_id = auth.uid()`); (3) the cross-user `is_reported` write, which a reporter who does not own the row cannot do via a direct UPDATE — it requires a **SECURITY DEFINER RPC** (AC-140) that flips `is_reported` and inserts the `VideoReport` row in one action; (4) coexistence of the existing `Report` table (user-profile + category/note reports, AC-080) and the new `VideoReport` table (beta-video one-tap reports, AC-140); (5) the `fetchBetaVideosForRoute` filter (exclude `is_reported = true AND report_dismissed = false`, AC-142) and the join for poster `display_name` + `avatar_url` (AC-144); (6) composition of the same visibility rule into the MOD-006 activity-feed RPC (AC-141).
- **`ascent_style` enum change — `project` removed (requires Tech Lead architecture review).** PostgreSQL does not support dropping a value from an existing enum type directly. The migration must: (1) create a new `ascent_style` enum containing exactly `flash | top | attempt` (without `project`); (2) migrate any existing rows whose style is `project` to `attempt`; (3) alter the `ascents.style` column to the new enum type and drop the old enum. This is a data-model migration with data backfill and enum swap — **it requires Tech Lead architecture review before Doc-Sync/Engineering implements it** (safe migration ordering, transaction boundaries, and the PG restriction that a newly created type + column swap + old-type drop must be sequenced correctly, consistent with the project's established two-file enum-migration convention).
- **Route identity is `id` only — no uniqueness constraint (Rev 37).** There is no `match_key` column (it was described in earlier planning docs but never implemented in the database, and is removed from this PRD) and no unique index on `(gym_id, grade, color_tag)`. Real gyms routinely set multiple same-grade/same-color routes simultaneously (e.g. two red V5s on different walls), so duplicate routes are allowed by design (AC-020). The former active-only unique index `routes_active_unique_idx` is dropped by a migration (**Tech Lead review required**: the index-drop migration, the `submit_route` RPC change to remove any uniqueness pre-check, and the optional non-unique index on `(gym_id, grade, color_tag)` to back the AC-187 count query). Data quality is kept by the non-blocking AC-187 two-layer duplicate guard at submission plus admin merge of near-duplicates in Supabase Studio, not by a hard database constraint.
- `DeviceToken` uses Expo Push under the hood; APNs is the transport for iOS in Phase 1. Android tokens land here in Phase 2.
- `NotificationPreference` is designed to grow — Phase 2 will add columns for expanded notification types.
- **Edge Function secret naming**: Edge Functions must read the service-role key from the secret named `SERVICE_ROLE_KEY`, **not** `SUPABASE_SERVICE_ROLE_KEY` — Supabase reserves the `SUPABASE_` prefix for its own injected variables. The service-role key is stored via `supabase secrets` and is never imported into client code.

---

## 10. Non-Functional Requirements

- **Platform**: iOS 16+ (Phase 1). Android is Phase 2.
- **Video**: 60-second maximum (AC-030). **Phase 1 performs no client-side compression** — the app uploads the original native video file as-is, with no re-encoding (AC-031). The beta video is selected with `preferredAssetRepresentationMode: Current` so the picker returns the original representation of the asset without iOS transcoding. Before upload (after format and duration validation), the client reads the native file size; if it is ≥ 45 MB or the size is unreadable, the upload is rejected before it begins with the bilingual error "影片檔案過大，請壓縮至 45MB 以下 / Video is too large, please keep it under 45 MB" (AC-169, fail-closed on unreadable size). The 45 MB gate sits below the 50 MB Supabase Storage free-tier bucket ceiling to leave a safe margin, so an HTTP 413 never surfaces to the user. `react-native-compressor` is removed from the project entirely, and the upload progress overlay has a single "Uploading…" phase (no "Compressing…" phase, AC-036). Client-generated thumbnail (Phase 1: may use the video URI as a placeholder; true still-frame extraction is deferred to Phase 2 per AC-031). Accepted containers are MP4 (`.mp4`) and QuickTime (`.mov`) with H.264/HEVC video + AAC audio; the file is stored as-is on the server (no *server-side* transcoding, per AC-035). Phase 1 relies on a container check only — iPhone camera/library footage is H.264 or HEVC + AAC by construction; a codec probe is a Phase 2 nicety. **Known Phase 1 trade-off**: ~22 s at full 1080p HEVC bitrate hits the 45 MB gate, much closer to the 60 s cap, so only long clips are rejected and those users trim or lower recording quality (see US-004) — this is removed by the Phase 2 server-side pipeline. **Phase 1 known limitation (accepted)**: HLG/HDR videos may appear overexposed during playback because expo-video's `VideoView` renders HLG without extended display range (EDR) configuration; the Phase 2 MediaConvert pipeline tone-maps HDR→SDR and removes this (AC-031). **Storage**: video stored in Supabase Storage during Phase 1 (1 GB free-tier total, shared across all buckets); at 800 MB of beta-video storage an operator watch trigger fires (AC-170) to evaluate the Phase 2 migration. **Phase 2 migration target**: AWS S3 (ingest/storage) + AWS MediaConvert (HDR→SDR tone-map + H.264 transcode) + AWS CloudFront (CDN delivery) — superseding the previously documented Cloudflare Stream target (see §4 Tech Stack and §7 Phase 2). Operator responsibility: monitor monthly Supabase Storage usage in the Supabase dashboard against the 800 MB watch threshold.
- **Backend**: Supabase (Postgres + Auth + Storage + Edge Functions), with RLS policies on every user-writable table. No custom backend server in Phase 1.
- **Saved gyms**: The `saved_gyms` join table requires RLS such that an authenticated user may read and write only their own rows (`user_id = auth.uid()`). No user can read or modify another user's saved-gyms list.
- **Saved routes**: The `saved_routes` join table requires RLS such that an authenticated user may read and write only their own rows (`user_id = auth.uid()`). No user can read or modify another user's saved-routes list. Saved routes are surfaced only in the browse flow (bookmark toggle on the route detail screen; read-only saved indicator on the gym route list) — Phase 1 provides no dedicated saved-routes list surface.
- **Beta-video reports**: The `video_reports` table requires RLS such that an authenticated user may INSERT only their own rows (`reporter_id = auth.uid()`). The `is_reported` flag on `beta_videos` is set by a **SECURITY DEFINER RPC** (AC-140), because the reporter does not own the video row and cannot flip the flag via a direct UPDATE. `report_dismissed` is admin-only (set via Supabase Studio). Every beta-video listing (`fetchBetaVideosForRoute`, the activity-feed RPC, the fullscreen viewer set) must exclude rows where `is_reported = true AND report_dismissed = false` (AC-141/AC-142). There is no admin push or email notification for beta-video reports in Phase 1 — the admin reviews the `VideoReport` table manually in Supabase Studio; the AC-085 email digest covers the `Report` table only.
- **Auth**: Email, Apple Sign-In, and Google Sign-In. Apple Sign-In is required by the App Store since Google Sign-In is offered.
- **Push notifications**: APNs via Expo Push. Phase 1 fires for beta-video likes only, and only when the recipient's `NotificationPreference.beta_video_like` is true. A settings screen exposes the toggle.
- **Offline tolerance**: Phase 1 does **not** queue sends offline. On any network failure, the user sees a clear error message and can retry. Offline queue is Phase 2.
- **Report/Flag & Block**: Required in Phase 1 for App Store Guideline 1.2 compliance. Reports and blocks are user-actioned; admin review of reports happens in Supabase Studio. Block hiding is symmetric (see AC-084). Beta-video reports are one-tap (AC-140) and immediately hide the reported video from all users until an admin dismisses the report (AC-141/AC-143).
- **Report alerting (operational, Phase 1)**: A scheduled Edge Function runs every 6 hours and emails the admin (wu.tsan@northeastern.edu) a digest of open reports older than 12 hours, so the solo operator can act within the App Store Guideline 1.2 response window without polling Supabase Studio (see AC-085). This digest covers the `Report` table (user-profile + category/note reports via AC-080) only; beta-video one-tap reports (the `VideoReport` table, AC-140) are reviewed manually in Supabase Studio and are not part of the digest. **Phase 1 deferral (see AC-085)**: real email delivery (Resend/SMTP) and the registered cron schedule are deferred to post-launch and are not required before App Store submission; the `report-digest` Edge Function exists and queries the `Report` table correctly but only `console.log`s the digest in Phase 1, and the operator manually checks Supabase Studio for open reports while the user base is small.
- **Localization**: English and Traditional Chinese (zh-TW) in Phase 1. Default language: device locale, with zh-TW fallback for any non-English locale. Settings screen exposes a language toggle. Message catalogs must be complete (no missing keys) at ship.
- **Theming**: Light and Dark mode in Phase 1. Follows OS appearance by default; Settings exposes a three-state override (System / Light / Dark).
- **Admin tooling**: Supabase Studio only for Phase 1. All gym CRUD, gym-request review, report review, user block/ban, and near-duplicate route merges are performed by the admin (Leon) via Supabase Studio. No in-app admin UI.
- **Data quality (routes)**: Gyms are admin-curated so they can't drift. Routes are user-submitted and **duplicates are allowed by design (Rev 37)** — a route is identified only by its `id`, there is no database uniqueness constraint on `(gym_id, grade, color_tag)`, and the `submit_route` RPC performs no uniqueness pre-check (§8 AC-020). This reflects how gyms actually work: multiple same-grade/same-color routes legitimately coexist (e.g. two red V5s on different walls). Data quality is kept by (1) the RouteListScreen grade + color filter, which lets climbers find an existing route before adding one; (2) a **two-layer duplicate guard** at submission (AC-187): an inline neutral notice while filling the form, and a non-dismissable confirmation sheet on submit tap when duplicates exist (intercepted before photo upload), both non-blocking — the submitter may always proceed; and (3) admin spot-check + merge of genuine near-duplicates in Supabase Studio.
- **Route identity and duplicate detection (Rev 37)**: A route is identified only by its `id` (UUID primary key). There is no application-level or database uniqueness constraint on `(gym_id, grade, color_tag)` — two active routes with identical grade and color at the same gym are valid by design. The non-unique partial index `routes_active_grade_color_idx ON public.routes (gym_id, grade, color_tag) WHERE status = 'active'` exists solely to back the AC-187 duplicate-warning count query and must not be misread as a uniqueness guarantee. Duplicate detection is a **two-layer non-blocking guard** (AC-187): (1) while the form is being filled, when the submit screen detects ≥1 active route at the gym with the selected grade + color, it shows a neutral-colored inline notice; (2) when the user taps "Add Route" with duplicate candidates present, a non-dismissable confirmation sheet intercepts before `uploadRoutePhoto()` is called, showing RouteCards for matching routes; the user must tap "Cancel" or "Add Route" on the sheet. Neither layer disables the Add Route action. The duplicate candidate list is derived **client-side** from the already-fetched `activeRoutes` list (the `useMemo` from the original AC-187 is reused) — no dedicated count RPC is needed. `findMatchingActiveRoutes` in `route-service.ts` is dead code (the match-before-create flow was removed in Rev 37) and must be deleted. `match_key` was specified in earlier planning docs but was **never implemented** in any migration — no `match_key` column exists in the database; do not reference it.
- **Analytics**: PostHog free tier. Ship the core funnel events listed in AC-100. No PII beyond `user_id` sent to PostHog.
- **Performance targets**: App cold start ≤3 seconds on iPhone 12 or newer. Feed initial render ≤2 seconds on a normal 4G/LTE connection with a warm cache.
- **Google Places API key (server-side only)**: The Google Places API key used by the gym cover-photo seeder (AC-195) must never appear in the client bundle, any client-side environment variable, or any file committed to the repository. It is supplied to the seeder script at run-time via a secure environment variable or CI secret only. This constraint applies to all Google API keys used in this project.
- **Security**: All Storage buckets have RLS policies aligned with the corresponding table policies (e.g., a user cannot fetch a private ascent's associated media). All Edge Functions validate the JWT and re-check authorization against Postgres. Edge Functions read the service-role key from the secret named `SERVICE_ROLE_KEY` (Supabase reserves the `SUPABASE_` prefix); the service-role key is never inlined into the client bundle.
- **Native dependency installation**: All Expo native dependencies shall be installed via `npx expo install <package>`, never `npm install <package>`. Expo resolves the SDK-compatible version automatically; a plain `npm install` can silently install an SDK-incompatible version that passes the Jest suite (via mocks) but fails the native iOS/Android build. Hand-pinning a native module's version string in `package.json` is prohibited.
- **Native build gate before QA handoff**: When a module adds or changes a native dependency (a package with iOS/Android native code), the module's engineer shall run the native build (`npx expo run:ios`, or the platform equivalent) and confirm it compiles before marking the module QA-ready. Passing unit tests alone are insufficient evidence that a native dependency compiles, because Jest mocks native modules.
- **File upload to Supabase Storage**: all uploads of local device files (photos, videos, any binary asset) must use `expo-file-system`'s `File.bytes()` to obtain a `Uint8Array` and pass it directly to `supabase.storage.from(bucket).upload(path, uint8Array, { contentType })`. The `fetch(uri) + response.blob()` pattern is prohibited: in React Native / Expo SDK 57+, `Response.blob()` routes data through the native blob store via base64 encoding, causing silent upload failures for real-world file sizes. Reference implementations: `mod-beta-video/beta-video-service.ts` (video) and `mod-route-catalog/route-service.ts` (photo).
- **Log the raw Supabase error before throwing (service functions)**: any Supabase data-access function (service files, RPC wrappers, storage helpers) that catches a Supabase `error` and throws a user-facing `Error` must first call `console.error('[functionName] error:', error)` so the raw Supabase/PostgREST diagnostic is visible in device/Metro logs. The user-facing string stays generic; the raw error goes to the console only, never to the user. Reference: `mod-beta-video/beta-video-service.ts` (`uploadBetaVideo`, `fetchBetaVideosByUser`).
- **Manual PostgREST verification for new/modified embedded joins**: whenever an engineer adds or modifies an embedded join in a `.select()` string — especially a nested embed, and most especially an FK-hinted embed nested inside another embed — they must exercise the string against the live or local Supabase instance (Studio SQL Editor or a raw PostgREST request) before marking the AC done. A `.select()` embed string is an untyped query DSL that neither TypeScript nor a mocked Supabase client can validate — mocked unit tests short-circuit before PostgREST parses the string and cannot substitute for this step. Prefer a single disambiguated outer FK hint or a server-side RPC over more than one level of nested FK-hinted embed.
- **Data-access & caching conventions (batched reads + client cache)**: for any list or grid that renders N items each needing the same per-item lookup (e.g. per-beta-video like count + the current user's like state), prefer a single batched server-side RPC that resolves all N items in one round-trip over issuing one query per item (the per-card N+1 pattern). The batched RPC stays `SECURITY INVOKER` and composes the same visibility rules the single-item path enforces, so RLS remains the security fence and a batched read never widens visibility. Reference contract: the batched like-info RPC `get_like_info_batch(beta_video_ids uuid[])` (AC-186) returns per-video like count + the caller's own like state for a supplied id set. On the client, like counts and like state fetched this way may be held in a short-lived in-memory cache keyed by `beta_video_id` and reused across the surfaces that render the same video within a session (route-detail grid, reel viewer, profile grids), invalidated on the user's own like/unlike action (AC-052) so the optimistic update stays authoritative; the cache is advisory for read performance only and is never the source of truth for a write. This convention is introduced in Rev 36; the batched RPC itself is deferred within Phase 1 (AC-186) and requires Tech Lead architecture review before implementation.
- **Reused `expo-video` `VideoView` source swaps (iOS)**: when a single persistent `VideoView`/`VideoPlayer` swaps sources via `replaceAsync` rather than remounting, (1) drive the load *cover* down on `onFirstFrameRender` (first composited frame), not on `statusChange: readyToPlay` (buffer-only, fires before the frame paints), and (2) render the `VideoView` at `opacity: 0` while loading so the previously-decoded frame held by `AVPlayerLayer` cannot bleed through — iOS has no `useExoShutter` equivalent (that prop is Android-only). Keep the `statusChange: error` path wired to the error UI so the cover never hangs.
- **Soft-launch timeframe**: No date target set. Phase 1 ships when Phase 1 acceptance criteria pass and the App Store submission is approved.

---

## 11. Seed Gym Table (Phase 1)

**Rule**: One row per branch for all multi-branch gyms. Top-rope-only gyms are excluded from the Phase 1 seed. Mixed gyms are included; only their bouldering areas are represented in-app. Every address, hours, and operating status must be verified against Google Maps immediately before Phase 1 go-live.

| # | Gym | Branch | City / Area | Address (verify before launch) | Type | Include in Phase 1 |
|---|---|---|---|---|---|---|
| 1 | MegaSTONE Climbing Gym | — | New Taipei (Xinzhuang) | 新北市新莊區中正路56巷5號 | Bouldering + top-rope | Yes |
| 2 | CORNER 角攀岩館 | 中山店 | Taipei (Zhongshan) | 台北市中山區中山北路二段68號B1 | Bouldering | Yes |
| 3 | CORNER 角攀岩館 | 華山店 | Taipei (Zhongshan) | 台北市中山區新生北路一段86號 | Bouldering | Yes |
| 4 | 原岩攀岩館 (T-UP) | 萬華 | Taipei (Wanhua) | verify branch address | Bouldering + top-rope | Yes |
| 5 | 原岩攀岩館 (T-UP) | 南港 | Taipei (Nangang) | verify branch address | Bouldering + top-rope | Yes |
| 6 | 原岩攀岩館 (T-UP) | 新店 | New Taipei (Xindian) | verify branch address | Bouldering + top-rope | Yes |
| 7 | 原岩攀岩館 (T-UP) | 中和 | New Taipei (Zhonghe) | verify branch address | Bouldering + top-rope | Yes |
| 8 | 原岩攀岩館 (T-UP) | 明德 | Taipei (Beitou) | 台北市北投區文林北路222號B1 (verify) | Bouldering + top-rope | Yes |
| 9 | double8 岩究所 | — | Taipei (Dadaocheng) | 台北市大同區迪化街一段251號 | Top-rope focused, some bouldering | Yes (bouldering area only) |
| 10 | 市民抱石攀岩館 | — | Taipei (Nangang) | 台北市南港區市民大道八段552號2樓 | Bouldering | Yes |
| 11 | 奇岩攀岩館 | — | Taipei (Nangang) | 台北市南港區忠孝東路七段512號 | Bouldering | Yes |
| 12 | RedRock 紅石攀岩 | 士林 | Taipei (Shilin) | 台北市承德路四段261號B1 | Bouldering | Yes |
| 13 | 永和攀岩場 | — | New Taipei (Yonghe) | 新北市永和區永利路250號6樓 | Top-rope + bouldering + speed | Yes (bouldering area only) |

**Explicit Phase 1 exclusions** (do not seed):

- **Camp4 達文西攀岩館** (Taipei / Beitou) — excluded: top-rope focused.
- **Wusa 攀岩館** (New Taipei / Xinzhuang + Sanchong branches) — excluded: top-rope focused.

**Future-phase backlog (do not seed for Phase 1)** — Taoyuan (原岩 A19, Passion, 千手抱石), Hsinchu (新竹風城 成功館/勝利館, 新竹紅石), Taichung (Dapro, 攀吶, B-plus), Kaohsiung (Boulder Space 圓石空間, B-topia, 慶倡, 抱石基地), Yilan (Rockdance 舞岩, 奇岩 宜蘭), Tainan (嗨翻綜合體能館). Revisit when Taipei/New Taipei usage validates expansion.

---

## 12. Open Questions / Risks

Most previously-open questions were resolved during PRD confirmation. Remaining items:

- **`ascent_style` enum migration safety**: Removing the `project` value is not a direct enum drop in PostgreSQL — it requires creating a new three-value enum, backfilling existing `project` rows to `attempt`, swapping the `ascents.style` column type, and dropping the old enum. Risk: an incorrectly sequenced migration fails on PG15 (enum create/use/drop ordering) or leaves orphaned `project` values. Mitigation: Tech Lead to specify the exact migration ordering (consistent with the project's two-file enum-migration convention) and the backfill `UPDATE` before Engineering implements; Engineer to verify with a local `supabase db reset`.
- **Beta-video report visibility composition**: The AC-141/AC-142 rule (hide `is_reported = true AND report_dismissed = false` everywhere) must be applied consistently across the route-detail grid, the fullscreen viewer set, and the MOD-006 activity-feed RPC. Risk: a listing path forgets the filter and a reported video leaks to users, or the SECURITY DEFINER RPC over-grants (lets a reporter flip fields beyond `is_reported`). Mitigation: Tech Lead to specify the SECURITY DEFINER RPC's exact scope (flip `is_reported` + insert one `VideoReport` row only), the RLS on `video_reports`, and the single shared filter clause reused by every beta-video listing (including the feed RPC) before Engineering implements. There is no admin alert for these reports in Phase 1 (Studio-only manual review) — residual risk that a reported video sits hidden but un-reviewed; acceptable for Phase 1 because a reported video is hidden from all users while it waits.
- **Phase 2 video pipeline — chosen target, rejected alternative, and build-time conditions (Rev 24 PM-logged decision)**: The Phase 2 video-infrastructure target is **AWS S3 + CloudFront + MediaConvert** (presigned-URL S3 ingest → S3 event → Lambda → MediaConvert HDR→SDR tone-map + H.264 → CloudFront CDN; `beta_videos.video_url` becomes a CloudFront URL), a conscious override of the previously documented Cloudflare Stream target. Supabase remains the system of record for all Postgres data, Auth, RLS, PostgREST, and non-video storage — only beta-video ingest and delivery move to AWS, so the project runs two clouds in Phase 2. **Rejected alternative — Supabase Pro (~US$25/mo, 100 GB storage, 200 MB/file)**: weighed and not chosen. Supabase Pro needs zero new infrastructure, one cloud, one identity layer, and no code change, and at early scale (~US$16–22/mo realistic AWS bill) the cost is comparable; but it does **not** solve HDR→SDR tone-mapping (the washed-out/over-bright inline-playback problem that motivated the pipeline) and gives no CDN edge delivery near Taiwan users. AWS was chosen for the HDR→SDR transcode and CloudFront CDN economics that pay off as delivery volume grows. **Blast radius**: only two service-layer functions change — `uploadBetaVideo` (Supabase Storage upload → presigned-S3 PUT) and `getVideoSignedUrl` (returns a CloudFront URL); existing `beta_videos.video_url` rows hold Supabase Storage paths and need a backfill/dual-read strategy. **Phase 2 security conditions (non-negotiable when Phase 2 is built)**: the client→S3 upload must use a short-lived presigned upload minted by a Supabase Edge Function that verifies the caller's Supabase JWT (Supabase Auth stays the identity layer — no Cognito); the presigned upload must enforce the 45 MB cap server-side via a `content-length-range` policy condition (a plain presigned PUT cannot cap size, making the gate client-only and bypassable); the IAM principal behind the Edge Function must be least-privilege (`s3:PutObject` on the ingest prefix only, credentials in Edge-Function secrets, never in the client or repo); the presigned URL must expire in ≤ 5 minutes; and the S3 object key must be chosen server-side, never client-supplied. **Operational readiness risk**: the migration has no rehearsed runbook yet (dual-write vs. batch backfill, `video_url` rewriting, existing-row backfill). Mitigation: the Phase 2 design is approved in principle and must be re-reviewed by the Tech Lead at build time — a detailed review of the presigned-upload Edge Function, the IAM policy, the MediaConvert job template (tone-map settings, rendition count), and the `beta_videos.video_url` CloudFront-URL migration — before any AWS code is written. Until then, Phase 1 runs entirely on Supabase Storage with the 800 MB storage-watch trigger (AC-170) as the early warning.
- **Same grade + color routes coexisting (resolved by design, Rev 37)**: Two genuinely different routes at the same gym with the same grade + color are now a normal, supported case — duplicates are allowed by design and there is no uniqueness constraint (AC-020). The remaining consequence is display-name ambiguity (AC-045): two same-grade/same-color routes with no section label render the same composed name. Mitigation: the optional `section_label` is appended to the display name when present (AC-045), the AC-187 Layer 1 inline notice nudges the submitter to supply one, and the route card photo thumbnail (AC-183) distinguishes same-named routes visually. Residual risk: if two routes share grade + color, have no section label, and look similar in their photos, a climber may confuse them — acceptable for Phase 1; `section_label` may become a required tiebreaker in a later phase based on real data. Admin merges true accidental duplicates in Supabase Studio.
- **Admin bandwidth for reports**: With Supabase Studio as the only report review surface, response time depends on operator (Leon) checking Studio. Mitigation adopted (AC-085): a scheduled Edge Function emails Leon a 6-hourly digest of open reports older than 12 hours. **Phase 1 status (AC-085 deferral)**: real email delivery and the cron schedule are deferred to post-launch and are not required before App Store submission — App Store Guideline 1.2 requires a report UI and a 24-hour response commitment, not a technical alerting mechanism. For Phase 1's small user base the operator reviews open reports manually in Supabase Studio; the `report-digest` Edge Function exists and queries the `Report` table correctly but only `console.log`s in Phase 1, with real email + cron revisited when report volume warrants automation. Note: this digest covers the `Report` table (user-profile reports) only; beta-video one-tap reports (`VideoReport`, AC-140) have no email alert in Phase 1 and are reviewed manually in Studio — but because a reported video is immediately hidden from all users (AC-141), the response-window risk is lower for video reports than for the profile reports the digest covers. Residual risk: App Store may still expect a faster in-app moderation queue; a lightweight in-app admin surface is held in the Phase 2 slot if review flags it.
- **APNs deliverability tail**: The AC-056 target of ≥95% delivery within 30 seconds depends on Expo Push + APNs latency and on device state. Needs measurement post-launch — if the tail is worse than expected, revisit push architecture in Phase 2.
- **App Store Guideline 1.2 review outcome**: Report + Block are implemented, but App Store review is not deterministic. Risk: additional moderation requirements surface during review (e.g., faster response SLA, in-app moderation queue). Mitigation: keep Phase 2 slot available for a lightweight in-app admin surface if needed.
- **Cold start for routes at newly-seeded gyms**: Routes start empty per gym until users submit. Mitigation: Leon to personally seed routes at a few gyms + a few beta videos before opening to beta users.
- **PostHog free-tier ceiling**: Free tier has monthly event caps. Risk: hitting the cap mid-month kills analytics. Mitigation: monitor volume; consider event sampling if approaching cap.

---

## 13. Roadmap

1. **Phase 1 (MVP, iOS, Taipei + New Taipei)** — Auth (Email + Apple + Google), curated branch-level gym directory, route submission (duplicates allowed by design — no uniqueness constraint, two-layer duplicate guard: inline notice + confirmation sheet on submit, AC-187) + fixed color enum + V-scale + composed route display name, route bookmarking in the browse flow, send logging with clear error on network failure and a three-value ascent style (flash/top/attempt), beta video (60 sec cap, no client compression — original native file uploaded as-is behind a 45 MB size gate, client thumbnail) via Supabase Storage with a fullscreen portrait reel viewer and one-tap video reporting, follow + activity feed, beta-video likes with APNs push + preference toggle, profile history + basic stats with per-send achievement icons, Report + Block (App Store 1.2 — user-profile category reports plus one-tap video reports), English + zh-TW (device-locale default, Settings toggle), Light + Dark (OS default, Settings override), PostHog analytics, Supabase Studio admin only.
2. **Phase 2 (Community depth + Android)** — Android build, offline send queue, expanded push notifications, comments (conditional), retire/reset voting workflow, ascent pyramid visualization, "suggest an edit" gym flow, dedicated saved-routes list surface, AWS video pipeline migration — S3 + CloudFront + MediaConvert, superseding Cloudflare Stream (if the 800 MB storage-watch trigger hit in Phase 1), beta-video thumbnail frame extraction (Phase 1 uses a placeholder thumbnail), lightweight in-app moderation surface if needed for App Store follow-up.
3. **Phase 3 (Gym partnerships)** — Gym-claimed profiles, official route-setter publishing, gym-facing analytics, optional gym subscription monetization (climber app stays free).

---

## 14. Competitive Reference Summary

| App | Strength | Gap vs. ProjectDay |
|---|---|---|
| Kaya | Full loop: log, beta, social, gym partnerships, challenges | Global/outdoor-first, not localized for TW gyms or color-grading conventions |
| 27 Crags / OpenBeta | Open, wiki-style community route data | Outdoor-crag focused, not gym/bouldering-session oriented |
| Vertical-Life | Polished guidebook + logging | Europe-centric, not present in Taiwan |
| Sendage | Clean send-logging UX, "Send Grid" visualization | No route database or beta-sharing depth |
| MyClimb | Popular for indoor gym social use | No meaningful Taiwan presence |
| 記石 (Ji Shi) | Only real Taiwan-native app found | Log-only — no beta video, no route database, no social layer |

**Wedge**: ProjectDay is the first app actually built around Taiwan's indoor bouldering scene — local branch-level gym coverage on day one, tape-color-based route matching that reflects how climbers actually talk about routes, and the log + beta + social loop that Kaya proved works — without waiting on official gym buy-in.

---

## 15. Adopted Conventions

**CONV-000**: Every convention recorded in production.md Shared Conventions as of PRD Revision 45 is adopted as written. New conventions are added below as CONV-001 and up. (Approved: Leon, 2026-10-20, framework v2 migration.)
