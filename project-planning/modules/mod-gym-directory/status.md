# Gym Directory (MOD-002) Status

## Engineering Progress

### Implementation — 2026-09-20

**Files created:**
- `supabase/migrations/20260920000002_mod_002_gym_directory.sql` — gyms table, gym_requests table, RLS policies, FK to users.home_gym_id, updated_at trigger, 13-gym Phase 1 seed
- `src/modules/mod-gym-directory/types.ts` — Gym, GymSummary, GymRequestInput, GymListFilters types
- `src/modules/mod-gym-directory/gym-service.ts` — listGyms(), loadGym(), submitGymRequest()
- `src/modules/mod-gym-directory/screens/GymListScreen.tsx` — searchable/filterable gym directory list with gym_type badges
- `src/modules/mod-gym-directory/screens/GymDetailScreen.tsx` — full gym detail (name, branch, city/district, address, map pin, gym type, photo, bouldering_only_note)
- `src/modules/mod-gym-directory/screens/RequestGymScreen.tsx` — "request a gym" form (name + city + optional maps URL) with success confirmation
- `src/modules/mod-gym-directory/GymNavigator.tsx` — local-state navigator for list/detail/request views
- `src/modules/mod-gym-directory/test-utils.tsx` — ThemeProvider + i18n wrapper for screen tests
- `src/modules/mod-gym-directory/__tests__/gym-service.test.ts` — 11 tests
- `src/modules/mod-gym-directory/__tests__/GymListScreen.test.tsx` — 6 tests
- `src/modules/mod-gym-directory/__tests__/GymDetailScreen.test.tsx` — 6 tests
- `src/modules/mod-gym-directory/__tests__/RequestGymScreen.test.tsx` — 5 tests

**Files updated (legitimately cross-cutting):**
- `App.tsx` — AppShell updated to render GymNavigator (spec explicitly permits this)
- `locales/en/common.json` — gymDirectory i18n keys added (required by spec: all strings via t())
- `locales/zh-TW/common.json` — gymDirectory zh-TW i18n keys added (required by spec: both EN and zh-TW)

**Database migration covers:**
- `gyms` table with all spec columns + RLS (authenticated users can SELECT; only service_role can INSERT/UPDATE/DELETE)
- `gym_requests` table with RLS (authenticated users can INSERT; only service_role/admin can SELECT/UPDATE)
- FK constraint from `users.home_gym_id` → `gyms.id` (deferred from MOD-001 as noted in migration comment)
- All 13 Phase 1 seed gyms (Taipei + New Taipei; Camp4 and Wusa excluded per spec)
- Mixed gyms (double8, 永和) seeded with `bouldering_only_note`

### Self-Check Results — 2026-09-20

**Automated (self-check.sh):**
- [SKIP] Build — production.md uses a markdown table for commands; script grep pattern expects `Build: <cmd>` inline format and did not match. Manual confirmation: build command is `eas build --profile production --platform ios` (iOS simulator builds require Apple Developer credentials; TypeScript compilation is verified via lint).
- [SKIP] Lint — same script pattern issue. Manual run: `npm run lint` (tsc --noEmit) → PASS (0 errors).
- [SKIP] Test — same script pattern issue. Manual run: `npm test` → PASS (53/53 tests, 8 suites).
- [FAIL] Git scope — script flags App.tsx, locales/en/common.json, locales/zh-TW/common.json as out-of-scope. These are legitimately required by the mod-gym-directory spec: (a) App.tsx update is explicitly permitted by the spec ("you may update it to render the gym directory as the authenticated home screen"); (b) locale files are required by spec ("All user-facing strings through useTranslation(). Both EN and zh-TW keys required."). Additionally, .env.example and project-planning/setup.md are pre-existing uncommitted changes from MOD-001 (not made by this module). No unintended files were modified.

**Judgment-based:**
- [PASS] Every requirement in spec.md implemented — gym directory, gym detail, search/filter, gym_type badge, request form, 13 seed rows, migration, RLS, AppShell updated.
- [PASS] AC-004 addressed — GymListScreen + GymDetailScreen render name, city/district, gym type badge, photo (placeholder shown when photo_url is null).
- [PASS] AC-070 addressed — RequestGymScreen accepts name + city + optional Google Maps URL, inserts to gym_requests with status=pending, shows confirmation state on success.
- [PASS] Edge cases handled — empty search returns empty state, load failure shows error + retry button, gym not found returns null from service, whitespace trimmed from request form inputs, empty google_maps_url stored as null.
- [PASS] No hardcoded hex colors — all colors use theme.colors.* tokens from useTheme().
- [PASS] No hardcoded strings in components — all user-facing strings use useTranslation().
- [PASS] No new dependencies introduced — uses only packages already in production.md tech stack.
- [PASS] Supabase client singleton used — no new createClient() calls; imports from src/lib/supabase.ts.
- [PASS] TypeScript strict mode — no untyped `any` except in test mock builder (commented with justification).
- [PASS] Test coverage — one test file per source file (gym-service, GymListScreen, GymDetailScreen, RequestGymScreen); tests cover success, error, and edge cases.
- [PASS] i18n completeness — all EN keys have zh-TW counterparts in gymDirectory namespace.
- [PASS] RLS-first — gyms table SELECT allowed for authenticated users; INSERT/UPDATE/DELETE reserved for service_role. gym_requests INSERT allowed for authenticated users; SELECT/UPDATE/DELETE reserved for service_role.
- [PASS] Mixed gyms handled — double8 and 永和 seeded with gym_type='both' and bouldering_only_note; note displayed on detail screen.
- [PASS] Code readable — service layer separated from UI, clear prop interfaces, named callback props (onSelectGym, onRequestGym, onBack).

## QA Results

**Workflow**: functional-test (first-time verification)
**QA Agent**: qa-mod-gym-directory
**Date**: 2026-09-20

### Automated Test Suite

Command: `npm test -- --watchAll=false`
Result: 53/53 tests passed, 8 suites, exit code 0
New suites added by this module: 4 (gym-service.test.ts, GymListScreen.test.tsx, GymDetailScreen.test.tsx, RequestGymScreen.test.tsx — 28 tests)

### TypeScript Compilation

Command: `npx tsc --noEmit`
Result: PASS — 0 errors, 0 warnings

### Acceptance Criteria

**PASS AC-004**: GymListScreen renders the Taipei/New Taipei branch-level gym directory showing name, city/district, gym_type badge for every gym. GymDetailScreen shows name, branch_label (when present), city/district, address_text, lat/lng coordinates (map pin), gym_type badge, photo (when present; placeholder shown when absent), official_grading_system. All 13 Phase 1 seed gyms are present in the migration; Camp4 and Wusa are explicitly absent from the seed INSERT (confirmed by comment and row count). Verification method: code inspection of screens + migration SQL + automated test suite.

**PASS AC-070**: RequestGymScreen accepts gym name (required), city (required), Google Maps URL (optional). On submit, gym-service.submitGymRequest() inserts a gym_requests row with status='pending' and requested_by_user_id from the authenticated session. On success, the screen transitions to a confirmation state ("Request Submitted!"). On failure, an error message is displayed. Empty name or city is rejected (submit button disabled). Verification method: code inspection + RequestGymScreen tests (5/5 passing).

### Requirement-Level Verification

**PASS REQ-01 (RLS — gyms table)**: Migration enables RLS on gyms table; policy "gyms_select_authenticated" grants SELECT to auth.role() = 'authenticated'. No INSERT/UPDATE/DELETE policy exists for regular users — only service_role bypasses RLS per Supabase behavior. Verified by reading migration SQL lines 40–50.

**PASS REQ-02 (RLS — gym_requests table)**: Migration enables RLS on gym_requests; policy "gym_requests_insert_own" grants INSERT WITH CHECK (auth.uid() = requested_by_user_id AND auth.role() = 'authenticated'). No SELECT/UPDATE/DELETE policy for regular users — only service_role can read or update queue. Verified by reading migration SQL lines 74–86.

**PASS REQ-03 (Seed data — 13 gyms, excluded gyms absent)**: Migration contains exactly 13 INSERT value tuples (numbered 1–13 in comments). Camp4 達文西攀岩館 and Wusa 攀岩館 are absent from the INSERT and explicitly documented in the exclusion comment (line 105). Verified by counting comment markers and inspecting seed rows.

**PASS REQ-04 (Seed data — mixed gyms have bouldering_only_note)**: double8 岩究所 (row 9, gym_type='both') and 永和攀岩場 (row 13, gym_type='both') are seeded with bouldering_only_note = 'Only the bouldering area is represented in Send It. Top-rope routes are excluded.' Verified by reading migration SQL lines 234–248 and 293–307.

**PASS REQ-05 (FK — users.home_gym_id)**: Migration adds FK constraint users_home_gym_id_fkey referencing gyms(id) ON DELETE SET NULL. Verified by reading migration SQL lines 54–57.

**PASS REQ-06 (updated_at trigger)**: Migration creates gyms_set_updated_at() trigger function and attaches it BEFORE UPDATE on gyms. Verified by reading migration SQL lines 89–101.

**PASS REQ-07 (Search by name and district)**: GymListScreen filters the gym list in-memory using a query that matches against gym.name, gym.name_zh, gym.district, and gym.branch_label (case-insensitive). Empty search returns all gyms. No-match search shows "No gyms found." Verified by code inspection (GymListScreen.tsx lines 76–94) and GymListScreen tests (6/6 passing, including empty-state and search tests).

**PASS REQ-08 (Filter by gym type)**: GymListScreen provides gym_type filter chips (Bouldering, Mixed). Selecting a type filters the list to matching gyms; deselecting resets the filter. Verified by code inspection (lines 87–93, 162–180).

**PASS REQ-09 (Filter by district)**: GymListScreen derives available districts from the loaded gym data and renders district filter chips dynamically. Verified by code inspection (lines 66–73, 144–160).

**PASS REQ-10 (No hardcoded hex colors)**: Searched all .tsx and .ts files in src/modules/mod-gym-directory/ for hex color patterns (#[0-9a-fA-F]{3,6}). No matches found. All color references use theme.colors.* tokens from useTheme(). Verified by grep.

**PASS REQ-11 (All user-facing strings through useTranslation())**: All text rendered in GymListScreen, GymDetailScreen, RequestGymScreen, and GymNavigator uses t() from useTranslation('common'). No inline string literals appear in JSX text nodes. Verified by reading all screen files.

**PASS REQ-12 (EN locale keys complete)**: gymDirectory namespace present in locales/en/common.json with all keys: title, searchPlaceholder, noResults, gymTypeBadge (bouldering/topRope/both/mixed), detail (location/coordinates/gradingSystem/noPhoto), requestGym (cta/title/subtitle/nameLabel/namePlaceholder/cityLabel/cityPlaceholder/mapsUrlLabel/mapsUrlPlaceholder/submit/successTitle/successBody/errors), errors (loadFailed/notFound). Verified by reading locale file.

**PASS REQ-13 (zh-TW locale keys complete)**: gymDirectory namespace present in locales/zh-TW/common.json with all keys matching EN locale structure. All 28 keys have zh-TW counterparts. Verified by reading locale file and comparing key sets.

**PASS REQ-14 (Supabase client singleton)**: gym-service.ts imports supabase from '../../lib/supabase'. No createClient() calls in any module file. Verified by grep.

**PASS REQ-15 (No service_role key in client code)**: No reference to service_role key in src/modules/mod-gym-directory/. Verified by grep.

**PASS REQ-16 (TypeScript strict mode)**: npx tsc --noEmit exits with 0 errors. No untyped `any` in production source files. Test mock builder uses `any` with an explicit justification comment per the TypeScript strict mode convention in production.md.

**PASS REQ-17 (App.tsx updated — GymNavigator rendered for authenticated session)**: App.tsx AppShell renders GymNavigator with the authenticated session prop when session is non-null. Verified by reading App.tsx.

**PASS REQ-18 (One row per branch for multi-branch gyms)**: CORNER is seeded as 2 rows (中山店, 華山店); T-UP 原岩 is seeded as 5 rows (萬華, 南港, 新店, 中和, 明德). Each row has a distinct branch_label. Verified by reading migration seed section.

**PASS REQ-19 (.gitignore covers .env)**: grep '^\.env$' .gitignore returns '.env'. Verified by bash.

**PASS REQ-20 (Spec has no HTML template comments)**: No <!-- ... --> markers found in spec.md. Verified by grep.

### Edge Cases Verified

- **Empty search text**: listGyms() returns all gyms; filter applies no restriction — confirmed by code inspection (query = '' → matchesSearch is always true via `!query` short-circuit).
- **gym not found (PGRST116)**: loadGym() returns null without throwing; GymDetailScreen shows "Gym not found." error — verified by test (GymDetailScreen.test.tsx line 121).
- **google_maps_url empty or whitespace**: submitGymRequest() stores null instead of empty string — verified by service test (line 202) and code inspection (gym-service.ts line 84: `?.trim() || null`).
- **whitespace in name/city fields**: RequestGymScreen trims before submitting; submitGymRequest() also trims — double-trimming is harmless. Verified by service test.
- **DB error on listGyms**: GymListScreen shows error message + Retry button; pressing Retry re-calls listGyms() — verified by GymListScreen tests (lines 150–189).
- **DB error on loadGym**: GymDetailScreen shows error message + Retry button — verified by GymDetailScreen test (line 130).
- **DB error on submitGymRequest**: RequestGymScreen shows inline error; does not transition to success state — verified by RequestGymScreen test (line 124).

### Gold-Plating Check

Two columns not listed in the spec data model are present in the implementation:

1. `name_zh` (TEXT NOT NULL) — stores the Chinese gym name alongside the English `name`. Not listed in the spec's data model section, but consistent with the app's Taiwan-first, bilingual (EN + zh-TW) design. The seed table in the spec lists gyms with Chinese names; `name_zh` enables bilingual display without using i18n for data content. Assessment: necessary for the spec's implicit bilingual requirement — not gold-plating.

2. `bouldering_only_note` — not listed in the spec's data model column list, but directly required by the Key Implementation Notes ("Mixed gyms are included; only their bouldering areas are represented in-app") and referenced in the detail output contract. Assessment: implementation mechanism for a stated requirement — not gold-plating.

No features implemented beyond what the spec defines or implies.

### Cosmetic Observation (not a spec violation)

GymDetailScreen uses the error key `gymDirectory.errors.loadFailed` which resolves to "Failed to load gyms. Please try again." — this message says "load gyms" (plural) while the context is loading a single gym's detail. The spec does not define specific error message text, so this is not a spec violation. Routing decision: cosmetic; not sent to Engineer.

### Overall Verdict

**QA PASS** — All acceptance criteria (AC-004, AC-070) verified. All 20 requirements checked. 53/53 automated tests pass. TypeScript compilation clean. No spec violations found.

---

## QA Results — Regression (Safe Area Inset Bugfix)

**Workflow**: regression (static code review)
**QA Agent**: qa-mod-gym-directory
**Date**: 2026-09-21
**Scope**: Safe area inset bugfix — three screens updated to use `useSafeAreaInsets()`

### Verification Checklist

All three screens verified against the following items:

| Check | GymListScreen | GymDetailScreen | RequestGymScreen |
|---|---|---|---|
| `useSafeAreaInsets` imported from `react-native-safe-area-context` | PASS (L25) | PASS (L24) | PASS (L25) |
| `useSafeAreaInsets()` called inside component | PASS (L42) | PASS (L41) | PASS (L43) |
| `makeStyles` called with `(theme, insets.top)` | PASS (L43) | PASS (L42) | PASS (L44) |
| `makeStyles` signature accepts `topInset: number` as second param | PASS (L267) | PASS (L194) | PASS (L203) |
| Primary container `paddingTop` is `topInset + theme.spacing.md` | PASS (L273, root) | PASS (L201, contentContainer) | PASS (L210, contentContainer) |
| No `padding` shorthand on contentContainer/centeredContainer | PASS | PASS | PASS |
| No fixed/bare `paddingTop` values remaining | PASS | PASS | PASS |
| `centeredContainer` has dynamic `paddingTop` | PASS (L280) | PASS (L210) | PASS (L219) |
| Original logic, data fetching, navigation, UI structure unchanged | PASS | PASS | PASS |
| No new TypeScript errors (visual check) | PASS | PASS | PASS |

### Notes

- GymDetailScreen and RequestGymScreen are ScrollView-based screens. Correctly, `paddingTop` lives on `contentContainer` (not `root`), which is the standard React Native ScrollView pattern. `centeredContainer` (used for loading/error/success states) also carries `paddingTop: topInset + theme.spacing.md` since it is a full-screen `View`, not a ScrollView.
- GymListScreen is a plain View-based screen. `paddingTop` correctly lives on `root`.
- No regressions from the original QA pass detected.

### Overall Verdict

**QA PASS (REGRESSION)** — All three screens correctly implement the safe area inset fix. No regressions in logic, data fetching, navigation, or UI structure. Static code review complete.

---

## QA Results — Regression (Bilingual columns + City filter + AC-005 View Routes)

**Workflow**: regression
**QA Agent**: qa-mod-gym-directory
**Date**: 2026-09-22
**Scope**: Three new changes since last QA pass:
1. Bilingual `city_zh` / `district_zh` columns (DB migration + types + service + UI)
2. City filter chips (Taipei / New Taipei) replacing district + gym-type filters
3. Gym type badge removed from list and detail screens
4. AC-005: "View Routes" button at bottom of GymDetailScreen + `routes` view state in GymNavigator

### Automated Test Suite

Command: `npm test -- --watchAll=false`
Result: 123/123 tests passed, 15 suites, exit code 0

Note: Jest does not run the TypeScript compiler — it transpiles via Babel. Type errors in test files do not cause Jest failures. See TypeScript section below.

### TypeScript Compilation

Command: `npx tsc --noEmit`
Result: **FAIL — exit code 2, 6 errors**

All 6 errors are in `src/modules/mod-gym-directory/__tests__/GymDetailScreen.test.tsx`. Every `render(<GymDetailScreen ...)` call is missing the newly required `onViewRoutes` prop. When AC-005 was implemented, `GymDetailScreenProps` gained a required `onViewRoutes: (gymId: string, gymName: string) => void` prop, but the test file was not updated to pass it.

Affected lines: 78, 93, 115, 127, 137, 150.
Error text (representative): `error TS2741: Property 'onViewRoutes' is missing in type '{ gymId: string; onBack: Mock<any, any, any>; }' but required in type 'GymDetailScreenProps'.`

**Classification: implementation bug** — the test file must be updated to pass `onViewRoutes={jest.fn()}` to all six `render` calls, and a new test should cover the `onViewRoutes` callback behavior.

### Acceptance Criteria

**PASS AC-006**: Tapping a gym row in GymListScreen calls `onSelectGym(item.id)` → GymNavigator sets `view = { name: 'detail', gymId }` → GymDetailScreen renders with that gymId. Unchanged from prior QA pass; no regression detected.

**PASS AC-004 (updated scope — bilingual city/district)**: GymListScreen and GymDetailScreen render city and district using `localizedCity()` / `localizedDistrict()` helpers that check `i18n.language.startsWith('zh')` and select `city_zh` / `district_zh` when true. Both helpers present in both screen files. Types (`Gym`, `GymSummary`) include `city_zh` and `district_zh` fields. Service layer (`GYM_SUMMARY_SELECT`, `GYM_DETAIL_SELECT`) fetches both columns. Migration `20260922000001_mod_002_city_district_zh.sql` adds the columns and populates all 13 seeded rows. Verified by reading all four files.

**PASS AC-004 (updated scope — city filter chips)**: GymListScreen renders two `Pressable` chip components labeled via `t('gymDirectory.cityFilter.taipei')` and `t('gymDirectory.cityFilter.newTaipei')`. Pressing a chip sets `cityFilter` to `'Taipei'` or `'New Taipei'`; pressing the active chip toggles it back to `null`. The `filteredGyms` memo compares `gym.city === cityFilter` (English value stored in DB) — this is correct and consistent with the DB seed values. City filter chip i18n keys are present in both `locales/en/common.json` (`"taipei": "Taipei"`, `"newTaipei": "New Taipei"`) and `locales/zh-TW/common.json` (`"taipei": "台北市"`, `"newTaipei": "新北市"`). Verified by reading GymListScreen.tsx and both locale files.

**PASS AC-004 (updated scope — gym type badge absent)**: No reference to `gymTypeBadge`, gym type badge rendering, or badge-style UI element exists in GymListScreen.tsx or GymDetailScreen.tsx. The `gym_type` field is read only for the `isMixed` check (`gym?.gym_type === 'both'`) that gates `bouldering_only_note` display — this is correct behavior, not a badge. Verified by grep across both screen files.

**FAIL AC-005**: "View Routes" button implementation is partially correct but has two bugs:

  **BUG-1 (TypeScript compilation failure — implementation bug)**: `GymDetailScreen.test.tsx` does not pass the required `onViewRoutes` prop to any of its 6 `render` calls. `npx tsc --noEmit` exits with code 2 and 6 errors. The test file was not updated when `onViewRoutes` was added as a required prop. Fix: add `onViewRoutes={jest.fn()}` to all 6 render calls in `GymDetailScreen.test.tsx`, and add a test that verifies pressing "View Routes" calls `onViewRoutes` with the correct `gymId` and `gymName`.

  **BUG-2 (Back navigation target — implementation bug)**: `GymNavigator.tsx` line 87 passes `onBackToGym={navigateToList}` to `RouteNavigator`. This means pressing "Back" from the route catalog returns the user to the gym **list**, not the gym **detail**. The expected behavior (stated in the human QA brief and consistent with the navigation flow in the spec: list → detail → routes) is that back from routes returns to the gym **detail** that launched the route view. The correct implementation is to pass `onBackToGym={() => navigateToDetail(view.gymId)}` (when `view.name === 'routes'`) so the user returns to the same gym detail, not the full list. Fix: in GymNavigator, when rendering `RouteNavigator`, pass `onBackToGym={() => setView({ name: 'detail', gymId: view.gymId })}` instead of `navigateToList`.

  Items verified as passing for AC-005:
  - "View Routes" button present in GymDetailScreen at the bottom of the ScrollView (after bouldering_only_note), always visible without additional action. Verified: GymDetailScreen.tsx lines 180–189.
  - `viewRoutesButton` style uses `backgroundColor: theme.colors.primary` and `alignItems: 'center'` — visually prominent, not a link. Verified: lines 311–318.
  - `onViewRoutes` prop exists in `GymDetailScreenProps` and is called with `(gym.id, gym.name)` on press. Verified: lines 34, 182.
  - `GymNavigator` has a `routes` view state that renders `RouteNavigator` with `gymId`, `gymName`, `session`. Verified: lines 34, 82–88.
  - `gymDirectory.detail.viewRoutes` i18n key is present in both locale files ("View Routes" / "查看路線"). Verified by reading both locale files.

**PASS AC-070**: No changes to RequestGymScreen or submitGymRequest(); no regression detected.

### Requirement-Level Verification (new changes only)

**PASS REQ-21 (city_zh / district_zh columns in types)**: `Gym` and `GymSummary` interfaces both include `city_zh: string` and `district_zh: string`. Verified: types.ts lines 22–23 (Gym), 44–45 (GymSummary).

**PASS REQ-22 (city_zh / district_zh in service SELECT)**: `GYM_SUMMARY_SELECT` includes `city_zh, district_zh`. `GYM_DETAIL_SELECT` includes `city_zh, district_zh`. Verified: gym-service.ts lines 15–20.

**PASS REQ-23 (bilingual display helpers in both screens)**: `localizedCity()` and `localizedDistrict()` functions are defined in both GymListScreen.tsx (lines 38–43) and GymDetailScreen.tsx (lines 37–42). Both check `i18n.language.startsWith('zh')` and return the appropriate column. Verified by reading both files.

**PASS REQ-24 (search includes bilingual city/district)**: `filteredGyms` memo in GymListScreen matches against `gym.city_zh` and `gym.district_zh` in addition to the English fields. Verified: lines 85–88.

**PASS REQ-25 (migration populates all 13 rows)**: `20260922000001_mod_002_city_district_zh.sql` contains exactly 13 UPDATE statements, one per seeded gym, with correct Chinese city and district names. All 13 gym English names match the base migration seed. Verified by reading the migration file.

**PASS REQ-26 (no gym type badge in list or detail)**: Grep of GymListScreen.tsx and GymDetailScreen.tsx for `gymTypeBadge`, badge-related styles, and gym_type rendering (excluding the `isMixed` guard) finds no badge UI elements. The `gymTypeBadge` i18n keys remain in the locale files but are not referenced from any screen — this is acceptable (unused keys are not a spec violation; they may be removed in a cleanup pass).

**FAIL REQ-27 (TypeScript compilation clean)**: `npx tsc --noEmit` exits with 6 errors in `GymDetailScreen.test.tsx`. See BUG-1 under AC-005.

**FAIL REQ-28 (onBackToGym returns to gym detail)**: `GymNavigator` passes `onBackToGym={navigateToList}` to `RouteNavigator`, which navigates to the gym list on back. Expected: navigates to gym detail. See BUG-2 under AC-005.

### Overall Verdict

**QA FAIL** — Two implementation bugs found.

**BUG-1**: `GymDetailScreen.test.tsx` missing required `onViewRoutes` prop in all 6 `render` calls — causes TypeScript compilation failure (`npx tsc --noEmit` exits code 2, 6 errors). Fix: add `onViewRoutes={jest.fn()}` to all 6 render calls; add a test for the "View Routes" button press behavior.

**BUG-2**: `GymNavigator.tsx` line 87 passes `onBackToGym={navigateToList}` to `RouteNavigator` — back navigation from route catalog returns user to the gym list instead of the gym detail that launched the routes view. Fix: pass `onBackToGym={() => setView({ name: 'detail', gymId: view.gymId })}` when rendering `RouteNavigator`.

---

## QA Results — Regression (BUG-1 and BUG-2 fix verification)

**Workflow**: regression (bug fix verification)
**QA Agent**: qa-mod-gym-directory
**Date**: 2026-09-22
**Scope**: BUG-1 and BUG-2 from prior QA pass (AC-005 View Routes — TypeScript failure and back-navigation target)

### BUG-1 Verification — GymDetailScreen.test.tsx onViewRoutes prop

**Fix verified by**: static code inspection of `src/modules/mod-gym-directory/__tests__/GymDetailScreen.test.tsx` and `npx tsc --noEmit`.

All 6 `render(...)` calls now include `onViewRoutes={jest.fn()}`:
- Line 78: `render(<GymDetailScreen gymId="gym-001" onBack={jest.fn()} onViewRoutes={jest.fn()} />, renderOptions())`
- Line 93: `render(<GymDetailScreen gymId="gym-009" onBack={jest.fn()} onViewRoutes={jest.fn()} />, renderOptions())`
- Line 115: `render(<GymDetailScreen gymId="gym-004" onBack={jest.fn()} onViewRoutes={jest.fn()} />, renderOptions())`
- Line 127: `render(<GymDetailScreen gymId="nonexistent" onBack={jest.fn()} onViewRoutes={jest.fn()} />, renderOptions())`
- Line 137: `render(<GymDetailScreen gymId="gym-001" onBack={jest.fn()} onViewRoutes={jest.fn()} />, renderOptions())`
- Line 150: `render(<GymDetailScreen gymId="gym-001" onBack={onBack} onViewRoutes={jest.fn()} />, renderOptions())`

A 7th test (lines 160–175) verifies pressing "View Routes" calls `onViewRoutes` with `'gym-001'` and `'MegaSTONE Climbing Gym'`.

`npx tsc --noEmit` result: **EXIT 0 — 0 errors**.

**Result: PASS**

### BUG-2 Verification — GymNavigator.tsx onBackToGym callback

**Fix verified by**: static code inspection of `src/modules/mod-gym-directory/GymNavigator.tsx`.

The `routes` render block (lines 82–89) now passes:

```
onBackToGym={() => setView({ name: 'detail', gymId: view.gymId })}
```

This is an inline callback — not `navigateToList`. Pressing "Back" from the route catalog returns the user to the gym detail screen for the same `gymId`, not to the gym list. This matches the expected navigation flow (list → detail → routes → back to detail).

**Result: PASS**

### Automated Test Suite

Command: `npm test -- --watchAll=false`
Result: 124/124 tests passed, 15 suites, exit code 0

Note: test count increased from 123 to 124 — the new "calls onViewRoutes with gymId and gymName when View Routes is pressed" test is included and passing.

### TypeScript Compilation

Command: `npx tsc --noEmit`
Result: **PASS — exit code 0, 0 errors**

### Overall Verdict

**QA PASS** — Both bugs are fixed. TypeScript compilation is clean. All 124 automated tests pass. No regressions detected.

MOD-002 overall QA verdict: **QA PASS**
