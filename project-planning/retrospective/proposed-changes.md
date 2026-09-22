# Retrospective: Proposed Changes

**Date:** 2026-09-21
**Scope:** Post-MOD-001 through MOD-004 — human simulator QA + workflow discussion
**Trigger:** iPhone 17 Pro simulator QA revealed top-bar hidden under Dynamic Island on all screens; workflow discussion clarified `production.md` ownership

---

## Summary of Proposals

Ordered by estimated impact (highest first).

---

### 1. Add Safe Area Insets Judgment Item to Engineer Checklist

**Target file:** `~/.claude/skills/engineer-checklist/SKILL.md` — `<judgment_items>` section

**Rationale:** All four shipped modules (MOD-001–004) omitted `useSafeAreaInsets()` because no engineer checklist item required it and no production.md convention existed at the time of implementation. Seven unstarted modules (MOD-005–011) all include UI screens. Adding an explicit checklist item prevents recurrence on every future screen-writing module.

**Draft:** `project-planning/retrospective/drafts/safe-area-insets-engineer-checklist.proposal.md`

---

### 2. Add Safe Area Insets to QA Common Failure Patterns

**Target file:** `~/.claude/skills/qa-checklist/references/common-failure-patterns.md` — append as next numbered pattern

**Rationale:** The safe area defect was not caught by any of the four QA agent runs because the skill had no iOS layout failure pattern. The entry provides QA agents with a code inspection checklist and a concrete simulator test step (Dynamic Island visual check) to include in every future human test script. Automated tests cannot catch this class of failure; only a visual simulator check can.

**Draft:** `project-planning/retrospective/drafts/safe-area-insets-qa-failure-pattern.proposal.md`

---

### 3. Document production.md Ownership and Mid-Project Escalation Path

**Target file:** New project-level skill — suggested `~/.claude/skills/agent-workflow/SKILL.md` (create via create-agent-skills skill)

**Rationale:** When the safe area gap was identified, the correct escalation path (human/coordinator → Tech Lead → production.md → Engineer bugfix → QA regression) was followed correctly but was not documented anywhere. Without documentation, each future coordinator session must resolve the role boundary ad-hoc. Additionally, existing Skill Recommendations in `status.md` (i18n catalog gap, named-color convention gap) show that agents identify convention gaps but have no explicit routing path. A lightweight agent-workflow skill encodes artifact ownership and the escalation path so that all agents and the coordinator follow it consistently.

**Draft:** `project-planning/retrospective/drafts/production-md-ownership-role-boundary.proposal.md`

---

## How to Apply an Approved Proposal

For each approved proposal, tell Claude Code:

> "Use the create-agent-skills skill to create a project-level skill based on `project-planning/retrospective/drafts/<proposal-file>.md`"

For proposals targeting existing skill files (proposals 1 and 2 above), instruct Claude Code to apply the exact change described in the "Proposed Change" section of the draft to the target file. Review the diff before committing.
