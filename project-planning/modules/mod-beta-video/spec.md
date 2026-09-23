# MOD-005: Beta Video — Spec

**Module ID**: MOD-005
**Module Name**: Beta Video
**Phase**: 1
**Dependencies**: MOD-001, MOD-003
**Last Synced from PRD Revision**: 5

---

## Purpose

Handle video capture/selection, client-side compression (≤60 sec cap), client-generated thumbnail, upload to storage, and inline playback on route detail pages and the activity feed.

---

## Context

Sharing technique clips ("beta") tied to specific routes is one of Send It's core differentiators. A climber who figures out a tricky sequence can record a short clip, attach it to the relevant route, and publish it for others projecting that route to study. Videos are capped at 60 seconds and compressed client-side before upload — there is no server-side transcoding pipeline in Phase 1. Supabase Storage serves the file as-uploaded; playability depends entirely on iOS AVPlayer accepting the container/codec. To guarantee cross-device playback, all client-side compression output must be standardized to H.264 (baseline profile) + AAC audio in an MP4 container. Any upload that does not conform must be rejected on ingest with a clear error. The thumbnail is also generated on the client and uploaded alongside the video. In Phase 1, video is stored in Supabase Storage. The migration trigger to Cloudflare Stream fires when monthly cost exceeds US$25 OR total video storage exceeds 20 GB, whichever comes first. Beta videos are attached to exactly one Route and are playable inline both on the route detail page and in the activity feed.

**Non-goals for this module:**
- Comments on beta videos (out of scope for Phase 1).
- Android video pipeline (Phase 2).
- Cloudflare Stream migration (triggered by cost/storage threshold — expected Phase 2; runbook to be drafted before Phase 1 GA).
- Server-side transcoding (no custom backend server in Phase 1).

---

## User Stories Covered

- **US-004**: Upload a beta video for a route
- **US-005**: Watch beta inline on a route

---

## Acceptance Criteria Covered

**AC-030**: The system shall reject beta video uploads longer than 60 seconds before upload begins.

**AC-031**: The system shall run client-side video compression before upload and generate a thumbnail on the client, uploading both artifacts to storage. The compression output must be standardised to H.264 baseline profile video + AAC audio in an MP4 container.

**AC-032**: The system shall attach a beta video to exactly one `Route` and make it playable inline within 60 seconds of upload completion on a normal 4G/LTE connection.

**AC-033**: The system shall play beta videos inline on the route detail page without requiring the user to leave the app or open an external link.

**AC-034**: The system shall play beta videos inline in the activity feed for videos posted by followed users.

**AC-035**: The system shall reject, on ingest, any beta video upload whose muxed output is not H.264 (baseline profile) video + AAC audio in an MP4 container, and shall surface a clear error to the user rather than storing an unplayable file.

**AC-036**: While a beta video is uploading, a progress overlay is displayed showing upload progress (0–100%). The overlay blocks further interaction until the upload completes or fails, preventing double-submission.

**AC-037** (new — code gap, future module): The system shall present an "Add beta video" entry point on the route detail screen that launches the beta video capture/selection flow with the route context (route ID) pre-attached, so the resulting upload is bound to that route (AC-032). The entry point must be visible without leaving the route detail screen.

> **Boundary note on AC-037**: The entry point renders in MOD-003's `RouteDetailScreen.tsx` as a hosting slot; the capture/upload flow itself is owned by MOD-005. MOD-005's engineer owns this AC: `RouteDetailScreen` exposes a slot/prop (`onAddBetaVideo` or a MOD-005-provided component); MOD-005 fills it with the route-context-aware upload launcher.

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
- Client-side: video compressed to H.264/baseline + AAC in MP4; thumbnail generated; both validated for codec conformance before upload
- Video artifact and thumbnail uploaded to Supabase Storage
- `BetaVideo` row inserted in Postgres with `video_url`, `thumbnail_url`, `duration_seconds`, `caption`, `route_id`, `user_id`
- On ingest validation failure: clear error message displayed to user; no file stored

**Inputs (playback):**
- `BetaVideo.video_url` and `BetaVideo.thumbnail_url` from Postgres
- Render context: route detail page (AC-033) or activity feed (AC-034)

**Outputs (playback):**
- Inline video playback within the app — no external link or browser required

---

## Key Implementation Notes

- **60-second cap**: Check video duration client-side before compression begins. Reject (with clear error) any video longer than 60 seconds (AC-030). Do not begin compression or upload for over-limit videos.
- **Codec standardization (H.264/AAC/MP4)**: All client-side compression output must be H.264 (baseline profile) + AAC audio in an MP4 container (AC-031, AC-035). This is required because Supabase Storage serves the file as-uploaded with no server-side transcoding; playability on iOS AVPlayer depends entirely on the container/codec.
- **Recommended compression library**: `ffmpeg-kit-react-native` is the recommended library because it guarantees H.264 output. Alternative (`expo-image-picker` with `videoQuality: 'medium'`) is device-dependent and may produce HEVC or other codecs on some iPhones, risking unplayable files. The final library choice must be confirmed during MOD-005 engineering and documented in this spec before coding begins.
- **Ingest validation (AC-035)**: Before inserting the `BetaVideo` row, validate that the muxed output is H.264/AAC/MP4. If validation fails, surface a clear error and do not store the file.
- **Thumbnail**: Generated client-side (e.g., a frame extracted at 1 second) before upload. Uploaded to Supabase Storage alongside the video. URL stored in `BetaVideo.thumbnail_url`.
- **Storage upload pattern**: Upload video and thumbnail to Supabase Storage using the Supabase client singleton from `src/lib/supabase.ts`. Never call `createClient()` at call sites. Storage bucket RLS must be aligned with `BetaVideo` table RLS (a user cannot fetch a private ascent's associated media).
- **Inline playback**: Beta videos must play inline in both the route detail page (MOD-003 context) and the activity feed (MOD-006 context). No external links. No external browser.
- **60-second playability SLA (AC-032)**: The video must be playable inline within 60 seconds of upload completion on a normal 4G/LTE connection. Since there is no server transcoding, this depends on Storage CDN delivery latency — the compression + upload pipeline must keep total time within the SLA.
- **Phase 1 Storage**: All video stored in Supabase Storage. Migration to Cloudflare Stream is triggered by monthly cost > US$25 OR total storage > 20 GB. At ~10 MB per compressed 60-sec clip, 20 GB ≈ 2,000 videos. A migration runbook should be drafted before Phase 1 GA (even though migration itself is expected in Phase 2).
- **Attachment constraint**: Each `BetaVideo` row has exactly one `route_id`. A video cannot be attached to multiple routes.

---

## Out of Scope for This Module

- Comments on beta videos (out of scope for Phase 1).
- Android video pipeline (Phase 2).
- Cloudflare Stream video hosting and migration runbook execution (Phase 2; runbook drafting is recommended before Phase 1 GA).
- Server-side transcoding pipeline (no custom backend in Phase 1).
- Like reactions on beta videos (owned by MOD-006).
- Push notifications for likes (owned by MOD-007).
