# MOD-012: Home — Spec

**Module ID**: MOD-012
**Module Name**: Home
**Phase**: 1
**Dependencies**: MOD-001, MOD-002, MOD-006
**Last Synced from PRD Revision**: 7

---

## Purpose

Own the persistent three-tab bottom navigation shell (Home / Gyms / Profile) and the Home tab surface. The Home surface renders three sections — a static banner strip, the user's saved gyms strip, and the climbers the user follows — and provides navigation from those sections into the gym detail and user profile surfaces.

---

## Context

Climbers who train at multiple gyms need quick access to all their saved gyms without a single fixed home gym. Climbers connected to the local scene want a landing surface that surfaces the gyms and people most relevant to them. Send It's Home screen addresses both needs by displaying saved gyms (from the `saved_gyms` join table) and followed climbers (from MOD-006's block-filtered public service) alongside static promotional banners. The app is organized around a persistent three-tab bottom navigation shell (Home, Gyms, Profile), with the Home tab as the default landing screen after login.

**US-019** (Save multiple gyms for quick access):
As a climber who trains at more than one gym, I want to bookmark any gym and have all my saved gyms available from the Home screen, so that I can quickly jump to the gyms I care about without a single fixed home gym.

**US-020** (See my saved gyms and followed climbers on a Home screen):
As a climber connected to the local scene, I want a Home screen that shows announcement banners, my saved gyms, and the climbers I follow, so that I have a single landing surface that surfaces the gyms and people most relevant to me.

**US-001** (Sign up and start using the app) applies implicitly because AC-001 (revised) specifies that on first run the app navigates the user directly to the Home tab — the Home tab is the default landing screen.

**Non-goals for this module:**
- Server-driven or dynamic banners in Phase 1 — banners are static and hardcoded in `src/lib/banners.ts`.
- A full activity feed on the Home screen — that is MOD-006's surface.
- The `saved_gyms` write operations (INSERT/DELETE) — owned by MOD-002.
- The gym detail screen — owned by MOD-002.
- The profile screen — owned by MOD-001.
- Cities other than Taipei and New Taipei (Phase 1 scope).
- Android support (Phase 2).

---

## Related User Stories

- US-019
- US-020

---

## Requirements

- The app shall present a persistent bottom tab bar with three icon-only tabs: Home (house icon), Gyms (climb icon), Profile (person icon). The Home tab is the default tab after login (AC-110).
- The Home screen shall render three sections in order: Banners, Saved Gyms, Following Climbers (AC-111).
- The Banners section shall display up to 3 static, hardcoded banner cards in a horizontal scroll. If no banners are defined, the section shall be hidden (AC-112).
- The Saved Gyms section shall display a horizontal scroll strip of the current user's saved gyms, each showing the gym's `photo_url` and name. A "View All" control shall navigate to the full gym list (MOD-002) (AC-113).
- Tapping a gym in the Saved Gyms strip shall navigate to that gym's detail screen (MOD-002) (AC-114).
- When the current user has no saved gyms, the Saved Gyms section shall display the prompt: "Tap the bookmark on any gym to save it." (AC-115).
- The Following Climbers section shall display a horizontal scroll strip of climbers the current user follows (sourced from MOD-006 public service), each showing avatar and display name. Tapping a climber shall navigate to that climber's profile (AC-123).
- When the current user follows no one, the Following Climbers section shall display an appropriate empty state (AC-124).

---

## Input / Output Contract

**Input:**
- Authenticated session (`user_id`)
- Saved gyms list (via `SELECT saved_gyms JOIN gyms WHERE user_id = auth.uid()` against the `saved_gyms` table created in the MOD-012 migration)
- Follow list (via MOD-006's block-filtered public service function)
- Static banner configuration (`src/lib/banners.ts`)

**Output:**
- Rendered Home screen (banners section, saved gyms strip, following climbers strip)
- Rendered persistent three-tab bottom navigation bar
- Navigation events to GymNavigator (Tab 2, MOD-002) and ProfileNavigator (Tab 3, MOD-001)

---

## Dependencies

- MOD-001 (ProfileNavigator entry point mounted as Tab 3)
- MOD-002 (GymNavigator entry point mounted as Tab 2; gym detail navigation from Saved Gyms strip; `saved_gyms` table write-owner for bookmark interactions)
- MOD-006 (block-filtered follow-list public service function for Following Climbers section)

---

## Acceptance Criteria

**AC-110** (new): The system shall present a persistent bottom tab bar with three icon-only tabs: Home (house icon), Gyms (climb icon), and Profile (person icon). The Home tab is the default tab after login.

**AC-111** (new): The Home screen shall render three sections in order: Banners, Saved Gyms, and Following Climbers.

**AC-112** (new): The Banners section shall display up to 3 static, hardcoded banner cards in a horizontal scroll. If no banners are defined, the section shall be hidden.

**AC-113** (new): The Saved Gyms section shall display a horizontal scroll strip of the current user's saved gyms, each showing the gym's `photo_url` and name. A "View All" control shall navigate to the full gym list (MOD-002).

**AC-114** (new): Tapping a gym in the Saved Gyms strip shall navigate to that gym's detail screen (MOD-002).

**AC-115** (new): When the current user has no saved gyms, the Saved Gyms section shall display the prompt: "Tap the bookmark on any gym to save it."

**AC-123** (new): The Following Climbers section shall display a horizontal scroll strip of the climbers the current user follows (sourced from MOD-006), each showing the climber's avatar and display name. Tapping a climber shall navigate to that climber's profile.

**AC-124** (new): When the current user follows no one, the Following Climbers section shall display an appropriate empty state.

---

## Integration Points

1. **AppShell mounts MOD-002's GymNavigator (Tab 2)**: MOD-002 engineer must expose `GymNavigator` as a public entry-point component. MOD-012 engineer implements `AppShell` and imports `GymNavigator`. MOD-002 engineer must confirm the navigator entry point is exposed before MOD-012 QA handoff.

2. **AppShell mounts MOD-001's ProfileNavigator (Tab 3)**: MOD-001 engineer must expose a `ProfileNavigator` entry-point component. MOD-012 engineer imports and mounts it. MOD-001 engineer must confirm the navigator entry point is exposed before MOD-012 QA handoff.

3. **Saved Gyms strip reads `saved_gyms` table**: MOD-012 engineer implements the read query (`SELECT saved_gyms JOIN gyms WHERE user_id = auth.uid()`) in `mod-home/home-service.ts`. The `saved_gyms` table is created in the MOD-012 migration — MOD-012 migration must run before MOD-002 can write to it. The write operations (INSERT/DELETE) on `saved_gyms` are owned by MOD-002 (see MOD-002 spec Integration Points). This is a shared-table access split by verb; both specs document the boundary.

4. **Following Climbers section reads follow data via MOD-006 public service**: MOD-012 must call MOD-006's public block-filtered service function to retrieve the followed-climbers list (avatar + display_name). MOD-012 must never query the `follows` table directly — that read must go through MOD-006's service to respect block-filtering composition (AC-082/AC-084). MOD-006 must be implemented before MOD-012 QA. In the interim, the Following Climbers section may stub behind the AC-124 empty state.

---

## Data Model (relevant tables)

```
SavedGym  (join table — a user's bookmarked gyms)
 - user_id (FK User, ON DELETE CASCADE), gym_id (FK Gym, ON DELETE CASCADE),
   created_at
 - PK: (user_id, gym_id)
```

MOD-012 owns the `SavedGym` DDL. The table is created in the MOD-012 migration file (e.g., `20260924000001_mod_012_home.sql`). This migration must run after migrations 001 (users) and 002 (gyms) since both FKs reference them.

RLS policy set for `saved_gyms`:
- SELECT `saved_gyms_select_own`: `USING (user_id = auth.uid())`
- INSERT `saved_gyms_insert_own`: `WITH CHECK (user_id = auth.uid())` (used by MOD-002 write operations)
- DELETE `saved_gyms_delete_own`: `USING (user_id = auth.uid())` (used by MOD-002 write operations)
- No UPDATE policy (unsave = DELETE, not UPDATE)

Grants: `GRANT SELECT, INSERT, DELETE ON public.saved_gyms TO authenticated;` (no UPDATE, no anon).

The composite PK `(user_id, gym_id)` is the only index needed — the leading `user_id` column covers the `WHERE user_id = auth.uid()` filter for the Home strip query. No separate single-column `user_id` index is required.

---

## Key Implementation Notes

- `AppShell` lives in `src/modules/mod-home/AppShell.tsx`. `App.tsx` imports and renders `AppShell` (replacing the current inline navigator selection in `App.tsx`). `App.tsx` remains the composition root (SafeAreaProvider → ThemeProvider → AuthNavigator → AppShell) but no longer contains navigator-selection logic.
- Tab state: `type TabKey = 'home' | 'gyms' | 'profile'`. State lives in `AppShell` as `const [activeTab, setActiveTab] = useState<TabKey>('home')`. Default is `'home'` (AC-110).
- Keep-alive mount: render all three tab subtrees simultaneously. Wrap each in a `View` whose style toggles `display: activeTab === key ? 'flex' : 'none'`. Do NOT use conditional unmount (loses navigation stack and scroll position). Do NOT use `flex: 0` (still lays out, can leak touch targets).
- Bottom safe area: the `TabBar` component calls `useSafeAreaInsets()` and applies `paddingBottom: insets.bottom` plus a spacing token to its container so touch targets clear the home indicator (see production.md "Bottom Safe Area for Pinned Bottom Bars" convention).
- Screens inside tabs whose content scrolls to the bottom must add tab-bar height plus `insets.bottom` to their `contentContainerStyle` `paddingBottom` so bottom content is not hidden behind the tab bar.
- Banner data lives in `src/lib/banners.ts` (structure/keys/image refs only). User-facing banner strings live in the i18n locale catalogs, not inlined in `banners.ts`.
- Cross-module import rule: `mod-home` may import only public service functions and navigator entry-point components from other modules. Never import from another module's `screens/` or `components/` subdirectories directly.
- The `saved_gyms` migration (`20260924000001_mod_012_home.sql`) must include: table DDL, both FK constraints with ON DELETE CASCADE, the three RLS policies, RLS enabled (`ALTER TABLE public.saved_gyms ENABLE ROW LEVEL SECURITY`), and the explicit GRANT (`GRANT SELECT, INSERT, DELETE ON public.saved_gyms TO authenticated`).
- The DROP COLUMN `home_gym_id` is a separate MOD-001-owned migration. MOD-012 migration does not need to reference it.
- MOD-006 must ship its public block-filtered follow-list service function before MOD-012 can wire the Following Climbers section. Until MOD-006 ships, that section remains in the AC-124 empty state.

---

## Out of Scope for This Module

- Server-driven or dynamic banners in Phase 1 (banners are static/hardcoded).
- A full activity feed (owned by MOD-006).
- The `saved_gyms` INSERT/DELETE write operations (owned by MOD-002).
- The gym detail screen (owned by MOD-002).
- The profile screen content (owned by MOD-001).
- The send history surface (owned by MOD-008, embedded by MOD-001).
- Android support (Phase 2).
- Cities other than Taipei and New Taipei (Phase 1 scope).
