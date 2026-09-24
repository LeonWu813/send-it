# MOD-006: Social Graph & Feed — Spec

**Module ID**: MOD-006
**Module Name**: Social Graph & Feed
**Phase**: 1
**Dependencies**: MOD-001, MOD-004, MOD-005

---

## Purpose

Handle follow/unfollow, the chronological activity feed of sends and beta videos from followed users, and beta-video like reactions.

---

## Context

Climbers connected to the local Taiwan scene want to follow friends and strong local climbers and see their sends and beta videos in a single chronological feed. The activity feed composes three intersecting filters: (1) only activity from users the current user follows (`Follow`), (2) excluding any users in a symmetric block relationship (`Block` — see MOD-009), and (3) respecting the `followers_only` privacy setting from MOD-001. This composition is too complex and too expensive to implement purely in RLS row-by-row filtering at scale. **The activity feed must be served by a `SECURITY INVOKER` Postgres RPC** that explicitly composes Follow ∩ (¬Block, symmetric) ∩ privacy — this is a hard requirement, not a recommendation. RLS remains the security fence; the RPC performs the composition. Raw client-side table `SELECT` is not permitted for the feed query. In addition to the feed, this module owns the like reaction on beta videos (one like per user per video, idempotent) and the follow/unfollow actions.

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

---

## Acceptance Criteria Covered

**AC-050**: The system shall allow a user to follow and unfollow any other user (subject to Block; see AC-083) and reflect the change immediately in the follower's profile counts.

**AC-051**: The system shall include the followed user's subsequent sends and beta videos in the follower's activity feed within one refresh cycle of the follower opening or pull-refreshing the feed.

**AC-052**: The system shall allow a user to like exactly one time per beta video (idempotent) and immediately reflect the like count change on the video.

**AC-053**: The system shall not render a comment UI anywhere in the app in Phase 1 and shall not expose a like affordance on plain send logs.

> **Implementation note (MOD-006 feed query)**: The activity feed must be served by a `SECURITY INVOKER` Postgres RPC that explicitly composes Follow ∩ (¬Block, symmetric) ∩ privacy (followers-only visibility), not by a raw client-side table `SELECT`. RLS remains the security fence; the RPC performs the composition. This is a requirement, not an option, for MOD-006.

---

## Integration Points

none

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
- The `SECURITY INVOKER` Postgres RPC composes: followees ∩ (not blocked by current user, not blocking current user) ∩ (public profiles OR followers_only profiles where current user is a follower)

**Outputs (feed query):**
- Chronological list of `Ascent` and `BetaVideo` rows from qualifying followed users
- Each item includes enough data to render: route info, grade (read from Route.grade), send style/attempts or video thumbnail/url, user display name + avatar

**Inputs (like / unlike):**
- `target_type = beta_video`, `target_id`, authenticated session

**Outputs (like):**
- `Reaction` row inserted (idempotent — unique constraint `(user_id, target_type, target_id)` prevents duplicates)
- Like count on the `BetaVideo` immediately reflected in UI
- `Reaction` INSERT triggers the MOD-007 notification Edge Function via Postgres trigger

---

## Key Implementation Notes

- **Feed RPC is a hard requirement**: The activity feed must be implemented as a `SECURITY INVOKER` Postgres RPC that composes Follow ∩ (¬Block, symmetric) ∩ privacy. A raw `SELECT` from the client on the `Ascent` or `BetaVideo` table with a WHERE clause is not permitted for the feed. RLS is the security fence; the RPC is the composition layer. This is required because implementing the full intersection purely in RLS is expensive at scale and hard to maintain.
- **Symmetric block in feed**: The feed must exclude activity from users who have blocked the current user AND users the current user has blocked (both directions). The `Block` table is owned by MOD-009; MOD-006 reads it as a dependency.
- **Privacy filter in feed**: Activity from users with `privacy_setting = followers_only` only appears in the feed of their followers. This check must be part of the RPC composition, not an application-layer filter after fetching.
- **Like idempotency**: The `Reaction` unique constraint `(user_id, target_type, target_id)` enforces that each user can like each beta video at most once. The database constraint is the source of truth — do not rely on client-side checks alone.
- **No comment UI (AC-053)**: The app must not render any comment input, comment list, or comment count anywhere in Phase 1. No like affordance on plain send logs (Ascent rows) — likes are only on `BetaVideo`.
- **Follow count immediacy (AC-050)**: Follower and followee profile follow/follower counts must update immediately in the UI on follow/unfollow (optimistic UI or re-fetch on mutation is acceptable).
- **Feed refresh (AC-051)**: New sends and beta videos from followed users appear in the feed within one refresh cycle (the user opens or pull-refreshes the feed). No real-time push to the feed is required in Phase 1.
- **Inline video playback in feed (AC-034, owned by MOD-005)**: MOD-006 renders the feed; MOD-005 provides the inline playback component. The feed must support inline video playback for beta videos without leaving the app.

---

## Out of Scope for This Module

- Comments on sends or beta videos (out of scope for Phase 1).
- Likes on plain send logs (AC-053 prohibits this in Phase 1).
- Algorithmic or ranked feed sorting (Phase 1 is chronological only).
- Push notifications for likes (owned by MOD-007).
- Block/unblock user action UI (owned by MOD-009; this module consumes Block data for feed filtering).
- New follower notifications (out of scope for Phase 1 push types).
