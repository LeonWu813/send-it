# MOD-004: Send Logging — Spec

**Module ID**: MOD-004
**Module Name**: Send Logging
**Phase**: 1
**Dependencies**: MOD-001, MOD-003

---

## Purpose

Handle send log creation from a route page or global "+" entry point, enforcing that grade is inherited from the route (no per-user override).

---

## Context

The core climber loop — "log a send without interrupting my climbing rhythm" — requires that logging be fast: ≤30 seconds and ≤4 taps from a known route page (US-002). The grade of a send is never stored per-log; it is always read from `Route.grade` at display time. This is a deliberate data-model decision that keeps the `Ascent` table clean and ensures grade updates to a route propagate automatically to all historical logs. Phase 1 does not support offline send queueing; if the network request fails, the user sees a clear error message. Logging from a known route page is the primary flow; a global "+" entry point is also required.

**Non-goals for this module:**
- Offline send queue (Phase 2 — Phase 1 shows a clear error on failure).
- Likes on plain send logs (out of scope for Phase 1 — like affordance is only on beta videos).
- Comments on sends (out of scope for Phase 1).
- Per-user grade overrides (Phase 1 forces grade from Route.grade).

---

## User Stories Covered

- **US-002**: Log a send quickly

---

## Acceptance Criteria Covered

**AC-010**: The system shall allow a user to log a send from an existing route detail page in ≤4 taps (route → log → style → confirm).

**AC-011**: The system shall save the log with `grade` derived from `Route.grade` at display time; no per-log grade value is stored.

**AC-012**: The system shall, when the network request to save a send fails, display a clear error message to the user (Phase 1 does not queue sends offline).

**AC-013**: After a send is successfully logged, the ascent list on the route detail screen refreshes immediately to show the new entry without requiring re-navigation.

---

## Data Model (relevant tables)

```
Ascent (a "log")
 - id, user_id (FK User), route_id (FK Route),
   style (flash | top | attempt | project), attempts,
   note, logged_at, is_private
   -- grade is NOT stored per-log; always read from route.grade at display time
```

All tables guarded by Supabase Row-Level Security policies. `Ascent` rows are writable by the owning user (insert own logs) and readable per privacy rules (own logs always; other users' logs subject to the route owner's privacy setting propagated from MOD-001 `privacy_setting`). The data flow on insert: client → Supabase Auth (session) → Postgres insert into `Ascent` (RLS-checked) → PostHog event (MOD-011).

---

## Input / Output Contract

**Inputs:**
- `route_id` (FK from MOD-003), `style` (flash | top | attempt | project), `attempts` (integer), `note` (optional text), `is_private` (bool)
- Authenticated user session (MOD-001)
- `logged_at` (timestamp — client-supplied or server `now()`)

**Outputs:**
- `Ascent` row inserted in Postgres
- Success confirmation shown to user
- On network failure: clear error message displayed to user (no silent failure, no offline queue)
- PostHog event emitted (first send, via MOD-011)

---

## Key Implementation Notes

- Grade is **not stored** in the `Ascent` row. The `Ascent` schema has no `grade` column. Grade is always read from `Route.grade` at display time. Engineers must not add a `grade` column to `Ascent` even for convenience.
- The send log flow from a route detail page must complete in ≤4 taps: route page → log tap → style selection → confirm (AC-010).
- A global "+" entry point is also required (implied by PRD §6 MOD-004 purpose statement: "from a route page or global '+' entry point").
- On any network failure saving the send, display a clear error message. Do not silently fail. Do not queue the send for later retry (Phase 2 adds the offline queue). The user can retry manually.
- `is_private` field allows users to mark individual sends as private.
- `style` enum: `flash | top | attempt | project`.
- RLS: a user may only insert Ascent rows with their own `user_id`. Reading other users' ascents is controlled by the profile privacy setting (MOD-001 `privacy_setting = followers_only` hides logs from non-followers).

---

## Out of Scope for This Module

- Offline send queue (Phase 2 only).
- Likes on plain send logs (out of scope for Phase 1; like affordance is only on beta videos per AC-053).
- Comments on sends (out of scope for Phase 1).
- Per-user grade overrides (grade always comes from `Route.grade`).
- Send history and stats display (owned by MOD-008).
- Feed rendering of sends (owned by MOD-006).
