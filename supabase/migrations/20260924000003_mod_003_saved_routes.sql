-- ──────────────────────────────────────────────────────────────────────────────
-- MOD-003: Route Catalog — saved_routes join table
-- ──────────────────────────────────────────────────────────────────────────────
-- Mirrors the saved_gyms design (MOD-002/MOD-012):
--   user_id DEFAULT auth.uid() FK to users ON DELETE CASCADE
--   route_id FK to routes ON DELETE CASCADE  (cascade required because a
--            withdrawn pending route is DELETEd — saved pointers must not dangle)
--   Composite PK (user_id, route_id)
--   Own-rows RLS: SELECT / INSERT / DELETE scoped to auth.uid() = user_id
--   GRANT SELECT, INSERT, DELETE TO authenticated; no UPDATE
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.saved_routes (
  user_id    UUID        NOT NULL DEFAULT auth.uid() REFERENCES public.users(id)   ON DELETE CASCADE,
  route_id   UUID        NOT NULL                    REFERENCES public.routes(id)   ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, route_id)
);

ALTER TABLE public.saved_routes ENABLE ROW LEVEL SECURITY;

-- SELECT own rows
CREATE POLICY "saved_routes_select_own" ON public.saved_routes
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- INSERT own rows (only caller's user_id allowed)
CREATE POLICY "saved_routes_insert_own" ON public.saved_routes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- DELETE own rows
CREATE POLICY "saved_routes_delete_own" ON public.saved_routes
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Grant table-level privileges; no UPDATE (no bookmark metadata to update)
GRANT SELECT, INSERT, DELETE ON public.saved_routes TO authenticated;
