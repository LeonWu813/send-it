# Project Status

## Last Action
<!-- Machine-readable block — handoff.sh parses this section -->
agent: doc-sync
mode: initial
module: n/a
result: success
commit: 76a292c874e78aa32cb9f9b062d1b8edea7dd329
timestamp: 2026-09-19T00:00:00+08:00

## Current Phase

Phase 1 — iOS MVP (Taipei + New Taipei launch). **Doc-Sync [INIT] complete** — `production.md` created; all 11 module `spec.md` files created; all 11 module `status.md` files created. Per-module agent wrappers (`.claude/agents/engineer-mod-*.md` and `.claude/agents/qa-mod-*.md`) blocked — see Sync Reports for detail. Engineering may begin with MOD-001 (Auth & Profile).

## Phase Plan

- Phase 1: iOS MVP — Taipei/New Taipei launch (MOD-001 through MOD-011)
- Phase 2: Community depth + Android (offline queue, expanded notifications, comments, retire/reset voting, ascent pyramid, Cloudflare Stream migration if triggered, in-app moderation if needed)
- Phase 3: Gym partnerships (gym claim, route-setter console, official publishing, gym analytics, optional monetization)

## Build Config
<!-- Filled by PM during init. PM asks the user for the project's build, lint, and test
     commands and writes them here. Doc-Sync copies these to production.md Shared Conventions
     during the initial sync. Leave a value blank if that step doesn't apply. -->

Build: eas build --profile production --platform ios
Lint:  npm run lint
Test:  npm test

## PM Updates

- 2026-09-20 — [INIT] Tagged INIT after verifying the Tech Lead `### Setup Confirmation — complete` entry. Incorporated all seven Tech Lead concerns into PRD rev 2: (1) MOD-005 video codec standardised to H.264 baseline + AAC in MP4 — updated AC-031 and added AC-035 to reject non-conforming uploads on ingest; (2) MOD-007 push idempotency — added spec note requiring Postgres-trigger-fired Edge Function (not client) plus unique constraint on `Notification(recipient_user_id, actor_user_id, type, target_id)`; (3) MOD-006 feed served by `SECURITY INVOKER` Postgres RPC composing Follow ∩ (¬Block, symmetric) ∩ privacy, not raw client SELECT; (4) added AC-084 for symmetric block hiding (App Store 1.2); (5) added AC-085 + NFR for scheduled 6h Edge Function emailing wu.tsan@northeastern.edu a digest of open reports >12h; (6) `Route.match_key` specified as `GENERATED ALWAYS AS ... STORED` with partial unique index `UNIQUE (gym_id, grade, color_tag) WHERE status = 'active'` in the data model; (7) noted Edge Functions must use `SERVICE_ROLE_KEY` (not `SUPABASE_SERVICE_ROLE_KEY`) in data model + NFR Security. Set Build/Lint/Test config for Expo + TypeScript stack. Finalized the 11-module Module Map and created all `modules/mod-*` directories with `.gitkeep`. Engineering may begin. Next: Doc-Sync.
- 2026-09-19 — [INIT-DRAFT] Wrote finalized Phase 1 PRD from confirmed decision set (React Native + Expo iOS-only, Supabase BaaS, 60-sec beta videos with client compression, fixed 9-color hold enum, forced V-scale, APNs push for beta-video likes only, offline queue deferred to Phase 2, Report + Block in Phase 1 for App Store 1.2, English + zh-TW, Light + Dark, Supabase Studio admin only, branch-level gym seeding excluding Camp4 and Wusa). Awaiting user to provide Build/Lint/Test commands and to confirm module directory naming before running init-project.sh scaffold and creating `modules/mod-*` directories. Next: Tech Lead architectural review.

## Tech Lead Reviews

### Review — 2026-09-19 — init

Reviewed `prd.md` rev 1 in full against the confirmed decision set and the installed toolchain. `production.md` does not yet exist (expected at this stage). Findings organised as **Concerns** (must resolve before Engineer starts MOD-001), **Recommendations** (worth deciding but not blocking), **Approved** (looks solid), and **Proposed Shared Conventions** (for Doc-Sync to lift into `production.md`).

**Concerns** (must address before proceeding):

- **Node version mismatch**: Machine has Node v24.14.1. Expo SDK 51 officially supports Node 18 LTS and Node 20 LTS. Node 24 is not certified and has known incompatibilities with several React Native native modules. Decision needed: install Node 20 LTS (via `fnm` / `nvm`) and pin via `.nvmrc`. Documented in `setup.md` step 1.
- **Xcode full IDE missing**: Only Command Line Tools are installed. `xcodebuild` fails. iOS simulator and TestFlight builds require the full Xcode.app (~7 GB from Mac App Store). Blocks any iOS smoke test, so must be resolved before Engineer scaffolds MOD-001. Documented in `setup.md` step 2.
- **AC-032 says "playable inline within 60 seconds of upload completion" — but there is no transcoding pipeline in Phase 1**. Supabase Storage serves the file as-uploaded; playability depends entirely on iOS AVPlayer accepting whatever container/codec the client compression produced. Risk: an unusual codec (e.g., HEVC in a specific profile from an older iPhone) may not decode inline on all devices. Recommendation: standardise the client compression output to **H.264 baseline in MP4 (AAC audio)** in the MOD-005 spec. Add a validation step that rejects any upload whose muxed output is not H.264/AAC/MP4. This is a design decision the PM should reflect in AC-031 or a new AC before Engineer starts MOD-005.
- **AC-055 fan-out has a race condition risk**: "on insert of a Reaction with target_type = beta_video, insert exactly one Notification row and enqueue exactly one APNs push per active device token". Two nearly-simultaneous likes on the same video from two users are fine, but a **double-tap or client retry on the same like** could re-fire the Edge Function. The `Reaction` unique constraint on `(user_id, target_type, target_id)` prevents duplicate rows, but the Edge Function must be triggered on Postgres INSERT (not client-side), and must be **idempotent** if the same trigger fires twice. Recommendation: (a) trigger the Edge Function via a Postgres trigger + `pg_net`/webhook rather than from the client, and (b) add a unique constraint or dedupe key on `Notification(recipient_user_id, actor_user_id, type, target_id)` so a second fire cannot create a second notification row. Add this to the MOD-007 spec.
- **RLS complexity for feed + block interaction is understated**: The feed query is "sends and beta videos from followed users, minus users I've blocked, minus users who've blocked me, minus followers_only users I don't follow". Implementing this purely in RLS gets expensive at scale; RLS runs per-row. Realistic Phase 1 approach: keep RLS as the security fence but do the feed composition in a Postgres view or RPC function (`SECURITY INVOKER`) that joins Follow, Block, and privacy filters explicitly. Decision needed: PM should acknowledge that the MOD-006 spec must define this as an RPC, not a raw table select from the client. This is not a blocker for [INIT] but must be captured before MOD-006 is spec'd.
- **`Block` symmetry is missing an explicit rule**: PRD says a blocked user cannot follow, like, or interact with the blocker (AC-083). But AC-082 says "immediately hide the blocked user's beta videos, sends, and profile from the blocker's feed and route pages" — it does not say the reverse (that the blocker's content is also hidden from the blocked user). App Store 1.2 review historically expects **symmetric** hiding: the blocked party should not be able to see or interact with the blocker's content either. Recommendation: PM should update AC-082 or add AC-084 to make the hiding symmetric. Otherwise App Store review may flag this.
- **`Report` throughput / SLA is unspecified**: PRD Open Question flags this. App Store 1.2 requires "the ability to filter objectionable material" and "a mechanism for users to block abusive users" **and** "the developer to act on objectionable content and ejecting users engaging in abusive behavior within 24 hours". As a solo operator using Supabase Studio only, Leon has no automated alerting when a Report is filed. Recommendation: add a Phase 1 nice-to-have Edge Function (scheduled every 6 h) that emails Leon a digest of any open reports older than N hours. Not a blocker but should be captured as a known operational gap.
- **`Route.match_key` — clarify storage vs. derivation**: Schema says "match_key (derived: gym_id + grade + color_tag)". Ambiguous whether this is a **stored generated column** (Postgres `GENERATED ALWAYS AS ... STORED`) or **derived on query**. Recommendation: make it a Postgres generated column with a **partial unique index** `UNIQUE (gym_id, grade, color_tag) WHERE status = 'active'`. This enforces AC-020's "no active duplicates" invariant at the DB level, not just in application code. The partial predicate `WHERE status = 'active'` correctly allows historical retired routes to reuse the same key. This should be codified in the MOD-003 spec.

**Recommendations** (suggested improvements):

- **Video migration runbook (Supabase Storage → Cloudflare Stream)**: PRD open question notes this is undocumented. Even though the migration itself is Phase 2, the runbook should exist before Phase 1 GA so Leon isn't caught out. Suggested pattern: (1) dual-write new uploads to both providers during a cutover window, (2) batch-copy historical files, (3) rewrite `BetaVideo.video_url` in a single transaction, (4) verify random-sample playback, (5) delete Supabase originals after N days retention. Draft into `docs/runbooks/video-migration.md` when the Engineer touches MOD-005.
- **PostHog free-tier ceiling**: Free tier is ~1M events/month. With signup + first-send + first-video + like + session-start firing at the volumes AC-100 implies, Leon could hit the cap with a few thousand active users. Recommendation: implement client-side sampling for `session_start` at ≥50% of DAU, and instrument event volume monitoring from day one. Not a Phase 1 blocker.
- **Client-side video compression library choice is undecided**. `expo-video-manipulator` doesn't exist; `react-native-video-processing` is unmaintained; `ffmpeg-kit-react-native` is the most reliable but adds ~40 MB to the bundle. Recommendation: Tech Lead + Engineer to pick between `ffmpeg-kit-react-native` (heavy, reliable, H.264 output guaranteed) vs. using the raw asset from `expo-image-picker` with `videoQuality: 'medium'` (light, but codec/quality is device-dependent). Decision should land in the MOD-005 spec.
- **i18n key completeness gate**: PRD NFR says "message catalogs must be complete (no missing keys) at ship". Recommend adding a lint step (e.g., `i18next-parser --fail-on-warnings` or a custom script) that fails CI if any English key lacks a zh-TW counterpart. Codify in MOD-010 spec.
- **Dark mode + zh-TW combinatorial testing**: Neither is technically hard, but shipping both in Phase 1 means QA has to verify every screen in 4 combinations (light/dark × en/zh-TW). Recommend the QA agent build a screenshot matrix into every module's test plan rather than treat it as a one-off audit at the end.
- **Bundle size discipline**: iOS-only + Expo managed workflow + `ffmpeg-kit-react-native` (if chosen) + PostHog + Supabase SDK could easily push the app past 100 MB. TestFlight tolerates this, but users on cellular hesitate. Recommend `expo-doctor` and `npx expo-bundle-analyzer` runs as part of the pre-TestFlight gate.
- **Apple Sign-In hard requirement**: PRD correctly notes it's mandatory because Google Sign-In is offered. Also true whenever any third-party sign-in is offered. Ensure the Auth spec calls out that Apple Sign-In must be visually equivalent (not smaller/hidden) per App Store review guidelines.
- **Section label as tie-breaker (schema already supports it)**: PRD Open Question flags color-collision risk. Recommend Engineer surface `section_label` as an optional field in the route submission form **from day one** even though it's nullable; this makes it painless to promote to required in Phase 2 without a schema change. Add to MOD-003 spec.
- **Consider a `deleted_at` soft-delete column on BetaVideo and Ascent**: A user who is banned or self-deletes shouldn't purge historical data outright (analytics, moderation records). Standard soft-delete pattern; costs nothing at spec time to add. Not currently in the PRD data model.

**Approved**:

- **Overall architecture is coherent for a solo build**. Supabase as a single-vendor BaaS collapses backend concerns (auth, DB, storage, functions, RLS) into one dashboard; this is exactly the right choice for a solo AI-assisted build. No custom server code is a big win.
- **Module boundaries and dependency order are sensible**. MOD-001 → MOD-002 → MOD-003 → MOD-004 → MOD-005 → MOD-006 → MOD-007 → MOD-008 → MOD-009 is a clean sequence with no circular dependencies. MOD-010 (localization + theming) correctly has no deps and can be shipped in parallel. MOD-011 (analytics) correctly depends only on MOD-001. Ship order can even be linear.
- **Match-before-create + fixed color enum + forced V-scale** is a smart data-quality lever. Constraining the taxonomy prevents the "every user invents their own tag" mess that kills UGC route apps. Approved as-is.
- **Report + Block scoped for Phase 1 is realistic** — the surface is small (report submit + block toggle + feed filter), and Supabase Studio for admin review is a defensible MVP. The main risk is response-time SLA, addressed in Concerns above.
- **60-sec cap + client-side compression** is realistic on Supabase Storage for Phase 1 volumes. At ~10 MB per compressed 60-sec clip, 20 GB = ~2,000 videos before the migration trigger fires — that's roughly 400 uploads/month over 5 months of soft launch, which is a reasonable Phase 1 ceiling.
- **Notification preference table shape is future-proof** — a single row per user with per-event-type boolean columns extends cleanly for Phase 2 push types.
- **Explicit non-goals list is unusually thorough** — reads like it was pressure-tested. Reduces scope-creep risk considerably.

**Proposed Shared Conventions** (for Doc-Sync to carry into production.md):

- **Directory layout**: Group by feature/module inside `src/modules/<mod-name>/` matching the Module Map in `status.md`. Cross-cutting code (auth session, Supabase client singleton, theme provider, i18n init) lives in `src/lib/`.
- **Supabase client**: One singleton exported from `src/lib/supabase.ts`. Never construct `createClient()` at call sites. Never import the `service_role` key in client code.
- **RLS-first data access**: The client never sends `service_role`-authenticated requests. Every table has RLS enabled from the migration that creates it. Feed and other multi-table reads are exposed via Postgres RPC (`SECURITY INVOKER`), not raw table selects.
- **Migrations**: All schema changes ship as Supabase CLI migrations in `supabase/migrations/`. Never edit tables via Studio in production without a corresponding migration file.
- **Env vars**: Only vars prefixed `EXPO_PUBLIC_` are safe to inline into the bundle. Any secret (service_role, Expo access token) lives in `supabase secrets` and is only read inside Edge Functions.
- **Video pipeline**: All client-side video compression outputs H.264 (baseline profile) + AAC in an MP4 container. Reject uploads that don't match on ingest.
- **Match key**: `Route.match_key` is a Postgres `GENERATED ALWAYS AS ... STORED` column. Uniqueness is enforced via a **partial** unique index scoped to `status = 'active'`.
- **Notifications**: Any push-triggering event is fired by a Postgres trigger → Edge Function, never by the client. Notification writes are idempotent via a unique constraint on `(recipient_user_id, actor_user_id, type, target_id)`.
- **i18n**: All user-facing strings pulled through the i18n hook — no inline string literals in components. CI check fails on missing zh-TW keys.
- **Theming**: Every screen uses tokens from the theme provider; no hardcoded hex colors in components.
- **Commit convention**: Follow `~/.claude/skills/coding-conventions/SKILL.md` — conventional commits for code, agent-role prefixed for handoffs.
- **Testing**: Jest + React Native Testing Library. One test file per source file. Test behaviour, not implementation.
- **TypeScript**: Strict mode on. No `any` without a `// TODO(leon): why` comment.

### Setup Confirmation — complete

Verified 2026-09-19 (nvm loaded before node/eas checks). All required Phase-1 development environment checks pass. Deferred items are Apple-Developer-gated and correctly out of scope for simulator-based development, per `setup.md` §4 and §8.

**Passed:**

- ✅ Node.js v20.20.2 (via nvm; LTS, meets Expo SDK 51 requirement) — `.nvmrc` pinned to `20`
- ✅ Xcode 26.6 (Build 17F113) — `xcodebuild -version` returns valid version
- ✅ CocoaPods 1.17.0 installed (bonus — not required to pass, but ready for Expo prebuild)
- ✅ EAS CLI — `eas whoami` returns `leon_wu` (leonwuya@gmail.com); Owner of both `leon_wu` and `send-it-tw-bouldering-app` Expo accounts
- ✅ Supabase CLI 2.117.0 — `supabase --version` succeeds
- ✅ `.env` exists at project root and is git-ignored — `git check-ignore -v .env` → `.gitignore:8:.env`; `git ls-files .env` returns empty (untracked)
- ✅ `EXPO_PUBLIC_SUPABASE_URL` — real value `https://hxvzjpynhdexhtoccmmh.supabase.co`, no placeholder token
- ✅ `EXPO_PUBLIC_SUPABASE_ANON_KEY` — real value (46 chars), no placeholder
- ✅ `EXPO_PUBLIC_POSTHOG_API_KEY` — real value (52 chars), no placeholder
- ✅ `EXPO_PUBLIC_POSTHOG_HOST` — present
- ✅ Supabase project reachable — `curl` to `<SUPABASE_URL>/auth/v1/health` returned **HTTP 401** (host resolves, service live; 401 without key is expected and is a pass per the 200/401 criterion)

**Deferred (not failures — Apple-Developer-gated, no fixed timeline):**

- ⏳ Apple Developer Program enrollment (US$99/yr) — deferred until real-device testing / TestFlight (`setup.md` §4)
- ⏳ APNs `.p8` Auth Key upload to Expo via `eas credentials` — deferred with the Apple Dev account (`setup.md` §8)

**Notes (informational, non-blocking):**

- No `package.json` / Expo app scaffold yet — expected; Engineer scaffolds during MOD-001.
- Expo access token + `SUPABASE_SERVICE_ROLE_KEY` are stored via `supabase secrets` (not in `.env`), per the RLS/secrets convention. Reminder: the service-role secret name is `SERVICE_ROLE_KEY`, since Supabase reserves the `SUPABASE_` prefix for its own injected vars — Edge Function code must read `SERVICE_ROLE_KEY`, not `SUPABASE_SERVICE_ROLE_KEY`.
- Push-notification testing (MOD-007 APNs delivery on a physical device) cannot be end-to-end verified until the Apple Developer account + APNs `.p8` are in place. This does not block [INIT] or any non-push module.

**Verdict:** Environment confirmed for Phase-1 development. **PM agent may now tag [INIT].**

## Sync Reports

### 2026-09-19 — Initial Sync ([INIT])

**Trigger**: [INIT] tag in PM Updates (2026-09-20 entry). PRD rev 2 finalized.

**Files created:**

- `project-planning/production.md` — shared conventions doc (tech stack, architecture overview, module index, directory layout, Supabase singleton, RLS-first access, migration conventions, env var rules, video pipeline, match_key, notification pattern, i18n rules, theming rules, TypeScript strict mode, testing conventions, commit conventions, build/lint/test commands, cross-cutting NFRs)
- `project-planning/modules/mod-auth-profile/spec.md` — MOD-001
- `project-planning/modules/mod-gym-directory/spec.md` — MOD-002
- `project-planning/modules/mod-route-catalog/spec.md` — MOD-003
- `project-planning/modules/mod-send-logging/spec.md` — MOD-004
- `project-planning/modules/mod-beta-video/spec.md` — MOD-005
- `project-planning/modules/mod-social-feed/spec.md` — MOD-006
- `project-planning/modules/mod-notifications/spec.md` — MOD-007
- `project-planning/modules/mod-profile-history/spec.md` — MOD-008
- `project-planning/modules/mod-moderation/spec.md` — MOD-009
- `project-planning/modules/mod-localization-theme/spec.md` — MOD-010
- `project-planning/modules/mod-analytics/spec.md` — MOD-011
- `project-planning/modules/mod-auth-profile/status.md` — empty Engineering Progress + QA Results template
- `project-planning/modules/mod-gym-directory/status.md` — empty template
- `project-planning/modules/mod-route-catalog/status.md` — empty template
- `project-planning/modules/mod-send-logging/status.md` — empty template
- `project-planning/modules/mod-beta-video/status.md` — empty template
- `project-planning/modules/mod-social-feed/status.md` — empty template
- `project-planning/modules/mod-notifications/status.md` — empty template
- `project-planning/modules/mod-profile-history/status.md` — empty template
- `project-planning/modules/mod-moderation/status.md` — empty template
- `project-planning/modules/mod-localization-theme/status.md` — empty template
- `project-planning/modules/mod-analytics/status.md` — empty template

**Files NOT created (blocked):**

- `.claude/agents/engineer-mod-*.md` (11 files) — write blocked by auto-mode classifier (self-modification rule). The task prompt explicitly requested these files and the doc-sync write scope lists them. Human must confirm permission to write to `.claude/agents/` before these can be created.
- `.claude/agents/qa-mod-*.md` (11 files) — same block.

**Ambiguity / Conflict markers placed**: none.

**verify-sync.sh**: Not run — `~/.claude/skills/doc-sync-methodology/` directory does not exist in this project (no skill directory installed). Verification script unavailable. Manual check performed: all 11 spec.md files reference correct MOD-IDs, module names, and dependency lists matching the PRD and Module Map in status.md. All acceptance criteria referenced in specs match AC-IDs in PRD §8. No cross-module spec content leakage detected.

## Engineering Progress


## QA Results


## Decisions

- Framework: React Native + Expo + TypeScript (iOS-only Phase 1; Android Phase 2)
- BaaS: Supabase (Postgres + Auth + Storage + RLS + Edge Functions) — hosted in Tokyo (ap-northeast-1)
- Video hosting: Supabase Storage Phase 1; migrate to Cloudflare Stream when monthly cost > US$25 OR storage > 20 GB
- Auth: Email + Apple Sign-In + Google Sign-In
- Video: 60-sec cap, client-side compression, client-generated thumbnail
- Hold/tape color: fixed enum {red, orange, yellow, green, blue, purple, pink, white, black}
- Grade system: V-scale forced across all Phase 1 gyms
- Push: APNs via Expo Push, beta-video-likes only in Phase 1, with preference toggle
- Offline send queue: Phase 2 (Phase 1 shows clear error on failure)
- Report + Block: Phase 1 (App Store Guideline 1.2)
- Localization: English + Traditional Chinese (zh-TW). Default = device locale, fallback = zh-TW. Settings toggle.
- Theming: Light + Dark, OS default + Settings override
- Admin tooling: Supabase Studio only in Phase 1
- Analytics: PostHog free tier
- Gym seeding: one row per branch for multi-branch gyms; exclude Camp4 達文西攀岩館 and Wusa 攀岩館 (top-rope only); split T-UP 原岩 into 5 branch rows; CORNER already 2 branches
- Soft-launch timeframe: none set

## Module Map

<!-- Filled by PM after user confirms module directory names.
     Format:
     | MOD-ID  | Directory        | Module Name    |
     |---------|------------------|----------------|
     | MOD-001 | mod-login        | User Login     |
-->

Final — confirmed at [INIT] (2026-09-20). Directories created under `project-planning/modules/`.

| MOD-ID  | Directory              | Module Name                  |
|---------|------------------------|------------------------------|
| MOD-001 | mod-auth-profile       | Auth & Profile               |
| MOD-002 | mod-gym-directory      | Gym Directory                |
| MOD-003 | mod-route-catalog      | Route Catalog                |
| MOD-004 | mod-send-logging       | Send Logging                 |
| MOD-005 | mod-beta-video         | Beta Video                   |
| MOD-006 | mod-social-feed        | Social Graph & Feed          |
| MOD-007 | mod-notifications      | Notifications                |
| MOD-008 | mod-profile-history    | Profile History & Stats      |
| MOD-009 | mod-moderation         | Moderation (Report & Block)  |
| MOD-010 | mod-localization-theme | Localization & Theming       |
| MOD-011 | mod-analytics          | Analytics                    |

## Skill Recommendations

Pattern: Supabase RLS + client-composed feed queries mixing Follow, Block, and privacy rules almost always outgrow raw table SELECTs and need to be wrapped in a `SECURITY INVOKER` Postgres RPC. Teams tend to discover this only after RLS query plans become unreadable.
Why: Would save future Tech Leads from re-deriving the "RLS as fence, RPC as composer" pattern. A short skill capturing when to prefer RPC over raw select-with-RLS would be broadly useful for any Supabase project.
Agent: tech-lead

Pattern: Push notifications triggered from the client are a source of duplicate/orphaned pushes. The correct pattern (Postgres trigger → Edge Function → provider API) is well known but rarely surfaced up-front, leading to rework in MOD-Notifications-shaped modules.
Why: A reusable skill entry "server-authoritative notification pattern" would let Tech Lead flag this on every project involving push, not just Send It.
Agent: tech-lead

Pattern: Initial doc-sync for a new project involves creating 11+ module spec files, status files, and per-module agent wrappers atomically. Without a pre-existing skill directory, the verify-sync.sh script cannot run, leaving manual verification as the only check. A portable "bootstrap verification" script that works before the skill directory exists would reduce human review burden on initial syncs.
Why: The absence of a skill directory on first run is a predictable gap — codifying a lightweight inline verification (check spec count matches module map, check all AC-IDs resolve, check no cross-module content) would add confidence to every initial sync without requiring the skill directory to be pre-installed.
Agent: doc-sync

## Checkpoint History
