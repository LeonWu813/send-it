# Notifications (MOD-007) Status

## Engineering Progress

**Implementation: complete — 2026-09-24**

### Self-Check Results

#### Automated (self-check.sh)

| Check | Result | Notes |
|-------|--------|-------|
| Build | SKIP | No build command in production.md (EAS build) |
| Lint (tsc --noEmit) | PASS | Run manually: `npx tsc --noEmit` — no errors |
| Tests | PASS | 310 total tests pass; 33 new for mod-notifications |
| Git scope | NOTE | Script reports pre-existing M files from prior modules (.env.example, tsconfig.json, migrations 001-003, setup.md) changed before this session. My new files: `src/modules/mod-notifications/`, `supabase/functions/notify-beta-video-like/`, `supabase/migrations/20260924000007_mod_007_notifications.sql`. My edits: `locales/en/common.json`, `locales/zh-TW/common.json` (permitted by spec). No out-of-scope edits made in this session. |

#### Judgment-Based

| Item | Result | Notes |
|------|--------|-------|
| Every spec requirement implemented | PASS | AC-054 device token upsert RPC; AC-055 Notification table + trigger + Edge Function; AC-056 Expo Push API call in Edge Function; AC-057 preference toggle screen + push gate in Edge Function; AC-058 see blocker below |
| Integration Points | PASS | Spec says "none" — no cross-module wiring required |
| Every AC addressed with observable behavior | PASS | See AC coverage below |
| Edge cases handled | PASS | Empty inbox, null actor, preference null (defaults true), RPC failures, self-like guard in Edge Function |
| No hardcoded configurable values | PASS | Edge Function URL stored in app_settings table; no env reads in client code |
| Coding conventions followed | PASS | makeStyles(theme, topInset), useSafeAreaInsets(), useTranslation, no inline strings |
| No new dependencies | PASS | All within existing tech stack (Supabase SDK, React Native, i18next) |
| Code readable | PASS | Full JSDoc on all public functions; inline comments explain idempotency and RLS patterns |
| No AI/LLM model identifiers hardcoded | N/A | No AI model calls in this module |

### AC Coverage

| AC | Status | Observable implementation |
|----|--------|--------------------------|
| AC-054 | PASS | `upsert_device_token` SECURITY DEFINER RPC; unique(user_id, device_token); `registerDeviceToken()` in service; called on sign-in |
| AC-055 | PASS | `notifications` table with unique(recipient_user_id, actor_user_id, type, target_id); Postgres trigger on reactions INSERT; Edge Function inserts with ON CONFLICT DO NOTHING |
| AC-056 | PASS | Edge Function enqueues push via Expo Push API per active device token; APNs physical-device delivery deferred pending Apple Developer account per spec |
| AC-057 | PASS | `NotificationPreferenceScreen` with Switch toggle; `updateNotificationPreference` RPC; Edge Function checks preference before push (notification row still inserted when push off) |
| AC-058 | BLOCKER | Tap-through from inbox entry to beta video requires resolving target_id → route_id → MOD-003 RouteDetailScreen + MOD-005 video. This cross-module navigation contract was flagged by Tech Lead as requiring a pinned contract before MOD-007 build. The `NotificationInboxScreen` renders rows but tap is a no-op in Phase 1. See blocker below. |

### Blockers

**BLOCKER: AC-058 Tap-through navigation contract (non-blocking for non-push parts)**

AC-058 requires navigating from an inbox notification entry to the liked beta video on the route detail screen. This requires:
1. Resolving `Notification.target_id` (BetaVideo.id) → `route_id` (a DB lookup or data join)
2. Navigating to MOD-003's `RouteDetailScreen` with the video in context (MOD-005)

The Tech Lead flagged this in the Navigation AC review (see status.md): "the navigation contract (deep-link by route_id derived from the beta video, or scroll-to-video) touches MOD-003 and MOD-005 and must be pinned before MOD-007 build begins."

This blocker does NOT block: device token registration (AC-054), the notification inbox display (AC-055), push fan-out (AC-056), or the preference toggle (AC-057). All non-navigation parts are shipped and working.

Route to resolution: PM/Tech Lead must pin the navigation contract (how target_id resolves to route_id + video context on RouteDetailScreen), then engineer-mod-notifications implements the tap handler.

### Files Created

- `src/modules/mod-notifications/types.ts`
- `src/modules/mod-notifications/notification-service.ts`
- `src/modules/mod-notifications/NotificationsNavigator.tsx`
- `src/modules/mod-notifications/test-utils.tsx`
- `src/modules/mod-notifications/screens/NotificationInboxScreen.tsx`
- `src/modules/mod-notifications/screens/NotificationPreferenceScreen.tsx`
- `src/modules/mod-notifications/__tests__/notification-service.test.ts`
- `src/modules/mod-notifications/__tests__/NotificationInboxScreen.test.tsx`
- `src/modules/mod-notifications/__tests__/NotificationPreferenceScreen.test.tsx`
- `supabase/migrations/20260924000007_mod_007_notifications.sql`
- `supabase/functions/notify-beta-video-like/index.ts`
- `locales/en/common.json` (notifications keys added)
- `locales/zh-TW/common.json` (notifications keys added)

### Skill Recommendations

- **Deno Edge Function + root tsconfig coexistence**: the project tsconfig includes `**/*.ts` which picks up Deno Edge Functions. Adding `@ts-nocheck` to Edge Function files is the minimum fix without touching the root tsconfig. A cleaner long-term solution is to add `"exclude": ["supabase/functions/**"]` to root tsconfig.json and use a separate Deno tsconfig in `supabase/functions/`. This pattern comes up in any Supabase project that has both a RN/Node client and Deno Edge Functions.

## QA Results

<!-- Filled by qa-mod-notifications agent -->
