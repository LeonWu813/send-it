# MOD-006: Social Graph & Feed — Spec

**Module ID**: MOD-006
**Module Name**: Social Graph & Feed
**Phase**: 1
**Dependencies**: MOD-001, MOD-004, MOD-005, MOD-008, MOD-009 (block/unblock actions and block-status service for the UserProfileScreen three-dots sheet + blocked state, AC-150/AC-152/AC-153)
**Last Synced from PRD Revision**: 20
**Last Updated**: 2026-09-30

---

## Purpose

Handle follow/unfollow, the chronological activity feed of sends and beta videos from followed users, beta-video like reactions, the Followers and Following list screens (AC-146, AC-147), and the other-user `UserProfileScreen` overlay — including its three-dots action sheet (Report / Block / Unblock, AC-150) and its blocked-state "This profile isn't available" rendering (AC-153). The report and block actions themselves are performed via MOD-009's public services.

---

## Context

Climbers connected to the local Taiwan scene want to follow friends and strong local climbers and see their sends and beta videos in a single chronological feed. The activity feed composes three intersecting filters: (1) only activity from users the current user follows (`Follow`), (2) excluding any users in a symmetric block relationship (`Block` — see MOD-009), and (3) respecting the `followers_only` privacy setting from MOD-001. This composition is too complex and too expensive to implement purely in RLS row-by-row filtering at scale. **The activity feed must be served by a `SECURITY INVOKER` Postgres RPC** that explicitly composes Follow ∩ (¬Block, symmetric) ∩ privacy — this is a hard requirement, not a recommendation. RLS remains the security fence; the RPC performs the composition. Raw client-side table `SELECT` is not permitted for the feed query. In addition to the feed, this module owns the like reaction on beta videos (one like per user per video, idempotent) and the follow/unfollow actions.

For US-022, this module also owns the Followers list screen (AC-146) and Following list screen (AC-147): scrollable lists of users who follow or are followed by the viewed profile, each entry showing a user card with the user's circular avatar and `display_name` only. Tapping a card navigates to that user's MOD-008 other-user profile surface (AC-064). Blocked users are excluded (AC-082, AC-084). Per-card sends count and highest grade are not displayed on the list cards; aggregate profile stats are surfaced on the other-user profile screen instead (AC-149).

For US-020, the other-user profile screen (`UserProfileScreen`, reached via `handleSelectClimber`) owned by this module now includes a three-dots icon (⋮) fixed in the top-right corner (AC-150) that opens a bottom action sheet with exactly two options: "Report" (AC-151) and a block toggle "Block"/"Unblock" (AC-152). The `isBlocked`/`fetchBlockedUserIds` check from MOD-009 is performed on `UserProfileScreen` load (AC-153): if a block exists in either direction, the screen shows "This profile isn't available", hides the follow/unfollow button and stats section (AC-149), but keeps the ⋮ icon visible so the viewer can unblock.

**Non-goals for this module:**
- Comments on sends or beta videos (out of scope for Phase 1).
- Likes on plain send logs (out of scope for Phase 1 — AC-053 prohibits this).
- Feed ranking or algorithmic sorting (Phase 1 is chronological only).
- Notifications for likes (owned by MOD-007).
- Block/unblock user action implementation (owned by MOD-009; this module calls MOD-009's `blockUser`/`unblockUser` services and consumes the Block table for feed filtering).

---

## Related User Stories

- **US-007**: Follow other climbers and see their activity
- **US-008**: Like a beta video
- **US-020**: See my saved gyms and followed climbers on a Home screen
- **US-022**: See who follows me and who I follow

**US-007 Acceptance Criteria**: AC-050, AC-051

**US-008 Acceptance Criteria**: AC-052, AC-053

**US-020 Acceptance Criteria**: AC-110, AC-111, AC-112, AC-113, AC-114, AC-115, AC-123, AC-124, AC-150, AC-153

**US-022 Acceptance Criteria**: AC-145, AC-146, AC-147, AC-148, AC-149

---

## Acceptance Criteria Covered

**AC-050**: The system shall allow a user to follow and unfollow any other user (subject to Block; see AC-083) and reflect the change immediately in the follower's profile counts.

**AC-051**: The system shall include the followed user's subsequent sends and beta videos in the follower's activity feed within one refresh cycle of the follower opening or pull-refreshing the feed.

**AC-052**: The system shall allow a user to like exactly one time per beta video (idempotent) and immediately reflect the like count change on the video.

**AC-053**: The system shall not render a comment UI anywhere in the app in Phase 1 and shall not expose a like affordance on plain send logs.

> **Implementation note (MOD-006 feed query)**: The activity feed must be served by a `SECURITY INVOKER` Postgres RPC that explicitly composes Follow ∩ (¬Block, symmetric) ∩ privacy (followers-only visibility), not by a raw client-side table `SELECT`. RLS remains the security fence; the RPC performs the composition. This is a requirement, not an option, for MOD-006.

**AC-146** (revised): The system shall provide a Followers list screen listing all users who follow the profile being viewed. Each list entry is a user card showing the user's circular avatar and `display_name` only — no per-card sends count or highest grade is displayed. Tapping a card navigates to that user's MOD-008 other-user profile surface (AC-064), subject to that user's privacy setting (AC-063). Blocked users are excluded (AC-082, AC-084).

**AC-147** (revised): The system shall provide a Following list screen with the same card layout as the Followers list screen (AC-146) — circular avatar and `display_name` only, no per-card sends count or highest grade — listing all users the profile owner follows. Tapping a card navigates to that user's MOD-008 other-user profile surface (AC-064), subject to privacy (AC-063). Blocked users are excluded.

**AC-148** (revised): The Followers and Following list cards (AC-146, AC-147) shall display the user's avatar and `display_name` only. Per-card sends count and highest grade are removed from the cards, and no per-card profile-stats fetch (`fetchProfileStats` / the `get_profile_stats` RPC) is made on list render. Aggregate profile stats are surfaced on the other-user profile screen instead (AC-149), not on the list cards.

**AC-149** (new): The other-user profile screen (`UserProfileScreen`, the profile overlay reached via `handleSelectClimber`) shall display, immediately after the follow/unfollow button, a stats section sourced from MOD-008's profile-stats public service (`fetchProfileStats(targetUserId)` from `mod-profile-history/history-service`). The section shall show the target user's total sends, accumulated days, highest grade, and a grade bar chart. This section shall not render any route cards. This is subject to the target user's privacy setting (AC-063): a `followers_only` profile requested by a non-follower shows the hidden/403 state per AC-064 rather than the stats section.

**AC-150** (new): The other-user profile screen (`UserProfileScreen`, the profile overlay reached via `handleSelectClimber`) shall display a three-dots icon (⋮) fixed in the top-right corner. Tapping it shall open a bottom action sheet rendered over a translucent background overlay that blocks interaction with the underlying screen until the sheet is dismissed. The sheet shall contain exactly two options: "Report" (AC-151) and a block toggle labeled "Block" when the viewer has not blocked this user or "Unblock" when the viewer has already blocked this user (AC-152). This three-dots sheet replaces any prior placement of the report and block controls on the other-user profile surface. The three-dots icon is shown even when the profile is in the blocked state (AC-153), so the viewer can unblock.

**AC-152** (new): Selecting the block toggle in the three-dots sheet (AC-150) shall, when labeled "Block", call `blockUser` (MOD-009) to block the target user only, with no admin report; when labeled "Unblock", it shall call `unblockUser` (MOD-009) to remove the block. Block behavior is symmetric per the existing `Block` database trigger: on block, any follow relationship is removed in both directions, and neither party can follow the other while the block is in effect; on unblock, the block is lifted (follows are not automatically restored). After the action completes, the profile shall immediately reflect the new state (blocked → AC-153 unavailable state; unblocked → normal profile content) and the sheet toggle label shall update accordingly.

**AC-153** (new): When `UserProfileScreen` (AC-150) loads, it shall check whether either party has blocked the other using MOD-009's public service (`isBlocked` / `fetchBlockedUserIds`). If a block exists in either direction, the screen shall display a "This profile isn't available" message in place of the profile content: the follow/unfollow button and the stats section (AC-149) shall be hidden. The three-dots icon (AC-150) shall still be shown so the viewer can unblock the user (AC-152).

---

## Integration Points

**Coordinated change with MOD-005 (Rev 16)**: The `get_activity_feed` RPC's `video_items` CTE must add a `WHERE` clause to exclude reported-and-not-dismissed beta videos from the feed (AC-141). This change ships in a MOD-006 migration ordered after the MOD-005 migration that adds the `is_reported` and `report_dismissed` columns.

**MOD-008 profile-stats dependency (AC-149)**: The other-user profile screen (`UserProfileScreen`) sources its stats section from MOD-008's `fetchProfileStats(targetUserId)` public service wrapper (`get_profile_stats` RPC). MOD-006 imports `fetchProfileStats` directly from `mod-profile-history/history-service.ts` (cross-module import — see Key Implementation Notes). No per-card stats fetch occurs on the Followers or Following list render.

**MOD-009 block-status and action dependency (AC-150/AC-152/AC-153)**: The `UserProfileScreen` consumes MOD-009's public services: `isBlocked`/`fetchBlockedUserIds` for the block-status check on load (AC-153), `blockUser` for the block action (AC-152), and `unblockUser` for the unblock action (AC-152). MOD-006 calls these services via MOD-009's public service layer; it does not read the `Block` table directly for the three-dots sheet logic.

---

## Data Model (relevant tables)

```
Follow
 - follower_id (FK User), followee_id (FK User), created_at
 - PK: (follower_id, followee_id)

Reaction  (Phase 1: beta videos only)
 - id, user_id (FK User),
   target_type (beta_video),
   target_id, created_at
 - Unique: (user_id, target_type, target_id) — enforces idempotent single like
```

Feed query reads from `Ascent` (MOD-004), `BetaVideo` (MOD-005), `Follow`, `Block` (MOD-009), and `User.privacy_setting` (MOD-001). All tables guarded by RLS; the feed RPC adds the composition layer on top.

---

## Input / Output Contract

**Inputs (follow/unfollow):**
- `followee_id` (target user), authenticated session
- Subject to Block check: if a block relationship exists (in either direction) between the follower and followee, follow must be prevented (AC-083)

**Outputs (follow/unfollow):**
- `Follow` row inserted or deleted
- Follower and followee profile follow/follower counts updated immediately

**Inputs (feed query):**
- Authenticated user session (determines `follower_id`)
- Pagination cursor / offset
- The `SECURITY INVOKER` Postgres RPC composes: followees ∩ (not blocked by current user, not blocking current user) ∩ (public profiles OR followers_only profiles where current user is a follower) ∩ (beta videos not hidden by report filter)

**Outputs (feed query):**
- Chronological list of `Ascent` and `BetaVideo` rows from qualifying followed users
- Each item includes enough data to render: route info, grade (read from Route.grade), send style/attempts or video thumbnail/url, user display name + avatar
- Beta videos with `is_reported = true AND report_dismissed = false` are excluded (AC-141)

**Inputs (like / unlike):**
- `target_type = beta_video`, `target_id`, authenticated session

**Outputs (like):**
- `Reaction` row inserted (idempotent — unique constraint `(user_id, target_type, target_id)` prevents duplicates)
- Like count on the `BetaVideo` immediately reflected in UI
- `Reaction` INSERT triggers the MOD-007 notification Edge Function via Postgres trigger

**Inputs (Followers/Following list screens):**
- `userId` (the profile being viewed), authenticated session

**Outputs (Followers/Following list screens):**
- Scrollable list of user cards; each card: circular avatar and `display_name` only — no sends count or highest grade on cards
- Tapping a card navigates to that user's MOD-008 other-user profile surface (AC-064)
- Blocked users excluded (AC-082, AC-084)

**Inputs (other-user profile screen — AC-149 stats section):**
- `targetUserId`, authenticated session

**Outputs (other-user profile screen — AC-149 stats section):**
- Stats section immediately after the follow/unfollow button, sourced from `fetchProfileStats(targetUserId)` (MOD-008): total sends, accumulated days, highest grade, grade bar chart
- No route cards rendered in the stats section
- Subject to privacy (AC-063): `followers_only` profile for a non-follower shows the hidden/403 state per AC-064 rather than the stats section

**Inputs (other-user profile screen — AC-150/AC-152/AC-153 three-dots sheet + blocked state):**
- `targetUserId`, authenticated session

**Outputs (other-user profile screen — three-dots sheet + blocked state):**
- Three-dots icon (⋮) always visible in the top-right corner, including in the blocked state
- On ⋮ tap: bottom action sheet over translucent overlay, with "Report" (AC-151) and "Block"/"Unblock" toggle (AC-152)
- On screen load: `isBlocked`/`fetchBlockedUserIds` check (MOD-009); if blocked in either direction, show "This profile isn't available", hide follow button and stats section, keep ⋮ icon visible
- Block action calls `blockUser` (MOD-009); unblock calls `unblockUser` (MOD-009); profile reflects new state immediately

---

## Key Implementation Notes

- **Feed RPC is a hard requirement**: The activity feed must be implemented as a `SECURITY INVOKER` Postgres RPC that composes Follow ∩ (¬Block, symmetric) ∩ privacy. A raw `SELECT` from the client on the `Ascent` or `BetaVideo` table with a WHERE clause is not permitted for the feed. RLS is the security fence; the RPC is the composition layer. This is required because implementing the full intersection purely in RLS is expensive at scale and hard to maintain.
- **Report exclusion filter in feed RPC (AC-141 — Rev 16 coordinated change)**: The `get_activity_feed` RPC's `video_items` CTE must add `WHERE (bv.is_reported = FALSE OR bv.report_dismissed = TRUE)` to exclude reported-and-not-dismissed beta videos. This change ships in a MOD-006 migration (`20260928000002_mod_006_feed_exclude_reported.sql`) ordered after `20260928000001_mod_005_video_reports.sql` (the MOD-005 migration that adds the `is_reported` and `report_dismissed` columns). The `ascent_items` CTE needs no change — ascents are not reportable in Phase 1. The exact predicate is the canonical beta-video exclusion filter; use `WHERE (bv.is_reported = FALSE OR bv.report_dismissed = TRUE)` — never a bare `is_reported = false`, which would permanently hide admin-dismissed videos and violate AC-143.
- **Symmetric block in feed**: The feed must exclude activity from users who have blocked the current user AND users the current user has blocked (both directions). The `Block` table is owned by MOD-009; MOD-006 reads it as a dependency.
- **Privacy filter in feed**: Activity from users with `privacy_setting = followers_only` only appears in the feed of their followers. This check must be part of the RPC composition, not an application-layer filter after fetching.
- **Like idempotency**: The `Reaction` unique constraint `(user_id, target_type, target_id)` enforces that each user can like each beta video at most once. The database constraint is the source of truth — do not rely on client-side checks alone.
- **No comment UI (AC-053)**: The app must not render any comment input, comment list, or comment count anywhere in Phase 1. No like affordance on plain send logs (Ascent rows) — likes are only on `BetaVideo`.
- **Follow count immediacy (AC-050)**: Follower and followee profile follow/follower counts must update immediately in the UI on follow/unfollow (optimistic UI or re-fetch on mutation is acceptable).
- **Feed refresh (AC-051)**: New sends and beta videos from followed users appear in the feed within one refresh cycle (the user opens or pull-refreshes the feed). No real-time push to the feed is required in Phase 1.
- **Inline video playback in feed (AC-034, owned by MOD-005)**: MOD-006 renders the feed; MOD-005 provides the inline playback component. The feed must support inline video playback for beta videos without leaving the app.
- **Three-dots sheet is a `Modal` with translucent background overlay (AC-150)**: The bottom action sheet opened by the ⋮ icon is implemented as an RN `<Modal>` with a translucent, interaction-blocking background overlay. The sheet contains exactly two options: "Report" and the block toggle ("Block"/"Unblock"). The sheet must block interaction with the underlying screen until dismissed.
- **`isBlocked` check runs as part of initial `loadProfile` Promise.all (AC-153)**: On `UserProfileScreen` load, the block-status check (`isBlocked`/`fetchBlockedUserIds` from MOD-009) is performed in parallel with any other profile-load fetches (e.g. follow status, profile data) as part of a `Promise.all`. If a block is detected in either direction, the screen renders "This profile isn't available", hides the follow button and stats section (AC-149), and keeps the ⋮ icon visible. The three-dots icon must remain mounted and functional in the blocked state so the viewer can unblock via AC-152.
- **MOD-009 public-service calls for block actions (AC-152)**: The block toggle in the ⋮ sheet calls MOD-009's `blockUser` (when "Block" is selected) or `unblockUser` (when "Unblock" is selected) sequentially in the UI handler. MOD-006 does not write to the `Block` table directly; it delegates to MOD-009's public service layer. After the call completes, the profile reflects the new state immediately (blocked → AC-153 unavailable state; unblocked → normal content).

### Followers and Following List Screens — Tech Lead Decisions (Rev 18)

The following decisions were recorded by Tech Lead in the 2026-09-30 review for Rev 18 and are pinned here.

#### Per-card stats fetching (AC-148) — Tech Lead Q2

Per-card sends count and highest grade are no longer shown on the Followers and Following list cards (AC-146, AC-147) as of Rev 19. The prior per-card `get_profile_stats(p_user_id)` call pattern (option a, approved in Rev 18) no longer applies to list render — **no per-card `fetchProfileStats` call is made on list render**. Aggregate profile stats are instead surfaced on the other-user profile screen (AC-149). The Tech Lead Q2 reasoning (rejecting batch RPC option b and client-side join option c) remains relevant for the AC-149 stats section: `fetchProfileStats(targetUserId)` is called once on the other-user profile screen, not per-card on the list.

#### AC-149 — Stats section on other-user profile screen

The other-user profile screen (`UserProfileScreen`, reached via `handleSelectClimber`) displays a stats section immediately after the follow/unfollow button, sourced from `fetchProfileStats(targetUserId)` from `mod-profile-history/history-service.ts`. The section shows total sends, accumulated days, highest grade, and a grade bar chart. No route cards are rendered. This is subject to AC-063/AC-064 privacy gating. MOD-006 imports `fetchProfileStats` directly from `mod-profile-history/history-service.ts`; this is a cross-module import of a public service (not an internal screen) and is permitted per the Cross-Module Imports convention in `production.md`.

#### Cross-module import from MOD-008 (AC-149) — Tech Lead Q3

MOD-006 → MOD-008 dependency is safe. Express as a direct import: `import { fetchProfileStats } from '../mod-profile-history/history-service'`. This is a cross-module import of a **public service** (not an internal screen component) and is permitted per the Cross-Module Imports convention in `production.md`. Document this cross-module import here and in the Integration Points section. MOD-006 must not import internal screen components from MOD-008; only `fetchProfileStats` (and other public service exports) from `history-service.ts` are permitted.

---

## Out of Scope for This Module

- Comments on sends or beta videos (out of scope for Phase 1).
- Likes on plain send logs (AC-053 prohibits this in Phase 1).
- Algorithmic or ranked feed sorting (Phase 1 is chronological only).
- Push notifications for likes (owned by MOD-007).
- Block/unblock user action implementation (owned by MOD-009; this module calls MOD-009's services and consumes Block data for feed filtering).
- New follower notifications (out of scope for Phase 1 push types).
- Batch profile-stats RPC (Phase 2 optimization — do not build for Phase 1 list sizes).
- Per-card sends count or highest grade on Followers/Following list cards (removed in Rev 19; stats surfaced on the other-user profile screen via AC-149 instead).
