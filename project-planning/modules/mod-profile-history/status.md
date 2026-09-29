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

<!-- Filled by qa-mod-profile-history agent -->
