# Proposal: Add Safe Area Insets as a Common QA Failure Pattern

## Evidence

**Primary incident — Tech Lead Review, 2026-09-21 (project-planning/status.md, ## Tech Lead Reviews):**

> "Safe area insets are unhandled app-wide: `App.tsx` has no `SafeAreaProvider` and no screen uses `useSafeAreaInsets()`. Every screen hardcodes `paddingTop: theme.spacing.xl` (32px), which is less than the Dynamic Island clearance (~59px) on iPhone 17 Pro."

The defect was not caught by any of the four QA agent runs (MOD-001, MOD-002, MOD-003, MOD-004). QA agents verified conventions listed in `production.md` but had no heuristic to flag the absence of safe area handling because (a) the convention did not yet exist in `production.md`, and (b) `common-failure-patterns.md` had no entry for iOS layout primitives. The defect was discovered during human QA on the iPhone 17 Pro simulator — after four full QA passes.

**Scope:** The pattern applies to every React Native iOS screen. It is not module-specific. It is a class of defect that QA agents will encounter on every future screen-writing module (MOD-005 through MOD-011 all contain UI screens).

## Proposed Change

Add a new entry to `~/.claude/skills/qa-checklist/references/common-failure-patterns.md` as pattern 10 (or next available number):

---

```markdown
## 10. React Native iOS: Missing Safe Area Insets

On iPhone models with a Dynamic Island or notch, fixed `paddingTop` values (even large spacing tokens like `xl`/32px) do not clear the safe area. The Dynamic Island clearance is approximately 59px. Content placed at a fixed top padding appears visually correct on older devices or the simulator's default viewport but is hidden under the Dynamic Island on real hardware and on iPhone 17 Pro / newer simulators.

**What to look for:**
- Any screen component whose root view or `ScrollView contentContainerStyle` uses `paddingTop: theme.spacing.<anything>` without also adding `insets.top`
- `App.tsx` that lacks `SafeAreaProvider` from `react-native-safe-area-context` wrapping the app root (if `SafeAreaProvider` is absent, `useSafeAreaInsets()` always returns `{ top: 0 }`, masking the bug in unit tests)
- `makeStyles` functions that accept only `theme` as a parameter (correct signature is `makeStyles(theme, topInset: number)`)
- Screens that import `useSafeAreaInsets` but do not pass `insets.top` into `makeStyles`
- Modal sheets using this pattern are safe: iOS positions `pageSheet` modals below the Dynamic Island, so `insets.top === 0` inside them — but the pattern should still be applied uniformly

**Test approach:** In the human test script, open every screen on an iPhone 17 Pro (or equivalent Dynamic Island) simulator in the list view and confirm the top navigation bar / header is fully visible and tappable. A header that is partially obscured or not tappable is a safe area failure. Automated unit tests and `tsc --noEmit` will not catch this — it requires visual inspection on the correct simulator target.

**Convention reference:** `production.md` "Screen Layout & Safe Area Insets" — the full required pattern (`SafeAreaProvider`, `useSafeAreaInsets()`, `makeStyles(theme, topInset)`, `paddingTop: topInset + theme.spacing.md`).
```

---

## Target File

`~/.claude/skills/qa-checklist/references/common-failure-patterns.md` — append as the next numbered pattern after the current highest entry (currently pattern 9 in the file).

## Impact

- **QA agents (all screen-writing modules from MOD-005 onward):** have an explicit named failure pattern to check when verifying any module that ships UI screens. The pattern tells them what to look for in code inspection AND provides a concrete human test step to add to the test script.
- **Human reviewer:** the pattern ensures the QA-produced human test script always includes a Dynamic Island visual check, so the class of defect caught only during human QA on MOD-001 through MOD-004 is caught earlier in future modules.
- **Engineer agents:** benefit indirectly — if this pattern is in `common-failure-patterns.md`, the QA skill instructs QA agents to read it before any verification run (see `<routing>` in qa-checklist SKILL.md: "Checking known failure gotchas → Read references/common-failure-patterns.md").

## Risk

- The entry correctly notes that unit tests and `tsc` will not catch this, which is accurate — it avoids misleading QA agents into thinking a green test suite is sufficient evidence of compliance.
- The modal sheet exception (insets.top === 0 inside pageSheet modals) is documented to prevent false positives where a QA agent flags a modal that is correctly not using insets.
- No existing patterns in `common-failure-patterns.md` cover iOS-specific layout — this is a new category. It does not duplicate any existing entry.
