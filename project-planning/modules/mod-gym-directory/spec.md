# MOD-002: Gym Directory — Spec

**Module ID**: MOD-002
**Module Name**: Gym Directory
**Phase**: 1
**Dependencies**: MOD-001
**Last Synced from PRD Revision**: 7

---

## Purpose

Serve the admin-curated gym directory (branch-level rows), gym detail pages, gym search/filter, and the "request a gym" submission form. Own the saved-gym bookmark interaction: a read-only saved indicator on gym list cards and an interactive bookmark toggle on the gym detail screen that adds/removes the gym from the user's saved gyms list.

---

## Context

Indoor bouldering has grown fast in Taiwan, but climbers have no dedicated app with real local gym coverage. Send It's wedge is an admin-curated, branch-level gym directory seeded with Taipei and New Taipei gyms on day one — so the app has real coverage without waiting on official gym partnerships. Gyms are admin-maintained (read-only for regular users) and are the foundation that MOD-003 (Route Catalog) depends on. For Phase 1, the seed covers 13 branches across Taipei and New Taipei; top-rope-only gyms (Camp4 達文西攀岩館 and Wusa 攀岩館) are explicitly excluded. Mixed gyms are included, but only their bouldering areas are represented in-app. Every gym must have a verified address and map pin before Phase 1 GA. Climbers whose gyms are not in the directory can submit a "request a gym" form (US-013); these requests are queued for admin review in Supabase Studio and are not auto-added.

MOD-002 also owns the save/unsave bookmark interaction for gyms. The `saved_gyms` table is created in MOD-012's migration — MOD-002 engineer must coordinate with MOD-012 engineer on migration sequencing (MOD-012 migration must run first to create the `saved_gyms` table before MOD-002 can write to it). MOD-002 owns the INSERT/DELETE write operations on `saved_gyms`. MOD-012 reads `saved_gyms` (SELECT + join to gyms) for the Home screen Saved Gyms strip — that read is MOD-012's concern, not MOD-002's.

**Non-goals for this module:**
- User-created gyms (Phase 1 — admin-curated only; missing gyms captured via request form).
- Cities other than Taipei and New Taipei (Phase 2+ backlog).
- Official gym partnerships and gym-facing dashboards (Phase 3).
- In-app admin tooling for gym CRUD (Supabase Studio only).
- The `saved_gyms` table creation (owned by MOD-012 migration).
- The saved-gyms strip on the Home screen (owned by MOD-012).

---

## Related User Stories

- **US-006**: Browse currently active routes at a gym (gym directory list row → gym detail screen → route catalog entry point; partially — the gym-detail-to-routes navigation belongs to AC-005)
- **US-013**: Request a missing gym
- **US-019**: Save multiple gyms for quick access

---

## Acceptance Criteria Covered

**AC-004**: The system shall render the Taipei/New Taipei branch-level gym directory with every gym showing name, city/district, address, map pin, gym type, and (if present) photo when a user opens the Gyms tab.

**AC-006** (doc gap, code already works): The system shall navigate a user from a gym row in the gym directory list to that gym's detail screen when the user taps the row, passing the selected gym's identifier.

**AC-005** (code gap): The system shall present a "View Routes" entry point at the bottom of the gym detail screen that navigates the user to that gym's route catalog, passing the gym context (gym ID and gym name). The entry point must be visible without any additional action.

**AC-070**: The system shall accept a "request a gym" submission containing gym name, city, and optional Google Maps link, persist it to a queue readable by admins in Supabase Studio, and show the user a confirmation state when the submission succeeds.

**AC-120** (new): The gym detail screen (GymDetailScreen) shall display a bookmark icon that toggles between a saved state (filled, yellow) and an unsaved state (gray), reflecting whether the gym is in the current user's saved gyms list.

**AC-121** (new): Tapping the bookmark icon on the gym detail screen shall add or remove the gym from the current user's `saved_gyms` list and update the icon state immediately (optimistic update). The gym detail screen is the only save/unsave action point.

**AC-122** (new): The gym list screen shall display a filled yellow bookmark indicator on gym cards that are in the current user's saved gyms list; no indicator is shown for unsaved gyms. The list indicator is read-only — tapping it performs no save/unsave action.

---

## Integration Points

1. **File to modify**: `src/modules/mod-gym-directory/GymNavigator.tsx`
   **Change**: Add a `routes` view state to `GymNavigator` that renders `<RouteNavigator gymId={...} gymName={...} session={session} onBackToGym={...} />` (imported from `mod-route-catalog`). This is the runtime seam that makes MOD-003's entire UI reachable from the running app.
   **Owner**: engineer-mod-gym-directory implements; engineer-mod-route-catalog confirms that `RouteNavigator`'s props contract is satisfied before QA handoff.
   **AC**: AC-005

2. **File to modify**: `src/modules/mod-gym-directory/screens/GymDetailScreen.tsx`
   **Change**: Add a "View Routes" button at the bottom of the screen that calls `onViewRoutes(gymId, gymName)`, triggering the `routes` view state in `GymNavigator`.
   **Owner**: engineer-mod-gym-directory.
   **AC**: AC-005

3. **Shared table access**: MOD-002 engineer owns the INSERT/DELETE write operations on `saved_gyms` (AC-120, AC-121). MOD-012 reads `saved_gyms` (SELECT + join to gyms) for the Home screen strip — this is a cross-module shared-table access split by verb with the shared RLS fence. See also: MOD-012 spec Integration Points.

---

## Data Model (relevant tables)

```
Gym  (admin-maintained, branch-level rows for multi-branch gyms)
 - id, name, branch_label (nullable, e.g. "萬華", "南港"), city, district,
   address_text, lat, lng, gym_type (bouldering | top_rope | both),
   photo_url (nullable), official_grading_system (default 'V'),
   created_at, updated_at

GymRequest
 - id, requested_by_user_id, name, city, google_maps_url (nullable),
   status (pending | added | rejected), created_at, reviewed_at (nullable)

SavedGym  (join table — a user's bookmarked gyms; table created in MOD-012 migration)
 - user_id (FK User, ON DELETE CASCADE), gym_id (FK Gym, ON DELETE CASCADE),
   created_at
 - PK: (user_id, gym_id)
```

All tables guarded by Supabase Row-Level Security policies. `Gym` rows are readable by all authenticated users and writable only by admins. `GymRequest` rows are insertable by authenticated users and readable by admins only. `SavedGym` RLS scopes reads and writes so an authenticated user can only read and write rows where `user_id = auth.uid()`. GRANT: `SELECT, INSERT, DELETE ON public.saved_gyms TO authenticated` (no UPDATE).

---

## Input / Output Contract

**Inputs (gym directory):**
- Authenticated Supabase session (MOD-001)
- Filter parameters: city, gym type, text search

**Outputs (gym directory):**
- List of `Gym` rows for the Gyms tab
- `Gym` detail record for the gym detail page (name, branch_label, city, district, address_text, lat, lng, gym_type, photo_url, official_grading_system)

**Inputs (gym request):**
- `name` (required), `city` (required), `google_maps_url` (optional)
- Authenticated user session

**Outputs (gym request):**
- `GymRequest` row inserted with `status = pending`
- Confirmation state shown to user

**Inputs (saved-gym bookmark toggle):**
- Authenticated user session
- `gym_id` of the gym to save or unsave

**Outputs (saved-gym bookmark toggle):**
- INSERT or DELETE on `saved_gyms` for `(user_id, gym_id)`
- Optimistic UI update on GymDetailScreen bookmark icon (AC-121)
- Read-only filled yellow indicator on gym list cards for saved gyms (AC-122)

---

## Key Implementation Notes

- One row per branch for multi-branch gyms (e.g., T-UP 原岩 has 5 branch rows: 萬華, 南港, 新店, 中和, 明德; CORNER has 2 branch rows: 中山, 華山).
- Every gym in the Phase 1 seed must have a verified address and map pin before Phase 1 go-live; addresses marked "verify branch address" in the PRD seed table must be confirmed against Google Maps immediately before launch.
- Phase 1 seed covers 13 branches (see PRD §11). Top-rope-only gyms Camp4 達文西攀岩館 and Wusa 攀岩館 must not be seeded.
- Mixed gyms (e.g., double8 岩究所, 永和攀岩場) are included; only their bouldering areas are represented in-app.
- `Gym` table is readable by all authenticated users (RLS); write access is admin-only via Supabase Studio.
- `GymRequest` insert is allowed by authenticated users (RLS); the request queue is visible to admins in Supabase Studio. Admin review and status update (`pending → added | rejected`) happens in Studio, not in-app.
- All gym CRUD happens via Supabase Studio in Phase 1 — no in-app admin UI.
- **AC-005 is the seam connecting MOD-002 to MOD-003.** `GymNavigator.tsx` must add a `routes` view state that renders `RouteNavigator` (from mod-route-catalog) with props `gymId`, `gymName`, `session`, `onBackToGym`. `GymDetailScreen.tsx` must add a "View Routes" button at the bottom that calls `onViewRoutes(gymId, gymName)`. `RouteNavigator` itself needs no changes.
- **Saved-gym write ownership**: MOD-002 engineer implements the INSERT (save) and DELETE (unsave) operations on `saved_gyms` for the bookmark toggle on GymDetailScreen (AC-120, AC-121). The `saved_gyms` table is created in MOD-012's migration file — MOD-012 migration must run first. MOD-002 engineer must coordinate with MOD-012 engineer on migration sequencing.
- **Saved-gym read on gym list (AC-122)**: the gym list screen must read the current user's `saved_gyms` to determine which gym cards to display the filled yellow indicator on. This is a SELECT query scoped by RLS to `user_id = auth.uid()`. No save/unsave action is triggered by tapping the indicator on the list.
- **Optimistic update (AC-121)**: the GymDetailScreen bookmark icon must update immediately on tap before the Supabase INSERT/DELETE round-trip completes. If the round-trip fails, the icon must revert to the pre-tap state.

---

## Out of Scope for This Module

- User-created gyms (Phase 1 — request form only, no auto-add).
- Cities outside Taipei and New Taipei (Phase 2+ backlog).
- Official gym partnerships, gym claim flows, and gym-facing dashboards (Phase 3).
- In-app admin tooling for gym management (Supabase Studio only).
- Route data (owned by MOD-003).
- The `saved_gyms` table DDL/migration (owned by MOD-012).
- The Saved Gyms strip on the Home screen (owned by MOD-012).

## Phase 1 Seed Gym List

| # | Gym | Branch | City / Area | Include |
|---|---|---|---|---|
| 1 | MegaSTONE Climbing Gym | — | New Taipei (Xinzhuang) | Yes |
| 2 | CORNER 角攀岩館 | 中山店 | Taipei (Zhongshan) | Yes |
| 3 | CORNER 角攀岩館 | 華山店 | Taipei (Zhongshan) | Yes |
| 4 | 原岩攀岩館 (T-UP) | 萬華 | Taipei (Wanhua) | Yes |
| 5 | 原岩攀岩館 (T-UP) | 南港 | Taipei (Nangang) | Yes |
| 6 | 原岩攀岩館 (T-UP) | 新店 | New Taipei (Xindian) | Yes |
| 7 | 原岩攀岩館 (T-UP) | 中和 | New Taipei (Zhonghe) | Yes |
| 8 | 原岩攀岩館 (T-UP) | 明德 | Taipei (Beitou) | Yes |
| 9 | double8 岩究所 | — | Taipei (Dadaocheng) | Yes (bouldering area only) |
| 10 | 市民抱石攀岩館 | — | Taipei (Nangang) | Yes |
| 11 | 奇岩攀岩館 | — | Taipei (Nangang) | Yes |
| 12 | RedRock 紅石攀岩 | 士林 | Taipei (Shilin) | Yes |
| 13 | 永和攀岩場 | — | New Taipei (Yonghe) | Yes (bouldering area only) |

Explicitly excluded from Phase 1 seed: Camp4 達文西攀岩館 (top-rope focused), Wusa 攀岩館 (top-rope focused, Xinzhuang + Sanchong branches).
