# Moderation (Report & Block) (MOD-009) Status

## Engineering Progress

### AC-155 — 2026-09-30

**fetchMyBlockedUsers() added to moderation-service.ts**

- [pass] `BlockedUser` interface exported: `{ userId: string; displayName: string; avatarUrl: string | null }`
- [pass] `fetchMyBlockedUsers()` queries `blocks` joined with `users!blocks_blocked_user_id_fkey(id, display_name, avatar_url)` where `blocker_user_id = currentUserId`, ordered `created_at DESC`
- [pass] Returns `[]` if unauthenticated or no rows; throws user-facing error on Supabase failure
- [pass] Follows existing service patterns (same `supabase.auth.getSession()` pattern as all other functions)
- [pass] `npx tsc --noEmit` — 0 TypeScript errors
- [pass] `npm test -- --watchAll=false` — 422 tests passed (31 suites), 0 failures

**Status**: Complete
**Date**: 2026-09-29

### Deliverables

#### Migrations
- `supabase/migrations/20260929000004_mod_009_moderation.sql` — Creates `report_category` enum, `reports` table (AC-080 user-profile reports), drops the MOD-006 stub `blocks` table and recreates with full schema (`blocker_user_id`, `blocked_user_id`, `created_at`), RLS policies, GRANTs.
- `supabase/migrations/20260929000005_mod_009_block_feed_filter.sql` — `CREATE OR REPLACE` of `get_activity_feed` with updated column names (blocker_user_id / blocked_user_id) and symmetric block filters added to both `ascent_items` and `video_items` CTEs (AC-082, AC-084). Preserves the AC-141 is_reported filter from mod_006.
- `supabase/migrations/20260929000006_mod_009_fix_follows_block.sql` — AC-083 bug fix: drops and recreates `follows_insert_own` RLS policy with a symmetric block check (rejects INSERT when any block exists between follower and followee in either direction); adds `remove_follows_on_block()` SECURITY DEFINER trigger function and `trg_remove_follows_on_block` AFTER INSERT trigger on `blocks` that deletes existing follows in both directions on block creation.

#### Source code (`src/modules/mod-moderation/`)
- `types.ts` — `ReportCategory`, `BlockStatus`, `Report`, `Block` types.
- `moderation-service.ts` — `reportUser`, `blockUser`, `unblockUser`, `fetchBlockedUserIds`, `isBlocked`.
- `components/ReportSheet.tsx` — Modal bottom sheet with category picker (4 options), optional note (max 280 chars), submit→confirmation state (AC-081), cancel/dismiss.
- `components/ModerationActions.tsx` — Report + Block/Unblock controls; never renders for own profile; confirmation feedback after block/unblock.
- `screens/OtherUserProfileScreen.tsx` — Profile view for another user; displays avatar, display_name, bio; ModerationActions below; send history via `fetchProfileHistory` RPC (empty state if privacy-blocked); safe area insets applied.

#### Edge Function
- `supabase/functions/report-digest/index.ts` — Scheduled every 6 hours (AC-085). Queries `reports WHERE status = 'open' AND created_at < now() - 12 hours` with service-role client (bypasses RLS). Logs digest to console (Phase 1 acceptable fallback); structures outbound email for when Resend is configured. Reads `SERVICE_ROLE_KEY` (not `SUPABASE_SERVICE_ROLE_KEY`).

#### i18n
- `locales/en/common.json` — Added `moderation` section with report categories and block strings.
- `locales/zh-TW/common.json` — Added `moderation` section with Traditional Chinese translations.

### Verification
- `npx tsc --noEmit`: 0 errors
- `npx jest --passWithNoTests`: 405 tests passed, 31 suites

### Bug Fix (2026-09-29) — AC-083
QA-found bug: `follows_insert_own` RLS policy had no block check; existing follows not removed on block.
Fix A (migration `20260929000006_mod_009_fix_follows_block.sql`): dropped and recreated `follows_insert_own` with symmetric block check; added `trg_remove_follows_on_block` trigger to remove existing follows server-side on block INSERT.
Fix B (`moderation-service.ts` `blockUser()`): added doc comment noting the DB trigger handles follow removal — no client-side delete needed.
Post-fix verification: `npx tsc --noEmit` 0 errors; `npx jest --passWithNoTests` 405 tests passed, 31 suites.

## QA Results

**QA agent**: qa-mod-moderation
**Mode**: functional-test (first-time verification)
**Date**: 2026-09-29
**Automated test run**: 405 tests passed, 31 suites, exit 0 (full suite; no mod-moderation-specific test files exist)
**TypeScript check**: 0 errors

---

### Acceptance Criteria Results

**PASS AC-080**: Report table schema verified — `report_category` enum has exactly 4 values (`inappropriate`, `spam`, `harassment`, `other`); `reports` table has all required columns (`id`, `reporter_user_id`, `target_type`, `target_id`, `category`, `note`, `status`, `created_at`, `reviewed_at`); `status` defaults to `'open'`; `target_type` defaults to `'user'`. `reportUser()` in `moderation-service.ts` inserts with `target_type: 'user'`, the caller-supplied category, optional note (null when empty), and `status: 'open'`. RLS policy `reports_insert_own` restricts INSERT to authenticated users with `reporter_user_id = auth.uid()`. No SELECT policy for authenticated users — admin (service role) only. `ReportSheet.tsx` exposes all 4 category options via `CATEGORIES` constant and i18n keys. `note` capped at 280 chars via `maxLength` on the TextInput. Input/Output Contract satisfied.

**PASS AC-081**: `ReportSheet.tsx` transitions to a `confirmed` state immediately on successful `reportUser()` call — before any admin action. The component renders a confirmation message and a "Done" dismiss button when `confirmed === true`. No polling or admin dependency in the user-facing flow.

**PASS AC-082**: `blocks` table schema verified — `(blocker_user_id, blocked_user_id)` composite PK, `created_at`, FKs to `public.users(id)`, RLS enabled. `blockUser()` inserts `(blocker_user_id = auth.uid(), blocked_user_id)` and is idempotent on `23505` unique-violation. Feed RPC (`get_activity_feed`) in migration `20260929000005` excludes blocked users' content from the blocker's feed via the `qualifying_followees` CTE and a defense-in-depth NOT EXISTS filter on both `ascent_items` and `video_items`. Unblock via `unblockUser()` deletes the row and feed filtering returns to normal.

**FAIL AC-083**: Input=[user A blocks user B; user B attempts to follow user A], Expected=[follow INSERT rejected by DB], Actual=[follow INSERT succeeds — the `follows_insert_own` RLS policy on `public.follows` only checks `auth.uid() = follower_id AND auth.role() = 'authenticated'`; it does NOT check the `blocks` table in either direction]. Neither MOD-009 migration (`20260929000004`, `20260929000005`) adds a block check to the `follows` INSERT policy. There is no SECURITY DEFINER follow RPC, no DB trigger on `blocks` INSERT, and no client-side guard in `follow()` (`social-feed-service.ts`). The spec additionally requires "Any existing Follow relationship between blocker and blocked user is removed" on block — `blockUser()` in `moderation-service.ts` contains no follow-deletion logic, and no DB trigger on `blocks` INSERT deletes the corresponding `follows` rows.
Route: **Engineer** (implementation does not match spec).
Fix required: (1) Update the `follows_insert_own` RLS policy (or replace direct INSERT with a SECURITY DEFINER RPC) to reject the INSERT when any block exists between follower and followee in either direction. (2) Add follow-removal on block: either a DB trigger on `blocks` INSERT that deletes `follows` rows for both directions, or a call to `unfollow` / direct `follows` DELETE inside `blockUser()`.

**PASS AC-084**: Block hiding is symmetric. `get_activity_feed` (migration `20260929000005`) checks BOTH directions in `qualifying_followees`: `(b.blocker_user_id = auth.uid() AND b.blocked_user_id = f.followee_id)` AND `(b.blocker_user_id = f.followee_id AND b.blocked_user_id = auth.uid())`. A second defense-in-depth symmetric NOT EXISTS filter is applied independently on `ascent_items` and `video_items` CTEs. `fetchBlockedUserIds()` also returns both directions for any client-side surface outside the feed RPC.

**PASS AC-085**: Edge Function `supabase/functions/report-digest/index.ts` reads `SERVICE_ROLE_KEY` (not `SUPABASE_SERVICE_ROLE_KEY` — correct per spec and `production.md` convention). Creates a service-role Supabase client (bypasses RLS). Queries `reports` where `status = 'open'` AND `created_at < now() - 12 hours`. Email body lists: report ID, target type, target ID, category, reporter user ID, created_at (all fields required by spec). Returns early with HTTP 200 when no qualifying reports. Fails safe with HTTP 500 if `SERVICE_ROLE_KEY` or `SUPABASE_URL` are absent. Digest explicitly covers `reports` table only; email body footer states beta-video reports are reviewed separately. Scheduling (every 6 hours) is described in the function header comment. Phase 1 fallback (console.log when Resend is not configured) is implemented.

---

### Infrastructure Documentation Issue

**FAIL setup.md**: `project-planning/setup.md` line 140 instructs `supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key`, using the reserved `SUPABASE_` prefix. Supabase reserves the `SUPABASE_` prefix for its own runtime-injected variables; a secret set under that name will not be found by the Edge Function at runtime. The Edge Function, `.env.example`, and `production.md` all correctly use `SERVICE_ROLE_KEY`. This is a documentation error in `setup.md` that would cause the `report-digest` Edge Function to fail in a real deployment (AC-085 at risk).
Route: **Engineer** (update `setup.md` step 8 to use `SERVICE_ROLE_KEY`, not `SUPABASE_SERVICE_ROLE_KEY`).

---

### Shared Convention Checks

- No hardcoded hex colors in any moderation component — all colors reference `theme.colors.*`. PASS.
- No inline user-facing string literals in components — all strings routed through `useTranslation('common')`. PASS.
- Supabase singleton (`src/lib/supabase.ts`) imported correctly; `createClient()` not called at any moderation call site. PASS.
- i18n catalogs: English `moderation` key block and zh-TW `moderation` key block are present and complete (all 4 categories, report/block/confirmation/error strings). PASS.
- Safe area insets: `OtherUserProfileScreen.tsx` calls `useSafeAreaInsets()` and passes `insets.top` to `makeStyles(theme, topInset)`; `contentContainerStyle` uses `paddingTop: topInset + theme.spacing.md`. PASS. `ReportSheet.tsx` is a modal sheet (positioned below Dynamic Island by iOS automatically) — uses `insets.bottom` for `paddingBottom`. PASS.
- No gold-plating: all 5 source files and 2 migrations correspond to deliverables listed in Engineering Progress. Edge Function is the only function in `supabase/functions/report-digest/`. No extra tables, types, or service functions beyond spec scope.
- `.gitignore` contains `.env`. PASS.
- `Report.status` enum `{open | reviewed | actioned | dismissed}` matches spec. PASS.
- `Block` table PK `(blocker_user_id, blocked_user_id)` matches spec. PASS.
- `ModerationActions` never renders for own profile (`if (targetUserId === currentUserId) return null`). PASS.

---

### Summary

**Result**: BUGS FOUND — 2 failures

1. **AC-083 (implementation bug)**: Follow prevention for blocked users is not enforced at the DB level. `follows_insert_own` RLS policy has no block check. Existing follows are not removed on block. Route to Engineer.
2. **setup.md documentation error**: `setup.md` step 8 uses `SUPABASE_SERVICE_ROLE_KEY` (reserved prefix) instead of `SERVICE_ROLE_KEY`, which would cause `report-digest` Edge Function to fail to load its secret in a real Supabase deployment. Route to Engineer.

---

## QA Run 2 — Regression — 2026-09-29

**QA agent**: qa-mod-moderation
**Mode**: regression-test (re-verification after Engineer bug fix)
**Bugs being re-verified**: AC-083 (follows INSERT policy had no block check; existing follows not removed on block) and setup.md documentation error (SUPABASE_SERVICE_ROLE_KEY → SERVICE_ROLE_KEY)
**Automated test run**: 405 tests passed, 31 suites, exit 0
**TypeScript check**: 0 errors

---

### AC-083 — Regression Verification

**REGRESSION PASS AC-083**: Original failure scenario resolved. Migration `20260929000006_mod_009_fix_follows_block.sql` verified in full:

**Follows INSERT policy (block prevention):**
`follows_insert_own` is dropped (`DROP POLICY IF EXISTS "follows_insert_own" ON public.follows`) and recreated with a symmetric block check:
```sql
WITH CHECK (
  auth.uid() = follower_id
  AND NOT EXISTS (
    SELECT 1 FROM public.blocks b
    WHERE (b.blocker_user_id = follower_id AND b.blocked_user_id = followee_id)
       OR (b.blocker_user_id = followee_id AND b.blocked_user_id = follower_id)
  )
)
```
Scenario A verified by logic inspection: user B attempts to follow user A after A blocks B. `blocks` contains `(blocker_user_id=A, blocked_user_id=B)`. On B's follow INSERT: `follower_id=B`, `followee_id=A`. The NOT EXISTS sub-select finds a row matching the second OR branch (`blocker_user_id=A=followee_id`, `blocked_user_id=B=follower_id`). INSERT rejected. Correct.

Scenario B verified by logic inspection: user A attempts to follow user B after A blocks B. `blocks` contains `(blocker_user_id=A, blocked_user_id=B)`. On A's follow INSERT: `follower_id=A`, `followee_id=B`. The NOT EXISTS sub-select finds a row matching the first OR branch (`blocker_user_id=A=follower_id`, `blocked_user_id=B=followee_id`). INSERT rejected. Both directions correctly prevented.

**Trigger function (existing follow removal):**
`remove_follows_on_block()` created as SECURITY DEFINER (required to bypass `follows` RLS on behalf of the blocking user). `SET search_path = public` prevents search-path injection. Logic:
```sql
DELETE FROM public.follows
WHERE (follower_id = NEW.blocker_user_id AND followee_id = NEW.blocked_user_id)
   OR (follower_id = NEW.blocked_user_id AND followee_id = NEW.blocker_user_id);
```
Deletes follows in both directions on block INSERT, satisfying the spec requirement "Any existing Follow relationship between blocker and blocked user is removed."

**Trigger registration:**
`trg_remove_follows_on_block` is `AFTER INSERT ON public.blocks FOR EACH ROW` — fires correctly after every new block row is committed, not before.

`moderation-service.ts` `blockUser()` updated with a doc comment confirming the trigger handles follow removal server-side (no client-side delete needed). The INSERT into `blocks` still fires the trigger via the standard Supabase client call.

**Ordering dependency** satisfied: migration `20260929000006` runs after `20260924000006_mod_006_social_feed.sql` (which created `follows` + the original `follows_insert_own`) and after `20260929000004_mod_009_moderation.sql` (which created `blocks` with the full schema). File sort order guarantees this.

---

### setup.md Documentation Error — Regression Verification

**REGRESSION PASS setup.md**: Original failure resolved. `grep -n "SUPABASE_SERVICE_ROLE_KEY" project-planning/setup.md` returns no matches. Line 140 now reads `supabase secrets set SERVICE_ROLE_KEY=your-service-role-key` — correct per spec, `.env.example`, and `production.md`. No `SUPABASE_` prefix used.

---

### Re-verification of Previously Passing ACs

**PASS AC-080** (re-verified): `reportUser()` in `moderation-service.ts` unchanged. RLS policy `reports_insert_own` in migration `20260929000004` unchanged. `ReportSheet.tsx` unchanged. Schema, i18n, and Input/Output Contract all intact. No regressions.

**PASS AC-081** (re-verified): `ReportSheet.tsx` `confirmed` state logic unchanged. No new code paths introduced near this feature. No regressions.

**PASS AC-082** (re-verified): `blocks` table schema, `blockUser()`, `unblockUser()`, and feed RPC symmetric filtering in `20260929000005` all unchanged. Migration `20260929000006` adds a trigger on `blocks` INSERT only — it does not alter the `blocks` table schema, the INSERT/DELETE policies, or the feed RPC. No regressions.

**PASS AC-084** (re-verified): `get_activity_feed` (migration `20260929000005`) is untouched by the bug-fix migration. Both `qualifying_followees` NOT EXISTS filters and the defense-in-depth filters on `ascent_items` and `video_items` are intact. `fetchBlockedUserIds()` unchanged. No regressions.

**PASS AC-085** (re-verified): `supabase/functions/report-digest/index.ts` unchanged. `SERVICE_ROLE_KEY` reading confirmed present. Fail-safe on missing config intact. Query covers `reports` table only. No regressions introduced by the bug-fix migration.

---

### Shared Convention Re-checks (adjacent code)

Migration `20260929000006` is the only changed artifact besides the `blockUser()` doc comment. Verified:
- No new source files introduced.
- `remove_follows_on_block()` trigger function uses `SECURITY DEFINER SET search_path = public` — matches the pattern already established in the project for elevated-privilege functions.
- `DROP POLICY IF EXISTS` is idempotent — safe to re-run migration in reset scenarios.
- `DROP TRIGGER IF EXISTS` before `CREATE TRIGGER` — idempotent, no regression risk on re-run.
- No gold-plating: migration adds only the two objects required to fix AC-083 (the revised policy and the trigger function + trigger).
- No new tables, columns, or source files added by the fix.

---

### Summary — QA Run 2

**Result**: PASS — all 5 acceptance criteria verified, no regressions

1. **REGRESSION PASS AC-083**: Follow INSERT policy now rejects inserts when a block exists in either direction. Trigger `trg_remove_follows_on_block` exists and fires AFTER INSERT on `blocks`, removing existing follows in both directions server-side. Original failure scenario resolved.
2. **REGRESSION PASS setup.md**: `SUPABASE_SERVICE_ROLE_KEY` entirely removed from `setup.md`; correct `SERVICE_ROLE_KEY` used at line 140.
3. **AC-080, AC-081, AC-082, AC-084, AC-085**: All re-verified. No regressions introduced by the fix migration or doc-comment update.
