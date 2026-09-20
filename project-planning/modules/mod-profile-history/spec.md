# MOD-008: Profile History & Stats — Spec

**Module ID**: MOD-008
**Module Name**: Profile History & Stats
**Phase**: 1
**Dependencies**: MOD-001, MOD-004

---

## Purpose

Render the current user's (and other users', per privacy) send history with gym/grade/date filters and basic stats (sends by grade bar chart, total sends, current streak, highest grade).

---

## Context

Climbers tracking progress want to see their full send history and basic stats without leaving the app. The history is filterable by gym, grade, and date range. Basic stats include: total sends, sends by grade (bar chart), current streak (consecutive days with ≥1 send), and highest grade climbed. Stats must recalculate immediately after a new send log is saved, without requiring a manual refresh. The profile history is also visible to other users, subject to the profile owner's `privacy_setting` (MOD-001): if set to `followers_only`, only followers can view the history; non-followers see a hidden/empty state. Grade is always read from `Route.grade` at display time — `Ascent` rows do not store a grade column.

**Non-goals for this module:**
- Ascent pyramid visualization (Phase 2).
- Writing send logs (owned by MOD-004).
- Editing or deleting send logs in Phase 1.
- Competition and league scoring (out of scope entirely).
- Training plans and workout logging (out of scope entirely).

---

## User Stories Covered

- **US-011**: View my profile history and stats

---

## Acceptance Criteria Covered

**AC-060**: The system shall render the current user's full send history filterable by gym, grade, and date range.

**AC-061**: The system shall render basic stats: total sends, sends by grade (bar chart), current streak (consecutive days with ≥1 send), and highest grade climbed.

**AC-062**: The system shall recalculate stats immediately after a new send log is saved and re-render the stats view without requiring a manual refresh.

---

## Data Model (relevant tables)

```
Ascent (a "log")
 - id, user_id (FK User), route_id (FK Route),
   style (flash | top | attempt | project), attempts,
   note, logged_at, is_private
   -- grade is NOT stored per-log; always read from route.grade at display time

User
 - id, display_name, avatar_url, home_gym_id, bio,
   privacy_setting (public | followers_only), created_at

Route
 - id, gym_id (FK Gym), grade (V-scale enum), color_tag, ...
```

`Ascent` rows are read by `user_id`. Grade is joined from `Route.grade` — not stored in `Ascent`. RLS: the current user can read their own `Ascent` rows. For other users' history, `privacy_setting = followers_only` hides the history from non-followers.

---

## Input / Output Contract

**Inputs (history view):**
- `user_id` (profile being viewed — may be self or another user)
- Optional filters: `gym_id`, `grade`, `date_from`, `date_to`
- Authenticated session (for privacy check)

**Outputs (history view):**
- List of `Ascent` rows for the target user (filtered as requested), with `grade` joined from `Route.grade` and gym info joined from `Route.gym_id → Gym`
- If target user has `privacy_setting = followers_only` and current user is not a follower: return hidden/empty state

**Inputs (stats view):**
- `user_id` (same privacy rules apply)

**Outputs (stats view):**
- Total send count
- Sends-by-grade bar chart data (count per V-grade)
- Current streak: consecutive calendar days ending today with ≥1 send
- Highest grade climbed (max V-grade across all `Ascent` rows joined to `Route.grade`)
- Stats recalculate immediately when a new `Ascent` row is saved (AC-062)

---

## Key Implementation Notes

- **Grade must be joined from Route**: `Ascent` has no `grade` column. All grade display and grade-based filtering must join through `route_id → Route.grade`. Engineers must not add a `grade` column to `Ascent`.
- **Stats recalculation (AC-062)**: After a new send log is saved (MOD-004 INSERT into `Ascent`), the stats view must recalculate and re-render without requiring the user to manually refresh. This can be achieved via a refetch after mutation, an optimistic update, or a reactive query on the `Ascent` table — the implementation approach is up to the Engineer, but the user must not have to pull-to-refresh.
- **Privacy enforcement**: When viewing another user's profile history, check their `privacy_setting`. If `followers_only` and the current user is not following them, show a hidden/empty state. This check is in addition to RLS policies.
- **Streak definition**: Current streak = the number of consecutive calendar days ending with today on which the user has logged ≥1 send. A day with no sends breaks the streak.
- **Highest grade**: The max V-grade across all `Ascent` rows for the user, joined to `Route.grade`. V-grade ordering follows the standard V-scale (VB < V0 < V1 < ... < V17).
- **Filter combinations**: All three filters (gym, grade, date range) must work independently and in combination.

---

## Out of Scope for This Module

- Ascent pyramid visualization (Phase 2).
- Writing, editing, or deleting send logs (send log creation owned by MOD-004; editing/deleting not in Phase 1 scope).
- Competition and league scoring (out of scope entirely).
- Training plans and workout logging (out of scope entirely).
- Beta video history (beta video listings on a profile are rendered per the uploader's privacy setting but the video playback component belongs to MOD-005).
