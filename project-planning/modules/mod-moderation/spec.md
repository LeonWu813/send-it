# MOD-009: Moderation (Report & Block) — Spec

**Module ID**: MOD-009
**Module Name**: Moderation (Report & Block)
**Phase**: 1
**Dependencies**: MOD-001, MOD-005, MOD-006
**Last Synced from PRD Revision**: 48
**Last Updated**: 2026-09-30

---

## Purpose

Provide user-profile report submission (which in Phase 1 both files a report record and blocks the user, AC-151), block/unblock actions (`blockUser` / `unblockUser`, AC-152), a block-status public service (`isBlocked` / `fetchBlockedUserIds` / `fetchMyBlockedUsers`) consumed by MOD-005 (AC-154), MOD-006 (AC-153), and MOD-010's Blocked Accounts screen (AC-155, via `fetchMyBlockedUsers`), and filtering blocked users out of feeds, route pages, and follow flows. Admin review happens in Supabase Studio. Beta-video reporting is owned by MOD-005 (the one-tap report flow, AC-139/AC-140), not MOD-009.

---

## Context

App Store Guideline 1.2 requires that apps with user-generated content provide (1) a mechanism for users to flag objectionable content, (2) a mechanism to block abusive users, and (3) a developer commitment to act on objectionable content within 24 hours. Send It implements both Report and Block in Phase 1. Block is **symmetric**: when user A blocks user B, B's content is hidden from A's feed and route pages, AND A's content is hidden from B's feed and route pages. This symmetric hiding is explicitly required by App Store Guideline 1.2 and is codified in AC-082 and AC-084. Follow is also blocked: a blocked user cannot follow the blocker and vice versa. The report alerting pipeline uses a scheduled Edge Function (every 6 hours) that emails the admin (wu.tsan@northeastern.edu) a digest of all open reports (`Report.status = open`) older than 12 hours, so the solo operator is alerted within the App Store Guideline 1.2 response window without having to poll Supabase Studio. Admin review and actioning of reports and user bans happens exclusively in Supabase Studio in Phase 1.

**Scope clarification (Rev 16)**: AC-080 is scoped to **user-profile reports only**. Beta-video reporting was moved to MOD-005 in PRD Revision 16: the one-tap beta-video report flow (AC-139/AC-140) writes to `beta_videos.is_reported` and the `video_reports` table (no category or note), and is entirely owned and implemented by MOD-005. MOD-009 does not implement the `VideoReport` table or the `report_beta_video` RPC. The `Report` table (this module) and the `VideoReport` table (MOD-005) coexist as separate tables with separate write paths and separate admin-review flows: `Report` → AC-085 email digest; `video_reports` → Studio manual review only.

**Rev 20 clarification**: In Phase 1, the profile Report action (AC-080) is invoked from the `UserProfileScreen` three-dots sheet (AC-150, owned by MOD-006). Selecting "Report" calls `reportUser` (persisting a `Report` row) and `blockUser` (AC-082) **sequentially** in the UI handler — not a single combined RPC. The report-and-block behavior is defined in AC-151. The `category` and `note` columns remain in the `Report` schema for admin/back-compat use; the three-dots flow defaults to a general "inappropriate" category and collects no note. No new migration is required for Rev 20.

**This module's block-status public service** (`isBlocked` / `fetchBlockedUserIds` / `fetchMyBlockedUsers`) is consumed by:
- MOD-006 `UserProfileScreen` on load to check blocked state in either direction (AC-153)
- MOD-005 route-detail beta-video list to filter out blocked users' videos client-side (AC-154)
- MOD-010 `BlockedAccountsScreen` to list the current user's blocked users (AC-155)

**Non-goals for this module:**
- In-app admin moderation UI (Supabase Studio only for Phase 1; a lightweight in-app admin surface is held in the Phase 2 slot if App Store review requires it).
- Automated content removal without admin review.
- Community-driven retire/reset voting (Phase 2).
- Beta-video reporting (owned by MOD-005 — the `VideoReport` table and `report_beta_video` RPC are MOD-005's responsibility).

---

## Related User Stories

- **US-015**: Report inappropriate content (user-profile reports only — the AC-080 report-and-block flow via AC-151; beta-video reports are owned by MOD-005)
- **US-016**: Block another user

**US-016 Acceptance Criteria**: AC-082, AC-083, AC-151, AC-152, AC-155

---

## Acceptance Criteria Covered

**AC-080** (revised): The system shall persist a **user-profile** report to the `Report` table for admin review in Supabase Studio. In Phase 1 the profile Report action is invoked from the `UserProfileScreen` three-dots sheet (AC-150) and both files this report record and blocks the reported user in a single action (AC-151); the category defaults to a general "inappropriate" value and no note is collected in that flow (the `category` and `note` columns remain in the `Report` schema for admin/back-compat use). (Beta-video reporting is not handled here — it is handled by the AC-140 one-tap flow in MOD-005, which writes to `beta_videos.is_reported` + the `VideoReport` table with no category or note.)

**AC-081**: The system shall show the reporter a confirmation state after a successful report submission and shall not require admin action to complete the report flow.

**AC-082**: The system shall allow a user to block another user, persist the relationship in the `Block` table, and immediately hide the blocked user's beta videos, sends, and profile from the blocker's feed and route pages.

**AC-083**: The system shall prevent a blocked user from following the blocker, liking the blocker's beta videos, or otherwise interacting with the blocker's content.

**AC-084**: The system shall apply block hiding symmetrically — the blocker's beta videos, sends, and profile shall also be hidden from the blocked user's feed and route pages, in addition to hiding the blocked user's content from the blocker (App Store Guideline 1.2 requirement).

**AC-085** (revised, Rev 34): The system shall run a scheduled Edge Function (every 6 hours) that emails the admin (wu.tsan@northeastern.edu) a digest of all open reports (`Report.status = open`) older than 12 hours, so the solo operator is alerted to unresolved objectionable-content reports within the App Store Guideline 1.2 response window. This digest covers the `Report` table only (user-profile and beta-video content reports filed via AC-080); it does not include the `VideoReport` table (beta-video reports filed via AC-140), which the admin reviews manually in Supabase Studio. **Phase 1 deferral (accepted, not a bug)**: real email delivery (Resend/SMTP) and cron registration are deferred post-launch; the `report-digest` Edge Function exists and queries the `Report` table correctly but only `console.log`s the digest in Phase 1. The operator (wu.tsan@northeastern.edu) reviews open reports manually in Supabase Studio. Real email delivery and a registered cron schedule are revisited post-launch when report volume warrants automation.

**AC-151** (new): Selecting "Report" in the three-dots sheet (AC-150) shall, in a single user action, both notify the admin and block the reported user: the system shall call `reportUser` (persisting a report record to the `Report` table for admin review per AC-080) and `blockUser` (AC-082) sequentially for the target user. This report-and-block behavior replaces the prior report-only profile action. The user shall see a confirmation, and the profile shall immediately show the blocked state (AC-153).

**AC-200** (revised, Rev 48, cross-cutting — MOD-009 ownership row, part of AC-199): The app shall be published and identified as "ProjectDay". MOD-009's scope for this AC: `supabase/functions/report-digest/index.ts:114` (email header "ProjectDay — Open Report Digest"). Needs redeployment.

---

## Integration Points

**Block-status public service consumed by MOD-006 (AC-153)**: `isBlocked(viewerId, targetId)` and `fetchBlockedUserIds(userId)` are public service functions exported by this module. MOD-006's `UserProfileScreen` calls these on load to determine whether either party has blocked the other. These are read-only queries on the `Block` table; no write permissions are needed for the consuming module.

**Block-status public service consumed by MOD-005 (AC-154)**: `fetchBlockedUserIds(userId)` is called once per route detail load by MOD-005 to obtain the set of user IDs blocked in either direction. MOD-005 uses the result to filter the `fetchBetaVideosForRoute` array client-side before rendering.

**Block-list public service consumed by MOD-010 (AC-155)**: `fetchMyBlockedUsers()` queries `blocks JOIN users` where `blocker_user_id = auth.uid()` and returns `Array<{ userId, displayName, avatarUrl }>`. MOD-010's `BlockedAccountsScreen` calls this to render the current user's blocked-accounts list. No migration needed — queries the existing `blocks` table. `unblockUser(userId)` (AC-152) is also consumed by MOD-010's Unblock button in the same screen.

---

## Data Model (relevant tables)

```
Report  (App Store Guideline 1.2 requirement)
 - id, reporter_user_id (FK User),
   target_type (user),
   target_id,
   category (inappropriate | spam | harassment | other),
   note (nullable),
   status (open | reviewed | actioned | dismissed),
   created_at, reviewed_at (nullable)
   -- Phase 1: used for user-profile reports only (AC-080).
   -- The three-dots-sheet flow (AC-151) defaults category to 'inappropriate'
   --   and collects no note; the category and note columns are retained for
   --   admin/back-compat use. No new migration required for Rev 20.
   -- Beta-video reports are filed to the VideoReport table (owned by MOD-005)
   --   via the AC-140 one-tap flow, not here.

Block  (App Store Guideline 1.2 requirement)
 - blocker_user_id (FK User), blocked_user_id (FK User), created_at
 - PK: (blocker_user_id, blocked_user_id)
```

All tables guarded by Supabase Row-Level Security policies. `Report` rows are insertable by authenticated users; readable by admins only. `Block` rows are insertable/deletable by the blocker; readable by both parties involved (for filtering).

---

## Input / Output Contract

**Inputs (user-profile report-and-block — AC-151):**
- `target_id` (the reported user), authenticated user session (reporter)
- Invoked from the `UserProfileScreen` three-dots sheet "Report" option (AC-150, owned by MOD-006)

**Outputs (user-profile report-and-block — AC-151):**
- `reportUser`: `Report` row inserted with `status = open`, `category = 'inappropriate'` (default), `note = null`
- `blockUser`: `Block` row inserted: `(blocker_user_id = reporter, blocked_user_id = target)`
- Both calls made sequentially in the UI handler (not a single combined RPC)
- Confirmation state shown to reporter immediately
- Profile immediately shows blocked state (AC-153)

**Inputs (block action — AC-152):**
- `blocked_user_id`, authenticated user session (blocker)
- Invoked from the `UserProfileScreen` three-dots sheet "Block" option (AC-150)

**Outputs (block action — AC-152):**
- `Block` row inserted: `(blocker_user_id, blocked_user_id)`
- Immediately hide blocked user's beta videos, sends, and profile from the blocker's feed and route pages (AC-082)
- Immediately hide the blocker's beta videos, sends, and profile from the blocked user's feed and route pages (AC-084 — symmetric)
- Blocked user cannot follow the blocker, like the blocker's videos, or otherwise interact (AC-083)
- Any existing Follow relationship between blocker and blocked user is removed

**Inputs (unblock action — AC-152):**
- `blocked_user_id`, authenticated user session
- Invoked from the `UserProfileScreen` three-dots sheet "Unblock" option (AC-150) or the `BlockedAccountsScreen` Unblock button (AC-155)

**Outputs (unblock action — AC-152):**
- `Block` row deleted
- Content filtering returns to normal for both parties

**Inputs (block-status public service — AC-153/AC-154):**
- `isBlocked(viewerId, targetId)`: returns boolean — true if a `Block` row exists in either direction between the two users
- `fetchBlockedUserIds(userId)`: returns the set of user IDs blocked by or blocking the given user (either direction)

**Outputs (block-status public service):**
- Read-only query results over the `Block` table (no write side-effects)
- Consumed by MOD-006 on `UserProfileScreen` load (AC-153) and by MOD-005 on route detail load (AC-154)

**Inputs (block-list public service — AC-155):**
- `fetchMyBlockedUsers()`: authenticated user session (`auth.uid()`)

**Outputs (block-list public service — AC-155):**
- `Array<{ userId, displayName, avatarUrl }>` — rows from `blocks JOIN users` where `blocker_user_id = auth.uid()`
- Consumed by MOD-010's `BlockedAccountsScreen` (AC-155); no migration needed

**Inputs (scheduled report digest Edge Function):**
- Scheduled trigger every 6 hours (Supabase cron / scheduled Edge Function)

**Outputs (scheduled report digest):**
- Email sent to wu.tsan@northeastern.edu listing all `Report` rows where `status = open` AND `created_at < now() - interval '12 hours'`
- Covers the `Report` table only; does not include `VideoReport` rows (AC-085)
- Edge Function reads `SERVICE_ROLE_KEY` (not `SUPABASE_SERVICE_ROLE_KEY`)
- **Phase 1 deferral**: real email delivery (Resend/SMTP) and cron registration are deferred post-launch; the `report-digest` Edge Function exists and queries the `Report` table correctly but only `console.log`s the digest in Phase 1; the operator reviews open reports manually in Supabase Studio

---

## Key Implementation Notes

- **Block symmetry (AC-082 + AC-084)**: Block hiding is symmetric — both directions must be enforced. When user A blocks user B: A's feed hides B's content (AC-082), AND B's feed hides A's content (AC-084). This applies to: activity feed (MOD-006), route pages (MOD-003 + MOD-005), and follow flows (MOD-006). The `Block` table stores only one direction `(blocker_user_id, blocked_user_id)`, but the MOD-006 feed RPC and any filtering logic must check both directions symmetrically.
- **Follow prevention (AC-083)**: The follow action in MOD-006 must check the `Block` table in both directions before allowing a Follow INSERT. If any block exists between the two users, the follow must be prevented.
- **Report confirmation (AC-081)**: The reporter sees a confirmation state immediately after submission; they do not wait for admin review. Admin review happens asynchronously in Supabase Studio.
- **`reportUser` and `blockUser` called sequentially, not as a single combined RPC (AC-151)**: In the `UserProfileScreen` three-dots sheet "Report" handler (MOD-006), the UI calls `reportUser` then `blockUser` sequentially. These are two separate service calls. No new migration is required for Rev 20 — the `Report` and `Block` tables and their existing write paths are reused. The sequential call pattern is consistent with the existing separation between report and block concerns.
- **Report alerting Edge Function (AC-085)**: A scheduled Edge Function runs every 6 hours. It queries `Report` rows with `status = open` AND `created_at < now() - interval '12 hours'` and sends an email digest to wu.tsan@northeastern.edu. The Edge Function reads `SERVICE_ROLE_KEY` (not `SUPABASE_SERVICE_ROLE_KEY`). The email body should list: report ID, target type, target ID, category, reporter user ID, created_at for each qualifying report. This digest covers the `Report` table only — the `VideoReport` table (beta-video one-tap reports, AC-140) is reviewed manually by the admin in Supabase Studio and is not included in the digest. **Phase 1 deferral (accepted, not a bug)**: real email delivery (Resend/SMTP) and cron registration are deferred post-launch; the `report-digest` Edge Function exists and queries the `Report` table correctly but only `console.log`s the digest in Phase 1; the operator (wu.tsan@northeastern.edu) reviews open reports manually in Supabase Studio. Real email delivery and a registered cron schedule are revisited post-launch when report volume warrants automation.
- **Admin review in Supabase Studio**: Report status transitions (`open → reviewed | actioned | dismissed`) and user bans are performed by the admin via Supabase Studio. No in-app admin UI in Phase 1.
- **Category enum (user-profile reports)**: `{inappropriate, spam, harassment, other}` — no free-text category. A free-text note field is optional. In the three-dots-sheet flow (AC-151), the category defaults to `'inappropriate'` and no note is collected.
- **Target type (user-profile reports)**: Reports filed via this module are always `target_type = user`. The `Report` table schema retains the `target_type` column for schema forward-compatibility, but in Phase 1 all reports through this module's flow are user-profile reports.
- **`VideoReport` table and `report_beta_video` RPC are owned by MOD-005**: MOD-009 does not implement them. The beta-video one-tap report flow (AC-139/AC-140) is entirely the responsibility of MOD-005.
- **Block-status public service (`isBlocked` / `fetchBlockedUserIds`)**: These are exported public service functions. `isBlocked(viewerId, targetId)` checks for a `Block` row in either direction. `fetchBlockedUserIds(userId)` returns all user IDs that are in a block relationship with the given user (either direction). Both are read-only and safe to call from MOD-006 and MOD-005 per the Cross-Module Imports convention.
- **`fetchMyBlockedUsers()` public service (AC-155)**: Queries `blocks JOIN users` where `blocker_user_id = auth.uid()`, returning `Array<{ userId, displayName, avatarUrl }>`. Consumed by MOD-010's `BlockedAccountsScreen` (AC-155). No migration needed — queries the existing `blocks` and `users` tables.

---

## Out of Scope for This Module

- In-app admin moderation UI (Supabase Studio only for Phase 1).
- Automated content removal without admin review.
- Community-driven retire/reset voting workflow (Phase 2).
- Blocking gyms or routes (Phase 1 only supports blocking users).
- Beta-video reporting: the `VideoReport` table and the `report_beta_video` SECURITY DEFINER RPC are owned by MOD-005, not MOD-009. AC-080 in this module is user-profile-only.
