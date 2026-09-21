# Send Logging (MOD-004) Status

## Engineering Progress

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
- [SPEC ISSUE: The spec does not address whether the ascent list must refresh after a successful log. The current implementation has a stale-list issue. Escalate to PM to clarify whether list refresh after log is a requirement — if so, send back to Engineer.]

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

**Human sign-off required.** Complete Tests A through I in both light and dark mode and confirm each PASS before marking MOD-004 as QA PASS.

---

### Spec Issues Found (for PM review)

1. **Output contract ambiguity — "Success confirmation shown to user"**: The spec's Output Contract states this as a requirement but does not define what form the confirmation must take. The implementation uses modal dismissal as implicit confirmation. If a visible toast/banner is required, this is unimplemented. **Route to PM.**

2. **Ascent list refresh after log not specified**: The spec does not state whether the ascent list must update after a successful log. The current implementation will show a stale list until the user re-navigates to the route detail. **Route to PM to clarify requirement; if required, route to Engineer.**

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
