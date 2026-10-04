# Proposal: Production Wiring Verification — Engineer Must Confirm Which Component Is Actually Mounted Before Implementing

## Evidence

**Source: `status.md` — Skill Recommendations (2026-10-03/04 entries)**

> "AC-166/AC-169 tests rendered `BetaVideoUploader` in isolation, but the app only ever mounts `BetaVideoSection` with `onRegisterUploadLauncher` set, which runs a duplicate upload path that never had the dialog — the tested component was dead code on the live path."

**Source: `status.md` — Tech Lead Review 2026-10-03 (FAILURE 1 — duplicate upload path)**

> "`BetaVideoSection` renders `BetaVideoUploader` **only** in 'legacy mode' — when `onRegisterUploadLauncher` is NOT provided. But `RouteDetailScreen.tsx` **always** passes `onRegisterUploadLauncher={handleRegisterUploadLauncher}`. In the shipped app, `BetaVideoUploader` is dead code and every line of AC-166 never executes."

> "A test that renders a component the app never reaches provides false assurance. This single rule would have caught Failure 1."

**Source: `project-planning/modules/mod-beta-video/status.md` — Bug Fix 2026-10-03**

> "AC-166 was correctly implemented in `BetaVideoUploader.tsx` — the `Promise<boolean>` + `Alert.alert` pattern there is sound and the tests that exercise it genuinely pass. **The problem is that `BetaVideoUploader` is not the component that runs on the route detail screen.**"

The AC-166 dialog and AC-169 45 MB gate were implemented and tested against a component (`BetaVideoUploader`) that was never mounted in the production call path. Multiple PM → Doc-Sync → Engineer → QA cycles were burned. The bug was caught only by human QA on a device. The pipeline was entirely green (88 passing tests) throughout.

## Proposed Change

Add a new mandatory judgment item to `~/.claude/skills/engineer-checklist/SKILL.md` in the `<judgment_items>` section, immediately after the "If the spec's 'Integration Points' section names a cross-module wiring task" item:

```
- **Before implementing any AC that goes through a UI component: verify which component is actually mounted in the production navigation tree for this AC's entry point.** Ask: "Which parent mounts this component? What props does that parent pass? Does any conditional branching in the parent (e.g. an `onRegisterXxx` prop, a render mode flag, a feature flag) cause a *different* code path to run instead?" If a feature has more than one component that could handle the same action (e.g. a registered launcher and a standalone button), there must be exactly one implementation — identify the live path, implement there, and verify the other path is either removed or delegates to the same code. Implement your AC in the component on the live path, not in a component that is conditionally unmounted or bypassed. Confirming the live path in code (not by assumption or by reading only the component you plan to change) is mandatory before writing any new logic.
```

Add a corresponding judgment item to the same file for tests:

```
- **Integration tests must mount the production configuration, not an isolated leaf component.** If the feature under test is only ever reached by the app through a specific parent component in a specific prop configuration (e.g. `BetaVideoSection` always receives `onRegisterUploadLauncher` from `RouteDetailScreen`), the test must render that parent in that configuration and exercise the feature through that path. A test that renders a leaf component in isolation — when the app never mounts that component directly in production — is not evidence the feature works on the live path. Record in your self-check: "Integration tests exercise the production entry point, not a bypassed component."
```

## Target File

`~/.claude/skills/engineer-checklist/SKILL.md` — `<judgment_items>` section

## Impact

- **Engineer agents** gain an explicit pre-implementation gate: they must trace the production mounting path before writing logic. This stops implementations landing in dead-code components.
- **QA agents** benefit transitively: Engineer self-checks flag if tests are isolated against non-live components, reducing false-green test results before QA sees them.
- **Cross-project:** The pattern is framework-agnostic. Any system with conditional rendering modes (feature flags, prop-based render branching, launcher registration patterns) produces this failure class. The check applies to React Native, React, Angular, Vue, or any component tree.

## Risk

- The item requires Engineer to read parent component code outside the assigned module (e.g. `RouteDetailScreen` to understand how it mounts `BetaVideoSection`). This is read-only cross-boundary inspection, not a write-scope violation — but it must be stated clearly so Engineer does not over-extend into editing those files.
- If the production mounting path is ambiguous or spans multiple modules, Engineer may need to write a blocker. That is the correct outcome; this checklist item should not push Engineer to guess.
- No existing judgment item is superseded or contradicted by this addition. The existing "Integration Points" item covers cross-module *wiring tasks*; this item covers pre-implementation *path tracing* for any AC with a UI entry point.
