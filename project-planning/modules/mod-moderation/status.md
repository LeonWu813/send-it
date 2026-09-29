# Moderation (Report & Block) (MOD-009) Status

## Engineering Progress

**Status**: Complete
**Date**: 2026-09-29

### Deliverables

#### Migrations
- `supabase/migrations/20260929000004_mod_009_moderation.sql` — Creates `report_category` enum, `reports` table (AC-080 user-profile reports), drops the MOD-006 stub `blocks` table and recreates with full schema (`blocker_user_id`, `blocked_user_id`, `created_at`), RLS policies, GRANTs.
- `supabase/migrations/20260929000005_mod_009_block_feed_filter.sql` — `CREATE OR REPLACE` of `get_activity_feed` with updated column names (blocker_user_id / blocked_user_id) and symmetric block filters added to both `ascent_items` and `video_items` CTEs (AC-082, AC-084). Preserves the AC-141 is_reported filter from mod_006.

#### Source code (`src/modules/mod-moderation/`)
- `types.ts` — `ReportCategory`, `BlockStatus`, `Report`, `Block` types.
- `moderation-service.ts` — `reportUser`, `blockUser`, `unblockUser`, `fetchBlockedUserIds`, `isBlocked`.
- `components/ReportSheet.tsx` — Modal bottom sheet with category picker (4 options), optional note (max 280 chars), submit→confirmation state (AC-081), cancel/dismiss.
- `components/ModerationActions.tsx` — Report + Block/Unblock controls; never renders for own profile; confirmation feedback after block/unblock.
- `screens/OtherUserProfileScreen.tsx` — Profile view for another user; displays avatar, display_name, bio; ModerationActions below; send history via `fetchProfileHistory` RPC (empty state if privacy-blocked); safe area insets applied.

#### Edge Function
- `supabase/functions/report-digest/index.ts` — Scheduled every 6 hours (AC-085). Queries `reports WHERE status = 'open' AND created_at < now() - 12 hours` with service-role client (bypasses RLS). Logs digest to console (Phase 1 acceptable fallback); structures outbound email for when Resend is configured. Reads `SERVICE_ROLE_KEY` (not `SUPABASE_SERVICE_ROLE_KEY`).

#### i18n
- `locales/en/common.json` — Added `moderation` section with report categories and block strings.
- `locales/zh-TW/common.json` — Added `moderation` section with Traditional Chinese translations.

### Verification
- `npx tsc --noEmit`: 0 errors
- `npx jest --passWithNoTests`: 405 tests passed, 31 suites

## QA Results

<!-- Filled by qa-mod-moderation agent -->
