# Moderation (Report & Block) (MOD-009) Status

## Engineering Progress

### INT-011 self-block constraint + INT-012 barrel index.ts (2026-10-20)

**INT-011 — No self-block constraint (HIGH)**

Two-part fix:

1. **Migration** `supabase/migrations/20261013000007_mod_009_int_011_blocks_no_self_block.sql` — adds `CHECK (blocker_user_id <> blocked_user_id)` constraint named `blocks_no_self_block` to `public.blocks`. Prevents self-block at the database level. Filed as a new migration (existing migration not edited).

2. **Service guard** in `moderation-service.ts` `blockUser()` — guard added after `blockerUserId` is resolved from session, before the Supabase INSERT:
   ```typescript
   if (blockedUserId === blockerUserId) {
     throw new Error('Cannot block yourself');
   }
   ```
   Follows the existing auth-check pattern (same variable, same throw style). Provides an early client-side rejection before the DB round-trip.

**INT-012 — Create missing barrel index.ts**

Created `src/modules/mod-moderation/index.ts` with named re-exports of all public API surface:
- Functions: `reportUser`, `blockUser`, `unblockUser`, `fetchBlockedUserIds`, `isBlocked`, `fetchMyBlockedUsers`
- Types from `moderation-service`: `BlockedUser`
- Types from `types.ts`: `ReportCategory`, `BlockStatus`, `Report`, `Block`

No intra-module cross-imports were found that needed fixing (`grep -rn "from '.*mod-moderation"` returned no results within the module).

- [pass] `npx tsc --noEmit` — 0 TypeScript errors
- Migration filename uses `*_mod_009_*` pattern per Source Path constraint

**Date**: 2026-10-20

### Design system v2.2 migration (2026-10-16) — off-spec design work, pending PR review

Visual/layout only; no new flows, deps, illustrations or haptics. Spec: design system v2.2 §32.10, §32.11, Appendix G.7.
- `ModerationActions`: Block = `destructiveTonal` (no icon), Report = `ghost`, one row inside the profile header Card; blocked state = `footnote` "You blocked {name}" + `secondary` `sm` Unblock. New optional props `targetName`, `on`. Confirm sheet unchanged in flow (floating, no X, stacked destructive/cancel).
- `ReportSheet`: neutral NoticeBox moved under the title (scrolls with content); `groupHeader` over reasons; only the submit button (and the "pick a reason" hint) is the fixed footer.
- `OtherUserProfileScreen`: header Card (Avatar `lg`, `title3` name, `footnote` bio, moderation row), `pageSection` history title, list row min height tokens.
- Locales: added `moderation.blockedNotice`, `moderation.blockedNoticeGeneric` (en, zh-TW).
- Stories: ModerationActions renders in a Card and has a `targetName` control.
- [pass] `npm run lint` (tsc), `npx jest src/modules/mod-moderation`, `check:i18n`, `storybook build`.

### AC-185 — SwipeBackWrapper wired into OtherUserProfileScreen (2026-10-15)

Wrapped the outermost `<ScrollView>` in `OtherUserProfileScreen.tsx` with `<SwipeBackWrapper onBack={onBack}>` per the AC-185 requirement. The `enabled` prop is omitted (defaults to `true` — no case in this screen where swiping back should be blocked). The loading-state early return (`<View style={styles.centered}>`) is intentionally left unwrapped; it has no `onBack` interaction surface and exits before the wrapper is reached.

- Import added: `import SwipeBackWrapper from '../../../components/SwipeBackWrapper';`
- `<ScrollView ...>` is now the direct child of `<SwipeBackWrapper onBack={onBack}>`.
- [pass] `npx tsc --noEmit` — 0 TypeScript errors
- [pass] `npx jest --testPathPattern="mod-moderation" --passWithNoTests` — no test files, exit 0

**Date**: 2026-10-15

### Bug Fix (2026-10-13) — QA Run 3 convention violation

**Production.md convention: "Log Raw Supabase Error Before Throwing a User-Facing String"**

All 5 Supabase error-catch sites in `moderation-service.ts` were missing a `console.error` call before throwing a user-facing string. Raw Supabase/PostgREST diagnostic information was being silently discarded. Fixed by adding `console.error('[functionName] error:', error)` immediately before the `throw` at each site:

1. `reportUser()` — `console.error('[reportUser] error:', error)` added before `throw new Error('Failed to submit report...')`
2. `blockUser()` — `console.error('[blockUser] error:', error)` added before `throw new Error('Action failed...')` (after the idempotent `23505` early-return branch, not before it)
3. `unblockUser()` — `console.error('[unblockUser] error:', error)` added before `throw new Error('Action failed...')`
4. `fetchBlockedUserIds()` — `console.error('[fetchBlockedUserIds] error:', error)` added before `throw new Error('Failed to load block list...')`
5. `fetchMyBlockedUsers()` — `console.error('[fetchMyBlockedUsers] error:', error)` added before `throw new Error('Failed to load blocked accounts...')`

- [pass] `npx tsc --noEmit` — 0 TypeScript errors
- No other changes; all 11 ACs remain unaffected.

**Date**: 2026-10-13

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

### Storybook stories (off-spec design tooling)
Added `src/modules/mod-moderation/stories/ModerationActions.stories.tsx` and `ReportSheet.stories.tsx` on branch `design/storybook`. Off-spec design tooling requested by UI/UX, pending PR review. No component source changes; fake data only via the Storybook supabase stub.

### Design system v1.2 (2026-10-16) — off-spec design work, pending PR review

Visual + motion only (spec §32.10, §32.11, MIGRATION.md); no new flows, no service changes except the bug fixes.

- **Bug fix, Rules of Hooks:** `ModerationActions` returned `null` before `useCallback` / `useEffect`. The own-profile guard now runs after all hooks (and skips the status fetch). Regression test: `__tests__/ModerationActions.test.tsx`.
- **Bug fix, unblock contrast (1.09:1):** Unblock is now `ui/Button secondary`.
- `ModerationActions`: Button `destructive` (`ICON.block.outline`) / `secondary` / `ghost`; Block opens BottomSheet `confirm` (uses `moderation.block.confirmBlock` + new `confirmBody`; error stays in the sheet with retry); toasts replace inline feedback; haptic `success` on block only; button `loading` replaces the centered spinner. Requires a `ToastProvider` above it (AppShell).
- `ReportSheet`: BottomSheet `form` (keyboard avoidance + sticky footer), `ListRow radio` reasons, `TextField multiline` with 0/280 counter, NoticeBox, disabled submit + "pick a reason" hint, `InlineError` via sheet `error` (input kept), success = sheet closes + toast (replaces the in-sheet confirmation). New optional props `defaultCategory` / `defaultNote` (used by Storybook).
- `OtherUserProfileScreen`: `Avatar`, `AppText`, `IconButton` back (`ICON.back.outline`), `InlineError`, `Card` history, `screenMargin`.
- Locale: added `moderation.report.notePlaceholder/notice/pickReason`, `moderation.block.confirmBody`, `moderation.sheetReportHint`; reworded `sheetReport` ("Report and block"), `report.confirmation`, `report.error`, `report.category`.
- Stories merged to one Controls-driven `Playground` each (ModerationActions: isBlocked / isOwnProfile / fail; ReportSheet: visible / reason / noteLength / submitResult).
- Not done: spec's "discard this report?" inline confirm on close with content (new flow); the "⋯" menu hint row lives in mod-social-feed `UserProfileScreen.tsx` (key `moderation.sheetReportHint` is ready).

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

---

## QA Run 3 — Functional Test (Tech Lead audit verification) — 2026-10-13

**QA agent**: qa-mod-moderation
**Mode**: functional-test (Tech Lead audit confirmed all MOD-009 ACs implemented from earlier cross-module work; verifying each AC per spec Rev 34)
**Automated test run**: 474 passed, 1 failed (mod-beta-video route_name flattening — not in mod-moderation scope), 32 suites, exit 1
**TypeScript check**: 0 errors (`npx tsc --noEmit` exit 0)
**No mod-moderation-specific test files exist** (same as prior runs)

---

### Acceptance Criteria Results

**PASS AC-080**: `reportUser()` in `src/modules/mod-moderation/moderation-service.ts` L40–63 inserts into `reports` with `target_type: 'user'`, caller-supplied `category`, `note: note ?? null`, and `status: 'open'`. RLS policy `reports_insert_own` (migration `20260929000004`) restricts INSERT to `reporter_user_id = auth.uid()`; no SELECT for authenticated users (admin-only via service role). `report_category` enum has 4 values (`inappropriate`, `spam`, `harassment`, `other`). Schema columns match spec: `id`, `reporter_user_id`, `target_type`, `target_id`, `category`, `note`, `status`, `created_at`, `reviewed_at`. `ReportSheet.tsx` exposes all 4 categories via the `CATEGORIES` constant, enforces `maxLength={280}` on the note input.

**PASS AC-081**: `ReportSheet.tsx` sets `confirmed = true` immediately on successful `reportUser()` call (before any admin action). When `confirmed === true` the component renders a confirmation message and a "Done" dismiss button. No polling or admin dependency. The `UserProfileScreen` three-dots "Report" path (`handleReport()`) calls `reportUser` then `blockUser` and sets state immediately — confirmation is handled by the sheet close + blocked-state update rather than a separate confirmation modal (consistent with AC-151's "both in a single action" flow).

**PASS AC-082**: `blocks` table created in migration `20260929000004` with composite PK `(blocker_user_id, blocked_user_id)`, `created_at`, FKs to `public.users(id)`, RLS enabled. `blocks_insert_own` policy checks `blocker_user_id = auth.uid()`; `blocks_delete_own` checks same; `blocks_select_participant` allows either party. `blockUser()` inserts `(blocker_user_id = auth.uid(), blocked_user_id)` and treats `23505` unique-violation as idempotent success. `unblockUser()` deletes the row. `get_activity_feed` (migration `20260929000005`) excludes blocked users' content from the feed via `qualifying_followees` CTE and defense-in-depth NOT EXISTS on both `ascent_items` and `video_items`.

**PASS AC-083** (regression from QA Run 2): `follows_insert_own` policy (migration `20260929000006`) rejects follow INSERT when any block exists in either direction — verified in QA Run 2. `trg_remove_follows_on_block` trigger fires AFTER INSERT on `blocks` and deletes follows in both directions. No regressions introduced by subsequent commits.

**PASS AC-084**: `get_activity_feed` (migration `20260929000005`) checks BOTH directions in `qualifying_followees`: first NOT EXISTS on `(blocker_user_id = auth.uid(), blocked_user_id = followee_id)` and second NOT EXISTS on `(blocker_user_id = followee_id, blocked_user_id = auth.uid())`. Defense-in-depth symmetric NOT EXISTS filter also applied on both `ascent_items` and `video_items` CTEs independently. `fetchBlockedUserIds()` returns both directions for client-side surfaces.

**PASS AC-085** (Phase 1 deferral — accepted per spec Rev 34): Edge Function `supabase/functions/report-digest/index.ts` reads `SERVICE_ROLE_KEY` (not `SUPABASE_SERVICE_ROLE_KEY`). Creates a service-role client (bypasses RLS). Queries `reports WHERE status = 'open' AND created_at < now() - 12 hours`. Email body includes: report ID, target type, target ID, category, reporter user ID, created_at. Returns HTTP 200 with no body when no qualifying reports. Fails safe with HTTP 500 on missing `SERVICE_ROLE_KEY` or `SUPABASE_URL`. Digest covers `reports` table only; footer explicitly states beta-video reports are reviewed separately in Studio. Phase 1 fallback: `console.log`s the digest body; real email delivery (Resend/SMTP) and cron registration are deferred post-launch per spec Rev 34 accepted deferral. PASS — deferral noted, not a bug.

**PASS AC-151**: `UserProfileScreen.tsx` `handleReport()` (L249–267) calls `await reportUser(targetUserId, 'inappropriate')` then `await blockUser(targetUserId)` sequentially in a single user action. On success: sheet is closed, `isProfileBlocked` set to `true`, `isBlockedByMe` set to `true`. The profile immediately shows the blocked state (driven by `isProfileBlocked` guard at render time). `category` defaults to `'inappropriate'`; no note is collected in this path. Both service calls are sequential (not a combined RPC). Matches spec AC-151 exactly.

**PASS AC-152**: `handleBlockToggle()` in `UserProfileScreen.tsx` (L269–295): when `isBlockedByMe` is true, calls `unblockUser(targetUserId)` and resets `isProfileBlocked` and `isBlockedByMe` to false, then reloads the profile. When `isBlockedByMe` is false, calls `blockUser(targetUserId)` and sets both flags to true. `unblockUser()` in `moderation-service.ts` deletes the `blocks` row with `blocker_user_id = auth.uid()`. Content filtering returns to normal (both feed RPC and `fetchBlockedUserIds()` re-evaluated on next load). `ModerationActions.tsx` independently surfaces block/unblock via the `isBlocked()` service function for the `OtherUserProfileScreen` flow.

**PASS AC-153**: `loadProfile()` in `UserProfileScreen.tsx` includes `fetchBlockedUserIds()` in the `Promise.all` (L141–155). `isProfileBlocked` is set to `blocked.has(targetUserId)` — true in either direction. A secondary query on the `blocks` table determines `isBlockedByMe` (whether the viewer is the blocker) to decide whether to show the Unblock option in the three-dots sheet. When `isProfileBlocked` is true, the component renders the "profileUnavailable" message instead of the profile content (L313–365). Three-dots icon is shown in blocked state only when `isBlockedByMe` is true (unblock affordance). State set immediately to `true` after `handleReport()` and `handleBlockToggle()` block calls.

**PASS AC-154**: `BetaVideoSection.tsx` L134–150 calls `fetchBlockedUserIds()` and `fetchBetaVideosForRoute(routeId)` in `Promise.all`. Applies `rows.filter((v) => !blockedIds.has(v.user_id))` to exclude videos from blocked users in either direction before rendering. `fetchBlockedUserIds()` returns a `Set<string>` covering both directions. If `fetchBlockedUserIds()` fails, the error is caught with `console.error` and the filter defaults to an empty set (non-fatal fallback, not a silent corruption).

**PASS AC-155**: `fetchMyBlockedUsers()` in `moderation-service.ts` L201–228 queries `blocks` joined with `users!blocks_blocked_user_id_fkey(id, display_name, avatar_url)` where `blocker_user_id = currentUserId`, ordered `created_at DESC`. Returns `Array<{ userId, displayName, avatarUrl }>` matching the spec contract. Returns `[]` on unauthenticated call. `unblockUser()` is also available as the Unblock action consumed by MOD-010.

---

### Convention Violation — Shared Convention Failure

**FAIL (implementation bug — shared convention)**: `moderation-service.ts` has 5 Supabase error-catch sites that throw user-facing strings without first calling `console.error('[functionName] error:', error)`. This violates the production.md "Log Raw Supabase Error Before Throwing a User-Facing String" shared convention, which is mandatory for every service function that catches a Supabase error.

Failing sites (Input=[Supabase returns an error object], Expected=[`console.error` called with raw error before throw], Actual=[throw with user-facing string only; raw Supabase/PostgREST diagnostic is silently discarded]):

1. `reportUser()` L60–62: `if (error) { throw new Error('Failed to submit report. Please try again.'); }` — no preceding `console.error('[reportUser] error:', error)`.
2. `blockUser()` L94–100: `if (error) { if (error.code === '23505') { return; } throw new Error('Action failed. Please try again.'); }` — no `console.error` before either branch that throws.
3. `unblockUser()` L124–127: `if (error) { throw new Error('Action failed. Please try again.'); }` — no preceding `console.error('[unblockUser] error:', error)`.
4. `fetchBlockedUserIds()` L149–152: `if (error) { throw new Error('Failed to load block list. Please try again.'); }` — no preceding `console.error('[fetchBlockedUserIds] error:', error)`.
5. `fetchMyBlockedUsers()` L211–213: `if (error) { throw new Error('Failed to load blocked accounts. Please try again.'); }` — no preceding `console.error('[fetchMyBlockedUsers] error:', error)`.

Route: **Engineer** (add `console.error('[functionName] error:', error)` immediately before each `throw new Error(...)` at all 5 sites, per the canonical form in production.md).

---

### Shared Convention Checks

- No hardcoded hex colors — all colors reference `theme.colors.*`. PASS.
- No inline user-facing string literals in components — all strings routed through `useTranslation('common')`. PASS.
- Supabase singleton imported correctly; `createClient()` not called at any moderation call site. PASS.
- Supabase singleton (`src/lib/supabase.ts`) imported correctly in `moderation-service.ts` and all components. PASS.
- i18n catalogs: `moderation` key blocks present in `en` and `zh-TW` (verified in prior QA run). PASS.
- Safe area insets: `UserProfileScreen.tsx` calls `useSafeAreaInsets()`, passes `insets.top` to `makeStyles(theme, topInset)`, uses `paddingTop: topInset + theme.spacing.md`. PASS. `ReportSheet.tsx` uses `insets.bottom` for the modal sheet. PASS.
- No `@react-navigation/native` hooks in any moderation screen or component. PASS.
- `ModerationActions` returns `null` when `targetUserId === currentUserId`. PASS.
- No gold-plating: all deliverables match Engineering Progress list. PASS.
- Block-status public service (`isBlocked`, `fetchBlockedUserIds`, `fetchMyBlockedUsers`) exported from `moderation-service.ts` and consumed by MOD-006 (`UserProfileScreen`) and MOD-005 (`BetaVideoSection`) per Cross-Module Imports convention (public service functions only). PASS.
- `fetchBlockedUserIds()` in `BetaVideoSection.tsx` failure is non-fatal with `console.error` logging — correct per production.md (best-effort filtering, not load-blocking). PASS.
- Test suite: 1 failure in `mod-beta-video` (`fetchBetaVideosByUser` route_name flattening) — not in mod-moderation scope, not a regression introduced by this module. PASS (scope exclusion noted).

---

### Summary — QA Run 3

**Result**: BUGS FOUND — 1 failure

1. **Convention violation (implementation bug)**: `moderation-service.ts` — all 5 Supabase error-catch sites throw user-facing strings without first calling `console.error('[functionName] error:', error)`. Violates the production.md "Log Raw Supabase Error Before Throwing a User-Facing String" shared convention. Affected functions: `reportUser`, `blockUser`, `unblockUser`, `fetchBlockedUserIds`, `fetchMyBlockedUsers`. Route to Engineer.

**All 8 acceptance criteria (AC-080, AC-081, AC-082, AC-083, AC-084, AC-085, AC-151, AC-152, AC-153, AC-154, AC-155) verified as PASS.** AC-085 Phase 1 deferral confirmed accepted per spec Rev 34.

---

## QA Run 4 — Regression — 2026-10-13

**QA agent**: qa-mod-moderation
**Mode**: regression-test (re-verification after Engineer fix for QA Run 3 convention violation)
**Bug being re-verified**: Convention violation — all 5 Supabase error-catch sites in `moderation-service.ts` missing `console.error('[functionName] error:', error)` before `throw`
**Automated test run**: `npm test -- --watchAll=false` — 474 passed, 1 failed (`mod-beta-video` `fetchBetaVideosByUser` AC-162 route_name flattening — pre-existing, not in mod-moderation scope), 32 suites, exit 1 (failure is outside mod-moderation scope; same pre-existing failure as QA Run 3)
**TypeScript check**: `npx tsc --noEmit` — 0 errors, exit 0
**No mod-moderation-specific test files exist** (same as all prior runs)

---

### Convention Violation Fix — Regression Verification

**REGRESSION PASS (convention fix)**: All 5 sites verified by direct inspection of `src/modules/mod-moderation/moderation-service.ts`. Each site now calls `console.error('[functionName] error:', error)` on the line immediately before the corresponding `throw new Error(...)`. Exact verified state:

1. **`reportUser()` L61–62**: `console.error('[reportUser] error:', error);` on L61 immediately before `throw new Error('Failed to submit report. Please try again.');` on L62. PASS.

2. **`blockUser()` L100–101**: Inside `if (error)` block — the idempotent `23505` early-return branch (`if (error.code === '23505') { return; }`) on L97–99 is correctly left without a `console.error` (it is a success path, not an error throw). `console.error('[blockUser] error:', error);` on L100 immediately before `throw new Error('Action failed. Please try again.');` on L101 covers the only path that throws. PASS.

3. **`unblockUser()` L128–129**: `console.error('[unblockUser] error:', error);` on L128 immediately before `throw new Error('Action failed. Please try again.');` on L129. PASS.

4. **`fetchBlockedUserIds()` L154–155**: `console.error('[fetchBlockedUserIds] error:', error);` on L154 immediately before `throw new Error('Failed to load block list. Please try again.');` on L155. PASS.

5. **`fetchMyBlockedUsers()` L217–218**: `console.error('[fetchMyBlockedUsers] error:', error);` on L217 immediately before `throw new Error('Failed to load blocked accounts. Please try again.');` on L218. PASS.

All 5 original failure scenarios (Input=[Supabase returns an error object], Expected=[`console.error` called with raw error before throw]) now produce the expected behavior. No site throws without first logging the raw error to the console.

---

### Re-verification of All 11 Acceptance Criteria

The only file changed by the Engineer fix is `moderation-service.ts` — specifically, 5 `console.error` lines were inserted at the catch sites. No other source files, migrations, components, or Edge Functions were modified. All 11 ACs verified as unchanged from QA Run 3:

**PASS AC-080** (re-verified): `reportUser()` logic unchanged — insert payload, `target_type: 'user'`, `status: 'open'`, category, note all intact. The `console.error` addition is inside the error branch only; the success path is unaffected. No regressions.

**PASS AC-081** (re-verified): `ReportSheet.tsx` untouched. Confirmation state logic unchanged. No regressions.

**PASS AC-082** (re-verified): `blockUser()` block-insert logic unchanged. Idempotent `23505` early-return branch intact and unaffected by the `console.error` placement (error log is only before the throw path, not the return path). `unblockUser()` delete logic unchanged. Feed RPC migrations untouched. No regressions.

**PASS AC-083** (re-verified): Migration `20260929000006` untouched. `follows_insert_own` policy and `trg_remove_follows_on_block` trigger unchanged. No regressions.

**PASS AC-084** (re-verified): `get_activity_feed` migration untouched. `fetchBlockedUserIds()` both-direction logic unchanged. No regressions.

**PASS AC-085** (Phase 1 deferral — accepted per spec Rev 34, re-verified): Edge Function `supabase/functions/report-digest/index.ts` untouched. `SERVICE_ROLE_KEY` reading, RLS-bypass, query, fail-safe, and Phase 1 console.log fallback all intact. No regressions.

**PASS AC-151** (re-verified): `UserProfileScreen.tsx` `handleReport()` sequential `reportUser` + `blockUser` call unchanged. Confirmation and blocked-state update unchanged. No regressions.

**PASS AC-152** (re-verified): `handleBlockToggle()` block/unblock toggle logic unchanged. `unblockUser()` delete path unchanged. No regressions.

**PASS AC-153** (re-verified): `loadProfile()` `fetchBlockedUserIds()` call and `isProfileBlocked` state logic unchanged. Profile-unavailable rendering guard unchanged. No regressions.

**PASS AC-154** (re-verified): `BetaVideoSection.tsx` `fetchBlockedUserIds()` call and client-side filter unchanged. Non-fatal error fallback unchanged. No regressions.

**PASS AC-155** (re-verified): `fetchMyBlockedUsers()` query, join, mapping, and empty-set fallback unchanged. The `console.error` addition is in the error branch only; the success-path mapping is unaffected. No regressions.

---

### Shared Convention Re-checks (adjacent code)

The fix adds exactly 5 `console.error` lines — one per catch site. No new imports, no new logic branches, no new files. Verified:
- All 5 `console.error` calls use the canonical form `'[functionName] error:'` matching the production.md convention exactly.
- `blockUser()` idempotent branch (`23505` → `return`) is correctly NOT preceded by a `console.error` — that branch is a success path, not an error throw. The production.md convention applies only to throw sites.
- No new source files, migrations, components, or Edge Functions introduced.
- No gold-plating: only the minimum required change (5 `console.error` insertions) was applied.
- Test suite: 474 passed, 1 failed (`mod-beta-video` AC-162 — pre-existing, out of scope). Failure count and identity unchanged from QA Run 3. No new failures introduced by the fix.

---

### Summary — QA Run 4

**Result**: QA PASS — MOD-009 ready for human sign-off

1. **REGRESSION PASS (convention fix)**: All 5 Supabase error-catch sites in `moderation-service.ts` now call `console.error('[functionName] error:', error)` immediately before their respective `throw new Error(...)`. Original QA Run 3 failure fully resolved. No site throws without first logging the raw diagnostic.

2. **AC-080, AC-081, AC-082, AC-083, AC-084, AC-085, AC-151, AC-152, AC-153, AC-154, AC-155**: All 11 acceptance criteria re-verified PASS. No regressions introduced by the fix.

3. **TypeScript**: `npx tsc --noEmit` exit 0.

4. **Test suite**: 474 passed, 1 failed (pre-existing `mod-beta-video` AC-162 failure — not in mod-moderation scope, unchanged from QA Run 3). No new failures.

**MOD-009 (Moderation — Report & Block) is QA PASS. All 11 ACs verified across 4 QA runs. Module is ready for human sign-off.**
