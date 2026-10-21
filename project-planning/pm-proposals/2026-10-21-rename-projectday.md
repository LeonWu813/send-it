Status: applied 2026-10-21

# PM proposal: rename "Send It" to "ProjectDay 啃線日" (2026-10-21)

Mode: change (proposal pass). Nothing has been written to `prd.md`, to any `status.md` section except Last Action, or to any directory.

This replaces `pm-proposals/2026-10-21-rename-send-train.md`, now marked superseded. Leon's reason: "Send Train" is already used by other websites and services.

## 0. Order: the Phase 1 checkpoint comes first

`pm-proposals/2026-10-21-checkpoint-phase-1.md` is still `Status: pending`. Under PM's mode rules, a checkpoint that is due goes before a change. So the order is: Leon answers the checkpoint proposal, the checkpoint is applied, and then this rename is applied. If Leon wants the rename in Phase 1 instead, see Question 9.

## 1. What the rename touches in the PRD

"Send It" appears in 6 places in `prd.md`, all in descriptive prose. No acceptance criterion, user story, module, data-model entry or convention names the app. So as the PRD stands, the rename changes only prose. It changes behaviour only if Leon wants the name to show up on the device (Question 3).

| # | Line | Section | Current text | Proposed text |
|---|---|---|---|---|
| 1 | 1 | Title | `# Send It — Product Requirements Document` | `# ProjectDay 啃線日 — Product Requirements Document` |
| 2 | 12 | §1 Project Overview | `**Send It** is a Taiwan-first mobile app…` | `**ProjectDay 啃線日** is a Taiwan-first mobile app…` |
| 3 | 16 | §1 Project Overview | `Send It's wedge is a lightweight…` | `ProjectDay's wedge is a lightweight…` |
| 4 | 310 | §5 Architecture Overview | `Send It is a mobile client…` | `ProjectDay is a mobile client…` |
| 5 | 1174 | §14 Competitive Reference | `\| App \| Strength \| Gap vs. Send It \|` | `\| App \| Strength \| Gap vs. ProjectDay \|` |
| 6 | 1183 | §14 Competitive Reference | `**Wedge**: Send It is the first app…` | `**Wedge**: ProjectDay is the first app…` |

Rows 3 to 6 use the short English form "ProjectDay" because it reads better in English prose (the possessive in row 3, for example). Question 1 asks whether Leon wants the full name in every place instead.

Header change (step 9 of change mode):
- `**Status**: [SUBSTANTIVE] — Revision 46` becomes `**Status**: [<TAG from Q7>] — Revision 47`
- `**Date**: 2026-10-20` becomes `**Date**: <apply date>`
- `**Revision**: 46` becomes `**Revision**: 47`

Optional, only if Leon says yes to Question 2: add one sentence at the end of §1 paragraph 1: `The app was previously called "Send It" (renamed in Revision 47).`

Optional, only if Leon says yes to Question 3: a new acceptance criterion. Its module is left open because which module owns the app's display name is a Tech Lead decision. A draft, with the bracketed parts filled in from Leon's answers:

> **AC-199** (new, Rev 47): The app's name shown on the iOS home screen, in the App Store listing, and on [the sign-in screen / other surfaces Leon names] shall be "[name form from Q1/Q3]" when the device language is zh-TW and "[name form]" when it is English. No user-facing text in the app shall still say "Send It". The verb "send" for logging an ascent ("log a send") is not part of the rename and stays as it is.

Not changed: the word "send" for an ascent (US-002, MOD-004 "Send Logging", `mod-send-logging`, "Sendage" in §14), MOD-IDs, AC-IDs, and the Module Map.

Also not changed, but worth noticing: the new name plays on the climbing word "project" (a route you keep working on; 啃線 is the same idea). The PRD already uses that word in two ways: the Home tab's **Projecting Routes** section (MOD-012, AC-177/AC-178), and the **removed** `project` ascent style (§3 Out of Scope, AC-014, AC-065, §9 migration note). The rename does not touch either. Question 6 asks whether Leon wants any copy to tie the name to them.

## 2. Outside the PRD (no PM change, listed so nothing is missed)

- **Code and config**: the Expo `app.json` name, slug and iOS bundle identifier, the `locales/` catalogs, and any hard-coded "Send It" strings. These belong to the engineers (`app.json` is a mod-home project file; `locales/` belongs to mod-localization-theme). They change only through a PRD acceptance criterion and a Doc-Sync run. I cannot read source, so I don't know where the name appears in the code.
- **`production.md` and module specs**: Doc-Sync updates them from this change.
- **`README.md`**: it says "Send It" (title and line 9). I can write README only at the final checkpoint, so it gets the new name when it is produced at the end of the last phase, unless Leon tells the coordinator otherwise (Question 8).
- **`status.md` title line** (`# Send It — Project Status`): not one of PM's sections. I leave it unless Leon asks.
- **Repo folder `send-it/`, git remote, Supabase project name, the PostHog project, Apple Developer and App Store Connect records**: not in the PRD. Most of these are Leon's own accounts, or a Tech Lead question.

## 3. Exact status.md entries on approval (apply pass)

**PM Updates**, appended at the end:

```
- <apply date> [<TRIVIAL|SUBSTANTIVE>]<[ARCHITECTURAL] if Leon says so> Rename app from "Send It" to "ProjectDay 啃線日" (Rev 47)
  - prd.md: title, §1 (x2), §5, §14 (x2) now use the new name<; §1 former-name note added if Q2 yes><; AC-199 added under <MOD> if Q3 yes>
  - Supersedes the unapplied "Send Train 刷線列車" proposal (name already in use elsewhere)
  - Approved by Leon in the coordinator session: "<quote>"
```

**Decisions**, appended (only the items Leon decides that are not PRD content, for example):

```
- <apply date>: App name "Send Train 刷線列車" dropped before applying — the name is already used by other websites/services, per Leon.
- <apply date>: Internal identifiers (repo folder, Expo slug, iOS bundle ID, Supabase project): <keep "send-it" | rename>, per Leon.
```

**Last Action**:

```
agent: pm
mode: change
module: n/a
result: success
next: <[ARCHITECTURAL]: the coordinator runs /pstack:how on the code the rename affects, then claude --agent tech-lead "change review"; otherwise: claude --agent doc-sync>
timestamp: <ISO 8601>
```

**Commit:** `pm(change): rename app to ProjectDay 啃線日 (Rev 47)`

## 4. Questions for Leon

1. **Name form.** Should the PRD use the full "ProjectDay 啃線日" everywhere, or the full name on first mention (title, §1) and "ProjectDay" in the English prose after that, as proposed above? In the app itself, should English users see "ProjectDay", "啃線日" or both, and should zh-TW users see "啃線日", "ProjectDay" or both? Is the spelling exactly "ProjectDay" (one word, capital P and D), not "Project Day" or "projectday"?
2. **Former name.** Should the PRD record that the app used to be called "Send It"? (One sentence in §1. Yes or no.)
3. **Where the name appears on the device.** At the moment the PRD has no requirement for the app's display name. Should the new name appear on the iOS home-screen label, in the App Store listing, on the sign-in or splash screen, as the sender name on push notifications, or anywhere else? If any of these, I'll add AC-199 (draft above). This makes the change substantive and moves it into the code. Note: the iOS home-screen label shows only about 12 characters, and "ProjectDay 啃線日" is 14 (and Chinese characters take up more width). Do you want a shorter home-screen label, for example "ProjectDay" or "啃線日"?
4. **Slug and internal identifiers.** Should the internal identifiers stay as `send-it`: repo folder, Expo slug, iOS bundle identifier, Supabase and PostHog project names? Or should they be renamed (for example to `projectday`)? Changing the iOS bundle identifier after TestFlight builds exist usually means a new App Store Connect app record. That is a Tech Lead question, and I will flag it to them if you want a rename.
5. **Tagline.** The PRD has no tagline. Do you want one (in English and zh-TW)? If so, what is the wording, and where should it appear: App Store subtitle, sign-in screen, or nowhere in the app yet?
6. **Product copy.** Do you know of in-app copy that says "Send It": onboarding, sign-in, empty states, share text, the email digest, notification text? Should any of it be reworded beyond the name swap, for example copy that played on "send it"? The new name is about projecting a route: should any copy connect it to the Home tab's "Projecting Routes" section? (The removed `project` ascent style stays removed either way.) Name the screens and I'll put them in AC-199.
7. **Trivial or substantive? Architectural?** If only the 6 prose lines change (Questions 3 and 5 are "no"), it is wording only, which I'd call **trivial**. If AC-199 or a tagline is added, it is **substantive**. Is it **architectural**, meaning it changes how the system is built? Prose-only is not. A bundle-identifier rename (Question 4) could be, but that is your call.
8. **README.md.** The project README still says "Send It". I can only write README at the final checkpoint. Should it wait until then, or do you want to tell the coordinator to have it updated sooner?
9. **Phase.** Phase 1 is ready to be checkpointed (see the pending checkpoint proposal). Should the rename go in at the start of Phase 2, after the checkpoint (the default)? Or must it ship in the Phase 1 TestFlight or App Store build? If it must ship in Phase 1, we either hold the checkpoint until the rename is synced, built and QA'd, or accept a Phase 1 build still named "Send It".
10. **Phase 2 and 3, and name checks.** Should the same name and form be used for the Android / Play Store listing in Phase 2? Should it be used for gym-facing surfaces in Phase 3 (claim flow, route-setter console)? I'd write these into §7 only if you want the decision recorded now. Since "Send Train" turned out to be taken: have you checked "ProjectDay" and "啃線日" for App Store and Play Store name availability, domain names, social handles and trademark conflicts? (Those checks are yours. I only note them.)
