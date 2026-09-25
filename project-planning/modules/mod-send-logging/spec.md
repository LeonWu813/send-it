# MOD-004: Send Logging — Spec

**Module ID**: MOD-004
**Module Name**: Send Logging
**Phase**: 1
**Dependencies**: MOD-001, MOD-003
**Last Synced from PRD Revision**: 9

---

## Purpose

Handle send log creation from a route page or global "+" entry point, enforcing that grade is inherited from the route (no per-user override) and restricting the ascent style to the three-value set (flash, top, attempt). Expose `fetchUserAchievements(routeIds[])` as a public service function for consumption by MOD-003 screens.

---

## Context

The core climber loop — "log a send without interrupting my climbing rhythm" — requires that logging be fast: ≤30 seconds and ≤4 taps from a known route page (US-002). The grade of a send is never stored per-log; it is always read from `Route.grade` at display time. This is a deliberate data-model decision that keeps the `Ascent` table clean and ensures grade updates to a route propagate automatically to all historical logs. Phase 1 does not support offline send queueing; if the network request fails, the user sees a clear error message. Logging from a known route page is the primary flow; a global "+" entry point is also required.

The ascent style selector is restricted to exactly three values: {flash, top, attempt}. The `project` style is removed — it is not selectable in the UI and is not a valid value in the `ascent_style` database enum. Any historical ascent previously logged with `project` is treated as `attempt` (backfilled in the migration). A new migration removes `project` from the `ascent_style` DB enum using the PG15-safe pattern (create new type, backfill, swap, rename). The enum removal migration must run before any code change that removes `project` from the UI (migration first, then code).

MOD-004 owns the `fetchUserAchievements` public service function: given a list of route IDs, it returns the best ascent style achieved by the calling user on each route (scoped to `auth.uid()`), reducing multiple ascents per route to the best style with precedence `flash > top > attempt`. Routes with no ascent by the user are absent from the returned map. This function is consumed by MOD-003 screens (RouteListScreen and RouteDetailScreen) for achievement icon display.

**Non-goals for this module:**
- Offline send queue (Phase 2 — Phase 1 shows a clear error on failure).
- Likes on plain send logs (out of scope for Phase 1 — like affordance is only on beta videos).
- Comments on sends (out of scope for Phase 1).
- Per-user grade overrides (Phase 1 forces grade from Route.grade).
- The `project` ascent style (removed entirely from UI and DB enum in Phase 1).

---

## Related User Stories

- **US-002**: Log a send quickly

---

## Acceptance Criteria Covered

**AC-010**: The system shall allow a user to log a send from an existing route detail page in ≤4 taps (route → log → style → confirm).

**AC-011**: The system shall save the log with `grade` derived from `Route.grade` at display time; no per-log grade value is stored.

**AC-012**: The system shall, when the network request to save a send fails, display a clear error message to the user (Phase 1 does not queue sends offline).

**AC-013**: After a send is successfully logged, the ascent list on the route detail screen refreshes immediately to show the new entry without requiring re-navigation.

**AC-014** (new): The system shall restrict the ascent style selector to the fixed three-value enum {flash, top, attempt}. The `project` style is removed — it is not selectable in the UI and is not a valid value in the `ascent_style` database enum. Any historical ascent previously logged with `project` shall be treated as `attempt` (see migration note below).

---

## Integration Points

MOD-004 exposes `fetchUserAchievements(routeIds: string[]): Promise<Record<string, 'flash' | 'top' | 'attempt'>>` as a public service function in `send-service.ts`. This function is consumed by MOD-003 (RouteListScreen, RouteDetailScreen) for achievement icon display. MOD-003 imports only the public service function — not MOD-004 internal screens, components, or the `ascents` table. MOD-004 engineer implements this function; MOD-003 engineer confirms it is available before MOD-003 QA handoff.

---

## Data Model (relevant tables)

```
Ascent (a "log")
 - id, user_id (FK User), route_id (FK Route),
   style (ascent_style enum: flash | top | attempt), attempts,
   note, logged_at, is_private
   -- grade is NOT stored per-log; always read from route.grade at display time
   -- The 'project' ascent style is REMOVED. ascent_style has exactly three
   -- values (flash | top | attempt). Historical 'project' rows are backfilled
   -- to 'attempt' in the migration.
```

All tables guarded by Supabase Row-Level Security policies. `Ascent` rows are writable by the owning user (insert own logs) and readable per privacy rules (own logs always; other users' logs subject to the route owner's privacy setting propagated from MOD-001 `privacy_setting`). The data flow on insert: client → Supabase Auth (session) → Postgres insert into `Ascent` (RLS-checked) → PostHog event (MOD-011).

---

## Input / Output Contract

**Inputs (log a send):**
- `route_id` (FK from MOD-003), `style` (flash | top | attempt), `attempts` (integer), `note` (optional text), `is_private` (bool)
- Authenticated user session (MOD-001)
- `logged_at` (timestamp — client-supplied or server `now()`)

**Outputs (log a send):**
- `Ascent` row inserted in Postgres
- Success confirmation shown to user
- On network failure: clear error message displayed to user (no silent failure, no offline queue)
- PostHog event emitted (first send, via MOD-011)

**Inputs (fetchUserAchievements):**
- `routeIds: string[]` — array of route UUIDs to check
- Authenticated user session (scoped to `auth.uid()` automatically via RLS or explicit predicate)

**Outputs (fetchUserAchievements):**
- `Promise<Record<string, 'flash' | 'top' | 'attempt'>>` — map of route_id → best ascent style for the calling user; routes with no ascent by this user are absent from the map

---

## Key Implementation Notes

- Grade is **not stored** in the `Ascent` row. The `Ascent` schema has no `grade` column. Grade is always read from `Route.grade` at display time. Engineers must not add a `grade` column to `Ascent` even for convenience.
- The send log flow from a route detail page must complete in ≤4 taps: route page → log tap → style selection → confirm (AC-010).
- A global "+" entry point is also required (implied by PRD §6 MOD-004 purpose statement: "from a route page or global '+' entry point").
- On any network failure saving the send, display a clear error message. Do not silently fail. Do not queue the send for later retry (Phase 2 adds the offline queue). The user can retry manually.
- `is_private` field allows users to mark individual sends as private.
- `style` enum: `flash | top | attempt` only. `project` is removed.
- Any TypeScript union type or picker option list enumerating ascent styles must be `'flash' | 'top' | 'attempt'` — drop `'project'`.
- RLS: a user may only insert Ascent rows with their own `user_id`. Reading other users' ascents is controlled by the profile privacy setting (MOD-001 `privacy_setting = followers_only` hides logs from non-followers).

### ascent_style Enum Migration (AC-014)

The `project` value must be removed from the `ascent_style` database enum using the PG15-safe single-file, single-transaction pattern (not the two-file ADD VALUE pattern):

```sql
-- Migration: 2026XXXXXX_mod_004_ascent_style_drop_project.sql  (MOD-004-owned)

-- 1. New type WITHOUT 'project'
CREATE TYPE ascent_style_v2 AS ENUM ('flash', 'top', 'attempt');

-- 2. Backfill: reclassify historical 'project' rows to 'attempt'
--    MUST run before the column type swap (step 3)
UPDATE public.ascents SET style = 'attempt' WHERE style = 'project';

-- 3. Swap the column type via text cast (safe now that no row holds 'project')
ALTER TABLE public.ascents
  ALTER COLUMN style TYPE ascent_style_v2
  USING style::text::ascent_style_v2;

-- 4. Drop the old type, then rename the new one to the canonical name
DROP TYPE ascent_style;
ALTER TYPE ascent_style_v2 RENAME TO ascent_style;
```

**Sequencing note**: the migration must run before any code change that removes `project` from the UI. Migration first, then code. The `project → attempt` reclassification is lossless: both denote an unsuccessful/in-progress ascent.

**Canary**: the error `ERROR: invalid input value for enum ascent_style_v2: "project"` means the backfill (step 2) was omitted or placed after step 3. Verify locally with `supabase db reset` and `SELECT enum_range(NULL::ascent_style);` — expected result: `{flash,top,attempt}`.

**RENAME TYPE is required**: do not skip step 4. Leaving the type named `ascent_style_v2` silently drifts the canonical type name from every spec, production.md, and future migration or RPC that references `ascent_style`.

**This is a single-file, single-transaction change** — distinct from the two-file rule for `ALTER TYPE ADD VALUE` (which governs only ADD VALUE operations).

### fetchUserAchievements Public Service Function

Expose `fetchUserAchievements(routeIds: string[]): Promise<Record<string, 'flash' | 'top' | 'attempt'>>` in `send-service.ts` (MOD-004's public service). This function:
- Queries `ascents` scoped to the calling user (`user_id = auth.uid()`), filtering to `route_id = ANY(routeIds)`.
- Reduces multiple ascents per route to the best style with defined precedence: `flash > top > attempt`.
- Returns a map of `route_id → best_style`; routes with no ascent by this user are absent from the map (the consuming screen shows no icon for those routes).
- Must be batched (one call per screen with all visible route IDs) — never called per route (N+1).
- Must be own-user-scoped: returns only the calling user's own achievements, never another user's. Use `SECURITY INVOKER` if implemented as a Postgres RPC (RLS scopes it to `auth.uid()` automatically). If a SECURITY DEFINER function is ever used instead, `WHERE user_id = auth.uid()` is mandatory and non-optional.
- Preferred implementation: a `SECURITY INVOKER` Postgres RPC that groups `ascents` by `route_id` for `user_id = auth.uid()`, applies the precedence via an ordered aggregate, and returns `(route_id, style)` rows. A single client-side `SELECT route_id, style FROM ascents WHERE route_id = ANY($ids) AND user_id = auth.uid()` with client-side reduction is acceptable for Phase 1. Engineer's call; document the chosen shape in the implementation.
- The `ascents_route_id_idx (route_id, logged_at DESC)` index supports the `route_id = ANY(...)` scan.

---

## Out of Scope for This Module

- Offline send queue (Phase 2 only).
- Likes on plain send logs (out of scope for Phase 1; like affordance is only on beta videos per AC-053).
- Comments on sends (out of scope for Phase 1).
- Per-user grade overrides (grade always comes from `Route.grade`).
- Send history and stats display (owned by MOD-008).
- Feed rendering of sends (owned by MOD-006).
- The `project` ascent style (removed from UI and DB enum in Phase 1; historical rows backfilled to `attempt`).
