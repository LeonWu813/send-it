/**
 * Route Catalog service — all Supabase data access for MOD-003.
 *
 * Rules:
 * - Uses the shared Supabase singleton from src/lib/supabase.ts.
 * - Routes are readable by all authenticated users.
 * - Route submission (INSERT) requires authentication; the submitting user's
 *   id must match submitted_by_user_id (enforced by RLS).
 * - Retirement (UPDATE status → 'retired') is allowed by any authenticated user.
 * - Photo uploads go to the 'route-photos' Supabase Storage bucket.
 * - All errors are wrapped with user-facing messages before propagation.
 */

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
  'id, gym_id, section_label, grade, color_tag, photo_url, match_key, status, submitted_by_user_id, created_at, retired_at, retired_by_user_id';

/** Fields fetched for the match-before-create query. */
const ROUTE_MATCH_SELECT =
  'id, gym_id, section_label, grade, color_tag, photo_url, status, created_at';

/**
 * Search for existing ACTIVE routes at a gym with a matching grade + color.
 *
 * This is the first step in the match-before-create flow (AC-020).
 * The caller presents any matches to the user before proceeding with creation.
 *
 * @param gymId    UUID of the gym.
 * @param grade    V-scale grade to match.
 * @param colorTag Hold/tape color to match.
 * @returns        Array of matching active RouteSummary rows (may be empty).
 * @throws {Error} with a user-facing message on failure.
 */
export async function findMatchingActiveRoutes(
  gymId: string,
  grade: RouteGrade,
  colorTag: string,
): Promise<RouteSummary[]> {
  const { data, error } = await supabase
    .from('routes')
    .select(ROUTE_MATCH_SELECT)
    .eq('gym_id', gymId)
    .eq('grade', grade)
    .eq('color_tag', colorTag)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error('Failed to check for existing routes. Please try again.');
  }

  return (data as RouteSummary[]) ?? [];
}

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

  // Fetch the local file as a Blob for upload
  const response = await fetch(localUri);
  if (!response.ok) {
    throw new Error('Failed to read the selected photo. Please try again.');
  }
  const blob = await response.blob();

  const { error: uploadError } = await supabase.storage
    .from('route-photos')
    .upload(storagePath, blob, {
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
 * Submit a new route row after the user has passed the match-before-create flow.
 *
 * The photo must already be uploaded; pass the resulting URL as `input.photo_url`.
 * The partial unique index on (gym_id, grade, color_tag) WHERE status = 'active'
 * prevents duplicate active routes at the database level.
 *
 * @param userId   The authenticated user's UUID (becomes submitted_by_user_id).
 * @param input    Validated route submission payload.
 * @returns        The newly created Route row.
 * @throws {Error} with a user-facing message on failure.
 */
export async function submitRoute(
  userId: string,
  input: RouteSubmitInput,
): Promise<Route> {
  const { data, error } = await supabase
    .from('routes')
    .insert({
      gym_id: input.gym_id,
      grade: input.grade,
      color_tag: input.color_tag,
      photo_url: input.photo_url,
      section_label: input.section_label,
      submitted_by_user_id: userId,
      status: 'active',
    })
    .select(ROUTE_DETAIL_SELECT)
    .single();

  if (error) {
    // Unique constraint violation = duplicate active route at this gym+grade+color
    if (error.code === '23505') {
      throw new Error(
        'An active route with this grade and color already exists at this gym.',
      );
    }
    throw new Error('Failed to submit route. Please try again.');
  }

  return data as Route;
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
    throw new Error('Failed to load route details. Please try again.');
  }

  return data as Route;
}

/**
 * List routes for a gym, filtered by grade and status.
 *
 * Defaults to active-only (AC-041). The caller can pass filters to override.
 *
 * @param gymId    UUID of the gym.
 * @param filters  Grade and status filter state.
 * @returns        Filtered array of RouteSummary rows.
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
    .eq('status', filters.status)
    .order('grade', { ascending: true })
    .order('created_at', { ascending: false });

  if (filters.grade !== null) {
    query = query.eq('grade', filters.grade);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error('Failed to load routes. Please try again.');
  }

  return (data as RouteSummary[]) ?? [];
}

/**
 * Retire a route — sets status = 'retired', retired_at = now(), retired_by_user_id = userId.
 *
 * Any authenticated user may retire any active route (AC-024).
 * The RLS policy enforces this server-side.
 *
 * @param routeId  UUID of the route to retire.
 * @param userId   The authenticated user's UUID (recorded as retired_by_user_id).
 * @throws {Error} with a user-facing message on failure.
 */
export async function retireRoute(
  routeId: string,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from('routes')
    .update({
      status: 'retired',
      retired_at: new Date().toISOString(),
      retired_by_user_id: userId,
    })
    .eq('id', routeId)
    .eq('status', 'active'); // Only allow retiring active routes

  if (error) {
    throw new Error('Failed to retire route. Please try again.');
  }
}
