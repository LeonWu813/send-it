# PRD: Send It — A Community Bouldering App for Taiwan

**Author:** Leon
**Status:** Draft v0.2
**Last updated:** 2026-09-01
**Team context:** Solo builder, AI-assisted ("vibe coding"); no fixed deadline, phased delivery

---

## 1. Problem Statement

Indoor bouldering has grown fast in Taiwan — Taipei and New Taipei have the highest concentration of gyms, with more scattered across Taoyuan, Hsinchu, Taichung, Kaohsiung, and elsewhere — but climbers currently have no dedicated app to:
- log their sends and see their own progress over time
- watch or share beta (technique/movement videos) for specific routes
- see what routes are currently live at their home gym
- connect with other climbers in the local scene

Today this happens informally — PTT posts, Instagram/Threads stories, word of mouth — or through global apps (Kaya, Vertical-Life, 27 Crags) that are outdoor-crag-centric, not localized for Taiwan gyms, and don't reflect local color-based grading conventions or gym-specific route resets.

One small local app ("記石") exists but is log-only — no beta video, no cross-gym route database, no social layer.

**Opportunity:** Build a lightweight, Taiwan-first version of Kaya's core loop — log a send, watch/share beta, see your history — starting with a curated (us-maintained) gym directory and user-submitted routes matched against a standardized naming scheme, before attempting any official gym partnerships.

---

## 2. Goals

### Product goals (v1)
- Let a climber create a profile and log climbs (route + grade + attempts + status) in under 30 seconds per entry
- Let a climber upload a short beta video attached to a specific route
- Let a climber browse "what's currently active at Gym X" via user-submitted route lists
- Let a climber view their own send history and stats (à la Kaya's ascent pyramid)

### Non-goals (v1)
- Outdoor crag / GPS topo guidebook (Kaya/27 Crags already own this — not the wedge for a solo build)
- Official gym partnerships, route-setter tools, or paid gym dashboards (explicitly Phase 3)
- Competition/league scoring
- Training plans / workout logging (Crimpd's territory)

### Success metrics (early, directional — adjust once you have users)
- # of routes logged per active user per week (engagement/retention proxy)
- # of beta videos uploaded per gym (content density — the flywheel Kaya depends on)
- # of gyms with at least 10 user-submitted routes (coverage — tells you if self-serve data collection actually works before you pitch gyms)
- Week-4 retention of new signups

---

## 3. User Stories (from your brief + reasonable extensions)

**Primary persona: "Indoor climber, Taiwan"** — climbs 2–4x/week at 1–2 home gyms, V0–V6 range, wants to track progress and get better at specific problems via others' beta.

- As a climber, I want to log a send with grade, attempts, and status (flash/redpoint/attempt) so I can track my progress.
- As a climber, I want to upload a beta video for a route so others attempting it can learn from my sequence.
- As a climber, I want to browse the current route list at my gym so I know what's set before I go.
- As a climber, I want to see my full climbing history and stats on my profile, including a breakdown by grade.
- As a climber, I want to follow other climbers and see their recent sends/beta.
- As a new user, I want to find my gym already in the app; if it's missing, I want an easy way to request it be added, and I want to add its routes myself since there's no official route data source yet.

---

## 4. Scope & Phasing

### Phase 1 — MVP (curated gyms + standardized user-submitted routes)
Core loop: **Find your gym (pre-loaded) → Match or add a route → Log a send (+ optional beta video) → View profile/history**

| Feature | Included in Phase 1 |
|---|---|
| Auth & profile | ✅ |
| Gym directory (curated by us, seeded from Google Maps research — Taipei + New Taipei only) | ✅ |
| Other cities (Taoyuan, Hsinchu, Taichung, Kaohsiung, Yilan, Tainan) | ❌ (future phase) |
| Route list per gym (user-submitted, standardized naming, matched against existing routes to prevent duplicates) | ✅ |
| Log a send (official gym grade, style, attempts, notes) | ✅ |
| Upload beta video attached to a route | ✅ |
| Profile: history feed + basic stats (sends by grade, streak) | ✅ |
| Follow other users + activity feed | ✅ |
| Like (reaction) on beta videos only — no comments | ✅ |
| Notifications for likes on your beta videos only | ✅ |
| Search/filter routes by gym, grade, active status | ✅ |
| Route setter–verified data, gym dashboards | ❌ (Phase 3) |
| Push notifications for new routes / other activity types | ❌ (Phase 2) |
| Outdoor crags/GPS topos | ❌ (out of scope entirely) |
| Competitions/leagues | ❌ (out of scope entirely) |

### Phase 2 — Community depth
- Expanded notifications (new routes at followed gyms, someone flashed your project, new follower) — beyond the beta-video-like notifications shipped in Phase 1
- Comments (re-introduce if the community asks for it and moderation tooling is ready)
- Route "retire/reset" workflow — community flags a route as taken down, with light moderation/voting so stale data self-corrects
- Ascent pyramid / progress visualizations (Kaya-style)
- Basic leaderboard within a gym or friend group (opt-in)
- Bilingual UI (繁體中文 first, English toggle) if not already done in Phase 1

### Phase 3 — Gym partnerships (only after real user base validates demand)
- Route-setter accounts: gyms can claim their gym profile and publish official route lists directly, superseding user-submitted data
- "New set" notifications sourced from the gym, not the community
- Optional gym-facing analytics (which routes are popular, which are too hard/easy)
- Possible monetization: gym subscription for the route-setter dashboard, keeping the climber app free (mirrors Kaya's model)

---

## 5. Core Feature Requirements (Phase 1 detail)

### 5.1 Auth & Profile
- Sign up via email or social login (Apple/Google — required for iOS App Store if using social login at all)
- Profile fields: display name, avatar, home gym(s), highest grade climbed (optional, auto-calculable from logs), bio
- Privacy setting: public profile vs. followers-only (recommend public-by-default with an opt-out, since beta-sharing value depends on visibility)

**Acceptance criteria:** a new user can complete signup and set a home gym in under 1 minute; profile is viewable by other users per privacy setting.

### 5.2 Gym Directory (curated by us — not user-submitted)
Unlike routes (which are user-submitted against our standardized structure), the **gym list itself is maintained by us**, seeded from a manual Google Maps / web research pass before launch. This removes the duplicate-gym problem entirely and means the app has real coverage on day one instead of an empty directory.

**Launch geography: Taipei + New Taipei only.** This is the highest-density bouldering market in Taiwan and small enough for one person to personally verify every gym's data before go-live. Other cities (Taoyuan, Hsinchu, Taichung, Kaohsiung, Yilan, Tainan) are explicitly **out of scope for Phase 1** and move to a later phase once the Taipei/New Taipei user base validates the concept — see the future-phase list at the end of this section.

- Each gym record: name, city/district, address, map pin (lat/long from Google Maps), gym type (bouldering / top-rope / both), photo, official grading system used (if known), created/maintained by admin (you)
- Users **cannot** create new gyms in Phase 1. If a climber's gym is missing, they submit a "request a gym" form (name + city + optional Google Maps link) that you review and add manually — keeps the directory clean while still capturing demand signal for which gyms/cities to prioritize next
- Editing an existing gym's info (hours, address correction, etc.) is admin-only in Phase 1; consider a lightweight "suggest an edit" flow in Phase 2 once you have moderation bandwidth

**Acceptance criteria:** every gym in the directory has a verified address/map pin before launch; a missing-gym request is captured and visible to the admin within the app or via a simple form/spreadsheet.

**Seed list — Taipei / New Taipei launch gyms** (compiled from public gym directories; verify each address/hours against Google Maps before entering into the database, since hours and pricing change):

| Gym | City / Area | Address | Type |
|---|---|---|---|
| MegaSTONE Climbing Gym | New Taipei (Xinzhuang) | 新北市新莊區中正路56巷5號 | Bouldering + top-rope |
| CORNER 角攀岩館 (中山店) | Taipei (Zhongshan) | 台北市中山區中山北路二段68號B1 | Bouldering |
| CORNER 角攀岩館 (華山店) | Taipei (Zhongshan) | 台北市中山區新生北路一段86號 | Bouldering |
| 原岩攀岩館 (T-UP, branches: 萬華/南港/新店/中和/明德) | Taipei / New Taipei | e.g. 台北市北投區文林北路222號B1 (verify each branch) | Bouldering + top-rope |
| Camp4 達文西攀岩館 | Taipei (Beitou) | 台北市北投區石牌路一段39巷100號 | Top-rope focused |
| double8 岩究所 | Taipei (Dadaocheng) | 台北市大同區迪化街一段251號 | Top-rope focused, some bouldering |
| 市民抱石攀岩館 | Taipei (Nangang) | 台北市南港區市民大道八段552號2樓 | Bouldering |
| 奇岩攀岩館 | Taipei (Nangang) | 台北市南港區忠孝東路七段512號 | Bouldering |
| RedRock 紅石攀岩 (士林) | Taipei (Shilin) | 台北市承德路四段261號B1 | Bouldering |
| Wusa 攀岩館 (新莊/三重) | New Taipei | 新北市新莊區公園路11號2樓 (+ Sanchong branch) | Top-rope focused |
| 永和攀岩場 | New Taipei (Yonghe) | 新北市永和區永利路250號6樓 | Top-rope + bouldering + speed |

This gives roughly 11 gym listings (some multi-branch) concentrated in Taipei/New Taipei — enough for a real launch without the maintenance burden of verifying gyms island-wide before you have any users.

**Future phase — other cities (do not build for Phase 1):**

| Gym | City |
|---|---|
| 原岩攀岩館 A19 | Taoyuan |
| Passion climbing 爬森攀岩館 | Taoyuan |
| 千手抱石 | Taoyuan |
| 新竹風城 (成功館 / 勝利館) | Hsinchu |
| 新竹紅石 | Hsinchu |
| Dapro室內攀岩場 | Taichung |
| 攀吶攀岩館 | Taichung |
| B-plus 攀岩館 | Taichung |
| Boulder Space 圓石空間攀岩場 | Kaohsiung |
| B-topia 攀岩館 | Kaohsiung |
| 慶倡攀岩生活館 | Kaohsiung |
| 抱石基地 | Kaohsiung |
| Rockdance 舞岩抱石攀岩館 | Yilan |
| 奇岩攀岩館 (宜蘭 — address needs verification) | Yilan |
| 嗨翻綜合體能館 | Tainan |

Revisit this list once Taipei/New Taipei usage justifies expansion — treat it as a backlog, not a commitment to any particular next city. Treat the launch table above as a starting checklist, not final data: confirm each address, current hours, and whether the gym is still operating before go-live, since gym info (especially smaller/newer gyms) changes.

### 5.3 Route List per Gym (user-submitted, but standardized against a fixed naming scheme)
Routes are the one entity climbers submit themselves — but to avoid the duplicate-route mess that self-serve data usually creates, every route is identified by a **standardized composite key**: `gym - grade - hold/tape color` (e.g. `MegaSTONE - V3 - Blue`). This makes routes matchable even without a route setter ever touching the app.

**Submission flow:**
1. User selects the gym (from the curated directory) and enters grade + hold color.
2. App searches existing routes at that gym for the same grade + color combination.
3. If one or more matches exist, the user is shown them (with photo, if available) and picks the matching route instead of creating a new one.
4. Only if no match exists does the app let the user create a new route — and creation **requires** a photo and basic info (wall/section, grade, color) so future matching has something to compare against. No photo, no submission.

- Additional fields on creation: wall/section (free text or zone tag), grade (official V-scale grade as posted at the gym — see §5.4), hold/tape color, photo (required), active/retired status, date added, submitted_by_user_id
- Any user can flag an existing route as retired/taken down (simple flag + timestamp in Phase 1; add voting/moderation in Phase 2 if flagging gets abused)
- Because multiple gyms may reset a wall and reuse the same grade+color combo over time, "active" routes and "retired" routes are treated as separate matching pools — a new submission only matches against currently-**active** routes at that gym, so an old retired "V3 Blue" doesn't block logging a new "V3 Blue" reset
- Route detail page shows: grade, gym/section, color, photo, all logged ascents from users, all beta videos attached

**Acceptance criteria:** submitting a route for a gym/grade/color combination that already exists (and is active) surfaces the existing route instead of creating a duplicate; creating a genuinely new route requires a photo and is blocked without one.

### 5.4 Logging a Send
- Log fields: route (select existing via the match flow in §5.3, or create new if no match), grade (locked to the route's official grade — no per-user override, since the gym's posted grade is the source of truth in this version), style (flash / top / attempt / project), attempts, date, private note
- One-tap "log a send" flow from a route page, or from a global "+" button that lets you search-and-select the route first

**Acceptance criteria:** logging a send from an existing route takes ≤4 taps; the grade shown and saved on the log always matches the route's official grade.

### 5.5 Beta Video
- Upload a short video (recommend capping at 30–60 sec + client-side compression to control storage/bandwidth cost — see §7)
- Attach to a specific route; optional caption/note
- Playback inline in route detail page and in the activity feed (Kaya's "beta like reels" pattern users specifically like, per app store reviews)

**Acceptance criteria:** a video uploads and is playable within the app without requiring an external link.

### 5.6 Social Layer
- Follow/unfollow other users
- Activity feed: chronological feed of sends + beta videos from followed users (and optionally, all activity at your home gym)
- **Like (reaction) on beta videos only** — no comments in this phase, and no likes on plain send logs (keeps the interaction surface small and easy to moderate at solo-builder scale)
- **Notifications:** the only notification type in Phase 1 is "someone liked your beta video." No notifications for new followers, new routes, or other activity yet — that expands in Phase 2 (see §4)

**Acceptance criteria:** following a user surfaces their subsequent activity in the current user's feed within one refresh cycle; liking a beta video generates exactly one notification to the video's uploader; no comment UI exists anywhere in the app.

### 5.7 Profile History & Stats
- Full log history, filterable by gym/grade/date range
- Basic stats: count by grade (bar chart), total sends, current streak, highest grade
- (Phase 2) ascent pyramid visualization matching Kaya's pattern

**Acceptance criteria:** stats recalculate immediately after a new log is saved.

---

## 6. Data Model (starting sketch)

```
User
 - id, display_name, avatar_url, home_gym_id (nullable), bio, privacy_setting, created_at

Gym  (admin-maintained, not user-created)
 - id, name, city, district, address_text, lat, lng, gym_type (bouldering/top-rope/both),
   photo_url, official_grading_system, created_at, updated_at

Route
 - id, gym_id, section_label, grade (V-scale enum, = gym's official grade), color_tag (required),
   photo_url (required), match_key (derived: gym_id + grade + color_tag, used to detect duplicates
   on submission), status (active/retired), submitted_by_user_id, created_at, retired_at (nullable)

Ascent (a "log")
 - id, user_id, route_id, style (flash/top/attempt/project), attempts,
   note, logged_at, is_private
   -- grade is NOT stored per-log; always read from route.grade at display time

BetaVideo
 - id, route_id, user_id, video_url, caption, created_at

Follow
 - follower_id, followee_id, created_at

Reaction  (Phase 1: beta videos only)
 - id, user_id, target_type (beta_video), target_id, created_at

Notification  (Phase 1: beta-video likes only)
 - id, recipient_user_id, actor_user_id, type (beta_video_like), target_type (beta_video),
   target_id, is_read, created_at
```

This is intentionally close to Kaya's/27 Crags' relational model (gym → route → ascent/beta), with the gym layer inverted to admin-curated rather than user-created, and social interactions deliberately narrowed to reduce moderation surface for a solo build.

---

## 7. Non-Functional Requirements

- **Video storage & cost:** raw video hosting gets expensive fast. For a solo build, recommend a managed video service (e.g., Cloudflare Stream, Mux, or Bunny Stream) over rolling your own S3+transcoding pipeline — trades a small per-minute cost for drastically less engineering time, which matters for solo/vibe-coding pace. Cap video length and resolution at upload.
- **Backend-as-a-service:** given solo + AI-assisted development, strongly consider Firebase or Supabase for auth, database, and storage rather than a custom backend — this is the single biggest lever for shipping Phase 1 fast.
- **Cross-platform framework:** since you've chosen "both platforms," React Native (Expo) or Flutter are the realistic choices for a solo builder; Expo is generally faster to get to a working app store build with less native tooling overhead.
- **Localization:** Traditional Chinese as primary language; plan the string/content architecture for a second language (English) from day one even if you don't ship it in Phase 1 — retrofitting i18n later is painful.
- **Moderation:** even at small scale, plan a basic report/flag mechanism for inappropriate beta videos, since UGC video is being uploaded and played back publicly — you don't want takedown requests with no process. (No comments to moderate in Phase 1, which lowers this surface considerably.)
- **Offline tolerance:** gym basements/warehouses often have poor signal — logging a send should queue locally and sync when connectivity returns, rather than fail.
- **Data quality (routes):** gyms are admin-curated so they can't drift, but routes are still user-submitted — the match-before-create flow (§5.3) is the main defense against duplicates. Still build a simple admin view (even a spreadsheet-backed one early on) to spot-check and merge any routes that slip through as near-duplicates (e.g. slightly different color naming for the same tape).

---

## 8. Open Questions / Risks

- **Cold-start problem — resolved by decision:** the gym directory is curated and seeded from Google Maps research before launch (§5.2), so the app has real gym coverage on day one instead of an empty directory. Routes still start empty per gym until users submit them — worth personally seeding your own home gym's current routes + beta before inviting others.
- **Grade source of truth — resolved by decision:** no per-user grade override. Routes use the gym's official posted grade (V-scale) as entered at submission time; all logs inherit that grade. This trades some "different climbers grade differently" nuance for simplicity and consistency — acceptable for v1, revisit only if users push back hard.
- **Duplicate gyms — resolved by decision:** gyms are admin-maintained, not user-submitted, so this class of duplicate can't occur. Missing gyms are handled via a "request a gym" flow instead of open creation.
- **Duplicate routes — resolved by decision:** routes use a standardized `gym - grade - hold color` match key. On submission, the app searches for existing active routes matching that key and asks the user to confirm/select before allowing a new creation, which additionally requires a photo. Residual risk: two genuinely different routes at the same gym/grade with the same color (common when a gym reuses tape colors) could still collide — worth watching once real data comes in, and adding a secondary disambiguator (e.g. wall/section) as a tiebreaker if it becomes a real problem.
- **Video cost at scale:** fine at hobby scale; revisit hosting choice if usage grows significantly.
- **When to approach gyms (Phase 3):** better leverage once you can show a gym real usage numbers from their climbers rather than a cold pitch.

---

## 9. Roadmap (sequence, not dated)

1. **Phase 1 MVP:** auth/profile → seed curated gym directory → route submission with match-before-create → log a send (official grade) → beta video upload → activity feed/follow → beta-video likes + like-only notifications → profile stats
2. **Phase 2:** expanded notifications, comments (if warranted), retire/reset workflow with light moderation, ascent pyramid, bilingual UI
3. **Phase 3:** gym-claimed profiles, official route publishing, gym analytics, potential gym subscription monetization

---

## 10. Competitive Reference Summary

| App | Strength | Gap vs. your idea |
|---|---|---|
| Kaya | Full loop: log, beta, social, gym partnerships, challenges | Global/outdoor-first, not localized for TW gyms or color grading conventions |
| 27 Crags / OpenBeta | Open, wiki-style community route data | Outdoor-crag focused, not gym/bouldering-session oriented |
| Vertical-Life | Polished guidebook + logging | Europe-centric, not present in Taiwan |
| Sendage | Clean send-logging UX, "Send Grid" viz | No route database/beta-sharing depth |
| MyClimb | Popular for indoor gym social use | No major Taiwan presence found |
| 記石 (Ji Shi) | Only real Taiwan-native app found | Log-only — no beta video, no route database, no social layer |

**Your wedge:** be the first app that's actually built around Taiwan's indoor bouldering scene — local gyms, local grading habits, local community — combining the logging + beta-video + social loop that Kaya proved works, without waiting on official gym buy-in to get started.
