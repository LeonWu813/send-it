/**
 * home-service.ts — Data-access layer for the Home screen (MOD-012).
 *
 * Owns:
 *   - `fetchSavedGym(userId)` — Saved Gyms strip query (AC-113, AC-175).
 *   - `fetchProjectingRoutes(savedRouteIds)` — Projecting Routes query (AC-177).
 *   - `newBetaCache` singleton (module-scoped, unexported) — cache for the
 *     `routes_with_new_beta` RPC result, keyed by route-id set + timestamp.
 *   - `clearCache()` — exported for test use; clears the in-memory new-beta cache.
 *
 * All Supabase queries follow the Log Raw Supabase Error Before Throwing convention
 * (production.md): `console.error('[fnName] error:', error)` before throwing.
 */

import { supabase } from '../../lib/supabase';
import type { RouteGrade } from '../mod-route-catalog';

// ── Types ─────────────────────────────────────────────────────────────────────

/** Minimal gym shape for the Saved Gyms strip. */
export interface SavedGymItem {
  id: string;
  name: string;
  photo_url: string | null;
  /** Google Places cover photo (Rev 44). Null = initials avatar fallback. */
  cover_photo_url: string | null;
  /** MAX last_viewed_at for this gym from user_route_visits; null = no visits. */
  lastViewedAt: string | null;
}

/** Route row for the Projecting Routes section. */
export interface ProjectingRoute {
  id: string;
  gym_id: string;
  grade: RouteGrade;
  color_tag: string;
  photo_url: string | null;
  section_label: string | null;
  gym_name: string | null;
}

// ── Internal cache types ───────────────────────────────────────────────────────

interface NewBetaCache {
  /** Route IDs that have a new beta video (Set for O(1) lookup). */
  data: Set<string>;
  /** Timestamp when this cache entry was populated. */
  populatedAt: number;
  /**
   * Stable key derived from the route-id set this cache entry was computed for.
   * Formed by sorting the route IDs and joining with ','.
   * A cache hit is only valid when the current route-id set produces the same key.
   */
  routeIdsKey: string;
}

// Module-level cache for routes_with_new_beta RPC results.
// Unexported — tests use clearCache() instead of touching this directly.
let newBetaCache: NewBetaCache | null = null;

/** Clear the in-memory new-beta RPC cache. Exported for test use. */
export function clearCache(): void {
  newBetaCache = null;
}

// ── fetchSavedGym ──────────────────────────────────────────────────────────────

/**
 * Fetches the current user's saved gyms, ordered by most-recently-viewed first
 * (AC-175). Recency is derived from `user_route_visits.last_viewed_at` via a
 * per-gym MAX aggregation in JavaScript over the visit rows.
 *
 * When a saved gym has no associated route visits, it still appears in the
 * result, ordered after gyms that do have recency data (AC-175).
 *
 * The recency aggregation uses JavaScript (MAX over already-fetched rows) rather
 * than a SQL MAX/GROUP BY, because the `user_route_visits` table does not expose
 * a per-gym aggregate RPC in Phase 1. The JS aggregation is correct and matches
 * the spec's "batched-fetch + JS-group pattern is correct and must be preserved"
 * note from production.md §AC-182.
 *
 * TODO: move the MAX(last_viewed_at) aggregation to SQL/RPC if an owning RPC is
 * shipped by MOD-003 (would eliminate the two-query pattern for gym recency).
 */
export async function fetchSavedGym(userId: string): Promise<SavedGymItem[]> {
  // Step 1: Fetch saved gyms joined with gym details.
  const { data: savedRows, error: savedError } = await supabase
    .from('saved_gyms')
    .select('gym_id, gyms(id, name, photo_url, cover_photo_url)')
    .eq('user_id', userId);

  if (savedError) {
    console.error('[fetchSavedGym] saved_gyms error:', savedError);
    throw new Error('Failed to load saved gyms. Please try again.');
  }

  if (!savedRows || savedRows.length === 0) {
    return [];
  }

  type SavedRow = {
    gym_id: string;
    gyms: { id: string; name: string; photo_url: string | null; cover_photo_url: string | null } | null;
  };

  const typedRows = savedRows as unknown as SavedRow[];
  const validRows = typedRows.filter((r) => r.gyms !== null);

  if (validRows.length === 0) {
    return [];
  }

  const gymIds = validRows.map((r) => r.gym_id);

  // Step 2: Fetch recency data — MAX(last_viewed_at) per gym via user_route_visits → routes.
  // Query is user-scoped; gymIds filter narrows the JS aggregation to saved gyms only.
  let recencyMap: Map<string, string> = new Map();

  const { data: visitRows, error: visitError } = await supabase
    .from('user_route_visits')
    .select('last_viewed_at, routes(gym_id)')
    .eq('user_id', userId);

  if (!visitError && visitRows) {
    type VisitRow = { last_viewed_at: string; routes: { gym_id: string } | null };
    for (const row of visitRows as unknown as VisitRow[]) {
      if (!row.routes) continue;
      const gId = row.routes.gym_id;
      if (!gymIds.includes(gId)) continue;
      const existing = recencyMap.get(gId);
      if (existing === undefined || row.last_viewed_at > existing) {
        recencyMap.set(gId, row.last_viewed_at);
      }
    }
  }
  // On visitError: recencyMap stays empty — gyms still render, no ordering data.

  // Step 3: Build SavedGymItem list.
  const gymItems: SavedGymItem[] = validRows.map((r) => ({
    id: r.gyms!.id,
    name: r.gyms!.name,
    photo_url: r.gyms!.photo_url,
    cover_photo_url: r.gyms!.cover_photo_url,
    lastViewedAt: recencyMap.get(r.gym_id) ?? null,
  }));

  // Sort: gyms with recency data first (descending), then gyms without (AC-175).
  gymItems.sort((a, b) => {
    if (a.lastViewedAt === null && b.lastViewedAt === null) return 0;
    if (a.lastViewedAt === null) return 1;
    if (b.lastViewedAt === null) return -1;
    return b.lastViewedAt.localeCompare(a.lastViewedAt);
  });

  return gymItems;
}

// ── fetchProjectingRoutes ─────────────────────────────────────────────────────

/**
 * Fetches route details for the given saved route IDs from the `routes` table.
 * Only returns rows with `status = 'active'`.
 *
 * Called by HomeScreen after MOD-003's `fetchSavedRouteIds()` returns the IDs.
 * The caller is responsible for the `fetchSavedRouteIds` call — this function
 * takes the already-fetched IDs to keep steps 1 and 2 separately testable.
 */
export async function fetchProjectingRoutes(
  savedRouteIds: string[],
): Promise<ProjectingRoute[]> {
  if (savedRouteIds.length === 0) {
    return [];
  }

  const { data: routeRows, error: routeError } = await supabase
    .from('routes')
    .select('id, gym_id, grade, color_tag, photo_url, section_label, gyms!routes_gym_id_fkey(name)')
    .in('id', savedRouteIds)
    .eq('status', 'active');

  if (routeError) {
    console.error('[fetchProjectingRoutes] routes error:', routeError);
    throw new Error('Failed to load projecting routes. Please try again.');
  }

  type RouteRow = {
    id: string;
    gym_id: string;
    grade: RouteGrade;
    color_tag: string;
    photo_url: string | null;
    section_label: string | null;
    gyms: { name: string } | null;
  };

  return ((routeRows as unknown as RouteRow[]) ?? []).map((row) => ({
    id: row.id,
    gym_id: row.gym_id,
    grade: row.grade,
    color_tag: row.color_tag,
    photo_url: row.photo_url,
    section_label: row.section_label,
    gym_name: row.gyms?.name ?? null,
  }));
}

// ── newBetaCache helpers ───────────────────────────────────────────────────────

/** Cache TTL for `routes_with_new_beta` RPC results (milliseconds). */
const NEW_BETA_CACHE_TTL_MS = 60_000;

/**
 * Returns the cached `routes_with_new_beta` result if valid, or null on miss.
 * A cache hit requires both the route-id set key and the TTL to match.
 */
export function getNewBetaCache(routeIdsKey: string): Set<string> | null {
  if (
    newBetaCache !== null &&
    newBetaCache.routeIdsKey === routeIdsKey &&
    Date.now() - newBetaCache.populatedAt < NEW_BETA_CACHE_TTL_MS
  ) {
    return newBetaCache.data;
  }
  return null;
}

/**
 * Stores a `routes_with_new_beta` result in the module-level cache.
 */
export function setNewBetaCache(routeIdsKey: string, data: Set<string>): void {
  newBetaCache = { data, populatedAt: Date.now(), routeIdsKey };
}

// ── fetchRoutesWithNewBeta ─────────────────────────────────────────────────────

/**
 * Calls the `routes_with_new_beta` RPC and returns a Set of route IDs that
 * have at least one new beta video. Results are cached in-memory for 60 seconds
 * (keyed by the sorted route-id set) to avoid redundant RPC calls on tab switch.
 *
 * Retained for AC-175 Saved Gyms ordering; the "new beta" chip was removed from
 * RouteCard in AC-181 Rev 39, but the backing data is still needed.
 *
 * @param savedRouteIds - Route IDs to check. Returns an empty Set when empty.
 * @throws {Error} when the Supabase RPC call fails.
 */
export async function fetchRoutesWithNewBeta(savedRouteIds: string[]): Promise<Set<string>> {
  if (savedRouteIds.length === 0) {
    return new Set();
  }

  const routeIdsKey = savedRouteIds.slice().sort().join(',');
  const cached = getNewBetaCache(routeIdsKey);
  if (cached !== null) {
    return cached;
  }

  const { data, error } = await supabase.rpc('routes_with_new_beta', {
    route_ids: savedRouteIds,
  });

  if (error) {
    console.error('[fetchRoutesWithNewBeta] routes_with_new_beta error:', error);
    throw new Error('Failed to load new beta route data.');
  }

  const ids = new Set<string>(
    ((data as Array<{ route_id: string }>) ?? []).map((r) => r.route_id),
  );
  setNewBetaCache(routeIdsKey, ids);
  return ids;
}
