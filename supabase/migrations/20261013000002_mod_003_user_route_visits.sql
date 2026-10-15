-- MOD-003: user_route_visits table + routes_with_new_beta RPC
--
-- AC-179: per-user route-visit tracking.
--   Upserted whenever the current user opens a route's detail screen.
--   Backs the "new beta video" tag (AC-180) and most-recently-viewed ordering (AC-175).
--
-- AC-180: routes_with_new_beta SECURITY INVOKER RPC.
--   Accepts a list of route_ids and returns the subset for which the current
--   user has at least one visible beta video with created_at > last_viewed_at,
--   or no visit row at all.  Visibility rules match the canonical predicates
--   (AC-142 reported-video exclusion, AC-154 blocked-user filter, AC-158 privacy).

-- ── user_route_visits ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_route_visits (
  user_id        UUID NOT NULL DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE CASCADE,
  route_id       UUID NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  last_viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, route_id)
);

CREATE INDEX IF NOT EXISTS user_route_visits_user_idx  ON public.user_route_visits (user_id);
CREATE INDEX IF NOT EXISTS user_route_visits_route_idx ON public.user_route_visits (route_id);

ALTER TABLE public.user_route_visits ENABLE ROW LEVEL SECURITY;

-- Own-rows-only RLS: a user can only read and write their own visit rows.
CREATE POLICY "user_route_visits_select_own"
  ON public.user_route_visits
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "user_route_visits_insert_own"
  ON public.user_route_visits
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_route_visits_update_own"
  ON public.user_route_visits
  FOR UPDATE
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE ON public.user_route_visits TO authenticated;

-- ── routes_with_new_beta RPC ──────────────────────────────────────────────────
--
-- SECURITY INVOKER: auth.uid() inside the function resolves to the calling user,
-- so the function sees only rows the user is entitled to see (RLS-enforced).
-- SET search_path = public: prevents search-path injection.
--
-- Returns the subset of the supplied route_ids for which the current user has
-- at least one visible beta video newer than their last_viewed_at, or for which
-- no visit row exists (never visited = "new beta" for everything).
--
-- Visibility predicates (composed verbatim from canonical conventions):
--   AC-142: exclude reported-and-not-dismissed videos
--           (is_reported = FALSE OR report_dismissed = TRUE)
--   AC-158: respect beta_video_privacy (public / followers / own)
--   AC-154: exclude videos from users who have blocked or been blocked by the viewer

CREATE OR REPLACE FUNCTION public.routes_with_new_beta(route_ids UUID[])
RETURNS TABLE(route_id UUID)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT DISTINCT bv.route_id
  FROM beta_videos bv
  JOIN users u ON u.id = bv.user_id
  LEFT JOIN user_route_visits urv
    ON urv.route_id = bv.route_id AND urv.user_id = auth.uid()
  WHERE bv.route_id = ANY(route_ids)
    AND bv.created_at > COALESCE(urv.last_viewed_at, '1970-01-01'::timestamptz)
    -- AC-142: exclude reported-and-not-dismissed videos
    AND (bv.is_reported = FALSE OR bv.report_dismissed = TRUE)
    -- AC-158: respect beta_video_privacy (public / followers / own)
    AND (
      u.beta_video_privacy = 'public'
      OR EXISTS (
        SELECT 1 FROM public.follows f
        WHERE f.follower_id = auth.uid() AND f.following_id = bv.user_id
      )
      OR bv.user_id = auth.uid()
    )
    -- AC-154: exclude blocked users (symmetric: either direction)
    AND bv.user_id NOT IN (
      SELECT blocked_user_id FROM public.blocks WHERE blocker_user_id = auth.uid()
      UNION
      SELECT blocker_user_id FROM public.blocks WHERE blocked_user_id = auth.uid()
    );
$$;

REVOKE EXECUTE ON FUNCTION public.routes_with_new_beta(UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.routes_with_new_beta(UUID[]) TO authenticated;
