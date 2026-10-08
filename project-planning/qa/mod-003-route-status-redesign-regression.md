# QA Regression — MOD-003 Route Status Redesign
**Date**: 2026-09-22
**Reviewer**: qa-mod-route-catalog
**Scope**: Static code review; no simulator run

---

## Migration A — `20260923000001_mod_003_route_status_enum.sql`

| Check | Result | Notes |
|---|---|---|
| Uses `ADD VALUE IF NOT EXISTS` (idempotent) | PASS | Both lines use `IF NOT EXISTS` |
| Does NOT use new values in the same file | PASS | File contains only two `ALTER TYPE` statements; no references to `'pending'` or `'rejected'` as values |

**Verdict: PASS**

---

## Migration B — `20260923000002_mod_003_route_approval_schema.sql`

| Check | Result | Notes |
|---|---|---|
| `app_settings` has RLS enabled | PASS | Line 18: `ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;` |
| `app_settings` has NO client policies | PASS | No `CREATE POLICY` on `app_settings` anywhere in the file |
| `app_settings` has NO grants to `authenticated` | PASS | No `GRANT ... ON public.app_settings TO authenticated` |
| `is_admin()` is STABLE | PASS | Line 34: `STABLE` |
| `is_admin()` is SECURITY INVOKER | PASS | Line 35: `SECURITY INVOKER` |
| `is_admin()` reads correct JWT path | **FAIL** | Migration line 38: `auth.jwt() ->> 'role'` reads from the **top-level** JWT claims. Spec (Key Implementation Notes, Admin Identity section) requires `COALESCE((auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin'` — i.e., reading from the nested `app_metadata` object. Phase 1.5 plan is to grant the claim via `app_metadata` set by service_role; the current implementation will never match because it reads the wrong key path. |
| `is_admin()` returns false for non-admin | PASS | `COALESCE(..., false)` ensures false on NULL |
| Old RLS policies dropped before new ones | PASS | Lines 44–46: all three original policy names dropped with `DROP POLICY IF EXISTS` |
| New SELECT policy matches spec | PASS | Lines 50–56: `status = 'active' OR (status = 'pending' AND submitted_by_user_id = auth.uid()) OR public.is_admin()` |
| No INSERT policy; `REVOKE INSERT ... FROM authenticated` present | PASS | Line 59: `REVOKE INSERT ON public.routes FROM authenticated;`; no INSERT policy created |
| UPDATE policy: `public.is_admin()` only | PASS | Lines 62–64 |
| `REVOKE UPDATE ON public.routes FROM authenticated` present | PASS | Line 75 |
| DELETE policy: `submitted_by_user_id = auth.uid() AND status = 'pending'` | PASS | Lines 67–69 |
| `GRANT DELETE ON public.routes TO authenticated` present | PASS | Line 72 |
| `submit_route` is SECURITY DEFINER | PASS | Line 93: `SECURITY DEFINER` |
| `submit_route` has `SET search_path = public` | PASS | Line 94 |
| `submit_route` does NOT accept `user_id` as parameter | PASS | Parameters are `p_gym_id, p_grade, p_color_tag, p_photo_url, p_section_label` only |
| `submit_route` derives identity from `auth.uid()` | PASS | Line 97: `v_user_id UUID := auth.uid()` |
| `submit_route` reads `app_settings` server-side | PASS | Lines 120–122 |
| `submit_route` checks one-pending-per-combo | PASS | Lines 108–116 |
| `submit_route` inserts with correct status | PASS | Line 124: ternary on `v_auto_approve = 'true'` |
| `submit_route` validates photo_url | **FAIL** | The spec (Key Implementation Notes, `submit_route` RPC section, step 2) requires: "Validate `p_photo_url` is not NULL/empty; raise exception if missing." There is no such check in the function body. The function proceeds to INSERT even if `p_photo_url` is NULL (the DB column is `NOT NULL` so Postgres will raise a generic error, but the RPC must raise a clean exception for the client to catch, per spec). |
| Partial unique index uses `WHERE status = 'pending'` | PASS | Lines 141–143 |
| Partial unique index includes `submitted_by_user_id` | PASS | Columns: `(gym_id, grade, color_tag, submitted_by_user_id) WHERE status = 'pending'` |
| `GRANT EXECUTE ON FUNCTION submit_route TO authenticated` present | PASS | Line 135 |

**Verdict: FAIL**
- **FAIL-B1** (line 38): `is_admin()` reads `auth.jwt() ->> 'role'` (top-level JWT claim) instead of the spec-required `auth.jwt() -> 'app_metadata' ->> 'role'`. Phase 1.5 admin grant is to `app_metadata.role`; this function will always return false even after Phase 1.5 promotion.
- **FAIL-B2** (no line — missing code): `submit_route` RPC does not validate `p_photo_url` is not NULL/empty before proceeding; the spec requires a clean exception at step 2 of the RPC logic.

---

## `types.ts`

| Check | Result | Notes |
|---|---|---|
| `RouteStatus` includes all 4 values | PASS | Line 22: `'active' \| 'pending' \| 'retired' \| 'rejected'` |
| `RouteListFilters` has `colorTag` (not `status`) | PASS | Lines 70–73: `{ grade: RouteGrade \| null; colorTag: RouteColor \| null }` |

**Verdict: PASS**

---

## `route-service.ts`

| Check | Result | Notes |
|---|---|---|
| `submitRoute()` calls `supabase.rpc('submit_route', {...})` | PASS | Lines 137–143 |
| `submitRoute()` does NOT pass `userId` or `user_id` to RPC | PASS | RPC call passes `p_gym_id, p_grade, p_color_tag, p_photo_url, p_section_label` only |
| `withdrawRoute(routeId)` added — calls `.delete().eq('id', routeId)` | PASS | Lines 173–182 |
| `retireRoute()` is fully removed | PASS | Comment at line 249 confirms removal; no function definition present |
| `listRoutes()` filters `status = 'active'` at DB level | PASS | Line 229: `.eq('status', 'active')` |
| Match check query (AC-020) scoped to `status = 'active'` only | PASS | Line 62: `.eq('status', 'active')` in `findMatchingActiveRoutes` |

**Verdict: PASS**

---

## `RouteListScreen.tsx`

| Check | Result | Notes |
|---|---|---|
| Text search `TextInput` removed | PASS | No `TextInput` component imported or rendered in this file |
| Active/retired status filter chips removed | PASS | No status filter rendered; filter state is only `gradeFilter` and `colorFilter` |
| Submit button removed from header | PASS | Header (lines 246–258) contains only a back link and gym name title |
| Grade filter chips remain | PASS | Lines 186–204: grade chips rendered from `availableGrades` |
| Hold-color filter chips added (all 9 colors) | PASS | Lines 197–204: `ROUTE_COLORS.map(renderColorChip)` renders all 9 colors |
| "Can't find it? Add a new route" CTA always visible at bottom | PASS | `addRouteCta` is passed as `ListFooterComponent` (line 265); it renders regardless of list content |
| `colorFilter` state added | PASS | Line 72: `const [colorFilter, setColorFilter] = useState<RouteColor \| null>(null)` |
| `filteredRoutes` filters by grade AND colorTag (not text search or status) | PASS | Lines 74–77: `filters` object contains only `grade` and `colorTag`; passed to `listRoutes()` which applies DB-level filtering |

**Verdict: PASS**

---

## `RouteSubmitScreen.tsx`

| Check | Result | Notes |
|---|---|---|
| Uses updated `submitRoute()` call | PASS | Lines 212–218: calls `submitRoute({ gym_id, grade, color_tag, photo_url, section_label })` |
| Handles `status === 'pending'`: shows approval message, navigates back to list | PASS | Lines 220–227: `if (newRoute.status === 'pending')` shows `t('routeCatalog.pendingApproval')` alert then calls `onBack()` |
| Handles `status === 'active'`: navigates to detail | PASS | Lines 229–231: `else` branch calls `onSuccess(newRoute.id)` |

**Verdict: PASS**

---

## `RouteDetailScreen.tsx`

| Check | Result | Notes |
|---|---|---|
| Retire button fully removed (no button, no handler, no state, no style) | PASS | No retire button, no `handleRetire` function, no retire-related state, no retire-action style in the file. The only retire-related code is the read-only `isRetired` display badge (line 136) and `retiredStatusBadge`/`retiredStatusText` styles, which are display-only and appropriate for showing admin-set retired status |

**Verdict: PASS**

---

## i18n — `locales/en/common.json`

| Check | Result | Notes |
|---|---|---|
| `routeCatalog.noResults` present | PASS | Line 130 |
| `routeCatalog.addRoute` present | PASS | Line 131 |
| `routeCatalog.pendingApproval` present | PASS | Line 132 |
| All 9 color name keys present | PASS | Lines 133–143: red, orange, yellow, green, blue, purple, pink, white, black |

**Verdict: PASS**

---

## i18n — `locales/zh-TW/common.json`

| Check | Result | Notes |
|---|---|---|
| `routeCatalog.noResults` present | PASS | Line 130: `"找不到符合的路線"` |
| `routeCatalog.addRoute` present | PASS | Line 131: `"找不到路線？新增一條"` |
| `routeCatalog.pendingApproval` present | PASS | Line 132: `"你的路線將在管理員審核後顯示"` |
| All 9 color name keys present | PASS | Lines 133–143: red through black |
| zh-TW values are Traditional Chinese (not Simplified) | PASS | Characters used are Traditional: 紅色, 橙色, 黃色, 綠色, 藍色, 紫色, 粉紅色, 白色, 黑色; other strings confirmed Traditional (e.g., 找不到, 管理員, 新增) |

**Verdict: PASS**

---

## `RouteSearchScreen.tsx` (mod-send-logging)

| Check | Result | Notes |
|---|---|---|
| `RouteListFilters` call updated to match new type shape (no `status` field) | PASS | Line 62: `listRoutes(trimmedGymId, { grade: null, colorTag: null })` — uses `colorTag`, not `status` |
| No TypeScript errors introduced | PASS | The call shape `{ grade: null, colorTag: null }` exactly matches the `RouteListFilters` interface in the updated `types.ts` |

**Verdict: PASS**

---

## Overall Verdict: FAIL

Two implementation bugs in `20260923000002_mod_003_route_approval_schema.sql` must be fixed before this redesign can be considered complete.

### Bug 1 — FAIL-B1 (line 38 of Migration B): `is_admin()` reads wrong JWT path

**File**: `/Users/tsan/Desktop/MacBookPro/send-it/supabase/migrations/20260923000002_mod_003_route_approval_schema.sql`, line 38

**Current**: `SELECT COALESCE((auth.jwt() ->> 'role') = 'admin', false)`

**Required**: `SELECT COALESCE((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)`

**Impact**: All admin-gated RLS policies (`routes_select_v2`, `routes_update_admin`) will never grant admin access in Phase 1.5 because the JWT claim will be placed under `app_metadata.role`, not the top-level `role` claim. This silently breaks admin visibility and the UPDATE path without any error.

**Classification**: Implementation bug — send to Engineer.

---

### Bug 2 — FAIL-B2 (missing code in `submit_route` RPC): No `p_photo_url` NULL/empty guard

**File**: `/Users/tsan/Desktop/MacBookPro/send-it/supabase/migrations/20260923000002_mod_003_route_approval_schema.sql`, `submit_route` function body (after line 106)

**Current**: No check for `p_photo_url` being NULL or empty.

**Required (per spec, `submit_route` RPC section step 2)**: `IF p_photo_url IS NULL OR p_photo_url = '' THEN RAISE EXCEPTION 'Photo is required'; END IF;`

**Impact**: A caller that somehow bypasses client-side AC-021 validation (e.g., via direct RPC call) can insert a route with a NULL or empty `photo_url`. Although the DB column is `NOT NULL` and will reject a NULL, an empty string `''` would be accepted silently. More importantly, the spec explicitly requires the RPC to perform this validation and raise a clean exception — not rely on the DB constraint for error signaling.

**Classification**: Implementation bug — send to Engineer.
