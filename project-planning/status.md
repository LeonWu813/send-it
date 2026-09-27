# Send It — Project Status

## Last Action

```
agent: qa-mod-send-logging
mode: regression
module: mod-send-logging
result: bugs-found
commit: d39fb326e0c686d8adaaa01666602b234f2e82f9
timestamp: 2026-09-27T00:00:00Z
```

## PM Updates

- **2026-09-27 [TRIVIAL]** — AC-035 `.mov` container ruling: accept `.mov` alongside `.mp4` (PRD Revision 12). QA raised a valid UX concern — iOS camera records natively in `.mov` (QuickTime), and the prior MP4-only rule (engineer rejected `.mov` in commit bdccdab) forced users to convert iPhone-camera climbing footage before upload, blocking the primary MOD-005 capture loop. **PM ruling: ALLOW both `.mov` and `.mp4`.** Rationale: (1) iOS `.mov` is H.264/HEVC — the same codec family already accepted for `.mp4`; Supabase Storage stores both and `expo-video` plays both on iOS, so no transcoding is needed; (2) accepting `.mov` removes friction for the primary use case (iPhone camera footage of routes); (3) the original MP4-only choice was standardization, which does not outweigh blocking the core capture path on an iOS-only Phase 1; (4) all safety constraints stay — ≤60s duration (AC-030), codec = H.264/HEVC video + AAC audio, and size limits are container-independent and remain enforced. **PRD edits**: AC-035 (§8) marked (revised) — now accepts MP4 (`.mp4`) or QuickTime (`.mov`) containers, rejects on ingest only when video codec is not H.264/HEVC or audio codec is not AAC, stores both as-is (no server-side transcoding), duration/size caps apply regardless of container; AC-031 (§8) compression-output sentence updated to H.264/HEVC + AAC in `.mp4` or `.mov` (cross-refs AC-035); §10 NFR Video line updated with the accepted-container clause (both stored as-is, iPhone `.mov` uploads without conversion). Status line `[TRIVIAL] — Revision 12`; `**Revision**` bumped 11 → 12. **Tagged [TRIVIAL]**: constraint relaxation on existing ACs only — no new user story, module, or AC; no data-model change; module boundaries, dependencies, and the phase plan are all unchanged; no new modules. **Affected spec for Doc-Sync**: MOD-005 (mod-beta-video) — carry the revised AC-035 (both containers, codec-based rejection) and the updated AC-031 compression clause into the spec's Acceptance Criteria Covered and Key Implementation Notes; the spec's MP4-only / `.mov`-rejection wording must be updated to the two-container rule. PM did not edit `production.md` or any module spec — this tag is the Doc-Sync trigger. **Note for Engineer (not part of this spec ruling, for the coordinator to route after Doc-Sync)**: this reverses the prior `.mov` rejection — `validateVideoFormat()` in `BetaVideoUploader` must accept `.mov` again, and the error copy ("Only MP4 videos are supported" in `en` + zh-TW catalogs) must be updated to reflect MP4/MOV acceptance. Doc-Sync NOT invoked here.

- **2026-09-25 [TRIVIAL]** — Two project-wide native-dependency engineering conventions added (PRD Revision 11). Proposed by Tech Lead in the 2026-09-25 build-failure review (iOS build blocker: `expo-av@15.0.2` (SDK 52-era) was installed with `npm install` under Expo SDK 57, so `ExpoModulesCore/EXEventEmitter.h` was not found; the mismatch passed Jest via the `expo-av` mock but failed the native build, and MOD-005 had been marked QA-ready without a native build ever being run). Two conventions logged as project-wide engineering standards in §10 NFR:
  1. **Native dependency installation** — all Expo native dependencies must be installed via `npx expo install <package>`, never `npm install <package>`; Expo resolves the SDK-compatible version automatically, whereas `npm install` can silently install an SDK-incompatible version that passes Jest (via mocks) but fails the native build. Hand-pinning a native module's version string in `package.json` is prohibited.
  2. **Native build gate before QA handoff** — when a module adds or changes a native dependency (a package with iOS/Android native code), the engineer must run the native build (`npx expo run:ios`, or the platform equivalent) and confirm it compiles before marking the module QA-ready; passing unit tests alone are insufficient because Jest mocks native modules.
  - **PRD edits**: §10 Non-Functional Requirements — two new bullets inserted after the Security bullet, before Soft-launch timeframe. Status line `[TRIVIAL] — Revision 11`; `**Revision**` bumped 10 → 11.
  - **Tagged [TRIVIAL]**: process/tooling engineering standards only — no user story, module, or acceptance criterion added; no data-model change; module boundaries, dependencies, and the phase plan are all unchanged; no new modules.
  - **For Doc-Sync**: carry both conventions into `production.md` Shared Conventions (these mirror the Tech Lead's "Proposed Shared Conventions" in the 2026-09-25 review under `## Tech Lead Reviews`). PM did not edit `production.md` — this PM Updates tag is the trigger for Doc-Sync to sync them in. No module spec changes required (project-wide conventions live in production.md, not a single module spec).

- **2026-09-24 [TRIVIAL]** — AC-031 thumbnail-scope ruling (PRD Revision 10). QA (qa-mod-beta-video, commit bcf7082) flagged AC-031 as a spec issue, not a bug: the MOD-005 engineer shipped a Phase 1 simplification (`localThumbnailUri = asset.uri` in `BetaVideoUploader.tsx` line 157) that uploads the video URI as the thumbnail placeholder rather than an extracted still frame, and asked PM to rule whether client-side frame extraction is required in Phase 1 or deferrable. **PM ruling: acceptable Phase 1 simplification — frame extraction deferred to Phase 2.** Rationale: (1) true client-side frame extraction requires a new native dependency (`expo-video-thumbnails` / `ffmpeg-kit-react-native`), neither installed — adding a native module is a scope/dependency decision, and AC-031 never named a specific extraction library; (2) the Phase 1 loop is not blocked — upload/playback (AC-032/033/034) works and `thumbnail_url` is populated with a valid, retrievable URL; the harm is a heavier preview and no still frame, a quality issue not a broken loop; (3) it fits the established Phase 1 simplification pattern (auto-approve default, Studio-only admin, no offline queue, Cloudflare deferred). PRD edits: AC-031 (§8) marked (revised) with an explicit "Phase 1 simplification" clause (thumbnail may use the video URI as a placeholder; true frame extraction e.g. a frame at 1 second is Phase 2; `BetaVideo.thumbnail_url` must still be a valid retrievable URL in Phase 1); §10 NFR Video line clarified with the same placeholder note; §7 Phase 2 module TBD list and §13 roadmap Phase 2 both += "beta-video thumbnail frame extraction (Phase 1 uses a placeholder thumbnail)." PRD Status line `[TRIVIAL] — Revision 10`; `**Revision**` bumped 9 → 10. **Tagged [TRIVIAL]**: scoping/wording only — module boundaries (MOD-005 still owns capture/compression/thumbnail/upload/playback), dependencies, and the phase plan are unchanged; no new modules; no AC removed; the AC still requires a client-generated thumbnail. **Affected spec for Doc-Sync passthrough**: MOD-005 (mod-beta-video) — carry the revised AC-031 Phase 1 clause into the spec's Acceptance Criteria Covered and Key Implementation Notes (the spec's line 113 "frame extracted at 1 second" note should be annotated as Phase 2). **Note for Engineer/Tech Lead (not part of this spec ruling)**: QA also observed the placeholder upload uses `contentType: 'image/jpeg'` while the stored bytes are a video file (`beta-video-service.ts`). Fixing the content-type/URI of the placeholder is an implementation-quality decision for engineer-mod-beta-video (with Tech Lead input if a dependency is added), independent of this scope ruling; this ruling only settles that a placeholder is acceptable for Phase 1. The separately-flagged AC-035 `.mov` bug was already fixed by Engineer in commit c014a14 and is out of scope for this ruling.

- **2026-09-24 [SUBSTANTIVE]** — Four product refinements (PRD Revision 9). Leon (via coordinator) approved proceeding directly; both open questions answered (Q1: remove `project` ascent style from both UI and DB enum, historical `project` maps to `attempt`; Q2 option (c): saved routes surface only in the browse flow — bookmark on RouteDetailScreen + read-only indicator on RouteListScreen, no dedicated Profile/Home surface). PRD Status line `[SUBSTANTIVE] — Revision 9`; `**Revision**` bumped 8 → 9. Changes:
  - **Item 1 — Route name format (AC-045, new, MOD-003).** A route's display name is composed automatically from grade + hold color as "`<grade> <Color>`" (e.g. "V3 Blue"), with the section label appended in parentheses when present (e.g. "V3 Blue (Cave)"). Not a stored/user-editable field — derived at display time from `grade` + `color_tag` (+ `section_label`); no free-text route-name input. Used consistently on the gym route list, route detail header, and any surfaced route reference. Non-goal added ("user-editable free-text route name out of scope"); §9 Data Model note added (display name not a stored column); §12 risk (tape-color reuse) extended to note same-name collisions disambiguated by `section_label`. US-003 and US-006 AC lists += AC-045. AC-042 updated to reference AC-046 (save from detail).
  - **Item 2 — Remove `project` ascent style (AC-014, new, MOD-004).** Ascent style restricted to the three-value set {flash, top, attempt}; `project` removed from the UI and from the `ascent_style` DB enum. §9 Data Model: `Ascent.style` enum changed `flash | top | attempt | project` → `flash | top | attempt`; added an explicit migration note — **PostgreSQL cannot drop an enum value directly**, so the migration must (1) create a new `ascent_style` enum without `project`, (2) backfill existing `project` rows to `attempt`, (3) swap the `ascents.style` column type and drop the old enum. **Flagged as requiring Tech Lead architecture review before Doc-Sync/Engineering implements it** (safe migration ordering, PG15 enum create/use/drop sequencing, consistent with the project's two-file enum-migration convention). §12 risk added for enum migration safety. Non-goal added. US-002 AC list += AC-014.
  - **Item 3 — Achievement icons (AC-065, new, MOD-008).** The send history displays a per-send achievement icon mapped from ascent style: Flash=`flash` (⚡), Send=`top` (send/top-out icon), Project/Tried=`attempt` (🎯). The former 🎯 "project" achievement now maps to the `attempt` style (per AC-014). Icon set covers exactly the three styles. MOD-008 purpose updated; US-011 body + AC list += AC-065.
  - **Item 4 — Saved routes / bookmark (US-021 new; AC-046, AC-047 new, MOD-003).** New US-021 "Bookmark a route while browsing." AC-046: bookmark toggle on RouteDetailScreen (optimistic update; the only save/unsave action point for routes). AC-047: read-only saved indicator on RouteListScreen entries (no save/unsave on tap; tap navigates to detail per AC-042); explicitly no saved-routes list on Profile/Home in Phase 1 (Q2 = c). §9 Data Model: new `SavedRoute(user_id FK ON DELETE CASCADE, route_id FK ON DELETE CASCADE, created_at, PK(user_id, route_id))` join table — **flagged as a new table requiring Tech Lead architecture review** (placement/ownership, RLS policy set, grants), to mirror the confirmed `saved_gyms` design (composite PK, dual `ON DELETE CASCADE`, own-rows-only SELECT/INSERT/DELETE RLS, no UPDATE, explicit grants). §10 NFR: added saved_routes RLS requirement (own rows only) + browse-flow-only surfacing note. Non-goal added (no dedicated saved-routes surface in Phase 1). MOD-003 purpose + dependencies unchanged (MOD-003 already depends on MOD-001/MOD-002); MOD-003 US list += US-021. Phase 2 roadmap/module note += "dedicated saved-routes list surface."
  - **Impact**: no new modules; module boundaries and the phase plan are unchanged. Data model changed — **two items require Tech Lead architecture review before implementation**: (a) the `ascent_style` enum removal migration (Item 2), and (b) the new `saved_routes` table + RLS + grants (Item 4). Affected specs for Doc-Sync: MOD-003 (mod-route-catalog — AC-045, AC-046, AC-047, purpose, AC-042 cross-ref), MOD-004 (mod-send-logging — AC-014, purpose), MOD-008 (mod-profile-history — AC-065, purpose), and production.md (route display-name convention, ascent-style enum, saved_routes table). Tagged [SUBSTANTIVE] because it adds ACs, a US, and a data-model table, and removes an enum value. **Recommend running `claude --agent tech-lead` first** for the enum-removal migration and the saved_routes table, then Doc-Sync. Doc-Sync NOT invoked here.

- **2026-09-24 [TRIVIAL]** — AC-114 wording aligned with Phase 1 tab-switch scope. AC-114 changed from "navigate to that gym's detail screen (MOD-002)" to "navigate to the Gyms tab (Phase 1: switches to the Gyms tab; deep-link to a specific gym's detail screen is a future enhancement)." Wording-only change: module boundaries (MOD-012 owns the Home strip, MOD-002 owns gym detail), dependencies, and the phase plan are unchanged; no new modules. PRD Revision bumped 7 → 8, Status line tagged [TRIVIAL]. Affected spec for Doc-Sync passthrough: MOD-012 (mod-home).

- **2026-09-24 [SUBSTANTIVE]** — Tab shell + Home screen + Profile screen + saved-gyms data model (PRD Revision 7). Leon's decisions all finalized; PRD updated to Revision 7 [SUBSTANTIVE]. Summary of changes:
  - **Status line / Revision** bumped 6 → 7.
  - **§1 Overview** — now describes the persistent three-tab bottom shell (Home / Gyms / Profile) and the multi-gym saved list replacing the single home-gym concept.
  - **§5 Architecture** — single-navigator shell replaced with the three-tab shell: Tab 1 (Home) hosts MOD-012, Tab 2 (Gyms) hosts the existing gym navigation stack (MOD-002 + MOD-003 beneath), Tab 3 (Profile) hosts MOD-001 profile surface + MOD-008 send history. Flagged the tab shell as an app-level architecture concern requiring **Tech Lead review** for mount point and module boundary decisions.
  - **§9 Data Model** — removed `home_gym_id` from the User entity; added new `SavedGym(user_id FK ON DELETE CASCADE, gym_id FK ON DELETE CASCADE, created_at, PK(user_id, gym_id))` join table; added RLS note (user reads/writes only their own rows).
  - **§6 Module Breakdown** — MOD-001 purpose updated (Profile surface: name/avatar/bio, Edit Profile, embedded send history, Logout; no home gym); MOD-002 purpose updated (read-only saved indicator on list, interactive bookmark toggle on detail); **new MOD-012 "Home"** added (dir `mod-home`; deps MOD-001, MOD-002, MOD-006).
  - **§8 Acceptance Criteria**:
    - MOD-001: removed AC-001 (home-gym first-run), AC-002 (home-gym select), AC-003 (signup+home-gym timing); AC-001 rewritten (first run → Home, no gym selection); AC-063 unchanged; added AC-116 (profile shows name/avatar/bio), AC-117 (Edit Profile: name/avatar/bio/privacy), AC-118 (embed send history), AC-119 (Logout control).
    - MOD-002: added AC-120 (detail bookmark toggle saved=filled-yellow / unsaved=gray), AC-121 (tap toggles saved_gyms, optimistic update, only save/unsave point), AC-122 (list shows read-only filled-yellow indicator on saved cards, nothing on unsaved, no tap action).
    - MOD-003: added AC-044 (RouteDetailScreen does not display submitter "由誰新增"; `submitted_by_user_id` retained for RLS/constraints only).
    - **New MOD-012 section**: AC-110 (3 icon-only tabs, Home default after login), AC-111 (Home sections order: Banners, Saved Gyms, Following Climbers), AC-112 (≤3 static hardcoded banners, hidden if none), AC-113 (saved-gyms strip using gym.photo_url + name, View All → gym list), AC-114 (tap gym → detail), AC-115 (empty prompt "Tap the bookmark on any gym to save it"), AC-123 (following-climbers strip avatar+name, tap → profile), AC-124 (empty state when following no one).
  - **§10 NFR** — added saved_gyms RLS requirement (authenticated users read/write only their own rows).
  - **User Stories** — US-001 rewritten (removed home-gym selection; first run → Home; now cites AC-001 only); added US-019 (save multiple gyms) and US-020 (Home screen with saved gyms + followed climbers). US-011 also mapped to MOD-001 (profile embeds send history).
  - **Banners** are static/hardcoded in-app (no new table). AC-100 analytics event "home gym set" → "gym saved"; §2 Goal "set a home gym" → "save a gym".
  - **Impact**: **new module MOD-012 (mod-home)** added to Phase 1 module list; module boundaries and dependencies changed (MOD-012 new; MOD-001/MOD-002 scope expanded). Data model changed (SavedGym added, home_gym_id removed) — requires new migration + RLS. The three-tab shell is an app-level architecture concern. **Requires Tech Lead architecture review** (tab shell mount points, module boundaries, saved_gyms table/RLS), then Doc-Sync to create the MOD-012 spec + engineer/QA agents and delta-sync MOD-001/MOD-002/MOD-003 specs + production.md. Tagged [SUBSTANTIVE]. Module Map updated below (MOD-012 → mod-home). Doc-Sync NOT invoked here (per coordinator direction).

- **2026-09-23 [SUBSTANTIVE]** — Route submission UX simplified: single-page submit, client-side match-check removed (PRD Revision 6). Leon (via coordinator) approved the change; AC-022 and AC-023 confirmed unchanged; RouteListScreen CTA label "Can't find it? Add a new route." stays as-is (only the submit-screen button becomes "Add Route"). Rationale: the RouteListScreen grade + color filter already serves as the "does this route exist?" check, so the separate client-side match-check step is redundant. Server-side duplicate protection is unchanged (the `submit_route` RPC pre-check + the partial unique index on active routes; the per-submitter pending unique index still guards AC-029). PRD updated:
  - **Status line**: `[SUBSTANTIVE] — Revision 6`; `**Revision**` bumped 5 → 6.
  - **AC-020 (revised, MOD-003)** — rewritten from the client-side match-check UI ("query existing routes ... present any matches before allowing creation") to a single-page submit screen: grade chips, hold-color chips, inline photo picker (preview on the same page), optional section-label field, and an "Add Route" button that submits directly via the `submit_route` RPC. No client-side match-check step, no multi-step flow. Server-side uniqueness (RPC pre-check + `UNIQUE (gym_id, grade, color_tag) WHERE status = 'active'` partial index + per-submitter pending index) is called out as unchanged.
  - **AC-021 (revised, MOD-003)** — reworded to reference the inline photo picker on the single page; photo-required validation now stated as enforced both client-side and server-side (in the `submit_route` RPC).
  - **AC-043 (new, MOD-003)** — pre-fill the submit screen's grade + color chips from the RouteListScreen filter state; RouteListScreen passes its current grade/color filter values as optional params; unset filter → chip opens unselected; pre-filled chips remain editable.
  - **US-003** — retitled "Submit a new route" (dropped "with match-before-create"); story body + narrative rewritten to the filter-first, single-page, direct-submit flow (no separate match-check step); AC list updated to AC-020, AC-021, AC-022, AC-023, AC-043.
  - **§1 Overview** — wedge sentence changed from "match-before-create route submission flow" to "filter-first route submission flow with server-enforced duplicate protection."
  - **§10 NFR (Data quality — routes)** — primary duplicate defense reframed from "match-before-create flow (§8 AC-020)" to the server-side guard (`submit_route` RPC pre-check + partial unique index on active routes); RouteListScreen filter noted as the find-before-add mechanism.
  - **AC changes summary**: AC-020 changed (rewritten), AC-021 changed (reworded), AC-043 added. No AC removed as a standalone numbered item — the client-side match-check flow lived inside AC-020 and the US-003 narrative, both rewritten; no separate "existing routes found" / "Yes this is it" / "Add as new" numbered AC existed. AC-022, AC-023 unchanged; AC-024b–AC-029, AC-040–AC-042 unchanged.
  - **Impact**: module boundaries, dependencies, and phase plan unchanged; no new modules. Server-side duplicate machinery (RPC, indexes, RLS) is untouched — this is a client-side UX change only. Affected spec for Doc-Sync delta: **MOD-003 (mod-route-catalog)** only. Tagged [SUBSTANTIVE] because it removes/rewrites ACs and changes the submit-flow UX. No source code changed. Doc-Sync NOT invoked (per coordinator direction) — will be triggered separately.

- **2026-09-22 [SUBSTANTIVE]** — Cross-module navigation ACs + navigation-gap audit (PRD Revision 5). Leon approved the change and all three decisions (add as formal PRD change; AC lives under MOD-002 Gym Directory; "View Routes" entry point at the **bottom** of the gym detail screen). PRD updated:
  - **Status line**: `[SUBSTANTIVE] — Revision 5`; `**Revision**` bumped 4 → 5.
  - **AC-005 (new, MOD-002)** — approved wording: a "View Routes" entry point at the **bottom** of the gym detail screen navigates to that gym's route catalog, passing gym ID + gym name; visible without additional action.
  - **Navigation-gap audit — complete.** Audited every cross-module navigation/integration point implied by the user stories against §6 module dependencies. Already-covered handoffs confirmed: signup → home gym selection (AC-001/AC-002); route detail → log send (AC-010 names the route→log entry point); report/block targets named in AC-080/AC-082. Additional gaps found and closed with new ACs (each placed under the module that owns the destination entry point, per single-ownership):
    - **AC-006 (new, MOD-002)** — gym directory list row → gym detail screen (tap a gym row to open its detail; passes gym identifier). AC-004 rendered the list but no AC specced opening a gym.
    - **AC-042 (new, MOD-003)** — gym route list entry → route detail screen (tap a route to open its detail; passes route ID). Route detail is the entry point for AC-010/AC-037/AC-033; AC-040/AC-041 filtered the list but no AC specced opening a route.
    - **AC-037 (new, MOD-005)** — "Add beta video" entry point on the route detail screen launches the beta capture/upload flow with route context pre-attached (binds upload to that route per AC-032). US-004 implied it; AC-033 only covered playback.
    - **AC-058 (new, MOD-007)** — in-app notification inbox entry (beta-video-like) → the liked beta video on its route detail (resolves `target_id`). US-009 + AC-057 created the inbox but no AC specced the tap-through.
    - **AC-064 (new, MOD-008)** — feed/user reference → that user's profile + send history, subject to privacy (AC-063): a `followers_only` profile requested by a non-follower shows the hidden/403 state. US-007/US-011 implied it; no AC specced the profile navigation entry point.
  - **User story criteria lists updated**: US-004 += AC-037; US-006 += AC-005, AC-006, AC-042; US-009 += AC-058; US-011 += AC-064. All cited AC IDs verified to resolve to definitions in §8 (zero missing).
  - **Impact**: module boundaries, dependencies, and phase plan unchanged; no new modules. Affected specs (for Doc-Sync delta): MOD-002 (AC-005, AC-006), MOD-003 (AC-042), MOD-005 (AC-037), MOD-007 (AC-058), MOD-008 (AC-064). Tagged [SUBSTANTIVE] because scope of covered behavior expands across five modules. Ready for Tech Lead confirmation of module ownership (AC-005/006 under MOD-002 per Leon's decision; the four audit ACs placed by destination-entry-point ownership), then Doc-Sync to update the five module specs.

- **2026-09-23 [SUBSTANTIVE]** — Route submission approval gate + status lifecycle (PRD Revision 4). Leon's decisions all locked; PRD updated:
  - **Status line**: `[SUBSTANTIVE] — Revision 4`; `**Revision**` bumped 3 → 4.
  - **US-003** rewritten: grade + hold-color filter chips only (no text search); always-visible "Can't find it? Add a new route" CTA; match-before-create against `active` routes still happens.
  - **US-014 removed**: user-actionable route retirement is gone; retirement is now admin-only via Supabase Studio.
  - **MOD-003 breakdown** updated: purpose now covers the 4-value status lifecycle, submitter-only pending visibility/withdrawal; US list drops US-014.
  - **Acceptance Criteria (MOD-003)**: AC-020 revised (match pool scoped to `active` only); AC-024 removed (user retire gone); AC-024b new (admin-only `retired` via Studio); AC-025 new (initial status active if auto-approve ON else pending; approval message flagged [I18N-PENDING] for zh-TW); AC-026 new (pending visible only to submitter, read-only); AC-027 new (admin approve→active / reject→rejected via Studio only); AC-028 new (rejected/retired never shown to normal users); AC-029 new (submitter withdraw = row deleted; no two pending for same gym+grade+color); AC-040 revised (grade + hold-color chip filters, no text search, no status filter for normal users); AC-041 revised (normal users see active only, no status tag/filter).
  - **Non-goals**: added — in-app admin UI for route status management is Phase 1.5; Supabase Studio is the Phase 1 admin surface.
  - **§9 Data Model**: `Route.status` enum updated to the 4-value `route_status` set (active | pending | retired | rejected) with per-value semantics; auto-approve defaults ON at Phase 1 launch.
  - **§5 Architecture**: RLS/admin-operations framing aligned to the gate (pending visible to submitter only; status transitions to retired/rejected and pending approval are admin-only via Studio).
  - **Decisions locked**: D-RETIRE (merge retired+archive → keep `retired`, admin-only), D-SUBMIT, D-ADMIN-SURFACE (Studio-only Phase 1; schema must support in-app admin in Phase 1.5 — Tech Lead constraint), D1 (pending visibility + withdrawal-by-delete + one-pending-per-combo), D-AUTO-DEFAULT (auto-approve ON at launch), D-I18N ([I18N-PENDING] for the approval message).
  - **Impact**: module boundaries and phase plan unchanged; MOD-003 spec, data model, RLS policies, and enum are affected. Requires Tech Lead architecture review (schema/RLS/enum/settings-table + Phase 1.5 in-app-admin forward-compat constraint), then Doc-Sync to update the MOD-003 spec. PRD updated to Revision 4 [SUBSTANTIVE], ready for Tech Lead architecture review and then Doc-Sync.

- **2026-09-21 [SUBSTANTIVE]** — Two spec clarifications added to the PRD (Revision 3):
  - **AC-013 (MOD-004 Send Logging)**: After a send is successfully logged, the ascent list on the route detail screen must refresh immediately to show the new entry without requiring re-navigation. Addresses the known stale-list-after-modal-submission pattern (see Skill Recommendations).
  - **AC-036 (MOD-005 Beta Video)**: While a beta video is uploading, a progress overlay showing upload progress (0–100%) must be displayed. The overlay blocks further interaction until upload completes or fails, preventing double-submission.
  - Module boundaries, dependencies, and the phase plan are unchanged. No new modules added. Impact is confined to MOD-004 and MOD-005 specs; Doc-Sync must sync both.

## Tech Lead Review — Navigation AC Ownership (2026-09-23)

**Context**: PRD Revision 5 [SUBSTANTIVE] adds six cross-module navigation ACs via the PM's navigation-gap audit. This is an ownership confirmation only — not an architecture review. I verified each AC's placement against §6 module boundaries and inspected the shipped screens/navigators to classify each as a code gap (needs engineering) vs. a doc gap (code already works, spec didn't say so). Advisory only; no source, migration, spec, or PRD files changed.

| AC | Ownership confirmed | Code gap or doc gap | Notes |
|----|--------------------|--------------------|-------|
| AC-005 | **Confirmed — MOD-002** (destination entry point lives on `GymDetailScreen`) | **Code gap** | `GymDetailScreen.tsx` has only an `onBack` prop — no "View Routes" affordance exists. More important: `RouteNavigator` is fully built and self-contained (takes `gymId`+`gymName`, wires RouteList→RouteDetail) but is **never mounted anywhere** — nothing imports it outside its own file, and `App.tsx` renders `GymNavigator` with no route flow beneath it. So AC-005 is not just "add a button": MOD-002's engineer must add an `onViewRoutes(gymId, gymName)` prop to `GymDetailScreen`, `GymNavigator` must gain a `routes` view state that mounts `RouteNavigator`, passing gym context. **This is the one AC that actually connects MOD-002 → MOD-003 at runtime; without it MOD-003's entire UI is currently unreachable.** Boundary note: the button + navigator mount are MOD-002-owned; `RouteNavigator` itself is MOD-003 and already accepts the required props, so no MOD-003 code change is needed for AC-005. |
| AC-006 | **Confirmed — MOD-002** | **Doc gap** | Already implemented. `GymListScreen.tsx` row `onPress={() => onSelectGym(item.id)}` → `GymNavigator.navigateToDetail(gymId)` → `GymDetailScreen gymId={...}`. Passes the identifier as AC-006 requires. Spec/QA documentation-only; no engineering. |
| AC-042 | **Confirmed — MOD-003** | **Doc gap** | Already implemented. `RouteListScreen.tsx` row `onPress={() => onSelectRoute(item.id)}` → `RouteNavigator.navigateToDetail(routeId)` → `RouteDetailScreen routeId={...}`. Documentation-only. **Caveat**: this path is only reachable once AC-005 mounts `RouteNavigator` — AC-042's code exists but is dead until AC-005 lands. Not an AC-042 defect; a dependency ordering note. |
| AC-037 | **Confirmed — MOD-005** (owns the upload flow the entry point launches) | **Code gap** | `RouteDetailScreen.tsx` currently has a log-send entry point (`onLogSend`) and a placeholder text block for beta videos (`routes.detail.betaVideosPlaceholder`) — no "Add beta video" affordance. **Boundary flag**: the entry point *renders in* MOD-003's `RouteDetailScreen`, but the capture/upload flow it launches is MOD-005-owned. Recommend MOD-005's engineer owns the AC (it's their flow + route-context contract), implemented as a small MOD-003 host change: MOD-003 exposes a slot/prop (`onAddBetaVideo` or a MOD-005-provided component) on `RouteDetailScreen`, MOD-005 fills it. Same host-screen/owning-module split as AC-005. Since MOD-005 is Not started, this fits naturally into MOD-005's build; no separate MOD-003 change order is needed if MOD-005 owns the whole slot. |
| AC-058 | **Confirmed — MOD-007** (owns the notification inbox, the source entry point) | **Code gap** | MOD-007 Not started. Placement correct: the inbox is MOD-007's; tap-through resolves `target_id` → the beta video on its `RouteDetailScreen`. Cross-module boundary: MOD-007 (source) navigates to a MOD-003 screen showing a MOD-005 video. MOD-007's engineer owns the navigation call + `target_id` resolution; depends on MOD-003's `RouteDetailScreen` accepting a route/video target and MOD-005 rendering the video inline (AC-033). Flag for the eventual MOD-007 spec: define the navigation contract (does it deep-link by `route_id` derived from the beta video, or scroll-to-video?) — that contract touches MOD-003/MOD-005 and should be pinned before MOD-007 build. |
| AC-064 | **Confirmed — MOD-008** (owns the destination: profile + send history) | **Code gap** | MOD-006 and MOD-008 both Not started. Placement correct per destination-ownership: the feed/user-reference is MOD-006's (source), the profile+history destination is MOD-008's. MOD-008's engineer owns the destination screen and the privacy gate (AC-063 followers-only → hidden/403). The source affordance (tappable user reference) is MOD-006-owned and must be built when MOD-006 ships. Privacy enforcement (AC-063) is MOD-001's profile-privacy rule applied at the MOD-008 destination — confirm the followers-only/403 check runs server-side (RLS/RPC), not just client-side hiding, consistent with the MOD-006 feed-RPC convention already in the PRD. |

**Summary**: All six PM placements are correct — no ownership corrections needed. Two are documentation-only gaps (AC-006, AC-042): the code already navigates correctly and only the specs/QA records need to catch up. Four are code gaps (AC-005, AC-037, AC-058, AC-064). The single most important finding is AC-005: `RouteNavigator` (MOD-003) is fully implemented but never mounted, so the entire route-catalog UI is currently unreachable from the running app — AC-005 is the missing seam that makes MOD-003 (and therefore AC-042's already-shipped code) actually reachable. Three code-gap ACs (AC-037, AC-058, AC-064) sit on module boundaries where the *source affordance or entry point* renders in one module's screen but the *owning flow/destination* belongs to another; in each case I confirmed the PM's destination-ownership assignment is right and flagged the host-screen split so the owning engineer knows they need a small hosting change in the neighboring module's screen (or a slot the neighbor exposes). No architectural concerns with the navigation approach itself — the state-machine-per-navigator pattern already shipped in `GymNavigator`/`RouteNavigator` extends cleanly to all six. No new modules, no dependency changes. Next step: Doc-Sync carries AC-005/AC-006 into MOD-002 spec, AC-042 into MOD-003, AC-037 into MOD-005, AC-058 into MOD-007, AC-064 into MOD-008; Engineering should treat AC-005 as a near-term MOD-002 change (unblocks MOD-003 reachability), while AC-037/AC-058/AC-064 fold into their respective not-yet-started module builds.

## Tech Lead Reviews

### Review — 2026-09-25 — blocker (iOS build failure: expo-av EXEventEmitter.h not found, MOD-005)

**Context**: `xcodebuild` fails with error code 65 building the iOS project. Error originates in `node_modules/expo-av/ios/EXAV/EXAV.h:10` — `#import <ExpoModulesCore/EXEventEmitter.h>` → `'ExpoModulesCore/EXEventEmitter.h' file not found`. Advisory only — no `package.json`, source, or migration edits made here. Findings grounded in installed package versions, a filesystem search of `node_modules/expo-modules-core/ios`, `node_modules/expo/bundledNativeModules.json`, and the actual `expo-av` usage in `src/modules/mod-beta-video/`.

---

**Root cause — version mismatch, not a missing/corrupt install.**

- Installed: `expo-av@15.0.2` (pinned `~15.0.2` in `package.json` line 14; changelog dates it 2025-01-10 — this is the SDK 52-era release). Installed alongside `expo-modules-core@57.0.18` and `expo@~57.0.24` (SDK 57).
- `expo-av@15.0.2`'s native iOS code imports the **legacy Objective-C header** `ExpoModulesCore/EXEventEmitter.h`. That header does **not exist** in `expo-modules-core@57`. Confirmed by search: `find node_modules/expo-modules-core -name "EXEventEmitter.h"` returns nothing. The legacy `EX*` headers that survive (e.g. `EXExportedModule.h`, `EXAppLifecycleListener.h`) were relocated to `ios/Legacy/`, but `EXEventEmitter.h` was **removed outright** — the event-emitter API is now Swift-only (`ios/Core/Events/EventEmitter.swift`, plus `LegacyEventEmitterCompat.swift`). So the two other headers in `EXAV.h` resolve; only `EXEventEmitter.h` cannot, which is exactly the compiler error.
- **`expo-av` is not part of Expo SDK 57.** `node_modules/expo/bundledNativeModules.json` has no `expo-av` entry at all; it lists `expo-video ~57.0.4` as the SDK 57 video module. `expo-av` was deprecated in SDK 52 (the 15.0.1 changelog adds a deprecation warning to the `Video` component) and dropped from the SDK 57 bundle. Pinning `expo-av@~15.0.2` under SDK 57 was never a supported combination — it slipped through JS-side because Jest mocks `expo-av` (`__mocks__/expo-av.js` via `moduleNameMapper`), so unit tests pass while the native build cannot compile.

**Not** a node_modules corruption issue and **not** fixable by `pod install` / clean rebuild — the header genuinely does not exist in this SDK, so no cache clear will produce it.

---

**Where it's used (scope of the fix):**

- Only one real import: `src/modules/mod-beta-video/components/BetaVideoPlayer.tsx:17` — `import { Video, ResizeMode } from 'expo-av'`. Uses `<Video>` with `source={{uri}}`, `resizeMode={ResizeMode.CONTAIN}`, `useNativeControls`, `shouldPlay`, `onPlaybackStatusUpdate`, and a `useRef<Video>`.
- No other production source imports `expo-av` (remaining matches are comments and the Jest mock). Playback is required — AC-032/033/034 (inline playback on route detail + activity feed), so removal is **not** an option.

**Concerns** (must address before proceeding):
- iOS build is fully blocked until the `expo-av` dependency is resolved. No amount of native-cache clearing fixes it; the package version itself is the problem.
- The Jest `moduleNameMapper` mock for `expo-av` masked this — green unit tests do not imply a compilable native build. Whatever replacement is chosen, its mock must be updated too or the tests will assert against a package that is no longer installed.

**Recommendations** (suggested improvements):
- **Preferred fix — migrate MOD-005 playback to `expo-video`, the SDK 57 successor.** Rationale: (1) it is the SDK-57-bundled, version-aligned video module (`bundledNativeModules.json` → `expo-video ~57.0.4`), so no version-pin guesswork; (2) `expo-av`'s `Video` is deprecated upstream and will not be maintained; (3) the PRD does not name a playback library — AC-032/033/034 only require inline playback, and AC-031's note already anticipates the `expo-*` family — so switching packages is an implementation-detail change, not a PRD/spec change. API delta the engineer should expect: `expo-video` uses the `VideoView` component + `useVideoPlayer` hook (imperative player) rather than `expo-av`'s `<Video>` + `ResizeMode` enum + `onPlaybackStatusUpdate`. `resizeMode="contain"` maps to `contentFit="contain"`; `useNativeControls` → `nativeControls`; playback status is read from the player object / its events. Install with `npx expo install expo-video` (resolves the SDK-correct version and adds the config plugin). Update `__mocks__/expo-av.js` → `__mocks__/expo-video.js` and the `moduleNameMapper`/`transformIgnorePatterns` in `package.json`, plus `BetaVideoPlayer.test.tsx`.
- **Fallback (only if a same-day unblock is needed and the migration can't be scheduled)**: pin `expo-av` to the SDK-57-compatible release via `npx expo install expo-av` (let Expo pick the version matching SDK 57 rather than keeping the hand-pinned `~15.0.2`). Caveat: since `expo-av` is not in the SDK 57 bundle, Expo may report no compatible version — in which case this fallback is void and the `expo-video` migration is the only path. Do **not** hand-bump the version string blindly; a mismatched native module is exactly what caused this.

**Approved**:
- The component-level design of `BetaVideoPlayer.tsx` (thumbnail → play overlay → inline player, buffering state, caption, safe testIDs) is sound and package-agnostic; the migration is a swap of the video primitive, not a rewrite.

**Proposed Shared Conventions** (for Doc-Sync to carry into production.md):
- Native Expo modules must be installed with `npx expo install <pkg>` (not `npm install <pkg>`) so versions match the installed Expo SDK. Hand-pinning a native module's version in `package.json` is prohibited — it is what produced the SDK-52/SDK-57 `expo-av` mismatch that broke the iOS build.
- A Jest `moduleNameMapper` mock for a native module hides native build breakage from the unit suite. When a native package is added, changed, or removed, the module owner must also run the native iOS build (`npx expo run:ios` or `xcodebuild`) before marking the module QA-ready — passing unit tests are not sufficient evidence a native dependency compiles.

---

### Review — 2026-09-24 — change (Rev 9: ascent_style enum removal, saved_routes table, achievement icons)

**Context**: PRD Revision 9 [SUBSTANTIVE] makes three data/architecture-affecting changes the PM flagged for Tech Lead review: (1) remove `project` from the `ascent_style` enum (MOD-004), (2) add a `saved_routes` join table mirroring `saved_gyms` (MOD-003), and (3) add per-route achievement icons on RouteListScreen/RouteDetailScreen sourced from MOD-004 ascent data. Advisory only — no source, migration, spec, or PRD files changed here. Findings grounded in the shipped migrations (`20260920000004_mod_004_send_logging.sql`, `20260924000002_mod_012_home.sql`, `20260920000003_mod_003_route_catalog.sql`) and a repo-wide grep for `ascent_style` usage. Doc-Sync carries the Proposed Shared Conventions and decisions into the MOD-003/MOD-004/MOD-008 specs + production.md; Engineering implements in `change`-mode work.

---

#### Area 1 — `ascent_style` enum removal (`project` → removed; historical rows → `attempt`)

Current type (migration `20260920000004`, line 24): `CREATE TYPE ascent_style AS ENUM ('flash', 'top', 'attempt', 'project');`. Column: `ascents.style ascent_style NOT NULL` (line 32). This is a **value-drop**, which PostgreSQL does not support directly (unlike ADD VALUE) — the type must be recreated and swapped.

**Recommendation — the exact migration sequence (one migration file, single transaction):**
```sql
-- Migration: 2026XXXXXX_mod_004_ascent_style_drop_project.sql  (MOD-004-owned)

-- 1. New type WITHOUT 'project'
CREATE TYPE ascent_style_v2 AS ENUM ('flash', 'top', 'attempt');

-- 2. Backfill: reclassify historical 'project' rows to 'attempt' (lossless — see below)
UPDATE public.ascents SET style = 'attempt' WHERE style = 'project';

-- 3. Swap the column type via text cast (safe now that no row holds 'project')
ALTER TABLE public.ascents
  ALTER COLUMN style TYPE ascent_style_v2
  USING style::text::ascent_style_v2;

-- 4. Drop the old type, then rename the new one to the canonical name
DROP TYPE ascent_style;
ALTER TYPE ascent_style_v2 RENAME TO ascent_style;
```

**Confirmations against the brief:**

- **One file, not two — confirmed.** The project's two-file enum convention exists specifically because PG15 forbids *using* a value added via `ALTER TYPE ... ADD VALUE` in the same transaction that added it. That restriction applies **only to ADD VALUE**. This migration uses `CREATE TYPE` (a brand-new type, fully committed and usable within the same transaction) plus `ALTER TABLE ... ALTER COLUMN TYPE` and `DROP TYPE` — none of which are subject to the ADD-VALUE in-transaction restriction. So this is correctly a **single migration file, single transaction**. The two-file convention does not apply here; noting this explicitly so the engineer does not needlessly split it (splitting would leave a `_v2`-named type live between files, which is worse).

- **RENAME TYPE is required — confirmed, do not skip step 4.** If the type is left named `ascent_style_v2`, everything downstream that names the type breaks or drifts: the MOD-003/MOD-004 specs, `production.md`, and — critically — any future migration, RPC signature, or generated TypeScript type that references `ascent_style` by name. The column itself would work (it points at the type by OID, not name), but the *type name* is a documented contract. Renaming `ascent_style_v2 → ascent_style` after the drop keeps the canonical name stable so no downstream code or doc changes. This is the standard PG enum-value-drop idiom and matches the "column keeps a stable identity" principle the route-status review already established.

- **Data-loss risk — confirmed lossless (semantic).** `project` = "tried the route but did not send"; `attempt` = the same real-world meaning in the three-value model. Reclassifying `project → attempt` (step 2) loses no send-status information — both denote an unsuccessful/in-progress ascent. This is a *semantic merge*, not a data loss. AC-014 and AC-065 already codify this mapping (former `project`/🎯 achievement now maps to `attempt`). Note the backfill must run **before** the column type swap (step 2 before step 3): once the column type is `ascent_style_v2`, a `'project'` value can no longer exist and the cast in step 3 would fail on any surviving `project` row. Order is load-bearing.

- **No RPC / RLS policy / trigger / view / generated-column references `ascent_style` anywhere except its defining migration — confirmed by grep.** Searched all migrations: `ascent_style` appears only in `20260920000004_mod_004_send_logging.sql`. The four `ascents` RLS policies (`ascents_select_own_or_public`, `ascents_insert_own`, `ascents_update_own`, `ascents_delete_own`) reference `user_id`/`is_private`/`auth.uid()` only — **none reference `style` or the enum type**, so they survive the column-type swap untouched. No view or materialized view or generated column depends on the type. This means the migration is self-contained: no dependent object must be dropped/recreated around the type swap, which is what would otherwise force a more elaborate sequence. Clean drop confirmed.

- **CHECK-based fallback rejected.** An alternative (add a CHECK constraint forbidding `project` and leave the four-value enum in place) is explicitly *not* recommended — the PRD (AC-014, §9) requires `project` be removed from the *database enum*, not merely blocked. The recreate-and-swap above satisfies that literally.

**Engineer verification step**: run `supabase db reset` locally and confirm the migration applies cleanly and that `SELECT enum_range(NULL::ascent_style);` returns exactly `{flash,top,attempt}`. The canary for a mis-ordered migration is `ERROR: invalid input value for enum ascent_style_v2: "project"` — that means step 2 (backfill) was omitted or placed after step 3.

**Client-side impact (Engineer, MOD-004 + MOD-008)**: any TS union type / picker option list enumerating `'flash' | 'top' | 'attempt' | 'project'` must drop `'project'` (MOD-004 style selector per AC-014; MOD-008 achievement-icon mapping per AC-065). Flag for Doc-Sync to note in both specs.

---

#### Area 2 — `saved_routes` join table (mirror of `saved_gyms`)

**Confirmed as a correct mirror of the ratified `saved_gyms` design, with the exact same shape applied to `routes`.** The shipped `saved_gyms` DDL (`20260924000002_mod_012_home.sql`) is the template; `saved_routes` differs only in the second FK target (`routes` not `gyms`).

**Recommended DDL:**
```sql
-- Migration: 2026XXXXXX_mod_003_saved_routes.sql  (MOD-003-owned)
-- Must run after 20260920000001 (users) and 20260920000003 (routes).

CREATE TABLE public.saved_routes (
  user_id    UUID        NOT NULL DEFAULT auth.uid() REFERENCES public.users(id)   ON DELETE CASCADE,
  route_id   UUID        NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, route_id)
);

ALTER TABLE public.saved_routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "saved_routes_select_own" ON public.saved_routes
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "saved_routes_insert_own" ON public.saved_routes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "saved_routes_delete_own" ON public.saved_routes
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

GRANT SELECT, INSERT, DELETE ON public.saved_routes TO authenticated;
```

**Confirmations:**

- **FK targets `routes`, not `gyms` — confirmed correct.** `route_id → public.routes(id) ON DELETE CASCADE`. `routes.id` is a UUID PK (`20260920000003` line 40), a clean FK target. `user_id → public.users(id) ON DELETE CASCADE` matches `saved_gyms`. `users.id` itself cascades from `auth.users`, so account deletion cleans up `saved_routes` transitively.
- **`route_id ON DELETE CASCADE` — confirmed and important.** Per PRD §9 note: a withdrawn pending route is DELETEd (route-status review §7), and admin retire/reject is a status change (not a delete) so those do *not* remove saves. But because withdrawal *does* delete the row, `ON DELETE CASCADE` on `route_id` is required so a saved-route pointer never dangles at a deleted route. Confirmed.
- **RLS pattern identical to `saved_gyms` — confirmed.** SELECT/INSERT/DELETE own rows (`auth.uid() = user_id`), no UPDATE (a save has no mutable field; unsave = DELETE). `ENABLE ROW LEVEL SECURITY` from creation. Explicit `GRANT SELECT, INSERT, DELETE ... TO authenticated` (RLS filters rows; GRANT authorizes the verb — the same gotcha caught in the route-catalog and saved-gyms reviews; do NOT omit it or the bookmark toggle silently fails). No grant to `anon`.
- **`DEFAULT auth.uid()` on `user_id` — confirmed needed.** The shipped `saved_gyms` uses `DEFAULT auth.uid()` (line 13) precisely so the MOD-002 service can `INSERT (gym_id)` without threading the user id explicitly, relying on the DB default + the `WITH CHECK (auth.uid() = user_id)` policy as the fence. `saved_routes` follows the same pattern: MOD-003's bookmark service inserts `(route_id)` and lets the default fill `user_id`. Keep it for parity and to keep the insert path minimal. (Defence-in-depth: even if a client tried to supply a foreign `user_id`, the INSERT `WITH CHECK` rejects it.)
- **Migration ownership: MOD-003 — confirmed.** The brief's proposal is right and consistent with the "table owned by the module that owns the entity" rule the saved_gyms review established. The `SavedRoute` entity backs US-021 / AC-046 / AC-047, all MOD-003. Name it `2026XXXXXX_mod_003_saved_routes.sql` (a new, later-timestamped file). Do **not** fold it into a MOD-004 or MOD-012 migration. Contrast with `saved_gyms`, which lives in the mod-012 migration because MOD-012 owns *that* entity — same rule, different owner.
- **Index — PK alone is sufficient; no extra index.** The read pattern is `WHERE user_id = auth.uid()` (RouteDetail checks a single route's saved state; RouteList needs the set of saved route_ids for the visible list). `user_id` is the leading column of the composite PK, so the PK index already serves that filter. No standalone `user_id` index needed (same conclusion as the saved_gyms review). A `route_id` reverse-lookup index is unnecessary in Phase 1 (no AC reads saves by route across users). Documenting so the engineer does not add a redundant index.

**Cross-module read note (RouteListScreen saved indicator, AC-047)**: RouteListScreen needs "which of these visible route_ids are saved by me." Recommend MOD-003 reads its own `saved_routes` table directly (single-table SELECT scoped by RLS to own rows: `SELECT route_id FROM saved_routes WHERE route_id = ANY($visible_ids)`) — this is MOD-003's own table, no cross-module import. The write side (bookmark toggle on RouteDetailScreen, AC-046) is also MOD-003 (`saved_routes` INSERT/DELETE). Both verbs live in MOD-003's service layer — unlike `saved_gyms`, there is **no cross-module verb split here** (MOD-003 owns both the table and both interaction points), which is simpler than the saved_gyms MOD-002-writes/MOD-012-reads split. Flag for Doc-Sync so the spec doesn't over-model it.

---

#### Area 3 — Achievement icons: cross-module data ownership + N+1

The achievement icons on RouteListScreen/RouteDetailScreen (MOD-003 screens) are sourced from ascent data (MOD-004 domain: which style did *this user* achieve on *this route*). This is a genuine cross-module data read (MOD-003 screen consuming MOD-004 data) and must respect the "public service functions only" cross-module import convention already in production.md.

**Recommendation — confirmed with one signature correction (return-value nuance):**

- **The read function lives in MOD-004's public service layer** (`src/modules/mod-send-logging/send-service.ts` or equivalent), exposed as a batched call. MOD-003 screens import that function; they do **not** query the `ascents` table directly (cross-module table access for a read that MOD-004 owns would violate the boundary and duplicate the RLS-scoped query MOD-004 should own). This matches the convention: "a module may import another module's public service functions."

- **Batched signature to avoid N+1 on the list** — confirmed necessary. The brief's `fetchUserAchievements(routeIds: string[])` shape is right. RouteListScreen calls it **once** after loading the visible routes, passing all visible route IDs; RouteDetailScreen calls it with a single-element array. One round-trip per screen, never one-per-route.
  ```ts
  // MOD-004 public service — send-service.ts
  fetchUserAchievements(routeIds: string[]): Promise<Record<string, AscentStyle>>
  // AscentStyle = 'flash' | 'top' | 'attempt'   (note: no 'project' after Area 1)
  ```
  **Signature nuance — a route can have multiple ascents by the same user with different styles; return the *best* style, not a raw last-write.** A user may have logged the same route as `attempt` then later `top` (or `flash`). The achievement icon should reflect the highest achievement, so the function must reduce multiple ascents per route to one style with a defined precedence: **`flash` > `top` > `attempt`** (flash is the strongest achievement — sent first try; top = sent; attempt = tried). Recommend the function encapsulate this reduction server-side or in the service so both screens get consistent results. Routes with no ascent by the user are simply absent from the returned map (the screen shows no icon — consistent with AC-047's "no indicator for unsaved" pattern and AC-065's three-icon set). Flag this precedence rule for Doc-Sync to write into the MOD-004 spec and MOD-008 spec (AC-065's per-send icon is 1:1 per ascent row and does not need reduction; the *per-route* aggregate on MOD-003 screens does — these are two different surfaces and must not be conflated).

- **Implementation shape (recommend a single batched RPC over N client filters)**: the cleanest batched form is a `SECURITY INVOKER` Postgres RPC (`fetch_user_achievements(p_route_ids uuid[])`) that runs under the caller's RLS, groups `ascents` by `route_id` for `user_id = auth.uid()`, applies the `flash>top>attempt` precedence via an ordered aggregate, and returns `(route_id, style)` rows. SECURITY INVOKER keeps the existing `ascents` RLS as the fence (the function sees only the caller's own rows, which is exactly what "my achievements" needs). Alternatively a single client-side `SELECT route_id, style FROM ascents WHERE route_id = ANY($ids) AND user_id = auth.uid()` with client-side reduction is acceptable for Phase 1 (the `ascents_route_id_idx (route_id, logged_at DESC)` index supports the `route_id = ANY(...)` scan). Either avoids N+1; the RPC centralizes the precedence rule. Engineer's call at implementation time; document the chosen shape in the MOD-004 spec.

- **RLS scope — confirmed critical.** The function must return achievements for the **calling user's own ascents only** (`user_id = auth.uid()`), never another user's. Under SECURITY INVOKER this is automatic (the `ascents_select_own_or_public` policy plus an explicit `user_id = auth.uid()` predicate scopes it to own rows). If ever implemented as SECURITY DEFINER, the `WHERE user_id = auth.uid()` predicate becomes mandatory and non-optional — a DEFINER function without it would leak other users' send styles. Recommend SECURITY INVOKER precisely so this can't be gotten wrong. Note the achievement icon is a *personal* overlay ("what have I done on this route"), so own-user scoping is correct product behavior, not just security.

- **Cross-module import rule — confirmed and unchanged**: MOD-003 screens import `fetchUserAchievements` from MOD-004's public service file only; MOD-003 must not import MOD-004 internal screens/components or query `ascents` directly. This is the same rule the Rev 7 review codified.

---

#### Concerns (must address during the Rev 9 change work)

- **Enum backfill order is load-bearing** — the `UPDATE ... SET style='attempt' WHERE style='project'` must run *before* the `ALTER COLUMN ... TYPE` swap, or the cast fails on surviving `project` rows. Single migration file, single transaction, steps in the exact order given in Area 1.
- **RENAME TYPE must not be skipped** — leaving the type named `ascent_style_v2` silently drifts the canonical type name from every spec, production.md, and future migration/RPC that names `ascent_style`. Step 4 (`ALTER TYPE ascent_style_v2 RENAME TO ascent_style`) is mandatory.
- **`saved_routes` needs the explicit GRANT, not just RLS policies** — the recurring RLS-vs-GRANT gotcha (caught in route-catalog and saved-gyms reviews). Without `GRANT SELECT, INSERT, DELETE ON public.saved_routes TO authenticated`, the bookmark toggle (AC-046) silently fails.
- **Achievement read must be own-user-scoped and batched** — a per-route (N+1) fetch on RouteListScreen would violate the ≤2s feed/list render NFR at scale; an un-scoped fetch would leak other users' ascent styles. Both are correctness requirements, not preferences.

#### Recommendations

- Implement the enum drop as **one** MOD-004 migration (`2026XXXXXX_mod_004_ascent_style_drop_project.sql`): CREATE new type → backfill → ALTER COLUMN → DROP old → RENAME. Verify with `supabase db reset` + `enum_range` check. This is *not* a two-file enum change (that convention is ADD-VALUE-specific).
- Create `saved_routes` in a **MOD-003** migration (`2026XXXXXX_mod_003_saved_routes.sql`) as a field-for-field mirror of `saved_gyms` with `route_id → routes(id)`; PK-only index; three own-rows RLS policies + explicit grants; `DEFAULT auth.uid()` on `user_id`; no UPDATE.
- Expose `fetchUserAchievements(routeIds[])` from **MOD-004**'s public service (SECURITY INVOKER RPC preferred), applying `flash > top > attempt` precedence, own-user-scoped; MOD-003 screens import it and call it once per screen. Drop `'project'` from all client style unions.

#### Approved (looks solid as-is)

- The `saved_gyms` schema is the correct template for `saved_routes` exactly as shipped — dual `ON DELETE CASCADE`, composite PK, `DEFAULT auth.uid()`, own-rows RLS, explicit grants, no UPDATE. Only the FK target changes.
- The `ascents` table's four RLS policies are style-agnostic and survive the enum swap with zero changes (verified by grep) — the enum migration is self-contained.
- The `project → attempt` reclassification is lossless in the three-value model; AC-014/AC-065 already define the mapping.
- Batched `fetchUserAchievements(routeIds[])` is the right anti-N+1 shape; the existing `ascents_route_id_idx` supports the `route_id = ANY(...)` scan.

#### Proposed Shared Conventions (for Doc-Sync to carry into production.md)

- **Enum value removal on PG15/Supabase**: to drop a value from an existing enum (not supported directly), use a single migration that CREATE TYPEs a new enum, backfills existing rows off the removed value (backfill BEFORE the column-type swap), `ALTER COLUMN ... TYPE ... USING col::text::newtype`, `DROP TYPE` the old, then `ALTER TYPE ... RENAME TO` the canonical name so downstream references are unbroken. This is a single-file, single-transaction change — distinct from the two-file rule for `ALTER TYPE ADD VALUE` (which is the only enum operation the two-file rule governs).
- **Personal cross-module data overlays**: when one module's screen must display a per-item overlay derived from another module's user-scoped data (e.g. "my achievement on this route" from ascents on a route-catalog screen), the owning module exposes a **batched, own-user-scoped** public service function (`fetch...(ids[]) → Record<id, value>`), preferably a SECURITY INVOKER RPC so RLS scopes it to `auth.uid()`. The consuming screen calls it once per screen with all visible ids — never one call per item (N+1). The consuming module must not query the owning module's tables directly.
- **Multi-row-to-one reduction with defined precedence**: when aggregating multiple user rows per key into a single display value (e.g. best ascent style per route), define an explicit precedence order (`flash > top > attempt`) in the owning module's service so all consuming surfaces render consistently; do not rely on last-write or arbitrary ordering.

### Review — 2026-09-21 — change (cross-cutting safe-area defect)

**Concerns** (must address before proceeding):
- Safe area insets are unhandled app-wide: `App.tsx` has no `SafeAreaProvider` and no screen uses `useSafeAreaInsets()`. Every screen hardcodes `paddingTop: theme.spacing.xl` (32px), which is less than the Dynamic Island clearance (~59px) on iPhone 17 Pro (and any notch/Dynamic Island device), hiding top-bar content. This affects all built screens (MOD-001/002/003/004) and every screen not yet built.

**Recommendations** (suggested improvements):
- Adopt the safe-area convention now added to `production.md` ("Screen Layout & Safe Area Insets"): wrap the root in `SafeAreaProvider` once in `App.tsx`, and have every screen pass `insets.top` into a `makeStyles(theme, topInset)` signature, deriving `paddingTop: topInset + theme.spacing.md`. Applying it uniformly is safe — modal sheets return `insets.top === 0`.
- Retrofit already-passed modules (MOD-001/002/003) as bugfixes since the defect is present in their screens; new modules should follow the convention from first implementation.

**Approved**:
- `react-native-safe-area-context` is already available transitively via `react-native-screens`; no new dependency is required.
- The uniform pattern is compatible with the existing theming convention (still token-driven, no hardcoded values beyond the OS-provided inset).

**Proposed Shared Conventions** (for Doc-Sync to carry into production.md):
- Screen Layout & Safe Area Insets convention has already been written directly into `production.md` Shared Conventions as part of this review.

## Tech Lead Review — Route Status Full Architecture (2026-09-23)

**Context**: PRD Revision 4 [SUBSTANTIVE] locks the route approval gate and expands `Route.status` to a 4-value enum (`active | pending | retired | rejected`). This review supersedes the 2026-09-22 advisory (which recommended B2 + T3) by turning it into a concrete, implementable spec across data model, RLS, enum migration, the submission RPC, `app_settings`, the one-pending-per-combo constraint, withdrawal-by-delete, and Phase 1.5 forward-compat. Advisory only — no source or migration files changed here. Doc-Sync carries the outputs into the MOD-003 spec and production.md; Engineering implements in a `change`-mode migration.

Decisions locked upstream that this review builds on: B2 (`pending` as a status value on `routes`, not a separate submission table), T3 (single-row `app_settings`), submission via `SECURITY DEFINER` RPC, withdrawal = row delete, one-pending-per-combo per submitter, admin via Studio (service_role) in Phase 1 with schema forward-compatible for in-app admin in Phase 1.5.

---

### 1. Enum migration (`route_status`: add `pending`, `rejected`)

Existing type: `CREATE TYPE route_status AS ENUM ('active', 'retired')`.

**PG15 behavior that governs the migration:**
- On Postgres 15, `ALTER TYPE ... ADD VALUE` *can* run inside a transaction block, **but** a newly added enum value **cannot be referenced in the same transaction that added it** (Postgres restriction: the new label isn't committed/visible to other reads within the adding transaction; PG only lifted the in-txn *usage* restriction for values added in the same txn under narrow conditions, and Supabase's migration runner wraps each migration file in a single transaction). Because the new `pending` value is *used* by the RPC, the RLS policies, and the partial index in the same logical change, treating enum-add and enum-use as one transaction is unsafe.
- **Mitigation (required): split into two migration files.**
  - **Migration A** — enum values only, nothing that references them:
    ```
    ALTER TYPE route_status ADD VALUE IF NOT EXISTS 'pending';
    ALTER TYPE route_status ADD VALUE IF NOT EXISTS 'rejected';
    ```
    Order does not matter functionally (enum ordinal order is cosmetic here since no code sorts by it), but add `pending` then `rejected` for readability. `IF NOT EXISTS` makes the file idempotent for `supabase db reset` re-runs.
  - **Migration B** (separate file, later timestamp) — everything that *uses* the new values: `app_settings` table + seed, the `submit_route` RPC, the revised RLS policies, the new pending partial index, and the withdrawal DELETE policy. Because B is a distinct migration file, it runs in its own transaction after A has committed, so `'pending'` and `'rejected'` are fully visible.
- **Engineer verification step**: run `supabase db reset` locally and confirm both files apply cleanly in order. If the runner ever collapses both into one transaction, the symptom is `ERROR: unsafe use of new value "pending" of enum type`. That error means A and B were not separated correctly — it is the canary for this whole item.
- **Do not** attempt a `COMMIT;` mid-file workaround inside a single Supabase migration — the CLI's transaction wrapper makes that unreliable; file-splitting is the supported path.

---

### 2. Admin identity mechanism (forward-compatible for Phase 1.5)

**Recommendation: use `app_metadata.role = 'admin'` on the Supabase auth user (a JWT claim), NOT a `public.admin_users` table.**

- **Phase 1**: no in-app admin identity is needed at all — Leon acts as service_role in Studio, which bypasses RLS. So in Phase 1 this mechanism is *defined but unused by RLS*. That is intentional and correct.
- **Phase 1.5**: in-app admin needs an RLS-visible identity. `app_metadata` is the right store because:
  1. It is set only by service_role (Studio / admin API) — a user cannot self-escalate by editing it, unlike `user_metadata`. This matches the trust model exactly (admin is granted, never claimed).
  2. Supabase mints it directly into the JWT, so RLS can read it with **zero extra table lookup** per policy evaluation. A `public.admin_users` table would add a subquery (`EXISTS (SELECT 1 FROM admin_users ...)`) to every admin-gated policy evaluation and require its own RLS.
  3. It requires no schema at all now — nothing to migrate, nothing to keep in sync with auth.users.
- **The forward-compatible RLS predicate to standardize on now** (so Phase 1 policies are written in a shape that Phase 1.5 extends without rewrite):
  ```
  COALESCE((auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin'
  ```
  Wrap this in a stable helper so every policy references one place and Phase 1.5 can swap the implementation if ever needed:
  ```
  CREATE OR REPLACE FUNCTION public.is_admin()
  RETURNS boolean
  LANGUAGE sql STABLE
  AS $$
    SELECT COALESCE((auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin';
  $$;
  ```
  In Phase 1 no user carries this claim, so `public.is_admin()` is always `false` for real clients and `true` is effectively only reachable via service_role (which bypasses RLS anyway). Ship the helper and reference it in the SELECT/UPDATE policies now so Phase 1.5 is purely a matter of granting the claim to Leon's auth user — **no migration, no policy rewrite**.
- **Risk / mitigation**: `auth.jwt()` returns the *session's* claims; a claim granted to a user mid-session is not visible until their token refreshes. Mitigation: acceptable — admin grants are rare and Leon can re-auth. Document it so it isn't mistaken for a bug in Phase 1.5.

---

### 3. RLS policies for `routes` (exact logic, replacing the current three policies)

The current migration's policies (`routes_select_authenticated` = all rows to all authenticated; `routes_insert_own`; `routes_retire_authenticated`) must be **dropped and replaced** in Migration B. US-014 / user-retire is gone, so `routes_retire_authenticated` is removed entirely. New policy set:

- **SELECT** (`routes_select_visible`) — a row is visible to an authenticated caller iff **any** of:
  - `status = 'active'` (everyone sees active), OR
  - `submitted_by_user_id = auth.uid() AND status = 'pending'` (submitter sees only their *own* pending row, read-only), OR
  - `public.is_admin()` (Phase 1.5 admin sees everything; false for all Phase 1 clients).
  - Net effect: `retired` and `rejected` are invisible to every normal user (including the original submitter — a rejected/retired route disappears from their view). A submitter sees their own pending row but not anyone else's pending row. service_role (Studio) sees all rows regardless (RLS bypass).
  - **Important**: this is the top correctness fix. The existing `routes_select_authenticated` leaks all rows; it MUST be replaced or pending/rejected/retired routes pollute every user's gym list and — critically — the AC-020 match pool.

- **INSERT** (no policy — blocked entirely) — remove `routes_insert_own`. Client cannot INSERT directly; all creation goes through `submit_route` (SECURITY DEFINER, which inserts as the function owner and is not subject to a client INSERT policy). Rationale: the auto-approve gate must be enforced server-side; a client INSERT policy would let a user set `status = 'active'` and self-approve. **Also revoke the INSERT grant**: `REVOKE INSERT ON public.routes FROM authenticated;` — the RPC does the insert with definer privileges, so `authenticated` needs no direct INSERT right.

- **UPDATE** (`routes_admin_update`) — normal users cannot UPDATE at all. Only `public.is_admin()` may UPDATE (Phase 1.5). In Phase 1 this policy never matches a real client (admin transitions happen in Studio via service_role). Writing the policy now, gated on `is_admin()`, is the forward-compat move: approve (`pending→active`), reject (`pending→rejected`), and retire (`active→retired`) all become in-app admin UPDATEs in Phase 1.5 with no new policy. **Revoke the broad UPDATE grant** that the current migration gives (`GRANT ... UPDATE`) since no normal-user UPDATE path remains; keep UPDATE grant only insofar as `is_admin()` clients need it in 1.5 — safe to `GRANT UPDATE ON public.routes TO authenticated` while the policy restricts it to admins, or defer the grant to 1.5. Recommend deferring the UPDATE grant to Phase 1.5 to keep Phase 1 tight.

- **DELETE** (`routes_withdraw_own_pending`) — a row may be deleted by the caller iff `submitted_by_user_id = auth.uid() AND status = 'pending'`. This is the withdrawal path (see §7). No other deletes for normal users. service_role deletes anything in Studio. Add `GRANT DELETE ON public.routes TO authenticated;` (the current migration grants only SELECT/INSERT/UPDATE) — required for the withdrawal DELETE policy to be usable.

Summary of grant changes in Migration B: `REVOKE INSERT ON public.routes FROM authenticated;` `REVOKE UPDATE ON public.routes FROM authenticated;` (defer UPDATE re-grant to 1.5) `GRANT DELETE ON public.routes TO authenticated;` (SELECT grant stays.)

---

### 4. SECURITY DEFINER submission RPC (`submit_route`)

Mirrors the existing `handle_new_auth_user` definer pattern (`SECURITY DEFINER`, `SET search_path = public`).

**Signature** (order fixed for named `supabase.rpc` calls; do not pass `user_id` from the client — derive it server-side from `auth.uid()` so a caller cannot submit as someone else):
```
CREATE OR REPLACE FUNCTION public.submit_route(
  p_gym_id        UUID,
  p_grade         route_grade,
  p_color_tag     route_color,
  p_photo_url     TEXT,
  p_section_label TEXT DEFAULT NULL
) RETURNS public.routes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
```
Note: the task brief lists `user_id` as a parameter — **override that**: the submitter must be `auth.uid()` inside the function, never a client-supplied argument. Accepting `user_id` from the client is an impersonation hole. This is a flagged correction, not a TBD.

**Logic (in order):**
1. `v_uid := auth.uid();` — if NULL, `RAISE EXCEPTION 'not authenticated'` (function is `SECURITY DEFINER` but must still require a real session; grant EXECUTE to `authenticated` only, not `anon`).
2. `p_photo_url` NOT NULL / non-empty check → else `RAISE EXCEPTION 'photo required'` (enforces AC "no photo, no submission" at the server, not just client).
3. Read the toggle: `SELECT (value = 'true') INTO v_auto FROM public.app_settings WHERE key = 'route_auto_approve';` — if no row, treat as the seeded default `true` (defensive: `v_auto := COALESCE(v_auto, true)`).
4. One-pending-per-combo guard: `IF EXISTS (SELECT 1 FROM public.routes WHERE gym_id = p_gym_id AND grade = p_grade AND color_tag = p_color_tag AND status = 'pending' AND submitted_by_user_id = v_uid) THEN RAISE EXCEPTION 'duplicate pending submission' USING ERRCODE = 'unique_violation'; END IF;` (belt-and-suspenders with the partial index in §6; the explicit check yields a clean, catchable error message; the index is the true guarantee).
5. Compute status: `v_status := CASE WHEN v_auto THEN 'active' ELSE 'pending' END::route_status;`
6. Insert and return the row:
   ```
   INSERT INTO public.routes (gym_id, section_label, grade, color_tag, photo_url, status, submitted_by_user_id)
   VALUES (p_gym_id, p_section_label, p_grade, p_color_tag, p_photo_url, v_status, v_uid)
   RETURNING * INTO v_row;
   RETURN v_row;
   ```
   - When `v_auto = true`, the insert of a second `active` row for the same combo hits `routes_active_unique_idx` and raises `unique_violation` — this is the correct match-before-create backstop (client should have matched first, but the DB enforces it). Surface as a friendly "route already exists" message client-side.
7. Grant: `GRANT EXECUTE ON FUNCTION public.submit_route(UUID, route_grade, route_color, TEXT, TEXT) TO authenticated;` and `REVOKE EXECUTE ... FROM anon, public;`

**Client call**:
```
supabase.rpc('submit_route', { p_gym_id, p_grade, p_color_tag, p_photo_url, p_section_label })
```
Returns the inserted `routes` row (single object). The client uses the returned `status` to choose confirmation copy: active → "route added"; pending → the [I18N-PENDING] "submitted for review" message (AC-025).

**Why the RPC and not an INSERT policy**: enforcing auto-approve in a `WITH CHECK` would require the policy to subquery `app_settings` on every insert and still could not prevent a client from choosing its own `status` unless the check also pinned status to the computed value — which reduces to reimplementing the RPC inside a policy. The definer RPC centralizes the gate in one server-side place, matches the shipped `handle_new_auth_user` pattern, and lets `app_settings` be service-role-only (see §5).

---

### 5. `app_settings` table

```
CREATE TABLE IF NOT EXISTS public.app_settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```
- **Seed** (Migration B): `INSERT INTO public.app_settings (key, value) VALUES ('route_auto_approve', 'true') ON CONFLICT (key) DO NOTHING;` (auto-approve ON at launch per D-AUTO-DEFAULT — Phase 1 behavior matches pre-gate behavior).
- **RLS** (enabled from creation per convention): `ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;`
  - **No SELECT policy for `authenticated`** — the client never reads the toggle directly. The only reader is `submit_route`, which is `SECURITY DEFINER` and reads the row as the function owner regardless of the caller's RLS. This is the tightest design: settings are never exposed to clients, and the client doesn't need the value (it learns the outcome from the RPC's returned `status`). Result: with RLS enabled and no policy, `authenticated`/`anon` get zero rows; service_role (Studio) reads/writes freely.
  - **No INSERT/UPDATE/DELETE policies** → only service_role (Studio) can flip the toggle: `UPDATE public.app_settings SET value = 'false', updated_at = NOW() WHERE key = 'route_auto_approve';`
  - **Grants**: do **not** `GRANT` any privilege on `app_settings` to `authenticated` or `anon`. The definer function's owner (postgres) already has access. This makes the table invisible to clients at both the grant and RLS layers.
- **Value typing note**: stored as TEXT (`'true'`/`'false'`) for a generic key/value shape reusable by future settings. The RPC compares `value = 'true'`. If preferred, a `BOOLEAN` column is fine too — TEXT keeps the table polymorphic for later settings; either is acceptable, TEXT recommended for extensibility.

---

### 6. One-pending-per-combo constraint

**Recommendation: add a second partial unique index AND keep the explicit RPC check — both, not either/or.**

```
CREATE UNIQUE INDEX routes_pending_unique_idx
  ON public.routes (gym_id, grade, color_tag, submitted_by_user_id)
  WHERE status = 'pending';
```
- **Why the index (the real guarantee)**: it makes the constraint race-proof and enforced regardless of write path (RPC, Studio, or any future path). The RPC's `IF EXISTS` check in §4.4 has a TOCTOU race under concurrent double-submit; only a unique index closes it. The index is the source of truth.
- **Why also the RPC check**: the index raises a raw `unique_violation` with a generic message; the RPC's pre-check raises a clean, localizable error first in the common (non-concurrent) case, giving a better UX. The RPC catches the index violation as the fallback for the race.
- **Scoping note — this is per-submitter, matching AC-029** ("no two pending for same gym+grade+color" is scoped to the *same user* per the D1 decision: one user can't spam duplicate pendings; two *different* users may each have a pending for the same combo, which is fine — they're competing submissions the admin adjudicates). The index key therefore includes `submitted_by_user_id`. 
  - **Flagged nuance for PM/Doc-Sync to confirm wording**: AC-029 as summarized reads "no two pending for the same gym+grade+color," which could be read as global (across all users). The D1 decision and this index implement **per-submitter**. If Leon actually wants *global* one-pending (only one person may have a pending submission for a combo at a time), drop `submitted_by_user_id` from the index. Recommend **per-submitter** (as indexed above) because global-pending lets one user block others from submitting and complicates the two-competing-submissions adjudication model. Doc-Sync should make AC-029 explicit either way. Mitigation if unresolved: ship per-submitter (the less-restrictive, non-blocking choice) and note it.
- **Active uniqueness is unchanged**: `routes_active_unique_idx` (`WHERE status = 'active'`) stays exactly as-is. `pending`, `retired`, `rejected` rows are excluded from it, so approval is where active-uniqueness is enforced (approving a second competing pending into `active` correctly collides — see §8 approval-collision note).

---

### 7. Withdrawal (row delete) — confirmed, with the required grant

The brief's proposal is **correct**: a DELETE RLS policy `USING (submitted_by_user_id = auth.uid() AND status = 'pending')` is sufficient; no RPC is needed for withdrawal. A direct `supabase.from('routes').delete().eq('id', ...)` from the client is fine because RLS scopes the delete to the caller's own pending rows only.

**One required addition the brief omits**: the current migration grants only `SELECT, INSERT, UPDATE` on `routes` to `authenticated` — there is **no DELETE grant**, so the DELETE policy alone would not make delete work (RLS filters rows but GRANT authorizes the verb). Migration B must add:
```
GRANT DELETE ON public.routes TO authenticated;
```
Guardrails already correct: because the policy predicate requires `status = 'pending'`, a user cannot delete an `active`/`retired`/`rejected` route, and cannot delete another user's pending row (not visible to them via SELECT and blocked by the DELETE `USING` anyway). Deleting the row (vs. status-changing) also cleanly frees the `(gym_id, grade, color_tag, submitted_by_user_id)` slot in `routes_pending_unique_idx`, so the user can resubmit immediately — the delete-not-flag choice is consistent with the constraint design.

**FK note**: `ascents.route_id → routes.id ON DELETE ...` — a pending route has no ascents yet in the normal flow (you can't log a send against a non-active route the app won't show). But to be safe against any future path, confirm the `ascents.route_id` FK behavior. If it is `ON DELETE CASCADE`, deleting a pending route silently deletes any ascents — acceptable only because pending routes shouldn't have ascents. Doc-Sync/Engineer should verify no code path lets an ascent attach to a pending route; if one could, withdrawal semantics need review. Flagged as a low-probability integrity check, not a blocker.

---

### 8. Forward-compatibility — what Engineering must NOT do in Phase 1

To keep Phase 1.5 in-app admin a zero-rework, additive change:

1. **Do NOT create a `service_role`-only trigger or hardcoded `auth.role() = 'service_role'` check to perform admin status transitions.** Admin approve/reject/retire must be plain `UPDATE`s gated by `public.is_admin()` (§2/§3). In Phase 1 those UPDATEs simply only ever originate from Studio (service_role bypasses RLS); in Phase 1.5 the same policy admits an admin-claimed client with no change. A trigger that assumes service_role would have to be torn out for in-app admin.
2. **Do NOT drop or inline the `public.is_admin()` helper.** Ship it in Phase 1 even though it always returns false for real clients. Phase 1.5 = grant the `app_metadata.role='admin'` claim to Leon's user; policies already reference the helper. If policies hardcode `false` or omit the admin branch, 1.5 requires a policy migration.
3. **Do NOT enforce admin transitions in application/client code.** No "if service_role then allow" logic in the app; enforcement lives in RLS + the `is_admin()` predicate. Client admin logic can't be reused server-side and would be bypassable.
4. **Do NOT store the auto-approve toggle anywhere but `app_settings`** (no env var, no deploy-time constant, no client flag). Phase 1.5 admin UI must be able to flip it with one authorized write; a non-DB store can't be toggled in-app.
5. **Do NOT let `submit_route` accept a client-supplied `user_id` or client-supplied `status`.** Both are server-derived (auth.uid() and the toggle). A client-settable status makes the whole gate cosmetic and can't be tightened later without breaking existing callers.
6. **Do NOT add rejection/retirement metadata as a separate table now, but leave room for it.** If Phase 1.5 wants reviewer notes / rejection reasons, add nullable columns (`reviewed_by_user_id`, `reviewed_at`, `review_note`) to `routes` then — the `status`-on-`routes` model (B2) accommodates this additively. Do not build a `route_reviews` table speculatively in Phase 1.
7. **Do NOT rely on the RPC's `IF EXISTS` pending check as the sole constraint** — the partial unique index (§6) must exist so the guarantee holds for the future in-app admin and any Studio-side inserts.

---

### Concerns (must address in the change-mode migration)

- **Pending/rejected/retired leak via the existing SELECT policy** — `routes_select_authenticated` currently returns all rows to all authenticated users. It MUST be dropped and replaced by `routes_select_visible` (§3) in the same migration that adds `pending`, or unreviewed/rejected/retired routes pollute every gym list and the AC-020 match pool. Top correctness risk.
- **Enum add-and-use in one transaction will fail on PG15** — must split into Migration A (enum values) + Migration B (everything using them) per §1. Canary error: `unsafe use of new value ... of enum type`.
- **`submit_route` must not accept `user_id` from the client** — derive from `auth.uid()`. The brief's listed signature includes `user_id`; implementing that verbatim is an impersonation vulnerability (§4).
- **Grants lag the new policies** — `routes` currently lacks a DELETE grant (needed for withdrawal, §7) and still carries INSERT/UPDATE grants that should be revoked (§3). RLS without matching GRANTs (or with stale GRANTs) silently breaks the intended access shape.

### Recommendations

- Implement as two migration files: `..._route_status_enum.sql` (Migration A) and `..._route_approval_gate.sql` (Migration B). Verify with `supabase db reset`.
- Standardize the admin check on `public.is_admin()` now; grant the claim to Leon only in Phase 1.5.
- Keep `app_settings` fully client-invisible (RLS enabled, no policies, no grants); read it only inside `submit_route`.
- Enforce one-pending-per-combo with both the partial unique index (guarantee) and the RPC pre-check (clean UX error).
- Document the approval-time active-uniqueness collision (approving a 2nd competing pending into `active` raises `unique_violation` in Studio) in the MOD-003 spec as expected Phase 1 behavior, not a bug.

### Approved (looks solid as-is)

- B2 (`pending` on `routes`) + T3 (`app_settings`) remain the right calls under Revision 4; no reason to revisit the separate-table option.
- The existing `routes_active_unique_idx` needs **no change** — its `WHERE status = 'active'` predicate already does the right thing for the expanded status set.
- Withdrawal-by-DELETE via an RLS policy (no RPC) is correct — only the missing DELETE grant needs adding.
- The `SECURITY DEFINER` submission RPC mirrors the shipped `handle_new_auth_user` pattern; no new architectural concept is introduced.
- `ascents.route_id → routes.id` FK integrity is preserved: a route keeps one stable id from submission through approval (no id remapping, unlike a promote-on-approve separate-table design).

### Proposed Shared Conventions (for Doc-Sync to carry into production.md)

- **Admin identity**: gate admin-only RLS on a `public.is_admin()` helper reading `app_metadata.role = 'admin'` from the JWT (set only by service_role). Do not use a `user_metadata` claim (self-editable) or a lookup table (adds per-policy subquery) unless a specific need arises. Write admin-gated policies against the helper from day one even when no client yet carries the claim, so granting in-app admin later is additive.
- **Enum evolution on PG15/Supabase**: adding an enum value and using it must be split across two migration files (add in file N, use in file N+1); never add-and-use an enum value in a single Supabase migration transaction.
- **Server-enforced write gates**: when a write must honor an operator toggle or assign a server-controlled field (status, owner), route it through a `SECURITY DEFINER` RPC that derives the owner from `auth.uid()` and reads settings server-side; never accept owner/status/toggle-outcome as client arguments, and revoke the direct table grant for that verb.
- **Runtime operator toggles**: store in a single `app_settings(key, value)` table with RLS enabled and no client policies/grants; read only inside definer functions so the setting is never exposed to clients.

## Tech Lead Review — Rev 7 Tab Shell + Saved Gyms + Home Module (2026-09-24)

**Context**: PRD Revision 7 [SUBSTANTIVE] adds the persistent three-tab bottom shell (Home / Gyms / Profile), the `SavedGym` join table, removes `User.home_gym_id`, and introduces MOD-012 (mod-home) as an aggregator. The PM flagged three items for Tech Lead review: tab shell mount point + module boundaries, `saved_gyms` table/RLS, and the `home_gym_id` removal impact. This review answers all four areas the coordinator raised. Advisory only — no source, migration, spec, or PRD files changed here. Doc-Sync carries the Proposed Shared Conventions and schema decisions into the MOD-012 spec + production.md; Engineering implements in module `change`-mode work. Findings are grounded in the shipped code (`App.tsx`, `AuthNavigator.tsx`, `GymNavigator.tsx`, `auth-service.ts`, migrations 001/002) as of this date.

---

### Area 1 — App-level tab shell: mount point, state ownership, mount strategy, bottom inset

**(a) Directory structure — recommend `AppShell` lives in MOD-012 (`src/modules/mod-home/`), NOT a new top-level `src/shell/`.**

Rationale:
- PRD §6 makes MOD-012's purpose explicit: *"Own the persistent three-tab bottom navigation shell (Home / Gyms / Profile) and the Home tab surface."* The shell is not orphan infrastructure — the PRD assigns it an owner. Creating a separate `src/shell/` directory would split the shell across two ownership boundaries (a top-level dir owned by nobody vs. mod-home owning only the Home surface), which fights the single-owner model the whole framework depends on. Keep the shell and the Home surface in one module so one engineer (`engineer-mod-home`) owns the seam.
- Concretely: `src/modules/mod-home/AppShell.tsx` (the tab shell), `src/modules/mod-home/HomeNavigator.tsx` (Tab 1 content), `src/modules/mod-home/screens/HomeScreen.tsx`, plus a `components/TabBar.tsx`. The shell imports the *public navigator entry points* of MOD-002 and MOD-001 (see Area 4 for the import rule).
- `App.tsx` changes minimally: it currently renders `<GymNavigator session={session} />` inside `AppShell()` — that inline `AppShell` in `App.tsx` gets replaced with an import of `mod-home`'s `AppShell`. `App.tsx` stays the composition root (SafeAreaProvider → ThemeProvider → AuthNavigator → AppShell) but no longer contains navigator-selection logic. Note: `App.tsx` itself is not module-owned; the coordinator/engineer-mod-home edit to swap the import is a small root change that belongs to the MOD-012 build (same host-screen/owning-module pattern used for AC-005).

**(b) Active-tab state — recommend it lives inside `AppShell` (a `useState<TabKey>` in `mod-home/AppShell.tsx`), NOT in `App.tsx`.**

Rationale:
- Consistent with the shipped pattern: every navigator in this codebase is a self-contained view-state machine (`GymNavigator` holds its own `GymView` state; `AuthNavigator` holds `authView`). `App.tsx` deliberately holds no navigation state today. Putting tab state in `App.tsx` would break that convention and force `App.tsx` to re-render the whole tree on every tab switch.
- Default tab = `'home'` (AC-110: "Home tab is the default tab after login"). The state machine shape mirrors `GymView`: `type TabKey = 'home' | 'gyms' | 'profile'`.

**(c) Mount strategy — recommend keep-alive (all three tab trees mounted, hidden via `display: 'none'`), NOT unmount/remount.**

Rationale:
- **Scroll position + navigation depth preservation is the deciding factor.** Tab 2 (Gyms) hosts `GymNavigator`, which itself descends into `GymDetailScreen` → `RouteNavigator` → `RouteDetailScreen`. If the Gyms tab unmounts on switch, a user who drilled into a route, flips to Home, and flips back loses their entire nav stack and scroll position — a jarring, sub-standard mobile UX. Keep-alive preserves each tab's internal state machine across switches for free (the `GymView`/`RouteView` `useState` survives because the component isn't unmounted).
- **Implementation**: render all three tab subtrees, wrap each in a `View` whose style toggles `display: activeTab === key ? 'flex' : 'none'`. `display: 'none'` in React Native fully removes the subtree from layout/paint but keeps it mounted (state intact) — this is the correct RN idiom (do NOT use `flex: 0`, which still lays out and can leak touch targets / measurement).
- **Cost / mitigation**: keep-alive mounts all three trees eagerly at first render, so first-paint does slightly more work. For Phase 1's three tabs this is negligible (Home = 3 static-ish sections; Gyms = one list; Profile = one profile + embedded history). If cold-start (§10 NFR: ≤3s) ever regresses, the mitigation is lazy-mount-on-first-visit + keep-alive-after (mount a tab the first time it becomes active, then never unmount) — but do NOT build that speculatively; plain keep-alive is the Phase 1 recommendation. Flagged so the engineer knows the escape hatch exists.

**(d) Session threading — recommend continue the shipped prop-passing pattern; do NOT introduce a session context for this.**

- `GymNavigator` already takes `session: Session` as a prop (confirmed in `GymNavigator.tsx`). `AppShell` receives `session` (it renders only when `AuthNavigator` has confirmed a session) and passes it to each of the three tab navigators as a prop, exactly as `App.tsx` does today for `GymNavigator`. `useSession` remains the singleton subscription for reactive session changes (as `AuthNavigator` comments already note). No new context is warranted — three consumers, one hop, is not prop-drilling pain.

**(e) Bottom tab bar inset — extends the existing `makeStyles(theme, topInset)` convention to a bottom inset.**

- The tab bar is pinned to the bottom of the screen and must clear the home-indicator safe area (`insets.bottom`, ~34px on Face ID devices). The existing production.md "Screen Layout & Safe Area Insets" convention only standardizes `insets.top` passed as `makeStyles(theme, topInset)`. The tab bar needs `insets.bottom`.
- **Recommendation**: the `TabBar` component calls `useSafeAreaInsets()` and applies `paddingBottom: insets.bottom` (plus a spacing token for the icon row) to its container, so the tab bar's touch targets sit above the home indicator. This is additive to the existing convention, not a replacement — top-inset handling on the *screens inside each tab* is unchanged. See Proposed Shared Convention "Bottom Safe Area for Pinned Bottom Bars" below.
- **Interaction with per-screen top inset**: each tab's screens keep passing `insets.top` into their own `makeStyles` per the existing convention. Additionally, screens inside a tab whose content scrolls to the very bottom should reserve room for the tab bar height + `insets.bottom` in their scroll `contentContainerStyle` `paddingBottom` so the last row isn't hidden behind the bar. Flag this in the MOD-012 spec as an integration note for MOD-002/MOD-001 screens hosted in tabs (low-risk, but a known "content hidden behind tab bar" pitfall).

---

### Area 2 — `saved_gyms` join table: schema and RLS

**Confirmed as specified in PRD §9, with the following exact implementation decisions:**

- **`ON DELETE CASCADE` on both FKs — confirmed correct.** `gym_id → gyms.id ON DELETE CASCADE` (deleting a gym removes its saves) and `user_id → users.id ON DELETE CASCADE` (deleting a user removes their saves) are both right — a save row is meaningless without either parent. Note `users.id` itself is `REFERENCES auth.users(id) ON DELETE CASCADE` (confirmed in migration 001), so account deletion cascades cleanly through `users` → `saved_gyms`.
- **PK `(user_id, gym_id)` — confirmed.** Composite PK enforces "a user saves a gym at most once" (idempotent save) at the DB level; no separate unique constraint needed.
- **RLS policy set — confirmed: SELECT / INSERT / DELETE for own rows only, no UPDATE.** This is exactly right and matches PRD §9 + §10 NFR ("authenticated user may read and write only their own rows"). Exact policies:
  - SELECT `saved_gyms_select_own`: `USING (user_id = auth.uid())`
  - INSERT `saved_gyms_insert_own`: `WITH CHECK (user_id = auth.uid())`
  - DELETE `saved_gyms_delete_own`: `USING (user_id = auth.uid())`
  - **No UPDATE policy** — a save has no mutable fields (unsave = DELETE, not UPDATE). Correct to omit.
  - `ALTER TABLE public.saved_gyms ENABLE ROW LEVEL SECURITY;` from creation (project convention).
- **Grants**: `GRANT SELECT, INSERT, DELETE ON public.saved_gyms TO authenticated;` — must be granted explicitly (RLS filters rows, GRANT authorizes the verb; the route-catalog review already documented this exact gotcha). Do NOT grant UPDATE. Do not grant to `anon`.
- **Index — recommend adding one covering index; do NOT rely on PK alone.** The Home screen queries `WHERE user_id = auth.uid()` on every Home render (AC-113). The composite PK `(user_id, gym_id)` is a usable index for that predicate because `user_id` is the *leading* column of the PK — so a bare `WHERE user_id = ?` *can* use the PK index. **However**, the Home strip needs to render each saved gym's `photo_url` + name (AC-113), which requires joining to `gyms`. The efficient shape is: `saved_gyms` filtered by `user_id`, then joined to `gyms` on `gym_id`. The leading-column PK index already serves the `user_id` filter, so a *separate* single-column index on `user_id` would be redundant. **Net recommendation: PK is sufficient for the `user_id` filter — no extra index required.** Add a standalone `gym_id` index ONLY if a "who saved this gym" reverse lookup is ever needed (it is not in Phase 1 — no AC reads saves by gym). Documenting this so the engineer does not add a redundant `user_id` index out of caution.
- **Migration file — recommend a NEW migration owned by MOD-012, named `2026XXXXXX_mod_012_home.sql`** (follow the `_mod_0NN_<module>` convention, e.g. `20260924000001_mod_012_home.sql`). Rationale: `saved_gyms` is MOD-012's data (PRD §6: "saved gyms live in MOD-012"; the `SavedGym` entity backs US-019/US-020 owned by MOD-012). Do NOT name it `_mod_002_saved_gyms` — MOD-002 owns the *interaction* (bookmark toggle UI, AC-120/121/122) but MOD-012 owns the *table*. Keeping the table in the mod-012 migration matches the "table owned by the module that owns the entity" pattern (cf. `gym_requests` in the mod-002 migration). MOD-002's bookmark screens read/write `saved_gyms` cross-module — that is a service-layer import concern (Area 4), not a reason to move the table's migration.
  - **Ordering note**: this migration must land after migrations 001 (users) and 002 (gyms) since both FKs reference them. Its timestamp (2026092400xxxx) is naturally later than the existing 20260923 files — no ordering hazard.

---

### Area 3 — `home_gym_id` removal: full impact map

The column drop touches **migrations, one service function, types, the onboarding gate, a whole screen, tests, and locale files.** Complete inventory (grounded in a repo-wide grep):

**Migrations (Engineer, MOD-001 / drop migration):**
- `20260920000001_mod_001_user_profile.sql` line 23 — declares `home_gym_id UUID`.
- `20260920000002_mod_002_gym_directory.sql` lines 51–58 — adds `users_home_gym_id_fkey` FK (`ON DELETE SET NULL`).
- **Do NOT edit the historical migrations.** They represent applied state. Add a **new forward migration** that drops the column: `ALTER TABLE public.users DROP COLUMN home_gym_id;`.
  - **FK cascade concern — confirmed benign.** `DROP COLUMN home_gym_id` automatically drops the dependent `users_home_gym_id_fkey` constraint (Postgres drops constraints that depend on a dropped column). No separate `DROP CONSTRAINT` needed, and no data-integrity fallout — the FK was `ON DELETE SET NULL`, so nothing cascades *out* of `users` when the column disappears. Confirmed as the coordinator's brief states.
  - **RLS check — clear.** Grepped migration 001 policies (`users_select_authenticated`, `users_update_own`, `users_insert_own`) and the `handle_new_auth_user` trigger: **none reference `home_gym_id`.** The trigger inserts only `(id, display_name)`. So the drop needs no policy or trigger changes. Flagged clean.
  - **Where to place the drop migration**: recommend a MOD-001-owned migration (`2026XXXXXX_mod_001_drop_home_gym.sql`) since `users` is MOD-001's table, OR fold the `DROP COLUMN` into the `mod_012_home.sql` migration alongside `saved_gyms` creation (the SavedGym table is described in §9 as replacing `home_gym_id`, so co-locating the swap is defensible). **Recommend the standalone MOD-001 migration** to keep table ownership clean (`users` = MOD-001). PM/Doc-Sync to confirm which module's engineer owns the drop; my lean is MOD-001 owns the `users` DDL, MOD-012 owns `saved_gyms`.

**Source files that reference `home_gym_id` (Engineer must remove — these will break the build once the column is gone):**
- `src/modules/mod-auth-profile/auth-service.ts` — line 206 (`loadProfile` select string includes `home_gym_id`), line 233 (`upsertProfile` select string), lines 247–256 (the entire `setHomeGym()` function). Remove `home_gym_id` from both select strings; delete `setHomeGym()` entirely (no home gym concept).
- `src/modules/mod-auth-profile/types.ts` — line 13 (`home_gym_id: string | null` on `UserProfile`), line 30 (`HomeGymSelection: { isOnboarding: boolean }` route param). Remove both.
- `src/modules/mod-auth-profile/AuthNavigator.tsx` — lines 8–9, 11 (doc comments), line 22 (import of `HomeGymSelectionScreen`), lines 80–89 (the onboarding gate `if (!onboardingComplete && !effectiveProfile?.home_gym_id)` that routes to `HomeGymSelectionScreen`). **This is the AC-001 behavior change**: per revised AC-001, first run must go directly to Home with no gym-selection step. The entire home-gym onboarding branch must be deleted so a fresh session falls straight through to `children` (the AppShell → Home tab). The `onboardingComplete` state and `HomeGymSelectionScreen` render both become dead and should be removed.
- `src/modules/mod-auth-profile/screens/HomeGymSelectionScreen.tsx` — the whole screen. Delete the file (no longer reachable; AC-001 revised removes the flow). Also drop the tests targeting it.
- `src/modules/mod-auth-profile/__tests__/auth-service.test.ts` — lines 59, 182, 225, 250–273 (imports `setHomeGym`, `home_gym_id: null` fixtures, the `describe('setHomeGym')` block). Remove.
- `src/modules/mod-auth-profile/__tests__/useSession.test.ts` — lines 85, 121 (`home_gym_id: null` in profile fixtures). Remove the field from fixtures.

**Locale files (Engineer, cross-cutting per the i18n Skill Recommendation):**
- `locales/en/common.json` and `locales/zh-TW/common.json` — the `homeGym` object (line 38) and the `homeGym` / `noHomeGym` / `changeHomeGym` keys (lines 56–58). Remove the now-orphaned home-gym strings in both locales to keep catalogs clean. (These map to the deleted `HomeGymSelectionScreen` and profile home-gym UI.)

**First-run flow (AC-001) restatement for the engineer**: the revised first-run path is `AuthNavigator` (session detected) → straight to `children` → `AppShell` → default tab = Home. The removed `HomeGymSelectionScreen` gate is what currently intercepts first-run; deleting it *is* the AC-001 implementation. `App.tsx` / `AppShell` need no special first-run logic — "land on Home" is just "default `TabKey = 'home'`" (Area 1b).

**Ownership note**: all the mod-auth-profile source/test/type changes are MOD-001-owned (`engineer-mod-auth-profile`). The `AppShell` swap in `App.tsx` and the Home tab are MOD-012-owned (`engineer-mod-home`). The `users.home_gym_id` DROP migration is MOD-001-owned DDL. These should be sequenced: MOD-001 removes home-gym (unblocks a clean profile surface for AC-116–119) → MOD-012 builds the shell that mounts the now-home-gym-free profile navigator.

---

### Area 4 — MOD-012 as aggregator: module-boundary rule

**Recommendation: keep MOD-012 as a thin aggregator module (do NOT fold Home sections into MOD-002/MOD-006), with a strict "public surface only" cross-module import rule.**

**(a) Aggregator vs. folding into owning modules — recommend aggregator.**
- Folding (MOD-002 owns a `HomeGymStrip`, MOD-006 owns a `FollowingStrip`, rendered into a Home screen owned by... whom?) leaves the Home *screen composition* and the *tab shell* ownerless, which is exactly the problem the PRD solved by creating MOD-012. The PRD already assigns MOD-012 ownership of the Home surface and shell (§6) with deps on MOD-001/002/006 — the aggregator abstraction is the intended design. Ratify it.
- The aggregator stays *thin*: it owns layout/composition (the three sections, empty states AC-115/AC-124, the static banners AC-112) and navigation *out* to MOD-002 gym detail (AC-114) and MOD-008/MOD-001 profiles (AC-123). It does NOT own gym data-fetching or follow-graph logic — those stay in their modules' service layers.

**(b) Cross-module import rule — recommend: MOD-012 may import owning modules' *service functions and navigator entry points*, NOT their internal screens/components.**
- **Allowed**: `mod-home` imports `gym-service.ts` functions from `mod-gym-directory` (to fetch the saved-gyms-with-gym-data for the strip) and the follow-list function from `mod-social-feed` (MOD-006, `mod-social-feed/*-service.ts`). It imports the *navigator entry points* it mounts as tabs: `GymNavigator` (MOD-002) and the Profile navigator (MOD-001). This mirrors the shipped pattern where `GymNavigator` already imports `RouteNavigator` (MOD-003) as a public entry point — the precedent for cross-module navigator mounting is established and working.
- **Disallowed**: reaching into another module's `screens/` or `components/` internals (e.g. importing `GymDetailScreen` directly, or a private list-row component). Cross-module coupling goes through service functions (data) and navigator components (mounting) only — the two documented public surfaces. This keeps MOD-002/MOD-006 free to refactor their internals without breaking Home.
- **Consequence for the saved-gyms fetch**: the Home strip's "saved gyms with photo_url + name" query is a join of `saved_gyms` (MOD-012's table) to `gyms` (MOD-002's table). Recommend this read lives in **MOD-012's own service layer** (`mod-home/home-service.ts`) issuing the join query directly against both tables via the Supabase client — this is a read-only cross-table SELECT gated by `saved_gyms` RLS (user sees only own saves) and `gyms` RLS (all authenticated can read gyms), so it is safe and needs no MOD-002 function. The *write* side (bookmark toggle on `saved_gyms`, AC-120/121) is MOD-002-owned per the PRD and lives in `mod-gym-directory`'s service layer. So: **MOD-012 reads `saved_gyms` (+ join gyms) for the strip; MOD-002 writes `saved_gyms` for the toggle.** Both modules touch the same table but on different verbs with the same RLS fence — acceptable and explicit. Flag this shared-table access in both specs so it isn't mistaken for a boundary violation.
- **Following-climbers section (AC-123)**: sourced from MOD-006's follow data. MOD-012 calls a MOD-006 service function returning the followed-users list (avatar + display_name). MOD-006 is Not started, so this contract is defined when MOD-006 ships; flag in the MOD-012 spec that the follow-list read is a MOD-006 public-service dependency (MOD-012 must not query the `follows` table directly — that read must respect MOD-006's block-filtering composition rule, the same reason the feed uses a SECURITY INVOKER RPC per the existing MOD-006 implementation note). **Important**: the followed-climbers read should go through MOD-006's service (which applies block filtering), NOT a raw `follows` SELECT in mod-home, to stay consistent with the block-symmetry requirement (AC-082/084).

**(c) Banner data location — recommend `src/lib/banners.ts` (a constant file outside any module), NOT inline in the Home screen.**
- AC-112: up to 3 static hardcoded banners, section hidden if none. Putting the banner array in `src/lib/banners.ts` (alongside the existing `src/lib/theme.ts`, `src/lib/i18n.ts`, `src/lib/supabase.ts` shared-lib pattern) keeps the Home screen component presentational and makes the banner set editable in one obvious place without touching component logic. `mod-home` imports it. `src/lib/` is the established home for cross-cutting non-module constants — banners fit there. (Banner *copy* that is user-facing should reference i18n keys, not hardcoded English/zh-TW strings, per the localization convention — the `banners.ts` file holds structure/keys/image refs, the strings live in the locale catalogs.)

---

### Concerns (must address during MOD-012 / MOD-001 change work)

- **`home_gym_id` drop breaks the build until all six source/test files are updated in the same change** — the column drop and the `auth-service.ts` / `types.ts` / `AuthNavigator.tsx` / `HomeGymSelectionScreen.tsx` / test / locale edits must ship together, or `loadProfile`/`upsertProfile` will SELECT a non-existent column at runtime and TypeScript will still reference a removed field. Sequence the MOD-001 removal as one atomic change.
- **`saved_gyms` needs explicit GRANTs, not just RLS policies** — the route-catalog review already caught this class of bug (RLS filters rows; GRANT authorizes the verb). `GRANT SELECT, INSERT, DELETE ON public.saved_gyms TO authenticated;` must be in the migration, or the bookmark toggle and Home strip silently fail.
- **Keep-alive tab shell must use `display: 'none'`, not conditional unmount** — unmounting loses the Gyms tab's drill-down nav stack (Gym → Route → RouteDetail) and scroll position on every tab switch. This is a UX-correctness requirement, not a preference (Area 1c).
- **Following-climbers read must go through MOD-006's block-filtered service, not a raw `follows` SELECT** — a direct query in mod-home would bypass block symmetry (AC-084) and duplicate the composition MOD-006 owns. Defer this section's data wiring until MOD-006 ships its service, or stub it behind the empty state (AC-124) in the interim.

### Recommendations

- Mount `AppShell` in `src/modules/mod-home/`; tab state in `AppShell` (`useState<TabKey>`, default `'home'`); keep-alive mount strategy via `display: 'none'`; thread `session` as a prop to each tab navigator (no new context).
- Create `saved_gyms` in a MOD-012 migration (`2026XXXXXX_mod_012_home.sql`); PK-only index is sufficient (no extra `user_id` index); three RLS policies (select/insert/delete own) + explicit grants; no UPDATE.
- Drop `home_gym_id` in a standalone MOD-001 forward migration; remove the six source/test/locale reference sites; delete `HomeGymSelectionScreen`; delete the onboarding gate in `AuthNavigator` (that deletion *is* revised AC-001).
- Ratify MOD-012 as a thin aggregator; enforce "public service functions + navigator entry points only" for cross-module imports; put banners in `src/lib/banners.ts` (structure/keys) with strings in locale catalogs; MOD-012 reads `saved_gyms`+join, MOD-002 writes `saved_gyms`.

### Approved (looks solid as-is)

- The three-tab shell extends the shipped state-machine-per-navigator pattern cleanly — no navigation library needed, consistent with `GymNavigator`/`RouteNavigator`/`AuthNavigator` already in the tree. No architectural concern with the local-state navigation approach for tabs.
- `SavedGym` schema in PRD §9 (dual `ON DELETE CASCADE`, composite PK, own-rows RLS) is correct exactly as written — confirmed, only the grants + migration placement needed pinning.
- `DROP COLUMN home_gym_id` is a clean drop — no RLS policy or trigger references it (verified), and the dependent FK drops automatically with no cascade fallout (the FK was `ON DELETE SET NULL`).
- The precedent for cross-module navigator mounting already exists and works: `GymNavigator` imports and mounts `RouteNavigator` (MOD-003). MOD-012 mounting MOD-002/MOD-001 navigators is the same, proven pattern.

### Proposed Shared Conventions (for Doc-Sync to carry into production.md)

- **App shell & tab navigation**: the persistent tab shell lives in the module that owns it (MOD-012 `mod-home`), not a separate top-level dir. Tab state is a local `useState<TabKey>` in the shell component (state-machine-per-navigator convention). Tabs use a keep-alive mount strategy — all tab subtrees stay mounted and are hidden with `display: 'none'` (never conditional unmount, never `flex: 0`) so each tab's internal navigation stack and scroll position survive tab switches. Session is threaded to tab navigators as a prop; `useSession` remains the singleton for reactive session changes.
- **Bottom safe area for pinned bottom bars**: any UI element pinned to the bottom of the screen (tab bar, sticky footer) must call `useSafeAreaInsets()` and apply `paddingBottom: insets.bottom` (plus a spacing token) so touch targets clear the home indicator. Screens hosted inside a tab must add the tab-bar height + `insets.bottom` to their scroll `contentContainerStyle` `paddingBottom` so bottom content isn't hidden behind the bar. This complements the existing top-inset `makeStyles(theme, topInset)` convention.
- **Cross-module imports**: a module may import another module's *public service functions* (data) and *navigator entry-point components* (mounting) only — never its internal `screens/` or `components/`. Aggregator modules (MOD-012) compose other modules exclusively through these two public surfaces. When two modules must touch the same table, split by verb with the shared RLS fence (e.g. MOD-012 reads `saved_gyms`, MOD-002 writes it) and document the shared-table access in both specs.
- **Shared non-module constants**: cross-cutting static data that belongs to no single module (e.g. hardcoded banner definitions) lives in `src/lib/` (alongside `theme.ts`, `i18n.ts`). Such files hold structure/keys/image refs only; user-facing strings stay in the i18n locale catalogs, never inlined.

## Module Map

| MOD-ID  | Directory              | Status      | Agent last acted          |
|---------|------------------------|-------------|---------------------------|
| MOD-001 | mod-auth-profile       | QA Pending Human Sign-off | qa-mod-auth-profile       |
| MOD-002 | mod-gym-directory      | QA Passed   | qa-mod-gym-directory      |
| MOD-003 | mod-route-catalog      | QA Pending Human Sign-off | qa-mod-route-catalog |
| MOD-004 | mod-send-logging       | QA Pending Human Sign-off | qa-mod-send-logging |
| MOD-005 | mod-beta-video         | QA Pending Human Sign-off | qa-mod-beta-video         |
| MOD-006 | mod-social-feed        | QA Pending Human Sign-off | qa-mod-social-feed        |
| MOD-007 | mod-notifications      | Not started | —                         |
| MOD-008 | mod-profile-history    | Not started | —                         |
| MOD-009 | mod-moderation         | Not started | —                         |
| MOD-010 | mod-localization-theme | Not started | —                         |
| MOD-011 | mod-analytics          | Not started | —                         |
| MOD-012 | mod-home               | QA Pending Human Sign-off | qa-mod-home               |

## Sync Reports

### 2026-09-21 — Delta Sync (Revision 3, [SUBSTANTIVE])

**Trigger**: PM [SUBSTANTIVE] tag — two new acceptance criteria added to PRD Revision 3. Module boundaries, dependencies, and phase plan unchanged.

**Files modified:**
- `project-planning/modules/mod-send-logging/spec.md` — AC-013 appended after AC-012 in the Acceptance Criteria Covered section.
- `project-planning/modules/mod-beta-video/spec.md` — AC-036 appended after AC-035 in the Acceptance Criteria Covered section.

**Files not touched:**
- `project-planning/production.md` — no shared conventions changed.
- All other module specs — change confined to MOD-004 and MOD-005 per PM note.

**Ambiguities / Conflicts**: None.

**verify-sync.sh**: Skipped — not applicable to targeted two-file delta (no structural addition of modules, phases, or conventions). [Note: verify-sync.sh is applicable on initial and full-structural syncs; a two-AC delta touching no new files does not warrant a full tree traversal.]


### Sync Report — Delta Sync — 2026-09-22

**Sync type:** delta
**PRD Revision:** 4
**PM Update reference:** 2026-09-23 [SUBSTANTIVE] — Route submission approval gate + status lifecycle (PRD Revision 4)
**Files modified:**
- `project-planning/modules/mod-route-catalog/spec.md` — Purpose updated to 4-value lifecycle framing; Context updated (auto-approve, pending/retired/rejected visibility, submit_route RPC, admin-only retirement, per-submitter pending constraint); Non-goals expanded (in-app admin UI Phase 1.5, global one-pending out of scope); User Stories updated (US-014 removed, US-003 and US-006 retained); Acceptance Criteria section replaced entirely with AC-020 (revised), AC-021–AC-023 (unchanged), AC-024b (new), AC-025–AC-029 (new), AC-040 (revised), AC-041 (revised); Data Model updated to 4-value route_status enum with per-value semantics, app_settings table added, RLS policy set documented; Input/Output Contract updated (RPC-based submission, withdrawal, normal-user list); Key Implementation Notes section added covering enum migration split, admin identity (is_admin() helper), RLS policy set, submit_route RPC, app_settings, withdrawal, one-pending-per-combo index, grant changes, and forward-compatibility constraints.
- `project-planning/production.md` — Last synced revision updated (rev 2 → rev 4); Architecture Overview updated to reflect 4-value route status and admin-only transitions; Module Index MOD-003 description updated to reflect 4-value lifecycle; Four new Shared Conventions added: Enum Migration Ordering, Admin Identity, SECURITY DEFINER RPCs, app_settings Table Pattern.
**Files created:**
- none
**Module removals noted:**
- none
**AMBIGUITY markers added:**
- none
**AMBIGUITY markers resolved:**
- none
**CONFLICT markers added:**
- none
**verify-sync.sh result:** 4/6 — two pre-existing script bugs prevent Checks 4 and 6 from passing regardless of document content.
- Check 1 PASS: all MOD-IDs in prd.md have a Module Map entry and spec.md.
- Check 2 PASS: all spec.md files have a corresponding Module Map entry.
- Check 3 PASS: all Tech Stack entries from prd.md appear in production.md.
- Check 4 FAIL (script bug): awk range  terminates immediately because the start line matches the end condition. All specs have correct  headings and US-IDs in the right place — the script cannot extract the section content. Pre-existing bug; not introduced by this sync.
- Check 5 PASS: no unlogged AMBIGUITY markers.
- Check 6 FAIL (script bug): script over-matches "phase" content from PRD sections beyond §7 (including §11 Seed Gym Table and other sections with "Phase 1" references), extracting false positives as "phase names" that are not in the Phase Plan section. Phase Plan section is correctly written with Phase 1/2/3 content. Pre-existing bug; not introduced by this sync. 4/6 checks passed. Two pre-existing failures unrelated to this delta:
  - Check 4 FAIL: all module specs use `## User Stories Covered` but the script expects `## Related User Stories` — pre-existing mismatch across all specs, not introduced by this sync.
  - Check 6 FAIL: no Phase Plan section in status.md — pre-existing; Phase Plan was not written during initial sync and was not in scope for this delta.

### Sync Report — Delta Sync — 2026-09-22

**Sync type:** delta
**PRD Revision:** 5
**PM Update reference:** 2026-09-22 [SUBSTANTIVE] — Cross-module navigation ACs + navigation-gap audit (PRD Revision 5)
**Files modified:**
- `project-planning/modules/mod-gym-directory/spec.md` — Added AC-006 (doc gap, code already works) and AC-005 (code gap) to Acceptance Criteria; expanded US-006 note in User Stories Covered to reflect gym-detail-to-routes navigation; added AC-005 implementation note to Key Implementation Notes; updated Last Synced from PRD Revision to 5.
- `project-planning/modules/mod-route-catalog/spec.md` — Added AC-042 (doc gap, code already works inside RouteNavigator) to Acceptance Criteria with reachability caveat note; updated Last Synced from PRD Revision to 5.
- `project-planning/modules/mod-beta-video/spec.md` — Added AC-037 (code gap, future module) to Acceptance Criteria with boundary note on host-screen/owning-module split; updated Last Synced from PRD Revision to 5.
- `project-planning/modules/mod-notifications/spec.md` — Added AC-058 (code gap, future module) to Acceptance Criteria; added navigation contract flag to Key Implementation Notes; updated Last Synced from PRD Revision to 5.
- `project-planning/modules/mod-profile-history/spec.md` — Added AC-064 (code gap, future module) to Acceptance Criteria with boundary note; added US-012 to User Stories Covered (privacy gating applies at AC-064 destination); updated Last Synced from PRD Revision to 5.
**Files created:**
- none
**Files not touched:**
- `project-planning/production.md` — no new shared conventions; no module boundary or phase plan changes.
- All other module specs — change confined to the five modules identified in PM Updates.
**Module removals noted:**
- none
**AMBIGUITY markers added:**
- none
**AMBIGUITY markers resolved:**
- none
**CONFLICT markers added:**
- none
**verify-sync.sh result:** 4/6 — two pre-existing script bugs prevent Checks 4 and 6 from passing regardless of document content.
- Check 1 PASS: all MOD-IDs in prd.md have a Module Map entry and spec.md.
- Check 2 PASS: all spec.md files have a corresponding Module Map entry.
- Check 3 PASS: all Tech Stack entries from prd.md appear in production.md.
- Check 4 FAIL (script bug): awk range  terminates immediately because the start line matches the end condition. All specs have correct  headings and US-IDs in the right place — the script cannot extract the section content. Pre-existing bug; not introduced by this sync.
- Check 5 PASS: no unlogged AMBIGUITY markers.
- Check 6 FAIL (script bug): script over-matches "phase" content from PRD sections beyond §7 (including §11 Seed Gym Table and other sections with "Phase 1" references), extracting false positives as "phase names" that are not in the Phase Plan section. Phase Plan section is correctly written with Phase 1/2/3 content. Pre-existing bug; not introduced by this sync. Skipped per delta-sync scope — this sync touches only AC additions within existing modules; no new module directories, no phase plan changes, no production.md changes. Pre-existing Check 4 FAIL (heading name mismatch) and Check 6 FAIL (no Phase Plan section) noted from prior sync remain unchanged and are not introduced by this delta.

### Sync Report — Template Convention Pass — 2026-09-23

**Sync type:** trivial (template-convention retroactive pass; not triggered by a PRD change)
**PRD Revision:** 5 (unchanged)
**Trigger:** Retroactive addition of `## Integration Points` section to all existing module specs, per updated spec template convention. No PRD change was made.

**Files modified — `## Integration Points` section inserted after `## Acceptance Criteria Covered` and before `## Key Implementation Notes` (or at end of file where no Key Implementation Notes section exists):**
- `project-planning/modules/mod-auth-profile/spec.md` — section added: `none`
- `project-planning/modules/mod-gym-directory/spec.md` — section added: 2 populated entries (AC-005: GymNavigator.tsx + GymDetailScreen.tsx)
- `project-planning/modules/mod-route-catalog/spec.md` — section added: 1 populated entry (AC-037: RouteDetailScreen.tsx slot/prop for MOD-005)
- `project-planning/modules/mod-send-logging/spec.md` — section added: `none`
- `project-planning/modules/mod-beta-video/spec.md` — section added: 2 populated entries (AC-037: RouteDetailScreen.tsx slot fill; AC-034: social feed beta video item)
- `project-planning/modules/mod-social-feed/spec.md` — section added: `none`
- `project-planning/modules/mod-notifications/spec.md` — section added: `none`
- `project-planning/modules/mod-profile-history/spec.md` — section added: `none`
- `project-planning/modules/mod-moderation/spec.md` — section added: `none`
- `project-planning/modules/mod-localization-theme/spec.md` — section added: `none`
- `project-planning/modules/mod-analytics/spec.md` — section added: `none`

**Summary — `none` vs. populated:**

| Module | Integration Points |
|--------|--------------------|
| MOD-001 Auth & Profile | none |
| MOD-002 Gym Directory | populated (2 entries — AC-005) |
| MOD-003 Route Catalog | populated (1 entry — AC-037 slot) |
| MOD-004 Send Logging | none |
| MOD-005 Beta Video | populated (2 entries — AC-037 fill, AC-034) |
| MOD-006 Social Graph & Feed | none |
| MOD-007 Notifications | none |
| MOD-008 Profile History & Stats | none |
| MOD-009 Moderation | none |
| MOD-010 Localization & Theming | none |
| MOD-011 Analytics | none |

**AMBIGUITY markers added:** none
**CONFLICT markers added:** none
**verify-sync.sh:** Skipped — this is a template-convention pass, not a structural PRD sync (no new modules, no phase plan changes, no production.md changes).

### Sync Report — Delta Sync — 2026-09-23

**Sync type:** delta
**PRD Revision:** 6
**PM Update reference:** 2026-09-23 [SUBSTANTIVE] — Route submission UX simplified: single-page submit, client-side match-check removed (PRD Revision 6)
**Affected module:** MOD-003 (mod-route-catalog) only

**Files modified:**
- `project-planning/modules/mod-route-catalog/spec.md` — Last Synced from PRD Revision updated to 6; Purpose updated to "filter-first, single-page, direct-submit" framing; Context rewritten to describe filter-first flow (RouteListScreen filter as the "does this route already exist?" check, single-page submit screen, no client-side match-check step, server-side duplicate protection unchanged); User Stories section updated: US-003 retitled from "Submit a new route with match-before-create" to "Submit a new route"; AC-020 replaced with revised single-page submit screen text (grade chips, hold-color chips, inline photo picker, optional section-label, "Add Route" button, no multi-step flow); AC-021 replaced with revised inline photo picker wording (client-side and server-side enforcement called out explicitly); AC-043 (new) added after AC-042 (pre-fill grade + color chips from RouteListScreen filter state); Input/Output Contract updated (match query result output removed — no client-side match-check step); Key Implementation Notes updated ("Photo required" note updated to reference inline photo picker; new "Single-page submit screen" note added; new "Pre-fill from filter state" note added; match pool reference removed from app_settings comment in Data Model).

**Files not touched:**
- `project-planning/production.md` — no shared conventions changed; module boundaries, dependencies, and phase plan unchanged.
- All other module specs — change confined to MOD-003 per PM note.

**Module removals noted:** none
**AMBIGUITY markers added:** none
**CONFLICT markers added:** none
**verify-sync.sh result:** 4/6 — two pre-existing script bugs prevent Checks 4 and 6 from passing regardless of document content.
- Check 1 PASS: all MOD-IDs in prd.md have a Module Map entry and spec.md.
- Check 2 PASS: all spec.md files have a corresponding Module Map entry.
- Check 3 PASS: all Tech Stack entries from prd.md appear in production.md.
- Check 4 FAIL (script bug): awk range  terminates immediately because the start line matches the end condition. All specs have correct  headings and US-IDs in the right place — the script cannot extract the section content. Pre-existing bug; not introduced by this sync.
- Check 5 PASS: no unlogged AMBIGUITY markers.
- Check 6 FAIL (script bug): script over-matches "phase" content from PRD sections beyond §7 (including §11 Seed Gym Table and other sections with "Phase 1" references), extracting false positives as "phase names" that are not in the Phase Plan section. Phase Plan section is correctly written with Phase 1/2/3 content. Pre-existing bug; not introduced by this sync. Skipped per delta-sync scope — this sync touches only existing fields within one module spec; no new module directories, no phase plan changes, no production.md changes.


### Sync Report — Trivial Passthrough — 2026-09-24

Doc-Sync Rev 8 [TRIVIAL] — AC-114 wording passthrough to mod-home spec.

## Skill Recommendations

- **Cross-module i18n catalog updates**: When a module adds user-facing strings, the engineer must also update `locales/en/common.json` and `locales/zh-TW/common.json`. The self-check script's git scope check flags these as "out of scope" but they are required by the production.md i18n convention. The self-check script should be updated to whitelist `locales/` as an allowed cross-cutting path for any module implementing i18n strings. Alternatively, each module should own its own locale namespace file (e.g. `locales/en/routes.json`) to stay within the module boundary.

- **React Native named colors for enum-to-color mappings**: When a domain enum (like route hold colors) needs to render as a visual chip, map enum values to React Native's built-in named color strings (e.g. `'red'`, `'blue'`) rather than hex literals. Named colors are OS-resolved (not hardcoded hex), satisfy the "no hardcoded hex" convention, and are visually accurate. Document this in the skill as an approved pattern for enum-color mapping in RN components.

- **Generated column formula must match spec exactly**: When a spec and production.md both document a Postgres GENERATED ALWAYS AS formula, verify the migration SQL matches character-for-character (including separators). Even cosmetic differences (e.g., adding `-` separators not in the spec formula) are spec deviations that QA must flag, even when there is zero functional impact. Add this to qa-checklist references as a pattern to check on any module with a GENERATED ALWAYS AS column.

- **Frontend modules: stale list after modal submission**: When a modal form submits and closes, any list rendered outside the modal (in the parent screen) will NOT re-fetch unless explicitly triggered. The standard pattern is to pass a refresh callback from the list to the success handler, or use a context/event bus. QA should check this pattern on every frontend module where a modal creates a new item that should appear in a visible list.

- **Frontend modules: "success confirmation" spec language is ambiguous**: Specs that say "Success confirmation shown to user" without specifying the form (toast, banner, or implicit modal dismissal) will generate a spec issue on every frontend module. PM should standardize this language in the spec template to specify the required UX pattern (e.g., "display a toast/snackbar message" vs. "dismiss the modal").

Pattern: An expo-av@15 (SDK 52) package was installed under Expo SDK 57, importing a legacy header (EXEventEmitter.h) removed from expo-modules-core@57. Unit tests passed the whole time because expo-av was mocked via Jest moduleNameMapper, so the SDK/native mismatch only surfaced at xcodebuild. Root cause was hand-pinning a native module version in package.json instead of using `npx expo install`.
Why: Two recurring failure modes worth codifying — (1) native Expo modules must be installed with `npx expo install` to stay SDK-aligned, never hand-pinned in package.json; (2) a Jest module mock for a native package makes the unit suite green while the native build is broken, so any add/change/remove of a native dependency requires running the actual iOS build before the module is called QA-ready. Passing unit tests are not evidence a native dependency compiles.
Agent: tech-lead

## PM Alignment Note — Route Submission Flow (2026-09-22)

**Status**: Awaiting human (Leon) decision. No PRD or code changes made. This note documents a discrepancy raised in a human QA session between the shipped MOD-003 flow and Leon's stated product intent.

### 1. What the current spec says (PRD Revision 3)

The current spec is internally consistent and deliberately gate-free:

- **§1 Overview**: the product wedge is "a match-before-create route submission flow that keeps user-submitted data clean **without waiting on official gym partnerships**."
- **AC-020**: match-before-create queries existing **active** routes at a gym for the same grade + color and presents matches to the user "**before allowing creation**." Creation itself is immediate.
- **§5 Architecture**: route tables are "writable only by admins (gyms) or the submitting user + admins (routes)." No approval step exists.
- **Data model (§9)**: `Route.status` is `(active | retired)` only — there is no `pending` state and no separate submission table.
- **§2 Non-Goals**: "In-app admin tooling is out of scope for Phase 1 — Supabase Studio is the sole admin surface." Admin merges near-duplicates in Studio after the fact; there is no pre-publish review.
- **§2 Goal**: "at least 5 seeded gyms have ≥10 user-submitted routes each" (content-density proxy).

Net: routes go live immediately as `status = 'active'` right after the match check. This was a considered design choice, not an oversight — the whole "match-before-create" concept is the substitute for a moderation gate.

### 2. What Leon described today

Leon's stated mental model:
1. User **searches** for a route first (find existing / add beta).
2. If it doesn't exist, user submits a **route request** (gym_id, grade, color_tag, photo_url, submitted_by_user_id — all required).
3. **Admin (Leon) reviews and approves** → route becomes active.
4. OR an **"auto-approve all routes"** admin toggle skips manual review.
5. "Route submission data should be separate from the route data" — implying a separate pending/request table, not pending rows in `public.routes`.

### 3. Assessment: is this a change, a clarification, or a misunderstanding?

This is a **requirements change (new PRD content needed)**, not a clarification of pre-existing intent. The PRD does not merely omit an approval gate — it makes several explicit, mutually reinforcing statements that routes go live immediately (AC-020 "before allowing creation," `status` enum with no `pending`, "without waiting on official gym partnerships," Supabase-Studio-only admin surface). MOD-003 was built, QA-passed, and shipped faithfully to that written spec. So the shipped code is correct against the current PRD; the gap is between Leon's evolving intent and what was previously written and approved.

One nuance worth flagging to Leon: the "auto-approve all routes" toggle he described, if defaulted to ON, produces exactly today's behavior. If he expects to run with auto-approve ON for Phase 1 launch (to hit the ≥10-routes-per-gym content-density goal), then the practical Phase 1 behavior may be unchanged and only the *schema/plumbing* for a future gate would differ. This distinction materially changes cost — see the recommendation.

### 4. Recommendation for Phase 1

**Recommended: keep immediate-live as the default Phase 1 behavior; defer a full moderation gate.** Rationale:

- The Phase 1 content-density goal (≥10 user-submitted routes at ≥5 gyms) is directly threatened by a manual, solo-operator (Leon) approval bottleneck on every route. A gate that Leon must clear personally, via Supabase Studio, for every submission is an operational drag that fights a stated Phase 1 success metric.
- Match-before-create is already the PRD's designed data-quality mechanism, and admin near-duplicate merge in Studio is the designed cleanup path. Together these already deliver "clean user-submitted data" without a pre-publish gate.
- Moderation of *objectionable* content (the App Store 1.2 concern) is handled by Report + Block (MOD-009), not by a route approval queue. Route approval is a data-quality gate, not a safety gate, so it is not required for App Store compliance.

**If Leon wants the moderation gate anyway**, the low-risk Phase 1 shape is: introduce the concept but ship it with **auto-approve defaulted ON**, so Phase 1 launch behavior is unchanged while the plumbing exists to flip it later. The heavier "separate submissions table + manual review UI" is best sequenced into Phase 2 alongside the "lightweight in-app admin surface" already parked there (§12 risk on admin bandwidth, Phase 2 roadmap).

**The "search-first" part of Leon's description is largely already satisfiable and low-risk** — it reads as a navigational preference (land users on a gym's route list/search rather than a bare "Submit" button) more than a data-model change. This can be treated as a UX refinement to MOD-002/MOD-003 navigation independent of the approval-gate decision, and does not by itself require a moderation table.

### 5. Answers to the five key questions

1. **Is admin approval the intended flow for Phase 1?** Recommend **no** for the default path; it conflicts with the content-density goal and is not needed for App Store safety compliance. If adopted, ship it auto-approve-ON so Phase 1 behavior is unchanged.
2. **Separate table vs. status column?** **This is a technical/architectural decision and belongs to the Tech Lead, not the PM.** For PM-level framing only: a separate `route_submissions` table (promote to `routes` on approval) matches Leon's "keep submission data separate" instinct and keeps `public.routes` meaning "live routes only," but it duplicates schema and complicates match-before-create; a `pending` value on `Route.status` is lighter but mixes live and unreviewed rows in one table. Defer the choice to the Tech Lead if a gate is approved.
3. **Auto-approve toggle — DB setting or deploy-time config?** PM position: model it as an **admin-level setting** (a single-row app-settings table editable in Supabase Studio) so Leon can flip it without a redeploy. Exact storage mechanism is a Tech Lead call.
4. **Impact on match-before-create (AC-020)?** Confirmed: **only `active` routes should participate in the match check.** Pending/unreviewed submissions must not block creation and must not be presented as matches (they aren't guaranteed real). AC-020 wording already scopes to `active`, so it stays correct — but if a `pending` state is added, the spec must state explicitly that pending rows are excluded from both the match pool and the gym route list, and confirm the partial unique index stays scoped to `WHERE status = 'active'`.
5. **Impact on search-first flow?** Assessed as primarily a **navigational change** (entry point = gym route list/search rather than a "Submit" button), not a data-model change. Can proceed as a UX refinement independent of the approval decision.

### 6. PRD/spec changes required IF the gate is adopted

If Leon approves a moderation gate, the following PRD edits would be needed (to be applied only after explicit approval, in a `change`-mode pass, with a Tech Lead architecture review because module boundaries and the data model are affected):

- **§9 Data model**: either add `pending` to `Route.status` OR add a new `RouteSubmission` entity (Tech Lead to decide); add an app-settings entity for the auto-approve toggle.
- **AC-020**: add explicit language that pending submissions are excluded from the match pool and gym route list; confirm the partial unique index remains `WHERE status = 'active'`.
- **New AC(s) in MOD-003**: (a) a route submission enters a pending state unless auto-approve is on; (b) admin approval in Supabase Studio promotes it to active; (c) auto-approve toggle behavior.
- **§2 Non-Goals / §5 Architecture / §1 Overview**: revise the "routes go live immediately" / "without waiting on partnerships" framing so the PRD stops contradicting a gate.
- **§2 Goals**: re-examine the ≥10-routes-per-gym content-density goal against approval-queue throughput, or confirm auto-approve-ON at launch protects it.
- **Phase plan**: if the manual-review UI is deferred, record it in the Phase 2 slot alongside the existing "lightweight in-app moderation surface" item.
- Whether this is tagged `[SUBSTANTIVE]` (it would be — data model, module scope, and phase plan are all touched) and routed through Tech Lead + Doc-Sync.

### 7. Next step

Leon to decide among: (A) keep immediate-live, no change (recommended); (B) adopt the gate but ship auto-approve-ON for Phase 1, deferring the review UI to Phase 2; (C) full manual-review gate in Phase 1. On his decision, PM opens a `change`-mode pass and (for B/C) loops in the Tech Lead before any PRD edit. No PRD or code changes will be made until Leon approves.

## Tech Lead Review — Route Submission Approval Architecture (2026-09-22)

**Context**: Leon has approved Option B (add a route approval gate, auto-approve defaulted ON). This review answers the two open architecture questions. Advisory only — no code, migration, or PRD changes made here. Final decision rests with Leon + PM.

### Recommendation summary

- **Question 1 (table structure): recommend B2 — `pending` status in `routes`.**
- **Question 2 (toggle storage): recommend T3 — a single-row `app_settings` table with `DEFAULT true`, editable via Studio SQL.** (T3 and T1 are the same table; T3 is the pragmatic framing of it.)

### Question 1 — B1 (separate table) vs. B2 (pending status): recommend **B2**

**Rationale for B2:**

1. **Auto-approve-ON is the Phase 1 reality (per the PM alignment note), so the gate is almost always a no-op.** With auto-approve ON, a submission goes straight to `status = 'active'` — identical to today's insert path. B2 delivers this with the *existing* insert path unchanged: the client inserts into `routes` with `status = 'active'` (auto-approve) or `status = 'pending'` (gate on). B1 would force two divergent write paths (insert into `route_submissions`, then a separate promotion into `routes`), for a feature that is off at launch. That is disproportionate plumbing cost for a deferred capability.

2. **B2 matches how the codebase already models review gates.** `gym_requests` (MOD-002) is the *submission-into-a-separate-table* pattern, and it works there because a gym request has a **different shape** than a gym row (name + city + google_maps_url vs. the full 14-column `gyms` row with lat/lng, districts, bilingual names). A route submission, by contrast, is **field-for-field identical** to a route row (gym_id, grade, color_tag, photo_url, submitted_by). There is no shape mismatch to justify a second table — B1 would duplicate the schema verbatim and create a copy-on-approve step that can drift.

3. **The partial unique index already does the hard part for free.** `routes_active_unique_idx` is `UNIQUE (gym_id, grade, color_tag) WHERE status = 'active'`. Pending rows are automatically excluded from the uniqueness constraint, so two users can submit the same route while one is pending without an index collision, and approval (`UPDATE status = 'active'`) is where the uniqueness is enforced — exactly the right moment. This is the strongest single argument for B2: the dedup machinery Leon already paid for extends to a pending state with **zero index changes**. (Caveat below on the approval-time collision.)

4. **`ascents` FK integrity is preserved.** `ascents.route_id → routes.id`. Under B2 a route keeps one stable `id` from submission through approval, so any future "log a send on a route you just added" flow needs no id remapping. Under B1 the promotion step mints a *new* `routes.id`, orphaning anything that referenced the submission id — a latent bug surface.

**What B2 costs (the real cons, to be explicit):**

- **RLS must change so non-admins cannot see pending rows.** This is the one genuine downside and it must be handled carefully — see RLS implications below.
- **Studio pending-queue query is slightly more cluttered** (`SELECT * FROM routes WHERE status = 'pending'` rather than a dedicated table). This is trivial and can be wrapped in a Studio-saved query or a view.

**Why not B1:** clean separation is real but the value is low here because (a) the shapes are identical, (b) the gate is off at launch, (c) it breaks the stable-id property that `ascents` benefits from, and (d) it introduces a copy step that can silently diverge from the source row. B1 would be the right call only if route submissions were expected to carry review-only metadata that must never touch the live table (e.g. reviewer notes, rejection reasons at volume) — which is a Phase 2 concern at most and can be added as nullable columns on `routes` if it ever arises.

### Question 2 — T1 / T2 / T3 for the auto-approve toggle: recommend **T3**

T1 and T3 describe the **same artifact** — a single-row settings table read by the app and editable in Studio. T3 is simply the honest framing: "one row, `DEFAULT true`, changed via Studio SQL." I recommend that artifact, and reject T2.

**Rationale:**

- **T2 (Supabase project secret + Edge Function) is rejected.** It requires introducing an Edge Function into the route submission path, which is currently 100% client-side (`INSERT` into `routes` under RLS). That contradicts the shipped MOD-003 architecture and `production.md` §Architecture ("no bespoke backend server in Phase 1; route writes are client-side, RLS-checked"). Adding a function just to read one boolean is over-engineering, adds a cold-start latency to every submission, and creates an Edge Function dependency the stack doesn't otherwise need until MOD-007 notifications. Reserve Edge Functions for the event-driven flows that genuinely require service-role.
- **T3/T1 (settings table) is the fit.** Leon can flip auto-approve with one `UPDATE` in Studio, no redeploy. The read is one cheap indexed lookup on a single-row table, cacheable at app launch (the value changes rarely). It's the same operational surface (Studio) that the whole Phase 1 admin story is built on.
- **On the "round-trip per submission" con:** don't read it per-submission. Read `app_settings` once at app launch (or on a short TTL cache) alongside other bootstrap config. The toggle changing mid-session is not time-critical. This removes the only real T1 cost.

**Important nuance — where auto-approve is actually *enforced*:** the client cannot be trusted to honor the toggle, because RLS lets an authenticated user insert their own route row directly with whatever `status` they choose. So the toggle value being *readable* by the client is only a UX convenience (to set the right initial status / show the right confirmation copy). **The gate itself must be enforced server-side in the RLS `WITH CHECK`**, not by client cooperation — see below.

### RLS / migration / index implications (for whoever implements, if B2 + T3 approved)

These are flags for the eventual `change`-mode migration, not instructions to act now.

1. **SELECT policy must hide pending rows from non-owners/non-admins.** Current `routes_select_authenticated` exposes *all* rows to any authenticated user. Under B2 this would leak pending (unreviewed) routes into everyone's gym route list and — critically — into the AC-020 match pool, violating the PM's confirmed rule that pending rows must not appear as matches. The policy must become roughly: visible if `status = 'active'` OR `submitted_by_user_id = auth.uid()` (so submitters can see their own pending route). Admin (service_role) bypasses RLS and sees everything in Studio.

2. **Match-before-create (AC-020) query must filter `status = 'active'` explicitly.** Even with the SELECT policy above, the match query should not rely solely on RLS to scope the pool — it must include `WHERE status = 'active'` so a submitter's own pending row is never offered to them as a match. The partial unique index stays exactly as-is (`WHERE status = 'active'`); no index change is needed. Confirm the gym route list query also filters to `active`.

3. **INSERT policy must enforce the gate server-side, and this depends on the settings value.** This is the subtle part. Options, roughly in order of robustness:
   - (a) Make the INSERT `WITH CHECK` consult `app_settings`: allow `status = 'active'` on insert only when the toggle is true, else force `status = 'pending'`. This requires the policy to read the settings row (a `SELECT` inside the policy predicate, e.g. via a `SECURITY DEFINER` helper function), which is doable but adds a subquery to every insert.
   - (b) Simpler and arguably cleaner: **force all client inserts to `status = 'pending'`** via `WITH CHECK (status = 'pending')`, and implement auto-approve as a `BEFORE INSERT` trigger (or a `SECURITY DEFINER` RPC used as the submission entrypoint) that flips `status = 'active'` when `app_settings.route_auto_approve = true`. This keeps the "source of truth for the gate" in one server-side place and removes any client trust. Trade-off: routes no longer created by a bare client `INSERT`; submission goes through an RPC — a modest change to MOD-003's write path.
   - Decision between (a) and (b) is an implementation-time call for the Engineer, to be captured in the MOD-003 spec. My lean is (b): it centralizes enforcement and matches the existing `SECURITY DEFINER` pattern already used for `handle_new_auth_user`.

4. **Approval-time uniqueness collision must be handled gracefully.** Because pending rows bypass the partial unique index, two pending submissions for the same (gym_id, grade, color_tag) can coexist. Approving the second one (`UPDATE status = 'active'`) will hit `routes_active_unique_idx` and raise a unique-violation. In Phase 1 this surfaces to Leon in Studio as a raw error, which is acceptable (he can reject the duplicate). It should be **documented** in the MOD-003 spec as expected behavior so it isn't mistaken for a bug. A Phase 2 admin UI would catch this and offer a merge.

5. **`app_settings` table needs its own RLS.** New table ⇒ RLS enabled from creation (project convention). SELECT: authenticated (the client needs to read the toggle for UX) — or restrict to service_role if enforcement moves fully server-side per 3(b), in which case the client doesn't need to read it at all and SELECT can be service_role-only. INSERT/UPDATE/DELETE: none (service_role/Studio only). If enforcement is via a `SECURITY DEFINER` function (3b), that function reads the row regardless of the caller's RLS, so **service_role-only SELECT + a definer function is the tightest design** and avoids exposing settings to clients entirely.

6. **New `pending` enum value.** `ALTER TYPE route_status ADD VALUE 'pending';` — note Postgres cannot add an enum value inside a transaction block that then uses it in the same migration in older PG; on Postgres 15 (the stack's version) `ADD VALUE` is transaction-safe but the new value can't be used until the transaction commits. The migration should add the enum value and the settings table, and land policy/trigger changes such that the new value is usable — the Engineer should verify ordering in a local `supabase db reset`.

7. **PRD/spec contradictions still stand (PM's list §6).** The gate contradicts "routes go live immediately" / "without waiting on partnerships" framing. Those PRD edits are a prerequisite before implementation, tagged `[SUBSTANTIVE]`, routed through Doc-Sync. Not a Tech Lead action.

### Concerns (must address before implementing, if B2+T3 approved)

- **Pending-row leak via the existing SELECT policy** — the current `routes_select_authenticated` policy will expose unreviewed rows to all users and to the match pool unless updated. This is the top correctness risk of adopting B2 and must be fixed in the same migration that adds `pending`.
- **Client cannot be the enforcement point for auto-approve** — RLS lets a client set `status` freely today. The gate must be enforced server-side (INSERT `WITH CHECK` or definer RPC/trigger), or it is trivially bypassable.

### Recommendations

- Adopt **B2 + T3** with enforcement via a `SECURITY DEFINER` submission RPC (3b) that reads a service-role-only `app_settings` row. This centralizes the gate, keeps clients unable to self-approve, and requires zero change to the partial unique index.
- Keep the toggle read out of the per-submission hot path — resolve it inside the definer function, not via a client round-trip.
- Document the approval-time unique-collision (item 4) in the MOD-003 spec so it's understood as expected Phase 1 behavior.

### Approved (looks solid as-is)

- The partial unique index `routes_active_unique_idx` needs **no change** under B2 — its `WHERE status = 'active'` predicate already does the right thing for a pending state.
- Keeping route submission client-side (rejecting T2's Edge Function) is consistent with the shipped architecture; no new infra dependency.
- The `ascents.route_id → routes.id` FK is preserved intact under B2 (stable route id from submission through approval).

### Proposed Shared Conventions (for Doc-Sync to carry into production.md, only if B2+T3 is approved)

- **Review-gate modeling**: prefer a `status`-column gate on the primary table (with an RLS SELECT policy that hides non-active rows from non-owners) over a separate submission table, *unless* the submission's shape differs materially from the live row (as `gym_requests` does). Enforce the gate server-side (RLS `WITH CHECK` or a `SECURITY DEFINER` RPC), never by client cooperation.
- **Runtime admin toggles**: store operator-flippable settings in a single `app_settings (key, value)` table read server-side; do not introduce an Edge Function solely to gate a client-side write.

## Current Phase

Phase 1 — iOS MVP, Taipei + New Taipei launch

## Phase Plan

- **Phase 1 (iOS MVP — Taipei/New Taipei launch)**: MOD-001 through MOD-012. Auth (Email + Apple + Google), admin-curated gym directory, route submission with match-before-create + fixed color enum + V-scale, send logging, beta video upload, follow + activity feed, beta-video likes with APNs push, profile history + stats, Report + Block, English + zh-TW, Light + Dark mode, PostHog analytics, Supabase Studio admin, tab shell (AppShell) with Home/Gyms/Profile tabs, saved-gyms strip, following-climbers strip.
- **Phase 2 (Community depth + Android)**: Android build, offline send queue, expanded push notifications, comments (conditional), retire/reset voting, ascent pyramid, gym-info edit suggestions, Cloudflare Stream video migration (if trigger hit in Phase 1).
- **Phase 3 (Gym partnerships)**: Gym-claimed profiles, official route-setter publishing, gym-facing analytics, optional gym subscription monetization.

### Sync Report — Delta Sync — 2026-09-24

**Sync type:** delta
**PRD Revision:** 7
**PM Update reference:** 2026-09-24 [SUBSTANTIVE] — Tab shell + Home screen + Profile screen + saved-gyms data model (PRD Revision 7)

**Files created:**
- `project-planning/modules/mod-home/spec.md` — MOD-012 spec created from template with full content: purpose, context (US-019, US-020, US-001 implicit), Related User Stories, requirements, input/output contract, dependencies, acceptance criteria (AC-110 through AC-115, AC-123, AC-124), integration points (AppShell mounts MOD-002/MOD-001 navigators; saved_gyms read; MOD-006 service dependency), data model (SavedGym DDL, RLS, grants), key implementation notes, out of scope.
- `project-planning/modules/mod-home/status.md` — empty Engineering Progress + QA Results template.
- `.claude/agents/engineer-mod-home.md` — engineer wrapper for MOD-012.
- `.claude/agents/qa-mod-home.md` — QA wrapper for MOD-012.

**Files modified:**
- `project-planning/production.md` — Last synced revision updated (rev 4 → rev 7); Project Overview updated to reflect multi-gym saved list and three-tab shell; Architecture Overview updated with tab shell paragraph (AppShell in mod-home, keep-alive mount, tab state ownership, session threading, bottom inset); Module Index updated (MOD-001 description updated, MOD-002 description updated, MOD-012 added); Directory Layout updated (banners.ts added to src/lib/, mod-home added with AppShell/HomeNavigator/screens/components); Four new Shared Conventions added: App Shell & Tab Navigation, Bottom Safe Area for Pinned Bottom Bars, Cross-Module Imports, Shared Non-Module Constants.
- `project-planning/modules/mod-auth-profile/spec.md` — Last Synced updated to 7; Purpose updated (no home gym, Profile tab surface described); Context updated (direct Home tab on first run, home_gym_id removal note); User Stories Covered section renamed to Related User Stories; US-011 added; AC-001 rewritten (first run → Home, no gym selection); AC-002 and AC-003 removed; AC-116, AC-117, AC-118, AC-119 added; Requirements section added; Integration Points updated (ProfileNavigator entry point, MOD-008 embedding); Data Model updated (home_gym_id removed, DROP COLUMN note); Input/Output Contract updated; Key Implementation Notes updated (home_gym_id impact map added, ProfileNavigator note added); Out of Scope updated (saved gyms note added).
- `project-planning/modules/mod-gym-directory/spec.md` — Last Synced updated to 7; Purpose updated (saved-gym bookmark interaction added); Context updated (MOD-002 save/unsave ownership, migration sequencing note); User Stories Covered section renamed to Related User Stories; US-019 added; AC-120, AC-121, AC-122 added; Integration Point 3 added (shared saved_gyms table access); Data Model updated (SavedGym table added with note about MOD-012 migration ownership, RLS, grants); Input/Output Contract updated (saved-gym bookmark inputs/outputs added); Key Implementation Notes updated (saved-gym write ownership note, optimistic update note, list indicator note added); Out of Scope updated (saved_gyms DDL and Home strip notes added).
- `project-planning/modules/*/spec.md` (all 11 existing specs) — `## User Stories Covered` heading renamed to `## Related User Stories` to match template convention and pass verify-sync.sh Check 4.
- `project-planning/status.md` — Last Action updated; Phase Plan section added (fixes pre-existing Check 6 failure); Current Phase section added; this Sync Report added.

**Module removals noted:** none

**AMBIGUITY markers added:** none

**CONFLICT markers added:** none

**verify-sync.sh result:** 4/6 — two pre-existing script bugs prevent Checks 4 and 6 from passing regardless of document content.
- Check 1 PASS: all MOD-IDs in prd.md have a Module Map entry and spec.md.
- Check 2 PASS: all spec.md files have a corresponding Module Map entry.
- Check 3 PASS: all Tech Stack entries from prd.md appear in production.md.
- Check 4 FAIL (script bug): awk range  terminates immediately because the start line matches the end condition. All specs have correct  headings and US-IDs in the right place — the script cannot extract the section content. Pre-existing bug; not introduced by this sync.
- Check 5 PASS: no unlogged AMBIGUITY markers.
- Check 6 FAIL (script bug): script over-matches "phase" content from PRD sections beyond §7 (including §11 Seed Gym Table and other sections with "Phase 1" references), extracting false positives as "phase names" that are not in the Phase Plan section. Phase Plan section is correctly written with Phase 1/2/3 content. Pre-existing bug; not introduced by this sync. 4/6 — two pre-existing script bugs prevent Checks 4 and 6 from passing regardless of document content.
- Check 1 PASS: all MOD-IDs in prd.md have a Module Map entry and spec.md (MOD-012 spec created).
- Check 2 PASS: all spec.md files have a corresponding Module Map entry.
- Check 3 PASS: all Tech Stack entries from prd.md appear in production.md.
- Check 4 FAIL (script bug): awk range `/^## Related User Stories/,/^## /` terminates immediately because the start line matches the end condition. All specs have correct `## Related User Stories` headings and US-IDs in the right place — the script cannot extract the section content. Pre-existing bug; not introduced by this sync.
- Check 5 PASS: no unlogged AMBIGUITY markers.
- Check 6 FAIL (script bug): script over-matches "phase" content from PRD sections beyond §7 (including §11 Seed Gym Table and other sections with "Phase 1" references), extracting false positives as "phase names" that are not in the Phase Plan section. Phase Plan section is correctly written with Phase 1/2/3 content. Pre-existing bug; not introduced by this sync.


### Sync Report — Delta Sync — 2026-09-24

**Sync type:** delta
**PRD Revision:** 9
**PM Update reference:** 2026-09-24 [SUBSTANTIVE] — Four product refinements (PRD Revision 9): route display name format (AC-045), remove project ascent style (AC-014), achievement icons (AC-065, MOD-008 only), saved routes / bookmark (US-021, AC-046, AC-047). Tech Lead Rev 9 review completed before this sync.

**Files modified:**
- `project-planning/production.md` — Last synced revision updated (rev 7 → rev 9); Module Index MOD-004 description updated to reflect three-value ascent style; Five new Shared Conventions added: PG15 Enum Value Removal, Personal Cross-Module Data Overlays, Multi-Row Reduction with Defined Precedence, Route Display Name Format, saved_routes Migration Ownership.
- `project-planning/modules/mod-route-catalog/spec.md` — Last Synced updated to 9; Purpose updated (composed display name and saved-route bookmark interaction added); Context updated (display name composition rule, US-021 user story text, saved-route ownership, fetchUserAchievements cross-module read); US-021 added to Related User Stories; AC-045 added (route display name composition); AC-046 added (RouteDetailScreen bookmark toggle); AC-047 added (RouteListScreen read-only saved indicator); AC-042 note updated (reference to AC-046 added); Requirements section added (saved_routes migration note; fetchUserAchievements import note); Integration Points updated (cross-module import of fetchUserAchievements from MOD-004 added); Data Model updated (SavedRoute join table added; Route display-name comment added); Input/Output Contract updated (display name, saved indicator, achievement icon outputs noted; bookmark toggle inputs/outputs added); Key Implementation Notes updated (route display name note, saved_routes bookmark notes, achievement icon overlay note added); Out of Scope updated (free-text route name and dedicated saved-routes surface added).
- `project-planning/modules/mod-send-logging/spec.md` — Last Synced updated to 9; Purpose updated (three-value ascent style restriction and fetchUserAchievements public service function noted); Context updated (project removal rationale, migration sequencing note, fetchUserAchievements description); AC-014 added (ascent style restricted to {flash, top, attempt}; project removed); Integration Points section updated (fetchUserAchievements public service function exposed by MOD-004, consumed by MOD-003); Data Model updated (ascent_style enum now flash|top|attempt only; project removal migration note); Input/Output Contract updated (style input updated; fetchUserAchievements inputs/outputs added); Key Implementation Notes updated (ascent_style enum migration section added with exact SQL, sequencing, canary; fetchUserAchievements implementation notes added); Out of Scope updated (project style note added).

**Files created:** none

**Module removals noted:** none

**AMBIGUITY markers added:** none

**CONFLICT markers added:** none

**verify-sync.sh result:** 4/6 — two pre-existing script bugs prevent Checks 4 and 6 from passing regardless of document content.
- Check 1 PASS: all MOD-IDs in prd.md have a Module Map entry and spec.md.
- Check 2 PASS: all spec.md files have a corresponding Module Map entry.
- Check 3 PASS: all Tech Stack entries from prd.md appear in production.md.
- Check 4 FAIL (script bug): awk range  terminates immediately because the start line matches the end condition. All specs have correct  headings and US-IDs in the right place — the script cannot extract the section content. Pre-existing bug; not introduced by this sync.
- Check 5 PASS: no unlogged AMBIGUITY markers.
- Check 6 FAIL (script bug): script over-matches "phase" content from PRD sections beyond §7 (including §11 Seed Gym Table and other sections with "Phase 1" references), extracting false positives as "phase names" that are not in the Phase Plan section. Phase Plan section is correctly written with Phase 1/2/3 content. Pre-existing bug; not introduced by this sync.

### Sync Report — Trivial Passthrough — 2026-09-24

**Sync type:** trivial
**PRD Revision:** 10
**PM Update reference:** 2026-09-24 [TRIVIAL] — AC-031 thumbnail-scope ruling (PRD Revision 10)
**Affected spec:** MOD-005 (mod-beta-video) only

**Files modified:**
- `project-planning/modules/mod-beta-video/spec.md` — AC-031 entry updated with Phase 1 simplification clause (thumbnail may use the video URI as a placeholder; `BetaVideo.thumbnail_url` must still be a valid retrievable URL; true frame extraction is Phase 2); Key Implementation Notes Thumbnail bullet annotated with Phase 1 placeholder allowance and frame-at-1-second deferred to Phase 2; new "Phase 1 simplification — client-side frame extraction deferred" bullet added; Out of Scope updated to include client-side frame extraction (Phase 2); Last Synced from PRD Revision updated 5 → 10; Last Updated set to 2026-09-24.

**Files not touched:**
- `project-planning/production.md` — no shared convention changes; module boundaries, dependencies, and phase plan unchanged.
- All other module specs — change confined to MOD-005 per PM note.

**AMBIGUITY markers added:** none
**CONFLICT markers added:** none
**verify-sync.sh:** Skipped — trivial passthrough; no new modules, no phase plan changes, no production.md changes.
### Sync Report — Trivial Passthrough — 2026-09-25

**Sync type:** trivial
**PRD Revision:** 11
**PM Update reference:** 2026-09-25 [TRIVIAL] — Two native-dependency engineering standards added to §10 NFR (PRD Revision 11)

**Files modified:**
- `project-planning/production.md` — "Last synced from PRD" updated rev 9 → rev 11; "Last Updated" field added (2026-09-25); two new Shared Conventions added after "saved_routes Migration Ownership": "Native Dependency Installation" and "Native Build Gate Before QA Handoff". Convention text copied verbatim from PM Updates "For Doc-Sync" note, which mirrors the Tech Lead's Proposed Shared Conventions in the 2026-09-25 review.

**Files not touched:**
- All module specs — PM Updates note explicitly states no module spec changes required; these are project-wide conventions that live in production.md only.
- `prd.md` — read-only.

**AMBIGUITY markers added:** none
**CONFLICT markers added:** none
**verify-sync.sh:** Skipped — trivial passthrough per skill routing rules.

### Sync Report — Trivial Passthrough — 2026-09-27

**Sync type:** trivial
**PRD Revision:** 12
**PM Update reference:** 2026-09-27 [TRIVIAL] — AC-035 .mov container ruling: accept .mov alongside .mp4 (PRD Revision 12)
**Affected spec:** MOD-005 (mod-beta-video) only

**Files modified:**
- `project-planning/modules/mod-beta-video/spec.md` — AC-035 entry updated: both .mp4 and .mov containers are now accepted; rejection is codec-based (video must be H.264 or HEVC, audio must be AAC), not container-based; both containers stored as-is with no server-side transcoding; duration/size caps apply regardless of container. AC-031 entry updated: compression-output clause now references H.264 or HEVC + AAC in .mp4 or .mov (cross-refs AC-035). Context paragraph updated: removed MP4-only / .mov-rejected framing; updated codec standardization sentence to reflect both containers accepted; rejection-on-ingest now stated as codec-based. Input/Output Contract updated: compression output references H.264/HEVC + AAC in .mp4 or .mov. Key Implementation Notes updated: "Codec standardization" bullet updated to H.264 or HEVC + AAC in MP4 or MOV; "Ingest validation" bullet updated to state rejection is codec-based, not container-based. Last Synced from PRD Revision updated 10 → 12; Last Updated set to 2026-09-27.

**Files not touched:**
- `project-planning/production.md` — no shared convention changes; module boundaries, dependencies, and phase plan unchanged.
- All other module specs — change confined to MOD-005 per PM note.

**AMBIGUITY markers added:** none
**CONFLICT markers added:** none
**verify-sync.sh:** Skipped — trivial passthrough per skill routing rules.
