-- MOD-005 Rev 16: video report flow migration
-- Order: (a) new columns on beta_videos, (b) FK repoint, (c) video_reports table, (d) RPC
-- Spec refs: AC-139, AC-140, AC-141, AC-142, AC-143, AC-144

-- ── (a) New columns on beta_videos ───────────────────────────────────────────
-- is_reported: set true by report_beta_video() RPC (AC-140). Never reset by RPC.
-- report_dismissed: set true only by admin via Supabase Studio (AC-143).
ALTER TABLE public.beta_videos
  ADD COLUMN IF NOT EXISTS is_reported    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS report_dismissed boolean NOT NULL DEFAULT false;

-- ── (b) FK repoint: beta_videos.user_id → public.users(id) ───────────────────
-- PostgREST requires the FK to target a table in the exposed public schema so
-- the embedded join `users!beta_videos_user_id_fkey(display_name, avatar_url)`
-- resolves correctly (AC-144). beta_videos.user_id values already match
-- public.users.id (same UUIDs) — this is value-preserving, no data migration.
ALTER TABLE public.beta_videos
  DROP CONSTRAINT IF EXISTS beta_videos_user_id_fkey,
  ADD CONSTRAINT beta_videos_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- ── (c) video_reports table ───────────────────────────────────────────────────
-- Captures one-tap beta-video reports (AC-140).
-- Unique on (beta_video_id, reporter_id) — prevents duplicate reports from the
-- same user on the same video (idempotent via ON CONFLICT DO NOTHING in RPC).
-- RLS: authenticated users may INSERT their own rows; no SELECT/UPDATE/DELETE
-- grants — regular users never need to read video_reports.
-- Admin reads via service_role (bypasses RLS) in Supabase Studio (AC-143).
CREATE TABLE IF NOT EXISTS public.video_reports (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  beta_video_id uuid        NOT NULL REFERENCES public.beta_videos(id) ON DELETE CASCADE,
  reporter_id   uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reported_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT video_reports_unique_reporter UNIQUE (beta_video_id, reporter_id)
);

ALTER TABLE public.video_reports ENABLE ROW LEVEL SECURITY;

-- Reporters can insert their own report rows; reporter_id must equal auth.uid().
CREATE POLICY "reporters can insert"
  ON public.video_reports
  FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid());

-- Grant INSERT only — no SELECT, UPDATE, or DELETE for authenticated users.
GRANT INSERT ON public.video_reports TO authenticated;

-- ── (d) SECURITY DEFINER RPC: report_beta_video ───────────────────────────────
-- Reports a beta video on behalf of the authenticated caller (AC-140).
-- Sets beta_videos.is_reported = true and inserts one video_reports row.
-- Guards:
--   - Caller must be authenticated (auth.uid() is non-null).
--   - Video must exist.
--   - Reporter cannot be the video owner (AC-139 server-side defense-in-depth).
--   - Idempotent: ON CONFLICT DO NOTHING on (beta_video_id, reporter_id).
-- Never touches report_dismissed — admin-only field (AC-143).
-- Never accepts reporter_id as a parameter — always derives from auth.uid().
CREATE OR REPLACE FUNCTION public.report_beta_video(p_beta_video_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reporter_id uuid := auth.uid();
  v_owner_id    uuid;
BEGIN
  -- Must be authenticated
  IF v_reporter_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Fetch video owner
  SELECT user_id INTO v_owner_id FROM public.beta_videos WHERE id = p_beta_video_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'video_not_found';
  END IF;

  -- Cannot report own video (server-side defense-in-depth for AC-139)
  IF v_owner_id = v_reporter_id THEN
    RAISE EXCEPTION 'cannot_report_own_video';
  END IF;

  -- Idempotent insert into video_reports
  INSERT INTO public.video_reports (beta_video_id, reporter_id)
  VALUES (p_beta_video_id, v_reporter_id)
  ON CONFLICT (beta_video_id, reporter_id) DO NOTHING;

  -- Set is_reported = true on the video (only ever goes true; never reset by this RPC)
  UPDATE public.beta_videos
    SET is_reported = true
  WHERE id = p_beta_video_id;
END;
$$;

-- Revoke from anon and public; grant to authenticated only.
REVOKE EXECUTE ON FUNCTION public.report_beta_video(uuid) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.report_beta_video(uuid) TO authenticated;
