# MOD-004: Send Logging — Spec

**Module ID**: MOD-004
**Module Name**: Send Logging
**Phase**: 1
**Dependencies**: MOD-001, MOD-003
**Last Synced from PRD Revision**: 40
**Last Updated**: 2026-10-15

---

## Purpose

Handle send log creation from a route page or global "+" entry point, enforcing that grade is inherited from the route (no per-user override) and restricting the ascent style to the three-value set (flash, top, attempt). Expose `fetchUserAchievements(routeIds[])`, `fetchMyAscentsForRoute(routeId)`, and `summarizeAscents(ascents)` as public service functions for consumption by MOD-003 screens and (for AC-190, Rev 39/40) by MOD-003 RouteListScreen and MOD-012 HomeScreen.

---

## Context

The core climber loop — "log a send without interrupting my climbing rhythm" — requires that logging be fast: ≤30 seconds and ≤4 taps from a known route page (US-002). The grade of a send is never stored per-log; it is always read from `Route.grade` at display time. This is a deliberate data-model decision that keeps the `Ascent` table clean and ensures grade updates to a route propagate automatically to all historical logs. Phase 1 does not support offline send queueing; if the network request fails, the user sees a clear error message. Logging from a known route page is the primary flow; a global "+" entry point is also required.

The ascent style selector is restricted to exactly three values: {flash, top, attempt}. The `project` style is removed — it is not selectable in the UI and is not a valid value in the `ascent_style` database enum. Any historical ascent previously logged with `project` is treated as `attempt` (backfilled in the migration). A new migration removes `project` from the `ascent_style` DB enum using the PG15-safe pattern (create new type, backfill, swap, rename). The enum removal migration must run before any code change that removes `project` from the UI (migration first, then code).

The log-send form (`LogSendScreen.tsx`) does not present a V-grade or any grade input field. Grade is rendered read-only for display only, inherited from `Route.grade` at display time. The form fields are: style selector, attempts, date, note, is_private. No grade picker exists or should be added. This satisfies AC-011 (revised, Rev 14) — the existing implementation is already correct.

**AC-011 revised (Rev 14) — already satisfied**: `LogSendScreen.tsx` has no grade input field. Grade is displayed read-only (display-only block showing `routeGrade` with a `gradeNote`), never as a selectable or editable control. The `logAscent` payload and `AscentLogInput` type contain no `grade` field. AC-011 revised codifies existing behavior — no code change is required. **One doc-comment fix is needed**: the JSDoc comment at the top of `LogSendScreen.tsx` line 12 lists `project` as a style (removed in Rev 9); drop `project` from the listed style set. The running code is already correct (`ASCENT_STYLES` in `types.ts` is `['flash', 'top', 'attempt']`); only the comment is stale.

**AC-131 (new, Rev 15)**: The log-send form shall not display a route grade section. The route's grade is shown on the route detail screen before the form is opened; it is not repeated inside the log-send form. Note: AC-011 governs the absence of a grade input field; AC-131 additionally removes the read-only grade display. The entire read-only grade display block (labeled "難度") in `LogSendScreen.tsx` must be removed. This is a presentational-only change; no data or logic change is required.

**AC-132 (new, Rev 15)**: The log-send form shall not present a "set as private" (設為私人) toggle. All send records logged in Phase 1 are private: the system shall set `is_private = true` on every ascent insert. The `is_private` column remains in the schema (no migration), but it is not user-controllable in Phase 1. The `is_private` toggle must be removed from `LogSendScreen.tsx`; `is_private: true` must be hardcoded in the `AscentLogInput` payload sent to `insertAscent`. The `is_private` column stays in the DB schema and `Ascent` type for Phase 2.

MOD-004 owns the following public service functions:

- `fetchUserAchievements(routeIds[])`: given a list of route IDs, returns the best ascent style achieved by the calling user on each route (scoped to `auth.uid()`), reducing multiple ascents per route to the best style with precedence `flash > top > attempt`. Routes with no ascent by the user are absent from the returned map. Consumed by: (a) MOD-003 RouteListScreen and RouteDetailScreen for achievement icon display; (b) MOD-003 RouteListScreen for the shared route card's `hasSend`/`sendStyle` props (AC-190, Rev 39/40); (c) MOD-012 HomeScreen for the shared route card's `hasSend`/`sendStyle` props in the Projecting Routes section (AC-190, Rev 39/40). In all three cases it is called once per screen load with all visible route IDs (no N+1). Already batched, user-scoped via `.eq('user_id', …)`, enforces flash > top precedence client-side. No new RPC or migration is needed for AC-190 — callers derive `hasSend`/`sendStyle` client-side from the returned map.

- `fetchMyAscentsForRoute(routeId)`: returns `AscentWithProfile[]` for the calling user's own ascents on a single route, scoped to `auth.uid()`, ordered `logged_at DESC`. Already consumed by RouteDetailScreen today (imported at line 49 of `RouteDetailScreen.tsx`). Consumed by MOD-003 for AC-127 (send-summary cards) and AC-129 (Send History Detail screen list). Return shape: `{ id, user_id, route_id, style, attempts, note, logged_at, is_private, display_name }`.

- `summarizeAscents(ascents: AscentWithProfile[]): { sends: number; attempts: number }`: a pure client-side helper that derives the AC-127 two-column summary from the `AscentWithProfile[]` array returned by `fetchMyAscentsForRoute`. Sends = `ascents.filter(a => a.style === 'flash' || a.style === 'top').length`; Attempts = `ascents.reduce((sum, a) => sum + a.attempts, 0)`. This helper keeps the "flash|top = a send" business rule owned by MOD-004 (the send-logging domain). No server-side RPC is needed or should be added for this aggregation — the counts are a trivial client-side reduction over an array already in memory, and a separate RPC would risk the aggregate disagreeing with the AC-129 list.

**Non-goals for this module:**
- Offline send queue (Phase 2 — Phase 1 shows a clear error on failure).
- Likes on plain send logs (out of scope for Phase 1 — like affordance is only on beta videos).
- Comments on sends (out of scope for Phase 1).
- Per-user grade overrides (Phase 1 forces grade from Route.grade).
- The `project` ascent style (removed entirely from UI and DB enum in Phase 1).
- A public/shared send-record visibility toggle (out of scope for Phase 1 — all sends are private, `is_private = true`).

---

## Related User Stories

- **US-002**: Log a send quickly (AC-010, AC-011, AC-012, AC-014, AC-127, AC-128, AC-129, AC-130, AC-131, AC-132)

---

## Acceptance Criteria Covered

**AC-010**: The system shall allow a user to log a send from an existing route detail page in ≤4 taps (route → log → style → confirm).

**AC-011** (revised, Rev 14): The system shall save the log with `grade` derived from `Route.grade` at display time; no per-log grade value is stored. The log-send form shall not present a V-grade (or any grade) input field; grade is inherited from `Route.grade` at display time and is not selectable or editable when logging a send.

> **Implementation note**: AC-011 revised is already satisfied — `LogSendScreen.tsx` has no grade input; grade is display-only. The only action for the engineer is to fix the stale doc-comment on line 12 of `LogSendScreen.tsx`, which lists `project` as a style (removed in Rev 9) — fix the comment but the behavior is already correct.

**AC-012**: The system shall, when the network request to save a send fails, display a clear error message to the user (Phase 1 does not queue sends offline).

**AC-013**: After a send is successfully logged, the ascent list on the route detail screen refreshes immediately to show the new entry without requiring re-navigation.

**AC-014** (new): The system shall restrict the ascent style selector to the fixed three-value enum {flash, top, attempt}. The `project` style is removed — it is not selectable in the UI and is not a valid value in the `ascent_style` database enum. Any historical ascent previously logged with `project` shall be treated as `attempt` (see migration note below).

**AC-131** (new, Rev 15): The log-send form shall not display a route grade section. The route's grade is shown on the route detail screen before the form is opened; it is not repeated inside the log-send form. (Note: AC-011 governs the absence of a grade input field; AC-131 additionally removes the read-only grade display.)

> **Implementation note**: Remove the entire read-only grade display block from `LogSendScreen.tsx` (labeled "難度"). This is a presentational-only change — no data model change and no change to the `AscentLogInput` payload are required.

**AC-132** (new, Rev 15): The log-send form shall not present a "set as private" (設為私人) toggle. All send records logged in Phase 1 are private: the system shall set `is_private = true` on every ascent insert. The `is_private` column remains in the schema (no migration), but it is not user-controllable in Phase 1.

> **Implementation note**: Remove the `is_private` toggle from `LogSendScreen.tsx`; hardcode `is_private: true` in the `AscentLogInput` payload sent to `insertAscent`. The `is_private` column stays in the DB schema and `Ascent` type — no migration is required. The column is retained for Phase 2, when a public/shared visibility toggle may be introduced.

---

## Integration Points

MOD-004 exposes the following public service functions in `send-service.ts`:

1. `fetchUserAchievements(routeIds: string[]): Promise<Record<string, 'flash' | 'top' | 'attempt'>>` — consumed by: (a) MOD-003 (RouteListScreen, RouteDetailScreen) for achievement icon display; (b) MOD-003 RouteListScreen for the shared route card's `hasSend`/`sendStyle` props (AC-190, Rev 39/40); (c) MOD-012 HomeScreen for the shared route card's `hasSend`/`sendStyle` props in the Projecting Routes section (AC-190, Rev 39/40). All consuming screens call it once per load with all visible route IDs. MOD-003 and MOD-012 import only the public service function — not MOD-004 internal screens, components, or the `ascents` table. MOD-004 engineer implements this function; MOD-003 and MOD-012 engineers confirm it is available before their respective QA handoffs.

2. `fetchMyAscentsForRoute(routeId: string): Promise<AscentWithProfile[]>` — route-scoped, own-user-only (`.eq('user_id', user.id)`, defense-in-depth against RLS OR-clause), ordered `logged_at DESC`. Already consumed by `RouteDetailScreen.tsx` (imported line 49). Also consumed by MOD-003 for AC-127 (send-summary cards via `summarizeAscents`) and AC-129 (Send History Detail screen raw list). No new service function and no new RPC are needed for either AC.

3. `summarizeAscents(ascents: AscentWithProfile[]): { sends: number; attempts: number }` — pure client-side helper. `sends` = count where `style ∈ {flash, top}`; `attempts` = sum of `attempts` column. Consumed by MOD-003's RouteDetailScreen for the AC-127 two-column summary cards. Do NOT implement as a server-side RPC.

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
   -- is_private is ALWAYS true in Phase 1 — the system sets it on every insert;
   -- it is NOT user-controllable (no "set as private" toggle in the log-send
   -- form, per AC-132). The column is retained in the schema (no migration) for
   -- Phase 2, when a public/shared visibility toggle may be introduced.
```

All tables guarded by Supabase Row-Level Security policies. `Ascent` rows are writable by the owning user (insert own logs) and readable per privacy rules (own logs always; other users' logs subject to the route owner's privacy setting propagated from MOD-001 `privacy_setting`). The data flow on insert: client → Supabase Auth (session) → Postgres insert into `Ascent` (RLS-checked) → PostHog event (MOD-011).

---

## Input / Output Contract

**Inputs (log a send):**
- `route_id` (FK from MOD-003), `style` (flash | top | attempt), `attempts` (integer), `note` (optional text)
- `is_private` is hardcoded to `true` on every insert — not a client-supplied field (AC-132)
- Authenticated user session (MOD-001)
- `logged_at` (timestamp — client-supplied or server `now()`)

**Outputs (log a send):**
- `Ascent` row inserted in Postgres (with `is_private = true`)
- Success confirmation shown to user
- On network failure: clear error message displayed to user (no silent failure, no offline queue)
- PostHog event emitted (first send, via MOD-011)

**Inputs (fetchUserAchievements):**
- `routeIds: string[]` — array of route UUIDs to check
- Authenticated user session (scoped to `auth.uid()` automatically via RLS or explicit predicate)

**Outputs (fetchUserAchievements):**
- `Promise<Record<string, 'flash' | 'top' | 'attempt'>>` — map of route_id → best ascent style for the calling user; routes with no ascent by this user are absent from the map

**Inputs (fetchMyAscentsForRoute):**
- `routeId: string` — single route UUID
- Authenticated user session (scoped to `auth.uid()`)

**Outputs (fetchMyAscentsForRoute):**
- `Promise<AscentWithProfile[]>` — all of the calling user's ascent records for the route, ordered `logged_at DESC`. Each record carries: `{ id, user_id, route_id, style, attempts, note, logged_at, is_private, display_name }`.

**Inputs (summarizeAscents):**
- `ascents: AscentWithProfile[]` — the array returned by `fetchMyAscentsForRoute`

**Outputs (summarizeAscents):**
- `{ sends: number; attempts: number }` — `sends` = count where `style ∈ {flash, top}`; `attempts` = sum of `attempts` column across all records

---

## Key Implementation Notes

- Grade is **not stored** in the `Ascent` row. The `Ascent` schema has no `grade` column. Grade is always read from `Route.grade` at display time. Engineers must not add a `grade` column to `Ascent` even for convenience.
- The send log flow from a route detail page must complete in ≤4 taps: route page → log tap → style selection → confirm (AC-010).
- A global "+" entry point is also required (implied by PRD §6 MOD-004 purpose statement: "from a route page or global '+' entry point").
- On any network failure saving the send, display a clear error message. Do not silently fail. Do not queue the send for later retry (Phase 2 adds the offline queue). The user can retry manually.
- `is_private` is always `true` in Phase 1 — hardcode it in the `AscentLogInput` payload; do not expose a toggle to the user (AC-132).
- `style` enum: `flash | top | attempt` only. `project` is removed.
- Any TypeScript union type or picker option list enumerating ascent styles must be `'flash' | 'top' | 'attempt'` — drop `'project'`.
- RLS: a user may only insert Ascent rows with their own `user_id`. Reading other users' ascents is controlled by the profile privacy setting (MOD-001 `privacy_setting = followers_only` hides logs from non-followers).

### AC-131 — Grade Display Removal

Remove the entire read-only grade display block (labeled "難度") from `LogSendScreen.tsx`. AC-011 already required no grade *input* field; AC-131 (Rev 15) additionally removes the read-only grade *display*. This is a presentational-only change — no data model change, no change to the `AscentLogInput` payload, and no schema migration are required.

### AC-132 — Always-Private Sends

Remove the `is_private` toggle from `LogSendScreen.tsx`. Hardcode `is_private: true` in the `AscentLogInput` payload sent to `insertAscent`. The `is_private` column stays in the DB schema and `Ascent` type — **no migration is required**. The column is retained for Phase 2, when a public/shared visibility toggle may be introduced. Engineers must not remove `is_private` from the schema, the `Ascent` type, or the `AscentWithProfile` shape.

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

### fetchMyAscentsForRoute Public Service Function

`fetchMyAscentsForRoute(routeId: string): Promise<AscentWithProfile[]>` is already implemented at `src/modules/mod-send-logging/send-service.ts:146`. It is own-user-scoped (`.eq('user_id', user.id)` — defense-in-depth against the `ascents_select_own_or_public` RLS OR-clause), ordered `logged_at DESC`, and returns `AscentWithProfile[]`.

This function is:
- **Already consumed** by `RouteDetailScreen.tsx` (imported at line 49, result held in `myAscents` state at line 122).
- **Sufficient for AC-129** (Send History Detail list): `style` and `attempts` are both present on every returned row — no new field needed.
- **Sufficient for AC-127** (send-summary cards) via `summarizeAscents` — no new query, no new fetch.

No extension to this function is needed for Rev 14. The Send History Detail screen re-fetches it on mount to ensure a current list.

### summarizeAscents Helper

`summarizeAscents(ascents: AscentWithProfile[]): { sends: number; attempts: number }` is a pure, synchronous helper to be added to `send-service.ts` alongside `fetchMyAscentsForRoute`.

```ts
function summarizeAscents(ascents: AscentWithProfile[]): { sends: number; attempts: number } {
  return {
    sends: ascents.filter(a => a.style === 'flash' || a.style === 'top').length,
    attempts: ascents.reduce((sum, a) => sum + a.attempts, 0),
  };
}
```

This helper keeps the "flash|top = a send" business rule owned by MOD-004 (the send-logging domain) so both AC-127 (route detail summary cards) and the Send History Detail screen (which may echo the totals) agree. A screen-inline `.filter/.reduce` is also acceptable for Phase 1, but the helper is preferred.

**Do NOT implement `summarizeAscents` as a server-side RPC.** The counts are a trivial client-side reduction over an array already in memory; a new RPC would be over-engineering and risks the aggregate disagreeing with the AC-129 list.

---

## Out of Scope for This Module

- Offline send queue (Phase 2 only).
- Likes on plain send logs (out of scope for Phase 1; like affordance is only on beta videos per AC-053).
- Comments on sends (out of scope for Phase 1).
- Per-user grade overrides (grade always comes from `Route.grade`).
- Send history and stats display (owned by MOD-008).
- Feed rendering of sends (owned by MOD-006).
- The `project` ascent style (removed from UI and DB enum in Phase 1; historical rows backfilled to `attempt`).
- A public/shared send-record visibility toggle (out of scope for Phase 1; `is_private` column retained in schema for Phase 2).
