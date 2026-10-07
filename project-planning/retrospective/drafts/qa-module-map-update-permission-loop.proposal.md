# Proposal: QA Agent Cannot Update Module Map — Infinite Confirmation Loop in Auto-Mode

## Evidence

**Source: Direct observation — 2026-10-07 coordinator session (qa-mod-notifications)**

After QA Run 4 for MOD-007 (Notifications) passed (472/473 tests, 0 TypeScript errors, both AC-054 and AC-171 regression failures resolved), the coordinator asked `qa-mod-notifications` to update the Module Map row in `project-planning/status.md` (MOD-007: "Not started" → "QA Pending Human Sign-off"). The agent was running in auto-mode.

The agent refused to write to `status.md`. It cited that writes to shared planning artifacts required elevated confirmation that must come directly from the user — not a coordinator-relayed message. The coordinator relayed the user's "yes" multiple times via SendMessage. Each relay caused the agent to restart, read the relay, and refuse again, because the confirmation guard accepts only messages typed directly by the user in the main conversation thread. Subagents in auto-mode only receive what the coordinator explicitly relays; they never see the user's raw messages. The agent entered a loop: ask for confirmation → receive a relay → reject the relay as not a direct user message → ask again. The loop persisted until the coordinator gave up relaying and the Module Map row was left stale.

**Observed state after QA Run 4 commit (2026-10-07):**

The `## Module Map` table in `project-planning/status.md` still shows:

```
| MOD-007 | mod-notifications      | Not started | —                         |
```

The `project-planning/modules/mod-notifications/status.md` file records:

> "**QA PASS — regression test.** 472 of 473 tests pass … All regression fixes independently verified … No new regressions introduced."
> — QA Run 4, 2026-10-07

The global table says "Not started". The module-level source of truth says QA PASS. The two are in disagreement because the QA agent could not update the Module Map row.

**Source: `~/.claude/agents/templates/qa.md` — `<write_scope>` section**

The QA agent's write scope is defined as:

> "You may only write to:
> - `project-planning/modules/<assigned-module>/status.md` — QA Results section only
> - `project-planning/status.md` — Last Action and Skill Recommendations sections only"

The Module Map, located at `## Module Map` in `project-planning/status.md`, is not included in the QA agent's write scope. The agent cannot legally update the Module Map row without exceeding its declared scope — hence the confirmation guard triggers.

**Relation to Proposal 10 (module-map-drift-verification):**

Proposal 10 addresses a distinct failure mode: an agent forgets or omits the Module Map update (drift by omission). This proposal addresses a different structural failure: the agent actively tries to update the Module Map, is blocked by an architectural permission constraint it cannot bypass in auto-mode, and loops indefinitely asking for a form of confirmation that is impossible to deliver to it. The root cause here is not agent negligence but a gap between the agent's write scope and its required completion task.

## Root Cause

The QA agent must update the Module Map row as a completion step (this follows from the Proposal 10 convention and from the natural expectation that a QA PASS produces a visible status change). However, the write scope in `~/.claude/agents/templates/qa.md` does not grant this permission. When the agent operates in auto-mode, any attempt to write outside its declared scope triggers a confirmation guard that can only be satisfied by a direct user message in the main conversation thread. Subagents never see the user's raw messages — they only see what the coordinator relays. The coordinator's relay is not recognized as a direct user confirmation. The result is an unresolvable loop.

## Proposed Change

Three options are evaluated below. They are not mutually exclusive; the proposal recommends Option A as the primary fix, with Option C as an immediate fallback protocol.

### Option A (recommended) — Expand QA write scope to include the assigned module's Module Map row

Add the Module Map row update to the QA agent's declared write scope in `~/.claude/agents/templates/qa.md`. The QA agent already writes Last Action to `project-planning/status.md`; extending this to the Module Map row for the module it just QA'd is a narrow, bounded permission that does not open the file broadly.

Exact addition to the `<write_scope>` section of `~/.claude/agents/templates/qa.md`:

```
- `project-planning/status.md` — **Module Map row for the assigned module only**: after a QA PASS verdict, update the `Status` column of the assigned module's row in the `## Module Map` table to `QA Pending Human Sign-off` and the `Agent last acted` column to `qa-mod-<name>`. After a QA FAIL verdict, update `Status` to `In Progress` and `Agent last acted` to `qa-mod-<name>`. These are the only two cells you may edit in the Module Map table; do not touch any other row or column.
```

And add the corresponding step to the `<process>` section, after step 11 (Last Action update) and before step 12 (commit):

```
11a. Update the assigned module's row in `## Module Map` in `project-planning/status.md`:
     - QA PASS → Status: `QA Pending Human Sign-off`, Agent last acted: `qa-mod-<name>`
     - QA FAIL → Status: `In Progress`, Agent last acted: `qa-mod-<name>`
     This update is within your declared write scope. No confirmation is required.
```

**Why this is safe:** The QA agent's verdict (PASS or FAIL) is unambiguous and recorded in the module status file it already writes. The Module Map row update is a direct mechanical consequence of the verdict — there is no judgment call that requires human input. Treating it as requiring elevated confirmation treats a mechanical update the same as a policy decision, which is the misclassification that causes the loop.

### Option B (alternative) — Delegate Module Map row updates to the coordinator as a permitted housekeeping action

Define a coordinator exception: after a QA agent completes and reports its verdict, the coordinator may update the assigned module's Module Map row without invoking any agent. This is a narrow, scoped write permission — the only permitted edit is the `Status` and `Agent last acted` cells in the row matching the module that just acted.

The coordinator would add this step to its post-QA handoff: read the QA verdict from the module status file, then update the Module Map row directly.

**Why this is riskier than Option A:** The coordinator has a general prohibition against writing to `project-planning/status.md` directly (it is in the ownership table with no coordinator exception). Adding a narrow exception requires updating `CLAUDE.md`. If the coordinator misapplies the exception (updates the wrong row or the wrong value), the error is harder to trace than an agent-owned update. Option A is cleaner because the owning agent makes the update as part of its own completion step, under its own commit.

### Option C (immediate fallback protocol — no skill change required) — Surface the exact command to the user on first loop detection

Add a coordinator convention (not an agent skill change) specifying that when a relay-confirmation loop is detected (same relay sent twice with the same refusal), the coordinator must immediately stop retrying and instead output the exact shell command the user can run to make the update directly:

```
If a subagent enters a confirmation loop over a Module Map row update, stop relaying after the second refusal. Instead, output to the user:

"The QA agent cannot accept a relayed confirmation. To update the Module Map row directly, run:

sed -i '' 's/| MOD-007 | mod-notifications      | Not started | —/| MOD-007 | mod-notifications      | QA Pending Human Sign-off | qa-mod-notifications/' project-planning/status.md

Then commit:
git add project-planning/status.md
git commit -m \"chore: update MOD-007 Module Map row to QA Pending Human Sign-off\""
```

This unblocks the user immediately without requiring any skill file change. It should be applied as a coordinator workflow convention in addition to Option A (not instead of it), since Option A prevents the loop from occurring in the first place.

## Target Files

**Primary (Option A):**
- `~/.claude/agents/templates/qa.md` — expand `<write_scope>` to include the assigned module's Module Map row; add step 11a to `<process>` for the Module Map update

**Per the ownership table, `~/.claude/agents/templates/qa.md` is generated by Doc-Sync and hand-editing is prohibited. This proposal is a recommendation for the human to evaluate and apply via the appropriate skill (create-agent-skills, or a direct edit with the human's approval). The Doc-Sync-generated per-module wrappers (`qa-mod-<name>.md`) delegate to this template — so updating the template propagates to all QA agents.**

**Secondary (Option B, if Option A is not adopted):**
- `CLAUDE.md` — add a narrow coordinator exception for Module Map row updates after a QA verdict

**Fallback (Option C, applies regardless of A/B):**
- Coordinator knowledge / coordinator-workflow convention (if a coordinator skill exists, add the loop-detection-and-escalation step there; otherwise document it as a coordinator convention in this proposal)

## Impact

- **QA agents** complete their task without looping. The Module Map row update becomes a built-in step of the QA completion sequence, not an out-of-scope write that triggers a confirmation guard.
- **Human** sees an accurate Module Map immediately after each QA run — no stale "Not started" or wrong-status rows caused by permission loops.
- **Coordinator** does not need to relay confirmation for a mechanical, verdict-driven update.
- **Auto-mode reliability** improves: the loop was a systemic failure of the auto-mode architecture (subagents cannot receive direct user confirmation), and closing it makes auto-mode QA runs fully autonomous end-to-end.
- **Complements Proposal 10** (module-map-drift-verification): Proposal 10's convention ("agents must update the Module Map") can now actually be followed by QA agents without a permission conflict.

## Risk

- **Option A scope expansion:** Granting the QA agent write access to the Module Map row introduces a new write surface. The risk is bounded because the permission is limited to the single row for the assigned module, and only to two specific cells (`Status` and `Agent last acted`). The agent already writes Last Action to the same file. The write values are mechanically derived from the PASS/FAIL verdict — there is no discretionary judgment. The risk of incorrect update is low; the risk of omitting the update (the current failure mode) is higher.
- **Template propagation:** `~/.claude/agents/templates/qa.md` is the base for all per-module QA agents. A change here affects all QA agents simultaneously. If the added step is phrased imprecisely (e.g., does not restrict to "assigned module's row only"), a QA agent could mistakenly update a different module's row. The proposed language explicitly restricts to "the assigned module's row only" — this wording must be preserved exactly when applied.
- **Option B coordinator exception:** Adding a coordinator write exception to CLAUDE.md risks drift — future coordinators may interpret the exception more broadly than intended. Option A is preferred because it keeps the update with the agent that owns the verdict, not as a side-effect of coordinator housekeeping.
- **Option C (fallback):** A shell `sed` command surfaced to the user works only if the exact Module Map row format matches the pattern. If the row format changes (e.g., column widths change), the sed pattern breaks silently. The command should be treated as illustrative — the human should verify the exact row text before running it.
