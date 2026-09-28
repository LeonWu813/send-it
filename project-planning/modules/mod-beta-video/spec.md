# MOD-005: Beta Video — Spec

**Module ID**: MOD-005
**Module Name**: Beta Video
**Phase**: 1
**Dependencies**: MOD-001, MOD-003
**Last Synced from PRD Revision**: 13
**Last Updated**: 2026-09-28

---

## Purpose

Handle video capture/selection, client-side compression (≤60 sec cap), client-generated thumbnail, upload to storage, and inline playback on route detail pages and the activity feed.

---

## Context

Sharing technique clips ("beta") tied to specific routes is one of Send It's core differentiators. A climber who figures out a tricky sequence can record a short clip, attach it to the relevant route, and publish it for others projecting that route to study. Videos are capped at 60 seconds and compressed client-side before upload — there is no server-side transcoding pipeline in Phase 1. Supabase Storage serves the file as-uploaded; playability depends entirely on iOS AVPlayer accepting the container/codec. To guarantee cross-device playback, all client-side compression output must be standardized to H.264 or HEVC video + AAC audio in an MP4 (`.mp4`) or QuickTime (`.mov`) container. Any upload whose video codec is not H.264 or HEVC, or whose audio codec is not AAC, must be rejected on ingest with a clear error — rejection is codec-based, not container-based. Both containers are stored as-is with no server-side transcoding, so iPhone-camera `.mov` footage uploads without conversion. The thumbnail is also generated on the client and uploaded alongside the video. In Phase 1, video is stored in Supabase Storage. The migration trigger to Cloudflare Stream fires when monthly cost exceeds US$25 OR total video storage exceeds 20 GB, whichever comes first. Beta videos are attached to exactly one Route and are playable inline both on the route detail page and in the activity feed.

**Non-goals for this module:**
- Comments on beta videos (out of scope for Phase 1).
- Android video pipeline (Phase 2).
- Cloudflare Stream migration (triggered by cost/storage threshold — expected Phase 2; runbook to be drafted before Phase 1 GA).
- Server-side transcoding (no custom backend server in Phase 1).

---

## Related User Stories

- **US-004**: Upload a beta video for a route
- **US-005**: Watch beta inline on a route

**US-004 Acceptance Criteria**: AC-030, AC-031, AC-032, AC-037

**US-005 Acceptance Criteria**: AC-033, AC-034, AC-038, AC-039

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

**AC-039** (new): Tapping a beta-video thumbnail on the route detail screen shall open a fullscreen, portrait-orientation video viewer that auto-plays the tapped video. Within the viewer, swiping up shall advance to the next beta video for that route when one exists; swiping down or tapping a back control shall dismiss the viewer and return to the route detail screen. The viewer navigates only within the set of beta videos for the current route.

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

---

## Data Model (relevant tables)

```
BetaVideo
 - id, route_id (FK Route), user_id (FK User),
   video_url, thumbnail_url, duration_seconds, caption, created_at
```

All tables guarded by Supabase Row-Level Security policies. `BetaVideo` rows are insertable by the uploading user. Readable by all authenticated users (subject to uploader's `privacy_setting` from MOD-001 — if uploader is `followers_only`, non-followers cannot access the video listing). Video and thumbnail files are stored in Supabase Storage with RLS policies aligned with the corresponding table policies.

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
- `BetaVideo` row inserted in Postgres with `video_url`, `thumbnail_url`, `duration_seconds`, `caption`, `route_id`, `user_id`
- On ingest validation failure: clear error message displayed to user; no file stored

**Inputs (playback):**
- `BetaVideo.video_url` and `BetaVideo.thumbnail_url` from Postgres
- Render context: route detail page (AC-033/AC-038/AC-039) or activity feed (AC-034)

**Outputs (playback):**
- Route detail page: three-column thumbnail grid (AC-038); tapping a cell opens the fullscreen reel viewer (AC-039)
- Activity feed: inline video playback within the app — no external link or browser required (AC-034)

---

## Key Implementation Notes

- **60-second cap**: Check video duration client-side before compression begins. Reject (with clear error) any video longer than 60 seconds (AC-030). Do not begin compression or upload for over-limit videos.
- **Codec standardization (H.264/HEVC + AAC in MP4 or MOV)**: All client-side compression output must use H.264 or HEVC video + AAC audio in an MP4 (`.mp4`) or QuickTime (`.mov`) container (AC-031, AC-035). This is required because Supabase Storage serves the file as-uploaded with no server-side transcoding; playability on iOS AVPlayer depends entirely on the container/codec.
- **Recommended compression library**: `ffmpeg-kit-react-native` is the recommended library because it guarantees H.264 output. Alternative (`expo-image-picker` with `videoQuality: 'medium'`) is device-dependent and may produce HEVC or other codecs on some iPhones, risking unplayable files. The final library choice must be confirmed during MOD-005 engineering and documented in this spec before coding begins.
- **Ingest validation (AC-035)**: Before inserting the `BetaVideo` row, validate that the muxed output uses H.264 or HEVC video + AAC audio. Rejection is codec-based, not container-based — both `.mp4` and `.mov` are accepted containers; an upload is rejected only when the video codec is not H.264/HEVC or the audio codec is not AAC. If validation fails, surface a clear error and do not store the file.
- **Thumbnail (Phase 1 simplification)**: In Phase 1, the thumbnail may use the video URI as a placeholder; `BetaVideo.thumbnail_url` must still be a valid, retrievable URL. Client-side frame extraction (e.g. a frame at 1 second using `expo-video-thumbnails`) is deferred to Phase 2. Uploaded to Supabase Storage alongside the video. URL stored in `BetaVideo.thumbnail_url`.
- **Phase 1 simplification — client-side frame extraction deferred**: True frame extraction (extracting a still frame from the video at a given timestamp) is a Phase 2 feature. Phase 1 may populate `thumbnail_url` with the video URI as a placeholder, provided it is a valid, retrievable URL (AC-031 Phase 1 clause). Adding a native frame-extraction dependency (e.g. `expo-video-thumbnails`, `ffmpeg-kit-react-native`) is a scope/dependency decision deferred to Phase 2.
- **Storage upload pattern**: Upload video and thumbnail to Supabase Storage using the Supabase client singleton from `src/lib/supabase.ts`. Never call `createClient()` at call sites. Storage bucket RLS must be aligned with `BetaVideo` table RLS (a user cannot fetch a private ascent's associated media).
- **Inline playback**: Beta videos must play inline in both the route detail page (MOD-003 context) and the activity feed (MOD-006 context). No external links. No external browser.
- **60-second playability SLA (AC-032)**: The video must be playable inline within 60 seconds of upload completion on a normal 4G/LTE connection. Since there is no server transcoding, this depends on Storage CDN delivery latency — the compression + upload pipeline must keep total time within the SLA.
- **Phase 1 Storage**: All video stored in Supabase Storage. Migration to Cloudflare Stream is triggered by monthly cost > US$25 OR total storage > 20 GB. At ~10 MB per compressed 60-sec clip, 20 GB ≈ 2,000 videos. A migration runbook should be drafted before Phase 1 GA (even though migration itself is expected in Phase 2).
- **Attachment constraint**: Each `BetaVideo` row has exactly one `route_id`. A video cannot be attached to multiple routes.

### Grid and Fullscreen Reel Viewer (AC-038 / AC-039) — Tech Lead Decisions (Rev 13)

The following six decisions were recorded by Tech Lead in the 2026-09-28 review and are pinned here so the engineer does not need to consult `status.md`.

1. **Portrait lock — no new dependency.** `app.json` already sets `"orientation": "portrait"` globally — the entire app is portrait-locked at the native manifest level. AC-039's "portrait-orientation viewer" is satisfied for free. Do NOT add `expo-screen-orientation`. The viewer must not attempt to programmatically lock/unlock orientation; it inherits portrait from the app config.

2. **Modal architecture — `BetaVideoReelViewer.tsx` is an RN `<Modal>`.** The fullscreen viewer is a new MOD-005 component `BetaVideoReelViewer.tsx` rendered as a React Native `<Modal>` (`animationType="fade"` or `"slide"`, `presentationStyle="overFullScreen"`, `statusBarTranslucent`), mounted from within `BetaVideoSection` (or the new grid component). It is NOT a new navigator screen and NOT a global AppShell overlay. Precedent: `BetaVideoUploader.tsx` already uses RN `<Modal>` — the pattern is proven in MOD-005. The currently-open video index is a `useState<number | null>` in the grid/section component (`null` = closed, `N` = viewer open at index N); `<Modal visible={openIndex !== null}>`.

3. **Playlist order — reuse `fetchBetaVideosForRoute`; tap index maps 1:1 to viewer start index; no wrap.** `fetchBetaVideosForRoute(routeId)` already returns the full set ordered `created_at DESC` (newest-first). The viewer reuses this exact in-memory array — no new fetch, no new query. Grid renders newest-first (the array as fetched); the viewer swipes in that same array order — tapping grid cell *i* opens the viewer at index *i*, swipe-up → *i+1*. Grid order == viewer swipe order == `fetchBetaVideosForRoute` order (`created_at DESC`). Swipe-up at the last index is a no-op (AC-039: "next video ... when one exists"); do not wrap. Swipe-down at any index dismisses.

4. **`expo-video` fullscreen — do NOT use `enterFullscreen()`.** Do not call `VideoView.enterFullscreen()`. Native OS fullscreen forces native controls and its own dismiss chrome and cannot host the custom swipe-up-to-next-video gesture AC-039 requires. Achieve the fullscreen effect by sizing a plain `VideoView` to fill the modal: inside `BetaVideoReelViewer`'s `<Modal>`, a full-screen `View` (`flex: 1`, dark/black background, safe area insets) containing a `VideoView` sized `{ width: '100%', height: '100%' }` with `contentFit="contain"`. Auto-play (AC-039): create the player with `useVideoPlayer` and call `player.play()` on mount / on index change (`loop = false`). Recommend one `useVideoPlayer` whose source is replaced (`player.replace()` or remount) when `openIndex` changes — one active player at a time avoids N simultaneous decoders.

5. **Swipe gesture — RN built-in `PanResponder`; do NOT add `react-native-gesture-handler`.** `react-native-gesture-handler` is not installed and adding it requires a native dependency install + rebuild + a root `GestureHandlerRootView` wrap. Use RN core `PanResponder` (vertical-only): `onMoveShouldSetPanResponder` returns true when `|dy| > |dx|` and `|dy|` exceeds a threshold; on release, `dy < -SWIPE_THRESHOLD` → advance to next (if exists); `dy > +SWIPE_THRESHOLD` → dismiss. Also provide an explicit back/close button (e.g. `Ionicons` "chevron-down"/"close" pinned top-left within `insets.top`) as the accessible fallback — do not ship swipe as the only dismiss path. `<Modal onRequestClose>` should also route to dismiss (Android back; harmless on iOS-only Phase 1). If `nativeControls` is on in the viewer, keep the `PanResponder` on a region outside the control bar's hit area to avoid gesture conflicts; or disable `nativeControls` in the viewer and rely on auto-play + swipe + back button. Document the chosen approach.

6. **Thumbnails — Phase 1 placeholder; do NOT mount `VideoView` per grid cell; do NOT add a frame-extraction library.** `thumbnail_url` is a video storage path, not an image (confirmed by PM Rev 10 ruling / AC-031 Phase 1 simplification). Each AC-038 grid cell renders the mandatory camera-icon overlay (top-left, AC-038) over a neutral themed placeholder fill (e.g. `styles.thumbnailPlaceholder`, `theme.colors.textDisabled`), attempting `<Image>` but expecting it to fall back. Do NOT mount a `VideoView` per grid cell — N live decoders on one screen risks the ≤3s cold-start / smooth-scroll NFR and battery. Do NOT add a frame-extraction library (`expo-video-thumbnails`, `ffmpeg-kit-react-native`) for this change — that reopens the settled Phase 2 scope decision (AC-031 Phase 1 clause). The camera-icon overlay is the "this is a video" affordance; the placeholder-thumbnail limitation is cosmetically absorbed by the AC-038 design.

---

## Out of Scope for This Module

- Comments on beta videos (out of scope for Phase 1).
- Android video pipeline (Phase 2).
- Cloudflare Stream video hosting and migration runbook execution (Phase 2; runbook drafting is recommended before Phase 1 GA).
- Server-side transcoding pipeline (no custom backend in Phase 1).
- Like reactions on beta videos (owned by MOD-006).
- Push notifications for likes (owned by MOD-007).
- Client-side frame extraction for thumbnail generation (Phase 2; see Phase 1 simplification note above).
