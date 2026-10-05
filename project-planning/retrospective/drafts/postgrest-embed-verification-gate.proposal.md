# Proposal: PostgREST Embed Verification Gate — Make Join-String Verification a Required, Auditable Engineer Step

## Evidence

**Primary source: `project-planning/status.md` — Skill Recommendations (2026-10-04)**

> "Pattern: A unit test passed on a `fetchBetaVideosByUser` whose PostgREST `.select()` embed string (a nested FK-hinted embed, `routes!..fk(name, gyms(name))` inside a `users!..fk(...)` embed) was rejected by PostgREST at runtime on device. The mocked Supabase client returned canned data without ever parsing the embed string — the untyped query DSL was validated by neither TypeScript nor the test.
> Why: PostgREST embed strings are a recurring un-typed, un-mockable failure surface in this codebase (same class as the device-only mock gap above, but for data access rather than native APIs). A skill codifying 'any new/modified `.select()` embed must be exercised against a real/local PostgREST before the AC is marked done; prefer a single embed level or server-side RPC composition over nested FK-hinted embeds; log the raw Supabase error before throwing a user-facing string so the diagnostic survives to Metro' would close the gap structurally."
> Agent: tech-lead

**Source: `project-planning/status.md` — Tech Lead Review 2026-10-04**

> "A PostgREST `.select()` embed string is effectively an untyped query DSL. TypeScript cannot validate it, and a mocked Supabase client cannot either — the mock short-circuits before any string is parsed. The only thing that validates an embed string is PostgREST itself (live or local). So a join string that is accepted by the compiler and by every unit test can still fail at runtime on device."

> "R2 — Make Convention B's verification leave a trace. A join string verified only in someone's head is indistinguishable from one never verified. Suggest the Engineer paste the equivalent SQL (or the raw PostgREST URL they hit) into the module `status.md` Engineering Progress entry for any AC that adds/modifies an embed, so QA and Tech Lead can see the check actually happened."

**Source: `project-planning/status.md` — PM Updates (2026-10-04 [TRIVIAL])**

> "Root cause context: `fetchBetaVideosByUser` threw a generic user-facing string on device because its `.select()` nested an FK-hinted embed inside another embed (`routes!beta_videos_route_id_fkey(name, gyms(name))`), a shape PostgREST rejects at runtime; the fully-mocked unit test never validated the string against PostgREST, and the function swallowed the raw error."

**Catch point**: the function was completely non-functional — throwing on every call — yet it cleared Engineer self-verification, QA code review, and the full unit test suite (88 passing tests). The failure surfaced only during human QA on device. This is the most expensive catch point in the pipeline.

**Existing partial mitigations already applied**: `production.md` now carries Convention A (log-before-throw in service functions) and Convention B (manual PostgREST verification for new/modified embed strings) as Shared Conventions. Both are advisory — they depend on the engineer remembering to perform the manual step and are not surfaced as an explicit gate in the self-verification workflow.

**Existing coverage check**: the `~/.claude/skills/engineer-checklist/SKILL.md` `<judgment_items>` section has no item that addresses PostgREST embed verification, Supabase query DSL validation, or leaving an auditable trace of data-access verification. The `~/.claude/skills/qa-checklist/references/common-failure-patterns.md` has no pattern covering untyped query strings that mocked clients cannot validate. Neither file references the Supabase-specific class of mock-invisible runtime failure. The proposed changes are additive and do not duplicate any existing item.

---

## Proposed Change

### Change 1 — Engineer Checklist: PostgREST Embed Verification Gate

**Add the following item to `~/.claude/skills/engineer-checklist/SKILL.md` in the `<judgment_items>` section**, immediately after the existing "If writing integration tests that use both a real database connection and Jest mocks" item:

```
- **If adding or modifying a Supabase `.select()` embed/join string** (any string that uses `related_table(columns)` or `table!fk_hint(columns)` syntax to embed a related table): you MUST exercise the exact string against the live or local Supabase instance before marking the AC done. Do this by running the equivalent query in the Supabase Studio SQL Editor, or by hitting the raw PostgREST endpoint directly. A `.select()` embed string is an untyped query DSL that neither TypeScript nor a mocked Supabase client can validate — the mock short-circuits before PostgREST ever parses the string, so a rejected query will pass every unit test and only fail at runtime on device. Nested FK-hinted embeds (e.g. `routes!fk(name, gyms!fk(name))`) are the highest-risk shape — prefer a single level of embed with one disambiguating FK hint, or compose the join server-side in an RPC, rather than stacking hints. **Record the verification in the module `status.md` Engineering Progress entry** — paste the equivalent SQL snippet or PostgREST URL you executed. A verification that exists only in memory is indistinguishable from one that was skipped; the written record makes it auditable by QA and Tech Lead. This gate is the data-access counterpart of the existing "Native Build Gate before QA handoff" convention — just as `npx expo run:ios` is required before QA for native modules because Jest cannot run native code, PostgREST execution is required before QA for any modified embed string because Jest cannot run PostgREST.
```

### Change 2 — QA Common Failure Patterns: Supabase Embed String — Untyped, Un-Mockable Query DSL

**Append the following as the next numbered pattern to `~/.claude/skills/qa-checklist/references/common-failure-patterns.md`:**

```markdown
## 10. Supabase PostgREST Embed String — Untyped, Un-Mockable Query DSL

A Supabase `.select()` string that contains an embedded join (`related_table(columns)`, `table!fk_hint(columns)`) is an untyped query DSL. Neither TypeScript compilation nor a Jest-mocked Supabase client validates it — the mock returns canned data before PostgREST ever sees the string. A malformed or PostgREST-rejected embed will pass every unit test and throw only at runtime on device.

**Identifying condition**: a service function uses a `.select()` string with one or more embedded joins (recognizable by `table(columns)` or `table!fk_name(columns)` nested inside another embed), AND the test for that function mocks the Supabase client rather than hitting a real instance.

**Highest-risk shape**: an FK-hinted embed nested inside another embed — e.g. `routes!beta_videos_route_id_fkey(name, gyms(name))` inside a `users!beta_videos_user_id_fkey(...)` parent embed. PostgREST rejects certain multi-level nesting patterns at runtime that it accepts at the outer level. Single-level embeds with one FK hint are well-tested and lower risk.

**What to look for in code review:**
- Find every `.select()` call in the module's service files. For each call that contains `table(columns)` or `table!fk(columns)` inside the string, ask: was this string exercised against a real or local Supabase instance before the AC was marked done?
- Check the module's `status.md` Engineering Progress entry for the AC that added/modified the embed. A conforming entry will contain a SQL snippet or PostgREST URL documenting the verification. If the entry has no such record, the verification may not have occurred.
- Check the service function's error-handling path: does it call `console.error('[functionName] error:', error)` before throwing the user-facing string? Without this, the raw PostgREST rejection message (which names the exact embed shape that was rejected) is invisible in Metro logs, making diagnosis far harder.

**What QA cannot catch via code review or unit tests:**
- Whether a specific embed-string shape is accepted by the version of PostgREST backing the Supabase project — this is only determinable by running the query against PostgREST. Document it in the test script as a manual verification step.

**Test approach:**
- For any AC that adds or modifies a `.select()` embed: include an explicit step in the human test script — navigate to the screen that triggers the service call, observe the data rendered, and confirm it matches the expected shape from the embedded tables. A "Failed to load" user-facing error where populated data is expected is the runtime symptom of a rejected embed string.
- If the function's error-handling logs the raw error (`console.error`), open Metro during the test run — the PostgREST rejection message will name the exact problematic embed clause.
- Escalate to Engineer (not PM) if the data fails to load and Metro shows a PostgREST error referencing a join or relationship name. The fix is to simplify the embed string or move the join to a server-side RPC.

**Impact**: the service function is completely non-functional — throwing on every call — yet the entire automated pipeline (TypeScript build + unit tests + QA code review) passes green. The failure appears only in human QA on device.
```

---

## Target Files

1. `~/.claude/skills/engineer-checklist/SKILL.md` — `<judgment_items>` section (Change 1)
2. `~/.claude/skills/qa-checklist/references/common-failure-patterns.md` — append as pattern 10 (Change 2)

---

## Impact

- **Engineer agents (all modules)**: gain an explicit, named self-verification gate — "verify this `.select()` embed against PostgREST and record the evidence in status.md" — that sits in the same checklist workflow as other mandatory pre-QA steps. The gate is structural: it requires a written artifact (SQL snippet or URL in status.md), not a mental checkbox that can silently be skipped.
- **QA agents (all modules)**: gain a named failure pattern with a concrete inspection procedure — look for the evidence record in Engineering Progress, check for `console.error` before throw in error paths, include an explicit data-load step in the human test script. QA agents can now surface the absence of the verification record as a finding, not just a runtime failure.
- **Human reviewer**: the test script produced by QA will explicitly include "navigate to screen, observe data loads, check Metro for PostgREST errors" for any AC touching a `.select()` embed, making the category of failure visible at the cheapest possible catch point.
- **Future modules**: any module that queries related tables via PostgREST embeds (social feed, leaderboard, route comments, etc.) benefits immediately — the checklist item applies to any `.select()` string with joins, not only to `mod-beta-video`.

---

## Risk

- **Change 1 adds a manual step** that cannot be automated in Phase 1 (no local Supabase in CI). The step is bounded — it applies only when an engineer adds or modifies a `.select()` embed string, not on every commit. For service functions that never touch embed strings, the item is a no-op. The item is scoped to "if adding or modifying" to prevent checklist bloat.
- **The status.md evidence record is advisory-mandatory** — it is stated as a requirement in the checklist item but cannot be enforced by the self-check script. This is the same pattern as other judgment items (e.g. "code is readable") that depend on engineer diligence rather than automation. The Tech Lead review (R2) specifically recommended this trace as the most practical Phase 1 gate.
- **Change 2 adds a QA pattern** that is only exercisable during human QA on device, not by QA code review alone. This is accurately stated in the pattern under "what QA cannot catch via code review." The pattern still provides value by telling QA agents what to look for (the evidence record, the log-before-throw pattern) and what to include in the human test script (an explicit data-load verification step).
- **Neither change duplicates existing items.** The existing `production.md` Shared Conventions (Convention A: log-before-throw; Convention B: PostgREST verification) are advisory prose in the production spec. The checklist item (Change 1) converts Convention B into an actionable, self-verification step with a required output artifact. The QA failure pattern (Change 2) gives QA agents a named category with an inspection procedure. The two skill changes and the two production.md conventions address the same root cause from different angles; they are complementary, not redundant.
- **No existing constraint is weakened.** Both changes are additive.
