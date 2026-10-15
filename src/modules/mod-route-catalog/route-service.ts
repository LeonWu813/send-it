/**
 * Route Catalog service — all Supabase data access for MOD-003.
 *
 * Rules:
 * - Uses the shared Supabase singleton from src/lib/supabase.ts.
 * - Active routes are readable by all authenticated users.
 * - Route submission goes through the submit_route SECURITY DEFINER RPC;
 *   the client never inserts directly into routes.
 * - Pending route withdrawal: client calls DELETE directly; enforced by RLS
 *   (submitted_by_user_id = auth.uid() AND status = 'pending').
 * - Route retirement is admin-only via Supabase Studio (Phase 1).
 * - Photo uploads go to the 'route-photos' Supabase Storage bucket.
 * - All errors are wrapped with user-facing messages before propagation.
 */

import { File as ExpoFile } from 'expo-file-system';

import { supabase } from '../../lib/supabase';
import type {
  Route,
  RouteGrade,
  RouteListFilters,
  RouteSubmitInput,
  RouteSummary,
} from './types';

/** Fields fetched for the route list. */
const ROUTE_SUMMARY_SELECT =
  'id, gym_id, section_label, grade, color_tag, photo_url, status, created_at';

/** Fields fetched for the route detail page. */
const ROUTE_DETAIL_SELECT =
  'id, gym_id, section_label, grade, color_tag, photo_url, status, submitted_by_user_id, created_at, retired_at, retired_by_user_id';

/**
 * Upload a route photo to Supabase Storage and return the public URL.
 *
 * Photos are stored in the `route-photos` bucket under a path keyed by
 * userId and a timestamp to avoid collisions.
 *
 * @param userId     The authenticated user's UUID (used for path scoping).
 * @param localUri   The local file URI (e.g. from expo-image-picker).
 * @param mimeType   MIME type of the photo file (e.g. 'image/jpeg').
 * @returns          The public URL of the uploaded photo.
 * @throws {Error}   with a user-facing message on failure.
 */
export async function uploadRoutePhoto(
  userId: string,
  localUri: string,
  mimeType: string,
): Promise<string> {
  // Build a unique storage path: userId/timestamp-<random>.ext
  const ext = mimeType.split('/')[1] ?? 'jpg';
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).slice(2, 8);
  const storagePath = `${userId}/${timestamp}-${randomSuffix}.${ext}`;

  // Read the local file as raw bytes using expo-file-system's File class.
  // The fetch-then-blob approach is unreliable in React Native / Expo SDK 57
  // (triggers a "using React Native's Blob" warning and causes upload failures).
  // File.bytes() returns a Uint8Array directly — no base64 detour, no fetch
  // corruption risk. See production.md Shared Conventions for the full rule.
  const expoFile = new ExpoFile(localUri);
  const uint8Array = await expoFile.bytes();

  const { error: uploadError } = await supabase.storage
    .from('route-photos')
    .upload(storagePath, uint8Array, {
      contentType: mimeType,
      upsert: false,
    });

  if (uploadError) {
    throw new Error('Failed to upload photo. Please try again.');
  }

  const { data: urlData } = supabase.storage
    .from('route-photos')
    .getPublicUrl(storagePath);

  return urlData.publicUrl;
}

/**
 * Extended return type for submitRoute — adds has_duplicate advisory flag.
 * This flag is local to this service; it is not a column in the routes table.
 */
export type RouteWithDuplicateFlag = Route & { has_duplicate: boolean };

/**
 * Submit a new route via the submit_route SECURITY DEFINER RPC.
 *
 * Rev 37: duplicate routes are allowed by design (AC-020). The 23505 unique-
 * constraint error path is removed — the database no longer enforces uniqueness
 * on (gym_id, grade, color_tag). After a successful insert, calls the
 * check_route_duplicate RPC to determine whether another active route with the
 * same combo already exists. The caller uses the returned `has_duplicate` flag
 * to display a non-blocking soft warning (AC-187) without blocking navigation.
 *
 * The RPC enforces:
 *   - Caller must be authenticated (auth.uid() derived server-side).
 *   - Auto-approve toggle: returns status='active' (auto-approve ON) or
 *     status='pending' (auto-approve OFF). The caller must check the returned
 *     status to display the correct confirmation copy.
 *
 * The photo must already be uploaded; pass the resulting URL as `input.photo_url`.
 *
 * @param input    Validated route submission payload.
 * @returns        The newly created Route row plus `has_duplicate` advisory flag.
 * @throws {Error} with a user-facing message on failure.
 */
export async function submitRoute(input: RouteSubmitInput): Promise<RouteWithDuplicateFlag> {
  const { data, error } = await supabase.rpc('submit_route', {
    p_gym_id: input.gym_id,
    p_grade: input.grade,
    p_color_tag: input.color_tag,
    p_photo_url: input.photo_url,
    p_section_label: input.section_label,
  });

  if (error) {
    throw new Error('Failed to submit route. Please try again.');
  }

  const route = data as Route;

  // AC-187 (Rev 37): non-blocking duplicate advisory check.
  // Call check_route_duplicate after a successful insert to see whether another
  // active route with the same (gym_id, grade, color_tag) exists (excluding the
  // just-inserted row). Errors are treated as "no duplicate" — this is advisory
  // only and must never block the submission flow.
  let has_duplicate = false;
  if (route.status === 'active') {
    const { data: dupData, error: dupError } = await supabase.rpc(
      'check_route_duplicate',
      {
        p_gym_id: input.gym_id,
        p_grade: input.grade,
        p_color_tag: input.color_tag,
        p_exclude_route_id: route.id,
      },
    );
    if (!dupError) {
      has_duplicate = dupData === true;
    }
  }

  return { ...route, has_duplicate };
}

/**
 * Check whether an active route with the same grade and color already exists at the gym.
 *
 * AC-187 (Rev 37): called by RouteSubmitScreen before (or after) submission to determine
 * whether a non-blocking soft warning should be displayed. Returns true when at least one
 * active route with the same (gym_id, grade, color_tag) exists; false otherwise.
 *
 * Fail-open: on query error, returns false — the check is advisory only and must never
 * block the submission flow.
 *
 * @param gymId     UUID of the gym.
 * @param grade     V-scale grade string (e.g. 'V3').
 * @param colorTag  Hold/tape color enum value (e.g. 'blue').
 * @returns         true when a duplicate active route exists; false otherwise or on error.
 */
export async function checkDuplicateActiveRoute(
  gymId: string,
  grade: string,
  colorTag: string,
): Promise<boolean> {
  const { count, error } = await supabase
    .from('routes')
    .select('id', { count: 'exact', head: true })
    .eq('gym_id', gymId)
    .eq('grade', grade)
    .eq('color_tag', colorTag)
    .eq('status', 'active');

  if (error) {
    console.error('[checkDuplicateActiveRoute] error:', error);
    return false; // fail-open: don't block submission on check failure
  }
  return (count ?? 0) > 0;
}

/**
 * Withdraw (delete) a user's own pending route.
 *
 * The RLS DELETE policy enforces that only the submitter of their own
 * pending route can perform this operation. No RPC needed.
 *
 * @param routeId  UUID of the pending route to withdraw.
 * @throws {Error} with a user-facing message on failure.
 */
export async function withdrawRoute(routeId: string): Promise<void> {
  const { error } = await supabase
    .from('routes')
    .delete()
    .eq('id', routeId);

  if (error) {
    console.error('[withdrawRoute] error:', error);
    throw new Error('Failed to withdraw route. Please try again.');
  }
}

/**
 * Generate a signed URL for a route photo stored in the private
 * `route-photos` Supabase Storage bucket.
 *
 * The `photo_url` column stores the output of `getPublicUrl()`, which is a
 * full URL of the form:
 *   `{supabaseUrl}/storage/v1/object/public/route-photos/{storagePath}`
 *
 * Since the bucket is private, that URL is inaccessible. This function
 * extracts the storage path from the stored URL and generates a signed URL
 * valid for 1 hour.
 *
 * @param photoUrl  The value stored in `routes.photo_url` (a full storage URL).
 * @returns         A signed URL valid for 1 hour.
 * @throws {Error}  with a user-facing message on failure.
 */
export async function getPhotoSignedUrl(photoUrl: string): Promise<string> {
  // Extract the storage path by stripping everything up to and including
  // "/object/public/route-photos/" from the stored URL.
  const BUCKET_PREFIX = '/object/public/route-photos/';
  const prefixIndex = photoUrl.indexOf(BUCKET_PREFIX);
  if (prefixIndex === -1) {
    throw new Error('Failed to load route photo. Please try again.');
  }
  const storagePath = photoUrl.slice(prefixIndex + BUCKET_PREFIX.length);

  const { data, error } = await supabase.storage
    .from('route-photos')
    .createSignedUrl(storagePath, 3600);

  if (error || !data?.signedUrl) {
    throw new Error('Failed to load route photo. Please try again.');
  }

  return data.signedUrl;
}

/**
 * Load the full detail record for a single route by ID.
 *
 * @param routeId  UUID of the route to load.
 * @returns        The full `Route` row, or null if not found.
 * @throws {Error} with a user-facing message on unexpected failure.
 */
export async function loadRoute(routeId: string): Promise<Route | null> {
  const { data, error } = await supabase
    .from('routes')
    .select(ROUTE_DETAIL_SELECT)
    .eq('id', routeId)
    .single();

  if (error) {
    // PGRST116 = no rows found — return null, not an error
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('[loadRoute] error:', error);
    throw new Error('Failed to load route details. Please try again.');
  }

  return data as Route;
}

/**
 * List active routes for a gym, filtered by grade and/or hold color.
 *
 * Always scoped to status = 'active' (AC-041). Normal users only see active
 * routes in the gym route list — no status filter is exposed to them.
 *
 * @param gymId    UUID of the gym.
 * @param filters  Grade and color filter state.
 * @returns        Filtered array of active RouteSummary rows.
 * @throws {Error} with a user-facing message on failure.
 */
export async function listRoutes(
  gymId: string,
  filters: RouteListFilters,
): Promise<RouteSummary[]> {
  let query = supabase
    .from('routes')
    .select(ROUTE_SUMMARY_SELECT)
    .eq('gym_id', gymId)
    .eq('status', 'active')
    .order('grade', { ascending: true })
    .order('created_at', { ascending: false });

  if (filters.grade !== null) {
    query = query.eq('grade', filters.grade);
  }

  if (filters.colorTag !== null) {
    query = query.eq('color_tag', filters.colorTag);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[listRoutes] error:', error);
    throw new Error('Failed to load routes. Please try again.');
  }

  return (data as RouteSummary[]) ?? [];
}

// retireRoute has been removed. Route retirement is now admin-only via
// Supabase Studio (Phase 1). See RouteDetailScreen — the retire button
// has been removed accordingly (AC-024b).

// ── Saved Routes (AC-046, AC-047) ────────────────────────────────────────────

/**
 * Returns the set of route IDs the current user has saved.
 *
 * Uses RLS — only rows where user_id = auth.uid() are returned.
 * Called once per screen load; never called per row (no N+1).
 *
 * @returns Array of route ID strings (may be empty).
 * @throws {Error} with a user-facing message on unexpected failure.
 */
export async function fetchSavedRouteIds(): Promise<string[]> {
  const { data, error } = await supabase
    .from('saved_routes')
    .select('route_id');

  if (error) {
    throw new Error('Failed to load saved routes. Please try again.');
  }

  return ((data as { route_id: string }[]) ?? []).map((row) => row.route_id);
}

/**
 * Adds a route to the current user's saved list.
 *
 * Inserts a row into `saved_routes` for (auth.uid(), routeId).
 * RLS enforces that the user can only insert rows for their own user_id.
 *
 * @param routeId UUID of the route to save.
 * @throws {Error} so that the UI can revert the optimistic update on failure.
 */
export async function saveRoute(routeId: string): Promise<void> {
  const { error } = await supabase
    .from('saved_routes')
    .insert({ route_id: routeId });

  if (error) {
    console.error('[saveRoute] error:', error);
    throw new Error('Failed to save route. Please try again.');
  }
}

/**
 * Removes a route from the current user's saved list.
 *
 * Deletes the (auth.uid(), routeId) row from `saved_routes`.
 * RLS enforces that the user can only delete their own rows.
 *
 * @param routeId UUID of the route to unsave.
 * @throws {Error} so that the UI can revert the optimistic update on failure.
 */
export async function unsaveRoute(routeId: string): Promise<void> {
  const { error } = await supabase
    .from('saved_routes')
    .delete()
    .eq('route_id', routeId);

  if (error) {
    console.error('[unsaveRoute] error:', error);
    throw new Error('Failed to unsave route. Please try again.');
  }
}

// ── Route visit tracking (AC-179) ─────────────────────────────────────────────

/**
 * Upserts a visit row for the current user + route into `user_route_visits`,
 * setting `last_viewed_at` to now().
 *
 * This is a fire-and-forget call — it is never awaited on the critical path.
 * The RLS INSERT + UPDATE own-rows policies enforce that each user can only
 * upsert their own rows.  Supabase's PostgREST upsert resolves the conflict
 * on the composite PK (user_id, route_id).
 *
 * AC-179: backs the "new beta video" tag (AC-180) and most-recently-viewed
 * ordering (AC-175, via the route's gym).
 *
 * Errors are intentionally swallowed — this is a non-critical background write.
 *
 * @param routeId UUID of the route that was opened.
 */
export function upsertRouteVisit(routeId: string): void {
  void Promise.resolve(
    supabase
      .from('user_route_visits')
      .upsert(
        { route_id: routeId, last_viewed_at: new Date().toISOString() },
        { onConflict: 'user_id,route_id' },
      ),
  ).catch(() => {
    // Intentionally swallow — non-critical background write.
  });
}

// ── New-beta tag (AC-180) ─────────────────────────────────────────────────────

/**
 * Returns the subset of `routeIds` for which the current user has at least one
 * visible beta video newer than their `user_route_visits.last_viewed_at`, or
 * for which no visit row exists at all (never visited).
 *
 * Delegates to the `routes_with_new_beta` SECURITY INVOKER RPC, which composes
 * the full beta-video visibility rules (AC-142, AC-154, AC-158) server-side.
 * Called once per gym screen load — not per route card (no N+1).
 *
 * AC-180: "new beta video" tag qualification logic.
 *
 * @param routeIds  Array of route UUIDs to check (all visible routes on screen).
 * @returns         Array of route UUIDs that qualify for the "new beta" tag.
 *                  Returns [] on error — non-fatal: tag simply does not appear.
 */
export async function fetchRoutesWithNewBeta(routeIds: string[]): Promise<string[]> {
  if (routeIds.length === 0) return [];
  const { data, error } = await supabase.rpc('routes_with_new_beta', {
    route_ids: routeIds,
  });
  if (error) {
    console.error('[fetchRoutesWithNewBeta] error:', error);
    return []; // non-fatal: fall back to no tags
  }
  return (data ?? []).map((row: { route_id: string }) => row.route_id);
}
