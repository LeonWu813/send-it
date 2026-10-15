-- MOD-003: count_beta_videos_by_routes RPC (AC-189, Rev 39/40)
--
-- Returns a count of visible beta videos per route for a given list of route IDs.
-- "Visible" applies the same three-part beta-video visibility fence used by
-- routes_with_new_beta (AC-142, AC-154, AC-158), with the recency clause dropped
-- and COUNT(*) GROUP BY bv.route_id replacing the SELECT DISTINCT.
--
-- SECURITY INVOKER: auth.uid() resolves to the calling user, so visibility
-- predicates are evaluated from that user's perspective (symmetric block filter,
-- followers-only privacy per the calling user's follow graph).
-- SET search_path = public: prevents search-path injection.
--
-- Returns TABLE(route_id uuid, beta_count bigint).
-- Routes with zero visible beta videos are omitted from the result set; callers
-- should default to 0 for absent keys.

CREATE OR REPLACE FUNCTION public.count_beta_videos_by_routes(route_ids uuid[])
RETURNS TABLE(route_id uuid, beta_count bigint)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
STABLE
AS $$
  SELECT
    bv.route_id,
    COUNT(*) AS beta_count
  FROM beta_videos bv
  JOIN users u ON u.id = bv.user_id
  WHERE bv.route_id = ANY(route_ids)
    -- AC-142: exclude reported-and-not-dismissed videos
    AND (bv.is_reported = FALSE OR bv.report_dismissed = TRUE)
    -- AC-158: respect beta_video_privacy (public / followers / own)
    AND (
      u.beta_video_privacy = 'public'
      OR EXISTS (
        SELECT 1 FROM public.follows f
        WHERE f.follower_id = auth.uid() AND f.followee_id = bv.user_id
      )
      OR bv.user_id = auth.uid()
    )
    -- AC-154: exclude blocked users (symmetric: either direction)
    AND bv.user_id NOT IN (
      SELECT blocked_user_id FROM public.blocks WHERE blocker_user_id = auth.uid()
      UNION
      SELECT blocker_user_id FROM public.blocks WHERE blocked_user_id = auth.uid()
    )
  GROUP BY bv.route_id
$$;

REVOKE ALL ON FUNCTION public.count_beta_videos_by_routes(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.count_beta_videos_by_routes(uuid[]) TO authenticated;
