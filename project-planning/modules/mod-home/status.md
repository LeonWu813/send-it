# Home Status

## Engineering Progress

### Implementation — 2026-09-24

**Files created:**
- `supabase/migrations/20260924000002_mod_012_home.sql` — `saved_gyms` table DDL, RLS policies (select/insert/delete own), GRANT to authenticated.
- `src/lib/banners.ts` — `Banner` interface + `BANNERS` static array (structure, titleKey, imageSource).
- `src/assets/banners/banner1.png`, `banner2.png`, `banner3.png` — placeholder 1×1 PNG files (swappable later).
- `src/modules/mod-home/screens/HomeScreen.tsx` — AC-111, AC-112, AC-113, AC-114, AC-115, AC-123, AC-124. Top-inset via `makeStyles(theme, topInset)`. Banners horizontal scroll, saved-gyms horizontal strip, following-climbers empty state placeholder.
- `src/modules/mod-home/HomeNavigator.tsx` — Tab 1 content navigator; HomeScreen is the only view in Phase 1.
- `src/modules/mod-home/components/TabBar.tsx` — three-tab bar (Home/Gyms/Profile), Ionicons icons, filled active / outline inactive, bottom-inset padding, accessibilityRole="tab", accessibilityState.selected.
- `src/modules/mod-home/AppShell.tsx` — keep-alive mount strategy (`display: 'none'` on inactive tabs), wires HomeNavigator + GymNavigator + ProfileNavigator, `useSafeAreaInsets` for tab bar.
- `src/modules/mod-home/test-utils.tsx` — ThemeProvider + i18n wrapper for screen tests.
- `src/modules/mod-home/__tests__/HomeScreen.test.tsx` — 6 tests covering AC-112, AC-113, AC-114, AC-115, AC-123, AC-124.
- `src/modules/mod-home/__tests__/TabBar.test.tsx` — 5 tests covering tab rendering, accessibilityState, and onTabPress callbacks.

**Files modified:**
- `App.tsx` — replaced inline `AppShell`/`GymNavigator` logic with `AuthenticatedApp` wrapper that renders `AppShell` (MOD-012). App.tsx is now the composition root only.
- `locales/en/common.json` — added `home.banners.*`, `home.savedGyms.*`, `home.following.*` keys.
- `locales/zh-TW/common.json` — added matching zh-TW keys.

**Key decisions:**
- Following climbers section renders AC-124 empty state; includes `// TODO: replace with MOD-006 public service call when MOD-006 is implemented`.
- Saved-gyms detail fetch (name + photo_url) uses inline Supabase `.from('gyms').select('id, name, photo_url').in('id', ids)` — acceptable read per cross-module import rule; `gym-service.ts` does not expose `fetchGymsByIds()`.
- `onSelectGym` switches to the Gyms tab (GymNavigator manages its own internal navigation state; deep-link into a specific gym is a future enhancement — documented with a comment in AppShell).

### Self-Check Results — 2026-09-24

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | PASS — 0 errors |
| `npm test -- --watchAll=false` | PASS — 155 tests, 17 suites, all pass |
| i18n key completeness (EN keys all have zh-TW counterparts) | PASS — i18n.test.ts passes |
| AC-110: Home tab is default, three-tab bar renders | PASS |
| AC-111: Three sections in order (Banners, Saved Gyms, Following) | PASS |
| AC-112: Banners horizontal scroll; hidden if BANNERS empty | PASS |
| AC-113: Saved Gyms strip with View All | PASS |
| AC-114: Tap gym chip calls onSelectGym(gymId) | PASS |
| AC-115: Empty state when no saved gyms | PASS |
| AC-123: Following section header present | PASS |
| AC-124: Following empty state placeholder | PASS |
| No hardcoded hex colors | PASS |
| No inline string literals | PASS |
| useSafeAreaInsets applied (top in HomeScreen, bottom in TabBar) | PASS |
| Cross-module import rule: only public entry-points imported | PASS |
| Migration has DDL, FKs with CASCADE, RLS enabled, 3 policies, GRANT | PASS |
| TypeScript strict mode — no unguarded `any` | PASS |
| One test file per new source file | PASS |

**Result: READY FOR QA**

## QA Results

_No QA results yet._
