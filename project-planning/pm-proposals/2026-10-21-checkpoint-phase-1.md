Status: pending

# PM proposal — checkpoint, Phase 1 (2026-10-21)

Mode: checkpoint (proposal pass). Nothing below has been written to `status.md` sections other than Last Action, and no tag has been created.

## 1. Gate check (read from the files, not from the request)

`project-planning/integration-review.md`, every row:

| Status | Rows |
|---|---|
| CONFIRMED CLOSED | INT-001, INT-002, INT-003, INT-004, INT-005, INT-006, INT-010, INT-012, INT-024, INT-025, INT-026, INT-027 |
| DEFERRED | INT-009, INT-011, INT-013, INT-014, INT-015, INT-016, INT-017, INT-018, INT-019, INT-020, INT-021, INT-023 |
| NO ISSUES | INT-007, INT-008 |
| REJECTED | INT-022 |

- No row is PROPOSED, APPROVED, IN PROGRESS, FIXED – AWAITING QA, QA VERIFIED or HUMAN VERIFIED. The row gate passes.
- Phase 1 is not the final phase (Phase 2 and Phase 3 remain in the Phase Plan), so DEFERRED rows do not block, and step 1b (resolve every DEFERRED row) does not apply now. They must be resolved at the final checkpoint.
- `status.md` Tech Lead Reviews has Integration & Optimization Review entries for Phase 1 (2026-10-19, plus the 2026-10-20 re-review and fix-verification entries). Tech Lead's latest Last Action (confirm-fix, 2026-10-21) names `claude --agent pm "checkpoint"` as the next step.
- **One gap, see Question 1:** neither file has a recorded final Phase 1 sign-off. The latest sign-off entries in both files read "SIGN-OFF WITHHELD", and the integration-review "Path to sign-off" step 5 says Tech Lead will "record the final Phase 1 sign-off" once every row is resolved. That entry has not been written.

## 2. Phase 1 results (from `modules/*/status.md`)

Phase 1 modules per the Phase Plan: MOD-001 to MOD-010 and MOD-012 (11 modules). MOD-011 moved to Phase 2 in PRD Rev 45.

| Module | Latest QA result |
|---|---|
| MOD-001 mod-auth-profile | PASS. QA Run 6 (INT-024 verify, 2026-10-21); AC-001/063/116/117/118/119/145 regressions pass |
| MOD-002 mod-gym-directory | PASS. 46/46 tests; AC-004 through AC-198 show no regressions |
| MOD-003 mod-route-catalog | PASS. INT-026 verify, 115/115 tests |
| MOD-004 mod-send-logging | PASS. QA Run 8, 366/366 tests; human confirmed AC-131/AC-132 |
| MOD-005 mod-beta-video | PASS. INT-010 verify, 137 tests (with mod-moderation) |
| MOD-006 mod-social-feed | PASS. QA Run 6 (INT-012 verify), 63/63 tests |
| MOD-007 mod-notifications | PASS. All ACs including AC-171/172/173 |
| MOD-008 mod-profile-history | PASS. i18n regression, 27/27 tests |
| MOD-009 mod-moderation | PASS. QA Run 4, all 11 ACs |
| MOD-010 mod-localization-theme | PASS. QA Run 4 (Rev 43 regression) |
| MOD-012 mod-home | PASS. QA Runs 16–17 (INT-025, INT-027 verify), 90/90 tests |
| MOD-011 mod-analytics | Not started. Moved to Phase 2 (Rev 45); spec and agents exist |

Open escalations: none. No module status file has an open `ESCALATED TO TECH LEAD` marker.

How the integration items were resolved:
- **Closed after QA and the human's check (12):** INT-001/002/003 import-boundary fixes; INT-004 signed-URL cache (already built); INT-005 avatar storage policy; INT-006 seeder API key moved to a header; INT-010 block filter on beta videos; INT-012 module barrels; INT-024 avatar cache-buster; INT-025/026/027 test fixes.
- **Deferred (12):** INT-009, 011, 013, 014, 015, 016, 017, 018, 019, 020, 021, 023. For most of these, your recorded reason says the fix has already landed, but no QA or human check was done on them in the tracker. For INT-017, the `useReelGestures` extraction is still real Phase 2 work. For INT-009 and INT-011 you wrote "no Phase 2 action needed".
- **No issue / rejected (3):** INT-007 and INT-008 (both functions sit behind the gateway JWT check), and INT-022 (deliberate Rev 36 deferral).

Still open, outside the tracker (Tech Lead flagged these; only you can do them):
- Confirm `Verify JWT = on` for `notify-beta-video-like` and `report-digest` in the Supabase dashboard. This is the evidence for INT-007/INT-008, and `config.toml` is not in the repo.
- Rotate the Google Places key if the old seeder ever ran through a logged proxy (INT-006). Your INT-006 verification reads "key rotated (or not needed)".
- One test, `mod-send-logging/AscentList.test.tsx`, sometimes fails in the full suite but passes 12/12 when run alone. It has no row yet; Tech Lead said to watch it.

## 3. Exact change on approval (apply pass)

**status.md → `## Checkpoint History`** (currently empty), append:

```
Phase 1 approved — 2026-10-21 — commit: <HEAD hash at apply time>
```

If you decline the Retrospective (Question 3), add this indented line under it:

```
  retrospective: skipped
```

**status.md → `## Current Phase`**, replace `Phase 1: iOS MVP — Taipei/New Taipei launch` with:

```
Phase 2: Community depth + Android
```

**status.md → `## Last Action`**:

```
agent: pm
mode: checkpoint
module: n/a
result: success
next: <see Question 3: either claude --agent retrospective "phase 1", then claude --agent engineer-mod-analytics "implement"; or claude --agent engineer-mod-analytics "implement">
timestamp: <ISO 8601 at apply>
```

**Commit and tag:**

```
git add project-planning/status.md project-planning/pm-proposals/
git commit -m "pm(checkpoint): phase 1 approved"
git tag checkpoint-1
```

No `README.md` (this is not the final phase). No `prd.md` change. The PRD stays at Revision 46 with 0 `[DECISION NEEDED]` markers.

## 4. Questions

1. **Final sign-off.** The row gate passes, but Tech Lead has not written a final "Phase 1 signed off" entry. The latest sign-off entries in `integration-review.md` and Tech Lead Reviews still say "WITHHELD". Do you want to (a) approve the checkpoint now on the row statuses plus Tech Lead's confirm-fix handoff, or (b) first run `claude --agent tech-lead "record final Phase 1 sign-off"` so the record shows it, and then approve the checkpoint?
2. **Approve Phase 1?** Do you approve Phase 1 as summarized above and the exact changes in section 3 (Checkpoint History line, Current Phase set to Phase 2, tag `checkpoint-1`)? Please reply in your own words.
3. **Retrospective.** Run a short Retrospective on phase 1 now? It reads only this phase and writes proposals; nothing changes until you apply one. Yes adds `claude --agent retrospective "phase 1"` to `next:` before the first Phase 2 Engineer. No records `retrospective: skipped`. (There is already an uncommitted draft at `project-planning/retrospective/drafts/ux-duplicate-route-research.md`. It is not mine and I will not touch it.)
4. **Phase 2 scope.** Phase 2 currently has one defined module, MOD-011 (Analytics). Every other Phase 2 item in the Phase Plan says "new modules TBD in a later PRD revision". After the checkpoint, the only module that can start is `engineer-mod-analytics`. Do you want to start MOD-011 straight away, or first run a PM change to define the other Phase 2 modules (Android build, offline send queue, and so on)?
5. **Verify skill.** `.claude/skills/verify/` does not exist, and Decisions has no "verify skill: declined" entry. The coordinator's step table offers `/pstack:create-verification-skill` in the first phase where the app runs, and only if you say yes. Do you want it created before Phase 2 starts? If not, I will add `verify skill: declined` to Decisions during the apply pass.
6. **Stale duplicate Last Action block.** `status.md` has a second `## Last Action` block at the very end of the file (agent: qa-mod-home, INT-027, next: qa-mod-route-catalog), after Skill Recommendations. It is out of date, and the handoff hook could read it by mistake. May I delete that duplicate block during the apply pass? The current block at the top is left as is apart from the update above.
