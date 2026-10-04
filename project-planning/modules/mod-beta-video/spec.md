# MOD-005: Beta Video — Spec

**Module ID**: MOD-005
**Module Name**: Beta Video
**Phase**: 1
**Dependencies**: MOD-001, MOD-003, MOD-009 (block-status public service `fetchBlockedUserIds`, AC-154)
**Last Synced from PRD Revision**: 26
**Last Updated**: 2026-10-03

---

## Purpose

Handle video capture/selection (≤60 sec cap, 45 MB native-file size gate, no client-side compression), client-generated thumbnail, upload to storage, inline playback on route detail pages and the activity feed, the fullscreen portrait reel viewer (thumbnail grid → swipe-navigable viewer with a persistent back control, poster-identity overlay, and a two-icon action sidebar), and the one-tap beta-video report flow (report icon → `is_reported` flag via SECURITY DEFINER RPC + `VideoReport` insert, with reported videos hidden until an admin dismisses the report), filtering out beta videos uploaded by blocked users (block in either direction) on the route detail screen via MOD-009's `fetchBlockedUserIds()` (AC-154), and filtering out beta videos whose poster has set `beta_video_privacy = followers_only` when the viewer is neither the poster nor a follower (AC-158). Own the shared `BetaVideoGrid` component (3-column thumbnail grid, AC-160) consumed by MOD-006 (AC-163) and MOD-001 (AC-164); the `fetchBetaVideosByUser` service (AC-162) consumed by the same; the `reelContext: 'route' | 'profile'` prop on `BetaVideoReelViewer` (AC-164); the account-level upload flow (per-upload visibility toggle removed, AC-161; one-video-per-route enforced by a DB unique constraint AC-165 with an upsert/replace flow and a replace reminder, AC-166).

---

## Context

Sharing technique clips ("beta") tied to specific routes is one of Send It's core differentiators. A climber who figures out a tricky sequence can record a short clip, attach it to the relevant route, and publish it for others projecting that route to study. Videos are capped at 60 seconds; in Phase 1 the photo library picker uses the iOS default (`Automatic`) representation mode, under which iOS transcodes HEVC/HLG source footage to **H.264 SDR** before returning the URI; the client uploads the picker-returned file as-is after an upfront size gate (file size ≥ 45 MB rejected before upload begins; see AC-031/AC-169). There is no additional client-side compression and no further re-encoding in Phase 1. **Phase 1 limitation (accepted, not a bug)**: the iOS `Automatic`-mode transcode from HDR (BT.2020 HLG) to SDR is lossy; the Phase 2 server-side MediaConvert pipeline performs a proper HDR→SDR tone-map and removes this limitation. There is no server-side transcoding pipeline in Phase 1. Supabase Storage serves the file as-uploaded; playability depends entirely on iOS AVPlayer accepting the container/codec. The uploaded file is a standard QuickTime (`.mov`) H.264 SDR file produced by the iOS picker (accepted per AC-035). The thumbnail is generated on the client and uploaded alongside the video. In Phase 1, video is stored in Supabase Storage. When beta-video storage reaches 800 MB (80% of the 1 GB free-tier total), the operator must begin evaluating the Phase 2 migration to AWS S3 + CloudFront + MediaConvert (AC-170; this threshold does not block uploads). Beta videos are attached to exactly one Route and are playable inline both on the route detail page and in the activity feed.

For US-005, the route detail page presents beta videos as a three-column thumbnail grid; tapping a thumbnail opens a fullscreen, portrait-orientation reel viewer. The viewer has a persistent top-left back control, a bottom-left overlay with poster identity and route+gym info, and a two-icon right sidebar (like + report).

For US-015, the one-tap beta-video report flow is owned by this module: tapping the report icon in the viewer sidebar immediately sets `beta_videos.is_reported = true` via a SECURITY DEFINER RPC and inserts one `video_reports` row. A reported-and-not-dismissed video (`is_reported = true AND report_dismissed = false`) is hidden from every user everywhere it is surfaced until an admin sets `report_dismissed = true` via Supabase Studio.

For US-023, tapping Row 1 (the circular avatar or the `display_name` text) in the bottom-left overlay of the fullscreen viewer dismisses the viewer and navigates the user to that video poster's profile (the MOD-008 other-user profile-and-history surface, AC-064), subject to the poster's privacy setting (AC-063). Navigation is threaded from the viewer to the profile surface via a callback prop supplied by the hosting shell, not by MOD-005 importing the profile screen directly.

For US-023 (AC-154), the route detail screen's beta-video list filters out videos uploaded by blocked users (block in either direction) before rendering, using MOD-009's `fetchBlockedUserIds()` as a client-side filter over the fetched beta-video set. This filter is applied after `fetchBetaVideosForRoute` returns and before rendering, in addition to any existing reported-video exclusions (AC-142).

For US-012 (AC-158), every beta-video listing (route-detail grid, fullscreen viewer, activity feed) shall exclude any beta video whose poster has `beta_video_privacy = followers_only` when the viewer is neither the poster nor a follower. `beta_video_privacy` is read from the poster's user record via the existing `fetchBetaVideosForRoute` poster join (AC-144); the follower relationship is determined via the `Follow` table. This filter composes with the reported-video exclusion (AC-142) and the blocked-user filter (AC-154).

This module owns the shared `BetaVideoGrid` component (`mod-beta-video/components/BetaVideoGrid.tsx`, AC-160) and the `fetchBetaVideosByUser` service (AC-162), both consumed by MOD-006 (AC-163) and MOD-001 (AC-164). The `reelContext: 'route' | 'profile'` prop on `BetaVideoReelViewer` (AC-164) controls whether the poster-identity row is tappable (`'route'`) or visible-but-not-tappable (`'profile'`). The per-upload visibility toggle is removed (AC-161); visibility is the account-level `beta_video_privacy` setting only. A DB `UNIQUE (user_id, route_id)` constraint on `beta_videos` enforces one beta video per user per route (AC-165), and the upload flow uses upsert/replace with a replace reminder (AC-166).

**Non-goals for this module:**
- Comments on beta videos (out of scope for Phase 1).
- Android video pipeline (Phase 2).
- AWS S3 + CloudFront + MediaConvert video migration (Phase 2 — triggered when beta-video storage reaches 800 MB watch threshold, AC-170; runbook to be drafted before Phase 1 GA).
- Server-side transcoding (no custom backend server in Phase 1).
- Admin push or email notification for beta-video reports in Phase 1 — admin reviews the `video_reports` table manually in Supabase Studio only. Video reports are explicitly excluded from the AC-085 6-hourly email digest (which remains `Report`-table only).

---

## Related User Stories

- **US-004**: Upload a beta video for a route

  > **Known Phase 1 trade-off (Rev 24)**: The 45 MB size gate combined with the 60-second duration cap means a full-bitrate iPhone 1080p HEVC clip at ~16 Mbps hits 45 MB at approximately 22 seconds of footage. Users recording long clips at maximum iPhone bitrate will encounter the size limit before the duration limit. This is an accepted Phase 1 trade-off; client-side compression or a higher threshold are Phase 2 considerations.

- **US-005**: Watch beta inline on a route
- **US-015**: Report inappropriate content (beta-video report flow only — the one-tap AC-139/AC-140 flow; user-profile reports are owned by MOD-009)
- **US-023**: Open a beta video poster's profile

**US-004 Acceptance Criteria**: AC-030, AC-031, AC-032, AC-037, AC-130, AC-161, AC-165, AC-166, AC-169, AC-170

**US-005 Acceptance Criteria**: AC-033, AC-034, AC-038, AC-039, AC-133, AC-134, AC-135, AC-136, AC-137, AC-138

**US-015 Acceptance Criteria (beta-video only)**: AC-139, AC-140, AC-141, AC-142, AC-143

**US-023 Acceptance Criteria**: AC-135, AC-144, AC-154, AC-163

---

## Acceptance Criteria Covered

**AC-030**: The system shall reject beta video uploads longer than 60 seconds before upload begins.

**AC-031** (revised, Rev 26): The system shall select the beta video from the photo library **without** setting `preferredAssetRepresentationMode: Current` on the picker; the picker therefore uses the iOS default (`Automatic`) representation mode, under which iOS transcodes HEVC/HLG source footage to **H.264 SDR** before returning the URI. The system shall upload the file the picker returns as-is, with no additional client-side compression and no further re-encoding, when that file's size is under 45 MB. If the returned file's size is 45 MB or greater, or its size cannot be read, the system shall reject the upload before any upload attempt and display the bilingual error "影片檔案過大，請壓縮至 45MB 以下 / Video is too large, please keep it under 45 MB". There is no separate client-side compression step in Phase 1. The uploaded file is therefore a standard QuickTime (`.mov`) H.264 SDR file produced by the iOS picker (accepted per AC-035), not the original HEVC/HDR capture. **Phase 1 limitation (accepted, not a bug)**: the iOS `Automatic`-mode transcode from HDR (BT.2020 HLG) to SDR is lossy — some HDR color/dynamic-range information is discarded — because Phase 1's playback path (expo-video `VideoView`) renders HLG without an extended display range and would otherwise appear severely overexposed on SDR displays; the Phase 2 server-side MediaConvert pipeline (§4, §7) performs a proper HDR→SDR tone-map and removes this limitation. The system shall generate a thumbnail on the client and upload it alongside the video. **Phase 1 simplification**: the thumbnail may use the selected video's URI as a placeholder rather than an extracted still frame; true client-side frame extraction (e.g. a frame at 1 second) is deferred to Phase 2 (requires a frame-extraction library such as `expo-video-thumbnails`). `BetaVideo.thumbnail_url` must still be populated with a valid, retrievable URL in Phase 1. (The size check and its fail-closed behavior are unchanged — see AC-169 for the gate's timing; the 45 MB gate applies to whatever file the picker returns.)

**AC-032**: The system shall attach a beta video to exactly one `Route` and make it playable inline within 60 seconds of upload completion on a normal 4G/LTE connection.

**AC-033** (revised): The system shall display a route's beta videos on the route detail page and shall play a selected beta video without requiring the user to leave the app or open an external link. Videos are presented as a grid of thumbnails (AC-038) and played in an in-app fullscreen viewer launched on thumbnail tap (AC-039); no external link or browser is used.

**AC-034**: The system shall play beta videos inline in the activity feed for videos posted by followed users.

**AC-035** (revised): The system shall accept beta video uploads in either an MP4 (`.mp4`) or QuickTime (`.mov`) container — `.mov` is included so users can upload iPhone-camera footage without converting it first — and shall reject, on ingest, any upload whose video codec is not H.264 or HEVC or whose audio codec is not AAC, surfacing a clear error to the user rather than storing an unplayable file. Both containers are stored as-is (no server-side transcoding); the ≤60-second duration cap (AC-030) and size constraints apply regardless of container.

**AC-036** (revised, Rev 24): While a beta video upload is in progress, a progress overlay is displayed covering a single "Uploading…" phase (0–100%). There is no "Compressing…" phase — client-side compression has been removed (AC-031, Rev 24). The overlay blocks further interaction until the upload completes or fails, preventing double-submission.

**AC-037** (new — code gap, future module): The system shall present an "Add beta video" entry point on the route detail screen that launches the beta video capture/selection flow with the route context (route ID) pre-attached, so the resulting upload is bound to that route (AC-032). The entry point must be visible without leaving the route detail screen.

> **Boundary note on AC-037**: The entry point renders in MOD-003's `RouteDetailScreen.tsx` as a hosting slot; the capture/upload flow itself is owned by MOD-005. MOD-005's engineer owns this AC: `RouteDetailScreen` exposes a slot/prop (`onAddBetaVideo` or a MOD-005-provided component); MOD-005 fills it with the route-context-aware upload launcher.

**AC-038** (new): The route detail screen shall display the route's beta videos as a three-column grid. Each grid cell shall show only the video's thumbnail image with a small video-camera icon overlaid in the top-left corner, and no other metadata. Tapping a cell opens the fullscreen beta-video viewer (AC-039) for that video.

**AC-039** (revised): Tapping a beta-video thumbnail on the route detail screen shall open a fullscreen, portrait-orientation video viewer that auto-plays the tapped video. Within the viewer, swiping up shall advance to the next beta video for that route when one exists. Swiping down shall go to the previous beta video when a previous video exists, and otherwise (when the current video is the first in the set) shall dismiss the viewer and return to the route detail screen. Tapping the back control shall always dismiss the viewer and return to the route detail screen, from any position in the set. The viewer navigates only within the set of beta videos for the current route.

**AC-133** (new): The fullscreen beta-video viewer shall display a back control (a `<` chevron) fixed in the top-left corner that remains continuously visible and functional across every video in the reel, including while and after swiping to the next or previous video. The back control shall not unmount, disappear, or lose its tap target during or after a swipe transition.

**AC-134** (new): The fullscreen beta-video viewer shall display a bottom-left overlay, rendered over a gradient scrim for legibility, containing two rows: Row 1 — a small circular avatar (from the poster's `avatar_url`; placeholder circle if absent) and the poster's `display_name`; Row 2 — the composed string `{route_name} · {gym_name}`.

**AC-135** (revised): In the bottom-left overlay of the fullscreen beta-video viewer, tapping Row 1 (the circular avatar or the `display_name` text) shall dismiss the viewer and navigate the user to that video poster's profile (the MOD-008 other-user profile-and-history surface, AC-064), subject to the poster's privacy setting (AC-063). Navigation is threaded from the viewer to the profile surface via a callback prop supplied by the hosting shell, not by MOD-005 importing the profile screen directly.

**AC-136** (new): In the bottom-left overlay, tapping Row 2 (`{route_name} · {gym_name}`) shall navigate the user to the route detail screen for that video's route and dismiss the viewer.

**AC-137** (new): When the Row 2 text is wider than its container, the viewer shall auto-scroll it with a marquee animation implemented purely in JavaScript (React Native `Animated`); no new native package shall be introduced for the marquee. When the text fits, no animation runs.

**AC-138** (new): The fullscreen beta-video viewer's right sidebar shall contain exactly two action icons: the like icon with like count (AC-052), and the report icon (AC-139). The viewer shall not display share, download, comment, three-dot-menu, or any other action icons, and shall not display a bottom comment bar.

**AC-139** (new): The report icon in the right sidebar shall be shown only for beta videos the current user did not upload; it shall be hidden for the current user's own videos. It shall also be hidden (or permanently disabled and non-interactive) for any video where `report_dismissed = true`.

**AC-140** (new): Tapping the report icon on a beta video shall, in a single action: (1) set `beta_videos.is_reported = true` on that video's row via a SECURITY DEFINER RPC (so the reporter can flip a field on a row they do not own), and (2) insert exactly one row into the `video_reports` table capturing `beta_video_id`, `reporter_id`, and `reported_at`. No category or note is collected.

**AC-141** (new): A beta video with `is_reported = true` and `report_dismissed = false` shall be hidden from every user everywhere it is surfaced — route detail grid (AC-038), fullscreen viewer (AC-039), and activity feed (AC-051) — until an admin sets `report_dismissed = true`.

**AC-142** (new): The `fetchBetaVideosForRoute` query and any equivalent beta-video listing query shall exclude rows where `is_reported = true AND report_dismissed = false`.

**AC-143** (new): When an admin sets `beta_videos.report_dismissed = true` (via Supabase Studio), the video shall become visible again to all users on the next fetch, and the report affordance for that video shall be permanently hidden for all users (AC-139), preventing further reports.

**AC-144** (revised): The `fetchBetaVideosForRoute` result shall include the poster's `display_name` and `avatar_url` joined from the user record, so the viewer overlay (AC-134) can render poster identity without a second round-trip. The result shall also include the poster's `user_id` (UUID) on the same join, so the viewer has the poster's identifier for navigation per the revised AC-135. This `user_id` addition is a dependent edit required by the revised AC-135.

---

**AC-154** (new): In the route detail screen's beta-video list, the system shall filter out beta videos uploaded by users the viewer has blocked or who have blocked the viewer (block in either direction) before rendering, using MOD-009's public service `fetchBlockedUserIds()` as a client-side filter over the fetched beta-video set. This filter applies in addition to the reported-video exclusion (AC-142).

---

**AC-158** (new): The system shall exclude from every beta-video listing (the route-detail grid per AC-038/AC-142, the fullscreen viewer set per AC-039, and the activity feed per AC-051) any beta video whose poster has set `beta_video_privacy = followers_only` (AC-156) when the requesting viewer is neither the poster nor a follower of the poster. A viewer who is the poster, or who follows the poster, continues to see that poster's beta videos. This beta-video privacy filter applies in addition to the reported-video exclusion (AC-142) and the blocked-user filter (AC-154). The `beta_video_privacy` value is read from the poster's user record (joined on the existing `fetchBetaVideosForRoute` poster join, AC-144); the follower relationship is determined via the `Follow` table (the viewer is a follower when a `Follow` row exists with `follower_id = viewer` and `followee_id = poster`).

**AC-160** (new): The system shall provide a shared `BetaVideoGrid` component at `mod-beta-video/components/BetaVideoGrid.tsx` that renders a 3-column grid of beta-video thumbnails. Each cell shall show a Phase 1 placeholder: a gray background with a centered play-icon overlay on a dark gradient. The component's props shall be `videos: BetaVideo[]`, `onPressVideo: (index: number) => void`, and an optional `emptyState?: React.ReactNode`. Tapping a cell shall fire `onPressVideo(index)` with that cell's index. This component is owned by MOD-005 and consumed by MOD-006 (AC-163) and MOD-001 (AC-164).

**AC-161** (new): The system shall remove the per-video visibility toggle from `UploadBetaVideoScreen`. Beta-video visibility is an account-level setting (`beta_video_privacy`, AC-156/AC-157) and shall not be settable per upload.

**AC-162** (new): The system shall add a service function `fetchBetaVideosByUser(userId: string): Promise<BetaVideo[]>` to `mod-beta-video/beta-video-service.ts` that returns all beta videos uploaded by the given user across all routes, ordered by `created_at DESC`. This service is owned by MOD-005 and consumed by MOD-006 (AC-163) and MOD-001 (AC-164). The result remains subject to the existing visibility rules where surfaced (reported-video exclusion AC-142, blocked-user filter AC-154, and beta-video privacy AC-158 as applicable to the viewing context).

**AC-165** (new, DB migration): The system shall add a `UNIQUE (user_id, route_id)` constraint on the `beta_videos` table, enforcing one beta video per user per route at the database level. The migration file shall be `supabase/migrations/20260930000001_mod_005_beta_video_unique_per_route.sql`.

**AC-166** (new): In `UploadBetaVideoScreen`, before the final confirm/upload action, the system shall call a new service check `checkExistingBetaVideo(routeId): Promise<boolean>` to determine whether the current user already has a beta video for this route. If an existing video is found, the screen shall display the reminder text "你已經為這條路線上傳了一支 Beta 影片，確認後將取代現有的影片。" (EN: "You already have a beta video for this route. Confirming will replace your existing video."). The upload shall use an upsert pattern (delete-old + insert, or `ON CONFLICT DO UPDATE`) consistent with the AC-165 unique constraint.

**AC-169** (revised, Rev 24): Before any upload is attempted — after format validation (AC-035) and the duration check (AC-030) — the system shall read the native video file's size. If the native file size is 45 MB or greater, or the size cannot be read, the system shall reject the upload with the bilingual error "影片檔案過大，請壓縮至 45MB 以下 / Video is too large, please keep it under 45 MB" and shall not attempt the upload. The check fails closed: an unreadable size is treated as oversized and the upload is rejected. The 45 MB threshold sits below the 50 MB Supabase Storage free-tier bucket ceiling to leave a safe margin. No `expo-file-system` post-compression check is required (compression is removed in Rev 24).

**AC-170** (new, Rev 24): When beta-video storage usage in the Supabase `beta-videos` bucket reaches 800 MB — 80% of the 1 GB free-tier total shared across all Supabase Storage buckets — the system shall surface a storage-watch trigger to the operator indicating that Phase 2 video infrastructure migration evaluation must begin. This threshold does not block uploads. The 800 MB threshold is the operator-level monitoring target; reaching it does not cause any user-visible change to the upload flow.

---

## Integration Points

1. **File to modify**: `src/modules/mod-route-catalog/screens/RouteDetailScreen.tsx`
   **Change**: Fill the slot/prop exposed by MOD-003 (e.g., `onAddBetaVideo` callback or a MOD-005-provided component) with the route-context-aware beta video capture/selection launcher. The launcher receives the `route_id` pre-attached so the resulting upload is bound to the correct route (AC-032). This is a MOD-003 host-screen change owned by MOD-005.
   **Owner**: engineer-mod-beta-video implements the slot fill and owns AC-037 end-to-end; engineer-mod-route-catalog confirms the slot/prop contract is satisfied before QA handoff on AC-037.
   **AC**: AC-037

2. **File to modify**: `src/modules/mod-social-feed/` (the feed item component that renders `BetaVideo` rows)
   **Change**: Embed the MOD-005 inline video playback component into the activity feed item for beta video entries, so videos play inline within the feed without leaving the app (AC-034).
   **Owner**: engineer-mod-beta-video exposes the inline playback component; engineer-mod-social-feed embeds it in the feed item renderer.
   **AC**: AC-034

3. **Coordinated change — MOD-006**: The `get_activity_feed` RPC's `video_items` CTE must also add the report exclusion filter (`WHERE (bv.is_reported = FALSE OR bv.report_dismissed = TRUE)`) to exclude reported-and-not-dismissed beta videos from the activity feed (AC-141). This ships in a MOD-006 migration ordered after `20260928000001_mod_005_video_reports.sql`. See MOD-006 spec for ownership details.
   **AC**: AC-141

4. **MOD-009 block-status dependency (AC-154)**: `fetchBlockedUserIds(userId)` is called once per route detail load from MOD-009's public service (`mod-moderation/moderation-service`). The result is used to filter the `fetchBetaVideosForRoute` result array client-side before rendering. This is a direct import of a public service function per the Cross-Module Imports convention.
   **AC**: AC-154

5. **Shared `BetaVideoGrid` component (AC-160)**: `BetaVideoGrid` at `mod-beta-video/components/BetaVideoGrid.tsx` is exported as a public component from MOD-005. MOD-006 (AC-163) and MOD-001 (AC-164) import and consume it. MOD-005 owns this component.

6. **Shared `fetchBetaVideosByUser` service (AC-162)**: `fetchBetaVideosByUser(userId)` in `mod-beta-video/beta-video-service.ts` is exported as a public service from MOD-005. MOD-006 (AC-163) and MOD-001 (AC-164) import and consume it.

7. **`reelContext` prop on `BetaVideoReelViewer` (AC-164)**: MOD-005 adds `reelContext: 'route' | 'profile'` to `BetaVideoReelViewerProps`. `'route'` = existing behavior (poster row tappable per AC-135); `'profile'` = poster row visible, not tappable. MOD-006 (AC-163) and MOD-001 (AC-164) pass `reelContext = 'profile'`.

---

## Data Model (relevant tables)

```
BetaVideo
 - id, route_id (FK Route), user_id (FK public.users(id) — repointed from auth.users(id)),
   video_url, thumbnail_url, duration_seconds, caption, created_at,
   is_reported (boolean NOT NULL DEFAULT false),
   report_dismissed (boolean NOT NULL DEFAULT false)
   -- UNIQUE (user_id, route_id) — enforces one beta video per user per route
   --   at the DB level (AC-165). Migration: 20260930000001_mod_005_beta_video_unique_per_route.sql.
   --   The upload flow is upsert/replace (AC-166): if a user already has a video
   --   for this route, the upload replaces it (delete-old + insert, or ON CONFLICT
   --   DO UPDATE). Per-upload visibility toggle removed (AC-161) -- visibility is the
   --   account-level users.beta_video_privacy setting (AC-156/AC-157).
   -- Upload size gate (AC-169, no schema change, Rev 24): before any upload attempt,
   --   the client reads the native video file's size. If >= 45 MB or unreadable,
   --   upload is rejected with the zh-TW/EN "too large" error. Fails closed:
   --   unreadable size = oversized. No compression, no post-compression check.
   --   The 45 MB gate applies to whatever file the picker returns (AC-031, Rev 26).
   -- is_reported: set true via a SECURITY DEFINER RPC when any user files a
   --   one-tap report (AC-140). The reporter does not own the row, so the flip
   --   must go through a SECURITY DEFINER RPC, not a direct UPDATE.
   -- report_dismissed: set true only by an admin via Supabase Studio (AC-143),
   --   which un-hides the video for all users and permanently hides the report
   --   affordance (AC-139), preventing further reports.
   -- Visibility rule (AC-141/AC-142): a row with is_reported = true AND
   --   report_dismissed = false is hidden from every user everywhere it is
   --   surfaced (route detail grid, fullscreen viewer, activity feed).
   --   Requires a migration to add the two new columns.

VideoReport  (beta-video one-tap reports — App Store Guideline 1.2)
 - id (uuid PK DEFAULT gen_random_uuid()),
   beta_video_id (uuid NOT NULL, FK public.beta_videos(id) ON DELETE CASCADE),
   reporter_id (uuid NOT NULL, FK public.users(id)),
   reported_at (timestamptz NOT NULL DEFAULT now())
 - Unique: (beta_video_id, reporter_id) — prevents duplicate reports from the
   same user on the same video.
   -- Written by the AC-140 one-tap report flow (no category, no note).
   -- RLS: authenticated users may INSERT their own rows (reporter_id = auth.uid()).
   --   No SELECT policy for authenticated — regular users never need to read
   --   video_reports; admin reads via service role (bypasses RLS).
   --   No UPDATE, no DELETE grants/policies — reports are immutable once filed.
   -- Reviewed manually by the admin in Supabase Studio; NOT included in the
   --   AC-085 6-hourly email digest (which covers the Report table only).
   -- Coexists with the Report table (Report = user-profile + category/note
   --   reports via AC-080; VideoReport = beta-video one-tap reports via AC-140).
```

The `users` table gains `beta_video_privacy (public | followers_only, default public)` — this column is owned by MOD-001. MOD-005's AC-158 filter reads `beta_video_privacy` from the poster's user record via the existing `fetchBetaVideosForRoute` poster join (AC-144). No migration in MOD-005 for this column — the migration is owned by MOD-001.

All tables guarded by Supabase Row-Level Security policies. `BetaVideo` rows are insertable by the uploading user. Readable by all authenticated users (subject to uploader's `privacy_setting` from MOD-001 — if uploader is `followers_only`, non-followers cannot access the video listing). A beta video with `is_reported = true AND report_dismissed = false` is hidden from every user (AC-141/AC-142). Video and thumbnail files are stored in Supabase Storage with RLS policies aligned with the corresponding table policies.

---

## Input / Output Contract

**Inputs (upload):**
- Video file selected from camera roll or captured in-app (duration checked client-side before upload begins)
- `route_id` (FK from MOD-003, required — one beta video attached to exactly one route)
- `caption` (optional text)
- Authenticated user session (MOD-001)

**Outputs (upload):**
- Client-side: upfront size gate applied (AC-169, Rev 24) — if the picker-returned file is >= 45 MB or unreadable, upload rejected; otherwise the picker-returned H.264 SDR `.mov` file uploaded as-is (AC-031, Rev 26); thumbnail generated; both validated for codec conformance before upload
- `checkExistingBetaVideo(routeId)` called before confirm — if existing video found, replace reminder shown (AC-166)
- Video artifact and thumbnail uploaded to Supabase Storage
- `BetaVideo` row inserted (or upserted) in Postgres with `video_url`, `thumbnail_url`, `duration_seconds`, `caption`, `route_id`, `user_id`, `is_reported = false`, `report_dismissed = false`, consistent with the `UNIQUE (user_id, route_id)` constraint (AC-165)
- On ingest validation failure: clear error message displayed to user; no file stored
- Per-upload visibility toggle is not present (AC-161); visibility governed by `users.beta_video_privacy` (AC-156/AC-157)

**Inputs (playback):**
- `BetaVideo` rows from `fetchBetaVideosForRoute` — including `is_reported`, `report_dismissed`, `user_id`, `display_name`, `avatar_url` (joined from `public.users` via `users!beta_videos_user_id_fkey`), and `beta_video_privacy` from the poster's user record (for AC-158 filter)
- Blocked user IDs from `fetchBlockedUserIds(currentUserId)` (MOD-009) — used as client-side filter (AC-154)
- Follower relationship from `Follow` table — used as part of the AC-158 `beta_video_privacy` filter
- Render context: route detail page (AC-033/AC-038/AC-039) or activity feed (AC-034)

**Outputs (playback):**
- Route detail page: three-column thumbnail grid (AC-038), with videos from blocked users filtered out (AC-154) and videos from `followers_only` posters filtered out for non-followers (AC-158) before rendering; tapping a cell opens the fullscreen reel viewer (AC-039) with persistent back control (AC-133), poster-identity overlay (AC-134), and two-icon sidebar (AC-138)
- Activity feed: inline video playback within the app — no external link or browser required (AC-034); AC-158 filter also applies

**Inputs (report):**
- `beta_video_id`, authenticated user session
- Reporter must not be the video owner (AC-139)

**Outputs (report):**
- `report_beta_video(p_beta_video_id uuid)` SECURITY DEFINER RPC sets `beta_videos.is_reported = true` and inserts one `video_reports` row (idempotent via `ON CONFLICT DO NOTHING`)
- Reported video is hidden from all users on next fetch (AC-141)

**Inputs (AC-154 block filter):**
- `fetchBlockedUserIds(currentUserId)` called once per route detail load, imported from `mod-moderation/moderation-service` (MOD-009 public service)

**Outputs (AC-154 block filter):**
- Blocked user IDs used as a client-side filter over the `fetchBetaVideosForRoute` result array before rendering; videos whose `user_id` is in the blocked set are excluded from the rendered grid

**Inputs (BetaVideoGrid — AC-160):**
- `videos: BetaVideo[]`, `onPressVideo: (index: number) => void`, optional `emptyState?: React.ReactNode`

**Outputs (BetaVideoGrid — AC-160):**
- 3-column grid; each cell: gray background with centered play-icon overlay on dark gradient (Phase 1 placeholder); tapping fires `onPressVideo(index)`

**Inputs (fetchBetaVideosByUser — AC-162):**
- `userId: string`, authenticated session

**Outputs (fetchBetaVideosByUser — AC-162):**
- `Promise<BetaVideo[]>` — all beta videos by the given user across all routes, ordered `created_at DESC`

---

## Key Implementation Notes

- **60-second cap**: Check video duration client-side before the upload begins. Reject (with clear error) any video longer than 60 seconds (AC-030). Do not begin upload for over-limit videos.
- **Picker representation mode (AC-031, Rev 26)**: The photo library picker must NOT set `preferredAssetRepresentationMode: Current`. The picker uses the iOS default (`Automatic`) mode, under which iOS transcodes HEVC/HLG source footage to H.264 SDR before returning the URI. The client uploads the picker-returned file as-is with no additional client-side compression and no further re-encoding. The uploaded file is therefore a standard QuickTime (`.mov`) H.264 SDR file, not the original HEVC/HDR capture. **Phase 1 limitation (accepted, not a bug)**: the iOS `Automatic`-mode HDR→SDR transcode is lossy; the Phase 2 MediaConvert pipeline performs a proper HDR→SDR tone-map. Because Supabase Storage serves the file as-uploaded with no server-side transcoding, playability on iOS AVPlayer depends on the container/codec — the picker-returned H.264 SDR `.mov` is accepted per AC-035.
- **Upfront native-file size gate (AC-169, Rev 24)**: Before the upload attempt, read the native video file's size. If the native file size is >= 45 MB, or the size cannot be read, reject the upload with the bilingual error "影片檔案過大，請壓縮至 45MB 以下 / Video is too large, please keep it under 45 MB". The check fails closed: an unreadable size is treated as oversized. No `react-native-compressor` step, no `expo-file-system` post-compression check. `react-native-compressor` is removed from the project (Rev 24). The 45 MB gate applies to whatever file the picker returns (AC-031, Rev 26).
- **Progress overlay (AC-036, Rev 24)**: The upload progress overlay covers a single "Uploading…" phase (0–100%). There is no "Compressing…" phase (compression removed, Rev 24). The overlay must block further interaction until the upload completes or fails.
- **Ingest validation (AC-035)**: Before inserting the `BetaVideo` row, validate that the muxed output uses H.264 or HEVC video + AAC audio. Rejection is codec-based, not container-based — both `.mp4` and `.mov` are accepted containers; an upload is rejected only when the video codec is not H.264/HEVC or the audio codec is not AAC. If validation fails, surface a clear error and do not store the file.
- **Thumbnail (Phase 1 simplification)**: In Phase 1, the thumbnail may use the video URI as a placeholder; `BetaVideo.thumbnail_url` must still be a valid, retrievable URL. Client-side frame extraction (e.g. a frame at 1 second using `expo-video-thumbnails`) is deferred to Phase 2. Uploaded to Supabase Storage alongside the video. URL stored in `BetaVideo.thumbnail_url`.
- **Phase 1 simplification — client-side frame extraction deferred**: True frame extraction (extracting a still frame from the video at a given timestamp) is a Phase 2 feature. Phase 1 may populate `thumbnail_url` with the video URI as a placeholder, provided it is a valid, retrievable URL (AC-031 Phase 1 clause). Adding a native frame-extraction dependency (e.g. `expo-video-thumbnails`) is a scope/dependency decision deferred to Phase 2.
- **Storage upload pattern**: Upload video and thumbnail to Supabase Storage using the Supabase client singleton from `src/lib/supabase.ts`. Never call `createClient()` at call sites. Never import the `service_role` key in client code. The service-role key lives in `supabase secrets` as `SERVICE_ROLE_KEY` and is only read inside Edge Functions.
- **Inline playback**: Beta videos must play inline in both the route detail page (MOD-003 context) and the activity feed (MOD-006 context). No external links. No external browser.
- **60-second playability SLA (AC-032)**: The video must be playable inline within 60 seconds of upload completion on a normal 4G/LTE connection. Since there is no server transcoding, this depends on Storage CDN delivery latency — the compression + upload pipeline must keep total time within the SLA.
- **Phase 1 Storage**: All video stored in Supabase Storage. Phase 2 migration target: AWS S3 + CloudFront + MediaConvert (superseding the previously documented Cloudflare Stream target, Rev 24). Storage watch threshold: 800 MB of the 1 GB free-tier total (AC-170) — reaching this threshold does not block uploads but triggers operator evaluation of Phase 2 migration. A migration runbook should be drafted before Phase 1 GA.
- **Attachment constraint**: Each `BetaVideo` row has exactly one `route_id`. A video cannot be attached to multiple routes.
- **One-per-route unique constraint (AC-165)**: A `UNIQUE (user_id, route_id)` constraint on `beta_videos` enforces one beta video per user per route at the DB level. Migration file: `supabase/migrations/20260930000001_mod_005_beta_video_unique_per_route.sql`.
- **Upsert/replace flow (AC-166)**: In `UploadBetaVideoScreen`, before the confirm/upload action, call `checkExistingBetaVideo(routeId): Promise<boolean>`. If an existing video is found, display the reminder "你已經為這條路線上傳了一支 Beta 影片，確認後將取代現有的影片。" The upload uses an upsert (delete-old + insert, or `ON CONFLICT DO UPDATE`) consistent with the AC-165 unique constraint.
- **Per-upload visibility toggle removed (AC-161)**: Remove the per-video visibility toggle from `UploadBetaVideoScreen`. Beta-video visibility is the account-level `beta_video_privacy` setting (AC-156/AC-157); it must not be settable per upload.
- **AC-154 block filter — `fetchBlockedUserIds()` called once per route detail load**: `fetchBlockedUserIds(currentUserId)` is called once when the route detail loads (not once per video). The returned set of blocked user IDs is used to filter the `fetchBetaVideosForRoute` result array client-side before rendering. Direct import from `mod-moderation/moderation-service` (MOD-009 public service). This filter is applied after `fetchBetaVideosForRoute` and after the reported-video exclusion (AC-142), before the video array is passed to the grid renderer.
- **AC-158 beta-video privacy filter**: Reads `beta_video_privacy` from the poster's user record (returned by the existing poster join in `fetchBetaVideosForRoute`, AC-144). Viewer is a follower when a `Follow` row exists with `follower_id = viewer` and `followee_id = poster`. The filter excludes any video where the poster's `beta_video_privacy = followers_only` AND the viewer is not the poster AND the viewer does not follow the poster. Composes with the reported-video exclusion (AC-142) and the blocked-user filter (AC-154).
- **`BetaVideoGrid` component (AC-160)**: New file `mod-beta-video/components/BetaVideoGrid.tsx`. 3-column grid of video thumbnails. Phase 1 placeholder: gray background + centered play-icon overlay on dark gradient. Props: `videos: BetaVideo[]`, `onPressVideo: (index: number) => void`, optional `emptyState?: React.ReactNode`. Exported as a public component consumed by MOD-006 (AC-163) and MOD-001 (AC-164).
- **`fetchBetaVideosByUser` service (AC-162)**: New function in `mod-beta-video/beta-video-service.ts`. Returns all beta videos by `userId` across all routes, ordered `created_at DESC`. Exported as a public service consumed by MOD-006 (AC-163) and MOD-001 (AC-164).
- **`reelContext` prop on `BetaVideoReelViewer` (AC-164)**: Add `reelContext: 'route' | 'profile'` to `BetaVideoReelViewerProps`. `'route'` = existing behavior (poster row tappable, navigates to poster's profile per AC-135); `'profile'` = poster row visible but NOT tappable (no navigation on Row-1 tap). MOD-006 (AC-163) and MOD-001 (AC-164) pass `reelContext = 'profile'`.

### Grid and Fullscreen Reel Viewer (AC-038 / AC-039) — Tech Lead Decisions (Rev 13)

The following six decisions were recorded by Tech Lead in the 2026-09-28 review and are pinned here so the engineer does not need to consult `status.md`.

1. **Portrait lock — no new dependency.** `app.json` already sets `"orientation": "portrait"` globally — the entire app is portrait-locked at the native manifest level. AC-039's "portrait-orientation viewer" is satisfied for free. Do NOT add `expo-screen-orientation`. The viewer must not attempt to programmatically lock/unlock orientation; it inherits portrait from the app config.

2. **Modal architecture — `BetaVideoReelViewer.tsx` is an RN `<Modal>`.** The fullscreen viewer is a new MOD-005 component `BetaVideoReelViewer.tsx` rendered as a React Native `<Modal>` (`animationType="fade"` or `"slide"`, `presentationStyle="overFullScreen"`, `statusBarTranslucent`), mounted from within `BetaVideoSection` (or the new grid component). It is NOT a new navigator screen and NOT a global AppShell overlay. Precedent: `BetaVideoUploader.tsx` already uses RN `<Modal>` — the pattern is proven in MOD-005. The currently-open video index is a `useState<number | null>` in the grid/section component (`null` = closed, `N` = viewer open at index N); `<Modal visible={openIndex !== null}>`.

3. **Playlist order — reuse `fetchBetaVideosForRoute`; tap index maps 1:1 to viewer start index; no wrap.** `fetchBetaVideosForRoute(routeId)` already returns the full set ordered `created_at DESC` (newest-first). The viewer reuses this exact in-memory array — no new fetch, no new query. Grid renders newest-first (the array as fetched); the viewer swipes in that same array order — tapping grid cell *i* opens the viewer at index *i*, swipe-up → *i+1*, swipe-down → *i-1* (when i > 0) or dismiss (when i === 0). Grid order == viewer swipe order == `fetchBetaVideosForRoute` order (`created_at DESC`). Swipe-up at the last index is a no-op (AC-039: "next video ... when one exists"); swipe-down at index 0 dismisses (AC-039). Do not wrap.

4. **`expo-video` fullscreen — do NOT use `enterFullscreen()`.** Do not call `VideoView.enterFullscreen()`. Native OS fullscreen forces native controls and its own dismiss chrome and cannot host the custom swipe-up-to-next-video gesture AC-039 requires. Achieve the fullscreen effect by sizing a plain `VideoView` to fill the modal: inside `BetaVideoReelViewer`'s `<Modal>`, a full-screen `View` (`flex: 1`, dark/black background, safe area insets) containing a `VideoView` sized `{ width: '100%', height: '100%' }` with `contentFit="contain"`. Auto-play (AC-039): create the player with `useVideoPlayer` and call `player.play()` on mount / on index change (`loop = false`). Recommend one `useVideoPlayer` whose source is replaced (`player.replace()` or remount) when `openIndex` changes — one active player at a time avoids N simultaneous decoders.

5. **Swipe gesture — RN built-in `PanResponder`; do NOT add `react-native-gesture-handler`.** `react-native-gesture-handler` is not installed and adding it requires a native dependency install + rebuild + a root `GestureHandlerRootView` wrap. Use RN core `PanResponder` (vertical-only): `onMoveShouldSetPanResponder` returns true when `|dy| > |dx|` and `|dy|` exceeds a threshold; on release, `dy < -SWIPE_THRESHOLD` → advance to next (if exists); `dy > +SWIPE_THRESHOLD` → go to previous (if exists) or dismiss. Also provide an explicit back/close control (`<` chevron, AC-133) pinned top-left within `insets.top` — the back control always dismisses from any position in the set (AC-039). The back control must not unmount, disappear, or lose its tap target during or after a swipe transition (AC-133). `<Modal onRequestClose>` should also route to dismiss. If `nativeControls` is on in the viewer, keep the `PanResponder` on a region outside the control bar's hit area to avoid gesture conflicts; or disable `nativeControls` in the viewer and rely on auto-play + swipe + back button. Document the chosen approach.

6. **Thumbnails — Phase 1 placeholder; do NOT mount `VideoView` per grid cell; do NOT add a frame-extraction library.** `thumbnail_url` is a video storage path, not an image (confirmed by PM Rev 10 ruling / AC-031 Phase 1 simplification). Each AC-038 grid cell renders the mandatory camera-icon overlay (top-left, AC-038) over a neutral themed placeholder fill (e.g. `styles.thumbnailPlaceholder`, `theme.colors.textDisabled`), attempting `<Image>` but expecting it to fall back. Do NOT mount a `VideoView` per grid cell — N live decoders on one screen risks the ≤3s cold-start / smooth-scroll NFR and battery. Do NOT add a frame-extraction library (`expo-video-thumbnails`) for this change — that reopens the settled Phase 2 scope decision (AC-031 Phase 1 clause). The camera-icon overlay is the "this is a video" affordance; the placeholder-thumbnail limitation is cosmetically absorbed by the AC-038 design.

### Reel Viewer Overlay, Report Flow, and Data Join — Tech Lead Decisions (Rev 16)

The following decisions were recorded by Tech Lead in the 2026-09-28 review for Rev 16 and are pinned here.

#### Migration

All four DDL objects for the report feature ship in a **single migration file** `20260928000001_mod_005_video_reports.sql`, in this order:
1. `ALTER TABLE public.beta_videos ADD COLUMN is_reported boolean NOT NULL DEFAULT false, ADD COLUMN report_dismissed boolean NOT NULL DEFAULT false;`
2. FK repoint: drop the existing `beta_videos_user_id_fkey` (which targets `auth.users(id)`), add a new `beta_videos_user_id_fkey` targeting `public.users(id) ON DELETE CASCADE`. This is value-preserving — every `beta_videos.user_id` value already equals a `public.users.id` value. This repoint is REQUIRED for the AC-144 PostgREST embedded join to resolve.
3. `CREATE TABLE public.video_reports` with `UNIQUE(beta_video_id, reporter_id)`, RLS enabled, INSERT-own-rows policy (`reporter_id = auth.uid()`), `GRANT INSERT ON public.video_reports TO authenticated` (no SELECT/UPDATE/DELETE).
4. `report_beta_video(p_beta_video_id uuid) RETURNS void` SECURITY DEFINER RPC (see below), `GRANT EXECUTE TO authenticated`, `REVOKE EXECUTE FROM anon, public`.

#### RPC signature and body

```sql
CREATE OR REPLACE FUNCTION public.report_beta_video(p_beta_video_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT user_id INTO v_owner FROM public.beta_videos WHERE id = p_beta_video_id;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Beta video not found';
  END IF;
  IF v_owner = auth.uid() THEN
    RAISE EXCEPTION 'Cannot report your own video';
  END IF;

  INSERT INTO public.video_reports (beta_video_id, reporter_id)
  VALUES (p_beta_video_id, auth.uid())
  ON CONFLICT (beta_video_id, reporter_id) DO NOTHING;

  UPDATE public.beta_videos
    SET is_reported = TRUE
    WHERE id = p_beta_video_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.report_beta_video(UUID) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.report_beta_video(UUID) TO authenticated;
```

- Takes only `p_beta_video_id`; **never** a `reporter_id` parameter — reporter is always `auth.uid()`.
- Idempotent via `ON CONFLICT DO NOTHING` on `(beta_video_id, reporter_id)`.
- Forbids self-report (server-side defense-in-depth for AC-139).
- Writes exactly two things: one `video_reports` row + `is_reported = TRUE`. Must **never** touch `report_dismissed` (admin-only, Studio/service-role only per AC-143).

#### `fetchBetaVideosForRoute` filter and join

The client query must use the canonical exclusion predicate (not a bare `is_reported = false`):

```ts
.or('is_reported.eq.false,report_dismissed.eq.true')
```

This returns rows that are either not reported, OR reported-but-admin-dismissed (visible again per AC-143). A bare `.eq('is_reported', false)` would permanently hide admin-dismissed videos, violating AC-143.

The embedded join for poster identity (AC-144):

```ts
'users!beta_videos_user_id_fkey(display_name, avatar_url)'
```

This join **requires** the FK repoint to `public.users(id)` (item 2 in the migration above). Until the migration runs, PostgREST returns an error. After the query, flatten the embedded `users` object to top-level `display_name` / `avatar_url` on the returned `BetaVideo` so the viewer (AC-134) reads `video.display_name` directly; do not leak the nested `users` object to the UI.

#### `BetaVideo` TypeScript type additions (`mod-beta-video/types.ts`)

Add to the `BetaVideo` interface:
- `is_reported: boolean`
- `report_dismissed: boolean`
- `display_name: string | null`
- `avatar_url: string | null`

#### Marquee (AC-137)

Pure-JS `Animated` `translateX` loop in an `overflow:'hidden'` container, gated on measured text overflow. Pattern: measure text width via `onLayout` (or `onTextLayout`); if text width > container width, run `Animated.loop(Animated.timing(translateX, { toValue: -(textWidth - containerWidth), duration, useNativeDriver: true }))` (ping-pong or reset-to-start); if text fits, render static (no animation). `useNativeDriver: true` is fine for `translateX`. **No new native package** — no `reanimated`, no `react-native-marquee`, no native rebuild.

#### Report icon visibility (AC-139)

Hide the report icon when `video.user_id === session.user.id` OR `video.report_dismissed === true`. Both values are present on the `BetaVideo` row from `fetchBetaVideosForRoute` — no extra query needed.

#### MOD-006 coordination

The `get_activity_feed` RPC's `video_items` CTE must add the same exclusion filter (`WHERE (bv.is_reported = FALSE OR bv.report_dismissed = TRUE)`) to exclude reported-and-not-dismissed videos from the feed (AC-141). This is a MOD-006-owned change that ships in a separate MOD-006 migration (`20260928000002_mod_006_feed_exclude_reported.sql`) ordered after `20260928000001_mod_005_video_reports.sql`. Both engineers and the ordering dependency must be routed.

### Poster-Profile Navigation — Tech Lead Decisions (Rev 18)

The following decisions were recorded by Tech Lead in the 2026-09-30 review for Rev 18 and are pinned here.

#### AC-135 revised — `onNavigateToUser` callback prop on `BetaVideoReelViewer`

The revised AC-135 converts the prior no-op Row-1 tap into a profile-navigation action. The correct shape is a new optional prop `onNavigateToUser?: (userId: string) => void` on `BetaVideoReelViewerProps`, parallel to the existing `onNavigateToRoute?: (routeId: string) => void` (Row 2 / AC-136). When Row 1 is tapped, the viewer calls `onNavigateToUser(currentVideo.user_id)` then `onDismiss()`. `currentVideo.user_id` is already available on every `BetaVideo` row returned by `fetchBetaVideosForRoute` (confirmed: `user_id` is already selected and already typed on the `BetaVideo` interface per Rev 16). MOD-005 must NOT import `UserProfileScreen`, `UserProfileNavigator`, or any profile-screen component from MOD-006 — that both violates the Cross-Module Imports rule and inverts the dependency direction (MOD-005 does not depend on MOD-006).

The prop is threaded down the mount chain the reel viewer already sits on: `AppShell → GymNavigator → RouteNavigator → RouteDetailScreen → BetaVideoReelViewer`. `onNavigateToRoute` is already threaded down that chain, so `onNavigateToUser` follows the identical, already-proven path. At the top, `AppShell` (MOD-012) wires `onNavigateToUser` to the **same action `handleSelectClimber` already uses for AC-123** (`setTargetUserId(userId)`), which opens `UserProfileScreen` as a modal overlay. This reuses the one existing "open another user's profile from anywhere" code path — do NOT invent a new mechanism.

Note: the `reelContext = 'profile'` mode (AC-164) means `onNavigateToUser` is not called in that context — the poster row is visible but NOT tappable when `reelContext = 'profile'`.

#### AC-144 revised — `user_id` already selected

Tech Lead confirmed (Rev 18 Q4): `fetchBetaVideosForRoute` already selects `user_id` explicitly and the `BetaVideo` TypeScript type already declares `user_id: string`. The `user_id` addition in AC-144 (revised) is a no-op at the data layer — `user_id` is already returned and already typed. The only real change Rev 18 requires for AC-144 is wiring: the reel viewer must use `currentVideo.user_id` in the new `onNavigateToUser` callback (see AC-135 above). No schema change, no migration, no service-query change is needed for AC-144 in Rev 18.

### Block Filter for Beta-Video List — Implementation Notes (Rev 20)

#### AC-154 — `fetchBlockedUserIds()` from MOD-009

`fetchBlockedUserIds(currentUserId)` is called **once per route detail load** and the resulting set of user IDs is used to filter the video array client-side before rendering. The filter excludes any video whose `user_id` is in the blocked set (block in either direction — the function returns IDs blocked by the viewer AND IDs that have blocked the viewer). This is a **direct import** from `mod-moderation/moderation-service` per the Cross-Module Imports convention — MOD-005 imports the public service function directly; it does not reach into MOD-009's internal screens or components.

The filter is applied **after** `fetchBetaVideosForRoute` returns its result and **after** the reported-video exclusion (AC-142), before passing the array to the grid renderer. No new migration is required — `fetchBlockedUserIds` reads the existing `Block` table owned by MOD-009.

---

## Out of Scope for This Module

- Comments on beta videos (out of scope for Phase 1).
- Android video pipeline (Phase 2).
- AWS S3 + CloudFront + MediaConvert video migration execution (Phase 2 — evaluation triggered at 800 MB storage watch threshold, AC-170; runbook drafting recommended before Phase 1 GA).
- Server-side transcoding pipeline (no custom backend in Phase 1).
- Like reactions on beta videos (owned by MOD-006).
- Push notifications for likes (owned by MOD-007).
- Client-side frame extraction for thumbnail generation (Phase 2; see Phase 1 simplification note above).
- User-profile reports (owned by MOD-009 — the `Report` table, category + note flow, AC-080).
- Admin push or email notification for beta-video reports (out of scope for Phase 1 — admin reviews `video_reports` table manually in Supabase Studio; the AC-085 6-hourly email digest covers the `Report` table only and does not include `video_reports`).
- `users.beta_video_privacy` column write (owned by MOD-001 — MOD-005 reads this value via the existing poster join for AC-158; it does not write the column).
