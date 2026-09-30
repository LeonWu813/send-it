# MOD-005: Beta Video — Spec

**Module ID**: MOD-005
**Module Name**: Beta Video
**Phase**: 1
**Dependencies**: MOD-001, MOD-003
**Last Synced from PRD Revision**: 18
**Last Updated**: 2026-09-30

---

## Purpose

Handle video capture/selection, client-side compression (≤60 sec cap), client-generated thumbnail, upload to storage, inline playback on route detail pages and the activity feed, the fullscreen portrait reel viewer (thumbnail grid → swipe-navigable viewer with a persistent back control, poster-identity overlay, and a two-icon action sidebar), and the one-tap beta-video report flow (report icon → `is_reported` flag via SECURITY DEFINER RPC + `VideoReport` insert, with reported videos hidden until an admin dismisses the report).

---

## Context

Sharing technique clips ("beta") tied to specific routes is one of Send It's core differentiators. A climber who figures out a tricky sequence can record a short clip, attach it to the relevant route, and publish it for others projecting that route to study. Videos are capped at 60 seconds and compressed client-side before upload — there is no server-side transcoding pipeline in Phase 1. Supabase Storage serves the file as-uploaded; playability depends entirely on iOS AVPlayer accepting the container/codec. To guarantee cross-device playback, all client-side compression output must be standardized to H.264 or HEVC video + AAC audio in an MP4 (`.mp4`) or QuickTime (`.mov`) container. Any upload whose video codec is not H.264 or HEVC, or whose audio codec is not AAC, must be rejected on ingest with a clear error — rejection is codec-based, not container-based. Both containers are stored as-is with no server-side transcoding, so iPhone-camera `.mov` footage uploads without conversion. The thumbnail is also generated on the client and uploaded alongside the video. In Phase 1, video is stored in Supabase Storage. The migration trigger to Cloudflare Stream fires when monthly cost exceeds US$25 OR total video storage exceeds 20 GB, whichever comes first. Beta videos are attached to exactly one Route and are playable inline both on the route detail page and in the activity feed.

For US-005, the route detail page presents beta videos as a three-column thumbnail grid; tapping a thumbnail opens a fullscreen, portrait-orientation reel viewer. The viewer has a persistent top-left back control, a bottom-left overlay with poster identity and route+gym info, and a two-icon right sidebar (like + report).

For US-015, the one-tap beta-video report flow is owned by this module: tapping the report icon in the viewer sidebar immediately sets `beta_videos.is_reported = true` via a SECURITY DEFINER RPC and inserts one `video_reports` row. A reported-and-not-dismissed video (`is_reported = true AND report_dismissed = false`) is hidden from every user everywhere it is surfaced until an admin sets `report_dismissed = true` via Supabase Studio.

For US-023, tapping Row 1 (the circular avatar or the `display_name` text) in the bottom-left overlay of the fullscreen viewer dismisses the viewer and navigates the user to that video poster's profile (the MOD-008 other-user profile-and-history surface, AC-064), subject to the poster's privacy setting (AC-063). Navigation is threaded from the viewer to the profile surface via a callback prop supplied by the hosting shell, not by MOD-005 importing the profile screen directly.

**Non-goals for this module:**
- Comments on beta videos (out of scope for Phase 1).
- Android video pipeline (Phase 2).
- Cloudflare Stream migration (triggered by cost/storage threshold — expected Phase 2; runbook to be drafted before Phase 1 GA).
- Server-side transcoding (no custom backend server in Phase 1).
- Admin push or email notification for beta-video reports in Phase 1 — admin reviews the `video_reports` table manually in Supabase Studio only. Video reports are explicitly excluded from the AC-085 6-hourly email digest (which remains `Report`-table only).

---

## Related User Stories

- **US-004**: Upload a beta video for a route
- **US-005**: Watch beta inline on a route
- **US-015**: Report inappropriate content (beta-video report flow only — the one-tap AC-139/AC-140 flow; user-profile reports are owned by MOD-009)
- **US-023**: Open a beta video poster's profile

**US-004 Acceptance Criteria**: AC-030, AC-031, AC-032, AC-037, AC-130

**US-005 Acceptance Criteria**: AC-033, AC-034, AC-038, AC-039, AC-133, AC-134, AC-135, AC-136, AC-137, AC-138

**US-015 Acceptance Criteria (beta-video only)**: AC-139, AC-140, AC-141, AC-142, AC-143

**US-023 Acceptance Criteria**: AC-135, AC-144

---

## Acceptance Criteria Covered

**AC-030**: The system shall reject beta video uploads longer than 60 seconds before upload begins.

**AC-031**: The system shall run client-side video compression before upload and generate a thumbnail on the client, uploading both artifacts to storage. The compression output must use H.264 or HEVC video + AAC audio in an MP4 (`.mp4`) or QuickTime (`.mov`) container (see AC-035 for the accepted container/codec set). **Phase 1 simplification**: the thumbnail may use the selected video's URI as a placeholder rather than an extracted still frame; true client-side frame extraction (e.g. a frame at 1 second) is deferred to Phase 2 (requires a frame-extraction library such as `expo-video-thumbnails`). `BetaVideo.thumbnail_url` must still be populated with a valid, retrievable URL in Phase 1.

**AC-032**: The system shall attach a beta video to exactly one `Route` and make it playable inline within 60 seconds of upload completion on a normal 4G/LTE connection.

**AC-033** (revised): The system shall display a route's beta videos on the route detail page and shall play a selected beta video without requiring the user to leave the app or open an external link. Videos are presented as a grid of thumbnails (AC-038) and played in an in-app fullscreen viewer launched on thumbnail tap (AC-039); no external link or browser is used.

**AC-034**: The system shall play beta videos inline in the activity feed for videos posted by followed users.

**AC-035** (revised): The system shall accept beta video uploads in either an MP4 (`.mp4`) or QuickTime (`.mov`) container — `.mov` is included so users can upload iPhone-camera footage without converting it first — and shall reject, on ingest, any upload whose video codec is not H.264 or HEVC or whose audio codec is not AAC, surfacing a clear error to the user rather than storing an unplayable file. Both containers are stored as-is (no server-side transcoding); the ≤60-second duration cap (AC-030) and size constraints apply regardless of container.

**AC-036**: While a beta video is uploading, a progress overlay is displayed showing upload progress (0–100%). The overlay blocks further interaction until the upload completes or fails, preventing double-submission.

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

---

## Data Model (relevant tables)

```
BetaVideo
 - id, route_id (FK Route), user_id (FK public.users(id) — repointed from auth.users(id)),
   video_url, thumbnail_url, duration_seconds, caption, created_at,
   is_reported (boolean NOT NULL DEFAULT false),
   report_dismissed (boolean NOT NULL DEFAULT false)
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

All tables guarded by Supabase Row-Level Security policies. `BetaVideo` rows are insertable by the uploading user. Readable by all authenticated users (subject to uploader's `privacy_setting` from MOD-001 — if uploader is `followers_only`, non-followers cannot access the video listing). A beta video with `is_reported = true AND report_dismissed = false` is hidden from every user (AC-141/AC-142). Video and thumbnail files are stored in Supabase Storage with RLS policies aligned with the corresponding table policies.

---

## Input / Output Contract

**Inputs (upload):**
- Video file selected from camera roll or captured in-app (duration checked client-side before compression begins)
- `route_id` (FK from MOD-003, required — one beta video attached to exactly one route)
- `caption` (optional text)
- Authenticated user session (MOD-001)

**Outputs (upload):**
- Client-side: video compressed to H.264/HEVC + AAC in `.mp4` or `.mov`; thumbnail generated; both validated for codec conformance before upload
- Video artifact and thumbnail uploaded to Supabase Storage
- `BetaVideo` row inserted in Postgres with `video_url`, `thumbnail_url`, `duration_seconds`, `caption`, `route_id`, `user_id`, `is_reported = false`, `report_dismissed = false`
- On ingest validation failure: clear error message displayed to user; no file stored

**Inputs (playback):**
- `BetaVideo` rows from `fetchBetaVideosForRoute` — including `is_reported`, `report_dismissed`, `user_id`, `display_name`, `avatar_url` (joined from `public.users` via `users!beta_videos_user_id_fkey`)
- Render context: route detail page (AC-033/AC-038/AC-039) or activity feed (AC-034)

**Outputs (playback):**
- Route detail page: three-column thumbnail grid (AC-038); tapping a cell opens the fullscreen reel viewer (AC-039) with persistent back control (AC-133), poster-identity overlay (AC-134), and two-icon sidebar (AC-138)
- Activity feed: inline video playback within the app — no external link or browser required (AC-034)

**Inputs (report):**
- `beta_video_id`, authenticated user session
- Reporter must not be the video owner (AC-139)

**Outputs (report):**
- `report_beta_video(p_beta_video_id uuid)` SECURITY DEFINER RPC sets `beta_videos.is_reported = true` and inserts one `video_reports` row (idempotent via `ON CONFLICT DO NOTHING`)
- Reported video is hidden from all users on next fetch (AC-141)

---

## Key Implementation Notes

- **60-second cap**: Check video duration client-side before compression begins. Reject (with clear error) any video longer than 60 seconds (AC-030). Do not begin compression or upload for over-limit videos.
- **Codec standardization (H.264/HEVC + AAC in MP4 or MOV)**: All client-side compression output must use H.264 or HEVC video + AAC audio in an MP4 (`.mp4`) or QuickTime (`.mov`) container (AC-031, AC-035). This is required because Supabase Storage serves the file as-uploaded with no server-side transcoding; playability on iOS AVPlayer depends entirely on the container/codec.
- **Recommended compression library**: `ffmpeg-kit-react-native` is the recommended library because it guarantees H.264 output. Alternative (`expo-image-picker` with `videoQuality: 'medium'`) is device-dependent and may produce HEVC or other codecs on some iPhones, risking unplayable files. The final library choice must be confirmed during MOD-005 engineering and documented in this spec before coding begins.
- **Ingest validation (AC-035)**: Before inserting the `BetaVideo` row, validate that the muxed output uses H.264 or HEVC video + AAC audio. Rejection is codec-based, not container-based — both `.mp4` and `.mov` are accepted containers; an upload is rejected only when the video codec is not H.264/HEVC or the audio codec is not AAC. If validation fails, surface a clear error and do not store the file.
- **Thumbnail (Phase 1 simplification)**: In Phase 1, the thumbnail may use the video URI as a placeholder; `BetaVideo.thumbnail_url` must still be a valid, retrievable URL. Client-side frame extraction (e.g. a frame at 1 second using `expo-video-thumbnails`) is deferred to Phase 2. Uploaded to Supabase Storage alongside the video. URL stored in `BetaVideo.thumbnail_url`.
- **Phase 1 simplification — client-side frame extraction deferred**: True frame extraction (extracting a still frame from the video at a given timestamp) is a Phase 2 feature. Phase 1 may populate `thumbnail_url` with the video URI as a placeholder, provided it is a valid, retrievable URL (AC-031 Phase 1 clause). Adding a native frame-extraction dependency (e.g. `expo-video-thumbnails`, `ffmpeg-kit-react-native`) is a scope/dependency decision deferred to Phase 2.
- **Storage upload pattern**: Upload video and thumbnail to Supabase Storage using the Supabase client singleton from `src/lib/supabase.ts`. Never call `createClient()` at call sites. Never import the `service_role` key in client code. The service-role key lives in `supabase secrets` as `SERVICE_ROLE_KEY` and is only read inside Edge Functions.
- **Inline playback**: Beta videos must play inline in both the route detail page (MOD-003 context) and the activity feed (MOD-006 context). No external links. No external browser.
- **60-second playability SLA (AC-032)**: The video must be playable inline within 60 seconds of upload completion on a normal 4G/LTE connection. Since there is no server transcoding, this depends on Storage CDN delivery latency — the compression + upload pipeline must keep total time within the SLA.
- **Phase 1 Storage**: All video stored in Supabase Storage. Migration to Cloudflare Stream is triggered by monthly cost > US$25 OR total storage > 20 GB. At ~10 MB per compressed 60-sec clip, 20 GB ≈ 2,000 videos. A migration runbook should be drafted before Phase 1 GA (even though migration itself is expected in Phase 2).
- **Attachment constraint**: Each `BetaVideo` row has exactly one `route_id`. A video cannot be attached to multiple routes.

### Grid and Fullscreen Reel Viewer (AC-038 / AC-039) — Tech Lead Decisions (Rev 13)

The following six decisions were recorded by Tech Lead in the 2026-09-28 review and are pinned here so the engineer does not need to consult `status.md`.

1. **Portrait lock — no new dependency.** `app.json` already sets `"orientation": "portrait"` globally — the entire app is portrait-locked at the native manifest level. AC-039's "portrait-orientation viewer" is satisfied for free. Do NOT add `expo-screen-orientation`. The viewer must not attempt to programmatically lock/unlock orientation; it inherits portrait from the app config.

2. **Modal architecture — `BetaVideoReelViewer.tsx` is an RN `<Modal>`.** The fullscreen viewer is a new MOD-005 component `BetaVideoReelViewer.tsx` rendered as a React Native `<Modal>` (`animationType="fade"` or `"slide"`, `presentationStyle="overFullScreen"`, `statusBarTranslucent`), mounted from within `BetaVideoSection` (or the new grid component). It is NOT a new navigator screen and NOT a global AppShell overlay. Precedent: `BetaVideoUploader.tsx` already uses RN `<Modal>` — the pattern is proven in MOD-005. The currently-open video index is a `useState<number | null>` in the grid/section component (`null` = closed, `N` = viewer open at index N); `<Modal visible={openIndex !== null}>`.

3. **Playlist order — reuse `fetchBetaVideosForRoute`; tap index maps 1:1 to viewer start index; no wrap.** `fetchBetaVideosForRoute(routeId)` already returns the full set ordered `created_at DESC` (newest-first). The viewer reuses this exact in-memory array — no new fetch, no new query. Grid renders newest-first (the array as fetched); the viewer swipes in that same array order — tapping grid cell *i* opens the viewer at index *i*, swipe-up → *i+1*, swipe-down → *i-1* (when i > 0) or dismiss (when i === 0). Grid order == viewer swipe order == `fetchBetaVideosForRoute` order (`created_at DESC`). Swipe-up at the last index is a no-op (AC-039: "next video ... when one exists"); swipe-down at index 0 dismisses (AC-039). Do not wrap.

4. **`expo-video` fullscreen — do NOT use `enterFullscreen()`.** Do not call `VideoView.enterFullscreen()`. Native OS fullscreen forces native controls and its own dismiss chrome and cannot host the custom swipe-up-to-next-video gesture AC-039 requires. Achieve the fullscreen effect by sizing a plain `VideoView` to fill the modal: inside `BetaVideoReelViewer`'s `<Modal>`, a full-screen `View` (`flex: 1`, dark/black background, safe area insets) containing a `VideoView` sized `{ width: '100%', height: '100%' }` with `contentFit="contain"`. Auto-play (AC-039): create the player with `useVideoPlayer` and call `player.play()` on mount / on index change (`loop = false`). Recommend one `useVideoPlayer` whose source is replaced (`player.replace()` or remount) when `openIndex` changes — one active player at a time avoids N simultaneous decoders.

5. **Swipe gesture — RN built-in `PanResponder`; do NOT add `react-native-gesture-handler`.** `react-native-gesture-handler` is not installed and adding it requires a native dependency install + rebuild + a root `GestureHandlerRootView` wrap. Use RN core `PanResponder` (vertical-only): `onMoveShouldSetPanResponder` returns true when `|dy| > |dx|` and `|dy|` exceeds a threshold; on release, `dy < -SWIPE_THRESHOLD` → advance to next (if exists); `dy > +SWIPE_THRESHOLD` → go to previous (if exists) or dismiss. Also provide an explicit back/close control (`<` chevron, AC-133) pinned top-left within `insets.top` — the back control always dismisses from any position in the set (AC-039). The back control must not unmount, disappear, or lose its tap target during or after a swipe transition (AC-133). `<Modal onRequestClose>` should also route to dismiss. If `nativeControls` is on in the viewer, keep the `PanResponder` on a region outside the control bar's hit area to avoid gesture conflicts; or disable `nativeControls` in the viewer and rely on auto-play + swipe + back button. Document the chosen approach.

6. **Thumbnails — Phase 1 placeholder; do NOT mount `VideoView` per grid cell; do NOT add a frame-extraction library.** `thumbnail_url` is a video storage path, not an image (confirmed by PM Rev 10 ruling / AC-031 Phase 1 simplification). Each AC-038 grid cell renders the mandatory camera-icon overlay (top-left, AC-038) over a neutral themed placeholder fill (e.g. `styles.thumbnailPlaceholder`, `theme.colors.textDisabled`), attempting `<Image>` but expecting it to fall back. Do NOT mount a `VideoView` per grid cell — N live decoders on one screen risks the ≤3s cold-start / smooth-scroll NFR and battery. Do NOT add a frame-extraction library (`expo-video-thumbnails`, `ffmpeg-kit-react-native`) for this change — that reopens the settled Phase 2 scope decision (AC-031 Phase 1 clause). The camera-icon overlay is the "this is a video" affordance; the placeholder-thumbnail limitation is cosmetically absorbed by the AC-038 design.

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

#### AC-144 revised — `user_id` already selected

Tech Lead confirmed (Rev 18 Q4): `fetchBetaVideosForRoute` already selects `user_id` explicitly and the `BetaVideo` TypeScript type already declares `user_id: string`. The `user_id` addition in AC-144 (revised) is a no-op at the data layer — `user_id` is already returned and already typed. The only real change Rev 18 requires for AC-144 is wiring: the reel viewer must use `currentVideo.user_id` in the new `onNavigateToUser` callback (see AC-135 above). No schema change, no migration, no service-query change is needed for AC-144 in Rev 18.

---

## Out of Scope for This Module

- Comments on beta videos (out of scope for Phase 1).
- Android video pipeline (Phase 2).
- Cloudflare Stream video hosting and migration runbook execution (Phase 2; runbook drafting is recommended before Phase 1 GA).
- Server-side transcoding pipeline (no custom backend in Phase 1).
- Like reactions on beta videos (owned by MOD-006).
- Push notifications for likes (owned by MOD-007).
- Client-side frame extraction for thumbnail generation (Phase 2; see Phase 1 simplification note above).
- User-profile reports (owned by MOD-009 — the `Report` table, category + note flow, AC-080).
- Admin push or email notification for beta-video reports (out of scope for Phase 1 — admin reviews `video_reports` table manually in Supabase Studio; the AC-085 6-hourly email digest covers the `Report` table only and does not include `video_reports`).
