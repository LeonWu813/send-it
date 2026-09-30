# Social Graph & Feed (MOD-006) Status

## Engineering Progress

**Status**: Complete — migration bug fixed, follow() bug fixed, tsc clean, 422/422 tests pass.
**Commit**: `00835e3` — `feat(mod-social-feed): implement social graph follow/unfollow and activity feed`
**Bug-fix commit**: `3cfe732` — `fix(mod-social-feed): add blocks stub table to make migration self-contained`
**Public entry-point commit**: `8da82b5` — `feat(mod-social-feed): add UserProfileNavigator public entry-point`
**AC-146/147/148 commit**: `77ad6f8` — `feat(mod-social-feed): AC-146/147/148 — followers/following list screens with per-card stats`
**follow() bug-fix commit**: pending — `fix(mod-social-feed): include follower_id in follow() insert payload`
**Human QA UI changes commit**: pending — `fix(mod-social-feed): simplify follower/following cards; add stats section to UserProfileScreen`
**AC-150/151/152/153 commit**: pending — `feat(mod-social-feed): AC-150/151(UI)/152/153 — three-dots sheet, block/report, blocked state`
**Date**: 2026-09-24 (initial); 2026-09-30 (AC-146/147/148, follow() bug fix, human QA UI changes, AC-150/151/152/153)

### AC-150 / AC-151 (UI) / AC-152 / AC-153 Implementation (2026-09-30)

**AC-150 DONE**: Added `Ionicons "ellipsis-vertical"` (size 22) button to `UserProfileScreen` header. Only rendered when `!isOwnProfile`. On press opens a `Modal` (transparent, animationType="slide") bottom action sheet with translucent overlay (`rgba(0,0,0,0.5)`), drag handle pill, option rows, and Cancel row. Sheet panel uses `theme.colors.surface` background, `borderTopLeftRadius`/`borderTopRightRadius`, and `paddingBottom: insets.bottom + theme.spacing.lg`.

**AC-151 (UI) DONE**: "Report" option row with `theme.colors.error` text. On press: calls `reportUser(targetUserId, 'inappropriate')` then `blockUser(targetUserId)` sequentially (both awaited). Shows `ActivityIndicator` on the row while in progress. On success: closes sheet, sets `isProfileBlocked = true` and `isBlockedByMe = true`. On failure: shows inline error text in sheet (sheet stays open).

**AC-152 DONE**: "Block"/"Unblock" toggle option row with `theme.colors.textPrimary` text. Block calls `blockUser(targetUserId)`; unblock calls `unblockUser(targetUserId)`. On block success: closes sheet, `isProfileBlocked = true`, `isBlockedByMe = true`. On unblock success: closes sheet, `isProfileBlocked = false`, `isBlockedByMe = false`, reloads profile via `loadProfile()`.

**AC-153 DONE**: `fetchBlockedUserIds()` added to `loadProfile()` `Promise.all` (no-op result for own profile via `Promise.resolve(new Set())`). Two new state variables: `isProfileBlocked` (targetUserId appears in blocked set, either direction) and `isBlockedByMe` (verified via separate `supabase.from('blocks').select(...).eq('blocker_user_id', session.user.id).eq('blocked_user_id', targetUserId).maybeSingle()` call when `isProfileBlocked` is true). When `isProfileBlocked`: renders back button + optional dots icon + centered `t('moderation.profileUnavailable')` instead of normal profile content. Dots icon shown in blocked state only when `isBlockedByMe` (so viewer can unblock). i18n keys added: `moderation.sheetReport`, `moderation.sheetBlock`, `moderation.sheetUnblock`, `moderation.sheetCancel`, `moderation.profileUnavailable`, `moderation.reportConfirmation` — placed under `moderation` namespace in both `locales/en/common.json` and `locales/zh-TW/common.json` with non-conflicting key names (existing `moderation.report` and `moderation.block` are nested objects; new sheet-label keys use `sheet*` prefix).

**Self-check (AC-150/151/152/153)**:
- PASS — `npx tsc --noEmit` clean, 0 errors
- PASS — `npm test -- --watchAll=false` 422/422 tests pass (9 new tests), exit code 0
- PASS — No hardcoded hex colors; all styles use `theme.*` tokens; overlay uses `'rgba(0,0,0,0.5)'` (string literal, not a hex color)
- PASS — `useSafeAreaInsets()` already in file; `insets.bottom` used for sheet `paddingBottom`
- PASS — `ModerationActions` not imported; sheet is built inline in `ActionSheet` function component
- PASS — Three-dots icon and sheet not rendered for `isOwnProfile`
- PASS — Cross-module imports: `blockUser`, `unblockUser`, `reportUser`, `fetchBlockedUserIds` from `../../mod-moderation/moderation-service` (public service layer, permitted per production.md)

### Human QA UI Changes (2026-09-30)

**Change 1 — Simplify FollowersListScreen and FollowingListScreen cards**: Removed the per-card stats display (sends count "X 攀登" and highest grade "最高 VX") from both list screens following human QA feedback. The `useCardStats` hook, `fetchProfileStats` import, and `ProfileStats` type import are fully removed from both files. Each card now renders circular avatar + display_name only. The `onNavigateToUser(userId)` tap behaviour, nav bar, empty state, and loading state are all preserved unchanged. No new i18n keys needed — removed keys (`sends`, `highestGrade`, `noGrade`) remain in the locale files as they are used elsewhere.

**Change 2 — Add stats section to UserProfileScreen**: Added a stats section below the follow/unfollow button. Imports `fetchProfileStats` from `../../mod-profile-history/history-service` and `ProfileStats` type from `../../mod-profile-history/types` (cross-module public service import — permitted per production.md). `fetchProfileStats` is called in `loadProfile()` via `Promise.all` alongside existing calls, with `.catch(() => null)` so a stats fetch failure does not break the profile load. Added `stats: ProfileStats | null` state (initialized to null). Stats section renders only when `stats !== null`; shows nothing on load failure (no crash). Layout: 1px section divider using `theme.colors.border`, three-item summary row (Total Sends / Days Climbed / Best Grade) using existing `profileHistory.stats.*` i18n keys, then a proportional horizontal bar chart of `sends_by_grade` when `total_sends > 0`. No standalone stats component exported from `mod-profile-history/index.ts` was suitable for embedding (the exported `SendHistoryProfile` is a full-screen FlatList); stats are rendered inline with simple Views/Texts using `useTheme()` tokens exclusively. Test updated to mock `fetchProfileStats` from `mod-profile-history/history-service`.

**Self-check (human QA UI changes)**:
- PASS — `npx tsc --noEmit` clean, 0 errors
- PASS — `npm test -- --watchAll=false` 413/413 tests pass, exit code 0
- PASS — No hardcoded hex colors introduced; all styles use `theme.*` tokens
- PASS — Cross-module import `fetchProfileStats` from `../../mod-profile-history/history-service` (permitted public service per production.md)
- PASS — Stats section renders nothing when stats are null (load failure path is safe)

### Bug Fix — follow() missing follower_id (2026-09-30)

**Bug**: `follow()` in `social-feed-service.ts` inserted only `{ followee_id }` into the `follows` table. The `follows.follower_id` column is `NOT NULL` with no DEFAULT, so every follow attempt failed with PostgreSQL error 23502 (not_null_violation), surfacing to the user as "Failed to follow user. Please try again."

**Fix**: Added the same `supabase.auth.getSession()` guard pattern used by `unfollow()` and `unlikeBetaVideo()`. The function now reads the current user's ID from the session, returns early with `throw new Error('Not authenticated.')` if no session is present, and inserts `{ follower_id: followerId, followee_id: followeeId }`.

**Tests updated**: `social-feed-service.test.ts` `follow` describe block — added `mockGetSession` in `beforeEach`, corrected the insert payload assertion to include `follower_id: MOCK_USER_ID`, and added a new "throws when not authenticated" test (mirrors the equivalent `unfollow` test). Total test count increased from 412 to 413.

**Self-check**:
- PASS — `npx tsc --noEmit` clean, 0 errors
- PASS — `npm test -- --watchAll=false` 413/413 tests pass, exit code 0
- PASS — Pure client-side fix; no migration changes

### AC-146 / AC-147 / AC-148 Update (2026-09-30)

**AC-146 DONE**: `FollowersListScreen` — scrollable list of followers with circular avatar, display_name, total sends, and highest grade per card. Blocked users excluded client-side via `fetchBlockedUserIds()`. Empty state, loading indicator, and error state all present. Back button with chevron-back + i18n label. Safe area insets applied.

**AC-147 DONE**: `FollowingListScreen` — identical card layout to FollowersListScreen, lists users the profile owner follows. Same block exclusion, empty state, loading, error, and nav bar pattern.

**AC-148 DONE**: Per-card stats sourced from `fetchProfileStats(userId)` cross-module import from `mod-profile-history/history-service`. Stats fetched lazily per visible card inside the `useCardStats` hook (per Tech Lead Q2 decision). No client-side derivation of total_sends or highest_grade — canonical RPC used exclusively.

**Self-check (AC-146/147/148)**:
- PASS — `npx tsc --noEmit` clean, no errors
- PASS — `npm test -- --passWithNoTests` 412/412 tests pass, exit code 0
- PASS — Locale keys (`sends`, `highestGrade`, `noGrade`, `noFollowers`, `noFollowing`) added to both `locales/en/common.json` and `locales/zh-TW/common.json` — no conflict with existing `followers` and `following` keys
- PASS — Cross-module import `fetchProfileStats` from `../../mod-profile-history/history-service` (permitted public service per production.md)
- PASS — `fetchBlockedUserIds()` from `mod-moderation/moderation-service` applied in both screens (AC-082, AC-084)

### Public Entry-Point Addition (2026-09-24)

**Change**: Created `src/modules/mod-social-feed/UserProfileNavigator.tsx` — a one-line re-export of `UserProfileScreen` as the module's public entry point.

**Why**: `production.md` Cross-Module Imports convention prohibits importing from another module's `screens/` subdirectory directly. `AppShell.tsx` (MOD-012) needs to mount `UserProfileScreen`; this file exposes it at the module root as the canonical public surface.

**Self-check**:
- PASS — `npx tsc --noEmit` clean, no errors
- PASS — Only `src/modules/mod-social-feed/UserProfileNavigator.tsx` added; no other files touched

### Bug Fix (2026-09-24)

**Bug**: `get_activity_feed` (LANGUAGE sql) referenced `public.blocks` in two NOT EXISTS subqueries. PostgreSQL validates LANGUAGE sql function bodies at CREATE FUNCTION time; since MOD-009 had not yet created `public.blocks`, any fresh `supabase db reset` failed with `ERROR: relation "blocks" does not exist`.

**Fix**: Added a minimal stub table before `CREATE FUNCTION get_activity_feed`:
```sql
CREATE TABLE IF NOT EXISTS public.blocks (
    blocker_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    blocked_id  UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    PRIMARY KEY (blocker_id, blocked_id)
);
```
MOD-009 will `CREATE TABLE IF NOT EXISTS public.blocks (...)` with its full schema — the `IF NOT EXISTS` makes that layering safe. An empty stub produces the correct NOT EXISTS no-op behaviour for the block filter.

**Self-check (bug-fix)**:
- PASS — `npx tsc --noEmit` clean, no errors
- PASS — `npm test -- --watchAll=false` 277/277 tests pass, exit code 0
- PASS — Only `supabase/migrations/20260924000006_mod_006_social_feed.sql` and `project-planning/modules/mod-social-feed/status.md` modified
- PASS — Stub table uses `CREATE TABLE IF NOT EXISTS` — forward-compatible with MOD-009

### Artifacts

**Migration**: `supabase/migrations/20260924000006_mod_006_social_feed.sql`
- `follows` table (PK: follower_id + followee_id, self-follow check constraint, RLS own-rows)
- `reactions` table (unique: user_id + target_type + target_id enforces idempotent like, RLS)
- `get_activity_feed(p_limit, p_offset)` — SECURITY INVOKER RPC composing Follow ∩ ¬Block ∩ privacy
- `get_follower_counts(p_user_id)` — SECURITY INVOKER RPC for immediate count updates
- `get_like_info(p_target_type, p_target_id)` — SECURITY INVOKER RPC for like count + own-like state

**Service**: `src/modules/mod-social-feed/social-feed-service.ts`
- `follow(followeeId)` — idempotent (unique_violation treated as no-op)
- `unfollow(followeeId)` — deletes follow row
- `fetchIsFollowing(followeeId)` — boolean check
- `fetchFollowerCounts(userId)` — calls `get_follower_counts` RPC
- `fetchActivityFeed(limit, offset)` — calls `get_activity_feed` RPC (raw client SELECT prohibited)
- `likeBetaVideo(betaVideoId)` — idempotent (unique_violation treated as no-op)
- `unlikeBetaVideo(betaVideoId)` — deletes reaction row
- `fetchLikeInfo(betaVideoId)` — calls `get_like_info` RPC
- `fetchFollowing(userId)` — **public service function for MOD-012** Following Climbers strip

**Screens**:
- `src/modules/mod-social-feed/screens/FeedScreen.tsx` — chronological feed of ascents + beta videos, pull-to-refresh, like toggle with optimistic update; no comment UI (AC-053); no like on ascents (AC-053)
- `src/modules/mod-social-feed/screens/UserProfileScreen.tsx` — view other user profile, follow/unfollow button with optimistic count update (AC-050), privacy badge for followers_only (AC-063)

**Types**: `src/modules/mod-social-feed/types.ts` — Follow, Reaction, FeedItem, FollowerCounts, LikeInfo, FollowingUser

**i18n**: `socialFeed.*` keys added to both `locales/en/common.json` and `locales/zh-TW/common.json`

**Tests**: 51 new tests across 3 test files — all pass.

### AC Coverage
- AC-050: follow/unfollow with immediate count update (optimistic UI + re-fetch from RPC)
- AC-051: feed via SECURITY INVOKER RPC, pull-to-refresh within one cycle
- AC-052: idempotent beta video like/unlike, immediate like count update
- AC-053: no comment UI anywhere; no like affordance on ascent items
- AC-063: followers_only privacy badge on UserProfileScreen; feed RPC enforces privacy filter
- AC-146 ✓: FollowersListScreen — scrollable list of followers with per-card stats, blocked users excluded
- AC-147 ✓: FollowingListScreen — scrollable list of followees with same card layout, blocked users excluded
- AC-148 ✓: Per-card stats via fetchProfileStats cross-module import from mod-profile-history
- AC-150 ✓: Three-dots icon (ellipsis-vertical, size 22) in UserProfileScreen header, only for !isOwnProfile; opens bottom action sheet (Modal, transparent, animationType="slide")
- AC-151 (UI) ✓: "Report" option in sheet calls reportUser(targetUserId, 'inappropriate') then blockUser(targetUserId) sequentially; loading indicator on option; on success closes sheet and sets isProfileBlocked/isBlockedByMe; on failure shows inline error
- AC-152 ✓: Block/Unblock toggle in sheet; block calls blockUser, unblock calls unblockUser; profile reflects new state immediately after each action
- AC-153 ✓: fetchBlockedUserIds() added to loadProfile() Promise.all; isProfileBlocked and isBlockedByMe state variables derived; blocked state renders "This profile isn't available", hides follow button and stats; dots icon shown only when isBlockedByMe so viewer can unblock

### Notes
- Block filter in RPC uses NOT EXISTS subqueries against `public.blocks`. A minimal stub `blocks` table (blocker_id, blocked_id) is created in this migration before the function body so PostgreSQL can validate the LANGUAGE sql reference at CREATE FUNCTION time. MOD-009 adds the full schema with IF NOT EXISTS — safe to layer on top.
- `fetchFollowing(userId)` is the public service function MOD-012 should call for the Following Climbers strip on HomeScreen
- Raw client SELECT on ascents/beta_videos for the feed is prohibited per spec; all feed reads go through `get_activity_feed` RPC

## QA Results

**QA Agent**: qa-mod-social-feed
**Date**: 2026-09-24
**Workflow**: functional-test (first-time verification)
**Automated tests**: 51/51 pass (mod-social-feed); 277/277 pass (full suite); exit code 0
**TypeScript**: `npx tsc --noEmit` — clean, no errors

---

### AC Results

**PASS AC-050** — follow/unfollow with immediate count update verified.
- `follow()` inserts into `follows` table; unique_violation treated as no-op (idempotent). `unfollow()` deletes the follow row. Both confirmed in service tests.
- `UserProfileScreen` applies optimistic count update immediately on tap, then re-fetches authoritative counts from `get_follower_counts` RPC. Optimistic revert on failure confirmed in tests.
- `follows` table: composite PK `(follower_id, followee_id)` enforces uniqueness at DB level. Self-follow `CHECK (follower_id <> followee_id)` present. Own-rows RLS (select: follower OR followee; insert: own follower_id; delete: own follower_id). Explicit GRANT SELECT, INSERT, DELETE to authenticated.

**PASS AC-051** — chronological activity feed via SECURITY INVOKER RPC verified.
- `fetchActivityFeed()` calls `get_activity_feed` RPC exclusively — no raw SELECT on ascents or beta_videos anywhere in the service file.
- `get_activity_feed` is `LANGUAGE sql SECURITY INVOKER STABLE` with `SET search_path = public`. All three RPCs confirmed SECURITY INVOKER.
- Feed composes: qualifying followees (Follow) ∩ NOT EXISTS in blocks (symmetric, both directions) ∩ privacy filter (followers_only gated by follow existence).
- Privacy filter verified: the WHERE clause includes `(u.privacy_setting = 'public' OR EXISTS (SELECT 1 FROM public.follows f2 WHERE f2.follower_id = auth.uid() AND f2.followee_id = u.id))` — activity from followers_only users only appears if the current user is a follower.
- Chronological sort: `ORDER BY created_at DESC`. Pagination: LIMIT / OFFSET.
- FeedScreen provides pull-to-refresh (RefreshControl); feed reloads within one refresh cycle per AC-051.
- REVOKE EXECUTE on `get_activity_feed` from PUBLIC; GRANT to authenticated only.

**PASS AC-052** — idempotent beta-video like/unlike with immediate like count update verified.
- `reactions` table: unique constraint `(user_id, target_type, target_id)` enforces one like per user per video at DB level.
- `likeBetaVideo()`: unique_violation (23505) treated as no-op. `unlikeBetaVideo()`: deletes reaction row.
- `fetchLikeInfo()` calls `get_like_info` RPC returning `(like_count, user_has_liked)`.
- FeedScreen applies optimistic like-count update immediately; re-fetches authoritative count from DB after mutation; reverts on failure.
- `reactions` table: RLS SELECT for all authenticated (for like count reads); INSERT own row; DELETE own row. Explicit GRANT SELECT, INSERT, DELETE.

**PASS AC-053** — no comment UI; no like affordance on ascent items verified.
- Searched FeedScreen.tsx for "comment": only appears in inline comments in the code (`// AC-053: no comment UI`), no rendered comment input, comment list, or comment count.
- Ascent card renderer (`renderAscentCard`) renders no like button — confirmed by code inspection and FeedScreen tests.
- Beta video card renderer (`renderBetaVideoCard`) renders like button — confirmed.
- No comment-related i18n keys in `socialFeed.*` namespace.

**PASS AC-063** — followers_only privacy badge on UserProfileScreen verified.
- `UserProfileScreen` renders `styles.privateBadge` with `t('socialFeed.privateProfile')` text when `profile.privacy_setting === 'followers_only'`.
- Feed RPC privacy filter enforces that followers_only users' activity does not appear to non-followers (verified in AC-051 above).

---

### Core Checklist

**PASS** — No HTML template comments (`<!-- ... -->`) in spec.md. Checked.

**PASS** — Supabase singleton: service imports from `../../lib/supabase` only; no `createClient()` at call sites.

**PASS** — No service-role key in client code. No `.env` read.

**PASS** — i18n: all 13 `socialFeed.*` keys present in both `locales/en/common.json` and `locales/zh-TW/common.json`. Zero missing keys in either direction.

**PASS** — Theming: all styles use `theme.*` tokens; no hardcoded hex colors in FeedScreen or UserProfileScreen.

**PASS** — Safe area insets: both screens use `useSafeAreaInsets()` and `makeStyles(theme, insets.top)` with `paddingTop: topInset + theme.spacing.md`. Correct pattern per production.md convention.

**PASS** — Cross-module public API (`fetchFollowing`): exported from `social-feed-service.ts` as a named export, returns `FollowingUser[]`, importable by MOD-012 without accessing internal screens or components.

**PASS** — No gold-plating: no features implemented beyond spec scope. No comments, no likes on ascents, no algorithmic ranking — chronological only.

**PASS** — No raw SELECT on ascents/beta_videos in service (feed query goes through RPC only). Confirmed by grep.

**PASS** — Regression: 277/277 tests pass across all modules; no regressions introduced.

---

### Bug Found — FAIL: Migration references `public.blocks` before MOD-009 runs

**Classification**: Implementation bug — route to Engineer (engineer-mod-social-feed).

**Severity**: Migration failure in any environment where MOD-009 has not been applied (including `supabase db reset` during development and CI).

**Detail**: The `get_activity_feed` SQL function references `public.blocks` in two `NOT EXISTS` subqueries (lines 168 and 173 of the migration). PostgreSQL validates table references at `CREATE FUNCTION` time for `LANGUAGE sql` functions. If `public.blocks` does not exist when migration `20260924000006_mod_006_social_feed.sql` runs, the function creation fails with `ERROR: relation "blocks" does not exist`.

The engineering status note says "Block filter in RPC uses LEFT JOIN on `blocks` table; gracefully no-ops if MOD-009 migration has not run yet." This claim is incorrect on two counts: (1) the actual implementation uses `NOT EXISTS` subqueries, not a `LEFT JOIN`; (2) neither `NOT EXISTS` nor `LEFT JOIN` against a non-existent table is graceful — PostgreSQL will fail the `CREATE FUNCTION` statement at parse/planning time regardless. The note was written as if the absence of the table would produce no rows rather than a compile error, which is not how `LANGUAGE sql` function creation works on PG15.

**Expected per spec**: "The RPC guards against Block rows being absent by using LEFT JOIN" (engineering note in status.md). The spec's intent is for the migration to apply cleanly before MOD-009 ships.

**Actual**: `CREATE FUNCTION public.get_activity_feed(...)` will fail in any fresh migration sequence where MOD-009's migration has not yet been applied, because the SQL function body references `public.blocks` which does not exist.

**Reproduction**: Run `supabase db reset` (or apply migrations 001–006 in order) in an environment where MOD-009 has not been implemented. Migration 006 will error on the `CREATE FUNCTION` statement.

**Fix required**: The `get_activity_feed` function body must handle the case where `public.blocks` does not exist, OR a stub `blocks` table must be created in this migration (or a preceding one). Options for the engineer:
1. Change the `LANGUAGE sql` function to `LANGUAGE plpgsql` and wrap the block-filter subqueries in an `IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema='public' AND table_name='blocks')` check — but plpgsql also validates table references at planning time unless using `EXECUTE`.
2. Create a minimal `public.blocks` stub table in this migration (with the minimum schema needed: `blocker_id UUID, blocked_id UUID`) so the reference resolves. MOD-009 can later `CREATE TABLE IF NOT EXISTS` with the full schema. This is the cleanest forward-compatible approach and matches the existing pattern used by migrations that reference tables owned by earlier modules.
3. Use `EXECUTE` with dynamic SQL inside a plpgsql function to defer table-name resolution to runtime — avoids the compile-time dependency entirely.

**Note**: Option 2 (stub table) is the recommended approach. It matches what the engineering status note described as intent ("gracefully no-ops if MOD-009 migration has not run yet") — a stub table with no rows produces the correct no-op behavior for `NOT EXISTS`.

---

### Summary (QA Run 1)

**Result**: BUGS FOUND

One migration-level bug prevents `supabase db reset` from completing in any environment without MOD-009 applied: the `get_activity_feed` SQL function references `public.blocks` which does not exist at migration 006 runtime. All 51 module tests and 277 total tests pass (tests mock Supabase, so the migration failure is not exercised by the test suite). TypeScript is clean. All ACs are correctly implemented in service and UI layers — the bug is isolated to the migration's block-filter reference.

Human QA of UI/follow/like interactions should be deferred until after the migration bug is fixed and `supabase db reset` runs cleanly.

---

## QA Run 2 — Regression — 2026-09-24

**QA Agent**: qa-mod-social-feed
**Workflow**: regression-test (re-verification after bug fix)
**Bug re-verified**: Migration references `public.blocks` before MOD-009 runs (reported in QA Run 1)
**Engineer fix**: Added minimal `public.blocks` stub table immediately before `CREATE FUNCTION get_activity_feed` in `supabase/migrations/20260924000006_mod_006_social_feed.sql` (commit `3cfe732`)
**Automated tests**: 277/277 pass (full suite); exit code 0
**TypeScript**: `npx tsc --noEmit` — clean, no errors

---

### Regression Verification — Original Bug

**REGRESSION PASS — Migration self-containment bug fixed.**

Verification of the specific items requested:

1. **Stub table appears before `get_activity_feed`**: CONFIRMED. `CREATE TABLE IF NOT EXISTS public.blocks` is at line 112; `CREATE OR REPLACE FUNCTION public.get_activity_feed` is at line 146. The stub precedes the function definition — PostgreSQL will have the table registered when it validates the function body at CREATE FUNCTION time.

2. **`IF NOT EXISTS` guard present**: CONFIRMED. The DDL reads `CREATE TABLE IF NOT EXISTS public.blocks (...)` — forward-compatible with MOD-009's later `CREATE TABLE IF NOT EXISTS public.blocks (...)` with its full schema. No collision when MOD-009 migration runs.

3. **Correct column types**: CONFIRMED. `blocker_id UUID NOT NULL` and `blocked_id UUID NOT NULL` — matching the two columns referenced in the `NOT EXISTS` subqueries inside `get_activity_feed` (`b.blocker_id` and `b.blocked_id`).

4. **FK references to `public.users(id)`**: CONFIRMED. Both columns carry `REFERENCES public.users(id) ON DELETE CASCADE` — the FK targets the same `users` table all other FK columns in this migration reference.

5. **Composite PK**: CONFIRMED. `PRIMARY KEY (blocker_id, blocked_id)` present — matches the minimal shape described in the bug report fix option 2.

6. **Stale comment "A placeholder Block table is NOT created here" is gone**: CONFIRMED. `grep` for "placeholder", "NOT created here", and "A placeholder Block table" all returned no results. The stale comment is absent from the migration.

---

### Re-verification of Previously Passing ACs

**PASS AC-050** — No change to `follows` table, `get_follower_counts` RPC, `follow()`/`unfollow()` service methods, or `UserProfileScreen`. All service tests continue to pass. Optimistic count update and RPC re-fetch behavior unchanged. 277/277 tests pass — no regression.

**PASS AC-051** — No change to `get_activity_feed` function logic. The stub table addition does not alter the function body or any of the composition filters (Follow ∩ NOT EXISTS blocks ∩ privacy). The NOT EXISTS subqueries referencing `public.blocks` are functionally unchanged — the stub table has no rows, so both NOT EXISTS subqueries correctly return TRUE for all followees (no blocking in effect), which is the intended no-op behavior when MOD-009 has not yet populated the table. SECURITY INVOKER, STABLE, SET search_path = public, REVOKE/GRANT unchanged. 277/277 tests pass.

**PASS AC-052** — No change to `reactions` table, `get_like_info` RPC, or like/unlike service methods. Idempotent like behavior and immediate count update unchanged. 277/277 tests pass.

**PASS AC-053** — No source code changes. FeedScreen.tsx and UserProfileScreen.tsx untouched by the migration-only fix. No comment UI rendered; no like affordance on ascent items. Confirmed by prior inspection; no new code introduced.

**PASS AC-063** — No source code changes. UserProfileScreen.tsx untouched. followers_only privacy badge behavior unchanged.

---

### Observation (not a bug — documentation quality note)

The comment block immediately before `CREATE OR REPLACE FUNCTION public.get_activity_feed` (lines 139–143) still reads: "This RPC references it via a LEFT JOIN so that if the table does not yet exist..." The actual implementation uses `NOT EXISTS` subqueries, not a LEFT JOIN. This is an inaccurate inline SQL comment but has no functional effect — the SQL body is correct. It is a leftover from an earlier design draft. QA cannot edit source code; flagging for the engineer to correct the comment text in a future tidy-up pass if desired. This does not affect any AC and is not a blocking issue.

---

### Summary (QA Run 2)

**Result**: PASS — all clear, no regressions.

The original migration-level bug is fixed. The `public.blocks` stub table is correctly positioned before `get_activity_feed`, uses `IF NOT EXISTS`, has the correct column types (`UUID NOT NULL`), correct FK references (`REFERENCES public.users(id) ON DELETE CASCADE`), and a composite primary key. The stale comment "A placeholder Block table is NOT created here" is confirmed absent. TypeScript is clean. 277/277 tests pass with no new failures. All five ACs (AC-050, AC-051, AC-052, AC-053, AC-063) verified — no regressions from the migration-only change.

**MOD-006 is ready for human QA.**

Human QA checklist:
- Follow a user and confirm follower/following counts update immediately on their profile.
- Unfollow the same user and confirm counts revert.
- Open the Feed screen and confirm it loads a chronological list of sends and beta videos from followed users.
- Pull-to-refresh the Feed and confirm it reloads.
- Like a beta video and confirm the like count increments immediately.
- Like the same beta video again and confirm it is idempotent (count does not increment twice).
- Unlike the beta video and confirm the count decrements.
- Confirm no comment input, comment list, or comment count is visible anywhere in the app.
- Confirm no like button appears on ascent (send log) items in the Feed.
- Open a followers_only user's profile as a non-follower and confirm the privacy badge is shown.

---

## QA Note — Production Deployment — 2026-09-28

**QA Agent**: qa-mod-social-feed
**Date**: 2026-09-28
**Type**: Production deployment confirmation (user-confirmed)

Migration `20260928000002_mod_006_feed_exclude_reported.sql` applied to production Supabase instance. Feed report-exclusion filter active.

**Context**: This migration ships the `CREATE OR REPLACE FUNCTION public.get_activity_feed(...)` update that adds `WHERE (bv.is_reported = FALSE OR bv.report_dismissed = TRUE)` to the `video_items` CTE — the AC-141 coordinated requirement. It is the MOD-006-owned half of the cross-module change described in the 2026-09-28 Tech Lead review (Q4), ordered after the MOD-005 migration `20260928000001_mod_005_video_reports.sql` which introduced the `is_reported` and `report_dismissed` columns on `beta_videos`. The feed-exclusion filter is now live; reported-but-not-dismissed beta videos will not appear in any user's activity feed.

---

## QA Run 3 — Regression — Rev 18 Scope (AC-146, AC-147, AC-148) — 2026-09-30

**QA Agent**: qa-mod-social-feed
**Workflow**: regression-test (Rev 18 additions — first QA of AC-146/147/148)
**Scope**: AC-146 (FollowersListScreen), AC-147 (FollowingListScreen), AC-148 (per-card stats via fetchProfileStats)
**Automated tests**: 412/412 pass (full suite); 51/51 pass (mod-social-feed suite); exit code 0
**TypeScript**: `npx tsc --noEmit` — clean, 0 errors

---

### AC-146 — FollowersListScreen

**PASS AC-146** — Followers list screen verified.

- **Props**: `FollowersListScreenProps` exports `userId: string`, `onBack: () => void`, `onNavigateToUser: (userId: string) => void`. All three required props present and typed correctly.
- **Scrollable list**: `FlatList` used with `data={users}` and `keyExtractor={(item) => item.userId}`. Confirmed at line 246.
- **Card layout**: Each `UserCard` renders a circular avatar (`borderRadius: theme.borderRadius.full`, width/height 48), `displayName` text, and a `statLine` combining `t('socialFeed.sends', { count })` and `t('socialFeed.highestGrade', { grade })` or `t('socialFeed.noGrade')`. Confirmed by code inspection.
- **Tap navigates**: `onPress={() => { onPress(item.userId); }}` in `UserCard` — calls `onNavigateToUser(cardUserId)`. No direct import of any profile screen component. Confirmed.
- **Blocked users excluded**: Both `fetchFollowersList(userId)` and `fetchBlockedUserIds()` are called concurrently via `Promise.all`; the result is filtered with `rawList.filter((u) => !blockedIds.has(u.userId))` before `setUsers`. Confirmed at lines 207–212.
- **Empty state**: `ListEmptyComponent` renders `t('socialFeed.noFollowers')` text in a centered view. Confirmed at lines 256–260.
- **ActivityIndicator during initial load**: When `loading === true`, a `View` with `ActivityIndicator size="large"` is returned. Screen-level only (not per-card). Confirmed at lines 229–234.
- **Nav bar**: Chevron-back icon (`Ionicons name="chevron-back"`), back label via `t('settings.back')` (resolves to "Back" / "返回"), and centered title via `t('socialFeed.followers')` (resolves to "Followers" / "追蹤者"). Confirmed at lines 270–281.
- **No direct profile screen import**: grep confirms no import of `UserProfileScreen`, `UserProfileNavigator`, `FollowersListScreen`, or `FollowingListScreen` from within this file. Confirmed.
- **Safe area insets**: `useSafeAreaInsets()` called, `insets.top` passed to `makeStyles(theme, insets.top)`, `paddingTop: topInset + theme.spacing.md` applied to the nav bar. Confirmed at lines 197–198, 298.
- **No hardcoded hex colors**: grep for `0x` and `#[0-9a-fA-F]{3,6}` returned no matches in this file. All colors use `theme.colors.*`.
- **useTheme()**: `const { theme } = useTheme()` pattern used. Confirmed at line 196.

---

### AC-147 — FollowingListScreen

**PASS AC-147** — Following list screen verified.

- **Props**: `FollowingListScreenProps` exports `userId: string`, `onBack: () => void`, `onNavigateToUser: (userId: string) => void`. Identical prop shape to AC-146.
- **Scrollable list**: `FlatList` used — identical pattern to FollowersListScreen. Confirmed at line 247.
- **Card layout**: `UserCard` component is structurally identical to FollowersListScreen — circular avatar, displayName, statLine with sends count and highest grade. Confirmed.
- **Tap navigates**: Same `onPress` pattern — calls `onNavigateToUser(item.userId)`. No direct profile screen import. Confirmed.
- **Blocked users excluded**: Same `Promise.all([fetchFollowingList(userId), fetchBlockedUserIds()])` pattern with filter. Confirmed at lines 208–213.
- **Empty state**: `ListEmptyComponent` renders `t('socialFeed.noFollowing')` (different key from AC-146). Confirmed at lines 257–261.
- **ActivityIndicator during initial load**: Screen-level only, identical pattern to AC-146. Confirmed at lines 230–234.
- **Nav bar**: Chevron-back + `t('settings.back')` + centered title `t('socialFeed.following')` (resolves to "Following" / "追蹤中"). Confirmed at lines 271–281.
- **Title distinction**: FollowersListScreen uses `t('socialFeed.followers')` ("追蹤者"); FollowingListScreen uses `t('socialFeed.following')` ("追蹤中"). Both correct per spec.
- **No direct profile screen import**: Confirmed by grep — no cross-screen imports.
- **Safe area insets**: Same `useSafeAreaInsets()` + `makeStyles(theme, insets.top)` pattern. Confirmed.
- **No hardcoded hex colors**: Confirmed — all colors via `theme.colors.*`.

---

### AC-148 — Per-card stats via fetchProfileStats

**PASS AC-148** — Per-card stats sourcing verified.

- **Import path**: Both screens import `fetchProfileStats` from `'../../mod-profile-history/history-service'` (line 37 in FollowersListScreen, line 38 in FollowingListScreen). The relative path `../../mod-profile-history/history-service` from `src/modules/mod-social-feed/screens/` resolves to `src/modules/mod-profile-history/history-service.ts` — confirmed by `realpath` check. This is a direct import, not a re-export through `social-feed-service.ts`.
- **NOT via re-export**: `grep fetchProfileStats social-feed-service.ts` returned zero results — the function is not re-exported or even mentioned in the service file. The screens import it directly from `mod-profile-history/history-service` as required.
- **Per-card lazy fetch**: `fetchProfileStats(cardUserId)` is called inside the `useCardStats(cardUserId)` hook, which is called inside the `UserCard` component. Each card mounts its own hook and triggers its own independent RPC call. No single bulk call in the screen-level `loadFollowers`/`loadFollowing` effect. Confirmed by code structure.
- **Placeholder during load**: `CardStats` initializes with `{ totalSends: 0, highestGrade: null, loaded: false }`. The card renders `0 Sends` and `t('socialFeed.noGrade')` ("Best: --" / "最高 --") immediately while the per-card fetch is in progress. No per-card ActivityIndicator. Confirmed at lines 64–68 and 136–142.
- **Stats fields consumed**: `result.total_sends` mapped to `totalSends`; `result.highest_grade` mapped to `highestGrade`. The canonical `ProfileStats` type from `mod-profile-history/types.ts` is used — no client-side derivation. Confirmed at lines 75–81.
- **Error handling**: On fetch error, placeholder values (0 sends, null grade) are retained — no per-card spinner, no crash. Confirmed at lines 83–87.
- **Cancellation**: `useEffect` returns a cleanup function setting `cancelled = true` to prevent state updates after unmount. Correct pattern for lazy per-card fetches.

---

### Service Layer — AC-146 / AC-147

**PASS** — `social-feed-service.ts` exports `fetchFollowersList(userId: string): Promise<UserListItem[]>` and `fetchFollowingList(userId: string): Promise<UserListItem[]>`. Both functions are confirmed present at lines 316 and 354 respectively. Both query the `follows` table with a joined `users` FK relation, return `UserListItem[]`, and delegate block filtering to the caller per the documented contract.

**PASS** — `types.ts` exports `UserListItem` interface with `userId: string`, `displayName: string`, `avatarUrl: string | null`. Confirmed at lines 78–82. This is the correct shape for the list screens.

**NOTE** — `fetchFollowersList` and `fetchFollowingList` are not covered by tests in `social-feed-service.test.ts`. The test file imports only the pre-existing functions and has no describe blocks for the two new functions. This is a test coverage gap. It is not a blocking issue (TypeScript is clean, the functions are correctly implemented and structurally verified here), but the engineer should add tests for the new service functions in a follow-up. Flagged as an observation, not a bug — no AC requires test coverage of these specific functions beyond what is present.

---

### i18n Verification

**PASS** — Required keys present in both locales under `socialFeed` namespace:

| Key | en/common.json | zh-TW/common.json |
|---|---|---|
| `socialFeed.sends` | "{{count}} Sends" | "{{count}} 攀登" |
| `socialFeed.highestGrade` | "Best: {{grade}}" | "最高 {{grade}}" |
| `socialFeed.noGrade` | "Best: --" | "最高 --" |
| `socialFeed.noFollowers` | "No followers yet" | "還沒有追蹤者" |
| `socialFeed.noFollowing` | "Not following anyone yet" | "還沒有追蹤任何人" |
| `socialFeed.followers` | "Followers" | "追蹤者" |
| `socialFeed.following` | "Following" | "追蹤中" |

All confirmed present in both locale files.

**PASS** — No duplicate key conflict. The `home.following` key in both locale files is a different namespace (`home.following.title`, `home.following.empty`) and does not conflict with `socialFeed.followers` or `socialFeed.following`. Both can coexist in the same JSON object because they are under different top-level keys.

**PASS** — `settings.back` key used by both nav bars resolves to "Back" (en) and "返回" (zh-TW). Confirmed present at line 63 in both locale files.

---

### Guard Rail Verification

**PASS** — Neither FollowersListScreen nor FollowingListScreen imports any profile screen directly. No import of `UserProfileScreen`, `UserProfileNavigator`, or any file from a `screens/` subdirectory of another module. Navigation is via `onNavigateToUser` callback prop exclusively.

**PASS** — `fetchProfileStats` import path is `'../../mod-profile-history/history-service'` in both screens — matches the production.md convention and the spec requirement exactly. Not imported via a re-export in `social-feed-service.ts`.

**PASS** — No hardcoded hex colors in either screen. All color references use `theme.colors.*` tokens via `useTheme()`.

**PASS** — Safe area insets applied via `useSafeAreaInsets()` in both screens. `makeStyles(theme, insets.top)` pattern with `paddingTop: topInset + theme.spacing.md` in the nav bar. Correct per production.md Screen Layout convention.

---

### Regression Check

**PASS** — 412/412 tests pass across all 31 test suites. No regressions from the AC-146/147/148 additions. The previously passing ACs (AC-050, AC-051, AC-052, AC-053, AC-063) remain unaffected — no changes to FeedScreen.tsx, UserProfileScreen.tsx, or the migration files.

---

### Summary (QA Run 3)

**Result**: QA PASS — Rev 18 scope (AC-146, AC-147, AC-148) all clear.

All three Rev 18 ACs are correctly implemented:

- **AC-146**: FollowersListScreen renders a FlatList of followers with circular avatar, display_name, sends count, and highest grade per card; tap calls `onNavigateToUser`; blocked users excluded via `fetchBlockedUserIds()`; empty state and screen-level ActivityIndicator present; nav bar uses chevron-back + i18n back label + centered "追蹤者" title; safe area insets applied; no hardcoded hex colors.
- **AC-147**: FollowingListScreen is structurally identical to AC-146 with the correct "追蹤中" title and `noFollowing` empty state; all same guard rails satisfied.
- **AC-148**: `fetchProfileStats` imported directly from `../../mod-profile-history/history-service` in both screens (not via re-export); called per-card inside `useCardStats` hook; placeholder values (0/null) shown during load; no per-card spinner; no client-side derivation of stats.

Service layer exports `fetchFollowersList` and `fetchFollowingList` returning `UserListItem[]`. Types file exports `UserListItem`. Both locale files have all required keys with no conflicts. TypeScript is clean. 412/412 tests pass.

One non-blocking observation: `fetchFollowersList` and `fetchFollowingList` lack dedicated unit tests in the service test file. The functions are structurally verified here and TypeScript-clean, but test coverage is incomplete. This is a quality note for the engineer, not a blocking AC failure.

**MOD-006 Rev 18 scope is QA PASS.**
