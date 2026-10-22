# MOD-007: Notifications — Spec

**Module ID**: MOD-007
**Module Name**: Notifications
**Phase**: 1
**Dependencies**: MOD-001, MOD-006
**Last Synced from PRD Revision**: 48

---

## Purpose

Own the device token registration, notification preference toggles, the Edge Function that fans out beta-video-like events to APNs push, and the in-app notification inbox. Own the `NotificationInboxScreen` (a list of the current user's in-app notifications, most recent first), reached via the notification bell in MOD-012's global app-level header (AC-184; the bell was formerly in MOD-001's ProfileScreen header, AC-171 revised). On inbox mount, batch-mark all of the current user's unread notifications as read in a single update (AC-172). Own the unread-count badge rendered on the global-header bell, which reflects the current user's unread-notification count and clears when the inbox is opened (AC-173 revised; the badge is rendered on MOD-012's global header per AC-184). Own the `UnreadCountProvider` React context that exposes `{ unreadCount: number, refresh(): void }`, mounted by MOD-012 inside `AppShell` wrapping the global header. Tapping a beta-video-like entry in the inbox navigates to the actor's UserProfileScreen (MOD-006), resolved from the notification's existing `actor_user_id` column (AC-058, revised).

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

**AC-058** (revised, Rev 32): The system shall navigate a user from a beta-video-like entry in the in-app notification inbox to the **UserProfileScreen of the actor** (the user who liked the video) when the user taps the entry, resolving the notification's existing `actor_user_id` column directly — no additional query is required, as `actor_user_id` is already present on the `Notification` row (see §9 Data Model). The destination is MOD-006's `UserProfileScreen` (the other-user profile overlay, AC-064), subject to the actor's privacy setting (AC-063). This supersedes the prior AC-058 behavior of navigating to the liked video's route detail screen. No changes to MOD-003 or MOD-005 are required.

**AC-171** (revised, Rev 35): The system shall present a notification bell in the global app-level header (left position, AC-184), on every screen where that header is shown. Tapping the bell shall push a new `NotificationInboxScreen` (owned by MOD-007) that lists the current user's in-app notifications, most recent first. The `NotificationInboxScreen` and its contents are owned by MOD-007; the bell entry point now lives in MOD-012's global header (AC-184), not in MOD-001's ProfileScreen header (this supersedes the Rev 33 placement in the ProfileScreen header). The bell is wired to navigate to MOD-007's inbox screen.

**AC-172** (new, Rev 32): When `NotificationInboxScreen` mounts, the system shall mark all of the current user's unread notifications as read in a single batch update — all `Notification` rows where `recipient_user_id` equals the current user and `is_read = false` are set to `is_read = true`. Tapping an individual notification row shall not separately change that row's read state; the batch mark-read on inbox mount is the sole read-state transition in Phase 1.

**AC-173** (revised, Rev 35): The notification bell in the global app-level header (AC-184, AC-171 revised) shall display an unread-count badge when the current user has one or more unread notifications (`Notification` rows where `recipient_user_id` equals the current user and `is_read = false`). The badge value shall equal the number of unread rows. The badge shall disappear when the inbox is opened and the batch mark-read (AC-172) completes. (This supersedes the Rev 32 placement of the badge on the ProfileScreen-header bell.)

> **Implementation note (MOD-007 push idempotency)**: The notification/push fan-out Edge Function must be invoked by a Postgres trigger on `Reaction` INSERT (via `pg_net`/webhook), never triggered from the client. The function must be idempotent: a unique constraint on `Notification(recipient_user_id, actor_user_id, type, target_id)` guarantees a second trigger fire (double-tap / client retry) cannot create a duplicate notification row or a duplicate push. This is a requirement for the MOD-007 spec.

**AC-200** (revised, Rev 48, cross-cutting — MOD-007 ownership row, part of AC-199): The app shall be published and identified as "ProjectDay". MOD-007's scope for this AC: `supabase/functions/notify-beta-video-like/index.ts:185` (push title "ProjectDay"). Needs redeployment.

---

## Integration Points

**AC-171/AC-184 — Bell icon entry point (MOD-012 ↔ MOD-007)**: MOD-007 owns the `NotificationInboxScreen` and the `UnreadCountProvider` context. MOD-012's engineer mounts `UnreadCountProvider` inside `AppShell` and renders the bell icon in the global app-level header (left position), wired to navigate to MOD-007's `NotificationInboxScreen`. The bell icon and unread-count badge (AC-173) are rendered in MOD-012's global header; the inbox screen itself is owned by MOD-007. `NotificationInboxScreen` calls `refresh()` on `UnreadCountProvider` after the AC-172 batch mark-read to clear the badge. The bell is NOT rendered in MOD-001's ProfileScreen header (removed per AC-171 revised, Rev 35).

**AC-058 — Inbox tap navigation target (MOD-007 → MOD-006)**: Tapping a beta-video-like entry in MOD-007's `NotificationInboxScreen` navigates to MOD-006's `UserProfileScreen` (the other-user profile overlay, AC-064). The actor's `user_id` is resolved directly from the `actor_user_id` column already present on the `Notification` row — no additional query to MOD-003 or MOD-005 is required. Navigation is subject to the actor's privacy setting (AC-063).

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
- On `NotificationInboxScreen` mount: all of the current user's unread `Notification` rows (`is_read = false`) are updated to `is_read = true` in a single batch update (AC-172); individual row tap does not separately change read state

**Inputs (bell icon unread-count badge):**
- Authenticated user session (reads count of own `Notification` rows where `is_read = false`)

**Outputs (bell icon unread-count badge):**
- Badge displaying the count of unread `Notification` rows for the current user; badge clears when `NotificationInboxScreen` opens and the AC-172 batch mark-read completes (AC-173)

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
- **AC-058 navigation contract (revised, Rev 32)**: Tapping a beta-video-like inbox entry navigates to MOD-006's `UserProfileScreen` for the actor, resolved directly from the `actor_user_id` column already present on the `Notification` row. No additional query to MOD-003 or MOD-005 is needed. The prior navigation contract (resolving `target_id` → `route_id` → RouteDetailScreen via `fetchRouteForBetaVideo`) is superseded by Rev 32. The destination `UserProfileScreen` is subject to the actor's privacy setting (AC-063).
- **Batch mark-read on inbox mount (AC-172)**: When `NotificationInboxScreen` mounts, a single batch update sets `is_read = true` for all `Notification` rows where `recipient_user_id` equals the current user and `is_read = false`. Individual notification row taps do not separately trigger a read-state change.
- **Unread-count badge (AC-173 revised)**: The bell icon in MOD-012's global app-level header displays a badge equal to the count of `Notification` rows where `recipient_user_id` equals the current user and `is_read = false`. The badge value is sourced from `UnreadCountProvider` (owned by MOD-007). The badge clears after the AC-172 batch mark-read fires on inbox mount; `NotificationInboxScreen` calls `refresh()` on the provider after the batch update completes. The bell is NOT in MOD-001's ProfileScreen header (AC-171 revised, Rev 35).

---

## Out of Scope for This Module

- Push notifications for events other than beta-video likes (Phase 2 expands to new follower, new routes at followed gym, etc.).
- Android push tokens (Phase 2 — `DeviceToken.platform` is designed to support 'android' in Phase 2; do not add Android logic in Phase 1).
- In-app notification inbox for non-like event types (Phase 1 inbox shows only `type = beta_video_like`).
- APNs physical-device end-to-end testing until Apple Developer account is active (deferred).
- Email notifications (not in scope for any phase described in the PRD).
