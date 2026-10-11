-- MOD-007: Explicit table grants for service_role
--
-- WHY THESE GRANTS ARE NEEDED
-- ───────────────────────────
-- The Edge Function `notify-beta-video-like` runs under the service_role JWT,
-- not the authenticated role. Supabase bypasses Row-Level Security (RLS) for
-- service_role, BUT table-level GRANT privileges are still enforced by
-- PostgreSQL even when RLS is bypassed. The tables below already have grants
-- to the `authenticated` role (applied in earlier module migrations), but those
-- grants do not extend to `service_role`. Without these explicit grants the
-- Edge Function receives a "permission denied for table …" error from
-- PostgreSQL before RLS is even evaluated.
--
-- WHICH TABLES AND WHY
-- ─────────────────────
-- beta_videos          SELECT — Edge Function resolves the recipient (video uploader)
--                               from this table on every Reaction INSERT.
-- notifications        SELECT, INSERT — Edge Function inserts the Notification row;
--                               SELECT is required for the ON CONFLICT idempotency check.
-- notification_preferences
--                      SELECT — Edge Function reads the recipient's push preference
--                               before deciding whether to enqueue an APNs push.
-- users                SELECT — Edge Function reads actor / recipient display names
--                               for the push notification payload.
-- device_tokens        SELECT — Edge Function fetches all active device tokens for
--                               the recipient to fan out the APNs push.
--
-- HISTORY
-- ───────
-- These grants were applied manually via Supabase Studio SQL editor on
-- 2026-10-09 during deployment when the Edge Function returned permission
-- errors at runtime. This migration records them so they are tracked in
-- version control and will be re-applied automatically on any future DB reset.
--
-- Because the grants are already present on the remote DB, run:
--   npx supabase migration repair --status applied 20261009000002
-- after pulling, to mark this migration as applied without re-executing it.

GRANT SELECT ON public.beta_videos TO service_role;
GRANT SELECT, INSERT ON public.notifications TO service_role;
GRANT SELECT ON public.notification_preferences TO service_role;
GRANT SELECT ON public.users TO service_role;
GRANT SELECT ON public.device_tokens TO service_role;
