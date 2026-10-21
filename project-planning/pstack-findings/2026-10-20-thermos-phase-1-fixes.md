# Thermos Phase 1 Fixes Review — 2026-10-20

**Scope:** `60aedc19..HEAD` — INT-005/006/009/010/011/012 fix commits (9 commits)
**Reviewers:** thermo-nuclear-review (bugs/security) + thermo-nuclear-code-quality-review (maintainability)
**Total findings:** 5 (1 HIGH · 2 MEDIUM · 1 LOW · 1 pre-existing note)

Both reviewers agree on finding 1. All 6 original blockers are CLEARED as correctly implemented.

---

## CLEARED — Original 6 Blockers

| INT | Finding | Verdict |
|---|---|---|
| INT-005 | Avatar storage policy extension-strip (`split_part`) | ✅ CLEARED — logic correct; UUID never contains dots; multi-ext works |
| INT-006 | API key moved from URL query string to `X-Goog-Api-Key` header | ✅ CLEARED — second fetch (photoUri) correctly omits the key |
| INT-009 | Block filter on `get_profile_history` and `get_profile_stats` | ✅ CLEARED — self-view guard works; privacy gate is preserved; NULL auth.uid() unreachable |
| INT-010 | Block check in `fetchBetaVideosByUser` | ✅ CLEARED — no SQL injection risk (PostgREST eq. is parameterized); correct self-skip |
| INT-011 | Self-block DB constraint + service guard | ✅ CLEARED — complementary layers; constraint is atomic; no race condition |
| INT-012 | 3 barrels created + 20+ import path fixes | ✅ CLEARED — barrels are correct and complete for their modules |

---

## New Findings

---

### F-1 (HIGH) · Test mock paths not updated after barrel migration — 3 test files

**Both reviewers flagged this.**

- **File:line:** `src/modules/mod-social-feed/__tests__/FollowListScreens.test.tsx:12`
- **Also:** `src/modules/mod-social-feed/__tests__/UserProfileScreen.test.tsx:46`
- **Also:** `src/modules/mod-auth-profile/__tests__/ProfileScreen.test.tsx:26` (or `useSession.test.ts:31`)
- **Failure scenario:** Source files were migrated to import from barrels (`'../../mod-moderation'`, `'../../mod-notifications'`). Their test files still call `jest.mock('../../mod-moderation/moderation-service', ...)` on the old private path. Tests pass today because Jest resolves both to the same absolute file, but adding `moduleNameMapper`, `jest.isolateModules`, moving the service file, or any path aliasing will silently break mock interception. Real Supabase client calls will leak into the test environment.
- **Fix:** Update `jest.mock` targets in each test to match the barrel path the source file now uses. Also update the corresponding `import { ... } from` that acquires the mock handle in the test body.
- **Owner:** engineer-mod-social-feed (FollowListScreens.test.tsx, UserProfileScreen.test.tsx); engineer-mod-auth-profile (ProfileScreen.test.tsx or useSession.test.ts)

---

### F-2 (MEDIUM) · `BlockedAccountsScreen.tsx` missed in INT-012 barrel sweep

- **File:line:** `src/modules/mod-localization-theme/screens/BlockedAccountsScreen.tsx:29–33`
- **Failure scenario:** Imports `fetchMyBlockedUsers`, `unblockUser`, and `BlockedUser` directly from `'../../mod-moderation/moderation-service'`. The barrel exists and exports all three. This is a live violation of the module boundary convention INT-012 was designed to close. Not a functional bug now, but diverges from the invariant.
- **Fix:** Change both imports to `'../../mod-moderation'`.
- **Owner:** engineer-mod-localization-theme

---

### F-3 (MEDIUM) · INT-010 raw block SQL is a cross-module ownership violation

- **File:line:** `src/modules/mod-beta-video/beta-video-service.ts:250–261`
- **Failure scenario:** `fetchBetaVideosByUser` queries the `blocks` table directly with a hand-rolled `.or()` predicate duplicating the bidirectional-block semantics already owned by `mod-moderation`. When block logic changes (e.g., soft-blocks in Phase 2, schema rename), there are now two places to update. The mod-moderation barrel already exports `isBlocked(userId): Promise<boolean>` for exactly this purpose.
- **Security note:** No injection risk — PostgREST `eq.` is parameterized. This is an architectural concern.
- **Fix:** Replace the 10-line raw query with `import { isBlocked } from '../../mod-moderation'; if (currentUserId !== userId && await isBlocked(userId)) return [];`
- **Owner:** engineer-mod-beta-video

---

### F-4 (LOW) · `fetchLikeInfoBatch` exported from mod-social-feed barrel despite being Phase 1 dead code

- **File:line:** `src/modules/mod-social-feed/index.ts:26–28`
- **Failure scenario:** The barrel comment says "Not wired in Phase 1." The service JSDoc says "do NOT import or call this function." Exporting it from the public barrel makes it discoverable and importable by any consumer. A future Phase 2 engineer or an autocomplete suggestion could easily call it thinking it is active API.
- **Fix:** Remove the export from the barrel until Phase 2 activates it. Keep the function inside `social-feed-service.ts` but do not re-export.
- **Owner:** engineer-mod-social-feed

---

### Note — Barrel coverage gaps (pre-existing, not introduced by this diff)

The code quality reviewer found these are still unresolved from the original INT-012 scope:
- `src/modules/mod-localization-theme/screens/SettingsScreen.tsx` — imports from `mod-auth-profile` private path
- `src/modules/mod-moderation/screens/OtherUserProfileScreen.tsx` — imports from `mod-profile-history` private path
- No barrel exists for `mod-route-catalog` or `mod-gym-directory`; any consumer of those modules is forced to use private paths

These were not introduced by the current diff. They are existing gaps to address in Phase 2 or a follow-up INT row.

---

## Sign-off Status

The 6 original Phase 1 blockers are resolved and verified correct. The new findings are:
- F-1 (HIGH): test mock fragility — latent, not a production runtime risk
- F-2 (MEDIUM): missed barrel migration file — structural, not a functional bug
- F-3 (MEDIUM): cross-module SQL concern in INT-010 — architectural, not a security issue
- F-4 (LOW): dead-code barrel export — discoverability risk only

**Recommendation:** The Phase 1 integration blockers are resolved. F-1 should be fixed before Phase 1 checkpoint (test fragility); F-2 and F-3 can be fixed in the same pass. F-4 is deferrable. Route to Tech Lead for the final sign-off decision.
