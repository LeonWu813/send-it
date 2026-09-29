# Moderation (Report & Block) (MOD-009) Status

## Engineering Progress

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
