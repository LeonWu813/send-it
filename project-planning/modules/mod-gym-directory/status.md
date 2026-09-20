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

<!-- Filled by qa-mod-gym-directory agent -->
