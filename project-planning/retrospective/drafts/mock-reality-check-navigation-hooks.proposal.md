# Proposal: Mock Reality Check for Navigation and Framework Hooks — Tests Must Reflect Production Mounting Context

## Evidence

**Source: `status.md` — Tech Lead Review 2026-10-04 (ProfileScreen device crash)**

> "Root cause (supplied and confirmed): `ProfileScreen` called `useFocusEffect` from `@react-navigation/native`, which requires a `NavigationContainer` in the tree. But `ProfileScreen` is rendered via `AppShell`'s keep-alive mount strategy (`display:none` / `display:flex` to preserve tab state across switches), which has **no `NavigationContainer` ancestor**. The hook threw at runtime on device. It was invisible in CI because `ProfileScreen.test.tsx` mocked `@react-navigation/native` so `useFocusEffect` degraded to a plain `useEffect` — the test environment did not match the production mount context."

**Source: `status.md` — PM Updates 2026-10-04 (TRIVIAL — keep-alive screen conventions)**

> "The crash was invisible in CI because the test mocked `@react-navigation/native`. … Tests must not mock away a test-vs-production mount incompatibility. Tests for keep-alive screens must **not** mock `useFocusEffect` or `@react-navigation/native` — those screens render in production without a `NavigationContainer`, and the test must reflect that reality so any future navigation-context hook crashes CI immediately."

**Source: `status.md` — Tech Lead Review 2026-10-04 (Recommendations R2, R3)**

> "R2 — Add a top-of-file comment to each keep-alive screen stating it has no `NavigationContainer` ancestor and must not use `@react-navigation/native` navigation-context hooks."
> "R3 — Tests for keep-alive screens exercise focus behavior by flipping the `isActive` prop (false → true), never by mocking navigation or simulating navigation events."

**Source: `status.md` — Skill Recommendations (2026-10-03/04 entries)**

> "This 'green-but-broken' failure mode recurs whenever … (b) an AC depends on native/OS/player runtime behavior the harness mocks away."

> "A skill codifying 'integration-test the production wiring, not the leaf component' + 'device-verification gate for un-mockable ACs' + 'verify third-party/OS runtime assumptions on-device before writing them into an AC' would prevent repeat occurrences."

The `useFocusEffect` crash passed every QA step — automated tests and the QA agent's written test script — and was caught only during human QA on a physical device. The mock made the hook behave identically to `useEffect`, which masked an incompatibility that only exists in the production mount context (no `NavigationContainer` ancestor in `AppShell`'s keep-alive tree).

## Proposed Change

### Part 1 — New pattern in `~/.claude/skills/qa-checklist/references/common-failure-patterns.md`

Append as the next numbered pattern (currently pattern 10 is proposed by the diagnosis-layer-verification proposal; this becomes pattern 11 if both are applied, or 10 if only this one is applied — number to be assigned at apply time):

```markdown
## 11. Mock hides test-vs-production mount incompatibility — framework hook crash invisible in CI

A test mocks a framework hook (navigation, focus, lifecycle, context) in a way that makes the hook work in the test environment. In production, the component is mounted in a context where the hook cannot work (e.g. no `NavigationContainer` ancestor, no `Provider`, wrong render tree). The crash is invisible in CI; it surfaces only on a device or in an environment that reflects the real mount context.

**Canonical example from this project:** `ProfileScreen` called `useFocusEffect` (requires `NavigationContainer`). `ProfileScreen.test.tsx` mocked `@react-navigation/native` so `useFocusEffect` behaved like `useEffect`. In production, `AppShell` mounts `ProfileScreen` with no `NavigationContainer` in the tree — the hook threw at runtime. 88 tests passed; the crash was caught only by human QA on device.

**What to look for:**
- Tests that mock an entire framework module (e.g. `jest.mock('@react-navigation/native')`, `jest.mock('react-redux')`, `jest.mock('@react-query')`) — ask: "Does this mock make a hook or context pass that would fail if the component were mounted without its required provider/ancestor?"
- Any component that uses a hook requiring a Provider or ancestor (navigation context, Redux store, React Query client, i18n context, theme context) — ask: "Is this component ever rendered in production *without* that Provider in the tree?" If yes, the test must not mock the hook — it must reflect the real mount context.
- Keep-alive pattern screens (rendered via `display:none`/`display:flex` in a shell): these screens do not have a `NavigationContainer` ancestor. Any test that mocks `@react-navigation/native` for such a screen is hiding a real incompatibility.
- A test whose `beforeAll` or mock setup makes a hook "just work" without the surrounding infrastructure — check whether that infrastructure exists at runtime.

**Verification approach for QA:**
1. For every component that is tested with a mocked framework module: identify the component's production mount context (which parent mounts it, in which navigator or shell).
2. Ask: "If the mock were removed, would this test pass?" If the answer is no, ask: "Does the production mount context provide what the hook needs?" If both answers are no, the mock is hiding a real bug — flag it as `FAIL` and route to Engineer to fix the incompatibility, not add a better mock.
3. For keep-alive screens specifically: verify that the test exercises focus behavior via the `isActive` prop (false → true), not by mocking `useFocusEffect` or simulating navigation events.
4. Explicitly include in the human test script: "Navigate away from this tab and return to it — confirm no crash occurs on device."

**Standard fix pattern:**
- Remove the mock that hides the incompatibility.
- Fix the incompatibility in the component (e.g. replace `useFocusEffect` with `isActive` prop + `useEffect([isActive])`).
- The test now reflects production reality — if a future change reintroduces the incompatibility, CI catches it immediately.
```

### Part 2 — New judgment item in `~/.claude/skills/engineer-checklist/SKILL.md`

Add to `<judgment_items>`, after the existing mock-fidelity item (if the mock-fidelity-gap proposal has been applied) or as a new item:

```
- **If any test mocks a framework hook or Provider (navigation, focus, Redux, React Query, i18n, theme): confirm the mock reflects the production mount context, not a more permissive environment.** Specifically: if the component is rendered in production without a required ancestor (e.g. a keep-alive screen without `NavigationContainer`), the test must not mock that ancestor's hook — it must use the alternative pattern that works without the ancestor. A mock that makes a hook pass in test when it would crash in production is hiding a real bug, not verifying a feature. Record in your self-check: "No mock papers over a mount incompatibility — each mocked dependency matches the production rendering context."
```

### Part 3 — Append to the existing keep-alive convention in `production.md` (for Doc-Sync to carry forward; already partially covered by the 2026-10-04 TRIVIAL PM update, but the test-specific clause should appear explicitly in Shared Conventions as a standing rule)

This is not a new change to propose directly — the 2026-10-04 PM Updates entry already directed Doc-Sync to write the two conventions into `production.md`. Parts 1 and 2 above extend the pattern into the skill files so it applies on future projects, not just this one.

## Target Files

1. `~/.claude/skills/qa-checklist/references/common-failure-patterns.md` — append new pattern
2. `~/.claude/skills/engineer-checklist/SKILL.md` — add one judgment item

## Impact

- **QA agents** gain a concrete audit step: for every mocked framework module, ask whether the mock reflects the production mount context. This single question would have caught the `useFocusEffect` crash in the automated QA pass before human QA.
- **Engineer agents** gain a pre-handoff gate: no mock should paper over a mount incompatibility. This is the complement to the existing mock-fidelity judgment item (which targets option-gated API return fields); this item targets framework hook / Provider incompatibilities.
- **Tech Lead** benefits transitively: the class of bug is encoded in skills that every future project imports, so future Tech Lead reviews do not need to re-derive this rule.
- **Cross-project:** The pattern applies to any component framework that has Provider/context ancestry requirements (React, Angular, Vue with Pinia/Vuex, etc.). The specific hook names differ, but the diagnosis question ("does this mock make a hook pass that would fail in production?") is universal.

## Risk

- The QA check (Part 1) adds a mock-audit step to every module verification. This is a small cost; limit it to components that mock framework modules, not all tests.
- The Engineer check (Part 2) overlaps slightly with the existing mock-fidelity-gap proposal (which covers option-gated API return fields). The two items are complementary and target different failure classes (option-gated fields vs. mounting context incompatibilities), so both should coexist. If only one proposal is applied, Part 2 here still stands on its own.
- The proposal does not address the case where a component is correctly tested with a mock and the production context legitimately provides the Provider. The qualifier "confirm the mock reflects the production mount context" is the limiting phrase — it only flags mocks that misrepresent the context, not mocks that accurately represent it.
