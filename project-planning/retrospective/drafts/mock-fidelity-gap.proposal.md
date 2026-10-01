# Proposal: Mock-Fidelity Gap — Option-Gated Return Fields

## Incident

**Feature**: AC-169 — post-compression size guard (MOD-005, mod-beta-video)
**Date**: 2026-10-01
**Source**: Human QA session on the Send It project

After uploading a video, a size guard was supposed to catch files still over the 50 MB Supabase Storage bucket limit after compression and show a user-friendly i18n error instead of a cryptic HTTP 413 from the storage API. The guard logic was:

```ts
const fileInfo = await getInfoAsync(compressedUri);
if (fileInfo.size !== undefined && fileInfo.size > BUCKET_LIMIT_BYTES) {
  throw new Error(t('betaVideo.errors.videoTooLargeAfterCompression'));
}
```

The call was written as `getInfoAsync(compressedUri)` without the `{ size: true }` options argument. Many `expo-file-system` API contract descriptions indicate that `getInfoAsync` only populates the `size` field when called with `{ size: true }` — without it, `size` may be `undefined` and the guard silently never fires. The file was not stopped at the client and hit Supabase Storage, returning HTTP 413. The user saw a cryptic storage API error message instead of the localized friendly string.

**Note**: The engineer's subsequent investigation of the installed `expo-file-system` legacy API found that, for this specific installed version (`InfoOptions` only accepts `{ md5?: boolean }`), `size` is unconditionally present on the `exists: true` branch regardless of options. The `{ size: true }` option was not applicable and the guard was not the root cause of the 413 in this particular version. However, the broader pattern — mocks that return fields unconditionally regardless of call arguments, masking option-gated API behavior — is the systemic risk this proposal addresses. The human QA session identified this as a recurring failure class worth encoding regardless of the specific API version outcome.

**Evidence location**: `project-planning/modules/mod-beta-video/status.md` — "Bug Fix — AC-169 pre-compression guard + getInfoAsync investigation — 2026-10-01"; human QA session input to this retrospective.

## Root Cause Pattern

**Mock-fidelity gap**: Jest mocks that pre-populate return values unconditionally, rather than reflecting the real API's conditional behavior based on call arguments.

The AC-169 Jest mock for `getInfoAsync` returned `{ exists: true, size: 1000 }` — a hardcoded flat object — regardless of what options were passed to the call. This means:

1. The engineer wrote `getInfoAsync(compressedUri)` (without `{ size: true }`).
2. The mock returned `{ exists: true, size: 1000 }` regardless.
3. The test exercised the if-size-then-throw branch and passed.
4. The mock hid the question of whether `size` would actually be present at runtime without the option.
5. QA ran `tsc` and the same unit tests — both passed. No TypeScript error exists because the option is an optional parameter. No failing test exists because the mock hid the gap.
6. The issue appeared only during human QA with a real upload.

This pattern recurs whenever:
- A real API has option-gated return fields (e.g., `getInfoAsync({ size: true })`, many Node.js `fs.stat` APIs, `Intl` formatting options, partial-field GraphQL responses)
- The mock returns a flat object with all fields populated unconditionally
- The call site omits a required option, but tests still pass because the mock doesn't inspect arguments

## Impact

- The user-facing error was a cryptic storage API message instead of the i18n-localized friendly error string.
- A follow-up bug fix was required, discovered only during human QA — a round-trip that could have been avoided.
- `tsc --noEmit` and unit tests both passed. The failure mode is invisible to the automated checks QA agents rely on.

## Proposed Changes

### Change 1: Engineer Skill — Mock-Fidelity Rule for Option-Gated Return Fields

**Target file**: `~/.claude/skills/engineer-checklist/SKILL.md` — `<judgment_items>` section

**Proposed addition** (insert after the existing `jest.clearAllMocks()` / DB teardown integration-test item):

```
- If writing a Jest mock for an external API function whose return value depends on options or arguments (e.g., a function where passing `{ size: true }` populates a `size` field that is otherwise absent, or a function that returns different shapes based on a mode flag): the mock must inspect call arguments and return a shape that reflects what the real API returns for those arguments — not a flat object with all fields populated unconditionally. A mock that always returns all fields will allow a test to verify the downstream if-field-then-do logic while hiding the question of whether the field is ever actually populated at runtime. Concrete example: a mock for `getInfoAsync` should return `{ exists: true, size: undefined }` when called without `{ size: true }`, and `{ exists: true, size: <value> }` only when called with `{ size: true }`, if that reflects the real API contract for the installed version. Before writing a mock for any external library function, check the library's type definitions (the installed `.d.ts` files, not internet documentation) to understand which fields are unconditional and which are option-gated.
```

**Rationale**: The current checklist has no item that addresses mock fidelity to API contracts. The AC-169 incident shows that a test can verify the correct branch logic while the mock hides whether the branch is ever reachable at runtime.

### Change 2: QA Skill — API Contract Audit for Option-Gated Fields

**Target file**: `~/.claude/skills/qa-checklist/references/common-failure-patterns.md` — append as next numbered pattern

**Proposed addition**:

```markdown
## 10. Mock-Fidelity Gap: Option-Gated API Return Fields

A Jest mock that returns all fields unconditionally can allow a test to verify downstream if-field-then-do logic while hiding whether the field is ever actually populated at runtime. This pattern is invisible to `tsc --noEmit` (the option is usually typed as optional, not missing) and to unit tests (the mock always provides the field). The failure appears only when real API behavior diverges from the mock.

**Identifying condition**: a feature depends on a specific field in an external API's return value, AND the field is populated only when a particular option or argument is passed to the API call.

**What to look for in code review:**
- Find the call site for the external API function (the non-mock, production call)
- Find the feature's test mock for that same function
- Compare the arguments the mock returns against what the real API contract specifies for those exact call arguments
- If the mock returns a field unconditionally but the real API only populates that field when a specific option is passed, check that the call site passes the option
- Specific example pattern: `getInfoAsync(uri)` without `{ size: true }` while the feature uses `fileInfo.size` — verify whether `size` is unconditional or option-gated in the installed library version's `.d.ts` file, not internet documentation

**Common APIs where this pattern occurs:**
- `expo-file-system` `getInfoAsync` (some API versions gate `size` on `{ size: true }`)
- Node.js `fs.stat` / `fs.statSync` (all versions include `size`, but this is worth verifying for any stat-like API)
- Fetch/XHR response properties gated on `credentials` or `mode` options
- Any library where the return type is a discriminated union or includes optional fields that appear only with specific inputs

**Test approach:**
- For the failing scenario: confirm the mock for the API function reflects the real return shape for the arguments actually used at the call site (not the arguments used in tests)
- Check the installed library's TypeScript type definition file (`node_modules/<package>/build/**/*.d.ts`) — the installed `.d.ts` is the authoritative contract for the version in use, not public documentation (which may describe a different version)
- If the field is option-gated in the real API: confirm the call site passes the required option; if it does not, this is an engineer bug to report, not a spec issue

**Impact**: The user sees a runtime failure (e.g., a silent guard that never fires, a cryptic upstream API error) even though all unit tests and TypeScript compilation pass. Found only during human QA with real API calls.
```

### Change 3: Cross-Project Applicability Note

Both proposed changes (engineer mock-fidelity rule, QA API-contract audit step) describe general patterns that apply to any project using this multi-agent framework, not only to "Send It." The root cause — option-gated API return fields hidden by flat unconditional mocks — is a language-agnostic testing pitfall that occurs in any TypeScript/JavaScript project using Jest with mocked external libraries.

**Recommendation**: When the engineer-checklist skill and qa-checklist common-failure-patterns file are updated based on this proposal, consider carrying the same changes into the base `engineer.md` and `qa.md` agent templates (if such templates exist at `~/.claude/agents/templates/`). This encodes the pattern at the framework level so future projects benefit without requiring a separate retrospective.

**Note on applicability scoping**: The engineer item as proposed is scoped to "when writing a Jest mock for an external API function whose return value depends on options or arguments" — this is intentionally general and not React Native- or expo-specific. Similarly, the QA failure pattern is framed around the general concept of option-gated fields, with expo-file-system as a concrete example. Both will apply to any module that mocks external libraries.

## Target Files

1. `~/.claude/skills/engineer-checklist/SKILL.md` — `<judgment_items>` section (Change 1)
2. `~/.claude/skills/qa-checklist/references/common-failure-patterns.md` — append as pattern 10 (Change 2)
3. `~/.claude/agents/templates/engineer.md` and `~/.claude/agents/templates/qa.md` — optional follow-on if templates exist (Change 3)

## Impact

- **Engineer agents (all modules)**: gain an explicit checklist item requiring mock argument inspection for option-gated APIs before handing off to QA. This prevents a class of silent guard failures that pass all automated checks.
- **QA agents (all modules)**: gain a named failure pattern with a concrete inspection procedure — check the installed `.d.ts`, not internet documentation; compare mock return shape against real API contract for the actual call arguments. QA agents will have a procedure to catch this class of defect through code review even though `tsc` and unit tests cannot.
- **Human reviewer**: QA's human test scripts will be more likely to include explicit verification of API-contract–dependent guards (e.g., confirm the upload is blocked and the friendly error appears, not just that the `tsc` build is clean).
- **Future projects**: if the change is carried into the base agent templates (Change 3), all future projects using this framework benefit without a project-specific retrospective.

## Risk

- The engineer item as written requires the engineer to consult the installed `.d.ts` file before writing a mock. This adds a small amount of work per mock but prevents a class of silent bugs that are expensive to diagnose in human QA. The item is scoped to "external API functions whose return value depends on options or arguments" — it does not apply to simple identity mocks or mocks with unconditional return shapes.
- The QA failure pattern is long, but its length reflects the specificity needed to make the check actionable. A vague entry ("check mocks match real APIs") would not be actionable; the pattern needs to tell QA agents exactly where to look (installed `.d.ts`, not internet docs) and what to compare.
- Neither change removes or weakens any existing constraint. Both are additive.
- The cross-project applicability note (Change 3) is an optional follow-on; the two primary changes (1 and 2) are the high-priority items.
