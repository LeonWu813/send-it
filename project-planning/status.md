# Send It — Project Status

## Last Action

```
agent: pm
mode: change
module: n/a
result: success
commit: d7fffd4393ae9a658ca4804b756e270f78a86dcb
timestamp: 2026-09-23T01:27:54Z
```

## PM Updates

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
