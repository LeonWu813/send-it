# Auth & Profile (MOD-001) Status

## Engineering Progress

### Implementation — 2026-09-20

**Scaffolding**
- Created-Expo app scaffolded to temp dir and merged into project root (existing .env, .gitignore, .nvmrc, .claude/, project-planning/, supabase/ preserved, not overwritten).
- `app.json` configured: iOS-only (`platforms: ['ios']`), Apple Sign-In plugin enabled, portrait orientation, `userInterfaceStyle: "automatic"`.
- `tsconfig.json`: strict mode enabled, `@types/jest` types added.
- `package.json`: updated name to `send-it`, added all required dependencies.

**Source files created**
- `src/lib/supabase.ts` — Supabase client singleton (only `createClient()` call site in the codebase)
- `src/lib/i18n.ts` — i18next + react-i18next initialization, device locale detection, zh-TW fallback
- `src/lib/theme.ts` — ThemeProvider, light/dark palettes, spacing/typography/border tokens, `useTheme()` hook
- `locales/en/common.json` — English string catalog
- `locales/zh-TW/common.json` — Traditional Chinese string catalog (all keys matching EN)
- `src/modules/mod-auth-profile/types.ts` — `UserProfile`, `PrivacySetting`, `GymListItem`, navigation types
- `src/modules/mod-auth-profile/auth-service.ts` — Email signup/signin, Apple Sign-In, Google OAuth (PKCE), sign-out, profile CRUD, avatar upload
- `src/modules/mod-auth-profile/hooks/useSession.ts` — Reactive session + profile hook
- `src/modules/mod-auth-profile/screens/SignInScreen.tsx` — Email + Apple (visually equivalent to Google) + Google sign-in
- `src/modules/mod-auth-profile/screens/SignUpScreen.tsx` — Email signup with display name
- `src/modules/mod-auth-profile/screens/HomeGymSelectionScreen.tsx` — Gym picker with search, AC-001/AC-002 implemented
- `src/modules/mod-auth-profile/screens/EditProfileScreen.tsx` — Display name, bio, avatar, privacy setting (AC-063)
- `src/modules/mod-auth-profile/AuthNavigator.tsx` — Root navigator: no session → auth screens; session + no home_gym_id → gym selection (onboarding); fully onboarded → app shell
- `supabase/migrations/20260920000001_mod_001_user_profile.sql` — `users` table, privacy_setting enum, RLS policies, auto-create trigger on auth.users, avatars storage bucket
- `App.tsx` — Root entry: i18n import, ThemeProvider, AuthNavigator

**Test files created**
- `src/lib/__tests__/supabase.test.ts`
- `src/lib/__tests__/i18n.test.ts` (includes key completeness check: all EN keys must have zh-TW counterparts)
- `src/modules/mod-auth-profile/__tests__/auth-service.test.ts`
- `src/modules/mod-auth-profile/__tests__/useSession.test.ts`

---

### Self-Check Results

**Automated (scripts/self-check.sh)**
- [SKIP] Build — script could not parse build command from production.md (script limitation; `eas build` requires iOS provisioning which is deferred per setup.md §4)
- [SKIP] Lint — script could not parse lint command from production.md (script limitation; `npm run lint` passes manually — see below)
- [SKIP] Tests — script could not parse test command from production.md (script limitation; `npm test` passes — see below)
- [FAIL] Git scope — script flagged `.env.example` and `project-planning/setup.md` as out-of-scope changes. These are **pre-existing uncommitted changes** (visible in the git status snapshot at session start, before any code was written). I did not modify these files. Not a blocker.

**Manual checks (lint + tests)**
- [PASS] `npm run lint` (tsc --noEmit) — 0 errors
- [PASS] `npm test` — 25 tests, 4 suites, all pass

**Judgment-based items**

- [PASS] Every spec requirement implemented: signup (email/Apple/Google), home gym selection (AC-001, AC-002), privacy setting (AC-063), profile CRUD.
- [PASS] AC-003 (60-second happy path): onboarding is two steps (sign up → gym selection) with no blocking waiting states; satisfiable on 4G.
- [PASS] Apple Sign-In visually equivalent to Google Sign-In (both 48pt height, same visual weight, per App Store requirement called out in spec and production.md).
- [PASS] Supabase client singleton — `createClient()` called only in `src/lib/supabase.ts`.
- [PASS] No hardcoded hex colors in components — all colors use `theme.colors.*` tokens.
- [PASS] All user-facing strings go through `useTranslation('common')` — no inline string literals.
- [PASS] Both EN and zh-TW catalogs complete — key completeness verified by `i18n.test.ts`.
- [PASS] TypeScript strict mode on — no `any` without `// TODO` comment (test mocks use `any` with inline eslint-disable, which is the accepted pattern for mock typing).
- [PASS] No dependencies outside production.md tech stack.
- [PASS] RLS enabled from migration creation (users table, avatars storage bucket).
- [PASS] `privacy_setting` column defaults to `public`; the column controls downstream module access.
- [PASS] Home gym is nullable (partial profiles allowed; onboarding drives user to set it but "Skip" is available).
- [PASS] Edge cases handled: missing email/password/display name, sign-in failure, gym list load failure, avatar upload failure, session not found (PGRST116 → null profile).
- [PASS] No hardcoded URLs, timeouts, or limits — all Supabase URLs read from `process.env.EXPO_PUBLIC_*`.
- [PASS] No AI/LLM API calls in this module — LLM context budget check not applicable.
- [PASS] Not a Spring Boot project — actuator/health checks not applicable.
- [PASS] Code is readable: module, service, hook, screen pattern is clear and consistent.

---

**Result: READY FOR QA** — all judgment-based items pass; automated failures are either script limitations (lint/test/build commands not parsed) or a pre-existing uncommitted diff not introduced by this session.

## QA Results

<!-- Filled by qa-mod-auth-profile agent -->
