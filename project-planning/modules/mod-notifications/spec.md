# MOD-007: Notifications — Spec

**Module ID**: MOD-007
**Module Name**: Notifications
**Phase**: 1
**Dependencies**: MOD-001, MOD-006
**Last Synced from PRD Revision**: 5

---

## Purpose

Own the device token registration, notification preference toggles, the Edge Function that fans out beta-video-like events to APNs push, and the in-app notification inbox.

---

## Context

Beta video uploaders need timely feedback when someone likes their video. The notification pipeline must be reliable, idempotent, and server-authoritative: the push fan-out is triggered by a Postgres trigger on `Reaction` INSERT (via `pg_net`/webhook), never from the client. This is a hard architectural requirement — triggering from the client would create race conditions and orphaned pushes on network retries. The Edge Function inserts a `Notification` row and enqueues APNs pushes to all registered active device tokens for the recipient, gated by the recipient's `NotificationPreference.beta_video_like` setting. Idempotency is enforced by a unique constraint on `Notification(recipient_user_id, actor_user_id, type, target_id)` — a double-trigger fire (from a double-tap or client retry on the same Reaction) cannot create a duplicate notification row or duplicate push. APNs delivery target: ≥95% of pushes delivered within 30 seconds of the like event over a 24-hour rolling window. APNs configuration (`.p8` auth key upload via `eas credentials`) is deferred until the Apple Developer account is active — this does not block non-push parts of this module (device token storage, preference toggle, in-app inbox).

**Non-goals for this module:**
- Push notifications for events other than beta-video likes (out of scope for Phase 1; Phase 2 adds new follower, new routes at followed gym, etc.).
- In-app notification inbox for non-like events (Phase 1 inbox shows beta-video-like notifications only).
- Android push tokens (Phase 2).
- APNs physical-device end-to-end testing until Apple Developer account is active.

---

## Related User Stories

- **US-009**: Receive push notification for beta-video likes
- **US-010**: Manage notification preferences

---

## Acceptance Criteria Covered

**AC-054**: The system shall register the user's iOS device token on first successful sign-in and store it in `DeviceToken`, deduplicated per (user_id, device_token) pair.

**AC-055**: The system shall, on insert of a `Reaction` with `target_type = beta_video`, insert exactly one `Notification` row for the video's uploader and enqueue exactly one APNs push per registered active device token belonging to the uploader, gated by the uploader's `NotificationPreference.beta_video_like`.

**AC-056**: The system shall deliver the beta-video-like push notification within 30 seconds of the like event for ≥95% of likes measured over a 24-hour rolling window.

**AC-057**: The system shall expose a Settings screen toggle for beta-video-like push notifications; when the toggle is off, no push is enqueued for that user for that event type, but the in-app `Notification` row is still created.

**AC-058** (new — code gap, future module): The system shall navigate a user from a beta-video-like entry in the in-app notification inbox to the liked beta video (on its route detail screen) when the user taps the entry, resolving the notification's `target_id` to the target beta video.

> **Implementation note (MOD-007 push idempotency)**: The notification/push fan-out Edge Function must be invoked by a Postgres trigger on `Reaction` INSERT (via `pg_net`/webhook), never triggered from the client. The function must be idempotent: a unique constraint on `Notification(recipient_user_id, actor_user_id, type, target_id)` guarantees a second trigger fire (double-tap / client retry) cannot create a duplicate notification row or a duplicate push. This is a requirement for the MOD-007 spec.

---

## Integration Points

none

---

## Data Model (relevant tables)

```
Notification  (Phase 1: beta-video likes only)
 - id, recipient_user_id (FK User), actor_user_id (FK User),
   type (beta_video_like),
   target_type (beta_video), target_id,
   is_read, created_at
 - Unique constraint: (recipient_user_id, actor_user_id, type, target_id)

DeviceToken  (Phase 1: iOS APNs via Expo Push)
 - id, user_id (FK User), platform ('ios'),
   device_token, expo_push_token (nullable),
   is_active, created_at, last_seen_at
 - Unique: (user_id, device_token)

NotificationPreference
 - user_id (PK, FK User),
   beta_video_like (bool, default true),
   updated_at
```

All tables guarded by Supabase Row-Level Security policies. `DeviceToken` rows are insertable by the owning user (own tokens only). `NotificationPreference` is writable by the owning user. `Notification` rows are readable by the recipient only.

---

## Input / Output Contract

**Inputs (device token registration):**
- iOS device token obtained from Expo Push after first successful sign-in
- Authenticated user session (MOD-001)

**Outputs (device token registration):**
- `DeviceToken` row upserted (insert or ignore if `(user_id, device_token)` already exists)

**Inputs (notification preference toggle):**
- `beta_video_like` bool value from Settings toggle
- Authenticated user session

**Outputs (notification preference toggle):**
- `NotificationPreference.beta_video_like` updated in Postgres
- Toggle state reflected immediately in Settings UI

**Inputs (Edge Function fan-out — server-side, triggered by Postgres):**
- `Reaction` INSERT event (from Postgres trigger on Reaction table)
- `target_type = beta_video`, `target_id`, `user_id` (actor/liker)

**Outputs (Edge Function fan-out):**
- `Notification` row inserted for the video's uploader (idempotent via unique constraint)
- If `NotificationPreference.beta_video_like = true` for the recipient: one APNs push enqueued per `DeviceToken` row where `is_active = true` and `platform = 'ios'` for the recipient
- If `NotificationPreference.beta_video_like = false` for the recipient: `Notification` row still inserted; no push enqueued

**Inputs (in-app notification inbox):**
- Authenticated user session (reads own `Notification` rows)

**Outputs (in-app notification inbox):**
- List of `Notification` rows for the current user, most-recent first
- `is_read` updated to true when user opens the inbox

---

## Key Implementation Notes

- **Postgres trigger → Edge Function (hard requirement)**: The push fan-out Edge Function must be triggered by a Postgres trigger on `Reaction` INSERT (via `pg_net` or a Supabase webhook), never by the client. A client-triggered call cannot be considered authoritative and creates retry/duplicate risks.
- **Idempotency via unique constraint**: A unique constraint on `Notification(recipient_user_id, actor_user_id, type, target_id)` is the idempotency guarantee. If the Postgres trigger fires twice (e.g., due to a pg_net retry), the second INSERT into `Notification` will fail silently (ON CONFLICT DO NOTHING), and no duplicate push will be enqueued. This constraint must be created as a DB migration, not only enforced in application code.
- **Edge Function secret**: The Edge Function reads the service-role key from the Supabase secret named `SERVICE_ROLE_KEY`. It must **not** use `SUPABASE_SERVICE_ROLE_KEY` — Supabase reserves the `SUPABASE_` prefix for injected variables. The service-role key is never imported into client code.
- **Device token deduplication (AC-054)**: `DeviceToken` has a unique constraint on `(user_id, device_token)`. Use upsert (INSERT ... ON CONFLICT DO NOTHING or DO UPDATE) when registering a token on sign-in. Update `last_seen_at` on each sign-in.
- **preference toggle (AC-057)**: When the toggle is off (`beta_video_like = false`), the `Notification` row is still inserted (so the in-app inbox still shows the like), but no APNs push is enqueued.
- **APNs deferred**: APNs end-to-end testing (physical device push delivery) is blocked on Apple Developer account enrollment and `.p8` auth key upload via `eas credentials`. These are deferred with no fixed timeline. The rest of MOD-007 (device token storage, preference toggle, in-app inbox, Edge Function logic) can be implemented and tested without a physical device push.
- **`NotificationPreference` schema is future-proof**: The table is designed to grow — Phase 2 will add columns for expanded notification types (new follower, new routes at followed gym, etc.). Do not add Phase 2 columns in Phase 1.
- **30-second SLA (AC-056)**: This is a measurable target, not a hard guarantee. Actual delivery depends on Expo Push + APNs latency and device state. Post-launch measurement is required; if the tail is worse than expected, revisit push architecture in Phase 2.
- **AC-058 navigation contract (flag for build)**: The tap-through from a notification inbox entry to the beta video on its route detail screen requires resolving `Notification.target_id` (the `BetaVideo.id`) to the corresponding `route_id`, then navigating to MOD-003's `RouteDetailScreen` with the video in context. The navigation contract (deep-link by `route_id` derived from the beta video, or scroll-to-video) touches MOD-003 and MOD-005 and must be pinned before MOD-007 build begins.

---

## Out of Scope for This Module

- Push notifications for events other than beta-video likes (Phase 2 expands to new follower, new routes at followed gym, etc.).
- Android push tokens (Phase 2 — `DeviceToken.platform` is designed to support 'android' in Phase 2; do not add Android logic in Phase 1).
- In-app notification inbox for non-like event types (Phase 1 inbox shows only `type = beta_video_like`).
- APNs physical-device end-to-end testing until Apple Developer account is active (deferred).
- Email notifications (not in scope for any phase described in the PRD).
