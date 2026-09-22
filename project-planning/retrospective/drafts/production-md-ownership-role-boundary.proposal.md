# Proposal: Document production.md Ownership and Mid-Project Convention Escalation Path

## Evidence

**Incident — 2026-09-21 (conveyed in retrospective invocation context, consistent with project-planning/status.md ## Tech Lead Reviews):**

When the safe area defect was identified after human QA, a question arose about who should edit `production.md` to add the missing convention. The coordinator (Claude Code) was a candidate since it orchestrated the agents. The resolution reached was that Tech Lead owns `production.md` conventions and is the correct agent to invoke for cross-cutting architectural gaps discovered mid-project. The Tech Lead Review entry in `status.md` confirms this was the path taken: Tech Lead wrote the "Screen Layout & Safe Area Insets" section to `production.md`.

**Gap identified:** No agent definition, skill, or planning doc explicitly states:
1. Which agent role owns `production.md` (can write to it).
2. What the correct escalation path is when a mid-project convention gap is identified by a human or the coordinator.
3. That the coordinator (Claude Code) does not own or directly edit any planning artifact.

Without this documentation, each coordinator session must resolve the role boundary ad-hoc, risking inconsistent behavior (e.g., a future coordinator directly editing `production.md` and bypassing Tech Lead review).

**Supporting evidence from status.md Skill Recommendations (2026-09-21):**

The following recommendations were logged by QA and Engineer agents, each representing a case where a mid-project convention gap was identified but the escalation path was implicit rather than explicit:
- "Cross-module i18n catalog updates" — convention gap in the self-check script whitelist; unclear whether Engineer or Tech Lead resolves it.
- "React Native named colors for enum-to-color mappings" — convention gap; unclear whether it goes to production.md or coding-conventions skill.

These entries illustrate that agents identify gaps but have no documented path for routing them to the right owner.

## Proposed Change

Add a new section to `~/.claude/skills/engineer-checklist/SKILL.md` under a `<escalation_rules>` block (or equivalent), OR add a dedicated lightweight skill file for the coordinator. However, because engineer-checklist is not the right home for coordinator-level rules, the better target is a new project-level skill (to be created via the create-agent-skills skill) that documents the artifact ownership map and escalation path.

The content to encode:

```
## Planning Artifact Ownership

| Artifact | Owner (writer) | All others |
|----------|---------------|------------|
| prd.md | PM | Read-only |
| production.md | Tech Lead | Read-only |
| modules/*/spec.md | Doc-Sync (triggered by PM) | Read-only |
| project-planning/status.md | All agents (each writes only their own section) | — |
| project-planning/modules/*/status.md | Engineer + QA for that module | Read-only for others |

## Mid-Project Convention Escalation Path

When any agent or human identifies a shared convention that is missing from production.md (e.g., a layout pattern, a naming rule, a data access pattern):

1. Human or coordinator identifies the gap.
2. Coordinator invokes Tech Lead with: the gap description + the affected modules + the proposed convention text.
3. Tech Lead writes the convention to production.md and commits.
4. Coordinator invokes affected Engineer agents in bugfix mode to apply the convention to already-shipped screens.
5. Coordinator invokes affected QA agents in regression mode to re-verify.

## Coordinator Rule

Claude Code (coordinator) orchestrates agents. It does not own any planning artifact and must not directly edit prd.md, production.md, or any module spec. If a planning artifact needs updating, invoke the owning agent role.
```

## Target File

A new project-level skill, suggested path: `~/.claude/skills/agent-workflow/SKILL.md` (to be created via the create-agent-skills skill).

Alternatively, if a project already has a coordinator or workflow reference document, this content belongs there. For this project, no such document exists yet.

## Impact

- **Coordinator (Claude Code):** has an unambiguous rule: do not edit planning artifacts directly; invoke the owning agent.
- **Engineer and QA agents:** when they log a Skill Recommendation in `status.md`, they can reference the escalation path to route it to Tech Lead rather than leaving it as an open observation.
- **Tech Lead:** its ownership of `production.md` is codified, making it the clear entry point for any architectural convention gap discovered at any project phase.
- **Doc-Sync:** its constraint (triggered by PM only; translates PRD → specs and production.md for structural changes) is distinguished from Tech Lead's role (mid-project convention additions that do not originate from a PRD change).

## Risk

- This proposal documents a workflow that already worked correctly in this incident (Tech Lead did write the convention; the escalation path was followed). The risk of not documenting it is that a future coordinator session resolves the role boundary differently.
- The proposed new skill (agent-workflow) is a new file type for this project. If the project already has a coordinator agent definition in `.claude/agents/`, the content could be added there instead — but writing to `.claude/agents/` requires human application via the create-agent-skills skill.
- No existing skill content is removed or changed by this proposal.
