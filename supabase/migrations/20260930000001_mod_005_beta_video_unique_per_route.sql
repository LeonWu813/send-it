-- ──────────────────────────────────────────────────────────────────────────────
-- MOD-005 AC-165: enforce one beta video per user per route
-- Deduplicates existing rows (keep most recent created_at) before adding
-- the UNIQUE constraint so the migration is safe on a non-empty table.
-- ──────────────────────────────────────────────────────────────────────────────

-- Step 1: delete older duplicates, keeping the most recent per (user_id, route_id)
DELETE FROM public.beta_videos
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id, route_id) id
  FROM public.beta_videos
  ORDER BY user_id, route_id, created_at DESC
);

-- Step 2: add the unique constraint
ALTER TABLE public.beta_videos
  ADD CONSTRAINT beta_videos_user_id_route_id_key UNIQUE (user_id, route_id);
