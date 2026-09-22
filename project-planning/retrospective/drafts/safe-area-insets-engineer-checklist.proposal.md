# Proposal: Add Safe Area Insets as a Required Engineer Judgment Item

## Evidence

**Primary incident — Tech Lead Review, 2026-09-21 (project-planning/status.md, ## Tech Lead Reviews):**

> "Safe area insets are unhandled app-wide: `App.tsx` has no `SafeAreaProvider` and no screen uses `useSafeAreaInsets()`. Every screen hardcodes `paddingTop: theme.spacing.xl` (32px), which is less than the Dynamic Island clearance (~59px) on iPhone 17 Pro (and any notch/Dynamic Island device), hiding top-bar content. This affects all built screens (MOD-001/002/003/004) and every screen not yet built."

**Scope of impact:** All four shipped modules (MOD-001, MOD-002, MOD-003, MOD-004) produced screens with this defect. The fix was applied reactively after human QA on the iPhone 17 Pro simulator revealed that the top navigation bar was hidden under the Dynamic Island and could not be tapped.

**Root cause (confirmed in context):** `production.md` had no safe area convention at the time MOD-001 through MOD-004 engineers wrote their screens. The engineer self-check (engineer-checklist SKILL.md) includes the judgment item "Code follows conventions in coding-conventions skill and production.md Shared Conventions" — but because no safe area convention existed in `production.md`, engineers had nothing to check against. The gap was systemic, not individual agent error.

**Remediation applied:** Tech Lead added "Screen Layout & Safe Area Insets" to `production.md` (see production.md lines 137–158) specifying: `SafeAreaProvider` at app root, `useSafeAreaInsets()` per screen, `makeStyles(theme, topInset)` signature, and `paddingTop: topInset + theme.spacing.md` derivation. Four engineer agents are assigned bugfix passes. QA agents will run regression tests.

**Pattern class:** A fundamental iOS layout primitive (safe area insets) was absent from the engineer checklist for a React Native iOS project. Any screen-writing engineer operating in good faith would miss it if it is not explicitly required.

## Proposed Change

Add a new judgment item to the `<judgment_items>` section of `~/.claude/skills/engineer-checklist/SKILL.md`:

```
- If the module writes any screen component (a component used as a navigation route or presented modally): verify that (a) `App.tsx` wraps the root in `SafeAreaProvider` from `react-native-safe-area-context`, (b) the screen calls `useSafeAreaInsets()` and passes `insets.top` into `makeStyles` as `topInset`, and (c) the screen root (and any `ScrollView contentContainerStyle`) uses `paddingTop: topInset + theme.spacing.md` — never a fixed spacing token alone. A fixed `paddingTop` token (e.g. `theme.spacing.xl`) is insufficient on Dynamic Island and notch devices. Follow the full convention in production.md "Screen Layout & Safe Area Insets".
```

This item should be placed after the existing "No hardcoded values" item, grouped with the iOS-specific layout concerns.

## Target File

`~/.claude/skills/engineer-checklist/SKILL.md` — `<judgment_items>` section.

## Impact

- **Engineer agents (all module engineers from MOD-005 onward):** will have an explicit, named checklist item for safe area insets before any screen-writing module is handed off to QA. This prevents recurrence on the 7 unstarted modules (MOD-005 through MOD-011).
- **QA agents:** benefit indirectly — a failing safe area check will now appear in the engineer's self-check log, giving QA a clear signal to verify the insets pattern in the human test script.
- **Tech Lead:** reduces the need for a reactive architectural review after human QA catches layout defects.

## Risk

- The item is conditionally scoped ("If the module writes any screen component") so it does not burden backend-only or utility module engineers unnecessarily.
- The reference to `production.md "Screen Layout & Safe Area Insets"` keeps the checklist item thin and defers the authoritative detail to `production.md`, avoiding duplication. If the convention in `production.md` changes, the checklist item does not need updating.
- No existing passing checks are invalidated by adding this item.
