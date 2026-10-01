-- ──────────────────────────────────────────────────────────────────────────────
-- MOD-005: allow authenticated users to UPDATE their own beta_videos rows.
-- Required for the AC-166 upsert replace flow (ON CONFLICT DO UPDATE).
-- The original migration explicitly excluded UPDATE; this migration adds it
-- now that one-per-route replacement is supported.
-- ──────────────────────────────────────────────────────────────────────────────

CREATE POLICY "beta_videos_update_own"
  ON public.beta_videos
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.beta_videos TO authenticated;
