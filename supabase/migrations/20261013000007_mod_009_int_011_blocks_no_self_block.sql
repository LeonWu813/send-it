-- Prevent users from blocking themselves
ALTER TABLE public.blocks
  ADD CONSTRAINT blocks_no_self_block
  CHECK (blocker_user_id <> blocked_user_id);
