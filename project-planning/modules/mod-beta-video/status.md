# Beta Video (MOD-005) Status

## Engineering Progress

**Status**: Implementation complete — 2026-09-24

**Engineer**: engineer-mod-beta-video

### ACs Implemented

- **AC-030**: Video duration checked client-side in `BetaVideoUploader` before upload begins; videos longer than 60 seconds are rejected with a clear error and upload is never started.
- **AC-031**: `expo-image-picker` with `videoMaxDuration: 60` is used for video selection (Phase 1 iOS implementation). Format validation rejects non-MP4/MOV files. Codec conformance note: Phase 1 relies on device-native compression; `ffmpeg-kit-react-native` upgrade path documented in `BetaVideoUploader.tsx` for Phase 2.
- **AC-032**: Every `BetaVideo` row is inserted with a `route_id` FK. `BetaVideoSection` receives `routeId` prop and passes it down to `BetaVideoUploader`; the upload call always includes `route_id`.
- **AC-033**: `BetaVideoPlayer` renders inline video via expo-av `Video` component. Pressing the thumbnail play button switches to the native player — no external links.
- **AC-035**: `BetaVideoUploader.validateVideoFormat()` checks `mimeType` and URI extension before upload; HEVC and other non-MP4/MOV formats are rejected with a user-facing error. No file is stored on rejection.
- **AC-036**: `BetaVideoUploader` renders a full-screen `Modal` progress overlay (0–100%) during upload, blocking interaction until upload completes or fails.
- **AC-037**: `BetaVideoSection` is the public entry-point component mounted on `RouteDetailScreen`. It renders the "Add Beta Video" button (always visible on the route detail screen) that launches the picker/upload flow with `route_id` pre-attached.

### Files Created

- `supabase/migrations/20260924000005_mod_005_beta_video.sql` — beta_videos table, RLS, grants
- `src/modules/mod-beta-video/types.ts` — BetaVideo, BetaVideoUploadInput, UploadProgress
- `src/modules/mod-beta-video/beta-video-service.ts` — fetch, upload, sign URLs
- `src/modules/mod-beta-video/components/BetaVideoPlayer.tsx` — inline player (expo-av)
- `src/modules/mod-beta-video/components/BetaVideoUploader.tsx` — selection + upload + progress overlay
- `src/modules/mod-beta-video/components/BetaVideoSection.tsx` — public entry point for RouteDetailScreen
- `src/modules/mod-beta-video/test-utils.tsx` — test providers
- `src/modules/mod-beta-video/__tests__/beta-video-service.test.ts`
- `src/modules/mod-beta-video/__tests__/BetaVideoPlayer.test.tsx`
- `src/modules/mod-beta-video/__tests__/BetaVideoSection.test.tsx`
- `src/modules/mod-beta-video/__tests__/BetaVideoUploader.test.tsx`
- `__mocks__/expo-av.js` — Jest mock for expo-av Video + ResizeMode

### Files Modified

- `src/modules/mod-route-catalog/screens/RouteDetailScreen.tsx` — replaced beta video placeholder with `BetaVideoSection` (AC-037 integration point)
- `src/modules/mod-route-catalog/__tests__/RouteDetailScreen.test.tsx` — added BetaVideoSection mock to isolate MOD-003 tests from MOD-005
- `locales/en/common.json` — added `betaVideo` i18n keys (complete)
- `locales/zh-TW/common.json` — added `betaVideo` i18n keys (complete, zh-TW)
- `package.json` — added `expo-av ~15.0.2` dependency; added `expo-av` jest moduleNameMapper

### Library Choice Confirmation

Video playback: `expo-av` (15.x, installed). Phase 1 video selection: `expo-image-picker` (already present). Compression library: `expo-image-picker` with `videoMaxDuration: 60` for Phase 1 (device-native compression). Upgrade path to `ffmpeg-kit-react-native` documented in `BetaVideoUploader.tsx` for Phase 2 guaranteed H.264 output.

### Test Results

`npx tsc --noEmit`: pass (0 errors)
`npm test -- --watchAll=false`: 225 tests pass, 21 suites pass, 0 failures

## QA Results

<!-- Filled by qa-mod-beta-video agent -->
