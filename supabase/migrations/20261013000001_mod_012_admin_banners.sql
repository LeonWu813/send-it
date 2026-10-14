-- MOD-012: admin_banners table (AC-174)
--
-- Stores admin-managed Events Banner content for the HomeScreen.
-- RLS: authenticated users may SELECT (read-all); writes are restricted to
-- admins via the public.is_admin() helper (Supabase Studio in Phase 1).
--
-- Per the Admin-Managed Content Uses a Dedicated Read-All/Write-Admin Table
-- convention in production.md (Rev 35).

-- ── Table ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.admin_banners (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title      TEXT        NOT NULL,
  body       TEXT        NOT NULL,
  image_url  TEXT,
  is_active  BOOLEAN     NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Row-Level Security ────────────────────────────────────────────────────────

ALTER TABLE public.admin_banners ENABLE ROW LEVEL SECURITY;

-- Any authenticated user may read banners.
CREATE POLICY "admin_banners_select_authenticated"
  ON public.admin_banners
  FOR SELECT
  TO authenticated
  USING (true);

-- Only admins may insert banners (admin edits via Supabase Studio in Phase 1).
CREATE POLICY "admin_banners_insert_admin"
  ON public.admin_banners
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Only admins may update banners.
CREATE POLICY "admin_banners_update_admin"
  ON public.admin_banners
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Only admins may delete banners.
CREATE POLICY "admin_banners_delete_admin"
  ON public.admin_banners
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ── Grants ────────────────────────────────────────────────────────────────────

GRANT SELECT ON public.admin_banners TO authenticated;
