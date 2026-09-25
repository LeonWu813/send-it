-- ──────────────────────────────────────────────────────────────────────────────
-- MOD-004: Remove 'project' from the ascent_style enum (AC-014)
-- ──────────────────────────────────────────────────────────────────────────────
-- PG15-safe single-file, single-transaction pattern for dropping an enum value.
-- CREATE TYPE (a new type) is fully committed within the same transaction on
-- PG15, so no two-file split is required here (unlike ALTER TYPE ADD VALUE).
--
-- Sequencing is critical:
--   Step 2 (backfill) MUST run before Step 3 (column type swap).
--   If the column still holds 'project' during the USING cast, Postgres will
--   throw: ERROR: invalid input value for enum ascent_style_v2: "project"
--
-- After this migration:
--   SELECT enum_range(NULL::ascent_style);  →  {flash,top,attempt}
-- ──────────────────────────────────────────────────────────────────────────────

-- Step 1: Create new enum without 'project'
CREATE TYPE ascent_style_v2 AS ENUM ('flash', 'top', 'attempt');

-- Step 2: Backfill existing 'project' rows to 'attempt' BEFORE type swap
UPDATE public.ascents SET style = 'attempt' WHERE style = 'project';

-- Step 3: Swap column to new type
ALTER TABLE public.ascents
  ALTER COLUMN style TYPE ascent_style_v2
  USING style::text::ascent_style_v2;

-- Step 4: Drop old type and rename new one
DROP TYPE ascent_style;
ALTER TYPE ascent_style_v2 RENAME TO ascent_style;
