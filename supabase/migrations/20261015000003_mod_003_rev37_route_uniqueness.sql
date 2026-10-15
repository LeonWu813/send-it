-- Migration: MOD-003 Rev 37 — Route uniqueness redesign cleanup
--
-- Rev 37: routes are now identified by id only; duplicate (gym_id, grade, color_tag)
-- combinations are permitted by design (AC-020, AC-029).
--
-- The two unique indexes were already dropped in 20261015000001_mod_003_drop_active_unique_idx.sql.
-- These DROP statements are included here (with IF EXISTS) for completeness and idempotency —
-- they are no-ops if the indexes have already been removed.
--
-- The non-unique partial index routes_active_grade_color_idx is also carried forward here
-- (CREATE INDEX IF NOT EXISTS) to back the AC-187 soft-warning count query performance.
--
-- DO NOT run supabase db push — apply this migration manually.

-- Drop the two unique constraints that blocked same-grade/same-color routes at same gym
-- (Rev 37: routes are now identified by id only; duplicates are permitted by design)
DROP INDEX IF EXISTS routes_active_unique_idx;
DROP INDEX IF EXISTS routes_pending_unique_per_submitter;

-- Non-unique index for AC-187 soft-warning count query performance
-- (HomeScreen uses this to check if a duplicate grade+color exists at a gym before submit)
CREATE INDEX IF NOT EXISTS routes_active_grade_color_idx
  ON routes (gym_id, grade, color_tag)
  WHERE status = 'active';
