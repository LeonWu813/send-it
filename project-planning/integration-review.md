# Integration & Optimization Review

<!-- Created by Tech Lead on the first phase-end review. One row per finding — never
     embed findings inline in module status.md files. Status transitions are split by
     owner, mirroring modules/*/status.md:
       - Tech Lead owns: PROPOSED, NO ISSUES, CONFIRMED CLOSED — and records the human's
         decisions (APPROVED / REJECTED / DEFERRED, plus Assigned Module) and the human's
         verification (HUMAN VERIFIED) exactly as the human states them
       - Engineer owns:  IN PROGRESS, FIXED – AWAITING QA (only on rows assigned to it)
       - QA owns:        QA VERIFIED (or sends back with a note)
     A finding that implies a user-facing requirement change does not belong here —
     it should have been escalated to PM's change flow instead. -->

## Status Legend

`PROPOSED` → `APPROVED` / `REJECTED` / `DEFERRED` → `IN PROGRESS` → `FIXED – AWAITING QA` → `QA VERIFIED` → `HUMAN VERIFIED` → `CONFIRMED CLOSED`

PM's checkpoint gate for a phase requires every row logged for that phase to be `CONFIRMED CLOSED`, `REJECTED`, `DEFERRED`, or `NO ISSUES`. Any row in between (`PROPOSED` through `HUMAN VERIFIED`) is still open and blocks the checkpoint. Concerns and Recommendations are gated the same way; severity doesn't change the mechanism, only how much scrutiny the human gives before deciding.

---

## Phase 1 — Integration & Optimization Review — 2026-10-19

**Reviewer**: Tech Lead (advisory only — no source, spec, or PRD files edited; findings are proposals, the human decides).

**Phase 1 modules (per PRD §7)**: MOD-001 … MOD-012 (all twelve).

### Phase-completeness gate (read this first)

A phase-end integration review is defined to run *after every module in the phase has `PASS` in its `status.md` QA Results*. Phase 1 does **not** yet meet that precondition:

- **MOD-011 (mod-analytics) — NOT STARTED.** `project-planning/modules/mod-analytics/status.md` has empty Engineering Progress and empty QA Results. No code, no QA, no human sign-off. MOD-011 is in Phase 1 scope (PRD §7 "Modules: … MOD-011 …"). This is a hard blocker (**BLK-1** below).
- **MOD-004 / MOD-005 Module Map cells are stale** but the modules themselves are effectively done: `modules/mod-send-logging/status.md` records **QA PASS** with human sign-off confirmed on AC-131/AC-132, and `modules/mod-beta-video/status.md`'s latest verdict is **QA PASS** (like-icon regression; AC-162 passing). The main Module Map still shows "QA Pending Human Sign-off" for both — a tracking-doc staleness, not a real engineering gap (**BLK-2**, data-correction only).

The scan found **no migration filename/timestamp collisions** (40 migrations, all prefixes unique and module-namespaced) and **no duplicate route/endpoint definitions**. Cross-module table touches (`users`, `routes`, `beta_videos`) are all timestamp-ordered after their base-table creation and are read-side RPC/RLS access consistent with the shared-Postgres design, not conflicting DDL.

No open `ESCALATED TO TECH LEAD` repeat-failure markers exist in any module `status.md`.

## Findings

| ID | Phase | Category | Description | Location | Tech Lead Rationale & Trade-offs | Status | Assigned Module | Notes |
|---|---|---|---|---|---|---|---|---|
| INT-001 | 1 | Conflict (Concern) | Cross-module deep import into another module's private `screens/` directory, breaking the Cross-Module Imports convention. `RouteDetailScreen` imports `LogSendScreen` directly from MOD-004's internal `screens/` path. `LogSendScreen` is **not** exported from the MOD-004 barrel (`mod-send-logging/index.ts`), whose own docstring says "Other modules must import from this barrel file, not from internal module files directly." | `src/modules/mod-route-catalog/screens/RouteDetailScreen.tsx:60` imports from `../../mod-send-logging/screens/LogSendScreen`; barrel at `src/modules/mod-send-logging/index.ts` exports only services + types | production.md Shared Conventions → "Cross-Module Imports": "A module may import another module's **public service functions** and **navigator entry-point components** only — never its internal `screens/` or `components/` subdirectories directly." The MOD-003↔MOD-005 beta-upload coupling IS a blessed Integration Point (MOD-003 spec §Integration Points #1, line 337–339), but the *mechanism* here (reaching into a raw private screen) is the exact drift the convention forbids. Failure scenario: MOD-004 refactors or renames `screens/LogSendScreen.tsx` (fully within its own boundary, no barrel contract changed) → MOD-003 breaks at build time with no warning, because the dependency was never declared through the public surface. Fix (no behavior change): MOD-004 exposes `LogSendScreen` (or an opener) through its barrel; MOD-003 imports via `'../../mod-send-logging'`. Coordinated MOD-003 + MOD-004 change. | PROPOSED | | Two engineers must coordinate: MOD-004 adds the export, MOD-003 switches the import. Purely a build-boundary fix; no user-facing behavior change. |
| INT-002 | 1 | Conflict (Concern) | Tape-display import bypasses the mandated canonical façade. MOD-005's reel viewer imports `TapeBadge` directly from MOD-003's internal `components/TapeBadge`, instead of from `@/lib/tape` (the Rev 41 canonical entry point). This is both a Cross-Module Imports break (reaching into MOD-003's private `components/`) and a drift from the explicit tape convention. | `src/modules/mod-beta-video/components/BetaVideoReelViewer.tsx:86` and `src/modules/mod-beta-video/stories/ReelOverlay.stories.tsx:10` import from `../../mod-route-catalog/components/TapeBadge` | production.md Shared Conventions → "tape.ts (hold/tape color display)" (line 386): "Canonical file: `src/lib/tape.ts`. **All** tape and hold-color display logic imports from this file." `src/lib/tape.ts` is a thin re-export façade over MOD-003's implementation precisely so consumers never deep-import across the boundary. Failure scenario: MOD-003 relocates/renames `components/TapeBadge.tsx` (allowed — it is internal; the façade is the contract) → MOD-005 breaks. Also, two import paths to the same component defeats the single-source-of-truth the Rev 41 convention established. Fix (no behavior change): change both MOD-005 imports to `import { TapeBadge } from '@/lib/tape'`. Single-module (MOD-005) change. | PROPOSED | | MOD-005-only fix. Note: all *intra-MOD-003* imports of `RouteColorBadge`/`TapeBadge` are fine — a module importing its own components is not a cross-module leak. |
| INT-003 | 1 | Conflict (Recommendation) | Public-but-deep import: `RouteDetailScreen` imports `BetaVideoSection` via MOD-005's internal `components/` path even though the symbol **is** exported from MOD-005's barrel. Lower severity than INT-001/INT-002 (the symbol is genuinely public), but it is the same drift pattern and should be normalized while the above are being fixed. | `src/modules/mod-route-catalog/screens/RouteDetailScreen.tsx:59` imports from `../../mod-beta-video/components/BetaVideoSection`; the symbol is already exported at `src/modules/mod-beta-video/index.ts:12` | The import target is a declared Integration Point and a public symbol, so there is no missing-contract risk as in INT-001 — only a style/consistency gap: the barrel exists for exactly this and is bypassed. Trade-off: trivial one-line change to `import BetaVideoSection from '../../mod-beta-video'` (or named export); the only cost is touching the file. Grouping it with INT-001 (same file, same reviewer pass) keeps the MOD-003↔MOD-005 import surface uniform. Single-module (MOD-003) change. | PROPOSED | | Optional. Bundle with INT-001 since both are in `RouteDetailScreen.tsx`. |
| INT-004 | 1 | Optimization (Recommendation) | Per-RouteCard signed-URL fetch on every mount is an integration-boundary performance cost visible only across modules. `RouteCard` (app-level shared component, consumed by MOD-003 RouteListScreen, MOD-012 HomeScreen, MOD-008 profile history) calls `getPhotoSignedUrl` in a `useEffect` on each mount; a list/grid of N cards issues N independent signed-URL requests per render, with no shared cache across the three consuming surfaces within a session. | `src/components/RouteCard.tsx` (per-mount `useEffect` → `getPhotoSignedUrl` in `mod-route-catalog/route-service.ts`); consumers: RouteListScreen (MOD-003), HomeScreen (MOD-012), profile-history list (MOD-008) | This is the exact "whole-system view only" class the optimization criteria name: invisible in any single module's tests (each card works), obvious when tracing a scrolling list across the shared component + three callers. There is already a Tech Lead advisory on this (status.md → "Review — 2026-10-16 — Signed URL Cache Design"). Concrete trade-off: an in-memory signed-URL cache keyed by storage path with a TTL below the URL expiry would cut repeated fetches on re-scroll/tab-switch to near zero, at the cost of one new shared cache module both the route-service and RouteCard adopt, plus cache-invalidation discipline. **Pre-TestFlight optimization, not a correctness bug** — safe to DEFER if the human wants to ship Phase 1 first. | PROPOSED | | See the 2026-10-16 "Signed URL Cache Design" Tech Lead review for the concrete plan. Candidate to DEFER past the Phase 1 checkpoint. |

### Blockers that must be resolved before the PM Phase 1 checkpoint

- **BLK-1 (hard, blocks sign-off): MOD-011 (mod-analytics) is not built.** No engineering, no QA, no human sign-off. Phase 1 cannot be signed off as integration-complete while a Phase-1 module has zero implementation. This is **not** an integration-review finding (nothing to integrate yet) — it is a phase-completeness gap. Route: PM/coordinator to schedule MOD-011 engineering + QA, OR a PM change-flow decision to formally defer MOD-011 out of Phase 1 (which would be a PRD §7 scope change, PM-owned — not something this review can decide). Until one of those happens, the phase-end review cannot be completed in full and PM's checkpoint gate should not pass.
- **BLK-2 (soft, data-correction): Module Map stale for MOD-004 and MOD-005.** Both read "QA Pending Human Sign-off" in the main Module Map, but their module `status.md` files record QA PASS with human sign-off (MOD-004) / QA PASS latest verdict (MOD-005). Route: a PM `[TRIVIAL]` Module Map correction (same pattern as the 2026-10-14 MOD-009/MOD-010 cell correction). Not an engineering blocker.

### Sign-off

**NOT signed off.** Phase 1 is not integration-complete: BLK-1 (MOD-011 unbuilt) must be resolved first, and INT-001 / INT-002 (cross-module boundary breaks — Concerns) should be fixed or explicitly accepted by the human before the PM checkpoint. INT-003 and INT-004 are Recommendations the human may approve, defer, or reject. BLK-2 is a Module Map correction for PM.
