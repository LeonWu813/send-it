# Proposal: Module Map Drift — Cross-Check Global Status Against Module Files Before Reporting

## Evidence

**Source: Direct observation — 2026-10-06 coordinator status report**

When the coordinator reported project status, MOD-008 (Profile History & Stats) appeared in the `## Module Map` table in `project-planning/status.md` as "QA Pending Human Sign-off". However, the invocation context for this retrospective run describes a prior state where the entry showed "Not started" — over a week after the module had actually passed QA and been ready for human sign-off. The source-of-truth file (`project-planning/modules/mod-profile-history/status.md`) correctly recorded:

> "**QA verdict: PASS** … QA PASS — mod-profile-history is ready for human QA."
> **Date**: 2026-09-29 (QA Run 2 — Regression)

The module-level file and the global Module Map were in disagreement: the module file was correct; the global table was stale. The coordinator reported the stale global table to the human without cross-checking the module files.

**Source: `project-planning/modules/mod-profile-history/status.md` — QA Run 2 (2026-09-29)**

The QA agent updated the module-level status file (`## QA Results`) with a clear PASS verdict and handoff note. It did not update the corresponding row in `project-planning/status.md` `## Module Map`. The two records silently diverged.

**Root causes (as described in the invocation):**

1. The Module Map is a manually-maintained denormalized summary. The real status of each module lives in `project-planning/modules/mod-*/status.md`. The global Module Map row for a module is supposed to be updated by the agent that last acted on it — but the QA agent for MOD-008 updated only the module file, not the global table. There is no automated enforcement of this update, and no agent definition explicitly requires it.

2. The coordinator trusted the summary without verifying against the source files. There is no skill or convention requiring the coordinator to cross-check the Module Map against module-level files before reporting project status to the human.

**Impact of the drift:**

The Module Map is the human's primary dashboard for deciding which modules are ready for human QA and what to work on next. A stale "Not started" or "QA Pending" entry delays human QA scheduling and creates a false picture of project progress. The drift was silent — no agent flagged it, no check caught it.

## Proposed Change

### Part 1 — New script: `scripts/check-module-map.sh`

Create a new shell script that cross-checks the `## Module Map` table in `project-planning/status.md` against each module's `status.md` and prints mismatches. The script should:

1. Parse each row of the `## Module Map` table in `project-planning/status.md` (module ID, directory, status).
2. For each module directory, read `project-planning/modules/<directory>/status.md` and extract the most recent QA verdict and Engineering Progress status from the file.
3. Print a mismatch report if the global table status does not match what the module file indicates — for example: the global table says "Not started" but the module file has a QA PASS entry.
4. Exit with a non-zero code if any mismatches are detected, so the coordinator can treat it as a blocking check before reporting status.

Suggested script content (shell):

```bash
#!/usr/bin/env bash
# check-module-map.sh
# Cross-checks the global Module Map in project-planning/status.md
# against each module's project-planning/modules/*/status.md.
# Prints mismatches and exits non-zero if any are found.

set -euo pipefail

STATUS_FILE="project-planning/status.md"
MODULES_DIR="project-planning/modules"
MISMATCHES=0

# Extract module directory names from the Module Map table
# Table rows look like: | MOD-NNN | mod-slug | Status | Agent |
while IFS='|' read -r _ mod_id directory status _rest; do
  mod_id=$(echo "$mod_id" | tr -d ' ')
  directory=$(echo "$directory" | tr -d ' ')
  status=$(echo "$status" | tr -d ' ')

  # Skip header and separator rows
  [[ "$mod_id" =~ ^MOD-[0-9]+ ]] || continue
  [[ "$directory" == "Directory" ]] && continue

  module_file="$MODULES_DIR/$directory/status.md"

  if [[ ! -f "$module_file" ]]; then
    echo "WARN: $mod_id — no module status file found at $module_file"
    continue
  fi

  # Check for QA PASS verdict in the module file
  if grep -q "QA verdict: PASS" "$module_file"; then
    if [[ "$status" == "Notstarted" || "$status" == "InProgress" ]]; then
      echo "MISMATCH: $mod_id ($directory) — Module Map says '$status' but module file records QA PASS"
      MISMATCHES=$((MISMATCHES + 1))
    fi
  fi

  # Check for QA FAIL verdict (module needs engineer attention)
  if grep -q "QA verdict: FAIL" "$module_file" && ! grep -q "QA verdict: PASS" "$module_file"; then
    if [[ "$status" == "QAPendingHumanSign-off" || "$status" == "Notstarted" ]]; then
      echo "MISMATCH: $mod_id ($directory) — Module Map says '$status' but module file has unresolved QA FAIL"
      MISMATCHES=$((MISMATCHES + 1))
    fi
  fi

done < <(grep -A 100 "^## Module Map" "$STATUS_FILE" | grep "^| MOD-")

if [[ $MISMATCHES -gt 0 ]]; then
  echo ""
  echo "ERROR: $MISMATCHES mismatch(es) found. Update project-planning/status.md ## Module Map before reporting status."
  exit 1
else
  echo "OK: Module Map is consistent with all module status files."
fi
```

### Part 2 — Convention: agents that update a module status file must also update the Module Map row

Add the following convention to the relevant agent skills (engineer checklist and/or a new agent-workflow skill). The exact text to add:

**Convention — Module Map must be kept in sync with module status files.**

Any agent that updates a module's own `project-planning/modules/<directory>/status.md` (whether writing an Engineering Progress entry or a QA Results entry) must also update the corresponding row in the `## Module Map` table in `project-planning/status.md` before completing its task. The Module Map row must reflect the module's current state:

- Engineering in progress → "In Progress"
- Engineering complete, awaiting QA → "In Progress" (or "QA Ready" if the table uses that label)
- QA PASS, awaiting human sign-off → "QA Pending Human Sign-off"
- QA FAIL, returned to engineering → "In Progress"
- Human signed off → "QA Passed"

Failure to keep the Module Map in sync creates a silent reporting gap: the coordinator and human see stale status without any flag that the source-of-truth file disagrees.

### Part 3 — Convention: coordinator must run the check script before reporting status

Add the following item to the coordinator's workflow (or a coordinator-skill if one exists):

**Before reporting project status to the human, run `bash scripts/check-module-map.sh` from the project root.** If the script reports any mismatches, resolve them first (by reading the relevant module status files and correcting the Module Map) or surface them explicitly in the status report with a note that the global table may be stale and the module files are the authority.

## Target Files

1. **New file**: `scripts/check-module-map.sh` — the verification script (applied by engineer or coordinator manually; not via create-agent-skills)
2. **`~/.claude/skills/engineer-checklist/SKILL.md`** — add a completion gate: "Before finalizing any Engineering Progress update in a module's status.md, update the corresponding Module Map row in `project-planning/status.md`"
3. **`~/.claude/skills/qa-checklist/SKILL.md`** (or equivalent QA skill file) — add the same Module Map update requirement to the QA agent's post-verdict step
4. **A new coordinator-workflow convention** (if a coordinator skill exists) — add the pre-status-report script invocation

**Note on Part 1**: The script creation targets `scripts/check-module-map.sh`, which is source code, not a `.claude/` skill file. It should be applied via `engineer-mod-*` invocation (or directly by the human) rather than via `create-agent-skills`. Parts 2 and 3, which target skill files, are the primary deliverables of this proposal for the create-agent-skills workflow.

## Impact

- **Coordinator** no longer silently trusts a stale global table. The pre-status-report script check surfaces any drift before the human sees it.
- **QA agents** gain an explicit completion gate requiring Module Map update before task is done, closing the gap that caused the MOD-008 drift.
- **Engineer agents** gain the same completion gate, so Engineering Progress entries that change module state are always reflected globally.
- **Human** gets an accurate dashboard. Stale "Not started" entries that hide completed work are eliminated, reducing scheduling delays for human QA.
- **Cross-project**: this pattern applies to any project that uses a denormalized global summary table — the script is a lightweight, no-dependency shell check with no build tooling required.

## Risk

- The script uses `grep` on the module status files for verdict strings ("QA verdict: PASS", "QA verdict: FAIL"). If agents use slightly different wording in their verdict lines, the script will produce false negatives (mismatches not caught). The script should be treated as a safety net, not an authoritative source — the human or coordinator must still read the actual module files when a mismatch is flagged. The convention (Parts 2 and 3) is the primary protection; the script is a verification aid.
- The Module Map update requirement adds a small amount of mandatory work per agent completion. For modules with multiple Engineer → QA cycles (like MOD-008's two QA runs), the agent must update the row on each cycle. This is low overhead given the clear benefit, but it should be phrased as a required completion gate, not an advisory suggestion, to avoid agents skipping it under time pressure.
- The check script does not parse Module Map status values with full fidelity (it strips spaces, which may lose multi-word status values like "QA Pending Human Sign-off"). The script as written is illustrative — the exact implementation should be reviewed and hardened before use. The proposal's structural value is the convention (Parts 2 and 3), not the script's precise regex logic.
