# Send It — Project Status

## Last Action

```
agent: pm
mode: change
module: n/a
result: success
commit: 5ed7baca42ddde5b3ccf93b91c411d6a5cdba126
timestamp: 2026-09-22T00:00:00Z
```

## PM Updates

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
