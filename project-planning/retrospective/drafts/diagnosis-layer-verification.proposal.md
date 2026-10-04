# Proposal: Diagnosis Layer Verification — Confirm Which Layer Owns a Bug Before Fixing It

## Evidence

**Source: `status.md` — Tech Lead Review 2026-10-03 (FAILURE 2 — wrong-layer HDR fix)**

> "**The actual cause is the player (hypothesis #3).** `BetaVideoReelViewer.tsx` renders `expo-video`'s `VideoView` … with **no dynamic-range / EDR configuration**. Under the hood AVPlayer renders HLG content correctly only when the view is on an EDR-capable rendering path; without that, HLG's upper range is mapped as if it were SDR and the midtones blow out — exactly 'overexposed.'"

> "**Conclusion for Failure 2**: overexposure is a **playback-layer rendering problem**. The Rev 26 picker change addressed a layer that was never the cause, which is why the device still fails. Do not patch the picker further."

**Source: `status.md` — PM Updates 2026-10-03 (AC-031 Rev 26 and subsequent Rev 29 revert)**

The HDR overexposure bug produced three PM change cycles: Rev 26 changed the picker representation mode (wrong layer); Rev 27 reconciled prose that had drifted from Rev 26; Rev 28 changed AC-166 as an unrelated AC; Rev 29 reverted the picker back to native mode and accepted HDR overexposure as a known Phase 1 limitation. The total pipeline cost was four PM changes, two Doc-Sync delta syncs, two Engineer changes, and repeated human QA runs — all because the initial bug hypothesis was encoded into an AC without layer verification.

**Source: `status.md` — Skill Recommendations (2026-10-03/04 entries)**

> "(2) a device-only behavior (iOS picker output / `expo-video` HDR rendering) was asserted as settled in an AC without a device test, while Jest mocked the picker and cannot render video playback at all."

> "verify third-party/OS runtime assumptions on-device before writing them into an AC"

**Source: `status.md` — Tech Lead Review 2026-10-03 (Holistic Proposal item 4)**

> "**Device-behavior assumptions must be verified, not assumed, before they become an AC.** Rev 26 encoded an unverified belief ('`Automatic` mode transcodes to SDR') directly into an acceptance criterion, and the brief itself notes there was never a post-change device test."

## Proposed Change

### Part 1 — New pattern in `~/.claude/skills/qa-checklist/references/common-failure-patterns.md`

Append as pattern 10:

```markdown
## 10. Wrong-layer diagnosis — fixing one layer when the bug lives in another

A bug is correctly observed and reported, but the root-cause layer is misidentified. The fix targets a different layer (e.g. picker configuration) than the one that actually causes the problem (e.g. video player rendering). Every subsequent Engineer cycle is wasted because the correct layer is never touched.

**What to look for:**
- A QA failure that has multiple plausible layers in its call path (e.g. picker → upload → storage → player) — without explicit confirmation that the alleged root-cause layer was observed producing bad output, the diagnosis is a hypothesis, not a finding.
- A fix is applied to one layer, human QA fails again with the same symptom, and a second fix is attempted at another layer. Repeat-failure on the same symptom after a targeted fix is a strong signal the wrong layer was fixed first.
- An AC that encodes a runtime behavior claim about a third-party library or OS subsystem (e.g. "iOS `Automatic` mode transcodes to SDR") without a captured device result confirming that claim before the AC was written.
- The test suite covers only the layer that was changed, not the end-to-end path through the actual runtime (e.g. tests mock the picker and cannot render video playback at all — so the player layer is invisible to CI).

**Verification approach for QA — before routing a failure to Engineer:**
1. Identify all layers in the call path for the failing behavior (e.g. for a video rendering artifact: device camera → picker → upload → storage → player config → display).
2. For each layer, ask: "Can this layer be the cause? Is there observable evidence at this layer?" Evidence means a real device or server output, not a test assertion over a mocked API.
3. State the layer your FAIL entry targets explicitly: "FAIL AC-031: symptom observed at the player layer (VideoView renders HLG as blown out); picker layer not implicated (original file confirmed in storage with BT.2020 metadata)."
4. If you cannot identify which layer owns the bug because the call path involves un-mockable OS or third-party behavior, flag this as a diagnosis blocker and escalate to Tech Lead before routing to Engineer.

**For Tech Lead — when reviewing a bug fix proposal:**
- Require evidence that the proposed fix layer was observed producing the bad output. "We think the picker is the problem" is a hypothesis. "The file returned by the picker was inspected with `mdls`/`ffprobe` and confirmed as BT.2020 HLG" is evidence.
- If the proposed fix is at a layer where the test harness has no visibility (video rendering, native picker output, system-level file I/O), the diagnosis requires device verification, not code inspection.

**Test approach:** For any AC that encodes a claim about third-party or OS runtime behavior (picker output format, player rendering mode, file I/O behavior), require a documented device-verification result as part of the AC's acceptance before the AC is considered settled. A green Jest run is not evidence of OS-layer behavior.
```

### Part 2 — New judgment item in `~/.claude/skills/engineer-checklist/SKILL.md`

Add to `<judgment_items>`, in the section addressing device/native behaviors:

```
- **Before implementing a fix for a runtime bug, state the layer where the bad output was observed.** If the bug is a rendering artifact, storage error, or platform behavior failure, write down: "The symptom occurs at [layer]. I observed [specific evidence] at that layer. The fix I am implementing changes [that same layer]." If you cannot state this — because the diagnosis is inherited from a QA report that does not trace the observation to a specific layer, or because the layer is only observable on a physical device — write a blocker and ask the coordinator to route to Tech Lead for a layer-verification review before you implement.
```

## Target Files

1. `~/.claude/skills/qa-checklist/references/common-failure-patterns.md` — append pattern 10
2. `~/.claude/skills/engineer-checklist/SKILL.md` — add one judgment item

## Impact

- **Tech Lead** gets a shared vocabulary for requesting layer evidence before a fix is routed to Engineer. Prevents re-review cycles caused by wrong-layer fixes.
- **QA agents** gain a pre-routing checklist: name the layer before sending a failure to Engineer. This alone would have prevented routing the HDR fix to the picker layer.
- **Engineer agents** get a pre-implementation gate: write down which layer you observed the bad output at. If the answer is "I don't know / I cannot observe it," that is a blocker — not a green light to guess.
- **PM** benefits transitively: wrong-layer fixes currently flow through the full PM → Doc-Sync → Engineer → QA cycle before failing. Catching the wrong layer at Tech Lead or Engineer saves multiple pipeline passes and PRD revision cycles.
- **Cross-project:** This pattern recurs any time a call path crosses a layer boundary (network stack, OS API, third-party SDK, native rendering). The principle is framework- and language-agnostic.

## Risk

- Requiring explicit layer attribution in QA failure reports adds a small amount of work per failure entry. The addition is worth it for bugs that cross OS or third-party layer boundaries, but may be over-specified for straightforward logic bugs (e.g. a null check missing in a pure function). The proposal's language targets the class of bug where layers are plausible; simple logic bugs are not affected.
- The Engineer judgment item asks the agent to "write a blocker" if they cannot trace the observation to a specific layer. Some engineers may over-apply this and block on bugs that are straightforwardly diagnosable. The item should be phrased to limit this — "if the layer is only observable on a physical device" is the qualifier, not "if you are uncertain."
- Part 1 does not conflict with or duplicate patterns 1–9 in `common-failure-patterns.md`. Pattern 4 (hardcoded values) and pattern 6 (synchronous throws in Express) are distinct failure classes. The existing mock-fidelity-gap proposal (prior retrospective) covers option-gated API mocks — this proposal covers wrong-layer diagnosis, which is a different class.
