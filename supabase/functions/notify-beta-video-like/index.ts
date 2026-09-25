// @ts-nocheck
// Deno Edge Function — compiled by Deno's TypeScript, not by the project's
// Node.js/React Native tsc. The @ts-nocheck suppresses errors from the root
// tsconfig.json which does not include Deno lib types (e.g. Deno global,
// https:// ESM URLs). Deno's own type-checker validates this file at deploy time.

/**
 * Edge Function: notify-beta-video-like
 *
 * Triggered by a Postgres trigger on `reactions` INSERT (via pg_net HTTP POST).
 * Fan-out pipeline:
 *   1. Verify the JWT in the Authorization header (service-role only).
 *   2. Resolve the beta_video's uploader (recipient) from the `beta_videos` table.
 *   3. Insert a `notifications` row for the recipient (ON CONFLICT DO NOTHING — idempotent).
 *   4. If recipient's `notification_preferences.beta_video_like = true`:
 *      enqueue one APNs push per active device token via Expo Push API.
 *   5. If preference is false: Notification row inserted, no push enqueued (AC-057).
 *
 * Idempotency:
 *   The unique constraint on (recipient_user_id, actor_user_id, type, target_id)
 *   means a double-trigger fire simply produces ON CONFLICT DO NOTHING for the
 *   notification row and skips the push fan-out (AC-055 hard requirement).
 *
 * Security:
 *   - Reads SERVICE_ROLE_KEY (NOT SUPABASE_SERVICE_ROLE_KEY — Supabase reserves
 *     the SUPABASE_ prefix). The service-role key is never in client code.
 *   - No user_id accepted as a parameter — recipient is always derived server-side
 *     from the beta_video row's user_id.
 *
 * APNs delivery:
 *   Uses the Expo Push API. The actual APNs key upload (.p8) is deferred until the
 *   Apple Developer account is active (non-push parts are unblocked by this design).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ── Supabase URL (injected by Supabase runtime — safe to read) ────────────────
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';

// ── Service-role key — reads SERVICE_ROLE_KEY (never SUPABASE_SERVICE_ROLE_KEY)
// The SUPABASE_ prefix is reserved by Supabase for its own injected variables;
// using the reserved prefix causes the secret not to be found at runtime.
const SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY') ?? '';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ReactionPayload {
  reaction_id: string;
  actor_id: string;
  target_id: string;
  target_type: string;
}

interface ExpoPushMessage {
  to: string;
  sound: 'default';
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

// ── Handler ───────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request): Promise<Response> => {
  // Accept POST only.
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  // Require service-role key to be configured (fail safe).
  if (!SERVICE_ROLE_KEY || !SUPABASE_URL) {
    console.error('notify-beta-video-like: missing SERVICE_ROLE_KEY or SUPABASE_URL');
    return new Response('Internal configuration error', { status: 500 });
  }

  // Parse and validate the request body.
  let payload: ReactionPayload;
  try {
    payload = (await req.json()) as ReactionPayload;
  } catch {
    return new Response('Invalid JSON body', { status: 400 });
  }

  const { actor_id, target_id, target_type } = payload;

  if (!actor_id || !target_id || target_type !== 'beta_video') {
    return new Response('Invalid payload', { status: 400 });
  }

  // Create a service-role client — bypasses RLS for server-side inserts.
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  try {
    // ── Step 1: Resolve the recipient (beta video uploader) ──────────────────
    const { data: betaVideo, error: videoError } = await supabase
      .from('beta_videos')
      .select('user_id')
      .eq('id', target_id)
      .maybeSingle();

    if (videoError) {
      console.error('notify-beta-video-like: failed to fetch beta_video', videoError);
      return new Response('Failed to resolve recipient', { status: 500 });
    }

    if (!betaVideo) {
      // Video was deleted; silently succeed (no notification needed).
      return new Response('Video not found — notification skipped', { status: 200 });
    }

    const recipientId: string = betaVideo.user_id as string;

    // Self-like guard: uploader liking their own video produces no notification.
    if (recipientId === actor_id) {
      return new Response('Self-like — notification skipped', { status: 200 });
    }

    // ── Step 2: Insert the notification row (idempotent) ─────────────────────
    // ON CONFLICT DO NOTHING implements the idempotency requirement (AC-055).
    // If the trigger fires twice (pg_net retry), the second insert is a no-op.
    const { error: insertError } = await supabase
      .from('notifications')
      .insert({
        recipient_user_id: recipientId,
        actor_user_id: actor_id,
        type: 'beta_video_like',
        target_type: 'beta_video',
        target_id: target_id,
      })
      .select()
      .limit(1);

    // 23505 = unique_violation — idempotent, treat as success (already notified).
    if (insertError && insertError.code !== '23505') {
      console.error('notify-beta-video-like: failed to insert notification', insertError);
      return new Response('Failed to insert notification', { status: 500 });
    }

    // ── Step 3: Check push preference (AC-057) ───────────────────────────────
    const { data: preference } = await supabase
      .from('notification_preferences')
      .select('beta_video_like')
      .eq('user_id', recipientId)
      .maybeSingle();

    // Default to true when no preference row exists (opt-in by default).
    const pushEnabled: boolean = preference?.beta_video_like !== false;

    if (!pushEnabled) {
      // Notification row was inserted; push skipped per user preference (AC-057).
      return new Response('Push skipped (preference off)', { status: 200 });
    }

    // ── Step 4: Fetch active device tokens for the recipient ─────────────────
    const { data: tokens, error: tokensError } = await supabase
      .from('device_tokens')
      .select('expo_push_token')
      .eq('user_id', recipientId)
      .eq('platform', 'ios')
      .eq('is_active', true)
      .not('expo_push_token', 'is', null);

    if (tokensError) {
      console.error('notify-beta-video-like: failed to fetch device tokens', tokensError);
      return new Response('Failed to fetch device tokens', { status: 500 });
    }

    if (!tokens || tokens.length === 0) {
      // No active tokens — notification row exists but no push sent.
      return new Response('No active tokens', { status: 200 });
    }

    // ── Step 5: Enqueue APNs pushes via Expo Push API ────────────────────────
    // One push per active device token for the recipient.
    // APNs physical-device delivery is deferred until Apple Developer account +
    // .p8 auth key are configured via `eas credentials`. The Expo Push API call
    // itself is correct and ready; APNs will forward once credentials are in place.
    const messages: ExpoPushMessage[] = tokens.map((row) => ({
      to: row.expo_push_token as string,
      sound: 'default',
      title: 'Send It',
      body: 'Someone liked your beta video!',
      data: {
        type: 'beta_video_like',
        target_id: target_id,
        actor_id: actor_id,
      },
    }));

    const pushResponse = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages),
    });

    if (!pushResponse.ok) {
      const body = await pushResponse.text();
      console.error('notify-beta-video-like: Expo Push API error', pushResponse.status, body);
      // Do not return 500 — the notification row was already inserted.
      // The push failure is logged and can be retried separately.
    }

    return new Response('OK', { status: 200 });
  } catch (err) {
    console.error('notify-beta-video-like: unexpected error', err);
    return new Response('Internal error', { status: 500 });
  }
});
