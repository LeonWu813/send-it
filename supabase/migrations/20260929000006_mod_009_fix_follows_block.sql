-- ──────────────────────────────────────────────────────────────────────────────
-- MOD-009 bug fix: AC-083 — Block prevents following + trigger removes existing follows
-- ──────────────────────────────────────────────────────────────────────────────
-- QA found that `follows_insert_own` had no block check, allowing a blocked user
-- to follow the blocker. Also, existing follows were not removed when a block was
-- created. This migration:
--   1. Drops and recreates `follows_insert_own` with a symmetric block check.
--   2. Adds a SECURITY DEFINER trigger function + trigger on `blocks` INSERT that
--      deletes existing follows in both directions.
--
-- Ordering dependency: must run after
--   20260924000006_mod_006_social_feed.sql  (creates follows + follows_insert_own)
--   20260929000004_mod_009_moderation.sql   (creates blocks with full schema)
-- ──────────────────────────────────────────────────────────────────────────────

-- Drop existing follows insert policy
DROP POLICY IF EXISTS "follows_insert_own" ON public.follows;

-- Recreate with block check (AC-083: blocked users cannot follow the blocker)
CREATE POLICY "follows_insert_own" ON public.follows
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = follower_id
    AND NOT EXISTS (
      SELECT 1 FROM public.blocks b
      WHERE (b.blocker_user_id = follower_id AND b.blocked_user_id = followee_id)
         OR (b.blocker_user_id = followee_id AND b.blocked_user_id = follower_id)
    )
  );

-- DB trigger: when a block is inserted, remove follows in both directions
CREATE OR REPLACE FUNCTION public.remove_follows_on_block()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.follows
  WHERE (follower_id = NEW.blocker_user_id AND followee_id = NEW.blocked_user_id)
     OR (follower_id = NEW.blocked_user_id AND followee_id = NEW.blocker_user_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_remove_follows_on_block ON public.blocks;
CREATE TRIGGER trg_remove_follows_on_block
  AFTER INSERT ON public.blocks
  FOR EACH ROW EXECUTE FUNCTION public.remove_follows_on_block();
