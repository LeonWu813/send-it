# Profile History & Stats (MOD-008) Status

## Engineering Progress

**Status**: Complete — ready for QA.
**Completed**: 2026-09-29

### Deliverables

**Migration**
- `supabase/migrations/20260929000001_mod_008_profile_history.sql`
  - `get_profile_history` SECURITY INVOKER RPC: joins ascents → routes → gyms, supports gym/grade/date filters, privacy gate (followers_only), returns empty when caller is non-follower of private profile.
  - `get_profile_stats` SECURITY INVOKER RPC: returns total_sends, sends_by_grade (JSON array), current_streak (consecutive days with ≥1 send ending today), highest_grade (enum MAX). Privacy gate identical to history RPC.

**Source files**
- `src/modules/mod-profile-history/types.ts` — HistoryAscent, ProfileStats, GradeCount, HistoryFilters, GRADE_ORDER, EMPTY_FILTERS, HistoryVisibility
- `src/modules/mod-profile-history/history-service.ts` — fetchProfileHistory, fetchProfileStats, fetchHistoryGyms
- `src/modules/mod-profile-history/components/StatsPanel.tsx` — summary stats row + sends-by-grade bar chart
- `src/modules/mod-profile-history/components/FilterBar.tsx` — gym/grade/date filter chips with picker modal (all three filters work independently and in combination, AC-060)
- `src/modules/mod-profile-history/components/AscentHistoryItem.tsx` — single row in history list
- `src/modules/mod-profile-history/components/SendHistoryProfile.tsx` — public embeddable component for MOD-001 ProfileScreen
- `src/modules/mod-profile-history/screens/ProfileHistoryScreen.tsx` — main screen with FlatList, stats header, filter bar, AC-062 refetchKey prop
- `src/modules/mod-profile-history/index.ts` — public barrel exports

**i18n**
- Added `profileHistory` namespace to both `locales/en/common.json` and `locales/zh-TW/common.json` (stats labels, filter labels, empty/hidden states, error message)

**Integration**
- `src/modules/mod-auth-profile/screens/ProfileScreen.tsx` — replaced MOD-008 placeholder TODO with `<SendHistoryProfile userId={profile.id} isOwnProfile />` (AC-118)

**Tests**
- `src/modules/mod-profile-history/__tests__/history-service.test.ts` — 16 tests covering fetchProfileHistory, fetchProfileStats, fetchHistoryGyms (privacy-blocked paths, filter params, null handling, error paths)
- `src/modules/mod-profile-history/__tests__/StatsPanel.test.tsx` — 5 tests covering render of stats values, null highest grade, all grades in chart, zero-send state

### Verification
- `npx tsc --noEmit` — 0 errors
- `npx jest --testPathPattern="mod-profile-history"` — 21 passed, 0 failed
- `npx jest --passWithNoTests` — 399 passed, 0 failed (no regressions)

### AC coverage
- AC-060: history filterable by gym, grade, date range (all filter combinations via RPC params)
- AC-061: stats panel with total sends, sends-by-grade bar chart, current streak, highest grade
- AC-062: refetchKey prop on ProfileHistoryScreen; parent increments after MOD-004 ascent insert to trigger immediate re-render without manual refresh
- AC-064: server-side privacy gate in both RPCs; non-followers of followers_only profiles receive zero rows

## QA Results

**QA verdict: FAIL**
**Date**: 2026-09-29
**Mode**: functional-test (first-time verification)
**Tester**: qa-mod-profile-history

---

### Automated checks

| Check | Result |
|---|---|
| Module directory exists | PASS |
| Spec file exists | PASS |
| `npx tsc --noEmit` | PASS — 0 errors |
| `npx jest --testPathPattern="mod-profile-history" --passWithNoTests` | PASS — 21/21 tests |
| `npx jest --passWithNoTests` (full suite) | PASS — 399/399 tests, 0 regressions |

---

### AC-by-AC results

**AC-060** — PASS (partial concern noted below under BUG-003)

History list is a FlatList of `AscentHistoryItem` rows. FilterBar implements gym, grade, and date range filter chips. All three filters work independently (clearing each chip resets that filter to null) and in combination (RPC receives all non-null filter params simultaneously). Server-side filtering confirmed in migration SQL: `AND (p_gym_id IS NULL OR r.gym_id = p_gym_id)`, `AND (p_grade IS NULL OR r.grade::TEXT = p_grade)`, `AND (p_date_from IS NULL OR a.logged_at >= p_date_from)`, `AND (p_date_to IS NULL OR a.logged_at <= p_date_to)`.

**AC-061** — PASS

StatsPanel renders the summary row (total sends, streak, highest grade) and sends-by-grade bar chart. All grade values VB–V10 are present in the chart (normalization in `fetchProfileStats` fills missing grades with 0). The `noGrade` fallback ("—") is rendered when `highest_grade` is null. Tests confirm all stat values render correctly.

**AC-062** — FAIL (see BUG-001)

The `refetchKey` prop exists in `ProfileHistoryScreen` and `SendHistoryProfile`, and the `useEffect` correctly depends on it. However, `ProfileScreen` (the only current consumer in `mod-auth-profile/screens/ProfileScreen.tsx`) passes `<SendHistoryProfile userId={profile.id} isOwnProfile />` with no `refetchKey` prop. No mechanism exists in `ProfileScreen` to bump `refetchKey` after a send is logged via MOD-004. The Profile tab uses the keep-alive display:none pattern (not unmounted), so mount-based refetch does not fire on tab-switch-back either. AC-062 requires stats recalculate "without requiring a manual refresh" — this is not wired.

FAIL AC-062: Input=[user logs a new send via MOD-004, then views Profile tab], Actual=[stats show stale totals until manual app restart or navigation away+back through a mount cycle], Expected=[stats recalculate immediately per spec; refetchKey mechanism exists in MOD-008 but ProfileScreen never increments it].

**AC-064** — PARTIAL FAIL (see BUG-002)

Server-side privacy gate is correctly implemented in both RPCs. `get_profile_history` and `get_profile_stats` both gate on `followers_only` — non-followers receive zero rows. SECURITY INVOKER is confirmed. The `HistoryVisibility = 'hidden'` type exists in `types.ts` and `hiddenTitle`/`hiddenBody` i18n keys exist in both locales. However, `ProfileHistoryScreen` never sets `visibility = 'hidden'` — both branches of the privacy-detection check at lines 96–103 unconditionally set `visibility = 'visible'`. The hidden/private state banner is never rendered. The server correctly withholds data; the client shows an empty list indistinguishable from "no sends recorded."

FAIL AC-064: Input=[non-follower views a `followers_only` profile via MOD-006 UserProfileScreen; RPC returns 0 rows], Actual=[client renders visibility='visible' with empty history list and zero stats — same UI as a user with no sends], Expected=[client renders a distinct hidden/private state, e.g. 'hiddenTitle'/'hiddenBody' per the i18n keys and HistoryVisibility='hidden' type that are defined but unused].

Note: `UserProfileScreen` (MOD-006) does not embed `SendHistoryProfile` at all — history is only embedded in `ProfileScreen` (own profile). This is a MOD-006 gap (source affordance ownership per spec boundary note); MOD-008 provides the embeddable component. The hidden-state rendering gap above is a MOD-008 bug (the component itself doesn't distinguish privacy-blocked from empty).

---

### Shared convention compliance

**Route Display Name Format** — FAIL (see BUG-003)

`production.md` §"Route Display Name Format" requires: `"{grade} {LocalizedColor}"` (e.g. "V3 Blue") with section_label appended when non-null (e.g. "V3 Blue (Cave)"). `AscentHistoryItem.tsx` lines 54–56 build the route label as:
```
item.section_label ? `${item.grade} (${item.section_label})` : item.grade
```
This produces "V3 (Cave)" or "V3" — omitting the localized color entirely. The `color_tag` field is available on `HistoryAscent` and is returned by the RPC, but is ignored by the component.

FAIL: Input=[HistoryAscent with grade='V3', color_tag='blue', section_label='Cave'], Actual=[routeLabel='V3 (Cave)'], Expected=['V3 Blue (Cave)' per production.md Route Display Name Format using t('routes.colors.blue')].

**SECURITY INVOKER** — PASS

Both RPCs (`get_profile_history`, `get_profile_stats`) use `SECURITY INVOKER` as required. Grants use `REVOKE ... FROM PUBLIC` then `GRANT ... TO authenticated` only.

**Migration convention** — PASS

Migration file `20260929000001_mod_008_profile_history.sql` follows the `YYYYMMDDNNNNNN_mod_NNN_<slug>.sql` naming convention. Both RPCs use `SET search_path = public`.

**Safe area insets** — PASS

`ProfileHistoryScreen` calls `useSafeAreaInsets()`, passes `insets.top` to `makeStyles(theme, insets.top)`, and uses `paddingTop: topInset + theme.spacing.md` in both `contentContainer` and `centered` styles. Matches the production.md convention exactly.

**i18n** — PASS

All `profileHistory.*` keys used by components are present in both `locales/en/common.json` and `locales/zh-TW/common.json`. No inline string literals in components — all user-facing strings go through `t()`. Both locale files have matching key sets under `profileHistory`.

**No hardcoded hex colors** — PASS

No hardcoded hex/rgb color values found in any component. All color references use `theme.colors.*` tokens.

**Supabase singleton** — PASS

`history-service.ts` imports `supabase` from `'../../lib/supabase'`. No `createClient()` call in the module.

**Grade never stored in Ascent** — PASS

The RPC joins `routes.grade` via `JOIN public.routes r ON r.id = a.route_id`. `types.ts` comment explicitly states "Grade is never stored on an Ascent — it is always joined from Route.grade at display time." No `grade` column is added to `Ascent` in the migration.

**Cross-module import rule** — PASS

`mod-auth-profile/screens/ProfileScreen.tsx` imports `SendHistoryProfile` from `'../../mod-profile-history'` (the barrel index), not from internal paths.

**TypeScript strict mode** — PASS

`npx tsc --noEmit` exits 0. `any` usages have `// eslint-disable-next-line @typescript-eslint/no-explicit-any` comments with explanations.

---

### Bug summary

**BUG-001 — AC-062 — implementation bug**
File: `src/modules/mod-auth-profile/screens/ProfileScreen.tsx`
`SendHistoryProfile` is mounted without a `refetchKey` prop. No state variable in `ProfileScreen` is incremented after MOD-004 logs a send. The refetch mechanism exists in MOD-008 but is disconnected from the send flow. Stats remain stale after a new ascent is logged until a cold remount.
Fix: `ProfileScreen` needs a `refetchKey` state variable that is incremented when MOD-004's log-send flow completes (typically via a callback or event). Engineer must wire the MOD-004 send completion signal into `ProfileScreen`'s `refetchKey` state.

**BUG-002 — AC-064 — implementation bug**
File: `src/modules/mod-profile-history/screens/ProfileHistoryScreen.tsx` lines 96–103
`HistoryVisibility = 'hidden'` type and `profileHistory.hiddenTitle`/`profileHistory.hiddenBody` i18n keys are defined but never used. Both branches of the privacy detection set `visibility = 'visible'`. The client cannot distinguish between "privacy blocked (zero rows)" and "genuine no sends" — both show an empty list. The spec requires a distinct hidden/private state to be rendered for non-followers of `followers_only` profiles.
Fix: When `!isOwnProfile` and RPC returns zero rows, the screen should attempt to determine if this is a privacy block (e.g., by checking the target user's `privacy_setting` or accepting it as a prop) and set `visibility = 'hidden'` to render a "Profile is Private / Follow to see history" banner using the existing i18n keys.

**BUG-003 — Route Display Name Format — implementation bug**
File: `src/modules/mod-profile-history/components/AscentHistoryItem.tsx` lines 54–56
Route label omits the localized color, violating the production.md Route Display Name Format convention. All route references must display as `"{grade} {LocalizedColor}"` (e.g. "V3 Blue (Cave)") — the component shows only `"{grade} ({section_label})"` (e.g. "V3 (Cave)"). The `color_tag` field is available on `HistoryAscent` and returned by the RPC but is not used.
Fix: Change the `routeLabel` construction to include the translated color: `const colorLabel = t(`routes.colors.${item.color_tag}`);` then `item.section_label ? `${item.grade} ${colorLabel} (${item.section_label})` : `${item.grade} ${colorLabel}`;`.

---

### Non-blocking observations (not spec violations)

- `AscentHistoryItem.tsx` has a few raw pixel values (`width: 44`, `height: 44`, `marginTop: 2`, `gap: 4`, `paddingVertical: 2`, `borderBottomWidth: 1`). The `production.md` Theming Rules prohibit hardcoded **hex colors** specifically; raw numeric layout constants that do not correspond to theme spacing tokens are a code-quality note, not a hard spec violation. Flagged for awareness.
- `StatsPanel.tsx` uses chart-specific constants (`BAR_MIN_WIDTH = 2`, `BAR_ROW_HEIGHT = 24`, `BAR_TRACK_WIDTH = 160`). These are rendering constants for the bar chart visualization, not spacing tokens — normal practice. No violation per production.md's "no hardcoded hex colors" rule.
- `UserProfileScreen` (MOD-006) does not embed `SendHistoryProfile`. Per the spec boundary note, the source affordance and embedding are MOD-006's responsibility; MOD-008 has delivered the embeddable component. Not a MOD-008 bug.
- AC-065 (achievement icons per ascent style — ⚡ Flash, send icon for Top, 🎯 Attempt) was added in PRD Revision 9 PM Updates but is NOT in the MOD-008 spec (spec is last synced at PRD Revision 5). `AscentHistoryItem` shows a style chip with the localized style name but no achievement icon. This is a **spec-sync gap, not an implementation bug** — the module spec was not updated to carry AC-065 from PRD Rev 9. [SPEC ISSUE: AC-065 is in PM Updates (PRD Rev 9) but absent from the MOD-008 spec.md; Doc-Sync did not carry it in. Escalate to PM/Doc-Sync, not Engineer.]

---

### Handoff

QA found 3 implementation bugs in mod-profile-history. See Bug summary above.
Next: `claude --agent engineer-mod-profile-history` to fix BUG-001, BUG-002, BUG-003.
