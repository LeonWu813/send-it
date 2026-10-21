-- ──────────────────────────────────────────────────────────────────────────────
-- MOD-009: Prevent authenticated users from reporting themselves
-- ──────────────────────────────────────────────────────────────────────────────
-- Tightens the `reports_insert_own` INSERT policy to reject any row where
-- the reporter is also the user-type target (target_type = 'user' AND
-- target_id = auth.uid()). The previous policy only verified that
-- reporter_user_id = auth.uid() — it did not block a self-report.
--
-- Approach: DROP the existing policy and recreate it with the additional
-- self-report guard. This is equivalent to ALTER POLICY … WITH CHECK but
-- avoids the ALTER POLICY … USING / WITH CHECK ambiguity for INSERT-only
-- policies, and stays consistent with the pattern used in this project
-- (migration 20260929000006 also uses DROP + CREATE to update an RLS policy).
-- ──────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "reports_insert_own" ON public.reports;

CREATE POLICY "reports_insert_own" ON public.reports
  FOR INSERT TO authenticated
  WITH CHECK (
    reporter_user_id = auth.uid()
    AND (target_type <> 'user' OR target_id::text <> auth.uid()::text)
  );
