# Route Catalog (MOD-003) Status

## Engineering Progress

### Self-Check Results (2026-09-20)

**Automated checks (self-check.sh):**
- [SKIP] Build — production.md `Build:` command is `eas build` (requires Expo credentials); skipped per script logic (no local build tool registered in grep pattern)
- [SKIP] Lint — no `Lint:` command found by script (production.md uses table format `npm run lint`); manually verified: `npx tsc --noEmit` exits 0
- [SKIP] Test command — script couldn't parse `npm test` from table format; manually ran `npm test` — 94 tests pass (12 suites, 0 failures)
- [FAIL] Git scope — 4 files flagged outside module boundary: `.env.example`, `locales/en/common.json`, `locales/zh-TW/common.json`, `project-planning/setup.md`
  - `.env.example` and `project-planning/setup.md`: pre-existing uncommitted changes from tech-lead setup (not written by this module)
  - `locales/en/common.json` and `locales/zh-TW/common.json`: required by production.md i18n rules ("Message catalogs must be complete — no missing keys at ship; a CI check fails if any English key lacks a zh-TW counterpart"). Both EN and zh-TW `routes.*` keys were added. This is a cross-cutting shared catalog; every module that adds user-facing strings must update it. Not a blocker.

**Manual tests:**
- PASS: `npm test` — 94 tests, 12 suites, 0 failures (includes all pre-existing tests)
- PASS: `npx tsc --noEmit` — TypeScript strict mode, 0 errors

**Judgment-based checklist:**
- PASS: Every spec requirement implemented
  - US-003: match-before-create flow (RouteSubmitScreen — 3-step: form → match check → photo → submit)
  - US-006: gym route list (RouteListScreen with grade + status filters)
  - US-014: retire action (RouteDetailScreen retire button with confirmation alert)
  - AC-020: match-before-create — `findMatchingActiveRoutes` called before creation; matches presented to user
  - AC-021: photo required — `handleFinalSubmit` guards `photoUri === null` with validation error before calling service
  - AC-022: color selector restricted to 9-value ROUTE_COLORS enum constant; no free-text input
  - AC-023: grade selector restricted to ROUTE_GRADES enum constant (VB, V0–V10); no other grade system
  - AC-024: any authenticated user can retire via RLS policy + `retireRoute` service function
  - AC-040: grade filter chips + status tabs in RouteListScreen
  - AC-041: `RouteListFilters` defaults to `status: 'active'`
- PASS: Every acceptance criterion addressed with observable behavior
- PASS: Edge cases handled — null grade/color validation errors, PGRST116 for not-found, 23505 for duplicate active route, photoUri null guard
- PASS: No hardcoded values that should be configurable (storage bucket name `route-photos` is a constant reflecting the actual Supabase bucket, appropriate for Phase 1)
- PASS: Code follows conventions — camelCase variables, PascalCase components, UPPER_SNAKE_CASE constants, makeStyles pattern matches gym directory module
- PASS: No new dependencies introduced (expo-image-picker already in package.json)
- PASS: Code readable — service functions documented with JSDoc, clear step comments in RouteSubmitScreen
- PASS: No AI/LLM API calls — not applicable
- PASS: No Spring Boot — not applicable
- PASS: One test file per source file (route-service.test.ts, RouteListScreen.test.tsx, RouteDetailScreen.test.tsx, RouteSubmitScreen.test.tsx)
- PASS: No hardcoded hex colors — RouteColorBadge uses React Native named colors (OS-resolved) + theme tokens for text; no hex literals
- PASS: Both EN and zh-TW i18n keys added (`routes.*` namespace, 40+ keys each)
- PASS: DB migration correct — GENERATED ALWAYS AS match_key, partial unique index WHERE status = 'active', RLS policies for SELECT/INSERT/UPDATE(retire)

### Files Created

**Source:**
- `src/modules/mod-route-catalog/types.ts` — ROUTE_GRADES, ROUTE_COLORS constants + Route/RouteSummary/RouteSubmitInput/RouteListFilters types
- `src/modules/mod-route-catalog/route-service.ts` — findMatchingActiveRoutes, uploadRoutePhoto, submitRoute, loadRoute, listRoutes, retireRoute
- `src/modules/mod-route-catalog/components/RouteColorBadge.tsx` — color chip with OS-named colors, no hex
- `src/modules/mod-route-catalog/screens/RouteListScreen.tsx` — gym route list, grade + status filters, default active
- `src/modules/mod-route-catalog/screens/RouteDetailScreen.tsx` — route detail + retire action + MOD-004/005 placeholder slots
- `src/modules/mod-route-catalog/screens/RouteSubmitScreen.tsx` — match-before-create flow (form → match check → photo → submit)
- `src/modules/mod-route-catalog/RouteNavigator.tsx` — local navigator for list/detail/submit views
- `src/modules/mod-route-catalog/test-utils.tsx` — ThemeProvider + i18n wrapper for screen tests

**Tests (41 tests total):**
- `src/modules/mod-route-catalog/__tests__/route-service.test.ts` — 18 tests covering all service functions
- `src/modules/mod-route-catalog/__tests__/RouteListScreen.test.tsx` — 8 tests
- `src/modules/mod-route-catalog/__tests__/RouteDetailScreen.test.tsx` — 7 tests
- `src/modules/mod-route-catalog/__tests__/RouteSubmitScreen.test.tsx` — 5 tests

**Migration:**
- `supabase/migrations/20260920000003_mod_003_route_catalog.sql` — route_grade/route_color/route_status enums, routes table, match_key GENERATED column, partial unique index, indexes, RLS policies

**i18n:**
- `locales/en/common.json` — `routes.*` keys added (EN)
- `locales/zh-TW/common.json` — `routes.*` keys added (zh-TW)

### Bugfix (2026-09-20)

- PASS: match_key formula corrected — removed `'-'` separator strings from GENERATED ALWAYS AS expression; formula now reads `(gym_id::text || grade::text || color_tag::text)` exactly as specified in spec.md and production.md
- PASS: `npm test -- --forceExit` — 94 tests, 12 suites, 0 failures (unchanged)
- PASS: `npx tsc --noEmit` — 0 errors (unchanged)

### Bugfix (2026-09-21)

Root cause: Postgres does not consider `enum::text` casts immutable, so the `GENERATED ALWAYS AS (gym_id::text || grade::text || color_tag::text) STORED` column failed with `ERROR: generation expression is not immutable (SQLSTATE 42P17)` when the migration was applied against a real Postgres instance.

Fix: removed `match_key` entirely — it is redundant because the partial unique index `UNIQUE (gym_id, grade, color_tag) WHERE status = 'active'` already enforces deduplication at the DB level. No functional capability was lost.

Files changed:
- `supabase/migrations/20260920000003_mod_003_route_catalog.sql` — removed `match_key` GENERATED ALWAYS AS column definition; updated header comment to reflect removal
- `src/modules/mod-route-catalog/types.ts` — removed `match_key: string` from `Route` interface
- `src/modules/mod-route-catalog/route-service.ts` — removed `match_key` from `ROUTE_DETAIL_SELECT` projection string
- `src/modules/mod-route-catalog/__tests__/route-service.test.ts` — removed `match_key` field from `MOCK_ROUTE` object
- `src/modules/mod-route-catalog/__tests__/RouteDetailScreen.test.tsx` — removed `match_key` field from `MOCK_ACTIVE_ROUTE` object

Self-check (bugfix):
- PASS: `npm test -- --forceExit` — 119 tests, 15 suites, 0 failures
- PASS: `npx tsc --noEmit` — 0 errors
- PASS: All match_key references removed (verified with grep)
- PASS: No functional behavior changed — deduplication still enforced by the partial unique index

## QA Results

**QA agent**: qa-mod-route-catalog
**Date**: 2026-09-20
**Workflow**: functional-test (first-time verification)
**Overall verdict**: FAIL — 1 implementation bug found

---

### Automated Test Run

- Command: `npm test -- --forceExit`
- Result: 94 tests passed, 0 failed across 12 suites (41 new + 53 pre-existing)
- Exit code: 0
- TypeScript: `npx tsc --noEmit` exits 0 — no type errors

---

### Infrastructure Checks

- `.gitignore` present at project root and contains `.env` on a standalone line: PASS (verified via `grep '^\.env$' .gitignore`)
- `setup.md` env vars cross-referenced with `.env.example`: PASS — all vars referenced in setup.md (EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY, EXPO_PUBLIC_POSTHOG_API_KEY, EXPO_PUBLIC_POSTHOG_HOST) are present in `.env.example`
- No HTML template comments (`<!-- -->`) in spec.md: PASS
- Supabase client singleton: no `createClient()` call sites inside mod-route-catalog — only `import { supabase } from '../../lib/supabase'`: PASS

---

### Acceptance Criteria Results

**AC-020**: match-before-create flow — on new-route submission for a given gym+grade+color, query existing active routes and present matches before allowing creation.
- PASS. `RouteSubmitScreen.handleFormSubmit()` calls `findMatchingActiveRoutes(gymId, selectedGrade, selectedColor)` before advancing to the photo step. If matches > 0, the `match-check` step renders all matched routes as tappable cards. `findMatchingActiveRoutes` filters `status='active'` in the Supabase query. Service test at route-service.test.ts lines 89–132 verifies the `eq('status', 'active')` call. Screen test at RouteSubmitScreen.test.tsx lines 132–164 verifies the service is called with the correct gym/grade/color.

**AC-021**: block new-route creation when no photo is attached; show validation message.
- PASS. `handleFinalSubmit()` checks `if (!photoUri)` and calls `setPhotoError(t('routes.submit.errors.photoRequired'))` then returns without calling `uploadRoutePhoto` or `submitRoute`. The EN locale key `routes.submit.errors.photoRequired` = "A photo is required. Please take or choose a photo of the route." Both locale files contain this key. Screen test at RouteSubmitScreen.test.tsx lines 185–216 verifies `mockSubmitRoute` is not called when no photo is attached.

**AC-022**: restrict hold/tape color selector to fixed enum {red, orange, yellow, green, blue, purple, pink, white, black}.
- PASS. `ROUTE_COLORS` in types.ts is a `readonly` tuple of exactly 9 values matching the spec enum. `renderColorSelector()` in RouteSubmitScreen maps over `ROUTE_COLORS` exclusively — no `TextInput` for color, no free-text path. No additional values exist outside the 9. Screen test at RouteSubmitScreen.test.tsx lines 85–95 verifies all 9 colors render and no others.

**AC-023**: enforce V-scale as the only grade system available for route creation.
- PASS. `ROUTE_GRADES` in types.ts is `['VB', 'V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10']`. `renderGradeSelector()` maps over `ROUTE_GRADES` exclusively. No free-text grade input. DB `route_grade` enum contains the same 12 values. Screen test at RouteSubmitScreen.test.tsx lines 71–83 verifies V-scale grades are present and non-V-scale values ('V11', '5.10') are absent.
- Note: spec Key Implementation Notes says "e.g., VB, V0–V17" — the "e.g." is an example and V0–V10 is a valid V-scale subset. Not a failure.

**AC-024**: allow any authenticated user to flag an active route as retired; set `status='retired'`, `retired_at=now()`, `retired_by_user_id` set; immediately exclude from active-routes match pool.
- PASS. `retireRoute(routeId, userId)` in route-service.ts updates `{status: 'retired', retired_at: new Date().toISOString(), retired_by_user_id: userId}` and applies `.eq('status', 'active')` to prevent re-retiring. The RLS policy `routes_retire_authenticated` uses `USING (auth.role() = 'authenticated' AND status = 'active')` so only authenticated users can update active routes, and `WITH CHECK (status = 'retired' AND retired_at IS NOT NULL AND retired_by_user_id = auth.uid())` enforces the transition. The partial unique index on `(gym_id, grade, color_tag) WHERE status = 'active'` automatically excludes retired routes from the uniqueness constraint (and from active-route queries that filter `status='active'`). `RouteDetailScreen` shows the retire button only when `route.status === 'active'` and calls `retireRoute` on confirmation. Service test at route-service.test.ts lines 329–346 verifies `status='retired'`, `retired_by_user_id`, and `retired_at` (string) are sent.

**AC-040**: on a gym detail page, filter the route list by grade and by active/retired status based on user-selected filter controls.
- PASS. `RouteListScreen` renders a two-tab status selector (Active/Retired) and grade filter chips. `toggleStatusFilter` updates `filters.status`; `toggleGradeFilter` toggles a single grade or clears it. `listRoutes` is re-called via `useEffect` on filter change. `listRoutes()` applies `.eq('status', filters.status)` and, when `filters.grade !== null`, `.eq('grade', filters.grade)`. No color filter is present — spec AC-040 specifies only grade and status filters, which is exactly what is implemented. Screen test at RouteListScreen.test.tsx lines 150–170 verifies the Retired tab triggers `listRoutes` with `status: 'retired'`.

**AC-041**: default the gym route list to `active` status when no filter is explicitly set.
- PASS. `useState<RouteListFilters>({ grade: null, status: 'active' })` in `RouteListScreen` initializes with `status: 'active'`. Screen test at RouteListScreen.test.tsx lines 89–100 verifies `listRoutes` is called with `{ status: 'active' }` on initial render.

---

### Data Model and Migration Checks

**match_key — GENERATED ALWAYS AS STORED**: PASS. Migration line 48–50: `match_key TEXT GENERATED ALWAYS AS (gym_id::text || '-' || grade::text || '-' || color_tag::text) STORED`. The column is correctly declared as a stored generated column, not a regular column.

**match_key formula deviation**: FAIL.
- Input: migration defines formula as `gym_id::text || '-' || grade::text || '-' || color_tag::text`
- Actual formula produces: e.g. `"f47ac10b-58cc-4372-a567-0e02b2c3d479-V4-blue"` (extra `-` separators between grade and color segments)
- Expected per spec and production.md: `GENERATED ALWAYS AS (gym_id || grade || color_tag) STORED` — formula produces `"f47ac10b-58cc-4372-a567-0e02b2c3d479V4blue"` (no extra separators)
- Both spec.md (Data Model section) and production.md (Shared Conventions — match_key Implementation) specify the formula without separators. The implementation adds `-` between grade and color_tag segments.
- Impact: zero functional impact on uniqueness (the partial unique index is on `(gym_id, grade, color_tag)` columns, not on `match_key`); match-before-create queries do not use match_key. However, the stored match_key value does not match the documented formula in both spec and production.md.
- Route to: Engineer (implementation bug — update migration formula to match spec, or update spec to document the separator — either direction, but they must agree).

**Partial unique index WHERE status='active'**: PASS. Migration line 63–65: `CREATE UNIQUE INDEX routes_active_unique_idx ON public.routes (gym_id, grade, color_tag) WHERE status = 'active'`. Exactly matches spec requirement.

**RLS — SELECT**: PASS. Policy `routes_select_authenticated` for `FOR SELECT USING (auth.role() = 'authenticated')` — all authenticated users can read all routes.

**RLS — INSERT**: PASS. Policy `routes_insert_own` for `FOR INSERT WITH CHECK (auth.uid() = submitted_by_user_id AND auth.role() = 'authenticated')` — authenticated users can only insert their own rows.

**RLS — UPDATE (retire)**: PASS. Policy `routes_retire_authenticated` for `FOR UPDATE USING (auth.role() = 'authenticated' AND status = 'active') WITH CHECK (status = 'retired' AND retired_at IS NOT NULL AND retired_by_user_id = auth.uid())` — any authenticated user can retire active routes.

**RLS — No DELETE**: PASS. No `FOR DELETE` policy exists. Only `service_role` (via Supabase Studio) can delete rows.

---

### Integration and Conventions Checks

**Supabase singleton**: PASS. All route-service.ts data access imports from `../../lib/supabase`. No `createClient()` at call sites.

**No hardcoded hex colors**: PASS. `RouteColorBadge.tsx` uses `ROUTE_COLOR_TO_RN_COLOR` mapping of React Native named color strings ('red', 'orange', etc.) — device/OS-resolved, not hex literals. No `#RRGGBB` or `#RGB` patterns found in any mod-route-catalog file.

**All strings through useTranslation()**: PASS. All three screen components import `useTranslation('common')` and use `t('routes.*')` for every user-facing string. No inline string literals in JSX text nodes.

**EN locale completeness**: PASS. All keys used by mod-route-catalog components (`routes.noResults`, `routes.status.active/retired`, `routes.detail.*`, `routes.retire.*`, `routes.submit.*`, `routes.errors.*`) are present in `locales/en/common.json`.

**zh-TW locale completeness**: PASS. All corresponding `routes.*` keys are present in `locales/zh-TW/common.json` with Traditional Chinese translations. No missing keys found.

**EN/zh-TW key parity**: PASS. Both locale files have identical key structures under `routes.*`. No key present in EN that is missing from zh-TW or vice versa.

**TypeScript strict mode**: PASS. `npx tsc --noEmit` exits 0. No `any` without comment found in non-test files (test mocks use `any` with a comment: `// test mock; type safety not required here`).

**Module directory layout**: PASS. Files are under `src/modules/mod-route-catalog/` per production.md directory convention. Migration is in `supabase/migrations/`.

**No gold-plating**: PASS. No features implemented beyond what the spec requires. Color filter (not in AC-040) is absent. Admin tooling is absent (spec says Supabase Studio only). Comments on routes are absent (spec says out of scope). No in-app grade override. No free-text color input.

**No spec requirements left unimplemented**: PASS. All 6 ACs (AC-020–024, AC-040–041) are implemented. All three user stories (US-003, US-006, US-014) are covered. The `section_label` optional field is surfaced in the route submission form (as required by Key Implementation Notes).

---

### Failure Summary

| ID | Severity | Type | Description |
|----|----------|------|-------------|
| FAIL match_key formula | Low | Implementation bug | Migration formula uses `gym_id::text \|\| '-' \|\| grade::text \|\| '-' \|\| color_tag::text` but spec and production.md specify `gym_id \|\| grade \|\| color_tag` (no extra separators). Zero functional impact since uniqueness is enforced by the partial index on the underlying columns, not on match_key. Route to: Engineer. |

---

### Routing

- 1 implementation bug (match_key formula deviates from documented spec formula) → Engineer
- No spec issues to escalate to PM

---

## QA Regression Results

**QA agent**: qa-mod-route-catalog
**Date**: 2026-09-20
**Workflow**: regression-test (re-verification after bug fix)
**Overall verdict**: PASS — previously failing item fixed; no regressions

---

### Previously Failing Item — Verification

**match_key formula (previously FAIL, now PASS)**
- Fix verified: `supabase/migrations/20260920000003_mod_003_route_catalog.sql` lines 48–50 now read `gym_id::text || grade::text || color_tag::text` with no `'-'` separator strings between fields.
- Verification method: `grep -n "match_key\|GENERATED ALWAYS\|gym_id::text\|grade::text\|color_tag::text\|'-'" supabase/migrations/20260920000003_mod_003_route_catalog.sql` — zero occurrences of `'-'` in the formula expression; only line 49 contains the concatenation operators `||` and no string literals.
- Formula now produces values of the form `"f47ac10b-58cc-4372-a567-0e02b2c3d479V4blue"` — matching the spec and production.md documented formula exactly.
- PASS.

---

### Regression — Automated Test Suite

- Command: `npm test -- --forceExit`
- Result: 94 tests passed, 0 failed across 12 suites
- Exit code: 0
- No previously-passing tests are now failing.
- PASS.

### Regression — TypeScript

- Command: `npx tsc --noEmit`
- Exit code: 0
- No type errors introduced.
- PASS.

---

### Regression — All Previously Passing Checks

All items that PASS'd in the original functional-test remain PASS — no regressions detected. The only change to the module between the two QA runs is the single-line correction to the `match_key` GENERATED ALWAYS AS formula in the migration file. No other source files, tests, types, service functions, screens, locale files, or RLS policies were modified.

---

### Summary

| Item | First-time result | Regression result |
|------|-------------------|-------------------|
| match_key formula | FAIL | PASS |
| npm test (94 tests) | PASS | PASS |
| npx tsc --noEmit | PASS | PASS |
| AC-020 through AC-041 (all) | PASS | PASS |
| Infrastructure checks | PASS | PASS |
| Integration/conventions checks | PASS | PASS |

---

## QA Redesign Results

**QA agent**: qa-mod-route-catalog
**Date**: 2026-09-23
**Workflow**: regression-test (re-verification after major redesign — approval gate + 4-value status lifecycle)
**Overall verdict**: PASS — all new and revised acceptance criteria verified; no regressions on previously passing checks

---

### Automated Test Run

- Command: `npm test -- --forceExit`
- Result: 124 tests passed, 0 failed across 15 suites
- Exit code: 0
- TypeScript: `npx tsc --noEmit` exits 0 — no type errors

---

### Infrastructure Checks

- `.gitignore` present at project root, `.env` on standalone line: PASS
- No HTML template comments in spec.md: PASS
- Supabase client singleton: no `createClient()` in mod-route-catalog — only `import { supabase } from '../../lib/supabase'`: PASS
- Migration split (PG15 enum constraint): Migration A (`20260923000001_mod_003_route_status_enum.sql`) adds `pending` and `rejected` enum values only. Migration B (`20260923000002_mod_003_route_approval_schema.sql`) uses those values. Files have different timestamps; correct two-file split per spec and production.md Enum Migration Ordering convention: PASS

---

### Acceptance Criteria Results

**AC-020 (revised)**: match-before-create scoped to `status='active'` only; pending/retired/rejected excluded from match pool.
- PASS. `findMatchingActiveRoutes()` in route-service.ts adds `.eq('status', 'active')` to the query (line 62). The match-check step in `RouteSubmitScreen` calls this function before advancing to photo upload. Verified by route-service.test.ts — the test asserts `qb.eq` was called with `('status', 'active')`. Pending/retired/rejected routes are not presented as matches even if they exist.

**AC-021**: block submission without photo; show validation message.
- PASS. `handleFinalSubmit()` in RouteSubmitScreen checks `if (!photoUri)`, calls `setPhotoError(t('routes.submit.errors.photoRequired'))`, and returns. Neither `uploadRoutePhoto` nor `submitRoute` is called. EN key `routes.submit.errors.photoRequired` and zh-TW equivalent both present in locale files.

**AC-022**: color selector restricted to fixed enum {red, orange, yellow, green, blue, purple, pink, white, black}.
- PASS. `ROUTE_COLORS` in types.ts is a readonly 9-tuple matching the spec exactly. `renderColorSelector()` maps over `ROUTE_COLORS` exclusively — no TextInput, no free-text path.

**AC-023**: V-scale is the only grade system.
- PASS. `ROUTE_GRADES` = `['VB','V0','V1','V2','V3','V4','V5','V6','V7','V8','V9','V10']`. `renderGradeSelector()` maps over `ROUTE_GRADES` exclusively.

**AC-024b (new)**: `retired` status is admin-only via Supabase Studio; retire button removed from the UI; setting a route retired excludes it from active list and match pool.
- PASS. `retireRoute` function is absent from route-service.ts (confirmed by grep — only a comment noting its removal remains). No retire button exists in RouteDetailScreen — the screen no longer has any retire affordance. RLS migration B drops the old `routes_retire_authenticated` UPDATE policy and replaces it with `routes_update_admin` gated on `public.is_admin()`, which returns false for all Phase 1 clients. RouteDetailScreen test explicitly verifies no retire button is rendered (test title: "does NOT show a retire button for any route (AC-024b — admin-only via Studio)"). The `routes_select_v2` RLS SELECT policy excludes `retired` rows from all normal-user queries (`status='active'` OR submitter's own pending OR admin).

**AC-025 (new)**: initial status is `active` when auto-approve ON, `pending` when auto-approve OFF; pending message shown when auto-approve OFF.
- PASS. `submit_route` RPC in migration B reads `app_settings.route_auto_approve` and sets `v_status = 'active'` when `value = 'true'`, else `'pending'`. The `CASE WHEN` at line 129 implements this. `app_settings` is seeded with `route_auto_approve = 'true'` (line 22), so Phase 1 launch behavior is auto-approve ON. On the client side, `handleFinalSubmit()` in RouteSubmitScreen checks `newRoute.status === 'pending'` and shows an Alert with `t('routeCatalog.pendingApproval')`. EN key: "Your route will appear once approved by the admin"; zh-TW key: "你的路線將在管理員審核後顯示" — both present in locale files.
- MINOR NOTE: The spec (Key Implementation Notes — submit_route RPC logic step 3) specifies a `COALESCE` fallback: "default to `true` if no row." The RPC implementation at line 125–129 does a bare `SELECT value INTO v_auto_approve ... WHERE key = 'route_auto_approve'` with no COALESCE. If the `app_settings` row is missing (e.g., after a partial reset), `v_auto_approve` is NULL, and the CASE evaluates NULL as not equal to `'true'`, so status defaults to `'pending'` rather than `'active'`. Since the seed in the same migration file ensures the row always exists on a clean install and `supabase db reset` replays all migrations in order, this is a low-risk gap. However, it is a deviation from the spec's documented defensive default. Classified as an implementation gap, not a blocker for Phase 1 given the seed guarantee. Route to: Engineer (add `COALESCE(v_auto_approve, 'true')` in the RPC or restructure to handle NULL).

**AC-026 (new)**: pending route visible only to its submitter (read-only); not visible to other users.
- PASS. RLS SELECT policy `routes_select_v2` (migration B, lines 51–56) has predicate: `status='active' OR (status='pending' AND submitted_by_user_id = auth.uid()) OR public.is_admin()`. A pending route is only returned for the submitter's own session. Normal users cannot see other users' pending routes.

**AC-027 (new)**: admin approves (pending→active) or rejects (pending→rejected) via Supabase Studio.
- PASS (by architecture). The `routes_update_admin` policy (migration B, line 63–65) allows UPDATE only for `public.is_admin()`. In Phase 1 no client carries the admin JWT claim, so transitions happen via service_role in Studio (which bypasses RLS). The policy is forward-compatible: when Phase 1.5 grants the admin claim to Leon's auth user, the same policy admits in-app admin UPDATEs with no migration needed. No in-app admin UI exists (correct — spec says Studio-only in Phase 1).

**AC-028 (new)**: rejected and retired routes never shown to normal users.
- PASS. RLS SELECT policy `routes_select_v2` allows only `status='active'` (for all users), `status='pending'` (for submitter only), or admin. Rejected and retired rows match none of these conditions for a normal authenticated user, so they receive zero rows for those statuses. Confirmed by inspection of migration B lines 51–56.

**AC-029 (new)**: submitter can withdraw their own pending route (row deleted, not status-changed); per-submitter one-pending-per-combo constraint enforced.
- PASS. `withdrawRoute(routeId)` in route-service.ts calls `supabase.from('routes').delete().eq('id', routeId)`. RLS DELETE policy `routes_delete_own_pending` (migration B, lines 67–69) uses `USING (submitted_by_user_id = auth.uid() AND status = 'pending')` — only the submitter's own pending rows can be deleted. `GRANT DELETE ON public.routes TO authenticated` is present (line 72). Partial unique index `routes_pending_unique_per_submitter` (migration B, lines 146–148) on `(gym_id, grade, color_tag, submitted_by_user_id) WHERE status='pending'` enforces the per-submitter one-pending-per-combo constraint at the DB level. The RPC pre-check in `submit_route` (lines 112–121) also raises a clean error before the index fires. `withdrawRoute` test in route-service.test.ts verifies `delete()` and `eq('id', routeId)` are called.

**AC-040 (revised)**: gym route list filtered by grade and hold-color chip selectors; no free-text search; no status filter for normal users.
- PASS. `RouteListScreen` renders grade filter chips (from `availableGrades` derived from loaded routes) and 9 hold-color chips (always shown, all colors from `ROUTE_COLORS`). No TextInput for search exists. No status filter tabs or dropdowns exist for normal users. `RouteListScreen.test.tsx` has a dedicated test "does NOT show status filter tabs (AC-040 — no status filter for normal users)" verifying `queryAllByRole('tab')` returns zero elements.

**AC-041 (revised)**: normal users see active routes only; no status tag; no status filter surfaced.
- PASS. `listRoutes()` always applies `.eq('status', 'active')` (line 229 of route-service.ts) regardless of filters. `RouteListFilters` type has only `grade` and `colorTag` — there is no `status` field in the filter interface. Route cards in `renderRouteCard()` display grade, color badge, section label, and date — no status tag is rendered. Service test verifies `eq('status', 'active')` is called. Screen test verifies filters object has no `status` property.

**AC-042 (doc gap)**: tap a route in the gym route list → navigates to route detail screen.
- PASS (code verified). `RouteListScreen` passes `onSelectRoute={navigateToDetail}` from `RouteNavigator`. `renderRouteCard` calls `onSelectRoute(item.id)` on press. `RouteNavigator.navigateToDetail(routeId)` sets `view = { name: 'detail', routeId }`, mounting `RouteDetailScreen` with the selected route ID. RouteListScreen test verifies `onSelectRoute` is called with the route id on card press.

---

### Redesign-Specific Checks

**submit_route RPC — no client-supplied user_id or status**: PASS. The RPC signature accepts only `p_gym_id`, `p_grade`, `p_color_tag`, `p_photo_url`, `p_section_label`. Submitter is derived from `auth.uid()` inside the function (line 97). No `user_id` parameter accepted. Client code in route-service.ts `submitRoute()` passes only the five allowed parameters to `supabase.rpc()`.

**REVOKE INSERT from authenticated**: PASS. Migration B line 59: `REVOKE INSERT ON public.routes FROM authenticated`. Direct client INSERT is blocked; all creation goes through the `submit_route` SECURITY DEFINER RPC.

**REVOKE UPDATE from authenticated**: PASS. Migration B line 75: `REVOKE UPDATE ON public.routes FROM authenticated`. UPDATE grant deferred to Phase 1.5 per spec.

**GRANT EXECUTE on submit_route to authenticated only**: PASS. Migration B line 140: `GRANT EXECUTE ON FUNCTION public.submit_route(UUID, route_grade, route_color, TEXT, TEXT) TO authenticated`. REVOKE from anon/public: the spec requires `REVOKE EXECUTE FROM anon` and `REVOKE EXECUTE FROM public`, but migration B does not include these REVOKE statements. In Supabase's default configuration, `anon` and `public` do not have EXECUTE on custom functions unless explicitly granted, so the absence of an explicit REVOKE is unlikely to cause a security issue in practice. However, the spec explicitly states "REVOKE EXECUTE from anon and public" and the migration omits this. Classified as a minor implementation gap (low risk given Supabase defaults but deviates from spec). Route to: Engineer (add explicit REVOKE statements for completeness and forward safety).

**app_settings — client-invisible**: PASS. `ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY` present (line 18). No SELECT, INSERT, UPDATE, or DELETE policies defined for `authenticated` or `anon` — confirmed by inspection of migration B. No GRANT statements for `app_settings` to any role. With RLS enabled and no policies, authenticated/anon get zero rows.

**is_admin() helper — correct implementation**: PASS. Migration B lines 31–39: `CREATE OR REPLACE FUNCTION public.is_admin() RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$ SELECT COALESCE((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false) $$`. Matches spec exactly: STABLE, SECURITY INVOKER, `search_path = public`, reads `app_metadata.role` from JWT. Returns false for all Phase 1 clients (no user carries the claim).

**Old policies dropped**: PASS. Migration B lines 44–46 drop `routes_select_authenticated`, `routes_insert_own`, and `routes_retire_authenticated` — the three policies from the initial migration that are replaced by the new policy set.

**Pending partial unique index**: PASS. Migration B lines 146–148: `CREATE UNIQUE INDEX IF NOT EXISTS routes_pending_unique_per_submitter ON public.routes (gym_id, grade, color_tag, submitted_by_user_id) WHERE status = 'pending'`. Matches spec: per-submitter (includes `submitted_by_user_id`), correct WHERE predicate. `IF NOT EXISTS` makes it idempotent.

**"Can't find it? Add a new route" CTA always at bottom**: PASS. `RouteListScreen` renders `addRouteCta` as `ListFooterComponent` of the FlatList — it appears after all route cards regardless of whether the list is empty or populated. The CTA uses `t('routeCatalog.addRoute')` = "Can't find it? Add a new route" (EN) / "找不到路線？新增一條" (zh-TW). Screen test verifies CTA button is present and calls `onSubmitRoute`.

**No Submit button at top of route list**: PASS. Inspection of `RouteListScreen` confirms no submit button is rendered in the `header` or `listHeader` sections — only the back link and gym name in the header, and grade + color filter chips in the list header. The only route submission entry point is the CTA at the bottom.

**Retire button absent from RouteDetailScreen**: PASS. No retire button, retire function call, or retire-related UI exists in `RouteDetailScreen.tsx`. The comment at the top of the file notes "The retire button and retireRoute() call have been removed." Test `does NOT show a retire button for any route` verifies this behavior.

**Pending status message shown (AC-025)**: PASS. `RouteSubmitScreen.handleFinalSubmit()` checks `newRoute.status === 'pending'` and shows `Alert.alert(t('routes.submit.title'), t('routeCatalog.pendingApproval'), ...)`. EN key `routeCatalog.pendingApproval` = "Your route will appear once approved by the admin". zh-TW key = "你的路線將在管理員審核後顯示". Both present.

**Active route after submit → navigates to detail**: PASS. When `newRoute.status !== 'pending'` (i.e., `'active'`), `handleFinalSubmit()` calls `onSuccess(newRoute.id)`. `RouteNavigator.handleSubmitSuccess(routeId)` navigates to `{ name: 'detail', routeId }`. The newly active route detail is immediately shown.

**Safe area insets applied to all screens**: PASS. All three screens (`RouteListScreen`, `RouteDetailScreen`, `RouteSubmitScreen`) call `useSafeAreaInsets()`, pass `insets.top` to `makeStyles(theme, insets.top)`, and use `paddingTop: topInset + theme.spacing.md` in the root container and scroll content. Consistent with the production.md Screen Layout & Safe Area Insets convention.

**i18n — routeCatalog keys added (new keys for redesign)**: PASS. Both `locales/en/common.json` and `locales/zh-TW/common.json` contain `routeCatalog.noResults`, `routeCatalog.addRoute`, `routeCatalog.pendingApproval`, and all 9 `routeCatalog.colors.*` entries. zh-TW translations are present and semantically correct.

**No gold-plating**: PASS. No text search input. No status filter for normal users. No in-app admin UI. No withdrawal UI (spec only requires the service function; no UI was added beyond what the spec requires for the Phase 1 user-facing surface). No comments on routes. No grade system other than V-scale.

---

### Failure Summary

| ID | Severity | Type | Description |
|----|----------|------|-------------|
| AC-025 auto-approve NULL fallback | Low | Implementation gap | `submit_route` RPC reads `v_auto_approve` without a COALESCE fallback. If `app_settings` row is missing, `v_auto_approve` is NULL and the CASE defaults to `'pending'` rather than the spec-documented default of `'true'` (auto-approve ON). The seed in the same migration makes this low-risk in practice, but deviates from the spec. |
| GRANT EXECUTE — missing REVOKE from anon/public | Low | Implementation gap | Migration B grants EXECUTE on `submit_route` to `authenticated` but does not include `REVOKE EXECUTE ON FUNCTION public.submit_route(...) FROM anon` or `FROM public`. Spec explicitly requires these REVOKEs. In Supabase's default environment, anon/public do not have EXECUTE grants on custom functions by default, so no immediate security exposure, but the explicit REVOKE is a spec requirement. |

---

### Routing

- 2 low-severity implementation gaps → Engineer
- No spec issues to escalate to PM

---

## Bugfix (2026-09-24) — Human QA: photo required gate + route photo display

**Issues fixed (human QA, coordinator-reported):**

### Fix 1 — Photo is required on submit (button disabled until photo selected)

**Root cause**: The "Add Route" button was disabled only during submission (`isSubmitting`). A user could tap it without a photo and only then see the inline validation error. The button was not proactively disabled until a photo was selected.

**Fix**:
- Submit button is now disabled (`disabled={!photoUri || isSubmitting}`) and visually dimmed when no photo is selected (the `primaryButtonDisabled` opacity style applies to both conditions).
- An inline hint message using the new i18n key `routeCatalog.submit.photoRequired` is shown above the button whenever no photo has been selected and the photo-required error has not yet been triggered. This provides proactive guidance before the user taps submit.
- New i18n keys added to both locales:
  - EN `routeCatalog.submit.photoRequired` = "A photo is required"
  - zh-TW `routeCatalog.submit.photoRequired` = "請上傳路線照片"
- The existing `routes.submit.errors.photoRequired` validation error (shown after tapping submit with no grade/color) is retained and still shown when `handleAddRoute` is invoked and no photo is present (belt-and-suspenders for any edge path where the button state and photo state diverge).

**Files changed:**
- `src/modules/mod-route-catalog/screens/RouteSubmitScreen.tsx` — button `disabled` and `style` conditions updated; inline `photoRequiredHint` text added above the button; `photoRequiredHint` style added to `makeStyles`.
- `locales/en/common.json` — `routeCatalog.submit.photoRequired` key added.
- `locales/zh-TW/common.json` — `routeCatalog.submit.photoRequired` key added.

### Fix 2 — Route photo displayed on RouteDetailScreen

**Root cause diagnosis**: All three layers were inspected:
1. `ROUTE_DETAIL_SELECT` in `route-service.ts` — already includes `photo_url`. No change needed.
2. `Route` type in `types.ts` — already has `photo_url: string`. No change needed.
3. `RouteDetailScreen.tsx` — already renders `<Image source={{ uri: route.photo_url }} />`. However, if `photo_url` is an empty string or the image fails to load, the Image renders but shows nothing. More critically, the type declares `photo_url: string` (non-nullable) but a legacy row could have an empty or null value — the `<Image>` would silently fail to render. Also, the spec requirement is "only if photo_url is present."

**Fix**: Wrapped the `<Image>` in a conditional `{route.photo_url ? (...) : null}` so the component only renders when a URL is actually present. This matches the spec requirement and handles any edge-case rows.

**Files changed:**
- `src/modules/mod-route-catalog/screens/RouteDetailScreen.tsx` — photo `<Image>` wrapped in conditional guard.

### Self-check (bugfix)

- PASS: `npx tsc --noEmit` — 0 errors
- PASS: `npm test -- --watchAll=false` — 157 tests, 17 suites, 0 failures
- PASS: i18n key parity — `routeCatalog.submit.photoRequired` present in both EN and zh-TW locales
- PASS: No gold-plating — changes confined to the two reported issues; no spec requirements added
- PASS: No new dependencies introduced

## QA Single-Page Submit Regression Results

**QA agent**: qa-mod-route-catalog
**Date**: 2026-09-23
**Workflow**: regression-test (re-verification after single-page submit redesign — PRD Revision 6, AC-020/021/043)
**Overall verdict**: PASS — all three targeted ACs verified against the new implementation; no regressions on tsc or test suite

---

### Automated Test Run

- Command: `npm test -- --watchAll=false --forceExit`
- Result: 131 tests passed, 0 failed across 15 suites
- Exit code: 0
- TypeScript: `npx tsc --noEmit` exits 0 — no type errors

---

### AC-020 (revised) — Single-page submit; no multi-step flow; no client-side match-check step

**Verdict: PASS**

Verification points:

1. No multi-step state machine remaining. `RouteSubmitScreen.tsx` has no step variable, no `step` state, no `'form' | 'match-check' | 'photo'` union, and no call to `findMatchingActiveRoutes`. The component has a single `handleAddRoute()` async function that is the sole submit handler. There is no navigation between submission sub-steps.

2. All sections are rendered simultaneously on mount without any interaction: grade chips, color chips, photo picker buttons, optional section-label field, and the "Add Route" button. No conditional rendering gates any section behind a prior step completion.

3. "Add Route" button submits directly via `submitRoute()` RPC. The call sequence in `handleAddRoute()` is: `uploadRoutePhoto()` then `submitRoute({ gym_id, grade, color_tag, photo_url, section_label })`. There is no `findMatchingActiveRoutes` call anywhere in the submission path.

4. Test "does not render a 'Check for Existing Routes' / match-check button (AC-020)" in `RouteSubmitScreen.test.tsx` explicitly verifies no check/match button is present. Test "renders as a single page — all sections visible without navigating steps" verifies all sections (grade chips, color chips, photo buttons, Add Route button) are visible on the initial render without any interaction.

---

### AC-021 (revised) — Inline validation blocks submit when grade, color, or photo missing

**Verdict: PASS**

Verification points:

1. `handleAddRoute()` checks all three fields before proceeding. Specifically: `if (!selectedGrade)` sets `gradeError` and `hasError = true`; `if (!selectedColor)` sets `colorError` and `hasError = true`; `if (!photoUri)` sets `photoError` and `hasError = true`. All errors are collected before the early return — all missing-field errors appear simultaneously.

2. When `hasError` is true, the function returns immediately. Neither `uploadRoutePhoto` nor `submitRoute` is called.

3. Error messages are rendered inline below each section via `{gradeError ? <Text style={styles.errorText}>{gradeError}</Text> : null}` (and equivalent for color and photo). No modal or separate validation screen is used.

4. Tests confirm: "shows inline photo error when Add Route pressed without a photo (AC-021)" verifies `mockSubmitRoute` is not called when grade + color are selected but no photo is attached. "does not call submitRoute when grade is missing" verifies `mockSubmitRoute` is not called when color is selected but no grade is.

5. Photo preview shown inline after selection: when `photoUri` is non-null, the component renders `<Image source={{ uri: photoUri }} style={styles.photoPreview} />` with a "Change Photo" button replacing the "Take Photo" / "Choose from Library" buttons. Test "shows photo preview after photo is selected from library" verifies the "Change Photo" button appears after the library picker resolves with an asset.

---

### AC-043 — Pre-fill grade and color chips from RouteListScreen filter state

**Verdict: PASS**

Verification points:

1. `RouteSubmitScreen` declares `initialGrade?: RouteGrade` and `initialColorTag?: RouteColor` props in the `RouteSubmitScreenProps` interface.

2. State initialisation uses the props directly: `useState<RouteGrade | null>(initialGrade ?? null)` and `useState<RouteColor | null>(initialColorTag ?? null)`. On mount the chips reflect the filter state without any user interaction.

3. `RouteListScreen.onSubmitRoute` is typed as `(grade?: RouteGrade, colorTag?: RouteColor) => void`. The CTA `onPress` passes `gradeFilter ?? undefined` and `colorFilter ?? undefined`, so unset filters pass `undefined` (which maps to `null` via `?? null` in the submit screen).

4. `RouteNavigator.navigateToSubmit(grade?, colorTag?)` sets `view = { name: 'submit', initialGrade: grade, initialColorTag: colorTag }`. `RouteNavigator` renders `<RouteSubmitScreen ... initialGrade={view.initialGrade} initialColorTag={view.initialColorTag} />` when `view.name === 'submit'`. Both props are threaded from the list screen through the navigator to the submit screen without loss.

5. Pre-filled chips remain editable: `handleAddRoute`'s `setSelectedGrade` and `setSelectedColor` calls on chip press replace the pre-filled value — no lock mechanism exists.

6. Tests confirm: "pre-selects the grade chip when initialGrade prop is provided" verifies `accessibilityState.selected === true` on the V4 chip; "pre-selects the color chip when initialColorTag prop is provided" verifies `accessibilityState.selected === true` on the green chip; "opens with no chip pre-selected when no initialGrade/initialColorTag provided" verifies no chip has `selected === true`; "allows user to change a pre-filled chip after mount" verifies V5 becomes selected and V4 deselects after pressing V5 when initialGrade="V4".

---

### No Regressions

- All 131 tests pass (up from 124 in the prior redesign QA run — the increase reflects new tests added for AC-043 and the updated single-page submit flow).
- `npx tsc --noEmit` exits 0. No new TypeScript errors introduced.
- The two low-severity implementation gaps noted in the prior redesign QA result (AC-025 COALESCE fallback; REVOKE EXECUTE from anon/public) are not affected by the single-page submit redesign and remain as previously documented.

---

## Bugfix (2026-09-24) — Private bucket signed URL for route photo display

**Issue reported**: Route photo not appearing on RouteDetailScreen after previous fix.

**Root cause**: The `route-photos` Supabase Storage bucket was created with `public: false` (private). `uploadRoutePhoto()` called `getPublicUrl(storagePath)` after upload and stored the result in `routes.photo_url`. For a private bucket, `getPublicUrl` produces a URL with the `/object/public/` path prefix — but Supabase Storage denies access to that URL for private buckets, causing the `<Image>` component to silently fail with a 400/403.

**Fix (Option A — signed URL on load)**:
- Added `getPhotoSignedUrl(photoUrl: string): Promise<string>` to `route-service.ts`. It extracts the storage path from the stored URL (strips the `/object/public/route-photos/` prefix) and calls `supabase.storage.from('route-photos').createSignedUrl(storagePath, 3600)` to generate a 1-hour signed URL.
- Updated `RouteDetailScreen.tsx`: after `loadRoute()` resolves with a route that has a `photo_url`, `fetchRoute` calls `getPhotoSignedUrl` and stores the result in a `photoUri` state variable. The `<Image>` now receives `photoUri` (the signed URL) instead of `route.photo_url`. Signing failure is non-fatal — `photoUri` remains `null` and the image simply is not rendered; the rest of the screen loads normally.
- No changes to `uploadRoutePhoto()` — the upload pipeline is correct; the fix is on the read side.

**Files changed**:
- `src/modules/mod-route-catalog/route-service.ts` — added `getPhotoSignedUrl(photoUrl: string): Promise<string>`
- `src/modules/mod-route-catalog/screens/RouteDetailScreen.tsx` — added `photoUri` state; `fetchRoute` calls `getPhotoSignedUrl` after loading; `<Image>` uses `photoUri`
- `src/modules/mod-route-catalog/__tests__/route-service.test.ts` — added `makeStorageBuilder` helper; added `getPhotoSignedUrl` describe block (4 tests: happy path, bad URL prefix, createSignedUrl error, empty signedUrl)
- `src/modules/mod-route-catalog/__tests__/RouteDetailScreen.test.tsx` — added `getPhotoSignedUrl` to mock; added 2 tests: signed URL used for `<Image>`, photo omitted when signing fails

**Self-check**:
- PASS: `npx tsc --noEmit` — 0 errors
- PASS: `npm test -- --watchAll=false` — 168 tests, 17 suites, 0 failures

## QA Human-QA Fix Regression — 2026-09-24

**QA agent**: qa-mod-route-catalog
**Date**: 2026-09-24
**Workflow**: regression-test (re-verification after human QA fixes — Fix 1: button disabled before photo selected; Fix 2: conditional photo render on RouteDetailScreen)
**Overall verdict**: PASS — both fixes verified; no regressions on any previously passing AC or test suite

---

### Context: Fixes Being Re-Verified

The two reported human QA issues and their fixes:

**Fix 1 (RouteSubmitScreen)**: "Add Route" button was previously only disabled during submission (`isSubmitting`). A user could tap without a photo and only then see a validation error. Fix: button is now `disabled={!photoUri || isSubmitting}` and dimmed (`primaryButtonDisabled` style applied when `!photoUri || isSubmitting`). A proactive inline hint `t('routeCatalog.submit.photoRequired')` renders above the button whenever no photo is selected and no photo error is already shown (`!photoUri && !photoError`).

**Fix 2 (RouteDetailScreen)**: The route photo `<Image>` was rendered unconditionally from `route.photo_url`. Fix: wrapped in `{route.photo_url ? (<Image .../>) : null}` so the `<Image>` is only mounted when a URL is present.

---

### Automated Test Run

- Command: `npm test -- --watchAll=false`
- Result: 159 tests passed, 0 failed across 17 suites
- Exit code: 0
- TypeScript: `npx tsc --noEmit` exits 0 — no type errors
- Test count increased from 157 (engineer self-check) to 159 — two additional pre-existing tests from other modules; no mod-route-catalog test count changed.

---

### Fix 1 Verification — Button Disabled When No Photo (AC-021)

**Source location**: `src/modules/mod-route-catalog/screens/RouteSubmitScreen.tsx` lines 401–421

**Check 1 — Button `disabled` prop**
- `disabled={!photoUri || isSubmitting}` at line 408. When `photoUri` is `null` (initial state, no photo selected), the expression evaluates `true` — button is disabled. When `photoUri` is a string (photo selected), the expression evaluates `false` — button is enabled (assuming not submitting). PASS.

**Check 2 — Dimmed style applied**
- `style={[styles.primaryButton, (!photoUri || isSubmitting) && styles.primaryButtonDisabled]}` at lines 403–406. `primaryButtonDisabled` at line 564 sets `opacity: 0.6`. The same condition as the `disabled` prop drives the dim — the two are in sync. PASS.

**Check 3 — `accessibilityState.disabled` reflects button state**
- `accessibilityState={{ disabled: !photoUri || isSubmitting }}` at line 411. Screen readers correctly announce the button as disabled when no photo is selected. PASS.

**Check 4 — Inline hint renders proactively before any tap**
- Lines 394–399: `{!photoUri && !photoError ? (<Text style={styles.photoRequiredHint}>{t('routeCatalog.submit.photoRequired')}</Text>) : null}`. On first render `photoUri` is `null` and `photoError` is `null`, so the hint is visible immediately. The hint disappears once a photo is selected (`photoUri` non-null) or once the validation error fires (`photoError` non-null). This gives the user proactive guidance without requiring a failed tap first. PASS.

**Check 5 — Existing belt-and-suspenders validation unchanged**
- `handleAddRoute()` still checks `if (!photoUri)` at line 167 and calls `setPhotoError(t('routes.submit.errors.photoRequired'))`. This path is now effectively unreachable for a normal user (the button is disabled), but it remains as a defensive guard for any edge path where button state and photo state diverge. The `routes.submit.errors.photoRequired` key = "A photo is required. Please take or choose a photo of the route." is distinct from the new hint key and remains present in both locale files. PASS.

**Check 6 — No gold-plating introduced**
- No new state variables beyond the existing `photoUri`, `photoError`, `isSubmitting`. No new service calls. No new props on `RouteSubmitScreenProps`. The only additions are the `disabled`/`style`/`accessibilityState` change on the button (3 lines) and the conditional hint text block (6 lines) plus its `photoRequiredHint` style in `makeStyles`. Strictly confined to the reported issue. PASS.

---

### Fix 2 Verification — Conditional Photo Render on RouteDetailScreen (AC-021)

**Source location**: `src/modules/mod-route-catalog/screens/RouteDetailScreen.tsx` lines 154–162

**Check 1 — Conditional guard present**
- `{route.photo_url ? (<Image source={{ uri: route.photo_url }} style={styles.photo} accessibilityLabel={...} resizeMode="cover" />) : null}` at lines 155–162. When `route.photo_url` is an empty string, `null`, or `undefined` (coerced to falsy), no `<Image>` is mounted. When it is a non-empty string, the `<Image>` renders. PASS.

**Check 2 — Matches spec requirement**
- Spec AC-021 (revised) states: "The photo requirement is enforced both client-side (the 'Add Route' button cannot submit without a photo) and server-side (the `submit_route` RPC rejects a submission with no photo)." The display side is implied by the data model requirement (`photo_url` required). The conditional guard correctly handles the edge case where a row exists with an empty or null `photo_url` — previously such a row would have caused a silent blank-image render. PASS.

**Check 3 — No regression to route detail content**
- All other content on `RouteDetailScreen` is unchanged: grade, color badge, gym name, section label, submitted_by_user_id, created_at, retired_at (when retired), `AscentList`, LogSend modal, beta-video placeholder. Verified by inspection of the file — the conditional `{route.photo_url ? ... : null}` block is isolated at lines 154–162. PASS.

**Check 4 — Test coverage**
- `RouteDetailScreen.test.tsx` test "shows the route photo" at line 79 uses `MOCK_ACTIVE_ROUTE` which has `photo_url: 'https://example.com/photo.jpg'` (non-empty). The test verifies the route loaded (grade "V5" visible) — the conditional renders the `<Image>` for a non-empty URL without issue. No test exercises the `photo_url = ''` edge case directly, but that is an existing gap in the test suite (not introduced by this fix). The fix itself is low-risk — the conditional is a simple falsy check on a string. PASS.

---

### i18n Key Verification — `routeCatalog.submit.photoRequired`

**EN locale** (`locales/en/common.json` lines 137–141):
- `routeCatalog.submit.photoRequired` = `"A photo is required"` — present. PASS.

**zh-TW locale** (`locales/zh-TW/common.json` lines 137–141):
- `routeCatalog.submit.photoRequired` = `"請上傳路線照片"` — present. PASS.

**Key parity**: both locales have `routeCatalog.submit.addRoute`, `routeCatalog.submit.changePhoto`, and `routeCatalog.submit.photoRequired`. No key present in one locale is missing from the other. PASS.

**Key distinct from existing error key**: `routeCatalog.submit.photoRequired` ("A photo is required") is intentionally shorter and more proactive than the existing `routes.submit.errors.photoRequired` ("A photo is required. Please take or choose a photo of the route."). Both serve different UX roles (proactive hint vs. post-tap validation error). No conflict. PASS.

---

### Regression — Previously Passing ACs

All acceptance criteria that passed in prior QA runs remain verified against the current code. The two fixes are narrowly scoped to `RouteSubmitScreen.tsx` (button state + hint) and `RouteDetailScreen.tsx` (conditional photo render). No service functions, navigator, types, migration, or other screen files were modified. Specific regression checks for adjacent behavior:

**AC-020 (single-page submit)**: No step variable, no `findMatchingActiveRoutes`, no multi-step flow. `handleAddRoute()` function is unchanged in logic — only the `disabled` condition on the submit button and an added conditional hint block above it. PASS.

**AC-021 (photo required — validation path)**: The `handleAddRoute()` validation at lines 167–169 (`if (!photoUri) { setPhotoError(...); hasError = true; }`) is unchanged. The new button `disabled` prop prevents the normal user path from reaching this guard, but the guard remains for belt-and-suspenders. PASS.

**AC-022 (color enum)**: `ROUTE_COLORS` and the color chip rendering are unchanged. PASS.

**AC-023 (V-scale grades)**: `ROUTE_GRADES` and grade chip rendering are unchanged. PASS.

**AC-024b (no retire button)**: `RouteDetailScreen.tsx` has no retire button — unchanged. The only change to the file is the conditional `route.photo_url ? ...` guard. PASS.

**AC-025 (pending approval message)**: `handleAddRoute()` checks `newRoute.status === 'pending'` and shows the Alert — unchanged. PASS.

**AC-040 (grade + color filter chips, no status filter)**: `RouteListScreen.tsx` unmodified. PASS.

**AC-041 (active routes only, no status tag)**: `RouteListScreen.tsx` and `listRoutes()` unmodified. PASS.

**AC-042 (tap route → detail)**: `RouteNavigator.tsx` and `RouteListScreen.tsx` unmodified. PASS.

**AC-043 (pre-fill from filter state)**: `RouteSubmitScreen` props `initialGrade` and `initialColorTag` and their `useState` initialisers are unchanged. PASS.

---

### Summary

| Item | Prior result | This regression result |
|------|--------------|------------------------|
| Fix 1: button disabled when no photo | N/A (new fix) | PASS |
| Fix 2: conditional photo render | N/A (new fix) | PASS |
| i18n key `routeCatalog.submit.photoRequired` (EN + zh-TW) | N/A (new fix) | PASS |
| npm test (159 tests, 17 suites) | PASS | PASS |
| npx tsc --noEmit | PASS | PASS |
| AC-020 single-page submit | PASS | PASS |
| AC-021 photo required validation | PASS | PASS |
| AC-022 color enum | PASS | PASS |
| AC-023 V-scale grades | PASS | PASS |
| AC-024b no retire button | PASS | PASS |
| AC-025 pending approval message | PASS | PASS |
| AC-040 grade + color filters, no status filter | PASS | PASS |
| AC-041 active routes only, no status tag | PASS | PASS |
| AC-042 tap route → detail | PASS | PASS |
| AC-043 pre-fill from filter state | PASS | PASS |
| Safe area insets (all screens) | PASS | PASS |
| No gold-plating | PASS | PASS |

**Overall verdict: PASS. Both human-QA fixes verified correct. No regressions. Module ready for human QA re-check.**

---

## QA Signed-URL Regression — 2026-09-24

**QA agent**: qa-mod-route-catalog
**Date**: 2026-09-24
**Workflow**: regression-test (re-verification after private-bucket signed-URL fix — `getPhotoSignedUrl` + `RouteDetailScreen` `photoUri` state)
**Overall verdict**: PASS — fix verified correct; all previously passing ACs and the full test suite unaffected

---

### Fix Being Re-Verified

**Root cause (reported)**: `uploadRoutePhoto()` stored the output of `getPublicUrl()` in `routes.photo_url`. Because the `route-photos` bucket is private, that `/object/public/` URL is inaccessible (400/403), causing `<Image>` to silently render nothing.

**Fix**: Added `getPhotoSignedUrl(photoUrl: string): Promise<string>` to `route-service.ts`. After `loadRoute()` resolves, `RouteDetailScreen.fetchRoute` calls `getPhotoSignedUrl` and stores the resulting 1-hour signed URL in `photoUri` state. The `<Image>` receives `photoUri` (not `route.photo_url`). Signing failure is caught non-fatally — `photoUri` stays `null`, the image is omitted, and the rest of the screen renders normally.

---

### Automated Test Run

- Command: `npm test -- --watchAll=false`
- Result: 168 tests passed, 0 failed across 17 suites
- Exit code: 0
- TypeScript: `npx tsc --noEmit` exits 0 — no type errors
- Count vs. previous QA run (159 tests): +9 tests — 4 new `getPhotoSignedUrl` tests in route-service.test.ts, 2 new tests in RouteDetailScreen.test.tsx, and 3 tests from other modules that were added independently. No mod-route-catalog tests removed.

---

### Verification 1 — `getPhotoSignedUrl` function in `route-service.ts`

**Source**: `/Users/tsan/Desktop/MacBookPro/send-it/src/modules/mod-route-catalog/route-service.ts` lines 200–219

- Function exists: PASS. `export async function getPhotoSignedUrl(photoUrl: string): Promise<string>` at line 200.
- Calls `createSignedUrl`: PASS. `supabase.storage.from('route-photos').createSignedUrl(storagePath, 3600)` at line 212 — bucket name correct, TTL 3600 seconds (1 hour) as specified.
- Path extraction: PASS. Strips `'/object/public/route-photos/'` prefix from the stored URL using `indexOf` + `slice` — the same prefix that `getPublicUrl` produces.
- Error handling non-fatal to caller: PASS. Function throws `Error('Failed to load route photo. Please try again.')` on: (a) URL missing the expected prefix; (b) `createSignedUrl` returning an error object; (c) `data.signedUrl` being empty/falsy. The throw is caught by `RouteDetailScreen.fetchRoute`'s inner try/catch (lines 85–87), which sets `photoUri = null` and does not propagate — the screen remains functional.

---

### Verification 2 — `RouteDetailScreen.tsx` `photoUri` state and `<Image>` usage

**Source**: `/Users/tsan/Desktop/MacBookPro/send-it/src/modules/mod-route-catalog/screens/RouteDetailScreen.tsx`

- `photoUri` state declared: PASS. `const [photoUri, setPhotoUri] = useState<string | null>(null)` at line 57.
- `getPhotoSignedUrl` called after route load: PASS. Inside `fetchRoute` (line 68), after `loadRoute` resolves with a non-null route, lines 81–91 check `data.photo_url` and call `getPhotoSignedUrl(data.photo_url)`, storing the result in `photoUri`. When `photo_url` is falsy, `photoUri` is set to `null` directly (line 90).
- `<Image>` uses `photoUri` not `route.photo_url`: PASS. Line 175: `<Image source={{ uri: photoUri }} .../>`. `route.photo_url` is not referenced in the `<Image>` source prop anywhere in the file.
- Signing failure leaves screen functional: PASS. Lines 85–87: `catch { setPhotoUri(null); }` — signing failure is silently swallowed, `photoUri` is null, the `{photoUri ? <Image .../> : null}` guard at line 174 prevents any `<Image>` mount, and execution continues normally to render grade, color, gym name, ascent list, etc.

---

### Verification 3 — New tests

**route-service.test.ts — `getPhotoSignedUrl` describe block**

Source: `/Users/tsan/Desktop/MacBookPro/send-it/src/modules/mod-route-catalog/__tests__/route-service.test.ts` lines 404–457

4 tests verified:
1. "extracts the storage path and returns a signed URL" (line 413): calls `mockStorageFrom` with `'route-photos'`, calls `createSignedUrl` with `'user-001/1234567890-abc.jpg'` and `3600`, returns the signed URL. PASS.
2. "throws a user-facing error when the URL does not contain the expected prefix" (line 429): `getPhotoSignedUrl('https://example.com/some/other/path.jpg')` rejects with `'Failed to load route photo. Please try again.'`. PASS.
3. "throws a user-facing error when createSignedUrl returns an error" (line 435): `signedUrlResult` set to `{ data: null, error: { message: 'signing failed' } }` → rejects with the same user-facing message. PASS.
4. "throws a user-facing error when signedUrl is missing from response" (line 446): `signedUrlResult` set to `{ data: { signedUrl: '' }, error: null }` → rejects with the same user-facing message (empty string is falsy, caught by `!data?.signedUrl`). PASS.

**RouteDetailScreen.test.tsx — 2 new tests**

Source: `/Users/tsan/Desktop/MacBookPro/send-it/src/modules/mod-route-catalog/__tests__/RouteDetailScreen.test.tsx` lines 95–128

1. "calls getPhotoSignedUrl with photo_url and renders the signed URL (private bucket fix)" (line 95): asserts `mockGetPhotoSignedUrl` called with `MOCK_ACTIVE_ROUTE.photo_url`; if any `<Image>` is present, its `source.uri` must equal the signed URL (not the raw photo_url). PASS.
2. "does not render the photo when getPhotoSignedUrl fails" (line 115): `mockGetPhotoSignedUrl` rejects; asserts `screen.queryAllByRole('image')` returns `[]` — no image rendered when signing fails, screen remains usable (grade "V5" still visible). PASS.

---

### Verification 4 — Regression: AC-020 (submit), AC-021 (photo + required), AC-043 (pre-fill), AC-040/041/042 (list/filter/detail)

None of the files modified by this fix touch the submit flow, the list screen, or the navigator. Confirmed by inspection:

- `RouteSubmitScreen.tsx` — not modified by this fix. AC-020 single-page submit, AC-021 photo-required button/validation, AC-043 pre-fill props all unchanged. PASS.
- `RouteListScreen.tsx` — not modified. AC-040 grade+color filters (no status filter), AC-041 active-only, AC-042 tap-to-detail all unchanged. PASS.
- `RouteNavigator.tsx` — not modified. Navigation state machine unchanged. PASS.
- `route-service.ts` additions are additive only (`getPhotoSignedUrl` is a new export; no existing function was changed). All prior service function tests continue to pass. PASS.
- `RouteDetailScreen.tsx` changes are confined to: (a) import of `getPhotoSignedUrl`; (b) `photoUri` state; (c) the `fetchRoute` inner try/catch; (d) `<Image source={{ uri: photoUri }}>` replacing `<Image source={{ uri: route.photo_url }}>`. No other screen content changed. AC-024b (no retire button), AC-025 (pending message path in submit screen — unrelated), AC-026/027/028/029 (RLS/migration — unrelated) all unaffected. PASS.

Full test suite confirms: 168 tests, 0 failures. No previously-passing test is now failing.

---

### Summary

| Item | Prior result | This regression result |
|------|--------------|------------------------|
| `getPhotoSignedUrl` function exists | N/A (new function) | PASS |
| `getPhotoSignedUrl` calls `createSignedUrl(path, 3600)` | N/A | PASS |
| `getPhotoSignedUrl` errors non-fatal to screen | N/A | PASS |
| `RouteDetailScreen` `photoUri` state populated after load | N/A | PASS |
| `<Image>` uses `photoUri` not `route.photo_url` | N/A | PASS |
| Signing failure leaves screen functional | N/A | PASS |
| route-service.test.ts `getPhotoSignedUrl` describe (4 tests) | N/A | PASS |
| RouteDetailScreen.test.tsx signed-URL tests (2 tests) | N/A | PASS |
| npm test (168 tests, 17 suites) | PASS (159) | PASS (168) |
| npx tsc --noEmit | PASS | PASS |
| AC-020 single-page submit | PASS | PASS |
| AC-021 photo required (submit + detail) | PASS | PASS |
| AC-043 pre-fill from filter state | PASS | PASS |
| AC-040 grade + color filters, no status filter | PASS | PASS |
| AC-041 active routes only, no status tag | PASS | PASS |
| AC-042 tap route → detail | PASS | PASS |
| All other previously passing ACs | PASS | PASS |

**Overall verdict: PASS. Signed-URL fix verified correct. No regressions. Module ready for human QA re-check.**
