-- MOD-006: AC-186 — get_like_info_batch RPC (Phase 1 deferred)
--
-- Provides a batched like-info read path so a list or grid of beta videos can
-- resolve all like counts and like states in a single round-trip instead of
-- issuing one `get_like_info` call per video (N+1 elimination).
--
-- The RPC is SECURITY INVOKER — it runs as the calling user, so existing RLS
-- policies on `reactions` govern which rows are visible. The function itself
-- does not enforce beta-video visibility (reported-video exclusion AC-142,
-- blocked-user filter AC-154, beta-video privacy AC-158); callers are expected
-- to only supply IDs for videos they are authorised to see, consistent with how
-- the single-video `get_like_info` RPC works today.
--
-- Phase 1 status: deferred. FeedScreen.tsx remains dead code per AC-159.
-- This RPC is defined now for the data-access/caching convention but is not
-- wired into any UI path in Phase 1; callers continue to use `get_like_info`
-- until the batched path is activated in Phase 2.

CREATE OR REPLACE FUNCTION public.get_like_info_batch(
  p_target_type TEXT,
  p_target_ids  UUID[]
)
RETURNS TABLE(
  target_id  UUID,
  is_liked   BOOLEAN,
  like_count BIGINT
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    t.id AS target_id,
    BOOL_OR(r.user_id = auth.uid()) AS is_liked,
    COUNT(r.id) AS like_count
  FROM UNNEST(p_target_ids) AS t(id)
  LEFT JOIN public.reactions r
    ON r.target_id = t.id AND r.target_type = p_target_type
  GROUP BY t.id;
$$;

REVOKE EXECUTE ON FUNCTION public.get_like_info_batch(TEXT, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_like_info_batch(TEXT, UUID[]) TO authenticated;
