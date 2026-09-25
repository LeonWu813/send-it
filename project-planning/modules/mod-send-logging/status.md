# Send Logging (MOD-004) Status

## Engineering Progress

### Rev 9 — Remove project style, expose fetchUserAchievements (2026-09-24)

**Mode:** feature (AC-014 + fetchUserAchievements public service function)
**Date:** 2026-09-24
**Engineer:** engineer-mod-send-logging

#### Files Created

- `supabase/migrations/20260924000004_mod_004_drop_project_style.sql` — PG15-safe single-file, single-transaction migration: CREATE ascent_style_v2 without 'project', UPDATE backfill 'project' → 'attempt' rows, ALTER COLUMN TYPE swap via text cast, DROP old type, RENAME to canonical ascent_style

#### Files Modified

- `src/modules/mod-send-logging/types.ts` — `ASCENT_STYLES` narrows from 4 to 3 values (`['flash', 'top', 'attempt']`); `AscentStyle` type drops `'project'`
- `src/modules/mod-send-logging/components/AscentList.tsx` — removed `case 'project':` from `getStyleBadgeColor` switch (would have been a TypeScript exhaustiveness error after the type narrowed)
- `src/modules/mod-send-logging/send-service.ts` — added exported `fetchUserAchievements(routeIds: string[]): Promise<Record<string, 'flash' | 'top' | 'attempt'>>`: batched RLS-scoped SELECT on `ascents`, client-side reduction with `flash:3 > top:2 > attempt:1` precedence, early-return for empty input
- `src/modules/mod-send-logging/__tests__/send-service.test.ts` — updated import to include `fetchUserAchievements`; added `.in()` to `makeQueryBuilder`; added 6 new tests in `describe('fetchUserAchievements')`: empty input (no Supabase call), precedence ordering (flash beats top beats attempt), omitted routes (no ascent → absent from result), empty data array, null data, RLS error thrown
- `src/modules/mod-send-logging/__tests__/LogSendScreen.test.tsx` — renamed 4-chip test to "renders exactly three style chips (flash, top, attempt) — project is removed (AC-014)"; added assertion that `/^Project$|^項目$/` is absent from rendered output
- `locales/en/common.json` — removed `sends.styles.project` key
- `locales/zh-TW/common.json` — removed `sends.styles.project` key

#### Automated Self-Check Results

| Check | Result | Notes |
|-------|--------|-------|
| Build (npx tsc --noEmit) | PASS | Zero TypeScript errors, strict mode on |
| Tests (npm test --watchAll=false) | PASS | 174/174 tests pass, 17 suites — 6 new send-service tests + 1 updated LogSendScreen test |
| i18n parity (EN/zh-TW) | PASS | Both locales have matching key sets after removing sends.styles.project |

#### Judgment-Based Checklist

| Item | Result |
|------|--------|
| AC-014 implemented | PASS — ascent_style enum drops 'project'; ASCENT_STYLES array is 3 values; LogSendScreen renders only flash/top/attempt chips; locale keys removed from both catalogs |
| fetchUserAchievements public service | PASS — exported from send-service.ts; batched; RLS-scoped; flash > top > attempt precedence; empty-input early-return; error thrown on failure |
| Migration ordering correct | PASS — backfill (UPDATE) at step 2 precedes ALTER COLUMN at step 3; single-file single-transaction per spec |
| No hardcoded values | PASS |
| Conventions followed | PASS — Supabase singleton; no createClient() at call site; no any without comment |
| No new dependencies | PASS |

---

### Delete Ascent Feature (2026-09-24)

**Mode:** bugfix (delete send — human QA request)
**Date:** 2026-09-24
**Engineer:** engineer-mod-send-logging

#### Files Modified

- `src/modules/mod-send-logging/send-service.ts` — added `deleteAscent(ascentId: string): Promise<void>`, uses Supabase `.delete().eq('id', ascentId)`, throws user-facing error on failure
- `src/modules/mod-send-logging/components/AscentList.tsx` — added trash-outline delete button on own ascent rows, Alert confirmation dialog, optimistic remove with re-fetch fallback on failure; imported `Ionicons` from `@expo/vector-icons` (already in tech stack)
- `src/modules/mod-send-logging/__tests__/send-service.test.ts` — 2 new tests for `deleteAscent` (success path + error path); updated `makeQueryBuilder` to include `delete` method
- `src/modules/mod-send-logging/__tests__/AscentList.test.tsx` — 3 new tests: delete button only on own ascents, Alert shown on tap, optimistic removal after confirm
- `locales/en/common.json` — added `sendLogging.delete.confirm/cancel/delete` keys
- `locales/zh-TW/common.json` — added `sendLogging.delete.confirm/cancel/delete` zh-TW translations

#### Migration

No new migration required. `ascents_delete_own` RLS policy was already present in `supabase/migrations/20260920000004_mod_004_send_logging.sql` (line 83–84). The coordinator confirmed this in the task; `GRANT DELETE ON public.ascents TO authenticated` is also present.

#### Automated Self-Check Results

| Check | Result | Notes |
|-------|--------|-------|
| Build (npx tsc --noEmit) | PASS | Zero TypeScript errors, strict mode on |
| Tests (npm test --watchAll=false) | PASS | 162/162 tests pass, 17 suites — 5 new tests added (2 send-service, 3 AscentList) |
| Git scope — module boundary | FLAGGED | Same pre-existing pattern: `locales/` changes are production.md-required i18n parity; `.env.example`, `project-planning/setup.md`, `tsconfig.json`, other migration files are pre-existing uncommitted Tech Lead files not authored by this agent |

#### Judgment-Based Checklist

| Item | Result |
|------|--------|
| Task requirements implemented | PASS — RLS DELETE policy confirmed present; `deleteAscent()` added; delete button on own rows; Alert confirmation; i18n keys in EN + zh-TW |
| Every acceptance criterion addressed | PASS — delete is scoped to own ascents (RLS + UI guard); confirmation prevents accidental deletes; optimistic removal updates local state |
| Edge cases handled | PASS — delete button hidden for other users' ascents; failure path re-fetches list to restore accurate state; Alert cancel does nothing |
| No hardcoded values | PASS — all strings via i18n, all colors via theme tokens |
| Conventions followed | PASS — Ionicons from existing `@expo/vector-icons` dep; Supabase singleton; no `createClient()` at call site |
| No new dependencies | PASS — `@expo/vector-icons` already in package.json (used by other modules) |
| Code is readable | PASS — `handleDeleteAscent` intent documented with inline comment; `onDelete` prop typed in `AscentRowProps` with JSDoc |
| Not an AI/LLM module | N/A |
| Spring Boot items | N/A — React Native project |

---

## Engineering Progress (Previous)

**Mode:** bugfix (AC-013 addition)
**Date:** 2026-09-21
**Engineer:** engineer-mod-send-logging

### Files Created

- `supabase/migrations/20260920000004_mod_004_send_logging.sql` — ascents table, ascent_style enum, RLS policies
- `src/modules/mod-send-logging/types.ts` — AscentStyle, Ascent, AscentWithProfile, AscentLogInput types
- `src/modules/mod-send-logging/send-service.ts` — logAscent(), loadAscentsForRoute() with Supabase singleton
- `src/modules/mod-send-logging/screens/LogSendScreen.tsx` — log form (style selector, attempts, date, note, is_private toggle)
- `src/modules/mod-send-logging/screens/RouteSearchScreen.tsx` — route search for global "+" entry point
- `src/modules/mod-send-logging/components/AscentList.tsx` — ascent list wired into RouteDetailScreen placeholder slot
- `src/modules/mod-send-logging/test-utils.tsx` — test providers (ThemeProvider + i18n)
- `src/modules/mod-send-logging/__tests__/send-service.test.ts` — 9 tests
- `src/modules/mod-send-logging/__tests__/LogSendScreen.test.tsx` — 6 tests
- `src/modules/mod-send-logging/__tests__/AscentList.test.tsx` — 8 tests (added AC-013 re-fetch test)

### Files Modified (spec-mandated cross-boundary)

- `src/modules/mod-route-catalog/screens/RouteDetailScreen.tsx` — wired AscentList + LogSendScreen Modal into the MOD-003 placeholder slot (spec explicitly requires this); updated for AC-013: added `ascentRefreshKey` state incremented by `handleLogSendSuccess()`, passed as `refreshKey` prop to `AscentList`
- `locales/en/common.json` — added `sends.*` i18n keys (required by production.md i18n rules)
- `locales/zh-TW/common.json` — added `sends.*` zh-TW translations (required by production.md i18n parity rule)

### AC-013 Fix Summary

**Problem:** After `logAscent()` succeeded, `handleLogSendSuccess()` in `RouteDetailScreen` closed the modal but did not trigger `AscentList` to re-fetch. The newly logged ascent was invisible until the user navigated away and back.

**Fix:**
- Added `ascentRefreshKey: number` state (initialized to `0`) in `RouteDetailScreen`
- `handleLogSendSuccess()` now calls `setAscentRefreshKey((prev) => prev + 1)` after closing the modal
- `AscentList` gained optional prop `refreshKey?: number` (default `0`)
- `refreshKey` added to `AscentList`'s `useEffect` dependency array (not `useCallback`), so the effect re-fires — and re-fetches — whenever the parent increments the key

**Test added:** `AscentList.test.tsx` — "re-fetches ascents when refreshKey increments (AC-013)" — verifies `loadAscentsForRoute` is called a second time when `refreshKey` goes from 0 to 1, and the new ascent appears in the rendered list.

### Automated Self-Check Results (bugfix pass)

| Check | Result | Notes |
|-------|--------|-------|
| Build (npx tsc --noEmit) | PASS | Zero TypeScript errors, strict mode on |
| Tests (npm test) | PASS | 119/119 tests pass, 15 suites — 1 new test added for AC-013 |
| Git scope — module boundary | FLAGGED | Same pattern as initial implement: RouteDetailScreen.tsx is a spec-required cross-boundary write; .env.example and project-planning/setup.md are pre-existing uncommitted Tech Lead files not touched by this agent |

**Note on git scope flag:** Identical situation to initial engineering pass. `RouteDetailScreen.tsx` is the spec-mandated cross-boundary file. Pre-existing uncommitted files (`.env.example`, `project-planning/setup.md`) are not authored by this agent.

### Judgment-Based Checklist (bugfix pass)

| Item | Result |
|------|--------|
| Every spec requirement implemented | PASS — AC-010, AC-011, AC-012, AC-013 all covered |
| Every acceptance criterion has observable behavior | PASS — AC-013: refreshKey increment verified by unit test; re-fetch confirmed with two sequential mockResolvedValue calls |
| Edge cases handled | PASS — refreshKey defaults to 0 (backward-compatible); initial mount still fetches via useEffect; retry button still triggers manual re-fetch |
| No hardcoded values | PASS — no hex colors, no hardcoded strings, no hardcoded URLs |
| Conventions followed | PASS — useTheme() tokens only, useTranslation() for all strings, supabase singleton, RLS-first |
| No new dependencies | PASS — no new packages added |
| Code is readable | PASS — refreshKey intent documented in both AscentList prop JSDoc and RouteDetailScreen inline comment |
| Not an AI/LLM module | N/A |
| Spring Boot items | N/A — React Native project |

---

## QA Results

**QA Agent:** qa-mod-send-logging
**Date:** 2026-09-20
**Workflow:** functional-test (first-time verification)
**Verdict:** PENDING HUMAN SIGN-OFF (frontend module — automated checks PASS, UI must be verified in simulator/device)

---

### Automated Test Results

| Check | Result | Detail |
|-------|--------|--------|
| `npm test` (full suite) | PASS | 118/118 tests, 15 suites, exit 0 |
| `npx tsc --noEmit` | PASS | Zero TypeScript errors, strict mode enabled |
| mod-send-logging unit tests | PASS | 24 tests across 3 suites (send-service: 9, LogSendScreen: 6, AscentList: 7, plus 2 bonus tests = 24 total) |

---

### Manual Inspection Results

**AC-011: Grade not stored on ascent row**
- PASS (inspected): `supabase/migrations/20260920000004_mod_004_send_logging.sql` — `ascents` table has no `grade` column. The word "grade" appears only in comments confirming its absence.
- PASS (inspected): `src/modules/mod-send-logging/types.ts` — `Ascent` interface has no `grade` field. `AscentLogInput` has no `grade` field. Comments explicitly document this.
- PASS (test): `send-service.test.ts` line 94 — `it('does not include a grade field in the insert payload')` — verifies insert payload has no `grade` property.
- PASS (test): `LogSendScreen.test.tsx` line 136 — `it('does not include a grade field in the logAscent call payload')` — verifies call args have no `grade`.
- PASS (inspected): Grade is displayed in `LogSendScreen` by reading `routeGrade` prop (from `route.grade`) — read-only, not stored.

**AC-012: Clear error message on network failure (no silent failure)**
- PASS (inspected): `send-service.ts` logAscent() — throws `Error('Failed to save your send. Please check your connection and try again.')` on any Supabase error.
- PASS (inspected): `LogSendScreen.tsx` handleSubmit() — catch block sets `errorMessage` state; errorMessage renders in a visible `errorContainer` with red background. `setErrorMessage(null)` is called at start of each submit attempt (AC-012 requirement: clear previous error on re-try).
- PASS (inspected): `onSuccess()` is called only inside the `try` block — never called on error path.
- PASS (test): `LogSendScreen.test.tsx` line 101 — `it('shows a clear error message on network failure (AC-012)')` — verifies error text appears and onSuccess not called.

**AC-010: ≤4 taps to log from route detail page**
- PASS (inspected): Tap flow from route detail — (1) "Log Send" button in AscentList → Modal opens with LogSendScreen prefilled with route and default style ('top') → (2) optional style chip tap → (3) Submit button press. Minimum 2 taps (Log + Submit), maximum 3 taps when changing style. The spec flow "route → log → style → confirm" maps to exactly 4 interactions counting route navigation. SATISFIES ≤4.
- PENDING HUMAN SIGN-OFF: cannot verify tap count in a simulator from CLI.

**Global "+" Entry Point (spec requirement)**
- PASS (inspected): `RouteSearchScreen.tsx` exists and implements route search for the global "+" flow.
- PASS (inspected): Screen accepts a gym ID, calls `listRoutes()`, and calls `onRouteSelected(route)` when a route is tapped — allowing the caller to proceed to `LogSendScreen`.
- PENDING HUMAN SIGN-OFF: cannot verify that the global "+" button is wired in the app's navigation from CLI.

**Flash style forces attempts = 1**
- PASS (inspected): `LogSendScreen.tsx` line 79: `resolvedAttempts = style === 'flash' ? 1 : Math.max(1, parseInt(attempts, 10) || 1)` — flash always resolves to 1.
- PASS (inspected): `handleStyleSelect('flash')` calls `setAttemptsRaw('1')` and the TextInput is `editable={style !== 'flash'}`.
- PASS (test): `LogSendScreen.test.tsx` line 122 — `it('locks attempts to 1 when flash style is selected')` verifies flash hint text appears.

**Attempts minimum = 1**
- PASS (inspected): DB migration: `attempts INTEGER NOT NULL CHECK (attempts >= 1)`.
- PASS (inspected): `resolvedAttempts = Math.max(1, parseInt(attempts, 10) || 1)` — client-side floor of 1.

**RLS policies**
- PASS (inspected): Migration enables RLS and defines 4 policies:
  - `ascents_select_own_or_public`: own rows always visible; other users' rows visible only if `is_private = FALSE`.
  - `ascents_insert_own`: `auth.uid() = user_id` enforced.
  - `ascents_update_own`: own rows only.
  - `ascents_delete_own`: own rows only.
- PENDING HUMAN SIGN-OFF: live Supabase environment needed to verify RLS enforcement at runtime.

**i18n Conventions (production.md)**
- PASS: All user-facing strings go through `useTranslation('common')`. No inline string literals in render paths.
- PASS: EN locale has 176 keys, zh-TW has 176 keys — zero key mismatch (verified by script).
- PASS: All `sends.*` keys used in code (`sends.logSend`, `sends.grade`, `sends.gradeNote`, `sends.style`, `sends.attempts`, `sends.attemptsFlashHint`, `sends.attemptsCount`, `sends.date`, `sends.note`, `sends.notePlaceholder`, `sends.private`, `sends.privateDescription`, `sends.privateLabel`, `sends.submit`, `sends.ascentsSectionTitle`, `sends.noAscents`, `sends.gymIdPlaceholder`, `sends.search`, `sends.selectRoute`, `sends.styles.*`, `sends.errors.*`) are present in both locales.

**Theming Conventions (production.md)**
- PASS: No hardcoded hex colors anywhere in the module. All colors reference `theme.colors.*` tokens.
- PASS: All spacing, font sizes, border radii use `theme.spacing.*`, `theme.fontSize.*`, `theme.borderRadius.*` tokens.

**Supabase Singleton Convention (production.md)**
- PASS: `send-service.ts` imports `{ supabase } from '../../lib/supabase'` — the shared singleton. No `createClient()` call at the module level.
- PASS: No `service_role` key referenced anywhere in module code.

**TypeScript Strict Mode**
- PASS: `tsconfig.json` has `"strict": true`, `"strictNullChecks": true`. `tsc --noEmit` exits clean.
- NOTE: One `// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase join shape is untyped at runtime` in `send-service.ts` — permitted by production.md convention when reason is documented.

**Module directory structure (production.md)**
- PASS: Module at `src/modules/mod-send-logging/` matching the module map.
- PASS: Tests in `__tests__/` subdirectory. One test file per source file.

**Gold-plating check (no extra features)**
- PASS: No features beyond spec scope. Module does not implement: offline queue, likes on sends, comments on sends, per-user grade override, send history/stats (MOD-008), feed rendering (MOD-006).

**Spec template comments check**
- PASS: No HTML template comments (`<!-- ... -->`) found in spec.md.

**Output contract — "Success confirmation shown to user"**
- OBSERVATION: On successful submit, `onSuccess()` is called → modal closes → user returns to RouteDetailScreen. There is no explicit toast, banner, or success message rendered. The modal dismissal is the implicit confirmation. The spec says "Success confirmation shown to user" but does not specify the form of that confirmation. This is a spec ambiguity — the implementation uses modal dismissal as implicit confirmation.
- [SPEC ISSUE: The Output contract says "Success confirmation shown to user" but does not define what form of confirmation is required (toast, banner, text, or implicit modal dismissal). If a visible confirmation message is required, this is an unimplemented feature. Escalate to PM for clarification — not to Engineer, since the spec is ambiguous.]

**AscentList refresh after log**
- OBSERVATION: `handleLogSendSuccess()` closes the modal by setting `isLogSendVisible(false)`. The comment says "Ascent list will re-fetch automatically via its own useEffect when remounted" — but AscentList is always mounted in RouteDetailScreen (not inside the Modal). AscentList's `useEffect` only fires on mount and when `routeId` or `t` changes. Closing the modal does not cause AscentList to re-mount or re-fetch. The newly logged ascent will NOT appear in the list until the user leaves and re-enters RouteDetailScreen.
- The spec does not explicitly require the list to refresh after logging. This is a UX gap but not a spec violation.
- [SPEC ISSUE: The spec does not address whether the ascent list must refresh after a successful log. The current implementation will show a stale list until the user re-navigates to the route detail. **Route to PM to clarify requirement; if required, route to Engineer.**]

---

### Human Sign-off Required (MOD-004 Frontend)

QA cannot verify React Native UI behavior from CLI. Complete the following test script in a device simulator before marking MOD-004 as QA PASS.

**Environment:** iOS Simulator (iPhone 12 or newer, iOS 16+), both Light and Dark mode.

---

#### TEST A: Log a send from Route Detail page (AC-010 — ≤4 taps)

1. Sign in with a test account.
2. Navigate to any gym → tap any active route → RouteDetailScreen loads.
3. Scroll to the "Sends" section. Confirm the "Log Send" button is visible.
4. **Tap 1:** Tap "Log Send" button → LogSendScreen modal slides up.
5. Confirm the modal shows:
   - Grade displayed (read-only, from the route — not an editable field).
   - Style chips: Flash, Top, Attempt, Project.
   - Default style "Top" is pre-selected.
   - Attempts field shows "1", is editable.
   - Date field shows today's date (YYYY-MM-DD).
   - Note field (optional).
   - Private toggle (off by default).
   - "Log Send" submit button.
6. **Tap 2:** Tap "Flash" style chip. Confirm:
   - Attempts field shows "1" and becomes non-editable (greyed out).
   - Flash hint text "Flash = 1 attempt only." appears.
7. **Tap 3:** Tap the "Log Send" submit button. Confirm:
   - Loading spinner appears on the button briefly.
   - Modal closes automatically.
   - No error message is shown.
8. **PASS CRITERIA:** Total taps from Route Detail to completion = 3 (Log Send button + style chip + submit). Satisfies ≤4. Record actual tap count.

---

#### TEST A2: AC-013 — Ascent list refreshes immediately after successful log

1. Sign in with a test account.
2. Navigate to a route detail page. Note the current ascents listed in the "Sends" section.
3. Tap "Log Send" → fill in style and tap submit → modal closes.
4. **Without navigating away**, observe the ascent list immediately below.
5. **PASS CRITERIA:** The newly logged send appears in the ascent list without requiring the user to navigate away and back. The list should update within the same screen session, immediately after the modal dismisses.

---

#### TEST B: Grade is displayed but not editable (AC-011)

1. From LogSendScreen, confirm the grade shown matches `Route.grade` exactly.
2. Try to tap or edit the grade field. Confirm there is no way to change it.
3. **PASS CRITERIA:** Grade displayed matches route grade. Grade is read-only.

---

#### TEST C: Network failure shows clear error (AC-012)

1. Enable Airplane Mode on the simulator.
2. Navigate to Route Detail → tap "Log Send" → fill in any style → tap submit.
3. Confirm:
   - An error message appears (not blank, not a spinner that never resolves).
   - The error text is user-readable (e.g., "Failed to save your send. Please check your connection and try again.").
   - The submit button becomes tappable again after the error.
   - Tapping submit again (still in Airplane Mode) shows the error again.
4. Disable Airplane Mode → tap submit → confirm success.
5. **PASS CRITERIA:** Error is visible and user-readable. No silent failure. Data is not lost when error occurs (form fields retain values). onSuccess is NOT called until the network request actually succeeds.

---

#### TEST D: Flash forces attempts = 1 (boundary)

1. Open LogSendScreen.
2. Tap the "Attempt" or "Project" style chip. Set attempts to "5".
3. Tap the "Flash" chip. Confirm attempts snaps to "1" and the field is locked.
4. Try to type in the attempts field while Flash is selected. Confirm it is not editable.
5. **PASS CRITERIA:** Flash always submits with attempts = 1 regardless of prior input.

---

#### TEST E: Attempts minimum = 1 (boundary)

1. Open LogSendScreen with style = "Top".
2. Clear the attempts field (empty string). Tap submit.
3. Confirm that attempts submitted is 1 (not 0, not NaN, not null).
4. (Cannot verify this without checking the DB directly — acceptable to verify via unit test coverage which confirms `Math.max(1, parseInt('', 10) || 1) === 1`.)
5. **PASS CRITERIA:** No ascent row is created with attempts < 1.

---

#### TEST F: Private toggle hides send from other users (RLS)

1. Log a send with is_private = ON (toggle enabled).
2. Sign out. Sign in with a different test account.
3. Navigate to the same route detail. Confirm the private send does NOT appear in the list.
4. Sign back in as the original user. Confirm the private send IS visible (with "Private" label).
5. **PASS CRITERIA:** Private sends hidden from other authenticated users; visible to own user.

---

#### TEST G: Global "+" entry point

1. Locate the global "+" button in the app's navigation (tab bar or FAB).
2. Tap it. Confirm RouteSearchScreen appears.
3. Enter a valid Gym ID and tap Search. Confirm route results appear.
4. Tap a route. Confirm LogSendScreen opens with that route pre-filled.
5. Submit a send. Confirm success.
6. **PASS CRITERIA:** Full flow from global "+" to successful log completes without errors.

---

#### TEST H: zh-TW locale

1. Change device locale to Traditional Chinese (zh-TW) or use in-app language toggle.
2. Navigate to Route Detail → tap "Log Send".
3. Confirm all labels are in zh-TW (e.g., "記錄完攀", "難度", "完攀方式", "嘗試次數", "日期", "備註", "設為私人").
4. Confirm all four style chips show Chinese labels: 閃攀, 完攀, 嘗試, 項目.
5. Confirm error message (with Airplane Mode) is in zh-TW.
6. **PASS CRITERIA:** All sends.* keys render correctly in zh-TW. No missing translations (empty strings or key names shown raw).

---

#### TEST I: Dark mode

1. Switch device to Dark mode.
2. Open LogSendScreen. Confirm:
   - No hardcoded hex colors visible (all surfaces adapt to dark theme).
   - Text is legible.
   - Error container is visible in dark mode.
3. **PASS CRITERIA:** All screens render correctly in dark mode using theme tokens only.

---

**Human sign-off required.** Complete Tests A through I (including new Test A2 for AC-013) in both light and dark mode and confirm each PASS before marking MOD-004 as QA PASS.

---

### Spec Issues Found (for PM review)

1. **Output contract ambiguity — "Success confirmation shown to user"**: The spec's Output Contract states this as a requirement but does not define what form the confirmation must take. The implementation uses modal dismissal as implicit confirmation. If a visible toast/banner is required, this is unimplemented. **Route to PM.**

2. **Ascent list refresh after log not specified** (original run): The spec did not state whether the ascent list must update after a successful log. **This was addressed by PM via AC-013 addition (Revision 3). See QA Run 2 below.**

---

### Summary

| Category | Result |
|----------|--------|
| Automated tests | PASS — 118/118 |
| TypeScript | PASS — zero errors |
| AC-011 (grade not stored) | PASS — code inspection + unit tests |
| AC-012 (error on failure) | PASS — code inspection + unit tests |
| AC-010 (≤4 taps) | PENDING HUMAN SIGN-OFF |
| i18n parity (EN/zh-TW) | PASS — 176 keys each, zero mismatch |
| No hardcoded hex colors | PASS |
| Supabase singleton convention | PASS |
| RLS policies defined | PASS (runtime enforcement needs live DB) |
| Global "+" entry point | PASS (code exists, wiring needs human verification) |
| Spec issues | 2 spec ambiguities escalated to PM |

**Overall status: PENDING HUMAN SIGN-OFF** — all automated and inspection checks pass. The 2 spec issues are escalated to PM. Human must complete the test script above before this module is marked QA PASS.

---

## QA Run 2 — Regression — 2026-09-21

**QA Agent:** qa-mod-send-logging
**Workflow:** regression-test (re-verification after AC-013 spec addition + implementation)
**Re-verifying:** AC-013 — ascent list must refresh immediately after a successful log without re-navigation (added to spec in Revision 3; stale-list pattern previously identified as a spec issue in QA Run 1).

---

### Automated Test Results

| Check | Result | Detail |
|-------|--------|--------|
| `npm test` (full suite) | PASS | 119/119 tests, 15 suites, exit 0 |
| `npx tsc --noEmit` | PASS | Zero TypeScript errors, strict mode enabled |
| i18n parity (EN/zh-TW) | PASS | 176 keys each, zero mismatch — no new keys added |

---

### AC-013 Verification (New Requirement)

**Spec (AC-013):** After a send is successfully logged, the ascent list on the route detail screen refreshes immediately to show the new entry without requiring re-navigation.

**Implementation inspected:**

- `AscentList.tsx` — `AscentListProps` interface defines `refreshKey?: number` (optional, defaults to `0`) at line 36.
- `AscentList.tsx` — `useEffect` dependency array includes both `fetchAscents` and `refreshKey` at line 88: `[fetchAscents, refreshKey]`. When `refreshKey` changes, the effect re-fires and calls `fetchAscents()`, which calls `loadAscentsForRoute()`. The pattern correctly separates the re-fetch trigger (in `useEffect`) from the fetch logic (in `useCallback`), so incrementing `refreshKey` does not widen the `fetchAscents` identity.
- `RouteDetailScreen.tsx` — `ascentRefreshKey` state initialized to `0` at line 63.
- `RouteDetailScreen.tsx` — `handleLogSendSuccess()` (lines 105–110): closes modal with `setIsLogSendVisible(false)`, then increments key with `setAscentRefreshKey((prev) => prev + 1)`.
- `RouteDetailScreen.tsx` — `<AscentList ... refreshKey={ascentRefreshKey} />` at line 247: key wired from state.
- `handleLogSendCancel()` (lines 112–114): only calls `setIsLogSendVisible(false)` — does NOT increment `ascentRefreshKey`. Cancellation correctly does not trigger a re-fetch.

**Unit test:** `AscentList.test.tsx` line 157–182 — "re-fetches ascents when refreshKey increments (AC-013)":
- Renders with `refreshKey={0}`, `loadAscentsForRoute` returns one ascent. Verifies called once and first ascent visible.
- Re-renders with `refreshKey={1}`. Verifies `loadAscentsForRoute` called a second time and second ascent appears in list.
- Test passes (confirmed by 119/119 suite pass).

REGRESSION PASS AC-013: Implementation is correct. `AscentList` re-fetches when `refreshKey` increments; `RouteDetailScreen` increments it only on success (not on cancel). Unit test verifies the full re-fetch cycle.

**Human sign-off item added:** Test A2 (above) added to the manual test script — verifies the ascent list updates in the simulator without re-navigation after a successful log.

---

### Previously Passing Items — Re-verification

**AC-010 (≤4 taps):**
- REGRESSION PASS: No changes to `LogSendScreen`, tap flow, or `handleLogSendPress`. The `handleLogSendSuccess` change only adds `setAscentRefreshKey` after `setIsLogSendVisible(false)` — no effect on the modal open/close tap flow. PASS (code inspection + no test regressions).
- PENDING HUMAN SIGN-OFF: unchanged from QA Run 1.

**AC-011 (grade not stored):**
- REGRESSION PASS: No changes to `send-service.ts`, `types.ts`, or migration SQL. `logAscent()` payload and `Ascent` schema unchanged. 9/9 send-service tests pass including "does not include a grade field in the insert payload". PASS.

**AC-012 (clear error on failure):**
- REGRESSION PASS: No changes to `LogSendScreen.tsx` error handling path. `handleSubmit()` catch block, `errorMessage` state, and `onSuccess`-only-on-try logic all unchanged. 6/6 LogSendScreen tests pass. PASS.

**i18n parity (EN/zh-TW):**
- REGRESSION PASS: 176 keys in EN, 176 keys in zh-TW, zero mismatch. No new i18n keys were added in this fix. PASS.

**No hardcoded hex colors:**
- REGRESSION PASS: No new style definitions added to `AscentList.tsx` or `RouteDetailScreen.tsx`. All existing styles use theme tokens. PASS.

**Supabase singleton convention:**
- REGRESSION PASS: No changes to service imports. PASS.

**Gold-plating check:**
- REGRESSION PASS: `refreshKey` prop is exactly what AC-013 requires — an opaque counter for triggering re-fetch. No additional behavior added beyond the spec requirement. PASS.

**TypeScript strict mode:**
- REGRESSION PASS: `tsc --noEmit` exits with zero errors. `refreshKey?: number` is correctly typed as optional number with a default value. PASS.

---

### New Regressions

None found. All 119 tests pass. No new TypeScript errors. No previously passing manual checks have changed.

---

### Summary — QA Run 2

| Category | Result |
|----------|--------|
| Automated tests | PASS — 119/119 (+1 new test for AC-013) |
| TypeScript | PASS — zero errors |
| AC-013 (list refreshes after log) | REGRESSION PASS — code inspection + unit test |
| AC-010 (≤4 taps) | REGRESSION PASS (code) / PENDING HUMAN SIGN-OFF (UI) |
| AC-011 (grade not stored) | REGRESSION PASS |
| AC-012 (error on failure) | REGRESSION PASS |
| i18n parity (EN/zh-TW) | REGRESSION PASS — 176 keys each |
| No hardcoded hex colors | REGRESSION PASS |
| Supabase singleton convention | REGRESSION PASS |
| New regressions | None |

**Overall status: PENDING HUMAN SIGN-OFF** — AC-013 is implemented and verified via code inspection and unit test. All previously passing checks continue to pass. Human must complete the updated test script (Tests A through I, including new Test A2 for AC-013) before this module is marked QA PASS.

---

## QA Run 3 — Regression — 2026-09-24

**QA Agent:** qa-mod-send-logging
**Workflow:** regression-test (re-verification after delete ascent feature added from human QA feedback)
**Re-verifying:** New delete ascent feature — `deleteAscent()` in send-service, trash-outline button in AscentList, Alert confirmation, optimistic removal, i18n keys in both locales.

---

### Automated Test Results

| Check | Result | Detail |
|-------|--------|--------|
| `npm test -- --watchAll=false` (full suite) | PASS | 162/162 tests, 17 suites, exit 0 |
| `npx tsc --noEmit` | PASS | Zero TypeScript errors, strict mode enabled |
| mod-send-logging unit tests | PASS | 5 new tests added: 2 in send-service (deleteAscent success + error), 3 in AscentList (delete button only on own rows, Alert fires on tap, optimistic removal on confirm) |

NOTE: Two `act(...)` warnings appear in the test output from `RequestGymScreen.test.tsx` and `RouteSubmitScreen.test.tsx` — both are a pre-existing pattern caused by Ionicons async font loading in those modules. These warnings appeared in prior QA runs and are not introduced by this change. The `AscentList.test.tsx` suite runs without this warning.

---

### Delete Feature Verification

**deleteAscent() in send-service.ts:**
- REGRESSION PASS (inspected): `deleteAscent(ascentId: string): Promise<void>` at line 25 calls `.from('ascents').delete().eq('id', ascentId)`. Checks `error` field; if truthy throws `Error('Failed to delete your send. Please try again.')`. Returns `void` on success (no data returned, correct for a DELETE).
- REGRESSION PASS (inspected): RLS policy `ascents_delete_own` at `supabase/migrations/20260920000004_mod_004_send_logging.sql` line 81–84: `FOR DELETE USING (auth.uid() = user_id)`. Policy was pre-existing; no new migration needed. `GRANT DELETE ON public.ascents TO authenticated` confirmed at line 88.
- REGRESSION PASS (test): `send-service.test.ts` "deletes an ascent row by ID without returning data" — verifies `mockFrom` called with `'ascents'`, `qb.delete` called, `qb.eq` called with `('id', 'ascent-001')`, resolves to `undefined`.
- REGRESSION PASS (test): `send-service.test.ts` "throws a user-friendly error on network / DB failure" — verifies rejects with `'Failed to delete your send. Please try again.'` when Supabase returns an error object.

**Delete button visibility — own ascents only:**
- REGRESSION PASS (inspected): `AscentList.tsx` line 174 passes `isOwn={ascent.user_id === session.user.id}` to each `AscentRow`. `AscentRow` at line 212 renders the delete button only inside `{isOwn && (...)}`. Other-user rows receive `isOwn={false}` and the button is absent entirely.
- REGRESSION PASS (test): `AscentList.test.tsx` "shows a delete button only for the current user's own ascents" — renders one own ascent (`user_id: 'user-001'`) and one other-user ascent (`user_id: 'user-002'`) with session `user.id: 'user-001'`. Queries for buttons with `accessibilityLabel === 'Delete'` (EN) or `'刪除'` (zh-TW). Asserts `toHaveLength(1)` — only the own row gets the button.

**Alert confirmation dialog:**
- REGRESSION PASS (inspected): `handleDeleteAscent` at line 96 calls `Alert.alert(t('sendLogging.delete.confirm'), undefined, [...])` with two buttons: cancel (`style: 'cancel'`) and delete (`style: 'destructive'`). The delete button's `onPress` performs the optimistic remove and calls `deleteAscent`. Tapping cancel leaves state unchanged (no `onPress` on cancel button).
- REGRESSION PASS (test): `AscentList.test.tsx` "shows Alert confirmation dialog when delete button is tapped" — spies on `Alert.alert`, taps the delete button, asserts `alertSpy.toHaveBeenCalledTimes(1)`.

**Optimistic removal with re-fetch fallback:**
- REGRESSION PASS (inspected): `handleDeleteAscent` line 111: `setAscents((prev) => prev.filter((a) => a.id !== ascentId))` — removes row from local state immediately. Line 112: `void deleteAscent(ascentId).catch(() => { void fetchAscents(); })` — if the delete call rejects, triggers a full re-fetch to restore accurate state. The `.catch()` path is correctly bound to `fetchAscents` (in `useCallback` dependency), so re-fetch uses the stable callback reference.
- REGRESSION PASS (test): `AscentList.test.tsx` "calls deleteAscent and removes the row optimistically when user confirms" — mocks `Alert.alert` to immediately invoke the destructive button handler, verifies `mockDeleteAscent` called with `'ascent-001'`, and verifies `screen.queryByText('Leon')` is null (row removed from render).

**i18n keys — sendLogging.delete.* in both locales:**
- REGRESSION PASS (inspected + script): EN locale has `sendLogging.delete.confirm = "Delete this send?"`, `sendLogging.delete.cancel = "Cancel"`, `sendLogging.delete.delete = "Delete"`. zh-TW locale has `sendLogging.delete.confirm = "刪除這筆紀錄？"`, `sendLogging.delete.cancel = "取消"`, `sendLogging.delete.delete = "刪除"`. Both locales have 190 keys total (up from 176 after this and other additions since QA Run 2) — zero mismatch (verified by key-flatten script).

**No hardcoded colors in new delete button styles:**
- REGRESSION PASS (inspected): `deleteButton` style at line 333 uses only `theme.spacing.xs` for padding. `Ionicons` icon color set to `theme.colors.textSecondary` — a theme token. No hex literals in any new style block.

**Supabase singleton convention:**
- REGRESSION PASS: `send-service.ts` still imports `{ supabase } from '../../lib/supabase'`. `deleteAscent` uses the singleton directly; no `createClient()` at the call site.

**No new dependencies:**
- REGRESSION PASS: `@expo/vector-icons` (used for `Ionicons`) was already in `package.json` and used by MOD-002 and MOD-003 screens. This addition does not introduce a new package.

---

### Previously Passing Items — Re-verification

**AC-010 (≤4 taps):**
- REGRESSION PASS: No changes to `LogSendScreen` or modal open/close tap flow. The delete button is an independent affordance on existing ascent rows and does not affect the log-send tap count. 6/6 LogSendScreen tests pass. PASS.
- PENDING HUMAN SIGN-OFF: unchanged. See Test A in the manual test script above.

**AC-011 (grade not stored):**
- REGRESSION PASS: No changes to `send-service.ts` `logAscent()` or `types.ts`. `deleteAscent` adds no `grade` field. 9 send-service tests (including "does not include a grade field") + 2 new deleteAscent tests all pass. PASS.

**AC-012 (clear error on failure):**
- REGRESSION PASS: No changes to `LogSendScreen.tsx`. 6/6 LogSendScreen tests pass. PASS.

**AC-013 (list refreshes after log):**
- REGRESSION PASS: `refreshKey` prop and `useEffect` dependency array in `AscentList.tsx` are unchanged. The delete flow uses optimistic state update (not `refreshKey`), so the two mechanisms are independent and do not interfere. The AC-013 unit test "re-fetches ascents when refreshKey increments" still passes. PASS.

**i18n parity (EN/zh-TW):**
- REGRESSION PASS: 190 keys in EN, 190 keys in zh-TW — zero mismatch. The 3 new `sendLogging.delete.*` keys are present and matching in both locales. PASS.

**Gold-plating check:**
- REGRESSION PASS: Delete feature is scoped to own rows only (UI guard + RLS). No offline queue, no comments, no likes, no grade override, no stats — all non-goals from the spec are still absent. PASS.

**TypeScript strict mode:**
- REGRESSION PASS: `tsc --noEmit` exits with zero errors. `deleteAscent(ascentId: string): Promise<void>` is correctly typed. `AscentRowProps.onDelete` typed as `(ascentId: string) => void`. No `any` without documented reason. PASS.

---

### New Human Sign-off Tests (added this run)

Append the following to the existing manual test script (Tests A–I above). Complete in iOS Simulator before marking QA PASS.

---

#### TEST J: Delete own send — confirmation and removal

**Environment:** iOS Simulator (iPhone 12 or newer, iOS 16+), Light and Dark mode.

1. Sign in with the test account that has at least one logged ascent on a route.
2. Navigate to that route's detail screen. Observe the ascent list — the own send is visible.
3. Tap the trash icon on an own ascent row. Confirm:
   - An alert dialog appears with a confirmation message (e.g., "Delete this send?").
   - Two buttons are present: a cancel option and a destructive delete option.
4. Tap Cancel. Confirm the row remains in the list — no deletion occurred.
5. Tap the trash icon again. Tap the Delete (destructive) button. Confirm:
   - The row disappears immediately from the list (optimistic removal).
   - No error message appears.
6. Refresh the screen (navigate away and back). Confirm the deleted send is no longer present.
7. **PASS CRITERIA:** Trash icon visible only on own rows. Confirmation alert fires before any deletion. Cancel leaves the row. Confirm removes the row optimistically and the deletion persists on re-fetch.

---

#### TEST K: Delete button absent on other users' sends

1. Navigate to a route detail that has at least one send from another user (not the signed-in account).
2. Inspect the ascent list. Confirm:
   - No trash icon is visible on rows belonging to other users.
   - The trash icon is visible only on own rows (if any exist).
3. **PASS CRITERIA:** Trash icon never rendered on rows where `ascent.user_id !== session.user.id`.

---

#### TEST L: Delete failure re-fetches list (error recovery)

1. Enable Airplane Mode.
2. Navigate to a route with an own ascent.
3. Tap the trash icon → confirm delete in the alert. Confirm:
   - The row disappears immediately (optimistic removal fires before the network call).
   - After the network call fails, the row reappears in the list (re-fetch fallback restores state).
4. **PASS CRITERIA:** On delete failure, the row is restored to the list so the user does not lose data. No silent data corruption.

---

#### TEST M: zh-TW delete labels

1. Set device locale to zh-TW.
2. Navigate to a route with an own ascent. Tap the trash icon.
3. Confirm the alert text is in zh-TW: confirmation message "刪除這筆紀錄？", cancel button "取消", delete button "刪除".
4. **PASS CRITERIA:** All three `sendLogging.delete.*` keys render in zh-TW. No raw key names or English fallback strings shown.

---

**Updated human sign-off scope:** Tests A–I (unchanged from QA Run 2) plus new Tests J–M for the delete feature. Complete all tests in both Light and Dark mode before marking MOD-004 as QA PASS.

---

### New Regressions

None found. All 162 tests pass. No new TypeScript errors. No previously passing manual or code-inspection checks have changed.

---

### Summary — QA Run 3

| Category | Result |
|----------|--------|
| Automated tests | PASS — 162/162 (+5 new tests for delete feature) |
| TypeScript | PASS — zero errors |
| deleteAscent() — correct DELETE + error throw | REGRESSION PASS — code inspection + unit tests |
| RLS DELETE policy pre-existing in migration | REGRESSION PASS — confirmed in migration SQL |
| Delete button only on own rows (UI guard) | REGRESSION PASS — code inspection + unit test |
| Alert confirmation before delete | REGRESSION PASS — code inspection + unit test |
| Optimistic removal with re-fetch fallback | REGRESSION PASS — code inspection + unit test |
| i18n parity (EN/zh-TW) — 3 new delete keys | REGRESSION PASS — 190 keys each, zero mismatch |
| No hardcoded hex colors | REGRESSION PASS |
| No new dependencies | REGRESSION PASS — @expo/vector-icons pre-existing |
| Supabase singleton convention | REGRESSION PASS |
| AC-010 (≤4 taps) | REGRESSION PASS (code) / PENDING HUMAN SIGN-OFF (UI) |
| AC-011 (grade not stored) | REGRESSION PASS |
| AC-012 (error on failure) | REGRESSION PASS |
| AC-013 (list refreshes after log) | REGRESSION PASS |
| New regressions | None |

**Overall status: PENDING HUMAN SIGN-OFF** — all automated and code-inspection checks pass. Delete feature is implemented and verified. Human must complete the updated test script (Tests A–M) before marking MOD-004 as QA PASS.
