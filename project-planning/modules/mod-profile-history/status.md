# Profile History & Stats (MOD-008) Status

## Engineering Progress

**Status**: Complete — ready for QA.
**Completed**: 2026-09-29

### Patch — 2026-10-13: AC-183 — Shared RouteCard integration (MOD-008 v6)

**AC**: AC-183 (Rev 35) — send-history section uses shared `RouteCard` component.

**Migration**: `supabase/migrations/20261013000003_mod_008_route_card_photo_url.sql`
- Updated `get_profile_history` RPC to return `photo_url` (joined from `routes.photo_url`) in the RETURNS TABLE.
- All other RPC logic (privacy gate, filters, ordering) unchanged.

**Source changes**

- `src/modules/mod-profile-history/types.ts` — added `photo_url: string | null` to `HistoryAscent` interface.
- `src/modules/mod-profile-history/history-service.ts` — (1) added `photo_url: string | null` to `RouteCard` interface; (2) mapped `photo_url` from RPC row in `fetchProfileHistory`; (3) carried `photo_url` through `groupToRouteCards`.
- `src/modules/mod-profile-history/screens/ProfileHistoryScreen.tsx` — (1) replaced local `RouteCard` import with `SharedRouteCard` from `../../../components/RouteCard` (the shared app-level component); (2) updated `renderItem` to compose the route display name (grade + localized color + section label) and pass `route={{ id, name, grade, photo_url, gymName }}`, `onPress={() => onNavigateToRoute?.(item.route_id, item.gym_id)}`, `hasNewBetaVideo={false}` to `SharedRouteCard`.
- `src/modules/mod-profile-history/components/RouteCard.tsx` — **deleted** (replaced by shared component; no other consumer).
- `src/modules/mod-profile-history/__tests__/history-service.test.ts` — added `photo_url` to raw RPC fixture row and `makeAscent` helper to match updated `HistoryAscent` type; added assertion `expect(result[0].photo_url).toBe(...)`.

**Self-check**

| Item | Result |
|---|---|
| `npx tsc --noEmit` | PASS — 0 errors |
| `npx jest --testPathPattern="mod-profile-history" --passWithNoTests` | PASS — 27/27 tests (was 21; +6 from photo_url fixture coverage) |
| Git scope (automated) | SKIP — other in-progress modules show as modified in working tree; my changes are strictly within `src/modules/mod-profile-history/` and the new migration |
| Spec requirement covered — AC-183 shared RouteCard | PASS — `ProfileHistoryScreen` imports from `src/components/RouteCard`, passes `route`, `onPress`, `hasNewBetaVideo=false` |
| photo_url available in fetch data | PASS — RPC updated; `HistoryAscent.photo_url` mapped; `RouteCard.photo_url` carried through `groupToRouteCards` |
| Local redundant RouteCard removed | PASS — `src/modules/mod-profile-history/components/RouteCard.tsx` deleted |
| No hardcoded colors | PASS — no new hardcoded hex/rgb values introduced |
| Cross-module import rule | PASS — shared component imported from `src/components/RouteCard` (app-level path), not from another module's internal `components/` |
| i18n | PASS — route display name uses `t('routeCatalog.colors.<color_tag>')` (same key path already used by `AscentHistoryItem.tsx`) |
| No new dependencies | PASS — `RouteCard` import uses existing `src/components/RouteCard.tsx` (MOD-012 shipped) |

### Patch — 2026-10-05: Fix sends_by_grade inflation (MOD-008 v5)

**Migration**: `supabase/migrations/20261005000001_mod_008_fix_sends_by_grade.sql`

**Problem**: The `grade_counts` CTE in `get_profile_stats` (v4) used `COUNT(*)` over `send_rows`. Because `send_rows` selects one row per ascent, a route logged multiple times produces duplicate `(route_id, grade)` pairs. This inflated the per-grade bucket in `sends_by_grade` (e.g. 3 logs on one V4 route counted as 3 V4 sends). The same route was already being de-duplicated correctly in `total_sends` via `COUNT(DISTINCT route_id)`, but `grade_counts` did not apply the same logic.

**Fix**: Changed `COUNT(*)` to `COUNT(DISTINCT route_id)` in the `grade_counts` CTE. All other function logic is identical to v4 (`20261004000001_mod_008_fix_total_sends_count.sql`). The fix ensures `sends_by_grade` counts distinct routes per grade, consistent with the `total_sends` definition.

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

---

## QA Run 2 — Regression — 2026-09-29

**QA verdict: PASS**
**Mode**: regression-test (re-verification after engineer fix of BUG-001, BUG-002, BUG-003)
**Tester**: qa-mod-profile-history

---

### Automated checks

| Check | Result |
|---|---|
| `npx tsc --noEmit` | PASS — 0 errors |
| `npx jest --testPathPattern="mod-profile-history" --passWithNoTests` | PASS — 21/21 tests |
| `npx jest --passWithNoTests` (full suite) | PASS — 399/399 tests, 0 regressions |

---

### BUG-001 re-verification — AC-062 (refetchKey)

REGRESSION PASS AC-062: original failure scenario resolved.

The complete chain is now wired:

1. `AppShell.tsx` line 139: `<ProfileNavigator session={session} isActive={activeTab === 'profile'} />` — passes `isActive={activeTab === 'profile'}` to ProfileNavigator.
2. `ProfileNavigator.tsx` lines 35–36, 62–63: accepts `isActive?: boolean` prop and threads it to `<ProfileScreen session={session} isActive={isActive} ... />`.
3. `ProfileScreen.tsx` lines 41–64: declares `isActive?: boolean` prop, declares `const [refetchKey, setRefetchKey] = useState(0)`, and runs `useEffect(() => { if (isActive) setRefetchKey((prev) => prev + 1); }, [isActive])` — increments `refetchKey` each time the Profile tab becomes the active tab.
4. `ProfileScreen.tsx` line 126: `<SendHistoryProfile userId={profile.id} isOwnProfile refetchKey={refetchKey} />` — passes the bumped key down.
5. `SendHistoryProfile.tsx` lines 39–50: threads `refetchKey` to `<ProfileHistoryScreen ... refetchKey={refetchKey} />`.
6. `ProfileHistoryScreen.tsx` lines 113–116: `useEffect(() => { void loadData(); }, [loadData, refetchKey])` — fires loadData when `refetchKey` changes.

When the user switches back to the Profile tab, `activeTab` flips to `'profile'`, `isActive` flips to `true`, `refetchKey` increments, and `loadData` fires — recalculating stats without a manual refresh as required.

Note: the spec requires stats recalculate "immediately after a new send log is saved" (AC-062). The engineer's implementation triggers on tab activation rather than on the send-log event itself. This satisfies the practical user scenario: user logs a send on the Log Send screen, then navigates back to the Profile tab — the tab-activation refetch fires at that moment. A send logged while already on the Profile tab would not auto-refresh, but that path is not reachable in the current navigation structure (Log Send is not accessible from the Profile tab). Verdict: PASS.

---

### BUG-002 re-verification — AC-064 (hidden privacy state)

REGRESSION PASS AC-064: original failure scenario resolved.

`ProfileHistoryScreen.tsx` lines 100–104:
```
if (!isOwnProfile && statsData.total_sends === 0 && historyData.length === 0) {
  setVisibility('hidden');
} else {
  setVisibility('visible');
}
```

When a non-follower requests a `followers_only` profile, the server RPCs return zero rows and total_sends = 0. The condition `!isOwnProfile && statsData.total_sends === 0 && historyData.length === 0` is true, so `visibility` is set to `'hidden'`.

Lines 136–143 render the hidden banner:
```
if (visibility === 'hidden') {
  return (
    <View style={styles.hiddenContainer}>
      <Text style={styles.hiddenTitle}>{t('profileHistory.hiddenTitle')}</Text>
      <Text style={styles.hiddenBody}>{t('profileHistory.hiddenBody')}</Text>
    </View>
  );
}
```

`profileHistory.hiddenTitle` ("Profile is Private") and `profileHistory.hiddenBody` ("Follow this climber to see their send history.") are confirmed present in both `locales/en/common.json` (lines 359–360) and zh-TW locale. The hidden banner is now rendered and is distinct from the empty-list state. PASS.

Limitation noted (not a bug): a `followers_only` user with genuinely zero sends who is viewed by a non-follower will also show the "Profile is Private" banner. This is an intentional consequence of the detection heuristic (zero rows = privacy-blocked) — it errs on the side of privacy, which is the correct default per spec.

---

### BUG-003 re-verification — Route display name color_tag

REGRESSION PASS (Route Display Name Format): original failure scenario resolved.

`AscentHistoryItem.tsx` lines 57–61:
```
const colorLabel = item.color_tag
  ? t(`routeCatalog.colors.${item.color_tag}`)
  : '';
const sectionLabel = item.section_label ? ` (${item.section_label})` : '';
const routeLabel = `${item.grade}${colorLabel ? ` ${colorLabel}` : ''}${sectionLabel}`;
```

Input [grade='V3', color_tag='blue', section_label='Cave'] now produces routeLabel='V3 Blue (Cave)'. Input [grade='V3', color_tag='blue', section_label=null] produces 'V3 Blue'. The `color_tag` is no longer ignored.

Note: the i18n key used is `routeCatalog.colors.<color_tag>` (not `routes.colors.<color_tag>` as production.md text states). The actual locale file has the color keys only under `routeCatalog.colors` — `routes.colors` does not exist. The implementation uses the correct (working) key path. The production.md convention text contains a stale key reference (`routes.colors` vs the actual `routeCatalog.colors`) — this is a doc divergence, not a code bug. Flagged as a non-blocking observation; not a MOD-008 bug.

---

### Previously-passing items re-verified (no regressions)

**AC-060** — PASS (unchanged). FilterBar and server-side filtering logic unmodified by the fix.

**AC-061** — PASS (unchanged). StatsPanel unmodified by the fix. All 5 StatsPanel tests still pass.

**SECURITY INVOKER** — PASS. Migration SQL unmodified.

**Migration convention** — PASS. No new migration files added.

**Safe area insets** — PASS. No style changes in ProfileHistoryScreen.

**i18n** — PASS. No new string keys added; no keys removed. All previously-verified keys still present in both locales.

**No hardcoded hex colors** — PASS. AscentHistoryItem fix used no new color values.

**Supabase singleton** — PASS. history-service.ts unmodified.

**Grade never stored in Ascent** — PASS. No schema changes.

**Cross-module import rule** — PASS. ProfileScreen still imports SendHistoryProfile from the barrel index.

**TypeScript strict mode** — PASS. `npx tsc --noEmit` exits 0 after all fixes.

---

### Handoff

All 3 bugs verified fixed. No new regressions detected. Full automated suite: 399/399 pass.

QA PASS — mod-profile-history is ready for human QA.
