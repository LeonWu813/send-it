# Retrospective: Proposed Changes

**Date:** 2026-09-21 (updated 2026-09-22, 2026-10-01)
**Scope:** Post-MOD-001 through MOD-004 — human simulator QA + workflow discussion; MOD-003 cross-module integration gap; MOD-005 human QA session — AC-169 mock-fidelity gap
**Trigger:** iPhone 17 Pro simulator QA revealed top-bar hidden under Dynamic Island on all screens; workflow discussion clarified `production.md` ownership; human QA preparation for MOD-003 revealed `RouteNavigator` was never wired into `GymDetailScreen` (MOD-002); human QA on MOD-005 revealed AC-169 size guard silently never fired due to a mock that hid option-gated API behavior

---

## Summary of Proposals

Ordered by estimated impact (highest first).

---

### 1. Cross-Module Integration Ownership — Navigator Wiring Must Be Explicitly Assigned in Specs

**Target files:**
- New project-level skill `~/.claude/skills/spec-conventions/SKILL.md` (Part 1 — spec template convention)
- `~/.claude/skills/engineer-checklist/SKILL.md` — `<judgment_items>` section (Part 2 — engineer gate)

**Rationale:** During human QA preparation for MOD-003 (Route Catalog), `RouteNavigator` was found to be completely unwired from `GymDetailScreen` (MOD-002). The component's own file comment documented the intended embedding ("This navigator is rendered from within the gym detail context … within GymDetailScreen in MOD-002"), and MOD-003's spec listed `Dependencies: MOD-002` — but neither module's spec named the concrete integration task, the file to modify, or the engineer responsible. Both engineers stayed within their module boundaries, and the gap fell through. No checklist item or QA criterion could have caught this without an explicit integration deliverable in the spec. This is the highest-impact proposal because the same failure mode will recur on every future module that embeds a navigator or entry-point component in another module's screen (e.g., MOD-005 beta video, MOD-006 social feed).

**Draft:** `project-planning/retrospective/drafts/cross-module-integration-ownership.proposal.md`

---

### 2. Add Safe Area Insets Judgment Item to Engineer Checklist

**Target file:** `~/.claude/skills/engineer-checklist/SKILL.md` — `<judgment_items>` section

**Rationale:** All four shipped modules (MOD-001–004) omitted `useSafeAreaInsets()` because no engineer checklist item required it and no production.md convention existed at the time of implementation. Seven unstarted modules (MOD-005–011) all include UI screens. Adding an explicit checklist item prevents recurrence on every future screen-writing module.

**Draft:** `project-planning/retrospective/drafts/safe-area-insets-engineer-checklist.proposal.md`

---

### 3. Add Safe Area Insets to QA Common Failure Patterns

**Target file:** `~/.claude/skills/qa-checklist/references/common-failure-patterns.md` — append as next numbered pattern

**Rationale:** The safe area defect was not caught by any of the four QA agent runs because the skill had no iOS layout failure pattern. The entry provides QA agents with a code inspection checklist and a concrete simulator test step (Dynamic Island visual check) to include in every future human test script. Automated tests cannot catch this class of failure; only a visual simulator check can.

**Draft:** `project-planning/retrospective/drafts/safe-area-insets-qa-failure-pattern.proposal.md`

---

### 4. Mock-Fidelity Gap — Option-Gated API Return Fields (Engineer + QA + Cross-Project)

**Target files:**
- `~/.claude/skills/engineer-checklist/SKILL.md` — `<judgment_items>` section (Change 1: mock-fidelity rule)
- `~/.claude/skills/qa-checklist/references/common-failure-patterns.md` — append as pattern 10 (Change 2: API contract audit step)
- Optional follow-on: `~/.claude/agents/templates/engineer.md` and `~/.claude/agents/templates/qa.md` if templates exist (Change 3: cross-project encoding)

**Rationale:** Human QA on MOD-005 (AC-169 post-compression size guard, 2026-10-01) revealed a class of silent test failure: a Jest mock for `getInfoAsync` returned `{ exists: true, size: 1000 }` unconditionally, regardless of call arguments. This allowed engineer tests to verify the if-size-then-throw branch logic while hiding whether `size` is ever populated at runtime without a `{ size: true }` option. `tsc --noEmit` and all unit tests passed; the failure surfaced only during human QA when the real API was called without the option. The guard silently never fired and the user received a cryptic HTTP 413 instead of the friendly i18n error. The same pattern recurs whenever an API has option-gated return fields and the mock returns all fields unconditionally. Both proposed changes are general (not React Native- or expo-specific) and apply to any project using this framework with Jest-mocked external libraries.

**Draft:** `project-planning/retrospective/drafts/mock-fidelity-gap.proposal.md`

---

### 5. Document production.md Ownership and Mid-Project Escalation Path

**Target file:** New project-level skill — suggested `~/.claude/skills/agent-workflow/SKILL.md` (create via create-agent-skills skill)

**Rationale:** When the safe area gap was identified, the correct escalation path (human/coordinator → Tech Lead → production.md → Engineer bugfix → QA regression) was followed correctly but was not documented anywhere. Without documentation, each future coordinator session must resolve the role boundary ad-hoc. Additionally, existing Skill Recommendations in `status.md` (i18n catalog gap, named-color convention gap) show that agents identify convention gaps but have no explicit routing path. A lightweight agent-workflow skill encodes artifact ownership and the escalation path so that all agents and the coordinator follow it consistently.

**Draft:** `project-planning/retrospective/drafts/production-md-ownership-role-boundary.proposal.md`

---

## How to Apply an Approved Proposal

For each approved proposal, tell Claude Code:

> "Use the create-agent-skills skill to create a project-level skill based on `project-planning/retrospective/drafts/<proposal-file>.md`"

For proposals targeting existing skill files (proposals 2, 3, and 4 above), instruct Claude Code to apply the exact change described in the "Proposed Change" section of the draft to the target file. Review the diff before committing.
