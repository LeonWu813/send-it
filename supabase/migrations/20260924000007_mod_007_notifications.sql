-- ──────────────────────────────────────────────────────────────────────────────
-- MOD-007: Notifications
-- ──────────────────────────────────────────────────────────────────────────────
-- Creates:
--   • `DeviceToken`             — iOS APNs device tokens (AC-054)
--   • `NotificationPreference`  — per-user preference toggles (AC-057)
--   • `Notification`            — in-app notification inbox rows (AC-055, AC-058)
--   • Postgres trigger on `reactions` INSERT → pg_net webhook → Edge Function
--
-- Key design decisions:
--   • DeviceToken.unique(user_id, device_token): deduplicates tokens on upsert (AC-054).
--   • Notification.unique(recipient_user_id, actor_user_id, type, target_id):
--     idempotency guarantee — double-trigger fires produce ON CONFLICT DO NOTHING (AC-055).
--   • The Postgres trigger on reactions INSERT fires the Edge Function via pg_net.
--     The client NEVER triggers the fan-out directly (hard architectural requirement).
--   • No `user_id` accepted as a param in any RPC — always derived from auth.uid().
--   • SERVICE_ROLE_KEY (not SUPABASE_SERVICE_ROLE_KEY) is read inside the Edge Function.
-- ──────────────────────────────────────────────────────────────────────────────

-- ── notification_type enum ────────────────────────────────────────────────────
-- Phase 1: only beta_video_like. Phase 2 will ADD VALUE IF NOT EXISTS for new types.

CREATE TYPE notification_type AS ENUM ('beta_video_like');

-- ── DeviceToken table ─────────────────────────────────────────────────────────
-- Stores iOS APNs device tokens for push delivery.
-- One row per (user_id, device_token) pair — duplicates are upserted (DO UPDATE).
-- Phase 1: iOS only (platform = 'ios').

CREATE TABLE IF NOT EXISTS public.device_tokens (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL DEFAULT auth.uid()
                                 REFERENCES public.users(id) ON DELETE CASCADE,
  platform         TEXT        NOT NULL CHECK (platform = 'ios'),
  device_token     TEXT        NOT NULL,
  expo_push_token  TEXT,
  is_active        BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, device_token)
);

CREATE INDEX device_tokens_user_id_idx ON public.device_tokens (user_id);
CREATE INDEX device_tokens_active_idx  ON public.device_tokens (user_id, is_active);

ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

-- Users may read their own device tokens.
CREATE POLICY "device_tokens_select_own"
  ON public.device_tokens
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users may insert only their own device token rows.
CREATE POLICY "device_tokens_insert_own"
  ON public.device_tokens
  FOR INSERT
  WITH CHECK (auth.uid() = user_id AND auth.role() = 'authenticated');

-- Users may update their own device token rows (for last_seen_at, is_active).
CREATE POLICY "device_tokens_update_own"
  ON public.device_tokens
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users may delete their own device token rows (e.g., on sign-out).
CREATE POLICY "device_tokens_delete_own"
  ON public.device_tokens
  FOR DELETE
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.device_tokens TO authenticated;

-- ── NotificationPreference table ──────────────────────────────────────────────
-- One row per user. Created on first toggle (or on sign-in via upsert).
-- beta_video_like: when false, no APNs push is enqueued, but the Notification
--   row is still inserted (in-app inbox shows the like regardless).
-- Phase 1: single column. Phase 2 adds new columns without schema changes here.

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id          UUID        PRIMARY KEY DEFAULT auth.uid()
                                 REFERENCES public.users(id) ON DELETE CASCADE,
  beta_video_like  BOOLEAN     NOT NULL DEFAULT TRUE,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- Users may read their own preference row.
CREATE POLICY "notification_preferences_select_own"
  ON public.notification_preferences
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users may insert their own preference row.
CREATE POLICY "notification_preferences_insert_own"
  ON public.notification_preferences
  FOR INSERT
  WITH CHECK (auth.uid() = user_id AND auth.role() = 'authenticated');

-- Users may update their own preference row.
CREATE POLICY "notification_preferences_update_own"
  ON public.notification_preferences
  FOR UPDATE
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE ON public.notification_preferences TO authenticated;

-- ── Notification table ────────────────────────────────────────────────────────
-- Stores in-app notification inbox rows.
-- Phase 1: type = 'beta_video_like', target_type = 'beta_video'.
--
-- Idempotency guarantee (AC-055 hard requirement):
--   A unique constraint on (recipient_user_id, actor_user_id, type, target_id)
--   means a second trigger fire (double-tap / client retry on the same Reaction)
--   hits ON CONFLICT DO NOTHING — no duplicate notification row or push.
--
-- The recipient_user_id is the video uploader (derived server-side from the
-- beta_video row inside the Edge Function — never from the client).

CREATE TABLE IF NOT EXISTS public.notifications (
  id                  UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id   UUID              NOT NULL
                        REFERENCES public.users(id) ON DELETE CASCADE,
  actor_user_id       UUID              NOT NULL
                        REFERENCES public.users(id) ON DELETE CASCADE,
  type                notification_type NOT NULL,
  target_type         TEXT              NOT NULL DEFAULT 'beta_video',
  target_id           UUID              NOT NULL,
  is_read             BOOLEAN           NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  UNIQUE (recipient_user_id, actor_user_id, type, target_id)
);

CREATE INDEX notifications_recipient_idx
  ON public.notifications (recipient_user_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Recipients may read their own notification rows.
CREATE POLICY "notifications_select_own"
  ON public.notifications
  FOR SELECT
  USING (auth.uid() = recipient_user_id);

-- Recipients may update their own notifications (e.g., mark is_read = true).
CREATE POLICY "notifications_update_own"
  ON public.notifications
  FOR UPDATE
  USING (auth.uid() = recipient_user_id);

-- No INSERT policy for authenticated — inserts are performed by the Edge Function
-- using the service-role key (bypasses RLS). Clients never insert directly.

GRANT SELECT, UPDATE ON public.notifications TO authenticated;

-- ── upsert_device_token RPC — SECURITY DEFINER ───────────────────────────────
-- Inserts or updates a device token for the calling user.
-- Updates last_seen_at on every call (idempotent upsert per AC-054).
-- Never accepts user_id as a parameter — always auth.uid().

CREATE OR REPLACE FUNCTION public.upsert_device_token(
  p_device_token     TEXT,
  p_expo_push_token  TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  INSERT INTO public.device_tokens (
    user_id,
    platform,
    device_token,
    expo_push_token,
    is_active,
    last_seen_at
  )
  VALUES (
    v_uid,
    'ios',
    p_device_token,
    p_expo_push_token,
    TRUE,
    NOW()
  )
  ON CONFLICT (user_id, device_token)
  DO UPDATE SET
    expo_push_token = EXCLUDED.expo_push_token,
    is_active       = TRUE,
    last_seen_at    = NOW();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.upsert_device_token(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_device_token(TEXT, TEXT) TO authenticated;

-- ── mark_notifications_read RPC — SECURITY DEFINER ───────────────────────────
-- Marks all unread notifications for the calling user as read.
-- Used when the user opens the notification inbox (AC output: is_read updated).

CREATE OR REPLACE FUNCTION public.mark_notifications_read()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  UPDATE public.notifications
  SET is_read = TRUE
  WHERE recipient_user_id = v_uid
    AND is_read = FALSE;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_notifications_read() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_notifications_read() TO authenticated;

-- ── upsert_notification_preference RPC — SECURITY DEFINER ────────────────────
-- Sets the beta_video_like preference for the calling user (AC-057 toggle).
-- Upserts so the row is created on first toggle.

CREATE OR REPLACE FUNCTION public.upsert_notification_preference(
  p_beta_video_like BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  INSERT INTO public.notification_preferences (user_id, beta_video_like, updated_at)
  VALUES (v_uid, p_beta_video_like, NOW())
  ON CONFLICT (user_id)
  DO UPDATE SET
    beta_video_like = EXCLUDED.beta_video_like,
    updated_at      = NOW();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.upsert_notification_preference(BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_notification_preference(BOOLEAN) TO authenticated;

-- ── Postgres trigger → Edge Function fan-out ──────────────────────────────────
-- The trigger fires on every `reactions` INSERT where target_type = 'beta_video'.
-- It calls the Edge Function via pg_net (HTTP POST) with the reaction payload.
-- The client NEVER triggers the fan-out directly — this is the hard requirement.
--
-- NOTE: pg_net must be enabled in your Supabase project (Dashboard → Database →
-- Extensions → pg_net). The webhook URL below uses the standard Supabase Edge
-- Function path; replace <PROJECT_REF> with the actual project reference.
--
-- The trigger function is SECURITY DEFINER so it can read service-role secrets;
-- the actual secret (SERVICE_ROLE_KEY) is read inside the Edge Function, not here.
--
-- Idempotency is enforced by the unique constraint on notifications, not here —
-- pg_net retries may fire the function multiple times for the same reaction,
-- but the ON CONFLICT DO NOTHING in the Edge Function's INSERT ensures only one
-- notification row is ever created.

CREATE OR REPLACE FUNCTION public.trigger_notify_beta_video_like()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_edge_function_url TEXT;
  v_payload           JSONB;
BEGIN
  -- Only fan out for beta_video reactions.
  IF NEW.target_type::TEXT <> 'beta_video' THEN
    RETURN NEW;
  END IF;

  -- Build the payload. The Edge Function resolves the recipient from the DB.
  v_payload := jsonb_build_object(
    'reaction_id',  NEW.id,
    'actor_id',     NEW.user_id,
    'target_id',    NEW.target_id,
    'target_type',  NEW.target_type
  );

  -- Edge Function URL. The function reads SERVICE_ROLE_KEY from Supabase secrets.
  -- Replace this URL with your project's actual Edge Function URL at deploy time.
  -- The URL is stored in app_settings so it can be updated without a migration.
  SELECT value INTO v_edge_function_url
  FROM public.app_settings
  WHERE key = 'notify_edge_function_url';

  -- Only fire if the URL is configured (graceful degradation in dev/test).
  IF v_edge_function_url IS NOT NULL AND v_edge_function_url <> '' THEN
    PERFORM net.http_post(
      url     := v_edge_function_url,
      body    := v_payload,
      headers := jsonb_build_object('Content-Type', 'application/json')
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER reactions_notify_beta_video_like
  AFTER INSERT ON public.reactions
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_notify_beta_video_like();

-- Seed the Edge Function URL key (value to be set by admin via Studio):
INSERT INTO public.app_settings (key, value)
VALUES ('notify_edge_function_url', '')
ON CONFLICT (key) DO NOTHING;
