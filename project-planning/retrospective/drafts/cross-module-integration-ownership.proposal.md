# Proposal: Cross-Module Integration Ownership — Navigator Wiring Must Be Explicitly Assigned in Specs

## Evidence

**Incident — MOD-003 QA human preparation (2026-09-21):**

`RouteNavigator` (MOD-003, `src/modules/mod-route-catalog/RouteNavigator.tsx`) was built to be embedded inside `GymDetailScreen` (MOD-002). The component's own file comment documents the intended contract:

> "This navigator is rendered from within the gym detail context (e.g. a tab or section within GymDetailScreen in MOD-002). It receives gymId + gymName from the parent and the user session from the app shell."

`RouteNavigator` exposes a typed props interface (`gymId: string`, `gymName: string`, `session: Session`, `onBackToGym: () => void`) that is designed to be called by `GymDetailScreen` — yet `GymDetailScreen` (MOD-002) makes no reference to `RouteNavigator` anywhere in its source. The wiring was never implemented.

**MOD-003 spec (`project-planning/modules/mod-route-catalog/spec.md`) line 6:**

> `Dependencies: MOD-001, MOD-002`

The spec names the dependency relationship but contains no section, task, or acceptance criterion describing which file in MOD-002 must be modified, what component or prop to add, or which module's engineer is responsible for implementing the connection.

**Root cause:**

Neither the MOD-002 engineer nor the MOD-003 engineer implemented the wiring. Both were acting correctly within their assigned module boundaries. The MOD-002 engineer had no spec instruction to add a `RouteNavigator` entry point to `GymDetailScreen`. The MOD-003 engineer's spec described `RouteNavigator` as a component intended for embedding in MOD-002 but listed no concrete integration deliverable and named no owner for that work. The gap was discovered during human QA preparation for MOD-003 — after both modules had passed their respective QA runs.

**Pattern class:** A cross-module integration task (downstream module's navigator rendered inside upstream module's screen) had no spec owner and no engineer checklist gate. The dependency declaration (`Dependencies: MOD-002`) is not sufficient to trigger implementation: it describes coupling at the data-model level but not the concrete UI wiring.

## Proposed Change

### Part 1 — Module spec template addition

When a module spec lists a dependency on another module **and** involves a navigator or entry-point component designed to be rendered from within the other module's screen, the spec must include an explicit **"Integration with [MOD-X]"** section. The section must name:

1. **The file in the dependency module that must be modified** (e.g., `src/modules/mod-gym-directory/screens/GymDetailScreen.tsx`)
2. **The component or prop to add** (e.g., render `<RouteNavigator gymId={gym.id} gymName={gym.name} session={session} onBackToGym={onBack} />`)
3. **Which module's engineer owns the change** — the recommended default is: the downstream module (the one being navigated *to*) owns the wiring *request*; the upstream module's engineer (the one whose screen must be modified) *implements* it. The wiring request should be communicated as a concrete, named task in the downstream module's spec.

**Example — what the MOD-003 spec should have included:**

```
## Integration with MOD-002 (Gym Directory)

RouteNavigator is designed to be embedded inside GymDetailScreen (MOD-002).
This integration is a required deliverable of MOD-003 and must be completed
before MOD-003 is considered done.

**File to modify:** `src/modules/mod-gym-directory/screens/GymDetailScreen.tsx`

**Change required:** Add a "View Routes" section or tab that renders:
  <RouteNavigator
    gymId={gym.id}
    gymName={gym.name}
    session={session}
    onBackToGym={onBack}
  />

**Owner:** engineer-mod-gym-directory implements the change; engineer-mod-route-catalog
is responsible for raising this as a wiring request and confirming it is implemented.

**Acceptance criterion:** GymDetailScreen renders RouteNavigator for an authenticated
session and passes gymId, gymName, session, and onBackToGym correctly.
```

### Part 2 — Engineer checklist addition

Add a new judgment item to the `<judgment_items>` section of `~/.claude/skills/engineer-checklist/SKILL.md`:

```
- If the module's spec includes an "Integration with [MOD-X]" section: verify that
  the cross-module wiring named in that section has been implemented (or, if your
  module's engineer is responsible for requesting the change rather than implementing
  it, confirm that the upstream module's engineer has been explicitly handed off the
  task). Do not mark the module complete or hand off to QA if a named integration
  deliverable is unimplemented. If the integration requires a code change in another
  module's files and you are not that module's assigned engineer, write a blocker to
  status.md and stop — do not implement cross-boundary changes without assignment.
```

This item should be placed immediately after the "Every requirement in spec.md is implemented" item, since integration deliverables are first-class spec requirements.

## Target Files

- **Part 1 (spec template):** No single skill file currently owns the module spec template. This proposal targets the process used by the PM or Doc-Sync agent when writing or updating module specs. If a spec-template skill or convention file exists, the "Integration with [MOD-X]" section structure should be added there. If none exists, this proposal should be carried into a new project-level skill or into a note in `project-planning/production.md` under a "Module Spec Conventions" heading. Recommend: create a project-level skill `~/.claude/skills/spec-conventions/SKILL.md` (via the create-agent-skills skill) documenting the integration section requirement.

- **Part 2 (engineer checklist):** `~/.claude/skills/engineer-checklist/SKILL.md` — `<judgment_items>` section.

## Impact

- **PM / Doc-Sync agents:** When writing or syncing a module spec that names a navigator or component designed for embedding in another module, must include the "Integration with [MOD-X]" section with a concrete file, prop, and owner named. Prevents the pattern from recurring on MOD-005 (beta video, likely embedded in route detail), MOD-006 (social feed), and any future module that crosses a screen boundary.

- **Engineer agents (all future screen-writing modules):** The new checklist item creates a mandatory gate before QA handoff. An engineer whose spec includes a named integration deliverable cannot mark the module complete without verifying the wiring is in place, and an engineer asked to implement a wiring change in another module's file must do so under explicit assignment — not ad-hoc.

- **QA agents:** An integration requirement captured in a spec "Integration" section becomes a verifiable acceptance criterion. QA can check whether `GymDetailScreen` actually renders `RouteNavigator`, rather than relying on the assumption that because a navigator exists it must be connected.

- **Immediate remediation scope:** MOD-002 (`GymDetailScreen`) needs a retroactive wiring task to render `RouteNavigator`. This proposal does not apply the fix — it proposes the process change. The retroactive fix should be assigned as a named task to engineer-mod-gym-directory with the `GymDetailScreen.tsx` change described in Part 1's example.

## Risk

- The "Integration with [MOD-X]" section requirement adds authoring overhead to module specs. The overhead is intentional and proportionate — the alternative is integration gaps discovered at human QA time, which is higher-cost.
- The ownership rule (downstream module requests, upstream module implements) is a default recommendation. Specific cases may differ (e.g. when the downstream and upstream modules are built by the same engineer in the same sprint). The spec should name the owner explicitly regardless of which default applies, so there is never ambiguity.
- This proposal does not retroactively add integration sections to already-shipped specs (MOD-001 through MOD-004). The immediate actionable is the MOD-002/MOD-003 wiring gap; the process change applies going forward.
- The Part 1 target (spec-template skill) requires creating a new skill file via the create-agent-skills skill. If that creation is deferred, the integration section convention should at minimum be added as a note in `project-planning/production.md` so it is visible to all agents reading shared conventions.
