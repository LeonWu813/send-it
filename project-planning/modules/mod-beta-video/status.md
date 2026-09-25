# Beta Video (MOD-005) Status

## Engineering Progress

**Status**: Bug fix applied — 2026-09-25 (expo-av → expo-video migration, iOS build fix)

### Bug Fix — expo-av → expo-video (SDK 57 compatibility) — 2026-09-25

**Root cause**: `expo-av@~15.0.2` is SDK 52-era. `expo-modules-core@57.0.18` (SDK 57) removed `EXEventEmitter.h`, which `expo-av` still imports. This caused a native xcodebuild compile failure (error 65) when building on SDK 57. `expo-video ~57.0.5` is the SDK-57 successor.

**Fix**:
- `npx expo install expo-video` — installed `expo-video@~57.0.5` (SDK-compatible version).
- `npm uninstall expo-av` — removed `expo-av@~15.0.2` from dependencies.
- `src/modules/mod-beta-video/components/BetaVideoPlayer.tsx` — migrated from `expo-av` API (`Video`, `ResizeMode`) to `expo-video` API (`VideoView`, `useVideoPlayer`). Component shape and props are unchanged. `useVideoPlayer(uri, p => { p.loop = false })` creates the player; `<VideoView player={player} contentFit="contain" nativeControls />` renders inline. Buffering state managed via `player.addListener('playingChange', ...)`.
- `__mocks__/expo-av.js` — deleted.
- `__mocks__/expo-video.js` — created. Stubs `VideoView` (renders a `View`), `useVideoPlayer` (returns mock player with `play`, `pause`, `addListener`), and `createVideoPlayer`.
- `package.json` Jest `moduleNameMapper` — replaced `^expo-av$` entry with `^expo-video$` → `__mocks__/expo-video.js`.
- `src/modules/mod-beta-video/__tests__/BetaVideoPlayer.test.tsx` — updated comment from expo-av mock reference to expo-video mock reference (imports/assertions unchanged — tests are behaviour-based and pass without structural change).

**Self-check results**:
- `npx tsc --noEmit`: PASS — 0 TypeScript errors
- `npm test -- --watchAll=false`: PASS — 314 tests, 27 suites, 0 failures
  - `mod-beta-video/__tests__/BetaVideoPlayer.test.tsx` — PASS
  - `mod-beta-video/__tests__/BetaVideoSection.test.tsx` — PASS
  - `mod-beta-video/__tests__/BetaVideoUploader.test.tsx` — PASS
  - `mod-beta-video/__tests__/beta-video-service.test.ts` — PASS
- `npx expo run:ios` (simulator): PASS — Build Succeeded, 0 errors, 1 pre-existing `-lc++` linker warning. App launched on iPhone 17 Pro simulator, JS bundle loaded (747ms, 973 modules). No xcodebuild error 65.
- Git scope check: FAIL (expected — package.json, package-lock.json, __mocks__, app.json, ios/pbxproj are legitimate targets for a dependency-swap bugfix; pre-existing dirty files from other modules not touched by this fix)
- All judgment-based checklist items: PASS — all ACs still pass; no new dependencies outside production.md tech stack; no hardcoded values; no gold-plating; cross-module import rule unaffected.

**Status before implementation complete — 2026-09-24 (Phase 1 thumbnail content-type mismatch)**

### Bug Fix — Phase 1 thumbnail content-type mismatch (2026-09-24)

**Commit**: (see git log)

**Root cause:** `uploadBetaVideo` in `beta-video-service.ts` was uploading `localThumbnailUri` (which `BetaVideoUploader` sets to `asset.uri` — the same video URI) to Supabase Storage with `contentType: 'image/jpeg'`. This caused a content-type mismatch because the data was a video file, not a JPEG.

**Fix:**
- Removed the thumbnail Storage upload phase entirely (was `contentType: 'image/jpeg'`, data was video bytes).
- Per PM ruling (PRD Revision 10, AC-031 Phase 1 clause): `thumbnail_url` is set to the video's storage path (`videoPath`). This is a valid retrievable URL — callers signing it via `getThumbnailSignedUrl` receive a signed URL for the same video file, which AVPlayer can display as a still.
- Cleanup logic updated: on row insert failure, only `videoPath` is removed (no separate thumbnail path exists in Phase 1).
- Progress phases updated: removed thumbnail phase (10%/30%); video phase now starts at 10%.
- Tests updated in `beta-video-service.test.ts`:
  - Happy-path test asserts exactly one `storage.upload` call with `contentType: 'video/mp4'`.
  - Video-upload-failure test asserts `storage.remove` is NOT called (nothing was stored yet).
  - Row-insert-failure test asserts `storage.remove` IS called for the video artifact.
- `npx tsc --noEmit`: PASS (0 errors)
- `npm test -- --watchAll=false`: PASS (277 tests, 24 suites, 0 failures)

### Bug Fix — AC-035 (2026-09-24)

**Commit**: `bdccdabc2247ea2dc18adc3c3ef748636b8e5b5d`

- `validateVideoFormat()` fallback branch (no `mimeType`): changed condition from `!uri.endsWith('.mp4') && !uri.endsWith('.mov')` to `!uri.toLowerCase().endsWith('.mp4')`. `.mov` URIs with no mimeType now return the validation error instead of `null`.
- `locales/en/common.json` `betaVideo.errors.invalidFormat`: already correct at HEAD ("Only MP4 videos are supported. Please select a different file.").
- `locales/zh-TW/common.json` `betaVideo.errors.invalidFormat`: already correct at HEAD ("僅支援 MP4 格式的影片，請選擇其他檔案。").
- Tests updated: HEVC test regex updated to `/Only MP4 videos are supported/i`; new test `"AC-035: rejects .mov files with no mimeType (MP4 container only)"` added.
- `npx tsc --noEmit`: PASS (0 errors)
- `npm test -- --watchAll=false`: PASS (277 tests, 24 suites, 0 failures)

**Status before implementation complete — 2026-09-24**

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

**QA agent**: qa-mod-beta-video
**Mode**: functional-test (first-time verification)
**Date**: 2026-09-24

---

### Automated Test Run

- `npx tsc --noEmit`: PASS — 0 TypeScript errors
- `npm test -- --watchAll=false`: PASS — 225 tests, 21 suites, 0 failures
  - `mod-beta-video/__tests__/beta-video-service.test.ts` — PASS
  - `mod-beta-video/__tests__/BetaVideoPlayer.test.tsx` — PASS
  - `mod-beta-video/__tests__/BetaVideoSection.test.tsx` — PASS
  - `mod-beta-video/__tests__/BetaVideoUploader.test.tsx` — PASS

---

### AC-by-AC Verification

**AC-030** — PASS
Rejection of videos longer than 60 seconds before upload begins. Verified in `BetaVideoUploader.validateDuration()`: `durationSec > MAX_DURATION_SECONDS` (where `MAX_DURATION_SECONDS = 60`). Upload never starts on rejection — `uploadBetaVideo` is not called. Boundary: exactly 60 seconds is accepted (correct per spec "≤ 60 sec"). Test covers 90-second rejection case and confirms `uploadBetaVideo` not called.

**AC-031** — PARTIAL PASS (spec issue flagged separately)
Client-side handling uses `expo-image-picker` with `videoMaxDuration: 60`. The thumbnail upload is implemented in `beta-video-service.uploadBetaVideo`. However, the thumbnail is not generated as an extracted frame — `BetaVideoUploader.tsx` line 157 sets `localThumbnailUri = asset.uri` (the video URI itself), so the video file is uploaded twice: once as the video and once as the thumbnail placeholder. The spec says "generate a thumbnail on the client" and implementation notes cite "a frame extracted at 1 second." The engineer documents this as a Phase 1 simplification with an upgrade path. See SPEC ISSUE below.

**AC-032** — PASS
Every `BetaVideo` row includes `route_id`. `BetaVideoSection` receives `routeId` prop and passes it to `BetaVideoUploader` which passes it to `uploadBetaVideo`. The DB migration has `route_id UUID NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE`. The insert payload always includes `route_id: input.route_id`. The table has no mechanism for a video to attach to more than one route — enforced by the FK structure.

**AC-033** — PASS
`BetaVideoPlayer.tsx` renders inline via expo-av `Video` component with `useNativeControls` and `ResizeMode.CONTAIN`. No external link or browser is opened. Pressing the thumbnail play button transitions state from thumbnail overlay to the video player (tested in `BetaVideoPlayer.test.tsx` — play button disappears after press, confirming switch). The component is also designed to be reusable by MOD-006 for AC-034.

**AC-034** — PASS (component exposure only; MOD-006 embedding is out of scope for this module)
`BetaVideoPlayer` is a self-contained component with `videoUrl`, `thumbnailUrl`, `durationSeconds`, `caption` props. The spec's Integration Points section explicitly places the feed embedding responsibility on MOD-006 ("engineer-mod-social-feed embeds it in the feed item renderer"). MOD-005's obligation is to expose the component — which it does. MOD-006 is not yet built; this is a known dependency ordering gap, not a MOD-005 defect.

**AC-035** — FAIL (implementation bug — route to Engineer)
`FAIL AC-035: Input=[video with .mov extension and no mimeType], Actual=[accepted, no error surfaced], Expected=[rejected with clear error per spec — MP4 container only]`

The spec states: "The system shall reject, on ingest, any beta video upload whose muxed output is not H.264 (baseline profile) video + AAC audio in an **MP4 container**."

The implementation in `BetaVideoUploader.validateVideoFormat()` (lines 74–91) accepts `.mov` files as a secondary path when `mimeType` is absent:
```
if (!uri.endsWith('.mp4') && !uri.endsWith('.mov')) {
  if (!asset.mimeType) {
    return t('betaVideo.errors.invalidFormat');
  }
}
```
A video with a `.mov` URI and no `mimeType` passes validation. Additionally, the user-facing error message in both locales explicitly says "Only MP4 or MOV videos are supported" — which directly contradicts the spec requirement of MP4 container only.

The spec's production.md Video Pipeline Convention also states: "All client-side video compression outputs H.264 (baseline profile) + AAC audio in an MP4 container. Any upload whose muxed output does not conform to H.264/AAC/MP4 must be rejected on ingest with a clear error surfaced to the user (AC-035)." `.mov` is not an MP4 container.

**Routing**: implementation bug → Engineer (fix `validateVideoFormat` to reject `.mov` when mimeType is absent, and update the error message in both locale files to say "MP4 only").

**AC-036** — PASS
`BetaVideoUploader` renders a `Modal` with `visible={isUploading}` during upload. The Modal is transparent/fade animated, has an `ActivityIndicator`, a title ("Uploading…"), and percent progress text. `onRequestClose` is intentionally a no-op — the overlay is non-dismissable. The disabled state on the "Add Beta Video" button (`disabled={isUploading}`) prevents double-submission. `setIsUploading(false)` is in the `finally` block so it always clears on completion or failure.

**AC-037** — PASS
`BetaVideoSection` is the public entry-point component imported in `RouteDetailScreen.tsx` line 37. It receives `routeId={route.id}` (pre-attached at render time). `BetaVideoUploader` renders the "Add Beta Video" button as an always-visible `Pressable`. The button is visible without leaving the route detail screen. `session.user.id` is threaded from `RouteDetailScreen` through `BetaVideoSection` to `BetaVideoUploader` as `userId`. Tested in both `BetaVideoUploader.test.tsx` and `BetaVideoSection.test.tsx`.

---

### Integration Checks

**Cross-module import rule** — PASS
`RouteDetailScreen.tsx` imports only `BetaVideoSection` from `mod-beta-video`. No internal `screens/` or other `components/` are imported from MOD-005 outside its own directory.

**Supabase client singleton** — PASS
`beta-video-service.ts` imports from `../../lib/supabase` and never calls `createClient()` directly. No `service_role` key usage in client code.

**i18n — en locale** — PASS
All `betaVideo.*` keys present: `sectionTitle`, `addVideo`, `noVideos`, `uploading`, `uploadProgress`, `player.play`, `player.thumbnailAlt`, `errors.loadFailed`, `errors.uploadFailed`, `errors.tooLong`, `errors.invalidFormat`, `errors.permissionDenied`. No inline string literals in component JSX.

**i18n — zh-TW locale** — PASS
All `betaVideo.*` keys present with zh-TW translations. Every EN key has a zh-TW counterpart. No missing keys detected.

**No hardcoded hex colors** — PASS
All styling uses `theme.colors.*`, `theme.spacing.*`, `theme.fontSize.*`, `theme.fontWeight.*`, `theme.borderRadius.*` tokens. No hardcoded hex values in any MOD-005 component.

**Safe area insets** — PASS (not applicable to sub-components)
MOD-005 components (`BetaVideoPlayer`, `BetaVideoUploader`, `BetaVideoSection`) are sub-components mounted inside `RouteDetailScreen`, not top-level screens. The safe-area inset convention applies to screens (`useSafeAreaInsets` + `makeStyles(theme, topInset)`). `RouteDetailScreen.tsx` correctly implements this: `useSafeAreaInsets()` at line 78, `makeStyles(theme, insets.top)` at line 79, `paddingTop: topInset + theme.spacing.md` in `contentContainerStyle`.

**No HTML template comments in spec** — PASS
No `<!-- -->` comments found in `project-planning/modules/mod-beta-video/spec.md`.

**Gold-plating check** — PASS
Implementation is confined to ACs 030–037. No features implemented beyond spec scope.

---

### Regression Check — RouteDetailScreen ACs

**AC-042** — PASS (unaffected)
`RouteDetailScreen` still accepts `routeId` prop and renders route detail. Navigation path from RouteListScreen unchanged. BetaVideoSection addition is additive only.

**AC-044** — NOTE (pre-existing issue, not introduced by MOD-005)
`RouteDetailScreen.tsx` lines 310–313 render `submitted_by_user_id` with label "SUBMITTED BY". AC-044 (added in PRD Rev 7 via PM update) says this field should not be displayed. This was not introduced by MOD-005 and was present before this module's changes. This is a pre-existing MOD-003 issue — out of scope for this QA run.

**AC-045** — PASS (unaffected)
`formatRouteName` helper and route name display in `RouteDetailScreen` unchanged. Tests pass.

**AC-046** — PASS (unaffected)
Bookmark toggle, optimistic update, `fetchSavedRouteIds`, `saveRoute`, `unsaveRoute` all present and tested. BetaVideoSection is additive below the existing content.

**AC-047** — PASS (unaffected)
`RouteListScreen` saved indicator logic unchanged. No MOD-005 changes touch `RouteListScreen`.

---

### Spec Issues (escalate to PM, not Engineer)

**SPEC ISSUE — AC-031 thumbnail generation scope**
The spec requires "generate a thumbnail on the client" and notes "e.g., a frame extracted at 1 second." The implementation uploads the video URI as the thumbnail placeholder (Phase 1 simplification — `localThumbnailUri = asset.uri`). This means the thumbnail stored in `BetaVideo.thumbnail_url` is a full video file, not an image frame. The spec is silent on whether this Phase 1 simplification is acceptable. The engineer documents an upgrade path to `ffmpeg-kit-react-native` for Phase 2. The `upload` call in `beta-video-service.ts` correctly uses `contentType: 'image/jpeg'` for the thumbnail slot, but the actual data is a video file.

If the spec intends "a JPEG thumbnail image frame" as required behavior in Phase 1 (not Phase 2), this is an implementation bug for Engineer. If the spec accepts the Phase 1 simplification, this needs a spec update to explicitly note the Phase 1 scope reduction.

Recommendation: escalate to PM to clarify whether thumbnail frame extraction is required in Phase 1 or acceptable to defer to Phase 2.

**SPEC DOC GAP — Library choice not confirmed in spec.md**
The spec says: "The final library choice must be confirmed during MOD-005 engineering and documented in this spec before coding begins." The confirmed library choice (`expo-image-picker` for Phase 1 selection, `expo-av` for playback) is documented in `status.md` Engineering Progress but not in `spec.md` itself. This is a Doc-Sync task to update the spec with the confirmed library choice.

---

### Verdict

**BUGS FOUND** — 1 implementation bug (AC-035), 2 spec issues (AC-031 thumbnail scope, spec library-choice doc gap).

The AC-035 format validation bug is the only clear implementation defect: `.mov` files are accepted when the spec requires MP4 container only, and the error message contradicts the spec. This must be fixed before human QA.

The AC-031 thumbnail issue requires PM clarification on Phase 1 scope before routing to Engineer.

The library-choice doc gap is a Doc-Sync task.

---

## QA Run 2 — Regression — 2026-09-24

**QA agent**: qa-mod-beta-video
**Mode**: regression (re-verification after AC-035 bug fix)
**Re-verifying**: AC-035 — `.mov` files with no mimeType must be rejected; error message must say MP4 only

---

### Automated Test Run

- `npx tsc --noEmit`: PASS — 0 TypeScript errors
- `npm test -- --watchAll=false`: PASS — 277 tests, 24 suites, 0 failures (up from 225/21 — 52 tests added across all modules since QA Run 1; all MOD-005 suites pass)
  - `mod-beta-video/__tests__/beta-video-service.test.ts` — PASS
  - `mod-beta-video/__tests__/BetaVideoPlayer.test.tsx` — PASS
  - `mod-beta-video/__tests__/BetaVideoSection.test.tsx` — PASS
  - `mod-beta-video/__tests__/BetaVideoUploader.test.tsx` — PASS (includes new `.mov` rejection test)

---

### AC-035 Fix Verification

**REGRESSION PASS AC-035**: original failure scenario resolved.

Original failure: `Input=[video with .mov extension and no mimeType], Actual=[accepted, no error surfaced], Expected=[rejected with clear error]`

Fix verified in `src/modules/mod-beta-video/components/BetaVideoUploader.tsx` line 82:
```
if (!asset.mimeType && !asset.uri.toLowerCase().endsWith('.mp4')) {
  return t('betaVideo.errors.invalidFormat');
}
```
- A `.mov` URI with no `mimeType` now hits the fallback branch and returns the error — no longer passes through as `null`.
- A `.mp4` URI with no `mimeType` correctly returns `null` (accepted) — the fix is precisely scoped.
- The `mimeType`-present branch (line 77) is unchanged: `video/mp4` passes, everything else (e.g. `video/hevc`) fails — no regression to the HEVC path.
- Locale messages confirmed at HEAD:
  - `en`: "Only MP4 videos are supported. Please select a different file." — correct per spec (MP4 only, no MOV mention)
  - `zh-TW`: "僅支援 MP4 格式的影片，請選擇其他檔案。" — correct per spec

New test confirmed present and passing in `BetaVideoUploader.test.tsx`:
- Test name: "AC-035: rejects .mov files with no mimeType (MP4 container only)"
- Input: `uri: 'file:///video.mov'`, `mimeType: undefined`
- Asserts: error text matching `/Only MP4 videos are supported/i` appears; `uploadBetaVideo` not called
- Result: PASS

---

### Re-verification of Previously Passing ACs

**AC-030** — PASS (unaffected)
`validateDuration()` is a separate function from `validateVideoFormat()` — the fix touched only the format branch. The 90-second rejection test still passes; `MAX_DURATION_SECONDS = 60` boundary unchanged.

**AC-031** — PARTIAL PASS (spec issue status unchanged — pending PM ruling; not affected by this fix)
The thumbnail-as-video-URI simplification is unchanged. The fix did not touch upload logic, only the pre-upload format gate.

**AC-032** — PASS (unaffected)
`route_id` threading from `BetaVideoSection` through `BetaVideoUploader` to `uploadBetaVideo` is unchanged. The fix is in the validation gate only, before upload begins.

**AC-033** — PASS (unaffected)
`BetaVideoPlayer` is a separate component with no dependency on `validateVideoFormat`. Inline playback behavior unchanged.

**AC-034** — PASS (unaffected)
`BetaVideoPlayer` exposure is unchanged. MOD-006 dependency ordering gap is pre-existing and unrelated to this fix.

**AC-036** — PASS (unaffected)
The progress `Modal` and `isUploading` state are controlled in `handleSelectVideo` after the validation gates pass. The fix adds an earlier return path on `.mov` rejection — `setIsUploading(true)` is never reached on rejection, which is correct. The `finally` block still clears `isUploading` on upload completion or failure.

**AC-037** — PASS (unaffected)
`BetaVideoSection` entry point and the `routeId` prop pre-attachment are unchanged. The "Add Beta Video" button renders and triggers the picker flow as before.

**Integration checks** — all PASS (unchanged from QA Run 1; fix is isolated to `validateVideoFormat()` in `BetaVideoUploader.tsx` and the test file)

**Adjacent-logic regression check**: the fix is in the `validateVideoFormat` function only. Both branches are self-contained: the mimeType-present branch is untouched; the fallback branch now has a single, precise condition. No shared state, no early returns that affect other ACs, no data structure changes. No new regressions found.

---

### Open Items (unchanged from QA Run 1 — not blocking AC-035 clearance)

**SPEC ISSUE — AC-031 thumbnail generation scope** (pending PM ruling)
Phase 1 simplification (`localThumbnailUri = asset.uri`) is still in place. Not a blocker for AC-035 clearance. Requires PM ruling on whether frame extraction is required in Phase 1.

**SPEC DOC GAP — Library choice not confirmed in spec.md** (Doc-Sync task, not a blocker)

---

### Verdict

**PASS** — AC-035 fix verified. No regressions in AC-030/031/032/033/034/036/037.

MOD-005 is ready for human QA with one standing note: the AC-031 thumbnail question (video URI used as thumbnail placeholder vs. extracted JPEG frame) is pending PM ruling and is not a blocking bug — it is a spec-scope question. All other ACs pass.

---

## QA Run 3 — Regression — 2026-09-24

**QA agent**: qa-mod-beta-video
**Mode**: regression (re-verification after Phase 1 thumbnail content-type bug fix)
**Re-verifying**: AC-031 — separate thumbnail Storage upload removed; `thumbnail_url` set to `videoPath`; `storage.upload` called exactly once; cleanup logic updated

---

### Automated Test Run

- `npx tsc --noEmit`: PASS — 0 TypeScript errors
- `npm test -- --watchAll=false`: PASS — 277 tests, 24 suites, 0 failures (count unchanged from QA Run 2 — this fix updated existing tests, did not add new suites)
  - `mod-beta-video/__tests__/beta-video-service.test.ts` — PASS
  - `mod-beta-video/__tests__/BetaVideoPlayer.test.tsx` — PASS
  - `mod-beta-video/__tests__/BetaVideoSection.test.tsx` — PASS
  - `mod-beta-video/__tests__/BetaVideoUploader.test.tsx` — PASS

---

### Fix Verification — Thumbnail content-type mismatch

The previous QA Run 1 spec issue flagged that `beta-video-service.ts` uploaded the video URI as the thumbnail with `contentType: 'image/jpeg'`, causing a content-type mismatch. This was a quality defect, not a spec-scope issue. The PM ruling (PRD Revision 10, AC-031 Phase 1 clause) confirmed that a placeholder thumbnail is acceptable, but it must still be a valid retrievable URL. The engineer has since fixed the implementation.

**REGRESSION PASS AC-031 (Phase 1 placeholder, content-type fix)**: original content-type mismatch resolved.

Verified in `src/modules/mod-beta-video/beta-video-service.ts`:

1. No separate thumbnail Storage upload exists. The function has a single `supabase.storage.from(BETA_VIDEO_BUCKET).upload(videoPath, videoBlob, { contentType: 'video/mp4', upsert: false })` call (lines 77–82). There is no second `upload` call anywhere in the function.

2. `thumbnail_url` is set to `videoPath` (line 101):
   `thumbnail_url: videoPath` — the video's own storage path is used as the placeholder. This is a valid, retrievable path per AC-031 Phase 1 clause.

3. Cleanup on row-insert failure (lines 109–111) removes only `videoPath` — no separate thumbnail path is referenced, consistent with there being only one stored artifact.

4. Progress phases: `onProgress` is called with `{ percent: 10, phase: 'video' }` before upload and `{ percent: 80, phase: 'video' }` after upload, then `{ percent: 90, phase: 'saving' }` and `{ percent: 100, phase: 'saving' }`. No thumbnail phase exists. Progress still reaches 100% on success — AC-036 unaffected.

Verified in `src/modules/mod-beta-video/__tests__/beta-video-service.test.ts`:

5. Happy-path test (line 193, "AC-032: uploads video then inserts row with route_id (Phase 1 — no separate thumbnail upload)"):
   - Asserts `storageBucket.upload` called exactly once: `expect(storageBucket.upload).toHaveBeenCalledTimes(1)` (line 224)
   - Asserts that one call used `contentType: 'video/mp4'`: `expect.objectContaining({ contentType: 'video/mp4' })` (line 229)
   - Result: PASS

6. Video-upload-failure test (line 232, "throws (no cleanup needed) when video upload fails"):
   - Comment confirms the intent: "Phase 1: only one upload — if it fails, nothing was stored, no cleanup needed."
   - Asserts `storageBucket.remove` NOT called: `expect(storageBucket.remove).not.toHaveBeenCalled()` (line 258)
   - Result: PASS

7. Row-insert-failure test (line 261, "throws and cleans up video artifact when row insert fails"):
   - Asserts `storageBucket.remove` IS called: `expect(storageBucket.remove).toHaveBeenCalled()` (line 289)
   - Removes only the video artifact (no separate thumbnail path) — consistent with single-upload design
   - Result: PASS

All three test assertions match the engineer's described fix exactly.

---

### AC-031 Status — PASS (Phase 1 compliant per PM ruling)

The AC-031 spec issue from QA Run 1 (pending PM ruling) is now resolved. PM ruled in PRD Revision 10 that the Phase 1 placeholder thumbnail is acceptable, provided `BetaVideo.thumbnail_url` is a valid retrievable URL. The fix satisfies this: `thumbnail_url` stores `videoPath`, a Supabase Storage path that is retrievable via `getThumbnailSignedUrl`. No content-type mismatch exists. No double-upload of the video file.

AC-031 is now a full PASS for Phase 1.

---

### Re-verification of All Other ACs

**AC-030** — PASS (unaffected)
`validateDuration()` is a separate function in `BetaVideoUploader.tsx` untouched by this fix. The 90-second rejection logic and `MAX_DURATION_SECONDS = 60` boundary are unchanged. Tests pass.

**AC-032** — PASS (unaffected)
`route_id` threading is in the DB insert payload, not in the upload phase. The fix removes the thumbnail upload only — the insert's `route_id` field is unchanged. Tests pass.

**AC-033** — PASS (unaffected)
`BetaVideoPlayer.tsx` has no dependency on the upload service. Inline playback behavior unchanged. Tests pass.

**AC-034** — PASS (unaffected)
`BetaVideoPlayer` component exposure is unchanged. MOD-006 integration is a pre-existing dependency-ordering gap, not affected by this fix.

**AC-035** — PASS (verified in QA Run 2, unaffected by this fix)
`validateVideoFormat()` in `BetaVideoUploader.tsx` is a pre-upload gate that does not interact with the storage upload logic. The AC-035 fix from QA Run 2 is intact.

**AC-036** — PASS (unaffected)
The progress overlay is driven by `onProgress` callbacks. This fix changed the progress phase sequence (removed a thumbnail phase, adjusted percentages) but the overlay still reaches 100% on success and `setIsUploading(false)` is still in the `finally` block. The Modal's non-dismissable behavior and `disabled={isUploading}` guard are unchanged.

**AC-037** — PASS (unaffected)
`BetaVideoSection` and `RouteDetailScreen` integration are unchanged. The fix is isolated to `beta-video-service.ts` and `beta-video-service.test.ts`.

**Integration checks** — all PASS (unchanged from QA Run 2)
- Supabase client singleton: `beta-video-service.ts` still imports from `../../lib/supabase` — no `createClient()` call.
- Cross-module import rule: `RouteDetailScreen.tsx` still imports only `BetaVideoSection` from `mod-beta-video`.
- i18n: no locale files were changed by this fix; all keys remain present and correct.
- No hardcoded hex colors: no styling changes in this fix.
- Safe area insets: not applicable to MOD-005 sub-components; `RouteDetailScreen.tsx` unchanged.

**Adjacent-logic regression check**: the fix is entirely within `uploadBetaVideo()` in `beta-video-service.ts` and the corresponding test file. The change removes a code path (thumbnail upload) and updates one field in the DB insert payload (`thumbnail_url: videoPath` instead of a separate path). No shared state with validation functions, player components, or section components. No new regressions introduced.

---

### Open Items

**SPEC DOC GAP — Library choice not confirmed in spec.md** (Doc-Sync task, not a blocker)
The confirmed library choice (`expo-image-picker` for Phase 1 selection, `expo-av` for playback) is documented in `status.md` Engineering Progress but not in `spec.md` itself. This remains a Doc-Sync task and is not a blocker for human QA.

---

### Verdict

**PASS** — AC-031 content-type fix verified. `storage.upload` called exactly once with `contentType: 'video/mp4'`. No separate thumbnail artifact. `thumbnail_url` stores `videoPath` (valid retrievable URL per PM ruling). Video-upload-failure test correctly asserts no `storage.remove` call. Row-insert-failure test correctly asserts `storage.remove` for the video artifact only. No regressions in AC-030/032/033/034/035/036/037.

**MOD-005 is ready for human QA.** All ACs pass:
- AC-030: PASS — 60-second duration cap enforced before upload
- AC-031: PASS — Phase 1 placeholder thumbnail compliant per PM ruling (PRD Revision 10); single upload, valid retrievable URL
- AC-032: PASS — one BetaVideo row attached to exactly one route
- AC-033: PASS — inline playback via expo-av, no external links
- AC-034: PASS — BetaVideoPlayer component exposed for MOD-006 embedding (MOD-006 not yet built — pre-existing dependency gap)
- AC-035: PASS — MP4-only ingest validation, `.mov` rejected, HEVC rejected
- AC-036: PASS — progress overlay 0-100%, blocks interaction during upload
- AC-037: PASS — "Add Beta Video" entry point visible on route detail screen, route context pre-attached

---

## QA Run 4 — Regression — 2026-09-25

**QA agent**: qa-mod-beta-video
**Mode**: regression (re-verification after expo-av → expo-video migration, iOS build fix)
**Re-verifying**: BetaVideoPlayer.tsx uses expo-video (VideoView + useVideoPlayer); no remaining expo-av references in mod-beta-video files; mock files correct; all 314 tests pass; all ACs unaffected

---

### Scope

Engineer migrated BetaVideoPlayer from expo-av to expo-video to fix an iOS native build failure (xcodebuild error 65: EXEventEmitter.h not found in expo-modules-core@57). This is a library-swap regression check: verify the migration is complete and correct, and that no AC is affected by the change.

---

### Static Verification

**BetaVideoPlayer.tsx imports** — PASS
`src/modules/mod-beta-video/components/BetaVideoPlayer.tsx` line 12 imports `{ VideoView, useVideoPlayer }` from `'expo-video'`. No import from `expo-av`. Uses `useVideoPlayer(videoUrl, (p) => { p.loop = false })` to create the player and `<VideoView player={player} contentFit="contain" nativeControls />` to render inline. Component props are unchanged (`videoUrl`, `thumbnailUrl`, `durationSeconds`, `caption`, `testID`).

**No remaining expo-av references in mod-beta-video source** — PASS (with note)
`grep -r "expo-av" src/modules/mod-beta-video/` returns two matches, both in comments only:
- `src/modules/mod-beta-video/test-utils.tsx` line 8: stale comment "expo-av is mocked globally via moduleNameMapper" — functional code is unaffected; this comment is cosmetically stale but does not affect compilation or test execution.
- `src/modules/mod-beta-video/components/BetaVideoPlayer.tsx` line 9: comment "SDK 57 successor to expo-av" — accurate historical context, not a functional reference.
No production import of expo-av exists anywhere in the module.

**No expo-av in package.json** — PASS
`grep -c "expo-av" package.json` returns 0. expo-av is fully removed from dependencies.

**expo-video present in package.json** — PASS
`package.json` line 20: `"expo-video": "~57.0.5"`. Installed via `npx expo install` (SDK-compatible version per production.md Native Dependency Installation convention). `moduleNameMapper` maps `^expo-video$` → `<rootDir>/__mocks__/expo-video.js`.

**Mock files** — PASS
- `__mocks__/expo-video.js` exists. Provides `VideoView` (renders a `View`), `useVideoPlayer` (returns mock player with `play`, `pause`, `addListener`), and `createVideoPlayer`. All three exports match what BetaVideoPlayer imports and uses.
- `__mocks__/expo-av.js` does not exist (deleted). Confirmed: `ls __mocks__/` shows only `expo-blob.js`, `expo-video.js`, `react-native-safe-area-context.js`.

**BetaVideoPlayer.test.tsx comment** — PASS
Line 7: "expo-video is mocked globally via moduleNameMapper (expo-video → __mocks__/expo-video.js)." Updated correctly.

---

### Automated Test Run

- `npx tsc --noEmit`: PASS — 0 TypeScript errors
- `npm test -- --watchAll=false`: PASS — 314 tests, 27 suites, 0 failures (up from 277/24 in QA Run 3 — 37 tests added across all modules since QA Run 3; all MOD-005 suites pass)
  - `mod-beta-video/__tests__/beta-video-service.test.ts` — PASS
  - `mod-beta-video/__tests__/BetaVideoPlayer.test.tsx` — PASS
  - `mod-beta-video/__tests__/BetaVideoSection.test.tsx` — PASS
  - `mod-beta-video/__tests__/BetaVideoUploader.test.tsx` — PASS

Console warnings about `act()` (Icon state updates) appear across multiple unrelated modules (BetaVideoUploader, RouteListScreen, RouteSubmitScreen, RequestGymScreen) — these are pre-existing and not introduced by this fix. All suites still pass.

---

### AC-by-AC Regression Check

**AC-030** — PASS (unaffected)
Duration validation is in `BetaVideoUploader.validateDuration()`, entirely separate from the video player. Unchanged. Tests pass.

**AC-031** — PASS (unaffected)
Upload pipeline is in `beta-video-service.ts`. No changes to the upload path. Single `storage.upload` call with `contentType: 'video/mp4'`; `thumbnail_url` set to `videoPath`. Tests pass.

**AC-032** — PASS (unaffected)
`route_id` threading from `BetaVideoSection` → `BetaVideoUploader` → `uploadBetaVideo` → DB insert is unchanged. Tests pass.

**AC-033** — PASS
`BetaVideoPlayer` renders inline via `expo-video`'s `VideoView` with `nativeControls` and `contentFit="contain"`. No external link or browser is opened. The thumbnail-to-player state transition works: pressing play hides the thumbnail/play-button overlay and shows `VideoView`. Verified in `BetaVideoPlayer.test.tsx` — play button disappears after press (line 70–77). No regression in inline playback behavior.

**AC-034** — PASS (unaffected)
`BetaVideoPlayer` is a self-contained component with the same public props (`videoUrl`, `thumbnailUrl`, `durationSeconds`, `caption`). Component shape unchanged — MOD-006 can still embed it. MOD-006 is not yet built; this remains a pre-existing dependency-ordering gap, not a MOD-005 defect.

**AC-035** — PASS (unaffected)
`validateVideoFormat()` in `BetaVideoUploader.tsx` is unchanged. `.mov` rejection and HEVC rejection paths intact. Tests pass.

**AC-036** — PASS (unaffected)
Progress overlay logic in `BetaVideoUploader` is unchanged. No interaction with the video player. Tests pass.

**AC-037** — PASS (unaffected)
`BetaVideoSection` entry point and `RouteDetailScreen` integration are unchanged. Tests pass.

---

### Integration Checks

**Cross-module import rule** — PASS
`RouteDetailScreen.tsx` still imports only `BetaVideoSection` from `mod-beta-video`. No internal `screens/` or `components/` imported from MOD-005 outside its directory.

**Supabase client singleton** — PASS
`beta-video-service.ts` imports from `../../lib/supabase`; no `createClient()` at call sites.

**i18n** — PASS (unchanged; no locale files touched by this fix)

**No hardcoded hex colors** — PASS (unchanged; no styling changes in this fix)

**Safe area insets** — PASS (not applicable to MOD-005 sub-components; RouteDetailScreen unchanged)

**production.md Native Dependency Installation convention** — PASS
`expo-video ~57.0.5` was installed via `npx expo install expo-video` per the convention added in PRD Revision 11. The version string is SDK-resolver-chosen, not hand-pinned.

**production.md Native Build Gate convention** — PASS
Engineer ran `npx expo run:ios` (iPhone 17 Pro simulator) — Build Succeeded, 0 errors, 1 pre-existing `-lc++` linker warning (not introduced by this fix). App launched, JS bundle loaded (747ms, 973 modules). No xcodebuild error 65.

---

### Open Items (unchanged)

**SPEC DOC GAP — Library choice not confirmed in spec.md** (Doc-Sync task, not a blocker)
The confirmed library choice (expo-video ~57.0.5 for playback, expo-image-picker for Phase 1 selection) is documented in status.md Engineering Progress but not in spec.md itself. Remains a Doc-Sync task. Not a blocker for human QA.

---

### Verdict

**PASS** — expo-av → expo-video migration verified. No expo-av imports in production source. expo-video.js mock present; expo-av.js mock absent. package.json updated correctly. TypeScript clean (0 errors). 314/314 tests pass. All AC-030–037 unaffected — no behavioral regression from the library swap.

**MOD-005 is ready for human QA.** iOS build confirmed passing by Engineer (Build Succeeded, 0 errors, app launched on iPhone 17 Pro simulator). All ACs pass:
- AC-030: PASS — 60-second duration cap enforced before upload
- AC-031: PASS — Phase 1 placeholder thumbnail compliant per PM ruling (PRD Revision 10); single upload, valid retrievable URL
- AC-032: PASS — one BetaVideo row attached to exactly one route
- AC-033: PASS — inline playback via expo-video VideoView, no external links
- AC-034: PASS — BetaVideoPlayer component exposed for MOD-006 embedding (MOD-006 not yet built — pre-existing dependency gap)
- AC-035: PASS — MP4-only ingest validation, .mov rejected, HEVC rejected
- AC-036: PASS — progress overlay 0-100%, blocks interaction during upload
- AC-037: PASS — "Add Beta Video" entry point visible on route detail screen, route context pre-attached
