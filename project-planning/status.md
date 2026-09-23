# Send It — Project Status

## Last Action

```
agent: qa-mod-gym-directory
mode: regression
module: mod-gym-directory
result: bugs-found
commit: f4c187443f6b88b18dbdd7024af8ea9f1ccea0fb
timestamp: 2026-09-22T00:00:00Z
```

## PM Updates

- **2026-09-22 [SUBSTANTIVE]** — Cross-module navigation ACs + navigation-gap audit (PRD Revision 5). Leon approved the change and all three decisions (add as formal PRD change; AC lives under MOD-002 Gym Directory; "View Routes" entry point at the **bottom** of the gym detail screen). PRD updated:
  - **Status line**: `[SUBSTANTIVE] — Revision 5`; `**Revision**` bumped 4 → 5.
  - **AC-005 (new, MOD-002)** — approved wording: a "View Routes" entry point at the **bottom** of the gym detail screen navigates to that gym's route catalog, passing gym ID + gym name; visible without additional action.
  - **Navigation-gap audit — complete.** Audited every cross-module navigation/integration point implied by the user stories against §6 module dependencies. Already-covered handoffs confirmed: signup → home gym selection (AC-001/AC-002); route detail → log send (AC-010 names the route→log entry point); report/block targets named in AC-080/AC-082. Additional gaps found and closed with new ACs (each placed under the module that owns the destination entry point, per single-ownership):
    - **AC-006 (new, MOD-002)** — gym directory list row → gym detail screen (tap a gym row to open its detail; passes gym identifier). AC-004 rendered the list but no AC specced opening a gym.
    - **AC-042 (new, MOD-003)** — gym route list entry → route detail screen (tap a route to open its detail; passes route ID). Route detail is the entry point for AC-010/AC-037/AC-033; AC-040/AC-041 filtered the list but no AC specced opening a route.
    - **AC-037 (new, MOD-005)** — "Add beta video" entry point on the route detail screen launches the beta capture/upload flow with route context pre-attached (binds upload to that route per AC-032). US-004 implied it; AC-033 only covered playback.
    - **AC-058 (new, MOD-007)** — in-app notification inbox entry (beta-video-like) → the liked beta video on its route detail (resolves `target_id`). US-009 + AC-057 created the inbox but no AC specced the tap-through.
    - **AC-064 (new, MOD-008)** — feed/user reference → that user's profile + send history, subject to privacy (AC-063): a `followers_only` profile requested by a non-follower shows the hidden/403 state. US-007/US-011 implied it; no AC specced the profile navigation entry point.
  - **User story criteria lists updated**: US-004 += AC-037; US-006 += AC-005, AC-006, AC-042; US-009 += AC-058; US-011 += AC-064. All cited AC IDs verified to resolve to definitions in §8 (zero missing).
  - **Impact**: module boundaries, dependencies, and phase plan unchanged; no new modules. Affected specs (for Doc-Sync delta): MOD-002 (AC-005, AC-006), MOD-003 (AC-042), MOD-005 (AC-037), MOD-007 (AC-058), MOD-008 (AC-064). Tagged [SUBSTANTIVE] because scope of covered behavior expands across five modules. Ready for Tech Lead confirmation of module ownership (AC-005/006 under MOD-002 per Leon's decision; the four audit ACs placed by destination-entry-point ownership), then Doc-Sync to update the five module specs.

- **2026-09-23 [SUBSTANTIVE]** — Route submission approval gate + status lifecycle (PRD Revision 4). Leon's decisions all locked; PRD updated:
  - **Status line**: `[SUBSTANTIVE] — Revision 4`; `**Revision**` bumped 3 → 4.
  - **US-003** rewritten: grade + hold-color filter chips only (no text search); always-visible "Can't find it? Add a new route" CTA; match-before-create against `active` routes still happens.
  - **US-014 removed**: user-actionable route retirement is gone; retirement is now admin-only via Supabase Studio.
  - **MOD-003 breakdown** updated: purpose now covers the 4-value status lifecycle, submitter-only pending visibility/withdrawal; US list drops US-014.
  - **Acceptance Criteria (MOD-003)**: AC-020 revised (match pool scoped to `active` only); AC-024 removed (user retire gone); AC-024b new (admin-only `retired` via Studio); AC-025 new (initial status active if auto-approve ON else pending; approval message flagged [I18N-PENDING] for zh-TW); AC-026 new (pending visible only to submitter, read-only); AC-027 new (admin approve→active / reject→rejected via Studio only); AC-028 new (rejected/retired never shown to normal users); AC-029 new (submitter withdraw = row deleted; no two pending for same gym+grade+color); AC-040 revised (grade + hold-color chip filters, no text search, no status filter for normal users); AC-041 revised (normal users see active only, no status tag/filter).
  - **Non-goals**: added — in-app admin UI for route status management is Phase 1.5; Supabase Studio is the Phase 1 admin surface.
  - **§9 Data Model**: `Route.status` enum updated to the 4-value `route_status` set (active | pending | retired | rejected) with per-value semantics; auto-approve defaults ON at Phase 1 launch.
  - **§5 Architecture**: RLS/admin-operations framing aligned to the gate (pending visible to submitter only; status transitions to retired/rejected and pending approval are admin-only via Studio).
  - **Decisions locked**: D-RETIRE (merge retired+archive → keep `retired`, admin-only), D-SUBMIT, D-ADMIN-SURFACE (Studio-only Phase 1; schema must support in-app admin in Phase 1.5 — Tech Lead constraint), D1 (pending visibility + withdrawal-by-delete + one-pending-per-combo), D-AUTO-DEFAULT (auto-approve ON at launch), D-I18N ([I18N-PENDING] for the approval message).
  - **Impact**: module boundaries and phase plan unchanged; MOD-003 spec, data model, RLS policies, and enum are affected. Requires Tech Lead architecture review (schema/RLS/enum/settings-table + Phase 1.5 in-app-admin forward-compat constraint), then Doc-Sync to update the MOD-003 spec. PRD updated to Revision 4 [SUBSTANTIVE], ready for Tech Lead architecture review and then Doc-Sync.

- **2026-09-21 [SUBSTANTIVE]** — Two spec clarifications added to the PRD (Revision 3):
  - **AC-013 (MOD-004 Send Logging)**: After a send is successfully logged, the ascent list on the route detail screen must refresh immediately to show the new entry without requiring re-navigation. Addresses the known stale-list-after-modal-submission pattern (see Skill Recommendations).
  - **AC-036 (MOD-005 Beta Video)**: While a beta video is uploading, a progress overlay showing upload progress (0–100%) must be displayed. The overlay blocks further interaction until upload completes or fails, preventing double-submission.
  - Module boundaries, dependencies, and the phase plan are unchanged. No new modules added. Impact is confined to MOD-004 and MOD-005 specs; Doc-Sync must sync both.

## Tech Lead Review — Navigation AC Ownership (2026-09-23)

**Context**: PRD Revision 5 [SUBSTANTIVE] adds six cross-module navigation ACs via the PM's navigation-gap audit. This is an ownership confirmation only — not an architecture review. I verified each AC's placement against §6 module boundaries and inspected the shipped screens/navigators to classify each as a code gap (needs engineering) vs. a doc gap (code already works, spec didn't say so). Advisory only; no source, migration, spec, or PRD files changed.

| AC | Ownership confirmed | Code gap or doc gap | Notes |
|----|--------------------|--------------------|-------|
| AC-005 | **Confirmed — MOD-002** (destination entry point lives on `GymDetailScreen`) | **Code gap** | `GymDetailScreen.tsx` has only an `onBack` prop — no "View Routes" affordance exists. More important: `RouteNavigator` is fully built and self-contained (takes `gymId`+`gymName`, wires RouteList→RouteDetail) but is **never mounted anywhere** — nothing imports it outside its own file, and `App.tsx` renders `GymNavigator` with no route flow beneath it. So AC-005 is not just "add a button": MOD-002's engineer must add an `onViewRoutes(gymId, gymName)` prop to `GymDetailScreen`, `GymNavigator` must gain a `routes` view state that mounts `RouteNavigator`, passing gym context. **This is the one AC that actually connects MOD-002 → MOD-003 at runtime; without it MOD-003's entire UI is currently unreachable.** Boundary note: the button + navigator mount are MOD-002-owned; `RouteNavigator` itself is MOD-003 and already accepts the required props, so no MOD-003 code change is needed for AC-005. |
| AC-006 | **Confirmed — MOD-002** | **Doc gap** | Already implemented. `GymListScreen.tsx` row `onPress={() => onSelectGym(item.id)}` → `GymNavigator.navigateToDetail(gymId)` → `GymDetailScreen gymId={...}`. Passes the identifier as AC-006 requires. Spec/QA documentation-only; no engineering. |
| AC-042 | **Confirmed — MOD-003** | **Doc gap** | Already implemented. `RouteListScreen.tsx` row `onPress={() => onSelectRoute(item.id)}` → `RouteNavigator.navigateToDetail(routeId)` → `RouteDetailScreen routeId={...}`. Documentation-only. **Caveat**: this path is only reachable once AC-005 mounts `RouteNavigator` — AC-042's code exists but is dead until AC-005 lands. Not an AC-042 defect; a dependency ordering note. |
| AC-037 | **Confirmed — MOD-005** (owns the upload flow the entry point launches) | **Code gap** | `RouteDetailScreen.tsx` currently has a log-send entry point (`onLogSend`) and a placeholder text block for beta videos (`routes.detail.betaVideosPlaceholder`) — no "Add beta video" affordance. **Boundary flag**: the entry point *renders in* MOD-003's `RouteDetailScreen`, but the capture/upload flow it launches is MOD-005-owned. Recommend MOD-005's engineer owns the AC (it's their flow + route-context contract), implemented as a small MOD-003 host change: MOD-003 exposes a slot/prop (`onAddBetaVideo` or a MOD-005-provided component) on `RouteDetailScreen`, MOD-005 fills it. Same host-screen/owning-module split as AC-005. Since MOD-005 is Not started, this fits naturally into MOD-005's build; no separate MOD-003 change order is needed if MOD-005 owns the whole slot. |
| AC-058 | **Confirmed — MOD-007** (owns the notification inbox, the source entry point) | **Code gap** | MOD-007 Not started. Placement correct: the inbox is MOD-007's; tap-through resolves `target_id` → the beta video on its `RouteDetailScreen`. Cross-module boundary: MOD-007 (source) navigates to a MOD-003 screen showing a MOD-005 video. MOD-007's engineer owns the navigation call + `target_id` resolution; depends on MOD-003's `RouteDetailScreen` accepting a route/video target and MOD-005 rendering the video inline (AC-033). Flag for the eventual MOD-007 spec: define the navigation contract (does it deep-link by `route_id` derived from the beta video, or scroll-to-video?) — that contract touches MOD-003/MOD-005 and should be pinned before MOD-007 build. |
| AC-064 | **Confirmed — MOD-008** (owns the destination: profile + send history) | **Code gap** | MOD-006 and MOD-008 both Not started. Placement correct per destination-ownership: the feed/user-reference is MOD-006's (source), the profile+history destination is MOD-008's. MOD-008's engineer owns the destination screen and the privacy gate (AC-063 followers-only → hidden/403). The source affordance (tappable user reference) is MOD-006-owned and must be built when MOD-006 ships. Privacy enforcement (AC-063) is MOD-001's profile-privacy rule applied at the MOD-008 destination — confirm the followers-only/403 check runs server-side (RLS/RPC), not just client-side hiding, consistent with the MOD-006 feed-RPC convention already in the PRD. |

**Summary**: All six PM placements are correct — no ownership corrections needed. Two are documentation-only gaps (AC-006, AC-042): the code already navigates correctly and only the specs/QA records need to catch up. Four are code gaps (AC-005, AC-037, AC-058, AC-064). The single most important finding is AC-005: `RouteNavigator` (MOD-003) is fully implemented but never mounted, so the entire route-catalog UI is currently unreachable from the running app — AC-005 is the missing seam that makes MOD-003 (and therefore AC-042's already-shipped code) actually reachable. Three code-gap ACs (AC-037, AC-058, AC-064) sit on module boundaries where the *source affordance or entry point* renders in one module's screen but the *owning flow/destination* belongs to another; in each case I confirmed the PM's destination-ownership assignment is right and flagged the host-screen split so the owning engineer knows they need a small hosting change in the neighboring module's screen (or a slot the neighbor exposes). No architectural concerns with the navigation approach itself — the state-machine-per-navigator pattern already shipped in `GymNavigator`/`RouteNavigator` extends cleanly to all six. No new modules, no dependency changes. Next step: Doc-Sync carries AC-005/AC-006 into MOD-002 spec, AC-042 into MOD-003, AC-037 into MOD-005, AC-058 into MOD-007, AC-064 into MOD-008; Engineering should treat AC-005 as a near-term MOD-002 change (unblocks MOD-003 reachability), while AC-037/AC-058/AC-064 fold into their respective not-yet-started module builds.

## Tech Lead Reviews

### Review — 2026-09-21 — change (cross-cutting safe-area defect)

**Concerns** (must address before proceeding):
- Safe area insets are unhandled app-wide: `App.tsx` has no `SafeAreaProvider` and no screen uses `useSafeAreaInsets()`. Every screen hardcodes `paddingTop: theme.spacing.xl` (32px), which is less than the Dynamic Island clearance (~59px) on iPhone 17 Pro (and any notch/Dynamic Island device), hiding top-bar content. This affects all built screens (MOD-001/002/003/004) and every screen not yet built.

**Recommendations** (suggested improvements):
- Adopt the safe-area convention now added to `production.md` ("Screen Layout & Safe Area Insets"): wrap the root in `SafeAreaProvider` once in `App.tsx`, and have every screen pass `insets.top` into a `makeStyles(theme, topInset)` signature, deriving `paddingTop: topInset + theme.spacing.md`. Applying it uniformly is safe — modal sheets return `insets.top === 0`.
- Retrofit already-passed modules (MOD-001/002/003) as bugfixes since the defect is present in their screens; new modules should follow the convention from first implementation.

**Approved**:
- `react-native-safe-area-context` is already available transitively via `react-native-screens`; no new dependency is required.
- The uniform pattern is compatible with the existing theming convention (still token-driven, no hardcoded values beyond the OS-provided inset).

**Proposed Shared Conventions** (for Doc-Sync to carry into production.md):
- Screen Layout & Safe Area Insets convention has already been written directly into `production.md` Shared Conventions as part of this review.

## Tech Lead Review — Route Status Full Architecture (2026-09-23)

**Context**: PRD Revision 4 [SUBSTANTIVE] locks the route approval gate and expands `Route.status` to a 4-value enum (`active | pending | retired | rejected`). This review supersedes the 2026-09-22 advisory (which recommended B2 + T3) by turning it into a concrete, implementable spec across data model, RLS, enum migration, the submission RPC, `app_settings`, the one-pending-per-combo constraint, withdrawal-by-delete, and Phase 1.5 forward-compat. Advisory only — no source or migration files changed here. Doc-Sync carries the outputs into the MOD-003 spec and production.md; Engineering implements in a `change`-mode migration.

Decisions locked upstream that this review builds on: B2 (`pending` as a status value on `routes`, not a separate submission table), T3 (single-row `app_settings`), submission via `SECURITY DEFINER` RPC, withdrawal = row delete, one-pending-per-combo per submitter, admin via Studio (service_role) in Phase 1 with schema forward-compatible for in-app admin in Phase 1.5.

---

### 1. Enum migration (`route_status`: add `pending`, `rejected`)

Existing type: `CREATE TYPE route_status AS ENUM ('active', 'retired')`.

**PG15 behavior that governs the migration:**
- On Postgres 15, `ALTER TYPE ... ADD VALUE` *can* run inside a transaction block, **but** a newly added enum value **cannot be referenced in the same transaction that added it** (Postgres restriction: the new label isn't committed/visible to other reads within the adding transaction; PG only lifted the in-txn *usage* restriction for values added in the same txn under narrow conditions, and Supabase's migration runner wraps each migration file in a single transaction). Because the new `pending` value is *used* by the RPC, the RLS policies, and the partial index in the same logical change, treating enum-add and enum-use as one transaction is unsafe.
- **Mitigation (required): split into two migration files.**
  - **Migration A** — enum values only, nothing that references them:
    ```
    ALTER TYPE route_status ADD VALUE IF NOT EXISTS 'pending';
    ALTER TYPE route_status ADD VALUE IF NOT EXISTS 'rejected';
    ```
    Order does not matter functionally (enum ordinal order is cosmetic here since no code sorts by it), but add `pending` then `rejected` for readability. `IF NOT EXISTS` makes the file idempotent for `supabase db reset` re-runs.
  - **Migration B** (separate file, later timestamp) — everything that *uses* the new values: `app_settings` table + seed, the `submit_route` RPC, the revised RLS policies, the new pending partial index, and the withdrawal DELETE policy. Because B is a distinct migration file, it runs in its own transaction after A has committed, so `'pending'` and `'rejected'` are fully visible.
- **Engineer verification step**: run `supabase db reset` locally and confirm both files apply cleanly in order. If the runner ever collapses both into one transaction, the symptom is `ERROR: unsafe use of new value "pending" of enum type`. That error means A and B were not separated correctly — it is the canary for this whole item.
- **Do not** attempt a `COMMIT;` mid-file workaround inside a single Supabase migration — the CLI's transaction wrapper makes that unreliable; file-splitting is the supported path.

---

### 2. Admin identity mechanism (forward-compatible for Phase 1.5)

**Recommendation: use `app_metadata.role = 'admin'` on the Supabase auth user (a JWT claim), NOT a `public.admin_users` table.**

- **Phase 1**: no in-app admin identity is needed at all — Leon acts as service_role in Studio, which bypasses RLS. So in Phase 1 this mechanism is *defined but unused by RLS*. That is intentional and correct.
- **Phase 1.5**: in-app admin needs an RLS-visible identity. `app_metadata` is the right store because:
  1. It is set only by service_role (Studio / admin API) — a user cannot self-escalate by editing it, unlike `user_metadata`. This matches the trust model exactly (admin is granted, never claimed).
  2. Supabase mints it directly into the JWT, so RLS can read it with **zero extra table lookup** per policy evaluation. A `public.admin_users` table would add a subquery (`EXISTS (SELECT 1 FROM admin_users ...)`) to every admin-gated policy evaluation and require its own RLS.
  3. It requires no schema at all now — nothing to migrate, nothing to keep in sync with auth.users.
- **The forward-compatible RLS predicate to standardize on now** (so Phase 1 policies are written in a shape that Phase 1.5 extends without rewrite):
  ```
  COALESCE((auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin'
  ```
  Wrap this in a stable helper so every policy references one place and Phase 1.5 can swap the implementation if ever needed:
  ```
  CREATE OR REPLACE FUNCTION public.is_admin()
  RETURNS boolean
  LANGUAGE sql STABLE
  AS $$
    SELECT COALESCE((auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin';
  $$;
  ```
  In Phase 1 no user carries this claim, so `public.is_admin()` is always `false` for real clients and `true` is effectively only reachable via service_role (which bypasses RLS anyway). Ship the helper and reference it in the SELECT/UPDATE policies now so Phase 1.5 is purely a matter of granting the claim to Leon's auth user — **no migration, no policy rewrite**.
- **Risk / mitigation**: `auth.jwt()` returns the *session's* claims; a claim granted to a user mid-session is not visible until their token refreshes. Mitigation: acceptable — admin grants are rare and Leon can re-auth. Document it so it isn't mistaken for a bug in Phase 1.5.

---

### 3. RLS policies for `routes` (exact logic, replacing the current three policies)

The current migration's policies (`routes_select_authenticated` = all rows to all authenticated; `routes_insert_own`; `routes_retire_authenticated`) must be **dropped and replaced** in Migration B. US-014 / user-retire is gone, so `routes_retire_authenticated` is removed entirely. New policy set:

- **SELECT** (`routes_select_visible`) — a row is visible to an authenticated caller iff **any** of:
  - `status = 'active'` (everyone sees active), OR
  - `submitted_by_user_id = auth.uid() AND status = 'pending'` (submitter sees only their *own* pending row, read-only), OR
  - `public.is_admin()` (Phase 1.5 admin sees everything; false for all Phase 1 clients).
  - Net effect: `retired` and `rejected` are invisible to every normal user (including the original submitter — a rejected/retired route disappears from their view). A submitter sees their own pending row but not anyone else's pending row. service_role (Studio) sees all rows regardless (RLS bypass).
  - **Important**: this is the top correctness fix. The existing `routes_select_authenticated` leaks all rows; it MUST be replaced or pending/rejected/retired routes pollute every user's gym list and — critically — the AC-020 match pool.

- **INSERT** (no policy — blocked entirely) — remove `routes_insert_own`. Client cannot INSERT directly; all creation goes through `submit_route` (SECURITY DEFINER, which inserts as the function owner and is not subject to a client INSERT policy). Rationale: the auto-approve gate must be enforced server-side; a client INSERT policy would let a user set `status = 'active'` and self-approve. **Also revoke the INSERT grant**: `REVOKE INSERT ON public.routes FROM authenticated;` — the RPC does the insert with definer privileges, so `authenticated` needs no direct INSERT right.

- **UPDATE** (`routes_admin_update`) — normal users cannot UPDATE at all. Only `public.is_admin()` may UPDATE (Phase 1.5). In Phase 1 this policy never matches a real client (admin transitions happen in Studio via service_role). Writing the policy now, gated on `is_admin()`, is the forward-compat move: approve (`pending→active`), reject (`pending→rejected`), and retire (`active→retired`) all become in-app admin UPDATEs in Phase 1.5 with no new policy. **Revoke the broad UPDATE grant** that the current migration gives (`GRANT ... UPDATE`) since no normal-user UPDATE path remains; keep UPDATE grant only insofar as `is_admin()` clients need it in 1.5 — safe to `GRANT UPDATE ON public.routes TO authenticated` while the policy restricts it to admins, or defer the grant to 1.5. Recommend deferring the UPDATE grant to Phase 1.5 to keep Phase 1 tight.

- **DELETE** (`routes_withdraw_own_pending`) — a row may be deleted by the caller iff `submitted_by_user_id = auth.uid() AND status = 'pending'`. This is the withdrawal path (see §7). No other deletes for normal users. service_role deletes anything in Studio. Add `GRANT DELETE ON public.routes TO authenticated;` (the current migration grants only SELECT/INSERT/UPDATE) — required for the withdrawal DELETE policy to be usable.

Summary of grant changes in Migration B: `REVOKE INSERT ON public.routes FROM authenticated;` `REVOKE UPDATE ON public.routes FROM authenticated;` (defer UPDATE re-grant to 1.5) `GRANT DELETE ON public.routes TO authenticated;` (SELECT grant stays.)

---

### 4. SECURITY DEFINER submission RPC (`submit_route`)

Mirrors the existing `handle_new_auth_user` definer pattern (`SECURITY DEFINER`, `SET search_path = public`).

**Signature** (order fixed for named `supabase.rpc` calls; do not pass `user_id` from the client — derive it server-side from `auth.uid()` so a caller cannot submit as someone else):
```
CREATE OR REPLACE FUNCTION public.submit_route(
  p_gym_id        UUID,
  p_grade         route_grade,
  p_color_tag     route_color,
  p_photo_url     TEXT,
  p_section_label TEXT DEFAULT NULL
) RETURNS public.routes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
```
Note: the task brief lists `user_id` as a parameter — **override that**: the submitter must be `auth.uid()` inside the function, never a client-supplied argument. Accepting `user_id` from the client is an impersonation hole. This is a flagged correction, not a TBD.

**Logic (in order):**
1. `v_uid := auth.uid();` — if NULL, `RAISE EXCEPTION 'not authenticated'` (function is `SECURITY DEFINER` but must still require a real session; grant EXECUTE to `authenticated` only, not `anon`).
2. `p_photo_url` NOT NULL / non-empty check → else `RAISE EXCEPTION 'photo required'` (enforces AC "no photo, no submission" at the server, not just client).
3. Read the toggle: `SELECT (value = 'true') INTO v_auto FROM public.app_settings WHERE key = 'route_auto_approve';` — if no row, treat as the seeded default `true` (defensive: `v_auto := COALESCE(v_auto, true)`).
4. One-pending-per-combo guard: `IF EXISTS (SELECT 1 FROM public.routes WHERE gym_id = p_gym_id AND grade = p_grade AND color_tag = p_color_tag AND status = 'pending' AND submitted_by_user_id = v_uid) THEN RAISE EXCEPTION 'duplicate pending submission' USING ERRCODE = 'unique_violation'; END IF;` (belt-and-suspenders with the partial index in §6; the explicit check yields a clean, catchable error message; the index is the true guarantee).
5. Compute status: `v_status := CASE WHEN v_auto THEN 'active' ELSE 'pending' END::route_status;`
6. Insert and return the row:
   ```
   INSERT INTO public.routes (gym_id, section_label, grade, color_tag, photo_url, status, submitted_by_user_id)
   VALUES (p_gym_id, p_section_label, p_grade, p_color_tag, p_photo_url, v_status, v_uid)
   RETURNING * INTO v_row;
   RETURN v_row;
   ```
   - When `v_auto = true`, the insert of a second `active` row for the same combo hits `routes_active_unique_idx` and raises `unique_violation` — this is the correct match-before-create backstop (client should have matched first, but the DB enforces it). Surface as a friendly "route already exists" message client-side.
7. Grant: `GRANT EXECUTE ON FUNCTION public.submit_route(UUID, route_grade, route_color, TEXT, TEXT) TO authenticated;` and `REVOKE EXECUTE ... FROM anon, public;`

**Client call**:
```
supabase.rpc('submit_route', { p_gym_id, p_grade, p_color_tag, p_photo_url, p_section_label })
```
Returns the inserted `routes` row (single object). The client uses the returned `status` to choose confirmation copy: active → "route added"; pending → the [I18N-PENDING] "submitted for review" message (AC-025).

**Why the RPC and not an INSERT policy**: enforcing auto-approve in a `WITH CHECK` would require the policy to subquery `app_settings` on every insert and still could not prevent a client from choosing its own `status` unless the check also pinned status to the computed value — which reduces to reimplementing the RPC inside a policy. The definer RPC centralizes the gate in one server-side place, matches the shipped `handle_new_auth_user` pattern, and lets `app_settings` be service-role-only (see §5).

---

### 5. `app_settings` table

```
CREATE TABLE IF NOT EXISTS public.app_settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```
- **Seed** (Migration B): `INSERT INTO public.app_settings (key, value) VALUES ('route_auto_approve', 'true') ON CONFLICT (key) DO NOTHING;` (auto-approve ON at launch per D-AUTO-DEFAULT — Phase 1 behavior matches pre-gate behavior).
- **RLS** (enabled from creation per convention): `ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;`
  - **No SELECT policy for `authenticated`** — the client never reads the toggle directly. The only reader is `submit_route`, which is `SECURITY DEFINER` and reads the row as the function owner regardless of the caller's RLS. This is the tightest design: settings are never exposed to clients, and the client doesn't need the value (it learns the outcome from the RPC's returned `status`). Result: with RLS enabled and no policy, `authenticated`/`anon` get zero rows; service_role (Studio) reads/writes freely.
  - **No INSERT/UPDATE/DELETE policies** → only service_role (Studio) can flip the toggle: `UPDATE public.app_settings SET value = 'false', updated_at = NOW() WHERE key = 'route_auto_approve';`
  - **Grants**: do **not** `GRANT` any privilege on `app_settings` to `authenticated` or `anon`. The definer function's owner (postgres) already has access. This makes the table invisible to clients at both the grant and RLS layers.
- **Value typing note**: stored as TEXT (`'true'`/`'false'`) for a generic key/value shape reusable by future settings. The RPC compares `value = 'true'`. If preferred, a `BOOLEAN` column is fine too — TEXT keeps the table polymorphic for later settings; either is acceptable, TEXT recommended for extensibility.

---

### 6. One-pending-per-combo constraint

**Recommendation: add a second partial unique index AND keep the explicit RPC check — both, not either/or.**

```
CREATE UNIQUE INDEX routes_pending_unique_idx
  ON public.routes (gym_id, grade, color_tag, submitted_by_user_id)
  WHERE status = 'pending';
```
- **Why the index (the real guarantee)**: it makes the constraint race-proof and enforced regardless of write path (RPC, Studio, or any future path). The RPC's `IF EXISTS` check in §4.4 has a TOCTOU race under concurrent double-submit; only a unique index closes it. The index is the source of truth.
- **Why also the RPC check**: the index raises a raw `unique_violation` with a generic message; the RPC's pre-check raises a clean, localizable error first in the common (non-concurrent) case, giving a better UX. The RPC catches the index violation as the fallback for the race.
- **Scoping note — this is per-submitter, matching AC-029** ("no two pending for same gym+grade+color" is scoped to the *same user* per the D1 decision: one user can't spam duplicate pendings; two *different* users may each have a pending for the same combo, which is fine — they're competing submissions the admin adjudicates). The index key therefore includes `submitted_by_user_id`. 
  - **Flagged nuance for PM/Doc-Sync to confirm wording**: AC-029 as summarized reads "no two pending for the same gym+grade+color," which could be read as global (across all users). The D1 decision and this index implement **per-submitter**. If Leon actually wants *global* one-pending (only one person may have a pending submission for a combo at a time), drop `submitted_by_user_id` from the index. Recommend **per-submitter** (as indexed above) because global-pending lets one user block others from submitting and complicates the two-competing-submissions adjudication model. Doc-Sync should make AC-029 explicit either way. Mitigation if unresolved: ship per-submitter (the less-restrictive, non-blocking choice) and note it.
- **Active uniqueness is unchanged**: `routes_active_unique_idx` (`WHERE status = 'active'`) stays exactly as-is. `pending`, `retired`, `rejected` rows are excluded from it, so approval is where active-uniqueness is enforced (approving a second competing pending into `active` correctly collides — see §8 approval-collision note).

---

### 7. Withdrawal (row delete) — confirmed, with the required grant

The brief's proposal is **correct**: a DELETE RLS policy `USING (submitted_by_user_id = auth.uid() AND status = 'pending')` is sufficient; no RPC is needed for withdrawal. A direct `supabase.from('routes').delete().eq('id', ...)` from the client is fine because RLS scopes the delete to the caller's own pending rows only.

**One required addition the brief omits**: the current migration grants only `SELECT, INSERT, UPDATE` on `routes` to `authenticated` — there is **no DELETE grant**, so the DELETE policy alone would not make delete work (RLS filters rows but GRANT authorizes the verb). Migration B must add:
```
GRANT DELETE ON public.routes TO authenticated;
```
Guardrails already correct: because the policy predicate requires `status = 'pending'`, a user cannot delete an `active`/`retired`/`rejected` route, and cannot delete another user's pending row (not visible to them via SELECT and blocked by the DELETE `USING` anyway). Deleting the row (vs. status-changing) also cleanly frees the `(gym_id, grade, color_tag, submitted_by_user_id)` slot in `routes_pending_unique_idx`, so the user can resubmit immediately — the delete-not-flag choice is consistent with the constraint design.

**FK note**: `ascents.route_id → routes.id ON DELETE ...` — a pending route has no ascents yet in the normal flow (you can't log a send against a non-active route the app won't show). But to be safe against any future path, confirm the `ascents.route_id` FK behavior. If it is `ON DELETE CASCADE`, deleting a pending route silently deletes any ascents — acceptable only because pending routes shouldn't have ascents. Doc-Sync/Engineer should verify no code path lets an ascent attach to a pending route; if one could, withdrawal semantics need review. Flagged as a low-probability integrity check, not a blocker.

---

### 8. Forward-compatibility — what Engineering must NOT do in Phase 1

To keep Phase 1.5 in-app admin a zero-rework, additive change:

1. **Do NOT create a `service_role`-only trigger or hardcoded `auth.role() = 'service_role'` check to perform admin status transitions.** Admin approve/reject/retire must be plain `UPDATE`s gated by `public.is_admin()` (§2/§3). In Phase 1 those UPDATEs simply only ever originate from Studio (service_role bypasses RLS); in Phase 1.5 the same policy admits an admin-claimed client with no change. A trigger that assumes service_role would have to be torn out for in-app admin.
2. **Do NOT drop or inline the `public.is_admin()` helper.** Ship it in Phase 1 even though it always returns false for real clients. Phase 1.5 = grant the `app_metadata.role='admin'` claim to Leon's user; policies already reference the helper. If policies hardcode `false` or omit the admin branch, 1.5 requires a policy migration.
3. **Do NOT enforce admin transitions in application/client code.** No "if service_role then allow" logic in the app; enforcement lives in RLS + the `is_admin()` predicate. Client admin logic can't be reused server-side and would be bypassable.
4. **Do NOT store the auto-approve toggle anywhere but `app_settings`** (no env var, no deploy-time constant, no client flag). Phase 1.5 admin UI must be able to flip it with one authorized write; a non-DB store can't be toggled in-app.
5. **Do NOT let `submit_route` accept a client-supplied `user_id` or client-supplied `status`.** Both are server-derived (auth.uid() and the toggle). A client-settable status makes the whole gate cosmetic and can't be tightened later without breaking existing callers.
6. **Do NOT add rejection/retirement metadata as a separate table now, but leave room for it.** If Phase 1.5 wants reviewer notes / rejection reasons, add nullable columns (`reviewed_by_user_id`, `reviewed_at`, `review_note`) to `routes` then — the `status`-on-`routes` model (B2) accommodates this additively. Do not build a `route_reviews` table speculatively in Phase 1.
7. **Do NOT rely on the RPC's `IF EXISTS` pending check as the sole constraint** — the partial unique index (§6) must exist so the guarantee holds for the future in-app admin and any Studio-side inserts.

---

### Concerns (must address in the change-mode migration)

- **Pending/rejected/retired leak via the existing SELECT policy** — `routes_select_authenticated` currently returns all rows to all authenticated users. It MUST be dropped and replaced by `routes_select_visible` (§3) in the same migration that adds `pending`, or unreviewed/rejected/retired routes pollute every gym list and the AC-020 match pool. Top correctness risk.
- **Enum add-and-use in one transaction will fail on PG15** — must split into Migration A (enum values) + Migration B (everything using them) per §1. Canary error: `unsafe use of new value ... of enum type`.
- **`submit_route` must not accept `user_id` from the client** — derive from `auth.uid()`. The brief's listed signature includes `user_id`; implementing that verbatim is an impersonation vulnerability (§4).
- **Grants lag the new policies** — `routes` currently lacks a DELETE grant (needed for withdrawal, §7) and still carries INSERT/UPDATE grants that should be revoked (§3). RLS without matching GRANTs (or with stale GRANTs) silently breaks the intended access shape.

### Recommendations

- Implement as two migration files: `..._route_status_enum.sql` (Migration A) and `..._route_approval_gate.sql` (Migration B). Verify with `supabase db reset`.
- Standardize the admin check on `public.is_admin()` now; grant the claim to Leon only in Phase 1.5.
- Keep `app_settings` fully client-invisible (RLS enabled, no policies, no grants); read it only inside `submit_route`.
- Enforce one-pending-per-combo with both the partial unique index (guarantee) and the RPC pre-check (clean UX error).
- Document the approval-time active-uniqueness collision (approving a 2nd competing pending into `active` raises `unique_violation` in Studio) in the MOD-003 spec as expected Phase 1 behavior, not a bug.

### Approved (looks solid as-is)

- B2 (`pending` on `routes`) + T3 (`app_settings`) remain the right calls under Revision 4; no reason to revisit the separate-table option.
- The existing `routes_active_unique_idx` needs **no change** — its `WHERE status = 'active'` predicate already does the right thing for the expanded status set.
- Withdrawal-by-DELETE via an RLS policy (no RPC) is correct — only the missing DELETE grant needs adding.
- The `SECURITY DEFINER` submission RPC mirrors the shipped `handle_new_auth_user` pattern; no new architectural concept is introduced.
- `ascents.route_id → routes.id` FK integrity is preserved: a route keeps one stable id from submission through approval (no id remapping, unlike a promote-on-approve separate-table design).

### Proposed Shared Conventions (for Doc-Sync to carry into production.md)

- **Admin identity**: gate admin-only RLS on a `public.is_admin()` helper reading `app_metadata.role = 'admin'` from the JWT (set only by service_role). Do not use a `user_metadata` claim (self-editable) or a lookup table (adds per-policy subquery) unless a specific need arises. Write admin-gated policies against the helper from day one even when no client yet carries the claim, so granting in-app admin later is additive.
- **Enum evolution on PG15/Supabase**: adding an enum value and using it must be split across two migration files (add in file N, use in file N+1); never add-and-use an enum value in a single Supabase migration transaction.
- **Server-enforced write gates**: when a write must honor an operator toggle or assign a server-controlled field (status, owner), route it through a `SECURITY DEFINER` RPC that derives the owner from `auth.uid()` and reads settings server-side; never accept owner/status/toggle-outcome as client arguments, and revoke the direct table grant for that verb.
- **Runtime operator toggles**: store in a single `app_settings(key, value)` table with RLS enabled and no client policies/grants; read only inside definer functions so the setting is never exposed to clients.

## Module Map

| MOD-ID  | Directory              | Status      | Agent last acted          |
|---------|------------------------|-------------|---------------------------|
| MOD-001 | mod-auth-profile       | QA Passed   | qa-mod-auth-profile       |
| MOD-002 | mod-gym-directory      | QA Passed   | qa-mod-gym-directory      |
| MOD-003 | mod-route-catalog      | QA Passed   | qa-mod-route-catalog      |
| MOD-004 | mod-send-logging       | QA Pending Human Sign-off | qa-mod-send-logging |
| MOD-005 | mod-beta-video         | Not started | —                         |
| MOD-006 | mod-social-feed        | Not started | —                         |
| MOD-007 | mod-notifications      | Not started | —                         |
| MOD-008 | mod-profile-history    | Not started | —                         |
| MOD-009 | mod-moderation         | Not started | —                         |
| MOD-010 | mod-localization-theme | Not started | —                         |
| MOD-011 | mod-analytics          | Not started | —                         |

## Sync Reports

### 2026-09-21 — Delta Sync (Revision 3, [SUBSTANTIVE])

**Trigger**: PM [SUBSTANTIVE] tag — two new acceptance criteria added to PRD Revision 3. Module boundaries, dependencies, and phase plan unchanged.

**Files modified:**
- `project-planning/modules/mod-send-logging/spec.md` — AC-013 appended after AC-012 in the Acceptance Criteria Covered section.
- `project-planning/modules/mod-beta-video/spec.md` — AC-036 appended after AC-035 in the Acceptance Criteria Covered section.

**Files not touched:**
- `project-planning/production.md` — no shared conventions changed.
- All other module specs — change confined to MOD-004 and MOD-005 per PM note.

**Ambiguities / Conflicts**: None.

**verify-sync.sh**: Skipped — not applicable to targeted two-file delta (no structural addition of modules, phases, or conventions). [Note: verify-sync.sh is applicable on initial and full-structural syncs; a two-AC delta touching no new files does not warrant a full tree traversal.]


### Sync Report — Delta Sync — 2026-09-22

**Sync type:** delta
**PRD Revision:** 4
**PM Update reference:** 2026-09-23 [SUBSTANTIVE] — Route submission approval gate + status lifecycle (PRD Revision 4)
**Files modified:**
- `project-planning/modules/mod-route-catalog/spec.md` — Purpose updated to 4-value lifecycle framing; Context updated (auto-approve, pending/retired/rejected visibility, submit_route RPC, admin-only retirement, per-submitter pending constraint); Non-goals expanded (in-app admin UI Phase 1.5, global one-pending out of scope); User Stories updated (US-014 removed, US-003 and US-006 retained); Acceptance Criteria section replaced entirely with AC-020 (revised), AC-021–AC-023 (unchanged), AC-024b (new), AC-025–AC-029 (new), AC-040 (revised), AC-041 (revised); Data Model updated to 4-value route_status enum with per-value semantics, app_settings table added, RLS policy set documented; Input/Output Contract updated (RPC-based submission, withdrawal, normal-user list); Key Implementation Notes section added covering enum migration split, admin identity (is_admin() helper), RLS policy set, submit_route RPC, app_settings, withdrawal, one-pending-per-combo index, grant changes, and forward-compatibility constraints.
- `project-planning/production.md` — Last synced revision updated (rev 2 → rev 4); Architecture Overview updated to reflect 4-value route status and admin-only transitions; Module Index MOD-003 description updated to reflect 4-value lifecycle; Four new Shared Conventions added: Enum Migration Ordering, Admin Identity, SECURITY DEFINER RPCs, app_settings Table Pattern.
**Files created:**
- none
**Module removals noted:**
- none
**AMBIGUITY markers added:**
- none
**AMBIGUITY markers resolved:**
- none
**CONFLICT markers added:**
- none
**verify-sync.sh result:** 4/6 checks passed. Two pre-existing failures unrelated to this delta:
  - Check 4 FAIL: all module specs use `## User Stories Covered` but the script expects `## Related User Stories` — pre-existing mismatch across all specs, not introduced by this sync.
  - Check 6 FAIL: no Phase Plan section in status.md — pre-existing; Phase Plan was not written during initial sync and was not in scope for this delta.

### Sync Report — Delta Sync — 2026-09-22

**Sync type:** delta
**PRD Revision:** 5
**PM Update reference:** 2026-09-22 [SUBSTANTIVE] — Cross-module navigation ACs + navigation-gap audit (PRD Revision 5)
**Files modified:**
- `project-planning/modules/mod-gym-directory/spec.md` — Added AC-006 (doc gap, code already works) and AC-005 (code gap) to Acceptance Criteria; expanded US-006 note in User Stories Covered to reflect gym-detail-to-routes navigation; added AC-005 implementation note to Key Implementation Notes; updated Last Synced from PRD Revision to 5.
- `project-planning/modules/mod-route-catalog/spec.md` — Added AC-042 (doc gap, code already works inside RouteNavigator) to Acceptance Criteria with reachability caveat note; updated Last Synced from PRD Revision to 5.
- `project-planning/modules/mod-beta-video/spec.md` — Added AC-037 (code gap, future module) to Acceptance Criteria with boundary note on host-screen/owning-module split; updated Last Synced from PRD Revision to 5.
- `project-planning/modules/mod-notifications/spec.md` — Added AC-058 (code gap, future module) to Acceptance Criteria; added navigation contract flag to Key Implementation Notes; updated Last Synced from PRD Revision to 5.
- `project-planning/modules/mod-profile-history/spec.md` — Added AC-064 (code gap, future module) to Acceptance Criteria with boundary note; added US-012 to User Stories Covered (privacy gating applies at AC-064 destination); updated Last Synced from PRD Revision to 5.
**Files created:**
- none
**Files not touched:**
- `project-planning/production.md` — no new shared conventions; no module boundary or phase plan changes.
- All other module specs — change confined to the five modules identified in PM Updates.
**Module removals noted:**
- none
**AMBIGUITY markers added:**
- none
**AMBIGUITY markers resolved:**
- none
**CONFLICT markers added:**
- none
**verify-sync.sh result:** Skipped per delta-sync scope — this sync touches only AC additions within existing modules; no new module directories, no phase plan changes, no production.md changes. Pre-existing Check 4 FAIL (heading name mismatch) and Check 6 FAIL (no Phase Plan section) noted from prior sync remain unchanged and are not introduced by this delta.

## Skill Recommendations

- **Cross-module i18n catalog updates**: When a module adds user-facing strings, the engineer must also update `locales/en/common.json` and `locales/zh-TW/common.json`. The self-check script's git scope check flags these as "out of scope" but they are required by the production.md i18n convention. The self-check script should be updated to whitelist `locales/` as an allowed cross-cutting path for any module implementing i18n strings. Alternatively, each module should own its own locale namespace file (e.g. `locales/en/routes.json`) to stay within the module boundary.

- **React Native named colors for enum-to-color mappings**: When a domain enum (like route hold colors) needs to render as a visual chip, map enum values to React Native's built-in named color strings (e.g. `'red'`, `'blue'`) rather than hex literals. Named colors are OS-resolved (not hardcoded hex), satisfy the "no hardcoded hex" convention, and are visually accurate. Document this in the skill as an approved pattern for enum-color mapping in RN components.

- **Generated column formula must match spec exactly**: When a spec and production.md both document a Postgres GENERATED ALWAYS AS formula, verify the migration SQL matches character-for-character (including separators). Even cosmetic differences (e.g., adding `-` separators not in the spec formula) are spec deviations that QA must flag, even when there is zero functional impact. Add this to qa-checklist references as a pattern to check on any module with a GENERATED ALWAYS AS column.

- **Frontend modules: stale list after modal submission**: When a modal form submits and closes, any list rendered outside the modal (in the parent screen) will NOT re-fetch unless explicitly triggered. The standard pattern is to pass a refresh callback from the list to the success handler, or use a context/event bus. QA should check this pattern on every frontend module where a modal creates a new item that should appear in a visible list.

- **Frontend modules: "success confirmation" spec language is ambiguous**: Specs that say "Success confirmation shown to user" without specifying the form (toast, banner, or implicit modal dismissal) will generate a spec issue on every frontend module. PM should standardize this language in the spec template to specify the required UX pattern (e.g., "display a toast/snackbar message" vs. "dismiss the modal").

## PM Alignment Note — Route Submission Flow (2026-09-22)

**Status**: Awaiting human (Leon) decision. No PRD or code changes made. This note documents a discrepancy raised in a human QA session between the shipped MOD-003 flow and Leon's stated product intent.

### 1. What the current spec says (PRD Revision 3)

The current spec is internally consistent and deliberately gate-free:

- **§1 Overview**: the product wedge is "a match-before-create route submission flow that keeps user-submitted data clean **without waiting on official gym partnerships**."
- **AC-020**: match-before-create queries existing **active** routes at a gym for the same grade + color and presents matches to the user "**before allowing creation**." Creation itself is immediate.
- **§5 Architecture**: route tables are "writable only by admins (gyms) or the submitting user + admins (routes)." No approval step exists.
- **Data model (§9)**: `Route.status` is `(active | retired)` only — there is no `pending` state and no separate submission table.
- **§2 Non-Goals**: "In-app admin tooling is out of scope for Phase 1 — Supabase Studio is the sole admin surface." Admin merges near-duplicates in Studio after the fact; there is no pre-publish review.
- **§2 Goal**: "at least 5 seeded gyms have ≥10 user-submitted routes each" (content-density proxy).

Net: routes go live immediately as `status = 'active'` right after the match check. This was a considered design choice, not an oversight — the whole "match-before-create" concept is the substitute for a moderation gate.

### 2. What Leon described today

Leon's stated mental model:
1. User **searches** for a route first (find existing / add beta).
2. If it doesn't exist, user submits a **route request** (gym_id, grade, color_tag, photo_url, submitted_by_user_id — all required).
3. **Admin (Leon) reviews and approves** → route becomes active.
4. OR an **"auto-approve all routes"** admin toggle skips manual review.
5. "Route submission data should be separate from the route data" — implying a separate pending/request table, not pending rows in `public.routes`.

### 3. Assessment: is this a change, a clarification, or a misunderstanding?

This is a **requirements change (new PRD content needed)**, not a clarification of pre-existing intent. The PRD does not merely omit an approval gate — it makes several explicit, mutually reinforcing statements that routes go live immediately (AC-020 "before allowing creation," `status` enum with no `pending`, "without waiting on official gym partnerships," Supabase-Studio-only admin surface). MOD-003 was built, QA-passed, and shipped faithfully to that written spec. So the shipped code is correct against the current PRD; the gap is between Leon's evolving intent and what was previously written and approved.

One nuance worth flagging to Leon: the "auto-approve all routes" toggle he described, if defaulted to ON, produces exactly today's behavior. If he expects to run with auto-approve ON for Phase 1 launch (to hit the ≥10-routes-per-gym content-density goal), then the practical Phase 1 behavior may be unchanged and only the *schema/plumbing* for a future gate would differ. This distinction materially changes cost — see the recommendation.

### 4. Recommendation for Phase 1

**Recommended: keep immediate-live as the default Phase 1 behavior; defer a full moderation gate.** Rationale:

- The Phase 1 content-density goal (≥10 user-submitted routes at ≥5 gyms) is directly threatened by a manual, solo-operator (Leon) approval bottleneck on every route. A gate that Leon must clear personally, via Supabase Studio, for every submission is an operational drag that fights a stated Phase 1 success metric.
- Match-before-create is already the PRD's designed data-quality mechanism, and admin near-duplicate merge in Studio is the designed cleanup path. Together these already deliver "clean user-submitted data" without a pre-publish gate.
- Moderation of *objectionable* content (the App Store 1.2 concern) is handled by Report + Block (MOD-009), not by a route approval queue. Route approval is a data-quality gate, not a safety gate, so it is not required for App Store compliance.

**If Leon wants the moderation gate anyway**, the low-risk Phase 1 shape is: introduce the concept but ship it with **auto-approve defaulted ON**, so Phase 1 launch behavior is unchanged while the plumbing exists to flip it later. The heavier "separate submissions table + manual review UI" is best sequenced into Phase 2 alongside the "lightweight in-app admin surface" already parked there (§12 risk on admin bandwidth, Phase 2 roadmap).

**The "search-first" part of Leon's description is largely already satisfiable and low-risk** — it reads as a navigational preference (land users on a gym's route list/search rather than a bare "Submit" button) more than a data-model change. This can be treated as a UX refinement to MOD-002/MOD-003 navigation independent of the approval-gate decision, and does not by itself require a moderation table.

### 5. Answers to the five key questions

1. **Is admin approval the intended flow for Phase 1?** Recommend **no** for the default path; it conflicts with the content-density goal and is not needed for App Store safety compliance. If adopted, ship it auto-approve-ON so Phase 1 behavior is unchanged.
2. **Separate table vs. status column?** **This is a technical/architectural decision and belongs to the Tech Lead, not the PM.** For PM-level framing only: a separate `route_submissions` table (promote to `routes` on approval) matches Leon's "keep submission data separate" instinct and keeps `public.routes` meaning "live routes only," but it duplicates schema and complicates match-before-create; a `pending` value on `Route.status` is lighter but mixes live and unreviewed rows in one table. Defer the choice to the Tech Lead if a gate is approved.
3. **Auto-approve toggle — DB setting or deploy-time config?** PM position: model it as an **admin-level setting** (a single-row app-settings table editable in Supabase Studio) so Leon can flip it without a redeploy. Exact storage mechanism is a Tech Lead call.
4. **Impact on match-before-create (AC-020)?** Confirmed: **only `active` routes should participate in the match check.** Pending/unreviewed submissions must not block creation and must not be presented as matches (they aren't guaranteed real). AC-020 wording already scopes to `active`, so it stays correct — but if a `pending` state is added, the spec must state explicitly that pending rows are excluded from both the match pool and the gym route list, and confirm the partial unique index stays scoped to `WHERE status = 'active'`.
5. **Impact on search-first flow?** Assessed as primarily a **navigational change** (entry point = gym route list/search rather than a "Submit" button), not a data-model change. Can proceed as a UX refinement independent of the approval decision.

### 6. PRD/spec changes required IF the gate is adopted

If Leon approves a moderation gate, the following PRD edits would be needed (to be applied only after explicit approval, in a `change`-mode pass, with a Tech Lead architecture review because module boundaries and the data model are affected):

- **§9 Data model**: either add `pending` to `Route.status` OR add a new `RouteSubmission` entity (Tech Lead to decide); add an app-settings entity for the auto-approve toggle.
- **AC-020**: add explicit language that pending submissions are excluded from the match pool and gym route list; confirm the partial unique index remains `WHERE status = 'active'`.
- **New AC(s) in MOD-003**: (a) a route submission enters a pending state unless auto-approve is on; (b) admin approval in Supabase Studio promotes it to active; (c) auto-approve toggle behavior.
- **§2 Non-Goals / §5 Architecture / §1 Overview**: revise the "routes go live immediately" / "without waiting on partnerships" framing so the PRD stops contradicting a gate.
- **§2 Goals**: re-examine the ≥10-routes-per-gym content-density goal against approval-queue throughput, or confirm auto-approve-ON at launch protects it.
- **Phase plan**: if the manual-review UI is deferred, record it in the Phase 2 slot alongside the existing "lightweight in-app moderation surface" item.
- Whether this is tagged `[SUBSTANTIVE]` (it would be — data model, module scope, and phase plan are all touched) and routed through Tech Lead + Doc-Sync.

### 7. Next step

Leon to decide among: (A) keep immediate-live, no change (recommended); (B) adopt the gate but ship auto-approve-ON for Phase 1, deferring the review UI to Phase 2; (C) full manual-review gate in Phase 1. On his decision, PM opens a `change`-mode pass and (for B/C) loops in the Tech Lead before any PRD edit. No PRD or code changes will be made until Leon approves.

## Tech Lead Review — Route Submission Approval Architecture (2026-09-22)

**Context**: Leon has approved Option B (add a route approval gate, auto-approve defaulted ON). This review answers the two open architecture questions. Advisory only — no code, migration, or PRD changes made here. Final decision rests with Leon + PM.

### Recommendation summary

- **Question 1 (table structure): recommend B2 — `pending` status in `routes`.**
- **Question 2 (toggle storage): recommend T3 — a single-row `app_settings` table with `DEFAULT true`, editable via Studio SQL.** (T3 and T1 are the same table; T3 is the pragmatic framing of it.)

### Question 1 — B1 (separate table) vs. B2 (pending status): recommend **B2**

**Rationale for B2:**

1. **Auto-approve-ON is the Phase 1 reality (per the PM alignment note), so the gate is almost always a no-op.** With auto-approve ON, a submission goes straight to `status = 'active'` — identical to today's insert path. B2 delivers this with the *existing* insert path unchanged: the client inserts into `routes` with `status = 'active'` (auto-approve) or `status = 'pending'` (gate on). B1 would force two divergent write paths (insert into `route_submissions`, then a separate promotion into `routes`), for a feature that is off at launch. That is disproportionate plumbing cost for a deferred capability.

2. **B2 matches how the codebase already models review gates.** `gym_requests` (MOD-002) is the *submission-into-a-separate-table* pattern, and it works there because a gym request has a **different shape** than a gym row (name + city + google_maps_url vs. the full 14-column `gyms` row with lat/lng, districts, bilingual names). A route submission, by contrast, is **field-for-field identical** to a route row (gym_id, grade, color_tag, photo_url, submitted_by). There is no shape mismatch to justify a second table — B1 would duplicate the schema verbatim and create a copy-on-approve step that can drift.

3. **The partial unique index already does the hard part for free.** `routes_active_unique_idx` is `UNIQUE (gym_id, grade, color_tag) WHERE status = 'active'`. Pending rows are automatically excluded from the uniqueness constraint, so two users can submit the same route while one is pending without an index collision, and approval (`UPDATE status = 'active'`) is where the uniqueness is enforced — exactly the right moment. This is the strongest single argument for B2: the dedup machinery Leon already paid for extends to a pending state with **zero index changes**. (Caveat below on the approval-time collision.)

4. **`ascents` FK integrity is preserved.** `ascents.route_id → routes.id`. Under B2 a route keeps one stable `id` from submission through approval, so any future "log a send on a route you just added" flow needs no id remapping. Under B1 the promotion step mints a *new* `routes.id`, orphaning anything that referenced the submission id — a latent bug surface.

**What B2 costs (the real cons, to be explicit):**

- **RLS must change so non-admins cannot see pending rows.** This is the one genuine downside and it must be handled carefully — see RLS implications below.
- **Studio pending-queue query is slightly more cluttered** (`SELECT * FROM routes WHERE status = 'pending'` rather than a dedicated table). This is trivial and can be wrapped in a Studio-saved query or a view.

**Why not B1:** clean separation is real but the value is low here because (a) the shapes are identical, (b) the gate is off at launch, (c) it breaks the stable-id property that `ascents` benefits from, and (d) it introduces a copy step that can silently diverge from the source row. B1 would be the right call only if route submissions were expected to carry review-only metadata that must never touch the live table (e.g. reviewer notes, rejection reasons at volume) — which is a Phase 2 concern at most and can be added as nullable columns on `routes` if it ever arises.

### Question 2 — T1 / T2 / T3 for the auto-approve toggle: recommend **T3**

T1 and T3 describe the **same artifact** — a single-row settings table read by the app and editable in Studio. T3 is simply the honest framing: "one row, `DEFAULT true`, changed via Studio SQL." I recommend that artifact, and reject T2.

**Rationale:**

- **T2 (Supabase project secret + Edge Function) is rejected.** It requires introducing an Edge Function into the route submission path, which is currently 100% client-side (`INSERT` into `routes` under RLS). That contradicts the shipped MOD-003 architecture and `production.md` §Architecture ("no bespoke backend server in Phase 1; route writes are client-side, RLS-checked"). Adding a function just to read one boolean is over-engineering, adds a cold-start latency to every submission, and creates an Edge Function dependency the stack doesn't otherwise need until MOD-007 notifications. Reserve Edge Functions for the event-driven flows that genuinely require service-role.
- **T3/T1 (settings table) is the fit.** Leon can flip auto-approve with one `UPDATE` in Studio, no redeploy. The read is one cheap indexed lookup on a single-row table, cacheable at app launch (the value changes rarely). It's the same operational surface (Studio) that the whole Phase 1 admin story is built on.
- **On the "round-trip per submission" con:** don't read it per-submission. Read `app_settings` once at app launch (or on a short TTL cache) alongside other bootstrap config. The toggle changing mid-session is not time-critical. This removes the only real T1 cost.

**Important nuance — where auto-approve is actually *enforced*:** the client cannot be trusted to honor the toggle, because RLS lets an authenticated user insert their own route row directly with whatever `status` they choose. So the toggle value being *readable* by the client is only a UX convenience (to set the right initial status / show the right confirmation copy). **The gate itself must be enforced server-side in the RLS `WITH CHECK`**, not by client cooperation — see below.

### RLS / migration / index implications (for whoever implements, if B2 + T3 approved)

These are flags for the eventual `change`-mode migration, not instructions to act now.

1. **SELECT policy must hide pending rows from non-owners/non-admins.** Current `routes_select_authenticated` exposes *all* rows to any authenticated user. Under B2 this would leak pending (unreviewed) routes into everyone's gym route list and — critically — into the AC-020 match pool, violating the PM's confirmed rule that pending rows must not appear as matches. The policy must become roughly: visible if `status = 'active'` OR `submitted_by_user_id = auth.uid()` (so submitters can see their own pending route). Admin (service_role) bypasses RLS and sees everything in Studio.

2. **Match-before-create (AC-020) query must filter `status = 'active'` explicitly.** Even with the SELECT policy above, the match query should not rely solely on RLS to scope the pool — it must include `WHERE status = 'active'` so a submitter's own pending row is never offered to them as a match. The partial unique index stays exactly as-is (`WHERE status = 'active'`); no index change is needed. Confirm the gym route list query also filters to `active`.

3. **INSERT policy must enforce the gate server-side, and this depends on the settings value.** This is the subtle part. Options, roughly in order of robustness:
   - (a) Make the INSERT `WITH CHECK` consult `app_settings`: allow `status = 'active'` on insert only when the toggle is true, else force `status = 'pending'`. This requires the policy to read the settings row (a `SELECT` inside the policy predicate, e.g. via a `SECURITY DEFINER` helper function), which is doable but adds a subquery to every insert.
   - (b) Simpler and arguably cleaner: **force all client inserts to `status = 'pending'`** via `WITH CHECK (status = 'pending')`, and implement auto-approve as a `BEFORE INSERT` trigger (or a `SECURITY DEFINER` RPC used as the submission entrypoint) that flips `status = 'active'` when `app_settings.route_auto_approve = true`. This keeps the "source of truth for the gate" in one server-side place and removes any client trust. Trade-off: routes no longer created by a bare client `INSERT`; submission goes through an RPC — a modest change to MOD-003's write path.
   - Decision between (a) and (b) is an implementation-time call for the Engineer, to be captured in the MOD-003 spec. My lean is (b): it centralizes enforcement and matches the existing `SECURITY DEFINER` pattern already used for `handle_new_auth_user`.

4. **Approval-time uniqueness collision must be handled gracefully.** Because pending rows bypass the partial unique index, two pending submissions for the same (gym_id, grade, color_tag) can coexist. Approving the second one (`UPDATE status = 'active'`) will hit `routes_active_unique_idx` and raise a unique-violation. In Phase 1 this surfaces to Leon in Studio as a raw error, which is acceptable (he can reject the duplicate). It should be **documented** in the MOD-003 spec as expected behavior so it isn't mistaken for a bug. A Phase 2 admin UI would catch this and offer a merge.

5. **`app_settings` table needs its own RLS.** New table ⇒ RLS enabled from creation (project convention). SELECT: authenticated (the client needs to read the toggle for UX) — or restrict to service_role if enforcement moves fully server-side per 3(b), in which case the client doesn't need to read it at all and SELECT can be service_role-only. INSERT/UPDATE/DELETE: none (service_role/Studio only). If enforcement is via a `SECURITY DEFINER` function (3b), that function reads the row regardless of the caller's RLS, so **service_role-only SELECT + a definer function is the tightest design** and avoids exposing settings to clients entirely.

6. **New `pending` enum value.** `ALTER TYPE route_status ADD VALUE 'pending';` — note Postgres cannot add an enum value inside a transaction block that then uses it in the same migration in older PG; on Postgres 15 (the stack's version) `ADD VALUE` is transaction-safe but the new value can't be used until the transaction commits. The migration should add the enum value and the settings table, and land policy/trigger changes such that the new value is usable — the Engineer should verify ordering in a local `supabase db reset`.

7. **PRD/spec contradictions still stand (PM's list §6).** The gate contradicts "routes go live immediately" / "without waiting on partnerships" framing. Those PRD edits are a prerequisite before implementation, tagged `[SUBSTANTIVE]`, routed through Doc-Sync. Not a Tech Lead action.

### Concerns (must address before implementing, if B2+T3 approved)

- **Pending-row leak via the existing SELECT policy** — the current `routes_select_authenticated` policy will expose unreviewed rows to all users and to the match pool unless updated. This is the top correctness risk of adopting B2 and must be fixed in the same migration that adds `pending`.
- **Client cannot be the enforcement point for auto-approve** — RLS lets a client set `status` freely today. The gate must be enforced server-side (INSERT `WITH CHECK` or definer RPC/trigger), or it is trivially bypassable.

### Recommendations

- Adopt **B2 + T3** with enforcement via a `SECURITY DEFINER` submission RPC (3b) that reads a service-role-only `app_settings` row. This centralizes the gate, keeps clients unable to self-approve, and requires zero change to the partial unique index.
- Keep the toggle read out of the per-submission hot path — resolve it inside the definer function, not via a client round-trip.
- Document the approval-time unique-collision (item 4) in the MOD-003 spec so it's understood as expected Phase 1 behavior.

### Approved (looks solid as-is)

- The partial unique index `routes_active_unique_idx` needs **no change** under B2 — its `WHERE status = 'active'` predicate already does the right thing for a pending state.
- Keeping route submission client-side (rejecting T2's Edge Function) is consistent with the shipped architecture; no new infra dependency.
- The `ascents.route_id → routes.id` FK is preserved intact under B2 (stable route id from submission through approval).

### Proposed Shared Conventions (for Doc-Sync to carry into production.md, only if B2+T3 is approved)

- **Review-gate modeling**: prefer a `status`-column gate on the primary table (with an RLS SELECT policy that hides non-active rows from non-owners) over a separate submission table, *unless* the submission's shape differs materially from the live row (as `gym_requests` does). Enforce the gate server-side (RLS `WITH CHECK` or a `SECURITY DEFINER` RPC), never by client cooperation.
- **Runtime admin toggles**: store operator-flippable settings in a single `app_settings (key, value)` table read server-side; do not introduce an Edge Function solely to gate a client-side write.
