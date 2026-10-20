# Thermos Phase 1 Review — 2026-10-20

**Scope:** `76a292c..HEAD` (doc-sync(initial) → Phase 1 complete)
**Reviewers:** thermo-nuclear-review (bugs/security) + thermo-nuclear-code-quality-review (maintainability)
**Total findings:** 19 (4 CRITICAL · 4 HIGH · 7 MEDIUM · 4 LOW)

Overlapping findings are weighted more heavily and listed first within their severity band.

---

## CRITICAL

---

### C-1 · `notify-beta-video-like` Edge Function has no auth validation — unauthenticated callers can forge push notifications

- **File:line:** `supabase/functions/notify-beta-video-like/index.ts:66–100`
- **Severity:** CRITICAL
- **Failure scenario:** Any actor who POSTs to the function's public URL with a valid JSON body `{ actor_id: "<any-uuid>", target_id: "<real-video-uuid>", target_type: "beta_video" }` causes the function to insert a `notifications` row and fan out APNs pushes to the video owner's devices. The handler never reads `req.headers.get('Authorization')` and never validates the JWT. The function immediately parses the body and proceeds with the service-role client.
- **Evidence:** No `req.headers.get` or JWT verification call exists anywhere in the handler body (lines 66–end). The docstring describes "Verify the JWT in the Authorization header (service-role only)" as step 1 but the code does not implement it.

---

### C-2 · `report-digest` Edge Function accepts unauthenticated requests — open-report metadata is enumerable

- **File:line:** `supabase/functions/report-digest/index.ts:60–175`
- **Severity:** CRITICAL
- **Failure scenario:** The handler's request parameter is `_req` (intentionally unused). Any HTTP POST to the function URL triggers a full service-role query against `reports` (including `reporter_user_id`, `target_id`, `category`, `note`), logs all open report rows, and returns the digest count in the JSON response. An adversary with the function URL can enumerate open-report counts and confirm whether specific reports exist.
- **Evidence:** `Deno.serve(async (_req: Request): Promise<Response>` — the request object is discarded; the function queries and logs report data unconditionally.

---

### C-3 · Google Places API key embedded in a URL query string — key appears in any proxy/CDN access log

- **File:line:** `scripts/seed-gym-photos.ts:148`
- **Severity:** CRITICAL
- **Failure scenario:** `downloadPhoto` appends the API key as `&key=${GOOGLE_PLACES_API_KEY}` in the URL string passed to `fetch()`. Any network proxy, server-side request logger, or CDN access log between the seeder machine and Google's servers will record the key in plaintext. The key should be sent as the `X-Goog-Api-Key` header (already done correctly in steps 1–2 of the same script).
- **Evidence:** `const mediaUrl = \`https://places.googleapis.com/v1/${photoName}/media\` + \`?maxWidthPx=800&skipHttpRedirect=true&key=${GOOGLE_PLACES_API_KEY}\`;`

---

### C-4 · Avatar storage UPDATE and DELETE policies always fail — policy compares UUID to filename-with-extension, which never matches

- **File:line:** `supabase/migrations/20260920000001_mod_001_user_profile.sql:107–121`
- **Severity:** CRITICAL
- **Failure scenario:** Avatars are uploaded to `avatars/<userId>.<ext>` (e.g. `avatars/abc-123.jpg`). `storage.filename('avatars/abc-123.jpg')` returns `'abc-123.jpg'`. The UPDATE/DELETE policies compare this to `auth.uid()::text` which returns `'abc-123'`. The strings never match because the extension is included. Every avatar replacement (`upsert: true`) and deletion permanently fails with a Supabase storage 403. INSERT works because it uses `storage.foldername` correctly.
- **Evidence:** Policy WHERE clause: `storage.filename(name) = auth.uid()::text` — does not strip the file extension.

---

## HIGH

---

### H-1 · `get_profile_history` and `get_profile_stats` have no block filter — blocked users can read each other's send history

- **File:line:** `supabase/migrations/20261013000003_mod_008_route_card_photo_url.sql:43–78`; `supabase/migrations/20261005000001_mod_008_fix_sends_by_grade.sql:65–95`
- **Severity:** HIGH
- **Failure scenario:** When user A blocks user B, `get_activity_feed` correctly excludes their content from the feed. However, `OtherUserProfileScreen` calls `fetchProfileHistory(userId)` → `get_profile_history`, which has only a `privacy_setting` gate and no block predicate. User A can navigate to user B's profile and receive B's full send history despite the block. Same gap in `get_profile_stats`.
- **Evidence:** The WHERE clause of `get_profile_history` contains `auth.uid() = p_user_id OR u.privacy_setting = 'public' OR EXISTS (SELECT 1 FROM follows ...)` — no `NOT EXISTS (SELECT 1 FROM blocks ...)` predicate.

---

### H-2 · `blocks` table has no self-block constraint — a user can block themselves, poisoning their own content feed

- **File:line:** `supabase/migrations/20260929000004_mod_009_moderation.sql:72–96`; `src/modules/mod-moderation/moderation-service.ts:83–103`
- **Severity:** HIGH
- **Failure scenario:** `blocks` table has only `PRIMARY KEY (blocker_user_id, blocked_user_id)` — no `CHECK (blocker_user_id <> blocked_user_id)`. The `blockUser()` service has no guard against `blockedUserId === currentUserId`. A self-block causes `fetchBlockedUserIds()` to return the user's own UUID, which any surface using that set to filter content then applies to the user's own content — the user would see their own posts filtered out. Compare: `follows` explicitly declares `CONSTRAINT follows_no_self_follow CHECK (follower_id <> followee_id)`.

---

### H-3 · `fetchBetaVideosByUser` has no block filter — a blocked user's beta videos remain visible on their profile page

- **File:line:** `src/modules/mod-beta-video/beta-video-service.ts:235–275`
- **Severity:** HIGH
- **Failure scenario:** Any screen rendering another user's beta videos via `fetchBetaVideosByUser(userId)` displays their videos regardless of block relationship. The function applies only the reported-video exclusion. `get_activity_feed` correctly filters blocked users via the `qualifying_followees` CTE and a `NOT EXISTS` defense; the user-profile beta video fetch does not.
- **Evidence:** `.or('is_reported.eq.false,report_dismissed.eq.true')` — only block applied is against reported videos, not blocked users.

---

### H-4 · Missing barrel `index.ts` in `mod-social-feed`, `mod-moderation`, `mod-notifications` — forces systematic private-path imports across the codebase

- **File:line:** `src/modules/mod-social-feed/` (no index.ts); `src/modules/mod-moderation/` (no index.ts); `src/modules/mod-notifications/` (no index.ts); also `src/modules/mod-route-catalog/screens/RouteDetailScreen.tsx:65`; `src/modules/mod-route-catalog/screens/RouteListScreen.tsx:38`
- **Severity:** HIGH
- **Failure scenario:** When modules lack barrels, all consumers are forced to deep-import private service files. This was caught for two specific cases in the Phase 1 integration review (INT-001/002/003) but the root cause — missing barrels — remains, creating new bypass instances: `ProfileScreen.tsx:41` imports `social-feed-service` directly; `FollowersListScreen.tsx:20`, `FollowingListScreen.tsx:21`, `UserProfileScreen.tsx:35,48`, `BetaVideoReelViewer.tsx:89`, `OtherUserProfileScreen.tsx:26` all import from private service paths. Additionally, `mod-route-catalog` screens still bypass the `mod-send-logging` barrel by importing `send-service` directly.
- **Evidence:** `grep -rn "from '\.\.\/mod-" src/modules/` returns 9+ cross-module private-path imports across 7 files.

---

## MEDIUM

---

### M-1 · `accumulated_days` in `get_profile_stats` ignores `is_private` — non-owners see an inflated count inconsistent with `total_sends`

- **File:line:** `supabase/migrations/20261005000001_mod_008_fix_sends_by_grade.sql:56–62`
- **Severity:** MEDIUM
- **Failure scenario:** `v_accumulated_days` counts all sends regardless of `is_private`. `total_sends` and `sends_by_grade` in the same function apply `(v_is_self OR a.is_private = FALSE)`. A non-owner viewing a profile with many private sends sees an `accumulated_days` higher than `total_sends` warrants — the stats are internally inconsistent.
- **Evidence:** `WHERE user_id = p_user_id AND style IN ('flash', 'top')` — missing `AND (v_is_self OR is_private = FALSE)`.

---

### M-2 · User can self-report at the DB layer — no `target_id <> auth.uid()` check for user reports

- **File:line:** `supabase/migrations/20260929000004_mod_009_moderation.sql:49–57`
- **Severity:** MEDIUM
- **Failure scenario:** The `reports_insert_own` RLS policy `WITH CHECK` is only `reporter_user_id = auth.uid()`. No check that `target_id <> auth.uid()` for `target_type = 'user'`. An authenticated user can insert a report where they are both reporter and target. Compare: `report_beta_video` RPC explicitly raises `cannot_report_own_video`.

---

### M-3 · `BetaVideoReelViewer` calls `supabase.auth.getSession()` on mount when `session` prop is already available

- **File:line (both reviewers flagged):** `src/modules/mod-beta-video/components/BetaVideoReelViewer.tsx:316–320`
- **Severity:** MEDIUM
- **Failure scenario:** The component receives a `session: Session` prop (line 109). An async `useEffect` calls `supabase.auth.getSession()` on mount to populate `currentUserId` nullable state. Using `session.user.id` directly removes the async round-trip, eliminates nullable state requiring `!== null` guards, and removes the `supabase` import from a component that otherwise has no direct DB access.
- **Evidence:** `void supabase.auth.getSession().then(({ data }) => { setCurrentUserId(data.session?.user.id ?? null); });` — `session.user.id` is already in scope.

---

### M-4 · `BetaVideoReelViewer.tsx` is 1,089 lines — exceeds the 1k-line threshold

- **File:line (both reviewers flagged):** `src/modules/mod-beta-video/components/BetaVideoReelViewer.tsx:1`
- **Severity:** MEDIUM
- **Failure scenario:** The file combines fullscreen modal lifecycle, video player management, PanResponder gesture orchestration (lines 528–620, 90 lines), marquee text animation, like state with optimistic update, report state, signed URL fetching, own-video identity check, and bottom-overlay layout measurement. Natural split points are already scaffolded: `MarqueeText` and `PosterAvatar` are local subcomponents (lines 165–233) that could be extracted to files; like/unlike state (lines 322–389) is a self-contained async machine suitable for a `useLikeState(videoId)` hook; the PanResponder block for a `useReelGestures(...)` hook.
- **Evidence:** `wc -l BetaVideoReelViewer.tsx` → 1089.

---

### M-5 · `HomeScreen.tsx` contains inline Supabase queries and a module-level cache singleton — service-layer boundary violated

- **File:line:** `src/modules/mod-home/screens/HomeScreen.tsx:225–437`; module-level cache at lines 129–151
- **Severity:** MEDIUM
- **Failure scenario:** `loadSavedGyms` and `loadProjectingRoutes` execute Supabase queries inline in the screen component, including a `MAX(last_viewed_at)` aggregation loop in JavaScript. The `newBetaCache` singleton lives at module scope in a screen file and is exported as `clearNewBetaCacheForTests` — tests are coupled to internal screen state. Four `as unknown as Array<{...}>` casts inline in data-loading callbacks belong in typed service return types. At 951 lines, the file will cross 1k lines with the first Phase 2 HomeScreen feature.
- **Evidence:** `supabase.from('routes').select(...)` and `supabase.rpc('routes_with_new_beta', ...)` calls inside `loadProjectingRoutes` in a screen component.

---

### M-6 · `moderation-service.ts` has no unit tests — highest-trust operations are untested

- **File:line:** `src/modules/mod-moderation/moderation-service.ts` (no corresponding `__tests__/moderation-service.test.ts`)
- **Severity:** MEDIUM
- **Failure scenario:** `reportUser`, `blockUser`, `unblockUser`, `fetchBlockedUserIds`, `isBlocked`, `fetchMyBlockedUsers` all directly touch `block_user` and `report_user` RPCs. `fetchBlockedUserIds` is called by at least 5 cross-module consumers in production code. No service-level test covers any of these functions' error paths or RPC call shapes. Component tests exist (`ModerationActions.test.tsx`, `OtherUserProfileScreen.test.tsx`) but do not exercise service error handling.

---

### M-7 · `withdrawRoute` silently succeeds when no rows are deleted — no affected-row count check

- **File:line:** `src/modules/mod-route-catalog/route-service.ts:130–140`
- **Severity:** MEDIUM
- **Failure scenario:** `withdrawRoute(routeId)` calls `.delete().eq('id', routeId)` with no `eq('submitted_by_user_id', userId)` filter at the client layer. RLS `routes_delete_own_pending` correctly enforces `submitted_by_user_id = auth.uid() AND status = 'pending'`, but when the RLS policy silently blocks the delete (e.g. caller passes an active route ID), PostgREST returns 200 OK with 0 rows affected. The function does not check the row count, so the caller receives `undefined` (success). This masks bugs in the calling screen — a pending route the user cannot actually withdraw appears to have been withdrawn successfully.

---

## LOW

---

### L-1 · `signInWithGoogle` URL parsing silently drops the refresh token when URL has both fragment and query string

- **File:line:** `src/modules/mod-auth-profile/auth-service.ts:169–184`
- **Severity:** LOW
- **Failure scenario:** `url.includes('#') ? url.split('#')[1] : url.split('?')[1]` — if the redirect URL has both a fragment and a query string the query string is ignored. `refreshToken ?? ''` passes an empty string to `supabase.auth.setSession` when refresh token is absent, creating a session that cannot silently refresh — the user is unexpectedly signed out on token expiry (~1 hour) without an explicit sign-out action.

---

### L-2 · `beta-videos` storage bucket not created in migrations — devex-breaking gap on `supabase db reset`

- **File:line:** `supabase/migrations/20260924000005_mod_005_beta_video.sql:17–21`
- **Severity:** LOW
- **Failure scenario:** The `avatars` bucket is created via `INSERT INTO storage.buckets` in the migration. The `beta-videos` bucket is documented as "managed via Supabase Studio / CLI separately." On `supabase db reset` in a fresh dev/staging environment, the `beta-videos` bucket does not exist — all video uploads fail with a storage 404. Any developer onboarding to the project hits this immediately.

---

### L-3 · `get_like_info_batch` RPC is deployed and callable in Phase 1 but documented as dead code (AC-159 defer)

- **File:line:** `supabase/migrations/20261013000004_mod_006_get_like_info_batch.sql:1–43`; `src/modules/mod-social-feed/social-feed-service.ts:402–420`
- **Severity:** LOW
- **Failure scenario:** The RPC is GRANTED to `authenticated` and `fetchLikeInfoBatch()` is exported. The service JSDoc says "FeedScreen.tsx remains dead code per AC-159 — do NOT import or call this function." The RPC is harmless (SECURITY INVOKER, no side effects), but deploying a callable API surface that is documented as off-limits is a feature-scope boundary risk for Phase 2.

---

### L-4 · `RouteSubmitScreen` non-null assertions bypass compiler narrowing post-validation

- **File:line:** `src/modules/mod-route-catalog/screens/RouteSubmitScreen.tsx:253–255`
- **Severity:** LOW
- **Failure scenario:** `const grade = selectedGrade!; const colorTag = selectedColor!; const uri = photoUri!;` appear after a validation block that sets `hasError = true` and returns early if any value is null. The compiler doesn't track the narrowing through the `hasError` flag path. The `!` assertions are safe today but become risk points if the surrounding validation logic is refactored — the compiler stops protecting the caller.
