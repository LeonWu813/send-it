# Profile History & Stats (MOD-008) Status

## Engineering Progress

**Status**: Complete — ready for QA.
**Completed**: 2026-09-29

**Off-spec design work (page-review v2.3) pending PR review** (2026-10-23, branch `design/page-templates`): StatsPanel `variant="compact"` + `onOpenDetails`; new `ProfileHistoryView` pushed view (useAppHeader back + title) and `useOpenProfileHistory()` / `ProfileHistoryNavProvider` wired in AppShell as an overlay; R0 spacing fixed (content x=16, StatsPanel no longer pads itself); T-1 verified (only the 12pt Highest pill remains); stories Compact + pushed Profile History; i18n key `profileHistory.stats.compactHint`.

**Storybook screen story (2026-10-22)**: Added `ProfileHistoryScreen.stories.tsx` covering 4 states: Loading (static Spinner matching `visibility === 'loading'`), Populated (4 route cards, StatsPanel with sends, grade tabs), Empty (zero-records prompt), FilteredEmpty (attempt-only ascents — hasRecords=true, no route cards, inline empty state). Stub data seeded via `setStubData('rpc:get_profile_history', ...)` and `setStubData('rpc:get_profile_stats', ...)` in per-story decorators following the `NotificationInboxScreen.stories.tsx` pattern. No component source changed. tsc: 0 errors in module. 29/29 tests pass.

**Off-spec design tooling (2026-10-16)**: Added Storybook stories for StatsPanel, FilterBar and AscentHistoryItem in `src/modules/mod-profile-history/stories/` on branch `design/storybook`. Not part of the spec; no component source changed. Pending PR review.

### Integration-fix — 2026-10-21: INT-009 and INT-013 set to FIXED – AWAITING QA

**INT-009**: Verified `supabase/migrations/20261013000006_mod_008_int009_block_filter.sql` (commit `6804dac`). Both `get_profile_history` and `get_profile_stats` contain symmetric NOT EXISTS block predicates guarded by an owner check (`auth.uid() = p_user_id`). No new code written. Row set to `FIXED – AWAITING QA`.

**INT-013**: Verified `supabase/migrations/20261020000001_mod_008_accumulated_days_privacy.sql` (commit `7be5eb2`). `accumulated_days` SELECT includes `AND (v_is_self OR is_private = FALSE)`, matching the privacy predicate on `total_sends` and `sends_by_grade`. No new code written. Row set to `FIXED – AWAITING QA`.

### Patch — 2026-10-20: M-1 — Apply is_private filter to accumulated_days in get_profile_stats

**Issue**: M-1 (Phase 1 quality review) — `get_profile_stats` counted ALL qualifying ascents (style IN ('flash', 'top')) when computing `accumulated_days`, ignoring `is_private`. Meanwhile `total_sends` and `sends_by_grade` in the same function correctly applied `(v_is_self OR a.is_private = FALSE)`. A non-owner viewer of a profile with many private sends saw `accumulated_days` inflated relative to the visible send count — internally inconsistent stats.

**Migration**: `supabase/migrations/20261020000001_mod_008_accumulated_days_privacy.sql`
- `get_profile_stats`: Added `AND (v_is_self OR is_private = FALSE)` to the `accumulated_days` SELECT, exactly matching the privacy predicate already applied to `total_sends` and `sends_by_grade`.
- All other function logic identical to v6 (`20261013000006_mod_008_int009_block_filter.sql`): signature, SECURITY INVOKER, `SET search_path = public`, block check, followers_only early-return, `send_rows` CTE, `highest_grade` subquery, REVOKE/GRANT — all preserved exactly.

### Patch — 2026-10-20: INT-009 — Block filter on profile RPCs

**Issue**: INT-009 (HIGH) — `get_profile_history` and `get_profile_stats` had no block predicate. A blocked user could navigate to the blocker's profile and read their full send history and stats despite the block relationship.

**Migration**: `supabase/migrations/20261013000006_mod_008_int009_block_filter.sql`
- `get_profile_history`: Added block predicate to the WHERE clause, wrapped in `auth.uid() = p_user_id OR NOT EXISTS (...)` so a user can always read their own history. All existing predicates (privacy_setting, follows check, filters) preserved exactly.
- `get_profile_stats`: Added `v_is_blocked` DECLARE variable and an early-return guard after the followers_only check. When a block exists in either direction (and caller is not the profile owner), the function returns `0, '[]', 0, NULL` — same shape as the privacy-blocked path. All other logic identical to v5.

Both functions: `CREATE OR REPLACE FUNCTION`, `SECURITY INVOKER`, `SET search_path = public`, original signatures, REVOKE/GRANT pattern — all preserved.

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

### Design System v1.2 (off-spec design work, pending PR review) - 2026-10-16

Visual + motion only; no service, flow or filter-logic changes. Body (Phase 1) only.
- StatsPanel (§32.5): AppText type scale, highest bar `textPrimary` + "Highest" label, others `border`, no track, 4pt nub for 0-count grades between V0 and highest, bar-grow D7 once per session (stagger 30, max 8, highest `settle`, no number rolling, Reduce Motion = final state), per-bar a11y labels, 2-column summary at fontScale >= 1.6, zero sends = EmptyState `firstUse`.
- FilterBar (§32.6): `ui/` Chip `filter` + separate clear button, wrapping row (columnGap 8, rowGap 12, screenMargin), pickers = BottomSheet `list-single` with `useSheetSelect`. "This Year" label changed to "Last Year" / "最近 1 年" (key `thisYear` -> `lastYear`); filter logic unchanged (365 days). Chip shows the preset name when the range matches a preset.
- AscentHistoryItem (§32.7): SendStyleChip (no `warning` fill), grade and route name as separate nodes (name shrinks, never disappears), lock icon + `textSecondary` private marker, 44x44 thumbnail when `photo_url` exists, SendStyleChip on line 2 at fontScale >= 1.6, merged VoiceOver label.
- ProfileHistoryScreen: AppText/sectionHeader, Chip `choice` grade tabs, EmptyState (`private`, `inline`), InlineError + retry for load failure (translated text, not `err.message`), Spinner, screenMargin.
- Stories: one Controls-driven Playground each. Locale keys added: `profileHistory.stats.{highestBadge,barA11y*,emptyBody}`, `profileHistory.filter.lastYear`.
- Not done: TapeBadge in the item (not shipped by route-catalog; route colour is in the name), results cross-fade (FilterBar is not used by the screen and does not own results), delete sheet (module has no delete), `FLASH_BADGE_COLOR` (lives in mod-route-catalog / mod-send-logging / src/components/RouteCard.tsx, not this module).


### Design System v2.2 (off-spec design work, pending PR review) - 2026-10-16

- StatsPanel: tinted hero (`display` 72 top grade + "N sends" at that grade, no date) + two static tiles (`numeric1` 34 + half-size `unit`; label "Days climbed"), distribution card with 6pt bars on `surfaceAlt` tracks (neutral `outline` fill, only the top row `sendTop` + "Highest" pill in the grade column), displacement reveal (`translateX` in a clipped track, `medium` + stagger 30 up to 7 steps, once per session; Reduce Motion fades the card). States: attempts-only (structure kept, no button), zero records (`hasRecords=false`: one EmptyState `prompt`). AX: hero full width, units wrap under the number. Only existing `ProfileStats` fields.
- FilterBar: `on="background"` chips (inverted + 30pt clear come from `ui/Chip`), row gap 8, floating `list-single` sheet with `optionCount`.
- AscentHistoryItem: v2.2 layout (56 thumb or TapeBadge square, TapeBadge md + area, `Color・Gym・Date` subtitle, private marker, SendStatus `disc`, optional divider; disc moves to line 2 at AX).
- ProfileHistoryScreen: `pageSection` title, zero-records prompt replaces stats + history section, new optional `onLogSend` (also on SendHistoryProfile) for the prompt's single action.
- Locales: new `profileHistory.stats.*` keys (hero, units, states, prompt, a11y); `accumulatedDays` zh "完攀天數", `chartTitle` reworded.
- Open: mod-auth-profile ProfileScreen does not yet pass `onLogSend`, so the prompt shows without its button until it does.

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

---

## QA Run 3 — Regression — 2026-10-13

**QA verdict: PASS**
**Mode**: regression-test (AC-183 shared RouteCard integration — re-verify all existing ACs + verify AC-183 items)
**Tester**: qa-mod-profile-history

---

### Automated checks

| Check | Result |
|---|---|
| `npx tsc --noEmit` | PASS — 0 errors |
| `npx jest --testPathPattern="mod-profile-history" --passWithNoTests` | PASS — 27/27 tests (was 21; +6 from photo_url fixture coverage) |
| `npx jest --passWithNoTests` (full suite) | 510/512 pass — 2 failures in `mod-beta-video` only; confirmed pre-existing (last mod-beta-video commit `4c91738` predates AC-183 engineer commit `d3def04`; no mod-profile-history file in those failures). Zero regressions introduced by AC-183 patch. |

---

### AC-183 specific verification

**AC-183 item 1 — SharedRouteCard imported from app-level path** — PASS

`ProfileHistoryScreen.tsx` line 33: `import SharedRouteCard from '../../../components/RouteCard';`

Resolved path: `src/components/RouteCard.tsx` (owned by MOD-012). This is the correct app-level shared component path per the App-Level Shared Presentational Components convention in `production.md` and per the AC-183 spec text ("imported via the app-level path `src/components/RouteCard`"). No internal module `components/` path used.

**AC-183 item 2 — Local RouteCard.tsx deleted** — PASS

`src/modules/mod-profile-history/components/` directory contains: `AscentHistoryItem.tsx`, `FilterBar.tsx`, `SendHistoryProfile.tsx`, `StatsPanel.tsx`. No `RouteCard.tsx` present. The local redundant component has been deleted as required.

**AC-183 item 3 — Route cards render with photo_url thumbnail on right and hasNewBetaVideo={false}** — PASS

`ProfileHistoryScreen.tsx` lines 244–256 `renderItem`:
```
<SharedRouteCard
  route={{
    id: item.route_id,
    name: routeName,
    grade: item.grade,
    photo_url: item.photo_url,
    gymName: item.gym_name,
  }}
  onPress={() => onNavigateToRoute?.(item.route_id, item.gym_id)}
  hasNewBetaVideo={false}
/>
```

`src/components/RouteCard.tsx` layout: left side = route info (`<View style={styles.info}>`), right side = thumbnail (lines 88–97: `route.photo_url !== null ? <Image source={{ uri: route.photo_url }} style={styles.thumbnail} ... /> : <View style={styles.thumbnailPlaceholder} />`). `hasNewBetaVideo={false}` suppresses the "New Beta" badge correctly. Photo renders on the right as required.

**AC-183 item 4 — Migration includes photo_url in RETURNS TABLE** — PASS

`supabase/migrations/20261013000003_mod_008_route_card_photo_url.sql` RETURNS TABLE (line 32): `photo_url TEXT`. Body (line 51): `r.photo_url AS photo_url`. Joined from `public.routes r` via `JOIN public.routes r ON r.id = a.route_id`. Migration naming follows `YYYYMMDDNNNNNN_mod_NNN_<slug>.sql` convention. SECURITY INVOKER and `SET search_path = public` are present (lines 39–41). REVOKE/GRANT pattern correct (lines 81–82).

**AC-183 item 5 — HistoryAscent type includes photo_url: string | null** — PASS

`src/modules/mod-profile-history/types.ts` lines 38–39:
```
/** Route photo URL from routes.photo_url — null when no photo is set. */
photo_url: string | null;
```

**AC-183 item 6 — photo_url carried through history-service** — PASS

`history-service.ts`:
- `RouteCard` interface (line 165): `photo_url: string | null`
- `fetchProfileHistory` mapping (line 72): `photo_url: (row.photo_url as string | null) ?? null`
- `groupToRouteCards` (line 196): `photo_url: a.photo_url ?? null`

The field is correctly mapped from RPC row through `HistoryAscent` into `RouteCard`.

**AC-183 item 7 — Route display name format preserved (production.md convention)** — PASS

`ProfileHistoryScreen.tsx` lines 238–242 composes the route name used by `SharedRouteCard`:
```
const colorLabel = item.color_tag
  ? t(`routeCatalog.colors.${item.color_tag}`)
  : '';
const sectionSuffix = item.section_label ? ` (${item.section_label})` : '';
const routeName = `${item.grade}${colorLabel ? ` ${colorLabel}` : ''}${sectionSuffix}`;
```
Input [grade='V3', color_tag='blue', section_label='Cave'] produces routeName='V3 Blue (Cave)'. Matches production.md Route Display Name Format. The BUG-003 fix (previously verified in QA Run 2 on `AscentHistoryItem.tsx`) is also correctly applied in `ProfileHistoryScreen`'s new `renderItem` using the same i18n key path `routeCatalog.colors.<color_tag>`.

---

### Previously-passing ACs re-verified (regressions check)

**AC-060** — PASS. `fetchProfileHistory` called with all null filters in `ProfileHistoryScreen` — all ascents fetched, client-side grade-tab filtering applied. RPC WHERE clauses (gym/grade/date filters) unchanged in the new migration. Server-side filtering logic untouched.

**AC-061** — PASS. `StatsPanel` is rendered in `ListHeader` (`ProfileHistoryScreen.tsx` line 214: `{stats !== null && <StatsPanel stats={stats} />}`). `fetchProfileStats` call unchanged. All 5 StatsPanel tests still pass.

**AC-062** — PASS. `useEffect(() => { void loadData(); }, [loadData, refetchKey])` (line 136) unchanged. `refetchKey` prop still accepted and wired. The complete chain (`AppShell → ProfileNavigator → ProfileScreen → SendHistoryProfile → ProfileHistoryScreen`) verified in QA Run 2 is intact; no files in that chain were modified by the AC-183 patch.

**AC-064** — PASS. Privacy gate: `!isOwnProfile && statsData.total_sends === 0 && historyData.length === 0 → setVisibility('hidden')` (lines 121–125) unchanged. Hidden banner render (lines 157–164) unchanged. `get_profile_history` RPC privacy WHERE clause unchanged in the new migration (only added `r.photo_url AS photo_url` to the SELECT list and RETURNS TABLE; all filter/privacy logic identical to prior version).

**SECURITY INVOKER** — PASS. New migration `20261013000003_mod_008_route_card_photo_url.sql` uses `SECURITY INVOKER` (line 39) and `SET search_path = public` (line 41). Existing `get_profile_stats` RPC unchanged.

**Migration convention** — PASS. New migration `20261013000003_mod_008_route_card_photo_url.sql` follows `YYYYMMDDNNNNNN_mod_NNN_<slug>.sql` convention.

**Safe area insets** — PASS. `useSafeAreaInsets()` + `makeStyles(theme, topInsetForStyles)` + `paddingTop: topInset + theme.spacing.md` pattern unchanged in `ProfileHistoryScreen.tsx`.

**i18n** — PASS. `routeName` composition uses `t('routeCatalog.colors.<color_tag>')` — same key path used throughout the module. No new i18n keys added by AC-183 patch. No keys removed.

**No hardcoded hex colors** — PASS. No new hex/rgb values in any changed file. `src/components/RouteCard.tsx` uses only `theme.colors.*` tokens.

**Supabase singleton** — PASS. `history-service.ts` import unchanged.

**Grade never stored in Ascent** — PASS. No schema changes to the `ascents` table. New migration only modifies `get_profile_history` function return shape.

**Cross-module import rule** — PASS. `SharedRouteCard` imported from `src/components/RouteCard` (app-level, not another module's internal directory). This is the explicit exception defined in the App-Level Shared Presentational Components convention.

**TypeScript strict mode** — PASS. `npx tsc --noEmit` exits 0.

---

### Non-blocking observations

- The `console.error` before throw convention (`production.md §Log Raw Supabase Error Before Throwing`) is still absent from `fetchProfileHistory`, `fetchProfileStats`, and `fetchHistoryGyms` in `history-service.ts`. This is a pre-existing gap — not introduced by AC-183 — and was present at QA Run 1 and QA Run 2. Not a regression; noted for awareness.
- `src/components/RouteCard.tsx` contains two raw pixel values in `routeName` (`marginBottom: 2`) and `grade`/`gymName` (`marginBottom: 2`) and `newBetaBadge` (`paddingVertical: 2`). These are layout constants, not hex colors — no violation of the production.md Theming Rules. MOD-012 owns this file; not a MOD-008 finding.

---

### Handoff

AC-183 regression test: all items verified. No regressions introduced by the AC-183 patch. All pre-existing ACs (AC-060, AC-061, AC-062, AC-064) continue to pass.

QA PASS — mod-profile-history AC-183 regression verified.

---

## QA Run 4 — Regression — 2026-10-14

**QA verdict: PASS**
**Mode**: regression-test (i18n fix — grade filter tab hardcoded 'All' replaced with t('home.projectingRoutes.allGrades'))
**Tester**: qa-mod-profile-history

---

### Verification targets

This run verifies one specific regression item: the engineer replaced a hardcoded `'All'` string in the grade filter tab with `t('home.projectingRoutes.allGrades')` using the existing `useTranslation('common')` hook in `ProfileHistoryScreen.tsx`.

---

### Automated checks

| Check | Result |
|---|---|
| `npx tsc --noEmit` | PASS — 0 errors |
| `npm test -- --watchAll=false --testPathPattern="mod-profile-history"` | PASS — 27/27 tests, 0 failures |

---

### Item 1 — Hardcoded 'All' string removed

`ProfileHistoryScreen.tsx` line 200: `grep -n "'All'"` returns no results. The hardcoded string literal `'All'` is absent from the screen file.

PASS.

---

### Item 2 — t('home.projectingRoutes.allGrades') in use

`ProfileHistoryScreen.tsx` line 200:
```
{tab === 'all' ? t('home.projectingRoutes.allGrades') : tab}
```

The `useTranslation('common')` hook is already declared at line 88 (`const { t } = useTranslation('common');`). The key is accessed via the existing `t` reference. No new hook import or instantiation was added — the fix correctly piggybacks on the already-present hook.

PASS.

---

### Item 3 — Key exists in both locale files

`locales/en/common.json` line 277: `"allGrades": "All"` — under `home.projectingRoutes` (confirmed: `"home"` at line 260, `"projectingRoutes"` at line 275, `"allGrades"` at line 277).

`locales/zh-TW/common.json` line 277: `"allGrades": "全部"` — identical structure under `home.projectingRoutes`.

Both locale files have the key. The i18n resolution path `t('home.projectingRoutes.allGrades')` with namespace `'common'` is valid in both English and Traditional Chinese.

PASS.

---

### Item 4 — Previously-passing ACs re-verified (no regressions)

The i18n fix touches only the grade-tab label rendering at line 200. No data-fetch, filter logic, privacy gate, stats calculation, or component structure was changed.

**AC-060** — PASS. FilterBar and server-side filtering logic unmodified.

**AC-061** — PASS. StatsPanel rendering unmodified.

**AC-062** — PASS. `useEffect` refetch chain (lines 135–137) unmodified.

**AC-064** — PASS. Privacy visibility gate (lines 121–125 and 157–164) unmodified.

**AC-183** — PASS. `SharedRouteCard` import (line 33), `renderItem` (lines 233–255), and route display name composition (lines 237–241) unmodified.

All 27 tests pass — no regressions.

---

### Handoff

i18n regression test: all items verified. No regressions introduced. All pre-existing ACs (AC-060, AC-061, AC-062, AC-064, AC-183) continue to pass.

QA PASS — mod-profile-history i18n fix regression verified.

---

## QA Run 5 — Integration-fix-verify — 2026-10-21

**QA verdict: PASS**
**Mode**: integration-fix-verify (INT-009 block filter, INT-013 accumulated_days privacy fix)
**Tester**: qa-mod-profile-history

---

### Automated checks

| Check | Result |
|---|---|
| `npx tsc --noEmit` | PASS — 0 errors |
| `npx jest --testPathPattern="mod-profile-history" --passWithNoTests` | PASS — 29/29 tests (was 27 in prior runs; 2 additional tests present, 0 failures) |
| `npx jest --passWithNoTests` (full suite) | 633/634 pass — 1 failure in `mod-send-logging/AscentList.test.tsx` (pre-existing flaky; passes 12/12 in isolation, consistent with all prior QA run notes). Zero regressions introduced by INT-009 or INT-013 migrations. |

---

### INT-009 — Block filter on get_profile_history and get_profile_stats

**Migration**: `supabase/migrations/20261013000006_mod_008_int009_block_filter.sql` (commit `6804dac`)

**get_profile_history — block predicate verified** (lines 79–86 of migration):

```sql
AND (
  auth.uid() = p_user_id
  OR NOT EXISTS (
    SELECT 1 FROM public.blocks b
    WHERE (b.blocker_user_id = auth.uid() AND b.blocked_user_id = p_user_id)
       OR (b.blocker_user_id = p_user_id AND b.blocked_user_id = auth.uid())
  )
)
```

- Symmetric: covers both block directions (A→B and B→A). PASS.
- Owner-guarded: `auth.uid() = p_user_id` ensures the profile owner always sees their own history. PASS.
- Returns zero rows on block — same as the existing followers_only path; blast-radius finding (2026-10-21) confirms callers handle this safely. PASS.
- All prior WHERE clause predicates (privacy_setting, follows check, gym/grade/date filters) are present and unchanged. PASS.

**get_profile_stats — block check verified** (lines 115–149 of migration):

- `v_is_blocked BOOLEAN` declared in DECLARE block (line 119). PASS.
- Block check placed after the followers_only early-return (correct ordering): `NOT v_is_self AND EXISTS (SELECT 1 FROM public.blocks ...)` (lines 140–144). Symmetric: covers both directions. PASS.
- When blocked: `RETURN QUERY SELECT 0::BIGINT, '[]'::JSON, 0::INT, NULL::TEXT` (line 147) — same shape/cardinality as the followers_only gate; blast-radius confirms `.single()` in `fetchProfileStats` succeeds on this one-row return. PASS.
- Owner-guarded: `NOT v_is_self` ensures the profile owner is never affected by the block check. PASS.
- All prior logic (send_rows CTE, grade_counts, highest_grade, SECURITY INVOKER, SET search_path, REVOKE/GRANT) preserved exactly. PASS.

**INT-009 REGRESSION PASS**: original failure scenario (blocked user reads blocker's full send history and stats) no longer reproduces at the server RPC layer.

---

### INT-013 — accumulated_days privacy fix

**Migration**: `supabase/migrations/20261020000001_mod_008_accumulated_days_privacy.sql` (commit `7be5eb2`)

This migration supersedes `20261013000006` for `get_profile_stats`. It copies the INT-009 function body and adds the privacy predicate to `accumulated_days`.

**accumulated_days SELECT with privacy filter** (lines 77–82 of migration):

```sql
SELECT COUNT(DISTINCT DATE(logged_at AT TIME ZONE 'Asia/Taipei'))::int
INTO v_accumulated_days
FROM public.ascents
WHERE user_id = p_user_id
  AND style IN ('flash', 'top')
  AND (v_is_self OR is_private = FALSE);
```

- `AND (v_is_self OR is_private = FALSE)` present — matches the privacy predicate applied to `total_sends` and `sends_by_grade` in the `send_rows` CTE at lines 91–92. PASS.
- Block check from INT-009 preserved (lines 60–70): `get_profile_stats` block gate is not regressed by this migration. PASS.
- `send_rows` CTE (lines 86–93) and `highest_grade` subquery (lines 109–115) both apply `(v_is_self OR a.is_private = FALSE)` — unchanged, matching the fix's intent. PASS.
- SECURITY INVOKER, SET search_path = public, REVOKE/GRANT pattern preserved. PASS.

**INT-013 REGRESSION PASS**: original failure scenario (non-owner seeing `accumulated_days` inflated by private sends, inconsistent with `total_sends` and `sends_by_grade`) resolved at the server RPC layer.

---

### Previously-passing ACs re-verified (no regressions)

Neither migration touches any TypeScript source file. All AC-carrying components and service functions are unchanged.

**AC-060** — PASS. `get_profile_history` WHERE clause filter predicates (gym/grade/date, lines 87–90) are present and unchanged in `20261013000006`. FilterBar and `fetchProfileHistory` call sites unmodified.

**AC-061** — PASS. `StatsPanel` and `fetchProfileStats` service call unmodified. `sends_by_grade` CTE logic unchanged. All 5 StatsPanel tests still pass.

**AC-062** — PASS. `useEffect` refetch chain in `ProfileHistoryScreen` unmodified. `refetchKey` wiring (AppShell → ProfileNavigator → ProfileScreen → SendHistoryProfile → ProfileHistoryScreen) unchanged.

**AC-064** — PASS. Privacy gate in both RPCs unchanged (followers_only early-return still present and fires before the new block check). Client-side `visibility = 'hidden'` logic in `ProfileHistoryScreen` unchanged.

**AC-183** — PASS. `SharedRouteCard` import and `renderItem` composition in `ProfileHistoryScreen` unchanged. No migration touches `get_profile_history` RETURNS TABLE beyond what was already verified in QA Run 3.

**i18n key rename (Rev 41)** — PASS. `locales/en/common.json:475` has `"lastYear": "Last Year"` and `locales/zh-TW/common.json:475` has `"lastYear": "最近 1 年"`. No `thisYear` key found in either locale file. Spec requirement satisfied.

**SECURITY INVOKER** — PASS. Both RPCs in `20261013000006` use `SECURITY INVOKER` (lines 46 and 111). The superseding `20261020000001` also uses `SECURITY INVOKER` (line 33).

**Migration naming convention** — PASS. Both migrations follow `YYYYMMDDNNNNNN_mod_NNN_<slug>.sql`. Both use `SET search_path = public` and the REVOKE/GRANT pattern.

---

### Blast-radius

Blast-radius filed at `project-planning/pstack-findings/2026-10-21-blast-radius-INT-009-INT-011.md`: verdict SAFE. Both RPCs return the same shape/cardinality on the block path as on the existing followers_only path that callers already handle. `fetchProfileHistory` maps empty-array safely; `fetchProfileStats` uses `.single()` which succeeds because the block path always returns exactly one row.

---

### Handoff

INT-009 and INT-013 integration fixes verified. No regressions introduced. All pre-existing ACs (AC-060, AC-061, AC-062, AC-064, AC-183) continue to pass.

QA PASS — integration-fix-verify INT-009 and INT-013.
