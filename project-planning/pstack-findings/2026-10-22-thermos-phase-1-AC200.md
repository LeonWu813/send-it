# pstack:thermos — AC-200 Rename Delta — Phase 1 Pre-Checkpoint

**Date**: 2026-10-22  
**Scope**: AC-200 rename delta, commits from `ff0481d^` to `180eb1f`  
**Trigger**: QA pass on the last module of Phase 1 (MOD-012, AC-200 fully verified)  
**Reviewers**: thermo-nuclear-review-subagent + thermo-nuclear-code-quality-review-subagent (parallel)  
**Previous thermos**: `2026-10-20-thermos-phase-1.md` — covered full phase; all 19 findings addressed (INT-005–INT-012 all CLEARED)

---

## Verdict

**CONDITIONAL APPROVE.** No CRITICAL or HIGH bugs introduced by the rename. One HIGH maintenance concern (both reviewers agree) requires a human gate before setup.md 11.5. Two MEDIUM items are pre-existing deployment prerequisites documented in setup.md. All LOW findings are benign normalizations.

---

## Findings

### F-1 — HIGH: `app.plugin.js:37` — `aps-environment` strip has no automated removal guard

**File**: `app.plugin.js`, line 37  
**Both reviewers flagged this.**

```js
delete c.modResults['aps-environment'];
```

This line was correctly added to unblock simulator builds while setup.md 11.5 (provisioning Push Notifications capability in the Apple Developer portal) is incomplete. The danger: when 11.5 IS completed, if `expo prebuild --clean` is run before removing this line, the production binary will ship without the `aps-environment` entitlement. APNs silently rejects the token — no push notifications are delivered in any TestFlight or App Store build. The `useSession.ts:96–100` catch block swallows `getExpoPushTokenAsync()` errors, so nothing surfaces to the user either.

The comment at lines 14–22 documents the restore steps, but there is no automated guard.

**Recommendation (for Tech Lead):**
1. Add `// TODO(setup.md 11.5): remove this line after provisioning Push Notifications capability` inline at line 37 so `git grep TODO` finds it.
2. Add an explicit checklist item to setup.md 11.5: "Remove the `aps-environment` delete line from `app.plugin.js:37` BEFORE running `expo prebuild --clean`."

---

### F-2 — MEDIUM: Supabase redirect URL — `projectday://**` must be confirmed; `send-it://**` is now stale

**File**: `src/modules/mod-auth-profile/auth-service.ts`, line 142  
**Branch-audit reviewer.**

`makeRedirectUri({ scheme: 'projectday' })` generates `projectday://...` as the OAuth redirect URI. If `projectday://**` is not in Supabase Authentication → URL Configuration → Redirect URLs, Google sign-in silently fails (Supabase redirects to Site URL instead of back to the app).

Additionally, setup.md 11.1 notes to keep `send-it://**` in the allowlist "for debug builds." That note is now stale — all code in the AC-200 delta generates `projectday://...`; the old scheme is no longer used. The `send-it://**` entry is harmless to leave but can be removed immediately.

**Recommendation (informational — setup.md already documents 11.1):**
- Confirm `projectday://**` is added to Supabase redirect URLs before testing Google sign-in.
- Mark setup.md 11.1 step 2 ("Remove `send-it://**`") as ready to execute.

---

### F-3 — LOW: Dual URL schemes in `Info.plist` — expected expo prebuild behavior

**File**: `ios/ProjectDay/Info.plist`, lines 31–35  
**Both reviewers — no action required.**

`CFBundleURLSchemes` now contains both `projectday` and `com.projectday.bouldering`. This is the expected output of `expo prebuild` when both `"scheme": "projectday"` and `"ios.bundleIdentifier": "com.projectday.bouldering"` are in `app.json`. Auth redirect uses only `projectday://`. No security concern; entitlements file is empty (no associated-domains). Benign.

---

### F-4 — LOW: `expo-image.disable-libdav1d: "false"` is an explicit default

**File**: `ios/Podfile.properties.json`, line 6  
**Both reviewers — no action required.**

`expo-image` reads this as `disable_libdav1d = (value == 'true')`. Setting `"false"` explicitly is identical to omitting the key. libdav1d (AV1 decoder) is already linked in the current Podfile.lock. No behavior change.

---

### F-5 — LOW: `SUPPORTED_PLATFORMS` / `SUPPORTS_MACCATALYST` / `SUPPORTS_XR_DESIGNED_FOR_IPHONE_IPAD` removed from xcodeproj

**File**: `ios/ProjectDay.xcodeproj/project.pbxproj`  
**Branch-audit reviewer — no action required.**

These keys were removed by `expo prebuild --clean` as part of the newer Expo pbxproj template normalization. Xcode defaults: `SUPPORTED_PLATFORMS = "iphoneos iphonesimulator"`, `SUPPORTS_MACCATALYST = NO`, `SUPPORTS_XR_DESIGNED_FOR_IPHONE_IPAD = NO`. No build or runtime impact.

---

## Non-Findings (verified clean)

- `auth-service.ts:142` scheme `'projectday'` — matches `app.json`, `Info.plist`, and test mock. Correct.
- `app.json` `projectId` — valid UUID, replacing old non-UUID slug.
- SQL migration `20261021175314` — `replace(...) WHERE LIKE '%Send It%'` is safe and idempotent.
- `send-it-design` path token in `src/lib/theme.ts:18` — intentionally kept per AC-200 exemption (b).
- `SWIFT_OBJC_BRIDGING_HEADER` — file verified at `ios/ProjectDay/ProjectDay-Bridging-Header.h`.
- `ACCESSORY_ID` in `Stepper.tsx` — local keyboard toolbar ID, no cross-file consumers.
- `DevelopmentTeam = MS38U28QL6` in xcodeproj — standard Xcode automatic signing practice.
- `CODE_SIGN_IDENTITY` target vs project level — target-level `"Apple Development"` wins over pre-existing project-level `"iPhone Developer"`. Correct.
- Seed migration `20260920000002` still contains "Send It" — historical migration, never edited by convention. Forward-patch migration `20261021175314` corrects data at apply time.

---

## Routing

Tech Lead: review F-1 (HIGH) and determine whether the recommended TODO comment + setup.md 11.5 checklist item should be applied before the Phase 1 checkpoint. F-2 is informational only — setup.md already documents 11.1. F-3 through F-5 require no action.
