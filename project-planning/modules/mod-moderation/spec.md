# MOD-009: Moderation (Report & Block) — Spec

**Module ID**: MOD-009
**Module Name**: Moderation (Report & Block)
**Phase**: 1
**Dependencies**: MOD-001, MOD-005, MOD-006

---

## Purpose

Provide report submission (with category + optional note) for beta videos and user profiles, block/unblock actions, and filtering blocked users out of feeds, route pages, and follow flows. Admin review happens in Supabase Studio.

---

## Context

App Store Guideline 1.2 requires that apps with user-generated content provide (1) a mechanism for users to flag objectionable content, (2) a mechanism to block abusive users, and (3) a developer commitment to act on objectionable content within 24 hours. Send It implements both Report and Block in Phase 1. Block is **symmetric**: when user A blocks user B, B's content is hidden from A's feed and route pages, AND A's content is hidden from B's feed and route pages. This symmetric hiding is explicitly required by App Store Guideline 1.2 and is codified in AC-082 and AC-084. Follow is also blocked: a blocked user cannot follow the blocker and vice versa. The report alerting pipeline uses a scheduled Edge Function (every 6 hours) that emails the admin (wu.tsan@northeastern.edu) a digest of all open reports (`Report.status = open`) older than 12 hours, so the solo operator is alerted within the App Store Guideline 1.2 response window without having to poll Supabase Studio. Admin review and actioning of reports and user bans happens exclusively in Supabase Studio in Phase 1.

**Non-goals for this module:**
- In-app admin moderation UI (Supabase Studio only for Phase 1; a lightweight in-app admin surface is held in the Phase 2 slot if App Store review requires it).
- Automated content removal without admin review.
- Community-driven retire/reset voting (Phase 2).

---

## User Stories Covered

- **US-015**: Report inappropriate content
- **US-016**: Block another user

---

## Acceptance Criteria Covered

**AC-080**: The system shall allow a user to report a beta video or a user profile with a category (e.g., inappropriate, spam, harassment, other) and an optional note, and persist the report to the `Report` table for admin review in Supabase Studio.

**AC-081**: The system shall show the reporter a confirmation state after a successful report submission and shall not require admin action to complete the report flow.

**AC-082**: The system shall allow a user to block another user, persist the relationship in the `Block` table, and immediately hide the blocked user's beta videos, sends, and profile from the blocker's feed and route pages.

**AC-083**: The system shall prevent a blocked user from following the blocker, liking the blocker's beta videos, or otherwise interacting with the blocker's content.

**AC-084**: The system shall apply block hiding symmetrically — the blocker's beta videos, sends, and profile shall also be hidden from the blocked user's feed and route pages, in addition to hiding the blocked user's content from the blocker (App Store Guideline 1.2 requirement).

**AC-085**: The system shall run a scheduled Edge Function (every 6 hours) that emails the admin (wu.tsan@northeastern.edu) a digest of all open reports (`Report.status = open`) older than 12 hours, so the solo operator is alerted to unresolved objectionable-content reports within the App Store Guideline 1.2 response window.

---

## Integration Points

none

---

## Data Model (relevant tables)

```
Report  (App Store Guideline 1.2 requirement)
 - id, reporter_user_id (FK User),
   target_type (beta_video | user),
   target_id,
   category (inappropriate | spam | harassment | other),
   note (nullable),
   status (open | reviewed | actioned | dismissed),
   created_at, reviewed_at (nullable)

Block  (App Store Guideline 1.2 requirement)
 - blocker_user_id (FK User), blocked_user_id (FK User), created_at
 - PK: (blocker_user_id, blocked_user_id)
```

All tables guarded by Supabase Row-Level Security policies. `Report` rows are insertable by authenticated users; readable by admins only. `Block` rows are insertable/deletable by the blocker; readable by both parties involved (for filtering).

---

## Input / Output Contract

**Inputs (report submission):**
- `target_type` (beta_video | user), `target_id`
- `category` (inappropriate | spam | harassment | other), `note` (optional)
- Authenticated user session (MOD-001)

**Outputs (report submission):**
- `Report` row inserted with `status = open`
- Confirmation state shown to reporter immediately (no admin action required for the user-facing flow)

**Inputs (block action):**
- `blocked_user_id`, authenticated user session (blocker)

**Outputs (block action):**
- `Block` row inserted: `(blocker_user_id, blocked_user_id)`
- Immediately hide blocked user's beta videos, sends, and profile from the blocker's feed and route pages (AC-082)
- Immediately hide the blocker's beta videos, sends, and profile from the blocked user's feed and route pages (AC-084 — symmetric)
- Blocked user cannot follow the blocker, like the blocker's videos, or otherwise interact (AC-083)
- Any existing Follow relationship between blocker and blocked user is removed

**Inputs (unblock action):**
- `blocked_user_id`, authenticated user session

**Outputs (unblock action):**
- `Block` row deleted
- Content filtering returns to normal for both parties

**Inputs (scheduled report digest Edge Function):**
- Scheduled trigger every 6 hours (Supabase cron / scheduled Edge Function)

**Outputs (scheduled report digest):**
- Email sent to wu.tsan@northeastern.edu listing all `Report` rows where `status = open` AND `created_at < now() - interval '12 hours'`
- Edge Function reads `SERVICE_ROLE_KEY` (not `SUPABASE_SERVICE_ROLE_KEY`)

---

## Key Implementation Notes

- **Block symmetry (AC-082 + AC-084)**: Block hiding is symmetric — both directions must be enforced. When user A blocks user B: A's feed hides B's content (AC-082), AND B's feed hides A's content (AC-084). This applies to: activity feed (MOD-006), route pages (MOD-003 + MOD-005), and follow flows (MOD-006). The `Block` table stores only one direction `(blocker_user_id, blocked_user_id)`, but the MOD-006 feed RPC and any filtering logic must check both directions symmetrically.
- **Follow prevention (AC-083)**: The follow action in MOD-006 must check the `Block` table in both directions before allowing a Follow INSERT. If any block exists between the two users, the follow must be prevented.
- **Report confirmation (AC-081)**: The reporter sees a confirmation state immediately after submission; they do not wait for admin review. Admin review happens asynchronously in Supabase Studio.
- **Report alerting Edge Function (AC-085)**: A scheduled Edge Function runs every 6 hours. It queries `Report` rows with `status = open` AND `created_at < now() - interval '12 hours'` and sends an email digest to wu.tsan@northeastern.edu. The Edge Function reads `SERVICE_ROLE_KEY` (not `SUPABASE_SERVICE_ROLE_KEY`). The email body should list: report ID, target type, target ID, category, reporter user ID, created_at for each qualifying report.
- **Admin review in Supabase Studio**: Report status transitions (`open → reviewed | actioned | dismissed`) and user bans are performed by the admin via Supabase Studio. No in-app admin UI in Phase 1.
- **Category enum**: `{inappropriate, spam, harassment, other}` — no free-text category. A free-text note field is optional.
- **Target types**: Reports can be filed against `target_type = beta_video` or `target_type = user`. The `target_id` references the corresponding `BetaVideo.id` or `User.id`.

---

## Out of Scope for This Module

- In-app admin moderation UI (Supabase Studio only for Phase 1).
- Automated content removal without admin review.
- Community-driven retire/reset voting workflow (Phase 2).
- Blocking gyms or routes (Phase 1 only supports blocking users).
- Reports on plain send logs (Phase 1 reports are only on beta videos and user profiles).
