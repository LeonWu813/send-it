# MOD-003: Route Catalog — Spec

**Module ID**: MOD-003
**Module Name**: Route Catalog
**Phase**: 1
**Dependencies**: MOD-001, MOD-002
**Last Synced from PRD Revision**: 6

---

## Purpose

Own the route submission (filter-first, single-page, direct-submit) flow, the 4-value status lifecycle (`active | pending | retired | rejected`), submitter-only pending visibility and withdrawal, admin-only approve/reject/retire via Supabase Studio (Phase 1), and the forward-compatible admin identity design for Phase 1.5 in-app admin.

---

## Context

Routes are user-submitted but admin-curated in terms of structure. The core data-quality mechanism is a filter-first, single-page submit flow: when a climber wants to add a new route, they first use the RouteListScreen grade and hold-color filter chips to check whether the route already exists. The filtered route list itself serves as the "does this route already exist?" check. An always-visible "Can't find it? Add a new route." CTA at the bottom of the route list opens a single-page submit screen with grade and color chips pre-filled from the active filter state. The submit screen contains grade chips, hold-color chips, an inline photo picker (preview on the same page), an optional section-label field, and an "Add Route" button that submits directly via the `submit_route` RPC. There is no separate client-side match-check step and no multi-step submission flow. Server-side duplicate protection keeps data clean: the `submit_route` RPC pre-check and the partial unique index on active routes (`UNIQUE (gym_id, grade, color_tag) WHERE status = 'active'`) enforce uniqueness at the database level. The fixed 9-color hold/tape enum and forced V-scale grade system reflect how climbers in Taiwan actually talk about routes. The `Route.match_key` is implemented as a Postgres `GENERATED ALWAYS AS ... STORED` column; uniqueness of active routes is enforced at the DB level by a partial unique index `UNIQUE (gym_id, grade, color_tag) WHERE status = 'active'` — this correctly allows retired or rejected routes to reuse the same key after a wall reset.

Route status follows a 4-value lifecycle: `active | pending | retired | rejected`. An auto-approve setting (stored in `app_settings`, defaults ON at Phase 1 launch) determines the initial status on submission: when auto-approve is ON, a submitted route is immediately `active`; when auto-approve is OFF, the route is created as `pending`. A `pending` route is visible only to the submitter (read-only) and does not appear in any other user's gym route list or match pool. `retired` and `rejected` routes are invisible to all normal users. Admin approval, rejection, and retirement are performed exclusively via Supabase Studio in Phase 1. The `submit_route` SECURITY DEFINER RPC handles all submission logic server-side (no direct INSERT by client).

The user story for the route list (US-006) specifies grade and hold-color filter chips only — no free-text search, no status filter for normal users. Normal users see `active` routes only, with no status tag surfaced to them.

**Non-goals for this module:**
- Official gym partnerships and route-setter accounts publishing official route lists (Phase 3).
- User-editable grade overrides (Phase 1 forces V-scale; the gym's posted grade is the source of truth).
- Grade systems other than V-scale (Phase 1 only).
- In-app admin tooling for near-duplicate route merges (Supabase Studio only).
- Comments on routes (out of scope for Phase 1).
- Retire/reset voting workflow (Phase 2).
- In-app admin UI for route status management (approve / reject / retire) is out of scope for Phase 1 (planned for Phase 1.5); Supabase Studio is the admin surface for Phase 1.
- Global (cross-user) one-pending-per-combo prevention is out of scope — only per-submitter enforcement is required.

---

## User Stories Covered

- **US-003**: Submit a new route
- **US-006**: Browse currently active routes at a gym

---

## Acceptance Criteria Covered

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

**AC-042** (new — doc gap, code already works inside RouteNavigator): The system shall navigate a user from a route entry in the gym route list to that route's detail screen when the user taps the entry, passing the selected route's identifier. The route detail screen is the entry point for logging a send (AC-010), uploading beta (AC-037), and watching beta (AC-033).

> **Note on AC-042**: AC-042 is already implemented within `RouteNavigator`'s internal state machine. It becomes reachable only once AC-005 (MOD-002) wires `RouteNavigator` into the app.

**AC-043** (new): The system shall pre-fill the route submit screen's grade and color chips from the RouteListScreen filter state when the user opens the submit screen. RouteListScreen passes its current grade filter and color filter values as optional parameters to the submit screen; if a grade filter was active when the user tapped "Add Route", the corresponding grade chip shall be pre-selected, and if a color filter was active, the corresponding color chip shall be pre-selected. When a filter is unset, the corresponding chip shall open unselected. Pre-filled chips remain editable by the user before submission.

---

## Integration Points

1. **File to modify**: `src/modules/mod-route-catalog/screens/RouteDetailScreen.tsx`
   **Change**: Expose a slot or prop (e.g., `onAddBetaVideo` callback or a MOD-005-provided component) on `RouteDetailScreen` so that MOD-005's engineer can wire the "Add beta video" entry point into the screen. The entry point must be visible without leaving the route detail screen. The capture/upload flow itself is owned entirely by MOD-005.
   **Owner**: engineer-mod-route-catalog exposes the slot/prop; engineer-mod-beta-video fills it with the route-context-aware upload launcher and owns AC-037 end-to-end.
   **AC**: AC-037

---

## Data Model (relevant tables)

```
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
   -- in the normal-user route list.

app_settings
 - key TEXT PRIMARY KEY, value TEXT
   -- Admin-only via Supabase Studio or RPC. No client SELECT/INSERT/UPDATE/DELETE
   -- grants or policies — fully client-invisible.
   -- Seeds: route_auto_approve = 'true' (auto-approve ON at Phase 1 launch).
   -- Read only inside SECURITY DEFINER functions.
```

All tables guarded by Supabase Row-Level Security policies.

**RLS on `routes`** — three policies required:
- SELECT (`routes_select_visible`): `status = 'active'` OR `(status = 'pending' AND submitted_by_user_id = auth.uid())` OR `is_admin()`. `retired` and `rejected` rows are invisible to every normal user (including the original submitter). service_role (Studio) bypasses RLS and sees all rows.
- INSERT: no policy (INSERT grant revoked; insert only via `submit_route` RPC).
- UPDATE (`routes_admin_update`): `is_admin()` only (Phase 1.5 gate; false for all Phase 1 real clients; admin transitions in Phase 1 happen via Studio service_role).
- DELETE (`routes_withdraw_own_pending`): `submitted_by_user_id = auth.uid() AND status = 'pending'` (withdrawal). Requires `GRANT DELETE ON public.routes TO authenticated`.

---

## Input / Output Contract

**Inputs (route submission — via `submit_route` RPC):**
- `p_gym_id` (FK from MOD-002), `p_grade` (V-scale enum), `p_color_tag` (fixed enum), `p_photo_url` (required), `p_section_label` (optional)
- Authenticated user session (MOD-001); submitter identity derived server-side from `auth.uid()` — not accepted as a client parameter

**Outputs (route submission):**
- `Route` row inserted with `status = active` (auto-approve ON) or `status = pending` (auto-approve OFF)
- Returned route row; client uses returned `status` to select confirmation copy

**Inputs (route list / gym detail):**
- `gym_id`, optional filter: `grade`, `color_tag` (chip selectors; no text search, no status filter for normal users)

**Outputs (route list):**
- Filtered list of `active` `Route` rows matching the filter criteria (normal users); submitter additionally sees their own `pending` rows

**Inputs (route withdrawal):**
- `route_id`, authenticated user session
- Client calls `supabase.from('routes').delete().eq('id', routeId)` directly; enforced by RLS DELETE policy

**Outputs (route withdrawal):**
- `Route` row deleted (not status-changed); slot freed in the pending partial unique index, allowing resubmission

---

## Key Implementation Notes

- **match_key implementation**: `Route.match_key` is a Postgres `GENERATED ALWAYS AS (gym_id || grade || color_tag) STORED` column. Uniqueness is enforced by a **partial unique index**: `UNIQUE (gym_id, grade, color_tag) WHERE status = 'active'`. This constraint lives at the database level — not only in application code — so concurrent submissions cannot create duplicates. The partial predicate allows historical retired and rejected routes to reuse the same key after a wall reset.
- **Fixed color enum**: The hold/tape color selector must be restricted to exactly: `{red, orange, yellow, green, blue, purple, pink, white, black}`. No free-text color input.
- **V-scale forced**: Grade creation must only offer V-scale options (e.g., VB, V0–V17). No other grade system in Phase 1.
- **Photo required via inline picker**: `photo_url` must be attached before route creation can proceed (AC-021). The photo is selected via an inline photo picker on the submit screen (preview shown on the same page after selection); the photo is uploaded to Supabase Storage and the resulting URL is stored in `Route.photo_url`. The "Add Route" button cannot submit without a photo (client-side enforcement); the `submit_route` RPC also rejects a submission with no photo (server-side enforcement).
- **Single-page submit screen**: The submit screen is a single page — grade chips, hold-color chips, inline photo picker, optional section-label field, and "Add Route" button. There is no multi-step flow and no client-side match-check step. The RouteListScreen grade + color filter serves as the "does this route already exist?" check before the user opens the submit screen.
- **Pre-fill from filter state**: RouteListScreen passes its current grade filter and color filter values as optional parameters to the submit screen (AC-043). If a filter was active, the corresponding chip is pre-selected; if unset, the chip opens unselected. Pre-filled chips remain editable.
- **section_label**: This field is already in the schema as a nullable column. Surface it as an optional field in the route submission form from day one, even though it is nullable. This allows it to be promoted to required as a tiebreaker in Phase 2 (if color-collision data warrants it) without a schema change.
- **Admin merges**: Near-duplicate route merges are performed by the admin via Supabase Studio. No in-app admin UI.
- **Default filter**: The gym route list shows `active` routes only for normal users (AC-041). Users can apply grade and hold-color chip filters (AC-040). No status filter is surfaced to normal users.
- **Approval-time active-uniqueness collision**: Because pending rows bypass the partial unique index (`WHERE status = 'active'`), two pending submissions for the same (gym_id, grade, color_tag) can coexist (from different users; per-submitter uniqueness is separately enforced). Approving the second one (`UPDATE status = 'active'`) will hit `routes_active_unique_idx` and raise a unique-violation in Studio. This is expected Phase 1 behavior, not a bug. The admin (Leon) can reject the duplicate in Studio.

### Enum Migration

Must be split into two migration files — one to ADD the new enum values, a second (separate transaction/timestamp) to use them. PG15 cannot add and use an enum value in the same transaction.

- **Migration A** — enum values only: `ALTER TYPE route_status ADD VALUE IF NOT EXISTS 'pending'; ALTER TYPE route_status ADD VALUE IF NOT EXISTS 'rejected';` Use `IF NOT EXISTS` for idempotency on `supabase db reset`.
- **Migration B** (separate file, later timestamp) — everything that uses the new values: `app_settings` table + seed, the `submit_route` RPC, the revised RLS policies, the new pending partial index, and the withdrawal DELETE policy.
- **Canary**: if Migration A and B are accidentally merged into one file, the symptom is `ERROR: unsafe use of new value "pending" of enum type route_status`. That error means the split was not done correctly.

### Admin Identity

Ship a `public.is_admin()` STABLE helper function that reads `COALESCE((auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin'`. Returns false for all Phase 1 clients (no user carries this claim). Phase 1.5 grants the JWT claim via `app_metadata` (set only by service_role); zero policy migration needed. All admin-gated RLS policies reference `public.is_admin()` — never inline the JWT check directly.

### `submit_route` RPC

SECURITY DEFINER function. MUST derive caller identity from `auth.uid()` — do NOT accept `user_id` as a parameter (impersonation risk). Accepts: `p_gym_id`, `p_grade`, `p_color_tag`, `p_photo_url`, `p_section_label` (optional). Logic (in order):
1. Derive `v_uid := auth.uid()`; raise exception if NULL.
2. Validate `p_photo_url` is not NULL/empty; raise exception if missing.
3. Read `app_settings` toggle: `SELECT (value = 'true') INTO v_auto FROM public.app_settings WHERE key = 'route_auto_approve'`; default to `true` if no row.
4. Guard one-pending-per-combo per submitter; raise clean error before the index constraint fires.
5. Compute `v_status`: `'active'` if `v_auto`, else `'pending'`.
6. INSERT and RETURN the row.

`GRANT EXECUTE` to `authenticated` only; `REVOKE EXECUTE` from `anon` and `public`.

**Client call**: `supabase.rpc('submit_route', { p_gym_id, p_grade, p_color_tag, p_photo_url, p_section_label })`. Returns the inserted `routes` row. The client uses the returned `status` to choose confirmation copy: `active` → "route added"; `pending` → the [I18N-PENDING] "submitted for review" message (AC-025).

### `app_settings` Table

No client SELECT/INSERT/UPDATE/DELETE grants or policies — fully client-invisible. RLS enabled with no policies (authenticated and anon get zero rows). service_role (Studio) reads and writes freely. Read only inside the SECURITY DEFINER `submit_route` RPC. Seeded with `route_auto_approve = 'true'`.

### Withdrawal

Client calls `supabase.from('routes').delete().eq('id', routeId)`. Enforced by RLS DELETE policy (`submitted_by_user_id = auth.uid() AND status = 'pending'`). No RPC needed. Requires `GRANT DELETE ON public.routes TO authenticated`.

### One-Pending-Per-Combo Constraint

Enforced per submitter via a partial unique index: `CREATE UNIQUE INDEX routes_pending_unique_idx ON public.routes (gym_id, grade, color_tag, submitted_by_user_id) WHERE status = 'pending'`. Two different users may each have a pending submission for the same (gym, grade, color); only one pending row per (gym, grade, color, user) is prevented. Both the index (race-proof guarantee) and an explicit RPC pre-check (clean error UX) are required.

### Grant Changes (Migration B)

- `REVOKE INSERT ON public.routes FROM authenticated` (insert only via RPC)
- `REVOKE UPDATE ON public.routes FROM authenticated` (defer UPDATE re-grant to Phase 1.5)
- `GRANT DELETE ON public.routes TO authenticated` (withdrawal; not currently granted)
- SELECT grant stays

### Forward-Compatibility Constraints

- Do not hardcode `service_role` checks in triggers; keep `is_admin()` as the single admin gate.
- Enforce everything through `submit_route` RPC, not client-side logic.
- Never accept client-supplied `status` or `user_id` in RPCs.
- Do not store the auto-approve toggle anywhere but `app_settings`.
- Do not add rejection/retirement metadata as a separate table in Phase 1; nullable columns (`reviewed_by_user_id`, `reviewed_at`, `review_note`) can be added to `routes` additively in Phase 1.5 if needed.

---

## Out of Scope for This Module

- Official gym route lists and route-setter accounts (Phase 3).
- User-editable grade overrides (Phase 1 — grade comes from the gym's posted grade).
- Grade systems other than V-scale (Phase 1 only).
- Comments on routes (Phase 1 — out of scope entirely).
- Retire/reset voting workflow (Phase 2).
- In-app admin UI for route status management (approve / reject / retire) — Phase 1.5; Supabase Studio is the Phase 1 admin surface.
- Global (cross-user) one-pending-per-combo prevention — only per-submitter enforcement is in scope.
- Cities outside Taipei and New Taipei for Phase 1 seeding.
