# MOD-011: Analytics — Spec

**Module ID**: MOD-011
**Module Name**: Analytics
**Phase**: 1
**Dependencies**: MOD-001

---

## Purpose

Ship product events (signup, first send, first video, retention markers, like events) to PostHog, wired throughout the app.

---

## Context

Analytics is cross-cutting — it supports the measurable goals in PRD §2 (Week-4 retention ≥25%, content-density proxy of ≥10 user-submitted routes per seeded gym) rather than a single user story. PostHog is used on the free tier for product analytics and retention cohorts. No PII beyond `user_id` may be sent to PostHog. The PostHog SDK ships client-side events only. There is no server-side event tracking. The free tier has a monthly event cap (~1M events/month); PostHog volume should be monitored, and event sampling for high-frequency events (e.g., `session_start`) should be considered if the cap is approached.

**Non-goals for this module:**
- Server-side or Edge Function event tracking.
- Sending PII (names, emails, phone numbers) to PostHog.
- A/B testing or feature flags (not required in Phase 1).
- A user-facing analytics or stats screen (that is MOD-008).

---

## User Stories Covered

- (cross-cutting; supports measurable goals in PRD §2 rather than a single user story)

---

## Acceptance Criteria Covered

**AC-100**: The system shall emit PostHog events for at minimum: signup completed, home gym set, first send logged, first beta video uploaded, beta video liked, session start.

**AC-101**: The system shall not send PII beyond `user_id` and non-identifying context fields to PostHog.

---

## Integration Points

none

---

## Data Model

No Supabase tables owned by this module. PostHog events are sent directly from the client SDK. No PII fields are attached.

---

## Input / Output Contract

**Inputs:**
- User actions and lifecycle events from across all modules (signup, gym selection, send log saved, beta video uploaded, like tapped, app session start)
- `user_id` from authenticated session (MOD-001)

**Outputs:**
- PostHog event calls with event name, `user_id`, and non-identifying context (e.g., `gym_id`, `route_id`, `grade` — no display names, emails, or avatar URLs)

**Minimum required events (AC-100):**

| Event name | Trigger | Context fields |
|---|---|---|
| `signup_completed` | After Supabase Auth sign-up succeeds | none |
| `home_gym_set` | After `User.home_gym_id` is first persisted | `gym_id` |
| `first_send_logged` | After the user's first `Ascent` INSERT | `route_id`, `gym_id` |
| `first_beta_video_uploaded` | After the user's first `BetaVideo` INSERT | `route_id`, `gym_id` |
| `beta_video_liked` | After a `Reaction` INSERT with `target_type = beta_video` | `target_id` |
| `session_start` | On app foreground / fresh session | none |

---

## Key Implementation Notes

- **PostHog SDK**: Client-side only. Initialize in `src/lib/` or as early as possible in the app lifecycle. Identify the user with `user_id` after authentication (MOD-001). Never call `posthog.identify()` with an email address, display name, or other PII.
- **No PII (AC-101)**: Allowed: `user_id` (opaque UUID), `gym_id`, `route_id`, `grade`, `target_id`. Not allowed: `display_name`, `email`, `avatar_url`, `bio`, or any other identifying information.
- **First-event tracking**: For `first_send_logged` and `first_beta_video_uploaded`, the event must fire only on the user's first occurrence, not every time. Track first-occurrence state client-side (e.g., check count after INSERT; fire event if count === 1).
- **PostHog free-tier ceiling**: The free tier is approximately 1M events/month. Monitor volume; implement client-side sampling for `session_start` (at ≥50% of DAU) if approaching the cap. Add event-volume monitoring from day one.
- **Wired throughout the app**: Analytics instrumentation points are co-located with the relevant user actions in each module. MOD-011 owns the PostHog client initialization and the event-name constants; individual modules import and call the PostHog client at the appropriate action sites.
- **No custom backend analytics server**: All events go directly to PostHog from the client. No proxy server, no Edge Function for analytics.

---

## Out of Scope for This Module

- Server-side or Edge Function event tracking.
- Sending PII to PostHog.
- A/B testing or feature flags (Phase 1).
- User-facing analytics or stats screens (owned by MOD-008).
- PostHog dashboard configuration (admin responsibility, not code-level).
