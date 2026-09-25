# Send It — Product Requirements Document

**Author**: Leon
**Status**: [TRIVIAL] — Revision 10
**Date**: 2026-09-24
**Revision**: 10

---

## 1. Project Overview

**Send It** is a Taiwan-first mobile app for indoor bouldering climbers. It gives climbers a fast way to log sends (route + grade + attempts + status), share and watch beta videos (short technique clips) tied to specific routes, browse what's currently set at the gyms they follow, and connect with other climbers in the local scene. The app is organized around a persistent three-tab bottom navigation shell — Home, Gyms, and Profile — with the Home tab as the landing screen after login. Rather than a single fixed home gym, each climber maintains a multi-gym saved list: they bookmark any gyms they care about and see them, alongside the climbers they follow, on the Home screen.

Indoor bouldering has grown fast in Taiwan — Taipei and New Taipei have the highest concentration of gyms, with more scattered across Taoyuan, Hsinchu, Taichung, Kaohsiung, Yilan, and Tainan — but climbers currently have no dedicated app that combines send logging, beta video sharing, live gym route lists, and local social features. Today this happens informally through PTT posts, Instagram/Threads stories, or word of mouth, or through global apps (Kaya, Vertical-Life, 27 Crags) that are outdoor-crag-centric, not localized for Taiwan gyms, and don't reflect local color-based tape conventions. One small local app (記石) exists but is log-only — no beta video, no cross-gym route database, no social layer.

Send It's wedge is a lightweight, Taiwan-first version of Kaya's core loop — log, watch beta, see history — built on an admin-curated gym directory (so the app has real coverage on day one) plus a filter-first route submission flow with server-enforced duplicate protection that keeps user-submitted data clean without waiting on official gym partnerships.

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
- Offline send queueing is out of scope for Phase 1 — Phase 1 must show a clear error message rather than silently fail (planned for Phase 2).
- User-created gyms are out of scope for Phase 1 — missing gyms are captured via a "request a gym" form only.
- User-editable grade overrides are out of scope for Phase 1 — the gym's posted grade is the source of truth.
- Per-user grade systems other than V-scale are out of scope for Phase 1 — all Phase 1 gyms are forced to V-scale mapping.
- A user-editable free-text route name is out of scope for Phase 1 — a route's display name is composed automatically from its grade and hold color (with optional section label), not entered by the submitter.
- A dedicated saved-routes surface on the Profile or Home tab is out of scope for Phase 1 — saved routes are surfaced only in the browse flow (a bookmark toggle on the route detail screen and a read-only saved indicator on the gym route list); a saved-routes list view is backlog for a later phase.
- A "project" ascent style is out of scope — Phase 1 supports exactly three ascent styles (flash, top, attempt); the historical `project` value is removed from the UI and the database enum.
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

**Acceptance Criteria**: AC-010, AC-011, AC-012, AC-014

---

### US-003: Submit a new route

**As a** climber whose gym just reset a wall,
**I want** to browse the gym's route list using grade and hold-color filter chips, and — via an always-visible "Can't find it? Add a new route" call-to-action — add a new route (grade + hold color + photo + optional section label) on a single submit screen with the grade and color pre-filled from the filters I already applied,
**so that** the gym's route list stays clean and other climbers can find the same route I'm logging.

The route list uses grade and hold-color filter chips only (no free-text search). The "Can't find it? Add a new route" CTA is always shown at the bottom of the route list — not only when the list is empty — because even when matching routes exist the climber may not find their specific route. The filtered route list is itself the "does this route already exist?" check: the climber filters by grade + color, sees no match, and taps the CTA. There is no separate client-side match-check step. Tapping the CTA opens a single-page submit screen (grade and color chips pre-filled from the active filters) with an "Add Route" button that submits directly. Server-side duplicate protection keeps data clean: the `submit_route` RPC pre-check and the partial unique index on active routes enforce uniqueness at the database level.

**Acceptance Criteria**: AC-020, AC-021, AC-022, AC-023, AC-043, AC-045

---

### US-004: Upload a beta video for a route

**As a** climber who figured out a tricky sequence,
**I want** to record or select a short video (≤60 sec), attach it to a specific route, and publish it,
**so that** others attempting the route can learn from my beta.

**Acceptance Criteria**: AC-030, AC-031, AC-032, AC-037

---

### US-005: Watch beta inline on a route

**As a** climber projecting a route,
**I want** to open the route detail page and watch all beta videos inline without leaving the app,
**so that** I can study sequences on the wall.

**Acceptance Criteria**: AC-033, AC-034

---

### US-006: Browse currently active routes at a gym

**As a** climber planning a session,
**I want** to open my gym's page and filter its route list by grade and active status,
**so that** I know what's currently set before I show up.

**Acceptance Criteria**: AC-005, AC-006, AC-040, AC-041, AC-042, AC-045

---

### US-007: Follow other climbers and see their activity

**As a** climber connected to the local scene,
**I want** to follow other users and see their sends and beta videos in a chronological feed,
**so that** I can keep up with what my friends and local strong climbers are doing.

**Acceptance Criteria**: AC-050, AC-051

---

### US-008: Like a beta video

**As a** viewer of a helpful beta video,
**I want** to tap a like button (single reaction) on the video,
**so that** the uploader knows their beta helped.

**Acceptance Criteria**: AC-052, AC-053

---

### US-009: Receive push notification for beta-video likes

**As a** beta video uploader,
**I want** to receive a push notification when someone likes my video, subject to my notification preferences,
**so that** I get feedback on my contributions.

**Acceptance Criteria**: AC-054, AC-055, AC-056, AC-058

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

**Acceptance Criteria**: AC-060, AC-061, AC-062, AC-064, AC-065

---

### US-012: Set profile privacy

**As a** climber concerned about visibility,
**I want** to choose between a public profile and followers-only visibility,
**so that** I control who sees my logs and beta.

**Acceptance Criteria**: AC-063

---

### US-013: Request a missing gym

**As a** climber whose gym isn't in the directory,
**I want** to submit a gym request (name + city + optional Google Maps link),
**so that** the admin can review and add it later.

**Acceptance Criteria**: AC-070

---

### US-015: Report inappropriate content

**As a** user who saw an inappropriate beta video or user profile,
**I want** to report the content or user with a category and optional note,
**so that** the admin can review and take action (App Store Guideline 1.2 requirement).

**Acceptance Criteria**: AC-080, AC-081

---

### US-016: Block another user

**As a** user who wants to stop seeing another user's activity,
**I want** to block that user,
**so that** their content no longer appears in my feed or on route pages I view, and they cannot follow or interact with me (App Store Guideline 1.2 requirement).

**Acceptance Criteria**: AC-082, AC-083

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
**I want** a Home screen that shows announcement banners, my saved gyms, and the climbers I follow,
**so that** I have a single landing surface that surfaces the gyms and people most relevant to me.

**Acceptance Criteria**: AC-110, AC-111, AC-112, AC-113, AC-114, AC-115, AC-123, AC-124

---

### US-021: Bookmark a route while browsing

**As a** climber who wants to keep track of routes I plan to try,
**I want** to bookmark a route from its detail screen and see a read-only saved indicator on that route in the gym route list,
**so that** I can recognize the routes I've saved while browsing without a separate saved-routes screen.

**Acceptance Criteria**: AC-046, AC-047

---

## 4. Tech Stack

| Component        | Name + Version                                      | Notes                                                                                                                                       |
|------------------|-----------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------|
| Language         | TypeScript 5.x                                      | Shared across app and Supabase Edge Functions.                                                                                              |
| App framework    | React Native (Expo SDK 51+)                         | iOS-only build configuration for Phase 1. Android in Phase 2.                                                                               |
| Backend (BaaS)   | Supabase (Postgres 15+, Auth, Storage, Edge Functions) | Postgres with Row-Level Security. Auth: Email + Apple Sign-In + Google Sign-In. Storage for photos and Phase 1 video.                       |
| Video hosting    | Supabase Storage (Phase 1) → Cloudflare Stream (migrate) | Migration trigger: monthly cost > US$25 OR total video storage > 20 GB, whichever comes first.                                              |
| Push             | Apple Push Notification service (APNs) via Expo Push | Device token table + Supabase Edge Function trigger for beta-video-like events only in Phase 1.                                             |
| Analytics        | PostHog (free tier)                                 | Product analytics + retention cohorts.                                                                                                      |
| Admin tooling    | Supabase Studio                                     | Sole admin surface for Phase 1 (gym CRUD, gym request review, report review, user block/ban actions). No in-app admin UI.                   |
| Localization     | i18n-js or expo-localization + JSON message catalogs | Languages: English + Traditional Chinese (zh-TW). Default: device locale; fallback: zh-TW.                                                  |
| Theming          | React Native appearance API + Expo theming          | Light + Dark mode. Follows OS preference by default; manual override in Settings.                                                           |

---

## 5. Architecture Overview

Send It is a mobile client (React Native / Expo, iOS-only for Phase 1) talking directly to Supabase for auth, data, storage, and serverless functions. There is no bespoke backend server in Phase 1.

- The **client** owns rendering, local UI state, client-side video compression, client-generated thumbnails, and localization. It authenticates via Supabase Auth (Email / Apple / Google) and stores the session locally.
- The client's top-level UI is a **persistent three-tab bottom navigation shell**. **Tab 1 (Home)** hosts the Home surface (MOD-012). **Tab 2 (Gyms)** hosts the existing gym navigation stack (MOD-002 gym directory + detail, with MOD-003 route catalog reachable beneath it). **Tab 3 (Profile)** hosts the current user's profile surface (MOD-001) with their embedded send history and stats (MOD-008). The Home tab is the default tab after login. This tab shell is an app-level architecture concern: the mount point for each tab's navigator and the module boundaries between the shell and the surfaces it hosts require Tech Lead review before implementation.
- **Supabase Postgres** is the system of record. All tables are protected by Row-Level Security (RLS) policies. Read/write access is scoped per-user for logs, follows, reactions, reports, blocks, saved gyms, saved routes, and notification preferences; gyms are readable by all authenticated users and writable only by admins; routes are readable by all authenticated users for `active` rows, with `pending` rows visible only to their submitter, and are writable by the submitting user on insert (initial status `active` when auto-approve is ON, else `pending`), while status transitions to `retired` or `rejected` and approval of `pending` routes are admin-only via Supabase Studio.
- **Supabase Storage** hosts avatars, gym photos, route photos, and (Phase 1 only) beta videos + client-generated thumbnails. When the migration trigger fires, video uploads cut over to **Cloudflare Stream** while metadata continues to live in Postgres.
- **Supabase Edge Functions** handle event-driven workflows that must not run on the client: on `Reaction` insert with `target_type = beta_video`, an Edge Function inserts a `Notification` row and enqueues an APNs push (respecting `NotificationPreference`) via Expo Push to all `DeviceToken` rows for the recipient.
- **PostHog** SDK ships client-side events (signup, first send, video upload, retention markers). No PII beyond user_id is sent.
- **Admin operations** (adding gyms, reviewing gym requests, reviewing reports, banning users, merging near-duplicate routes, approving/rejecting pending routes, and retiring routes) are performed exclusively through Supabase Studio in Phase 1. In-app admin UI for route status management is planned for Phase 1.5.

The data flow for the two most important loops:

1. **Log a send**: client → Supabase Auth (session) → Postgres insert into `Ascent` (RLS-checked) → PostHog event. Grade is read from `Route.grade` at display time, never stored per-log.
2. **Upload beta video → notify**: client compresses video and generates thumbnail → upload to Supabase Storage (Phase 1) → insert `BetaVideo` row → other user views + likes → insert `Reaction` row → Edge Function fires → insert `Notification` row + APNs push to recipient's device tokens (if enabled in `NotificationPreference`).

---

## 6. Module Breakdown

### MOD-001: Auth & Profile

**Purpose**: Handle signup, sign-in (email, Apple, Google), session management, and user profile CRUD including privacy setting, avatar, bio, and display name. Own the Profile tab surface: display the current user's display name, avatar, and bio; expose an Edit Profile entry point (display name, avatar, bio, privacy setting); embed the current user's send history (MOD-008 surface); and expose a Logout control. There is no home gym concept — saved gyms live in MOD-012.

**User Stories**: US-001, US-011, US-012

**Dependencies**: none

---

### MOD-002: Gym Directory

**Purpose**: Serve the admin-curated gym directory (branch-level rows), gym detail pages, gym search/filter, and the "request a gym" submission form. Own the saved-gym bookmark interaction: a read-only saved indicator on gym list cards and an interactive bookmark toggle on the gym detail screen that adds/removes the gym from the user's saved gyms list.

**User Stories**: US-006, US-013, US-019

**Dependencies**: MOD-001

---

### MOD-003: Route Catalog

**Purpose**: Own the route submission match-before-create flow, the standardized `gym + grade + hold color` match key, the composed route display name (grade + color + optional section label), route detail pages, the route status lifecycle (`active` / `pending` / `retired` / `rejected`), submitter-only pending visibility and withdrawal, the fixed hold/tape color enum, and the saved-route bookmark interaction (a bookmark toggle on the route detail screen and a read-only saved indicator on the gym route list). Admin approval/rejection/retirement is performed via Supabase Studio in Phase 1.

**User Stories**: US-003, US-006, US-021

**Dependencies**: MOD-001, MOD-002

---

### MOD-004: Send Logging

**Purpose**: Handle send log creation from a route page or global "+" entry point, enforcing that grade is inherited from the route (no per-user override) and restricting the ascent style to the three-value set (flash, top, attempt).

**User Stories**: US-002

**Dependencies**: MOD-001, MOD-003

---

### MOD-005: Beta Video

**Purpose**: Handle video capture/selection, client-side compression (≤60 sec cap), client-generated thumbnail, upload to storage, and inline playback on route detail pages and the activity feed.

**User Stories**: US-004, US-005

**Dependencies**: MOD-001, MOD-003

---

### MOD-006: Social Graph & Feed

**Purpose**: Handle follow/unfollow, the chronological activity feed of sends and beta videos from followed users, and beta-video like reactions.

**User Stories**: US-007, US-008

**Dependencies**: MOD-001, MOD-004, MOD-005

---

### MOD-007: Notifications

**Purpose**: Own the device token registration, notification preference toggles, the Edge Function that fans out beta-video-like events to APNs push, and the in-app notification inbox.

**User Stories**: US-009, US-010

**Dependencies**: MOD-001, MOD-006

---

### MOD-008: Profile History & Stats

**Purpose**: Render the current user's (and other users', per privacy) send history with gym/grade/date filters and basic stats (sends by grade bar chart, total sends, current streak, highest grade), displaying an achievement icon for each logged send's ascent style.

**User Stories**: US-011

**Dependencies**: MOD-001, MOD-004

---

### MOD-009: Moderation (Report & Block)

**Purpose**: Provide report submission (with category + optional note) for beta videos and user profiles, block/unblock actions, and filtering blocked users out of feeds, route pages, and follow flows. Admin review happens in Supabase Studio.

**User Stories**: US-015, US-016

**Dependencies**: MOD-001, MOD-005, MOD-006

---

### MOD-010: Localization & Theming

**Purpose**: Provide i18n message catalog loading (English, zh-TW), device-locale detection with zh-TW fallback, in-app language toggle, and Light/Dark theming that follows OS preference with a manual Settings override.

**User Stories**: US-017, US-018

**Dependencies**: none

---

### MOD-011: Analytics

**Purpose**: Ship product events (signup, first send, first video, retention markers, like events) to PostHog, wired throughout the app.

**User Stories**: (cross-cutting; supports goals in Section 2 rather than a single US)

**Dependencies**: MOD-001

---

### MOD-012: Home

**Purpose**: Own the persistent three-tab bottom navigation shell (Home / Gyms / Profile) and the Home tab surface. The Home surface renders three sections — a static banner strip, the user's saved gyms strip, and the climbers the user follows — and provides navigation from those sections into the gym detail and user profile surfaces.

**User Stories**: US-020, US-019

**Dependencies**: MOD-001, MOD-002, MOD-006

---

## 7. Phases & Milestones

### Phase 1: iOS MVP — Taipei/New Taipei launch

**Modules**: MOD-001, MOD-002, MOD-003, MOD-004, MOD-005, MOD-006, MOD-007, MOD-008, MOD-009, MOD-010, MOD-011, MOD-012

**Scope summary**: iOS-only React Native + Expo app. Auth (Email + Apple + Google). Admin-curated gym directory seeded with Taipei/New Taipei branch-level rows (top-rope-only gyms excluded). Route submission with match-before-create using fixed hold/tape color enum, V-scale grade forced across all gyms; routes carry a composed display name (grade + color + optional section label). Route bookmarking in the browse flow (bookmark on route detail, read-only saved indicator on the gym route list). Send logging (no offline queue — error message on failure) with a three-value ascent style (flash, top, attempt). Beta video upload (60 sec cap, client-side compression, client-generated thumbnail). Follow + chronological activity feed. Beta-video likes with APNs push notifications + preference toggle. Profile history + basic stats with per-send achievement icons. Report + Block (App Store 1.2 compliance). English + zh-TW (device-locale default, zh-TW fallback, Settings toggle). Light + Dark mode (OS preference + Settings override). PostHog analytics. Admin surface = Supabase Studio only. Video hosting = Supabase Storage.

**Milestone**: All Phase 1 acceptance criteria pass on a production Supabase project and a TestFlight build; the seeded gym directory (branch-level Taipei/New Taipei, excluding Camp4 達文西攀岩館 and Wusa 攀岩館) is loaded and every gym has a verified address and map pin; the App Store submission passes Guideline 1.2 review with Report and Block flows functional.

---

### Phase 2: Community depth + Android

**Modules**: (new modules TBD in a later PRD revision — Android build config, offline send queue, expanded notifications, comments, retire/reset voting, ascent pyramid, gym-info edit suggestions, Cloudflare Stream migration if trigger has fired, dedicated saved-routes list surface, beta-video thumbnail frame extraction)

**Scope summary**: Android build (Expo config extension). Offline send queue with local persistence + sync-on-reconnect. Expanded push notifications (new routes at followed gyms, someone flashed your project, new follower). Comments (if community demand and moderation bandwidth exist). Community-driven route retire/reset workflow with light voting. Ascent pyramid visualization. "Suggest an edit" flow for gym metadata. A dedicated saved-routes list surface (Phase 1 only surfaces saved routes in the browse flow). Cloudflare Stream video migration executed if Phase 1 crossed the cost/storage trigger.

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

**AC-063**: The system shall enforce a profile privacy setting of `public` (default) or `followers_only`, and when set to `followers_only` shall return 403/hidden for logs and beta video listings requested by non-followers.

**AC-116** (new): The Profile screen shall display the current user's display name, avatar, and bio.

**AC-117** (new): The Profile screen shall expose an Edit Profile entry point that opens editing of the current user's display name, avatar, bio, and privacy setting.

**AC-118** (new): The Profile screen shall embed the current user's send history (the MOD-008 profile-history-and-stats surface).

**AC-119** (new): The Profile screen shall expose a Logout control at the bottom that ends the session and returns the user to the signed-out state.

---

### MOD-002 (Gym Directory) Acceptance Criteria

**AC-004**: The system shall render the Taipei/New Taipei branch-level gym directory with every gym showing name, city/district, address, map pin, gym type, and (if present) photo when a user opens the Gyms tab.

**AC-005** (new): The system shall present a "View Routes" entry point at the **bottom** of the gym detail screen that navigates the user to that gym's route catalog, passing the gym context (gym ID and gym name). The entry point must be visible without any additional action.

**AC-006** (new): The system shall navigate a user from a gym row in the gym directory list to that gym's detail screen when the user taps the row, passing the selected gym's identifier.

**AC-070**: The system shall accept a "request a gym" submission containing gym name, city, and optional Google Maps link, persist it to a queue readable by admins in Supabase Studio, and show the user a confirmation state when the submission succeeds.

**AC-120** (new): The gym detail screen (GymDetailScreen) shall display a bookmark icon that toggles between a saved state (filled, yellow) and an unsaved state (gray), reflecting whether the gym is in the current user's saved gyms list.

**AC-121** (new): Tapping the bookmark icon on the gym detail screen shall add or remove the gym from the current user's `saved_gyms` list and update the icon state immediately (optimistic update). The gym detail screen is the only save/unsave action point.

**AC-122** (new): The gym list screen shall display a filled yellow bookmark indicator on gym cards that are in the current user's saved gyms list; no indicator is shown for unsaved gyms. The list indicator is read-only — tapping it performs no save/unsave action.

---

### MOD-003 (Route Catalog) Acceptance Criteria

**AC-020** (revised): The system shall provide a single-page route submit screen containing grade chips, hold-color chips, an inline photo picker (image preview shown on the same page after selection), an optional section-label text field, and an "Add Route" button at the bottom that submits the route directly via the `submit_route` RPC. There shall be no client-side match-check step and no multi-step submission flow — the RouteListScreen grade + color filter serves as the "does this route already exist?" check before the user opens the submit screen. Server-side duplicate protection is unchanged: the `submit_route` RPC pre-check and the partial unique index on active routes (`UNIQUE (gym_id, grade, color_tag) WHERE status = 'active'`) enforce uniqueness at the database level, and the per-submitter partial unique index on pending routes prevents a user from holding two pending submissions for the same (gym_id, grade, color_tag) (AC-029).

**AC-021** (revised): The system shall block route submission when no photo is attached via the inline photo picker and shall show a validation message indicating the photo is required. The photo requirement is enforced both client-side (the "Add Route" button cannot submit without a photo) and server-side (the `submit_route` RPC rejects a submission with no photo).

**AC-022**: The system shall restrict the hold/tape color selector to the fixed enum {red, orange, yellow, green, blue, purple, pink, white, black}.

**AC-023**: The system shall enforce V-scale as the only grade system available for route creation across all Phase 1 gyms.

**AC-024b** (new): The system shall support an admin-only `retired` status, set exclusively by an admin via Supabase Studio (normal users can no longer retire routes). Setting a route to `retired` shall immediately exclude it from the active route list and from the match pool. The existing `retired_at` / `retired_by_user_id` columns record when and by whom the route was retired.

**AC-025** (new): The system shall set a newly submitted route's initial status to `active` when the auto-approve setting is ON, and to `pending` when auto-approve is OFF. Auto-approve defaults ON at Phase 1 launch. When auto-approve is OFF, after submission the system shall show the message "Your route will appear once approved by the admin" (zh-TW translation [I18N-PENDING]).

**AC-026** (new): The system shall make a `pending` route visible only to its submitter (read-only); a `pending` route shall not appear in the route list shown to any other user.

**AC-027** (new): The system shall allow an admin, via Supabase Studio only in Phase 1, to approve a `pending` route (transition to `active`) or reject it (transition to `rejected`).

**AC-028** (new): The system shall never show `rejected` or `retired` routes to normal users.

**AC-029** (new): The system shall allow a submitter to withdraw their own `pending` route, which deletes the row (the row is removed, not status-changed). The system shall prevent a user from having two `pending` submissions for the same (gym_id, grade, color_tag) simultaneously; a user cannot submit a new route with the same gym + grade + color while they already have a `pending` submission for that combination.

**AC-040** (revised): The system shall, on a gym detail page, filter the route list by grade and by hold color using chip selectors. There shall be no free-text search input and no status filter for normal users.

**AC-041** (revised): The system shall show normal users `active` routes only in the gym route list, with no status tag and no status filter surfaced to them.

**AC-042** (new): The system shall navigate a user from a route entry in the gym route list to that route's detail screen when the user taps the entry, passing the selected route's identifier. The route detail screen is the entry point for logging a send (AC-010), uploading beta (AC-037), watching beta (AC-033), and saving the route (AC-046).

**AC-043** (new): The system shall pre-fill the route submit screen's grade and color chips from the RouteListScreen filter state when the user opens the submit screen. RouteListScreen passes its current grade filter and color filter values as optional parameters to the submit screen; if a grade filter was active when the user tapped "Add Route", the corresponding grade chip shall be pre-selected, and if a color filter was active, the corresponding color chip shall be pre-selected. When a filter is unset, the corresponding chip shall open unselected. Pre-filled chips remain editable by the user before submission.

**AC-044** (new): The route detail screen (RouteDetailScreen) shall not display the route's submitter ("由誰新增" / Submitted By). The `submitted_by_user_id` field remains in the data model for RLS and constraint purposes only and is never surfaced in the route detail UI.

**AC-045** (new): The system shall compose a route's display name automatically from its grade and hold color in the form "`<grade> <Color>`" (e.g. "V3 Blue"), appending the section label in parentheses when a section label is present (e.g. "V3 Blue (Cave)"). The display name is not a stored, user-editable field — it is derived from the route's `grade`, `color_tag`, and optional `section_label` at display time. The composed name shall be used consistently wherever a route is labeled (the gym route list, the route detail screen header, and any surfaced reference to the route). There is no free-text route-name input on the submit screen.

**AC-046** (new): The route detail screen (RouteDetailScreen) shall display a bookmark toggle that reflects whether the route is in the current user's saved routes list and, when tapped, shall add or remove the route from the user's `saved_routes` list and update the toggle state immediately (optimistic update). The route detail screen is the only save/unsave action point for routes.

**AC-047** (new): The gym route list (RouteListScreen) shall display a read-only saved indicator on route entries that are in the current user's saved routes list; no indicator is shown for unsaved routes. The list indicator is read-only — tapping it performs no save/unsave action (tapping the route entry navigates to its detail screen per AC-042). No saved-routes list surface is provided on the Profile or Home tab in Phase 1.

---

### MOD-004 (Send Logging) Acceptance Criteria

**AC-010**: The system shall allow a user to log a send from an existing route detail page in ≤4 taps (route → log → style → confirm).

**AC-011**: The system shall save the log with `grade` derived from `Route.grade` at display time; no per-log grade value is stored.

**AC-012**: The system shall, when the network request to save a send fails, display a clear error message to the user (Phase 1 does not queue sends offline).

**AC-013**: After a send is successfully logged, the ascent list on the route detail screen refreshes immediately to show the new entry without requiring re-navigation.

**AC-014** (new): The system shall restrict the ascent style selector to the fixed three-value enum {flash, top, attempt}. The `project` style is removed — it is not selectable in the UI and is not a valid value in the `ascent_style` database enum. Any historical ascent previously logged with `project` shall be treated as `attempt` (see §9 Data Model migration note).

---

### MOD-005 (Beta Video) Acceptance Criteria

**AC-030**: The system shall reject beta video uploads longer than 60 seconds before upload begins.

**AC-031** (revised): The system shall run client-side video compression before upload and generate a thumbnail on the client, uploading both artifacts to storage. The compression output must be standardised to H.264 baseline profile video + AAC audio in an MP4 container. **Phase 1 simplification**: the thumbnail may use the selected video's URI as a placeholder rather than an extracted still frame; true client-side frame extraction (e.g. a frame at 1 second) is deferred to Phase 2 (requires a frame-extraction library such as `expo-video-thumbnails`). `BetaVideo.thumbnail_url` must still be populated with a valid, retrievable URL in Phase 1.

**AC-032**: The system shall attach a beta video to exactly one `Route` and make it playable inline within 60 seconds of upload completion on a normal 4G/LTE connection.

**AC-033**: The system shall play beta videos inline on the route detail page without requiring the user to leave the app or open an external link.

**AC-034**: The system shall play beta videos inline in the activity feed for videos posted by followed users.

**AC-035**: The system shall reject, on ingest, any beta video upload whose muxed output is not H.264 (baseline profile) video + AAC audio in an MP4 container, and shall surface a clear error to the user rather than storing an unplayable file.

**AC-036**: While a beta video is uploading, a progress overlay is displayed showing upload progress (0–100%). The overlay blocks further interaction until the upload completes or fails, preventing double-submission.

**AC-037** (new): The system shall present an "Add beta video" entry point on the route detail screen that launches the beta video capture/selection flow with the route context (route ID) pre-attached, so the resulting upload is bound to that route (AC-032). The entry point must be visible without leaving the route detail screen.

---

### MOD-006 (Social Graph & Feed) Acceptance Criteria

**AC-050**: The system shall allow a user to follow and unfollow any other user (subject to Block; see AC-083) and reflect the change immediately in the follower's profile counts.

**AC-051**: The system shall include the followed user's subsequent sends and beta videos in the follower's activity feed within one refresh cycle of the follower opening or pull-refreshing the feed.

**AC-052**: The system shall allow a user to like exactly one time per beta video (idempotent) and immediately reflect the like count change on the video.

**AC-053**: The system shall not render a comment UI anywhere in the app in Phase 1 and shall not expose a like affordance on plain send logs.

> **Implementation note (MOD-006 feed query)**: The activity feed must be served by a `SECURITY INVOKER` Postgres RPC that explicitly composes Follow ∩ (¬Block, symmetric) ∩ privacy (followers-only visibility), not by a raw client-side table `SELECT`. RLS remains the security fence; the RPC performs the composition. This is a requirement, not an option, for MOD-006.

---

### MOD-007 (Notifications) Acceptance Criteria

**AC-054**: The system shall register the user's iOS device token on first successful sign-in and store it in `DeviceToken`, deduplicated per (user_id, device_token) pair.

**AC-055**: The system shall, on insert of a `Reaction` with `target_type = beta_video`, insert exactly one `Notification` row for the video's uploader and enqueue exactly one APNs push per registered active device token belonging to the uploader, gated by the uploader's `NotificationPreference.beta_video_like`.

**AC-056**: The system shall deliver the beta-video-like push notification within 30 seconds of the like event for ≥95% of likes measured over a 24-hour rolling window.

**AC-057**: The system shall expose a Settings screen toggle for beta-video-like push notifications; when the toggle is off, no push is enqueued for that user for that event type, but the in-app `Notification` row is still created.

**AC-058** (new): The system shall navigate a user from a beta-video-like entry in the in-app notification inbox to the liked beta video (on its route detail screen) when the user taps the entry, resolving the notification's `target_id` to the target beta video.

> **Implementation note (MOD-007 push idempotency)**: The notification/push fan-out Edge Function must be invoked by a Postgres trigger on `Reaction` INSERT (via `pg_net`/webhook), never triggered from the client. The function must be idempotent: a unique constraint on `Notification(recipient_user_id, actor_user_id, type, target_id)` guarantees a second trigger fire (double-tap / client retry) cannot create a duplicate notification row or a duplicate push. This is a requirement for the MOD-007 spec.

---

### MOD-008 (Profile History & Stats) Acceptance Criteria

**AC-060**: The system shall render the current user's full send history filterable by gym, grade, and date range.

**AC-061**: The system shall render basic stats: total sends, sends by grade (bar chart), current streak (consecutive days with ≥1 send), and highest grade climbed.

**AC-062**: The system shall recalculate stats immediately after a new send log is saved and re-render the stats view without requiring a manual refresh.

**AC-064** (new): The system shall navigate a user from another user's entry in the activity feed (or any surfaced user reference, e.g. a beta video author or follower) to that user's profile and send history, subject to the target's privacy setting (AC-063): a `followers_only` profile requested by a non-follower shows the hidden/403 state rather than the send history.

**AC-065** (new): The system shall display an achievement icon for each logged send in the send history, mapped from the send's ascent style: `flash` → a flash (⚡) achievement icon, `top` → a send/top-out achievement icon, and `attempt` → a project/tried achievement icon (🎯). The icon set covers exactly the three ascent styles (there is no `project` style; the former `project` achievement maps to the `attempt` style per AC-014).

---

### MOD-009 (Moderation — Report & Block) Acceptance Criteria

**AC-080**: The system shall allow a user to report a beta video or a user profile with a category (e.g., inappropriate, spam, harassment, other) and an optional note, and persist the report to the `Report` table for admin review in Supabase Studio.

**AC-081**: The system shall show the reporter a confirmation state after a successful report submission and shall not require admin action to complete the report flow.

**AC-082**: The system shall allow a user to block another user, persist the relationship in the `Block` table, and immediately hide the blocked user's beta videos, sends, and profile from the blocker's feed and route pages.

**AC-083**: The system shall prevent a blocked user from following the blocker, liking the blocker's beta videos, or otherwise interacting with the blocker's content.

**AC-084**: The system shall apply block hiding symmetrically — the blocker's beta videos, sends, and profile shall also be hidden from the blocked user's feed and route pages, in addition to hiding the blocked user's content from the blocker (App Store Guideline 1.2 requirement).

**AC-085**: The system shall run a scheduled Edge Function (every 6 hours) that emails the admin (wu.tsan@northeastern.edu) a digest of all open reports (`Report.status = open`) older than 12 hours, so the solo operator is alerted to unresolved objectionable-content reports within the App Store Guideline 1.2 response window.

---

### MOD-010 (Localization & Theming) Acceptance Criteria

**AC-090**: The system shall detect the device locale on first launch, set the app language to English if the device locale is English, and otherwise fall back to Traditional Chinese (zh-TW).

**AC-091**: The system shall expose a language toggle in Settings between English and zh-TW that takes effect immediately without an app restart.

**AC-092**: The system shall default to the OS Light/Dark appearance and expose a Settings override with three states (System, Light, Dark) that takes effect immediately without an app restart.

---

### MOD-011 (Analytics) Acceptance Criteria

**AC-100**: The system shall emit PostHog events for at minimum: signup completed, gym saved, first send logged, first beta video uploaded, beta video liked, session start.

**AC-101**: The system shall not send PII beyond `user_id` and non-identifying context fields to PostHog.

---

### MOD-012 (Home) Acceptance Criteria

**AC-110** (new): The system shall present a persistent bottom tab bar with three icon-only tabs: Home (house icon), Gyms (climb icon), and Profile (person icon). The Home tab is the default tab after login.

**AC-111** (new): The Home screen shall render three sections in order: Banners, Saved Gyms, and Following Climbers.

**AC-112** (new): The Banners section shall display up to 3 static, hardcoded banner cards in a horizontal scroll. If no banners are defined, the section shall be hidden.

**AC-113** (new): The Saved Gyms section shall display a horizontal scroll strip of the current user's saved gyms, each showing the gym's `photo_url` and name. A "View All" control shall navigate to the full gym list (MOD-002).

**AC-114** (new): Tapping a gym in the Saved Gyms strip shall navigate to the Gyms tab (Phase 1: switches to the Gyms tab; deep-link to a specific gym's detail screen is a future enhancement).

**AC-115** (new): When the current user has no saved gyms, the Saved Gyms section shall display the prompt: "Tap the bookmark on any gym to save it."

**AC-123** (new): The Following Climbers section shall display a horizontal scroll strip of the climbers the current user follows (sourced from MOD-006), each showing the climber's avatar and display name. Tapping a climber shall navigate to that climber's profile.

**AC-124** (new): When the current user follows no one, the Following Climbers section shall display an appropriate empty state.

---

## 9. Data Model

```
User
 - id, display_name, avatar_url,
   bio, privacy_setting (public | followers_only), created_at

Gym  (admin-maintained, branch-level rows for multi-branch gyms)
 - id, name, branch_label (nullable, e.g. "萬華", "南港"), city, district,
   address_text, lat, lng, gym_type (bouldering | top_rope | both),
   photo_url (nullable), official_grading_system (default 'V'),
   created_at, updated_at

SavedGym  (join table — a user's bookmarked gyms)
 - user_id (FK User, ON DELETE CASCADE), gym_id (FK Gym, ON DELETE CASCADE),
   created_at
 - PK: (user_id, gym_id)

SavedRoute  (join table — a user's bookmarked routes)
 - user_id (FK User, ON DELETE CASCADE), route_id (FK Route, ON DELETE CASCADE),
   created_at
 - PK: (user_id, route_id)

GymRequest
 - id, requested_by_user_id, name, city, google_maps_url (nullable),
   status (pending | added | rejected), created_at, reviewed_at (nullable)

Route
 - id, gym_id (FK Gym), section_label (nullable), grade (V-scale enum),
   color_tag (enum: red|orange|yellow|green|blue|purple|pink|white|black — required),
   photo_url (required),
   match_key (Postgres GENERATED ALWAYS AS (gym_id + grade + color_tag) STORED;
   uniqueness enforced by a PARTIAL unique index
   UNIQUE (gym_id, grade, color_tag) WHERE status = 'active',
   so retired/rejected routes may reuse the same key after a wall reset),
   status (route_status enum: active | pending | retired | rejected),
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
   -- Auto-approve defaults ON at Phase 1 launch. Only 'active' routes participate
   -- in the match-before-create pool and the normal-user route list.

Ascent (a "log")
 - id, user_id (FK User), route_id (FK Route),
   style (ascent_style enum: flash | top | attempt), attempts,
   note, logged_at, is_private
   -- grade is NOT stored per-log; always read from route.grade at display time
   -- The 'project' ascent style is REMOVED. ascent_style has exactly three
   -- values (flash | top | attempt). See migration note below.

BetaVideo
 - id, route_id (FK Route), user_id (FK User),
   video_url, thumbnail_url, duration_seconds, caption, created_at

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

Block  (App Store Guideline 1.2 requirement)
 - blocker_user_id (FK User), blocked_user_id (FK User), created_at
 - PK: (blocker_user_id, blocked_user_id)
```

**Notes**:

- All tables are guarded by Supabase Row-Level Security policies.
- `SavedGym` is the join table backing the multi-gym saved list (it replaces the removed single `User.home_gym_id`). Its RLS policies must scope reads and writes so an authenticated user can only read and write rows where `user_id = auth.uid()` — a user can never see or modify another user's saved gyms.
- `SavedRoute` is the join table backing the saved-routes bookmark (US-021, AC-046/AC-047). Its RLS policies must scope reads and writes so an authenticated user can only read and write rows where `user_id = auth.uid()` — a user can never see or modify another user's saved routes. `route_id` is `ON DELETE CASCADE` so a saved-route row disappears if the underlying route is deleted (e.g. a withdrawn pending route). **This is a new join table and requires Tech Lead architecture review (table placement/ownership, RLS policy set, grants) before Doc-Sync/Engineering implements it** — mirror the confirmed `saved_gyms` design (composite PK, dual `ON DELETE CASCADE`, own-rows-only SELECT/INSERT/DELETE RLS, no UPDATE, explicit grants).
- A route's **display name is composed, not stored** (AC-045): it is derived at display time from `grade` + `color_tag` (+ `section_label` when present), e.g. "V3 Blue" / "V3 Blue (Cave)". There is no free-text route-name column and no user-editable route name.
- **`ascent_style` enum change — `project` removed (requires Tech Lead architecture review).** PostgreSQL does not support dropping a value from an existing enum type directly. The migration must: (1) create a new `ascent_style` enum containing exactly `flash | top | attempt` (without `project`); (2) migrate any existing rows whose style is `project` to `attempt`; (3) alter the `ascents.style` column to the new enum type and drop the old enum. This is a data-model migration with data backfill and enum swap — **it requires Tech Lead architecture review before Doc-Sync/Engineering implements it** (safe migration ordering, transaction boundaries, and the PG restriction that a newly created type + column swap + old-type drop must be sequenced correctly, consistent with the project's established two-file enum-migration convention).
- The `Route.match_key` is a Postgres `GENERATED ALWAYS AS ... STORED` column. Uniqueness of active routes is enforced at the database level by a partial unique index `UNIQUE (gym_id, grade, color_tag) WHERE status = 'active'` — not only in application code — so that reused tape colors after a wall reset don't collide with historical retired routes.
- `DeviceToken` uses Expo Push under the hood; APNs is the transport for iOS in Phase 1. Android tokens land here in Phase 2.
- `NotificationPreference` is designed to grow — Phase 2 will add columns for expanded notification types.
- **Edge Function secret naming**: Edge Functions must read the service-role key from the secret named `SERVICE_ROLE_KEY`, **not** `SUPABASE_SERVICE_ROLE_KEY` — Supabase reserves the `SUPABASE_` prefix for its own injected variables. The service-role key is stored via `supabase secrets` and is never imported into client code.

---

## 10. Non-Functional Requirements

- **Platform**: iOS 16+ (Phase 1). Android is Phase 2.
- **Video**: 60-second maximum. Client-side compression before upload. Client-generated thumbnail (Phase 1: may use the video URI as a placeholder; true still-frame extraction is deferred to Phase 2 per AC-031). Storage in Supabase Storage during Phase 1; migrate to Cloudflare Stream when monthly video cost exceeds US$25 or total video storage exceeds 20 GB, whichever comes first. Operator responsibility: monitor monthly usage in Supabase dashboard.
- **Backend**: Supabase (Postgres + Auth + Storage + Edge Functions), with RLS policies on every user-writable table. No custom backend server in Phase 1.
- **Saved gyms**: The `saved_gyms` join table requires RLS such that an authenticated user may read and write only their own rows (`user_id = auth.uid()`). No user can read or modify another user's saved-gyms list.
- **Saved routes**: The `saved_routes` join table requires RLS such that an authenticated user may read and write only their own rows (`user_id = auth.uid()`). No user can read or modify another user's saved-routes list. Saved routes are surfaced only in the browse flow (bookmark toggle on the route detail screen; read-only saved indicator on the gym route list) — Phase 1 provides no dedicated saved-routes list surface.
- **Auth**: Email, Apple Sign-In, and Google Sign-In. Apple Sign-In is required by the App Store since Google Sign-In is offered.
- **Push notifications**: APNs via Expo Push. Phase 1 fires for beta-video likes only, and only when the recipient's `NotificationPreference.beta_video_like` is true. A settings screen exposes the toggle.
- **Offline tolerance**: Phase 1 does **not** queue sends offline. On any network failure, the user sees a clear error message and can retry. Offline queue is Phase 2.
- **Report/Flag & Block**: Required in Phase 1 for App Store Guideline 1.2 compliance. Reports and blocks are user-actioned; admin review of reports happens in Supabase Studio. Block hiding is symmetric (see AC-084).
- **Report alerting (operational, Phase 1)**: A scheduled Edge Function runs every 6 hours and emails the admin (wu.tsan@northeastern.edu) a digest of open reports older than 12 hours, so the solo operator can act within the App Store Guideline 1.2 response window without polling Supabase Studio (see AC-085).
- **Localization**: English and Traditional Chinese (zh-TW) in Phase 1. Default language: device locale, with zh-TW fallback for any non-English locale. Settings screen exposes a language toggle. Message catalogs must be complete (no missing keys) at ship.
- **Theming**: Light and Dark mode in Phase 1. Follows OS appearance by default; Settings exposes a three-state override (System / Light / Dark).
- **Admin tooling**: Supabase Studio only for Phase 1. All gym CRUD, gym-request review, report review, user block/ban, and near-duplicate route merges are performed by the admin (Leon) via Supabase Studio. No in-app admin UI.
- **Data quality (routes)**: Gyms are admin-curated so they can't drift. Routes are user-submitted; server-side duplicate protection is the primary defense — the `submit_route` RPC pre-check plus the partial unique index on active routes (`WHERE status = 'active'`) reject duplicate active routes at the database level (§8 AC-020). The RouteListScreen grade + color filter lets climbers find an existing route before adding a new one. Admin can spot-check and merge near-duplicates in Supabase Studio.
- **Analytics**: PostHog free tier. Ship the core funnel events listed in AC-100. No PII beyond `user_id` sent to PostHog.
- **Performance targets**: App cold start ≤3 seconds on iPhone 12 or newer. Feed initial render ≤2 seconds on a normal 4G/LTE connection with a warm cache.
- **Security**: All Storage buckets have RLS policies aligned with the corresponding table policies (e.g., a user cannot fetch a private ascent's associated media). All Edge Functions validate the JWT and re-check authorization against Postgres. Edge Functions read the service-role key from the secret named `SERVICE_ROLE_KEY` (Supabase reserves the `SUPABASE_` prefix); the service-role key is never inlined into the client bundle.
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
- **Video hosting migration operational readiness**: The Supabase Storage → Cloudflare Stream migration trigger (cost > US$25/mo OR storage > 20 GB) has no documented runbook yet. Risk: hitting the trigger mid-Phase-1 without a rehearsed migration path. Mitigation: Tech Lead to specify a migration runbook (dual-write vs. batch backfill, URL rewriting strategy) during architecture review, even though the migration itself is expected in Phase 2.
- **Tape color reuse collisions**: Two genuinely different routes at the same gym with the same grade + color could collide even after match-before-create, because the fixed 9-color enum plus common grade reuse guarantees occasional overlap. This also affects the composed route display name (AC-045): two same-grade/same-color routes render with the same name unless disambiguated by `section_label`. Mitigation: `section_label` disambiguator is already in the schema and is appended to the display name when present; it may need to become a required tiebreaker in Phase 2 based on real data.
- **Admin bandwidth for reports**: With Supabase Studio as the only report review surface, response time depends on operator (Leon) checking Studio. Mitigation adopted (AC-085): a scheduled Edge Function emails Leon a 6-hourly digest of open reports older than 12 hours. Residual risk: App Store may still expect a faster in-app moderation queue; a lightweight in-app admin surface is held in the Phase 2 slot if review flags it.
- **APNs deliverability tail**: The AC-056 target of ≥95% delivery within 30 seconds depends on Expo Push + APNs latency and on device state. Needs measurement post-launch — if the tail is worse than expected, revisit push architecture in Phase 2.
- **App Store Guideline 1.2 review outcome**: Report + Block are implemented, but App Store review is not deterministic. Risk: additional moderation requirements surface during review (e.g., faster response SLA, in-app moderation queue). Mitigation: keep Phase 2 slot available for a lightweight in-app admin surface if needed.
- **Cold start for routes at newly-seeded gyms**: Routes start empty per gym until users submit. Mitigation: Leon to personally seed routes at a few gyms + a few beta videos before opening to beta users.
- **PostHog free-tier ceiling**: Free tier has monthly event caps. Risk: hitting the cap mid-month kills analytics. Mitigation: monitor volume; consider event sampling if approaching cap.

---

## 13. Roadmap

1. **Phase 1 (MVP, iOS, Taipei + New Taipei)** — Auth (Email + Apple + Google), curated branch-level gym directory, route submission with match-before-create + fixed color enum + V-scale + composed route display name, route bookmarking in the browse flow, send logging with clear error on network failure and a three-value ascent style (flash/top/attempt), beta video (60 sec + client compression + client thumbnail) via Supabase Storage, follow + activity feed, beta-video likes with APNs push + preference toggle, profile history + basic stats with per-send achievement icons, Report + Block (App Store 1.2), English + zh-TW (device-locale default, Settings toggle), Light + Dark (OS default, Settings override), PostHog analytics, Supabase Studio admin only.
2. **Phase 2 (Community depth + Android)** — Android build, offline send queue, expanded push notifications, comments (conditional), retire/reset voting workflow, ascent pyramid visualization, "suggest an edit" gym flow, dedicated saved-routes list surface, Cloudflare Stream video migration (if trigger hit in Phase 1), beta-video thumbnail frame extraction (Phase 1 uses a placeholder thumbnail), lightweight in-app moderation surface if needed for App Store follow-up.
3. **Phase 3 (Gym partnerships)** — Gym-claimed profiles, official route-setter publishing, gym-facing analytics, optional gym subscription monetization (climber app stays free).

---

## 14. Competitive Reference Summary

| App | Strength | Gap vs. Send It |
|---|---|---|
| Kaya | Full loop: log, beta, social, gym partnerships, challenges | Global/outdoor-first, not localized for TW gyms or color-grading conventions |
| 27 Crags / OpenBeta | Open, wiki-style community route data | Outdoor-crag focused, not gym/bouldering-session oriented |
| Vertical-Life | Polished guidebook + logging | Europe-centric, not present in Taiwan |
| Sendage | Clean send-logging UX, "Send Grid" visualization | No route database or beta-sharing depth |
| MyClimb | Popular for indoor gym social use | No meaningful Taiwan presence |
| 記石 (Ji Shi) | Only real Taiwan-native app found | Log-only — no beta video, no route database, no social layer |

**Wedge**: Send It is the first app actually built around Taiwan's indoor bouldering scene — local branch-level gym coverage on day one, tape-color-based route matching that reflects how climbers actually talk about routes, and the log + beta + social loop that Kaya proved works — without waiting on official gym buy-in.
