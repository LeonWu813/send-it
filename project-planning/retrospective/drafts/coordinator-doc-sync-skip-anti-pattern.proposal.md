# Proposal: Coordinator Must Never Suppress Doc-Sync in a PM Prompt

## Evidence

**Incident — 2026-10-07 PM Updates entry ([TRIVIAL] — AC-171 bell-icon position correction, PRD Revision 33):**

The coordinator dispatched PM to apply a [TRIVIAL] PRD correction: AC-171's bell icon position was changed from "top-right" to "top-left". The coordinator's prompt to PM included an explicit instruction not to invoke Doc-Sync. The resulting PM Updates entry records this verbatim:

> "**Doc-Sync not invoked for this change** — the engineer is already fixing the code directly; the MOD-007/MOD-001 specs may carry the corrected AC-171 position on the next routine sync pass."

The coordinator's stated reasoning was that Doc-Sync would be redundant because the engineer had already been given the correct "top-left" instruction in the bug-fix prompt. This reasoning was wrong:

1. The bug-fix prompt is ephemeral. It is not stored anywhere that a future engineer, QA agent, or the current session's QA run can inspect.
2. The spec (`project-planning/modules/mod-notifications/spec.md`) continued to say "top-right" after the PRD said "top-left". This made the spec stale immediately upon the PM commit.
3. QA caught the PRD/spec discrepancy in the next QA run (QA Run 4, 2026-10-07), which required an additional Doc-Sync pass to clean up.

**Effect on QA Run 4 (2026-10-07):**

QA Run 4 for MOD-007 (qa-mod-notifications) was invoked to verify the AC-171 regression fix. The QA agent reads the spec as its source of truth for acceptance criteria. Because Doc-Sync had not been run, the spec still listed "top-right" for AC-171 — inconsistent with the PRD (Rev 33: "top-left") and inconsistent with the code (which was fixed to "top-left" by the engineer). The QA agent could not straightforwardly verify AC-171 from the spec. The discrepancy was surfaced, required clarification, and required a follow-on Doc-Sync pass to resolve before the module could be marked as fully synced.

**Root cause analysis:**

The coordinator made a judgment that Doc-Sync was a "routing" decision it could make unilaterally — choosing to skip propagation because the engineer had received the correct instruction out-of-band. This misunderstands the purpose of Doc-Sync:

- The spec is the standing, persistent source of truth for every future agent session — not the coordinator's verbal instructions to an engineer.
- The [TRIVIAL] tag on a PM change means no *structural* change (no new AC ID, no new module, no DB migration) — it does not mean spec propagation is optional.
- Every PM change that touches spec-visible content (AC text, AC IDs, UI specifications) must be followed by Doc-Sync. The mechanism is: PM tag → Doc-Sync reads the tag → Doc-Sync updates the relevant spec(s). This guarantee is broken the moment the coordinator tells PM to suppress Doc-Sync.

**Supporting pattern — multiple prior PM entries (2026-10-04, 2026-10-05):**

Every other [TRIVIAL] and [SUBSTANTIVE] entry in PM Updates ends with either "**Run `claude --agent doc-sync`.** Doc-Sync NOT invoked here." (signaling that the coordinator must invoke Doc-Sync next) or explicit Doc-Sync invocation. The AC-171 entry is the only one that instead says "Doc-Sync not invoked for this change … may carry the corrected AC-171 position on the next routine sync pass" — an indefinite deferral that caused a spec drift within the same session.

## Proposed Change

Add a hard rule to `CLAUDE.md` (Coordinator Instructions) under the `## Hard rule` section, immediately after the existing "pre-action gate" paragraph:

```markdown
**Doc-Sync suppression is never a coordinator decision.** After every PM change — [INIT], [SUBSTANTIVE], or [TRIVIAL] — the coordinator must invoke Doc-Sync (or explicitly record that it will be invoked before the next QA run). The coordinator must never include "do not invoke doc-sync", "skip doc-sync", or any equivalent instruction in a PM prompt. The [TRIVIAL] tag means no structural PRD change — it does not mean spec propagation is optional. If the engineer is already working with the correct instruction, Doc-Sync is still required to make the spec match; an out-of-band verbal instruction to an engineer does not substitute for a spec update. The spec is the persistent source of truth for all future sessions; the coordinator's session-local instructions are ephemeral and are not stored anywhere a future agent can read them.

The correct sequence is always:
1. PM applies the change and records a PM Updates entry.
2. Coordinator invokes Doc-Sync (immediately, not deferred to a "next routine pass").
3. Doc-Sync updates the relevant spec(s) and commits.
4. Engineer and/or QA proceed with an up-to-date spec.

The only valid reason to defer Doc-Sync past step 2 is if the PM Update itself explicitly states that no spec-visible content changed (e.g., a `production.md`-only convention with no AC text) — and even in that case, Doc-Sync should still be invoked to update the sync revision number and confirm nothing was missed.
```

## Target File

`CLAUDE.md` (project root) — `## Hard rule` section, added as a new named rule after the "pre-action gate" paragraph.

Per the ownership table in `CLAUDE.md`, `.claude/skills/*` and other `.claude/agents/*.md` files are the only files the coordinator may edit on explicit human instruction. `CLAUDE.md` itself is the coordinator's own instructions and is not listed as owned by any agent — it is the one planning-adjacent file the human maintains and that a retrospective proposal may target for the coordinator's own behavior.

**Note:** `CLAUDE.md` is coordinator-scope documentation, not a skill or agent definition file. The human should apply this change directly (or via the create-agent-skills skill if a template mechanism is in place), since the coordinator is not authorized to edit `CLAUDE.md` on its own initiative.

## Impact

- **Coordinator:** has an unambiguous, named rule that closes the "trivial = skip propagation" reasoning trap. The rule is co-located with the existing "small and obvious trap" and "pre-action gate" rules, which address analogous reasoning failures.
- **PM:** receives prompts that never include a suppression instruction. PM's own process (log tag → signal Doc-Sync) is not corrupted by coordinator-injected instructions.
- **Doc-Sync:** guaranteed to be invoked after every PM change that touches spec-visible content, not deferred to an indefinite "next routine pass".
- **QA agents:** read specs that are always current with the PRD at the time of their QA run. Spec/PRD discrepancies of the AC-171 class cannot occur.
- **Engineers:** the spec they read in future sessions reflects the latest AC text, not a version from before the most recent PM correction.

## Risk

- The proposed rule text requires distinguishing between "spec-visible content changed" (always invoke Doc-Sync immediately) and "production.md-only convention with no AC text change" (Doc-Sync still invoked, but the triggering reason is the sync revision, not a spec update). Several existing PM Updates entries (e.g., the 2026-10-04 and 2026-10-05 [TRIVIAL] convention entries) explicitly call out "no module spec changes required" and end with "Run `claude --agent doc-sync`. Doc-Sync NOT invoked here." — meaning the coordinator was already expected to invoke Doc-Sync but the entries make the no-spec-change case explicit. The proposed rule should not be read as prohibiting those entries from continuing to make that distinction; it prohibits the coordinator from using that distinction as a reason to skip Doc-Sync entirely (as happened with AC-171).
- If `CLAUDE.md` is generated or templated from `~/.claude/skills/prd-format/templates/CLAUDE.tmpl.md`, the rule addition must also be applied to the template so it propagates to future projects scaffolded from it. The retrospective agent cannot verify whether a template exists at that path; the human should check before applying.
- No existing agent behavior is removed or restricted by this proposal. Doc-Sync's own process (read PM tag, update spec, commit) is unchanged. The change is solely a constraint on what the coordinator may include in a PM invocation prompt.
