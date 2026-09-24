-- MOD-012: Home — saved_gyms join table
--
-- Ownership:
--   DDL (CREATE TABLE, RLS, GRANT): MOD-012
--   INSERT / DELETE (bookmark toggle):   MOD-002
--   SELECT (Home screen saved-gyms strip): MOD-012
--
-- This migration must run after:
--   20260920000001_mod_001_user_profile.sql  (public.users table)
--   20260920000002_mod_002_gym_directory.sql  (public.gyms table)

CREATE TABLE public.saved_gyms (
  user_id    UUID        NOT NULL DEFAULT auth.uid() REFERENCES public.users(id)  ON DELETE CASCADE,
  gym_id     UUID        NOT NULL REFERENCES public.gyms(id)   ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, gym_id)
);

ALTER TABLE public.saved_gyms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "saved_gyms_select_own" ON public.saved_gyms
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "saved_gyms_insert_own" ON public.saved_gyms
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "saved_gyms_delete_own" ON public.saved_gyms
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

GRANT SELECT, INSERT, DELETE ON public.saved_gyms TO authenticated;
