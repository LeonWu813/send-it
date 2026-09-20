# MOD-003: Route Catalog — Spec

**Module ID**: MOD-003
**Module Name**: Route Catalog
**Phase**: 1
**Dependencies**: MOD-001, MOD-002

---

## Purpose

Own the route submission match-before-create flow, the standardized `gym + grade + hold color` match key, route detail pages, active/retired status flagging, and the fixed hold/tape color enum.

---

## Context

Routes are user-submitted but admin-curated in terms of structure. The core data-quality lever is a match-before-create flow: when a climber submits a new route (grade + hold color + photo) for a given gym, the app first queries for existing active routes at that gym with the same grade and color, presents any matches, and only then allows creation. This prevents the "every user invents their own tag" problem that kills UGC route apps. The fixed 9-color hold/tape enum and forced V-scale grade system reflect how climbers in Taiwan actually talk about routes. The `Route.match_key` is implemented as a Postgres `GENERATED ALWAYS AS ... STORED` column; uniqueness of active routes is enforced at the DB level by a partial unique index `UNIQUE (gym_id, grade, color_tag) WHERE status = 'active'` — this correctly allows retired routes to reuse the same key after a wall reset. Route retirement (US-014) is user-actioned: any authenticated user can flag an active route as retired, which immediately removes it from the active-routes match pool and the default gym route list view.

**Non-goals for this module:**
- Official gym partnerships and route-setter accounts publishing official route lists (Phase 3).
- User-editable grade overrides (Phase 1 forces V-scale; the gym's posted grade is the source of truth).
- Grade systems other than V-scale (Phase 1 only).
- In-app admin tooling for near-duplicate route merges (Supabase Studio only).
- Comments on routes (out of scope for Phase 1).
- Retire/reset voting workflow (Phase 2).

---

## User Stories Covered

- **US-003**: Submit a new route with match-before-create
- **US-006**: Browse currently active routes at a gym
- **US-014**: Flag a route as retired

---

## Acceptance Criteria Covered

**AC-020**: The system shall, on new-route submission for a given gym + grade + hold color, query existing **active** routes at that gym with the same grade + color and present any matches to the user before allowing creation.

**AC-021**: The system shall block new-route creation when no photo is attached and shall show a validation message indicating the photo is required.

**AC-022**: The system shall restrict the hold/tape color selector to the fixed enum {red, orange, yellow, green, blue, purple, pink, white, black}.

**AC-023**: The system shall enforce V-scale as the only grade system available for route creation across all Phase 1 gyms.

**AC-024**: The system shall allow any authenticated user to flag an existing active route as retired, set `status = retired` and `retired_at = now()`, and immediately exclude the route from the active-routes match pool.

**AC-040**: The system shall, on a gym detail page, filter the route list by grade and by active/retired status based on user-selected filter controls.

**AC-041**: The system shall default the gym route list to `active` status when no filter is explicitly set.

---

## Data Model (relevant tables)

```
Route
 - id, gym_id (FK Gym), section_label (nullable), grade (V-scale enum),
   color_tag (enum: red|orange|yellow|green|blue|purple|pink|white|black — required),
   photo_url (required),
   match_key (Postgres GENERATED ALWAYS AS (gym_id || grade || color_tag) STORED;
   uniqueness enforced by a PARTIAL unique index
   UNIQUE (gym_id, grade, color_tag) WHERE status = 'active',
   so retired routes may reuse the same key after a wall reset),
   status (active | retired), submitted_by_user_id (FK User),
   created_at, retired_at (nullable), retired_by_user_id (nullable, FK User)
```

All tables guarded by Supabase Row-Level Security policies. Route rows are readable by all authenticated users; writable by the submitting user + admins (for submission). Any authenticated user may update status to `retired` (AC-024). Admin-only operations (near-duplicate merges) happen in Supabase Studio.

---

## Input / Output Contract

**Inputs (route submission):**
- `gym_id` (FK from MOD-002), `grade` (V-scale enum), `color_tag` (fixed enum), `photo_url` (required), `section_label` (optional)
- Authenticated user session (MOD-001)

**Outputs (route submission):**
- Match query result: list of existing active routes at `gym_id` with matching `grade` + `color_tag`, shown to user before creation proceeds
- `Route` row inserted with `status = active` if user proceeds past match check
- Partial unique index prevents duplicate active routes at the DB level

**Inputs (route list / gym detail):**
- `gym_id`, optional filter: `grade`, `status` (default `active`)

**Outputs (route list):**
- Filtered list of `Route` rows matching the filter criteria

**Inputs (route retirement):**
- `route_id`, authenticated user session

**Outputs (route retirement):**
- `Route.status` set to `retired`, `retired_at = now()`, `retired_by_user_id` set
- Route immediately excluded from active-routes match pool

---

## Key Implementation Notes

- **match_key implementation**: `Route.match_key` is a Postgres `GENERATED ALWAYS AS (gym_id || grade || color_tag) STORED` column. Uniqueness is enforced by a **partial unique index**: `UNIQUE (gym_id, grade, color_tag) WHERE status = 'active'`. This constraint lives at the database level — not only in application code — so concurrent submissions cannot create duplicates. The partial predicate allows historical retired routes to reuse the same key after a wall reset.
- **Fixed color enum**: The hold/tape color selector must be restricted to exactly: `{red, orange, yellow, green, blue, purple, pink, white, black}`. No free-text color input.
- **V-scale forced**: Grade creation must only offer V-scale options (e.g., VB, V0–V17). No other grade system in Phase 1.
- **Photo required**: `photo_url` must be attached before route creation can proceed (AC-021). The photo is uploaded to Supabase Storage; the resulting URL is stored in `Route.photo_url`.
- **section_label**: This field is already in the schema as a nullable column. Surface it as an optional field in the route submission form from day one, even though it is nullable. This allows it to be promoted to required as a tiebreaker in Phase 2 (if color-collision data warrants it) without a schema change.
- **Retirement**: Any authenticated user (not just the submitter) can flag a route as retired (AC-024). Upon retirement, `retired_at = now()` and `retired_by_user_id` are set, and the route is immediately excluded from the match pool (partial unique index drops it from uniqueness scope).
- **Admin merges**: Near-duplicate route merges are performed by the admin via Supabase Studio. No in-app admin UI.
- **Default filter**: The gym route list defaults to `status = active` (AC-041). Users can apply grade and status filters (AC-040).

---

## Out of Scope for This Module

- Official gym route lists and route-setter accounts (Phase 3).
- User-editable grade overrides (Phase 1 — grade comes from the gym's posted grade).
- Grade systems other than V-scale (Phase 1 only).
- Comments on routes (Phase 1 — out of scope entirely).
- Retire/reset voting workflow (Phase 2).
- In-app admin tooling for route management (Supabase Studio only).
- Cities outside Taipei and New Taipei for Phase 1 seeding.
