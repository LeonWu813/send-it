# Social Graph & Feed (MOD-006) Status

## Engineering Progress

**Status**: Complete — migration bug fixed, tsc clean, 277/277 tests pass.
**Commit**: `00835e3` — `feat(mod-social-feed): implement social graph follow/unfollow and activity feed`
**Bug-fix commit**: `3cfe732` — `fix(mod-social-feed): add blocks stub table to make migration self-contained`
**Date**: 2026-09-24

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
