Status: applied 2026-10-22 (with Leon's answers: AC-090 unchanged, sections 1c and 1f dropped; AC-201 first sign-in only, Google and Apple; AC-202/AC-203 use the setting stored on the device; not architectural)

# PM proposal: Google profile prefill (MOD-001) and signed-out language/theme defaults (MOD-010), Rev 49, 2026-10-22

Mode: change (proposal pass). This pass has not written to `prd.md`, to any `status.md` section except Last Action, or to any directory.

Source: Leon's two findings from the first live Google sign-in test, relayed by the coordinator on 2026-10-22.

## 0. What PM found while reading

1. **Table name.** The request names a `profiles` table. This project has no `profiles` table: the PRD (§9 `User`, AC-156) and MOD-001's Engineering Progress both use `users`. The ACs below say "the user's profile (`users.display_name`, `users.avatar_url`)".
2. **AC-090 says the opposite of Issue 2.** AC-090 today reads: English device → English, **any other language → zh-TW**. US-017, §4 Localization, §6 MOD-010 Purpose, §7 Phase 1 scope and §10 Localization repeat that zh-TW fallback, and MOD-010 QA tested it (Japanese, Spanish, French and Korean devices currently get zh-TW). Leon's rule is: Traditional Chinese device → zh-TW, **any other language → English**. Applying Leon's rule means revising AC-090 and those five passages, not only adding a new AC. Question Q4 asks Leon to confirm.
3. **Theme already follows the device when signed out.** MOD-010's Engineering Progress says `ThemeProvider` resets to `'system'` when no user is signed in, and language/theme settings are stored per user. AC-203 below writes that behavior into the PRD so it is tested. If Leon saw a signed-out screen in the wrong theme, Q7 asks what he saw so the Engineer gets a bug report.
4. **The language-detection code is in MOD-012's folder.** MOD-010 QA records `detectDeviceLanguage()` in `src/lib/i18n.ts`. `src/lib/` is MOD-012's Source Path (Module Map). So the AC-090/AC-202 code change belongs to `engineer-mod-home`, even though the ACs are MOD-010's. PM does not decide that split; Tech Lead does (see Q8).

## 1. PRD change

### 1a. New AC-201 under "MOD-001 (Auth & Profile) Acceptance Criteria" (after AC-167)

> **AC-201** (new, Rev 49, MOD-001): When a user signs in with Google Sign-In, the system shall fill the user's profile `display_name` with the full name Google supplies at sign-in, and the profile `avatar_url` with the profile photo Google supplies, but only for a field that is currently null or empty (blank after trimming). A field that already holds a value is never overwritten, so a display name or avatar the user set through Edit Profile (AC-117) stays as the user left it on every later sign-in. When Google supplies no value for a field, that field is left unchanged. This applies on every Google sign-in, so existing Google accounts whose fields are still empty (for example, accounts created before Rev 49) are filled on their next sign-in. The user can change both values afterwards through Edit Profile (AC-117). Later changes to the user's Google name or photo are not copied into the profile once the field holds a value.

Alternative wording if Leon answers Q1 with "(b) first sign-in only": replace "This applies on every Google sign-in, so existing Google accounts whose fields are still empty (for example, accounts created before Rev 49) are filled on their next sign-in." with "This applies only to the sign-in that creates the account; existing accounts are not changed."

### 1b. US-001 criteria list

`**Acceptance Criteria**: AC-001` becomes `**Acceptance Criteria**: AC-001, AC-201`

### 1c. AC-090 revised (MOD-010)

> **AC-090** (revised, Rev 49): Whenever no language has been chosen in Settings (AC-091), the system shall set the app language from the device's preferred language at app launch: zh-TW when the device language is Traditional Chinese, and English for every other language. Traditional Chinese means any language tag with the `Hant` script (for example `zh-Hant`, `zh-Hant-TW`, `zh-Hant-HK`) or `zh` with region TW, HK or MO. Simplified Chinese (`zh-Hans`, `zh-CN`, `zh-SG`) gets English. This rule is the same whether or not a user is signed in (AC-202). (This supersedes the former rule that every non-English device language falls back to zh-TW.)

### 1d. New AC-202 and AC-203 under "MOD-010 (Localization & Theming) Acceptance Criteria" (after AC-199)

> **AC-202** (new, Rev 49, MOD-010): When no user is signed in (before the first sign-in, and after sign-out), the app shall display in the language AC-090 picks from the device language. A language a user chose in Settings (AC-091) shall not apply after that user signs out; it applies again when that user signs back in on the same device. A signed-in user who has never chosen a language sees the same language as a signed-out user on the same device.

> **AC-203** (new, Rev 49, MOD-010): When no user is signed in (before the first sign-in, and after sign-out), the app shall follow the device's Light/Dark appearance, and shall switch immediately when the device appearance changes while the app is open. A Light or Dark override a user chose in Settings (AC-092) shall not apply after that user signs out; it applies again when that user signs back in on the same device. A signed-in user whose override is System sees the same appearance as a signed-out user on the same device.

### 1e. US-017 and US-018 criteria lists

- US-017: `**Acceptance Criteria**: AC-090, AC-091` becomes `**Acceptance Criteria**: AC-090, AC-091, AC-202`
- US-018: `**Acceptance Criteria**: AC-092` becomes `**Acceptance Criteria**: AC-092, AC-203`

### 1f. Passages that repeat the old zh-TW fallback (only if Q4 = yes)

- US-017 body: "I want the app to default to my device locale (with zh-TW fallback) and let me manually toggle language in Settings," becomes "I want the app to default to my device language (zh-TW on a Traditional Chinese device, English otherwise) and let me manually toggle language in Settings,"
- §4 Tech Stack, Localization row, Notes: "Default: device locale; fallback: zh-TW." becomes "Default: device language — zh-TW for Traditional Chinese, English otherwise (AC-090)."
- §6 MOD-010 Purpose: "device-locale detection with zh-TW fallback" becomes "device-language detection (zh-TW for Traditional Chinese, English otherwise), applied when signed out as well as signed in (AC-202/AC-203)"
- §7 Phase 1 scope summary: "English + zh-TW (device-locale default, zh-TW fallback, Settings toggle)." becomes "English + zh-TW (device-language default — zh-TW for Traditional Chinese, English otherwise — Settings toggle)."
- §10 Localization: "Default language: device locale, with zh-TW fallback for any non-English locale." becomes "Default language: zh-TW when the device language is Traditional Chinese, English otherwise (AC-090); the same default applies when no user is signed in (AC-202)."

### 1g. New Non-Goals (§2), appended after the "Languages other than English and Traditional Chinese" line

- "A language or theme control on the signed-out screens is out of scope for Phase 1 — before sign-in the app follows the device language and appearance (AC-202/AC-203)."
- "Copying later changes to a user's Google name or photo into their profile is out of scope — Google values only fill empty fields (AC-201)."

### 1h. Header

`**Status**: [SUBSTANTIVE] — Revision 48` becomes `**Status**: [SUBSTANTIVE] — Revision 49`; `**Date**: 2026-10-21` becomes `**Date**: 2026-10-22`; `**Revision**: 48` becomes `**Revision**: 49`.

### 1i. Not changed

Modules, Module Map, Source Paths, dependencies, phases, §9 Data Model (no new table or column: `users.display_name` and `users.avatar_url` already exist), AC-001, AC-091, AC-092, AC-117.

## 2. Phase

All three ACs (and the AC-090 revision) are **Phase 1**, per Leon ("part of the iOS MVP launch quality bar"). MOD-001 and MOD-010 are already Phase 1 modules, so the Phase 1 module list and `## Current Phase` do not change.

Effect on the Phase 1 checkpoint: MOD-001 and MOD-010 (and MOD-012, if Tech Lead assigns it the `src/lib/i18n.ts` change) go back through Engineer and QA. The checkpoint, already waiting on INT-029 and INT-021, also waits for those QA passes and for the coordinator's thermos step and Tech Lead's integration review on the new diff.

## 3. Impact assessment

| Area | Change? | Detail |
|---|---|---|
| Module boundaries | No new or moved module | AC-201 is MOD-001's (it owns sign-in and the profile write). AC-202/AC-203 are MOD-010's. But the language-detection code sits in `src/lib/i18n.ts`, inside MOD-012's Source Path, so implementation may cross into MOD-012 (Q8). |
| Data model | No | Uses the existing `users.display_name` and `users.avatar_url`. No migration is required by the PRD; if Tech Lead fills the fields in the database at sign-in, that migration is MOD-001's (`supabase/migrations/*_mod_001_*`). |
| Dependencies | No | MOD-001 already owns Google Sign-In. MOD-010 already depends on nothing new. |
| Integrations | Uses more of an existing one | AC-201 reads the name and photo Google already returns at sign-in. No new provider, scope or SDK expected. |
| Native build | Not expected | `expo-localization` is already installed. No new native dependency. |
| Behavior change for existing users | Yes, for AC-090 | A device in Japanese, Korean, Simplified Chinese or any other non-English, non-Traditional-Chinese language switches from zh-TW to English. Users who chose a language in Settings are not affected. |
| Privacy | Yes, for AC-201 | Profiles are always public (AC-063), so a Google user's real full name and Google photo become visible to every signed-in user unless they edit them (Q3). |

For Tech Lead (PM does not decide these): (1) where the AC-201 fill runs — in the app after sign-in, or in the database when Supabase Auth writes the user (Supabase stores Google's values in `auth.users.raw_user_meta_data` as `full_name` and `avatar_url`); (2) whether `avatar_url` links to Google's photo URL directly or copies the image into the `avatars` bucket (a Google photo URL can stop working if the user changes their Google photo); (3) which module's Engineer changes `src/lib/i18n.ts` (and the theme provider, if it is also outside `mod-localization-theme/`).

## 4. status.md entries the apply pass would write

### PM Updates (appended at the end of the section)

```
- 2026-10-22 [SUBSTANTIVE] AC-201 Google profile prefill (MOD-001); AC-090 revised and AC-202/AC-203 signed-out language and theme defaults (MOD-010) (Rev 49)
  - Source: Leon's first live Google sign-in test. display_name and avatar_url stay NULL after Google sign-in; signed-out screens must follow the device language and appearance.
  - prd.md AC-201 (new, MOD-001): on Google sign-in, fill users.display_name and users.avatar_url from Google's full name and photo, only when the field is null or empty; never overwrite; <every sign-in | first sign-in only, per Q1>. Added to US-001.
  - prd.md AC-090 (revised): device language picks zh-TW for Traditional Chinese (Hant script, or zh-TW/zh-HK/zh-MO), English for every other language; replaces the non-English → zh-TW fallback. Same rule signed in or out.
  - prd.md AC-202 (new, MOD-010): signed-out language follows AC-090; a user's Settings language does not apply after sign-out and returns on sign-in. Added to US-017.
  - prd.md AC-203 (new, MOD-010): signed-out appearance follows the device Light/Dark setting live; a user's Settings override does not apply after sign-out and returns on sign-in. Added to US-018.
  - prd.md US-017, §4 Localization, §6 MOD-010 Purpose, §7 Phase 1 scope, §10 Localization: zh-TW fallback wording replaced with the AC-090 rule.
  - prd.md §2 Non-Goals: no language/theme control on signed-out screens; later Google name/photo changes are not copied.
  - prd.md: Revision 48 → 49, Status "[SUBSTANTIVE] — Revision 49", Date 2026-10-22.
  - Phase 1. No new module, table, column or dependency. MOD-001 and MOD-010 reopen for Engineer and QA.
  - For Tech Lead: where the AC-201 fill runs (app vs database at sign-in; Supabase keeps Google's values in auth.users.raw_user_meta_data full_name/avatar_url); Google photo URL vs copy into the avatars bucket; which module changes src/lib/i18n.ts (MOD-012's Source Path) for AC-090/AC-202.
  - For Doc-Sync: AC-201 into the MOD-001 spec; AC-090 (revised), AC-202, AC-203 into the MOD-010 spec (and into the MOD-012 spec if Tech Lead assigns it the i18n.ts change).
  - Approved by Leon in the coordinator session: "<Leon's exact words>"
```

If Leon tags the change architectural (Q8), the first line becomes `- 2026-10-22 [SUBSTANTIVE] [ARCHITECTURAL] AC-201 ...`.

### Decisions (appended)

```
- 2026-10-22: Google sign-in fills an empty display name and avatar from Google and never overwrites a filled one (AC-201), per Leon.
- 2026-10-22: Default language is zh-TW only on Traditional Chinese devices and English otherwise, signed in or out (AC-090/AC-202), per Leon. This replaces the zh-TW fallback for every non-English device.
- 2026-10-22: AC-201, AC-202, AC-203 and the AC-090 revision ship in Phase 1, before the Phase 1 checkpoint, per Leon.
```

### Last Action (apply pass)

```
agent: pm
mode: change
module: n/a
result: success
next: claude --agent doc-sync   (if Q8 = architectural: the coordinator runs /pstack:how on the Google sign-in profile write in src/modules/mod-auth-profile/ and on src/lib/i18n.ts plus the theme provider, saves it to project-planning/pstack-findings/2026-10-22-how-google-profile-locale.md, then claude --agent tech-lead "change review")
timestamp: <ISO 8601>
```

## 5. Questions for Leon

1. **When does AC-201 fill the fields?** (a) On every Google sign-in, filling only empty fields — your test account and any other existing Google account get filled on their next sign-in (PM's draft). (b) Only on the sign-in that creates the account, as your text said — existing accounts with NULL values stay NULL unless the user edits them. Which one?
2. **Apple Sign-In too?** Apple gives the user's name only on the very first Apple sign-in, and never a photo. Should AC-201 also fill an empty display name from Apple's name, or stay Google-only (PM's draft)?
3. **Privacy.** Profiles are always public (AC-063), so a Google user's real full name and Google photo become visible to every signed-in user until they edit them. Is that acceptable as drafted?
4. **AC-090 reversal.** Today every non-English device gets zh-TW. Your rule gives English to every device that is not Traditional Chinese, so a Japanese, Korean or Simplified Chinese phone switches from zh-TW to English. Confirm you want AC-090 and the five passages in section 1f changed this way? (If no: AC-202 keeps today's zh-TW fallback and section 1f is dropped.)
5. **Which devices count as Traditional Chinese?** PM's draft: any `Hant` script tag, or `zh` with region TW, HK or MO → zh-TW; Simplified Chinese (`zh-Hans`, `zh-CN`, `zh-SG`) → English. Correct?
6. **After sign-out.** The draft says a user's own Settings choices (language and Light/Dark override) stop applying when they sign out, and come back when they sign in again on the same device. Is that what you want, or should the last choice stay on the device after sign-out?
7. **What did you see?** MOD-010's records say the signed-out theme already follows the device. Did a signed-out screen show the wrong theme, the wrong language, or both? Describe what you saw (screen, device language, device appearance) so the Engineer gets a reproducible report.
8. **Trivial or substantive, and architectural?** PM classifies this as **[SUBSTANTIVE]** (new ACs on two modules). Is it **architectural**? PM's note: no table, column, module or dependency changes, but the language code sits in MOD-012's folder and the AC-201 fill could run in the app or in the database. Saying yes runs `/pstack:how` and a Tech Lead change review before Doc-Sync, so the module split is settled before the specs are written. Saying no sends it straight to Doc-Sync, with the "For Tech Lead" notes left for the Engineer's spec questions.
9. **Non-goals.** Add the two Non-Goals in section 1g (no language/theme control on signed-out screens; later Google name/photo changes are not copied)?
