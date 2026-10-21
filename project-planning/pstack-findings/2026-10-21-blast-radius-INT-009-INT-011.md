# Blast-radius — INT-009 & INT-011 block-filter migrations

**Date:** 2026-10-21  
**Migrations reviewed:**
- `supabase/migrations/20261013000006_mod_008_int009_block_filter.sql`
- `supabase/migrations/20261013000007_mod_009_int_011_blocks_no_self_block.sql`

---

## INT-009 — Block filter on `get_profile_history` / `get_profile_stats`

### What it does

`get_profile_history`: adds `AND (auth.uid() = p_user_id OR NOT EXISTS (SELECT 1 FROM blocks WHERE ...))` to the WHERE clause. If a block exists in either direction, the query returns **zero rows** — no error.

`get_profile_stats`: adds a `v_is_blocked` check early in the plpgsql body (`migration:140–149`). When blocked, it executes `RETURN QUERY SELECT 0::BIGINT, '[]'::JSON, 0::INT, NULL::TEXT` — same shape and same cardinality (exactly one row) as the existing `followers_only` zero-stats path (`migration:134–137`).

### The one fact it's safe because of

**Both RPCs return the same shape/cardinality on the new block path as on the existing "no access" path that callers already handle.**

- `get_profile_history` block path → empty result set → `fetchProfileHistory` maps `[]` → returns `[]`. The guard `if (!data) return []` at `history-service.ts:61` already handles null; an empty array passes through the `.map()` at line 64 cleanly.
- `get_profile_stats` block path → exactly one zero-filled row → `fetchProfileStats` calls `.single()` at `history-service.ts:100`. `.single()` requires exactly one row. The block path always returns exactly one row (`RETURN QUERY SELECT ...`), so `.single()` succeeds and `error` is null. The caller receives `{ total_sends: 0, sends_by_grade: [], ... }` — identical to the followers_only gate case.

**Step 2** (pointed at the line):
- `get_profile_history` empty path: `migration:79–86` (block predicate) + `history-service.ts:57–78` (error checked, data mapped)
- `get_profile_stats` one-row block path: `migration:140–149` + `history-service.ts:98–104` (`.single()`, error checked)

### Risks

None that block.

### Cleared

| What | Why cleared |
|---|---|
| `fetchProfileStats` uses `.single()` which errors on zero rows | `get_profile_stats` block path always executes `RETURN QUERY SELECT 0, '[]', 0, NULL` — exactly one row, never zero. `.single()` succeeds. `migration:146–149` |
| Social feed `UserProfileScreen` calls `get_profile_stats` | Comment at `UserProfileScreen.tsx:13` says "The get_profile_stats RPC enforces privacy server-side; followers_only non-followers get zeros." Screen already handles zero stats. Same handling applies to block zeros. |
| `fetchProfileHistory` callers see missing data unexpectedly | Function already documents "If target is followers_only and caller is not a follower, returns []". Block empty result is the same behavior. |

### Before you merge

Smoke test: Block user B as user A → navigate to B's profile → `StatsPanel` should show zero sends/stats, history list should be empty. Matches existing followers_only behavior.

---

## INT-011 — Self-block CHECK constraint

### What it does

`ALTER TABLE public.blocks ADD CONSTRAINT blocks_no_self_block CHECK (blocker_user_id <> blocked_user_id);`

If any code attempts `INSERT INTO blocks WHERE blocker_user_id = blocked_user_id`, Postgres raises a check-constraint violation (error code 23514). No existing reads (`SELECT`, `fetchBlockedUserIds`, `isBlocked`) are affected — constraints only fire on writes.

### The one fact it's safe because of

**`blockUser()` already validates `blockedUserId !== blockerUserId` before any DB call.** The constraint can never be triggered through the normal app code path.

`moderation-service.ts:94–96`:
```typescript
if (blockedUserId === blockerUserId) {
  throw new Error('Cannot block yourself');
}
```

This guard runs before the `supabase.from('blocks').insert(...)` at line 98. The constraint is purely additive defense-in-depth.

**Step 2** (pointed at the line): `moderation-service.ts:94–96`.

### Risks

None.

### Cleared

| What | Why cleared |
|---|---|
| `fetchBlockedUserIds`, `isBlocked`, `fetchBlockedUsers` | Read-only operations — CHECK constraints only apply to writes. No breakage. |
| Social-feed, beta-video, notifications, home using block state | All consume `fetchBlockedUserIds` / `isBlocked` (reads). Constraint doesn't affect reads. |
| Unique-violation path in `blockUser()` (code 23505, idempotent) | Unrelated to self-block constraint (23514 vs 23505). Existing idempotent handling at `moderation-service.ts:105–107` is unchanged. |

### Before you merge

Smoke test: attempt `blockUser(currentUserId)` from a test or the console — should throw `'Cannot block yourself'` from the client guard before reaching the DB. The constraint is backup; the client guard is the primary check.
