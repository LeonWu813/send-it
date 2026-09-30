# MOD-006: Social Graph & Feed — Spec

**Module ID**: MOD-006
**Module Name**: Social Graph & Feed
**Phase**: 1
**Dependencies**: MOD-001, MOD-004, MOD-005, MOD-008
**Last Synced from PRD Revision**: 18
**Last Updated**: 2026-09-30

---

## Purpose

Handle follow/unfollow, the chronological activity feed of sends and beta videos from followed users, beta-video like reactions, and the Followers and Following list screens (AC-146, AC-147).

---

## Context

Climbers connected to the local Taiwan scene want to follow friends and strong local climbers and see their sends and beta videos in a single chronological feed. The activity feed composes three intersecting filters: (1) only activity from users the current user follows (`Follow`), (2) excluding any users in a symmetric block relationship (`Block` — see MOD-009), and (3) respecting the `followers_only` privacy setting from MOD-001. This composition is too complex and too expensive to implement purely in RLS row-by-row filtering at scale. **The activity feed must be served by a `SECURITY INVOKER` Postgres RPC** that explicitly composes Follow ∩ (¬Block, symmetric) ∩ privacy — this is a hard requirement, not a recommendation. RLS remains the security fence; the RPC performs the composition. Raw client-side table `SELECT` is not permitted for the feed query. In addition to the feed, this module owns the like reaction on beta videos (one like per user per video, idempotent) and the follow/unfollow actions.

For US-022, this module also owns the Followers list screen (AC-146) and Following list screen (AC-147): scrollable lists of users who follow or are followed by the viewed profile, each entry showing a user card (circular avatar, `display_name`, total sends count, highest grade). Tapping a card navigates to that user's MOD-008 other-user profile surface (AC-064). Per-card sends count and highest grade are sourced from MOD-008's profile-stats public service (`fetchProfileStats(userId)` — the `get_profile_stats` RPC wrapper), fetched per-card on list render. Blocked users are excluded (AC-082, AC-084).

**Non-goals for this module:**
- Comments on sends or beta videos (out of scope for Phase 1).
- Likes on plain send logs (out of scope for Phase 1 — AC-053 prohibits this).
- Feed ranking or algorithmic sorting (Phase 1 is chronological only).
- Notifications for likes (owned by MOD-007).
- Block/unblock user actions (owned by MOD-009; this module consumes the Block table for feed filtering).

---

## Related User Stories

- **US-007**: Follow other climbers and see their activity
- **US-008**: Like a beta video
- **US-022**: See who follows me and who I follow

**US-007 Acceptance Criteria**: AC-050, AC-051

**US-008 Acceptance Criteria**: AC-052, AC-053

**US-022 Acceptance Criteria**: AC-145, AC-146, AC-147, AC-148

---

## Acceptance Criteria Covered

**AC-050**: The system shall allow a user to follow and unfollow any other user (subject to Block; see AC-083) and reflect the change immediately in the follower's profile counts.

**AC-051**: The system shall include the followed user's subsequent sends and beta videos in the follower's activity feed within one refresh cycle of the follower opening or pull-refreshing the feed.

**AC-052**: The system shall allow a user to like exactly one time per beta video (idempotent) and immediately reflect the like count change on the video.

**AC-053**: The system shall not render a comment UI anywhere in the app in Phase 1 and shall not expose a like affordance on plain send logs.

> **Implementation note (MOD-006 feed query)**: The activity feed must be served by a `SECURITY INVOKER` Postgres RPC that explicitly composes Follow ∩ (¬Block, symmetric) ∩ privacy (followers-only visibility), not by a raw client-side table `SELECT`. RLS remains the security fence; the RPC performs the composition. This is a requirement, not an option, for MOD-006.

**AC-146** (new): The system shall provide a Followers list screen listing all users who follow the profile being viewed. Each list entry is a user card showing the user's circular avatar, `display_name`, total sends count (ascents where `style` ∈ {flash, top}), and highest grade achieved. Tapping a card navigates to that user's MOD-008 other-user profile surface (AC-064), subject to that user's privacy setting (AC-063). Blocked users are excluded (AC-082, AC-084).

**AC-147** (new): The system shall provide a Following list screen with the same card layout as the Followers list screen (AC-146), listing all users the profile owner follows. Tapping a card navigates to that user's MOD-008 other-user profile surface (AC-064), subject to privacy (AC-063). Blocked users are excluded.

**AC-148** (new): Per-card sends count and highest grade on the Followers and Following list screens (AC-146, AC-147) shall be sourced from MOD-008's profile-stats public service (`get_profile_stats` RPC), not from a direct `ascents` table query in MOD-006. Fetching is per-card on list render (acceptable for Phase 1 list sizes).

---

## Integration Points

**Coordinated change with MOD-005 (Rev 16)**: The `get_activity_feed` RPC's `video_items` CTE must add a `WHERE` clause to exclude reported-and-not-dismissed beta videos from the feed (AC-141). This change ships in a MOD-006 migration ordered after the MOD-005 migration that adds the `is_reported` and `report_dismissed` columns.

**MOD-008 profile-stats dependency (AC-148)**: Per-card sends count and highest grade on the Followers and Following list screens are sourced from MOD-008's `fetchProfileStats(userId)` public service wrapper (`get_profile_stats` RPC). MOD-006 imports `fetchProfileStats` directly from `mod-profile-history/history-service.ts` (cross-module import — see Key Implementation Notes).

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
- Scrollable list of user cards; each card: circular avatar, `display_name`, total sends count, highest grade — sourced per-card from `fetchProfileStats(userId)` (MOD-008)
- Tapping a card navigates to that user's MOD-008 other-user profile surface (AC-064)
- Blocked users excluded (AC-082, AC-084)

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

### Followers and Following List Screens — Tech Lead Decisions (Rev 18)

The following decisions were recorded by Tech Lead in the 2026-09-30 review for Rev 18 and are pinned here.

#### Per-card stats fetching (AC-148) — Tech Lead Q2

Per-card sends count and highest grade on the Followers and Following list screens (AC-146, AC-147) are sourced per-card via `get_profile_stats(p_user_id)` calls (option a). A bespoke batch RPC (option b) and client-side join over `ascents` (option c) are both rejected. Call `fetchProfileStats(userId)` lazily per visible card. The RPC is `SECURITY INVOKER STABLE` with a built-in privacy gate, so a `followers_only` non-follower correctly receives zeroed stats with no consumer-side privacy logic. Deriving `total_sends` or `highest_grade` client-side is prohibited — it risks disagreeing with the canonical `get_profile_stats` definition. A batch `get_profile_stats_batch(user_ids[])` is a Phase 2 optimization to revisit only if real list sizes exceed ~200; do not build it for Phase 1.

#### Cross-module import from MOD-008 (AC-148) — Tech Lead Q3

MOD-006 → MOD-008 dependency is safe. Express as a direct import: `import { fetchProfileStats } from '../mod-profile-history/history-service'`. This is a cross-module import of a **public service** (not an internal screen) and is permitted per the Cross-Module Imports convention in `production.md`. Document this cross-module import here and in the Integration Points section. MOD-006 must not import internal screen components from MOD-008; only `fetchProfileStats` (and other public service exports) from `history-service.ts` are permitted.

---

## Out of Scope for This Module

- Comments on sends or beta videos (out of scope for Phase 1).
- Likes on plain send logs (AC-053 prohibits this in Phase 1).
- Algorithmic or ranked feed sorting (Phase 1 is chronological only).
- Push notifications for likes (owned by MOD-007).
- Block/unblock user action UI (owned by MOD-009; this module consumes Block data for feed filtering).
- New follower notifications (out of scope for Phase 1 push types).
- Batch profile-stats RPC (Phase 2 optimization — do not build for Phase 1 list sizes).
