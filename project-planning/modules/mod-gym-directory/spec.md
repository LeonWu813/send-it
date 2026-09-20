# MOD-002: Gym Directory — Spec

**Module ID**: MOD-002
**Module Name**: Gym Directory
**Phase**: 1
**Dependencies**: MOD-001

---

## Purpose

Serve the admin-curated gym directory (branch-level rows), gym detail pages, gym search/filter, and the "request a gym" submission form.

---

## Context

Indoor bouldering has grown fast in Taiwan, but climbers have no dedicated app with real local gym coverage. Send It's wedge is an admin-curated, branch-level gym directory seeded with Taipei and New Taipei gyms on day one — so the app has real coverage without waiting on official gym partnerships. Gyms are admin-maintained (read-only for regular users) and are the foundation that MOD-003 (Route Catalog) and MOD-001 (home gym selection) depend on. For Phase 1, the seed covers 13 branches across Taipei and New Taipei; top-rope-only gyms (Camp4 達文西攀岩館 and Wusa 攀岩館) are explicitly excluded. Mixed gyms are included, but only their bouldering areas are represented in-app. Every gym must have a verified address and map pin before Phase 1 GA. Climbers whose gyms are not in the directory can submit a "request a gym" form (US-013); these requests are queued for admin review in Supabase Studio and are not auto-added.

**Non-goals for this module:**
- User-created gyms (Phase 1 — admin-curated only; missing gyms captured via request form).
- Cities other than Taipei and New Taipei (Phase 2+ backlog).
- Official gym partnerships and gym-facing dashboards (Phase 3).
- In-app admin tooling for gym CRUD (Supabase Studio only).

---

## User Stories Covered

- **US-001**: Sign up and set home gym (home gym selection reads from this directory)
- **US-006**: Browse currently active routes at a gym (gym detail page is the entry point)
- **US-013**: Request a missing gym

---

## Acceptance Criteria Covered

**AC-004**: The system shall render the Taipei/New Taipei branch-level gym directory with every gym showing name, city/district, address, map pin, gym type, and (if present) photo when a user opens the Gyms tab.

**AC-070**: The system shall accept a "request a gym" submission containing gym name, city, and optional Google Maps link, persist it to a queue readable by admins in Supabase Studio, and show the user a confirmation state when the submission succeeds.

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
```

All tables guarded by Supabase Row-Level Security policies. `Gym` rows are readable by all authenticated users and writable only by admins. `GymRequest` rows are insertable by authenticated users and readable by admins only.

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

---

## Key Implementation Notes

- One row per branch for multi-branch gyms (e.g., T-UP 原岩 has 5 branch rows: 萬華, 南港, 新店, 中和, 明德; CORNER has 2 branch rows: 中山, 華山).
- Every gym in the Phase 1 seed must have a verified address and map pin before Phase 1 go-live; addresses marked "verify branch address" in the PRD seed table must be confirmed against Google Maps immediately before launch.
- Phase 1 seed covers 13 branches (see PRD §11). Top-rope-only gyms Camp4 達文西攀岩館 and Wusa 攀岩館 must not be seeded.
- Mixed gyms (e.g., double8 岩究所, 永和攀岩場) are included; only their bouldering areas are represented in-app.
- `Gym` table is readable by all authenticated users (RLS); write access is admin-only via Supabase Studio.
- `GymRequest` insert is allowed by authenticated users (RLS); the request queue is visible to admins in Supabase Studio. Admin review and status update (`pending → added | rejected`) happens in Studio, not in-app.
- All gym CRUD happens via Supabase Studio in Phase 1 — no in-app admin UI.

---

## Out of Scope for This Module

- User-created gyms (Phase 1 — request form only, no auto-add).
- Cities outside Taipei and New Taipei (Phase 2+ backlog).
- Official gym partnerships, gym claim flows, and gym-facing dashboards (Phase 3).
- In-app admin tooling for gym management (Supabase Studio only).
- Route data (owned by MOD-003).

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
