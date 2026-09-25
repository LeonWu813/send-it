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

/** Fields fetched for the match-before-create query. */
const ROUTE_MATCH_SELECT =
  'id, gym_id, section_label, grade, color_tag, photo_url, status, created_at';

/**
 * Search for existing ACTIVE routes at a gym with a matching grade + color.
 *
 * This is the first step in the match-before-create flow (AC-020).
 * The caller presents any matches to the user before proceeding with creation.
 * Query is explicitly scoped to status = 'active' so pending/retired/rejected
 * routes are excluded from the match pool.
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
 * Submit a new route via the submit_route SECURITY DEFINER RPC.
 *
 * The RPC enforces:
 *   - Caller must be authenticated (auth.uid() derived server-side).
 *   - One-pending-per-combo per submitter guard.
 *   - Auto-approve toggle: returns status='active' (auto-approve ON) or
 *     status='pending' (auto-approve OFF). The caller must check the returned
 *     status to display the correct confirmation copy.
 *
 * The photo must already be uploaded; pass the resulting URL as `input.photo_url`.
 *
 * @param input    Validated route submission payload.
 * @returns        The newly created Route row, including its status.
 * @throws {Error} with a user-facing message on failure.
 */
export async function submitRoute(input: RouteSubmitInput): Promise<Route> {
  const { data, error } = await supabase.rpc('submit_route', {
    p_gym_id: input.gym_id,
    p_grade: input.grade,
    p_color_tag: input.color_tag,
    p_photo_url: input.photo_url,
    p_section_label: input.section_label,
  });

  if (error) {
    // Unique constraint violation = duplicate active route at this gym+grade+color
    if (error.code === '23505') {
      throw new Error(
        'An active route with this grade and color already exists at this gym.',
      );
    }
    // Duplicate pending submission for same combo
    if (error.message?.includes('pending submission')) {
      throw new Error(
        'You already have a pending submission for this grade and color at this gym.',
      );
    }
    throw new Error('Failed to submit route. Please try again.');
  }

  return data as Route;
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
    throw new Error('Failed to load routes. Please try again.');
  }

  return (data as RouteSummary[]) ?? [];
}

// retireRoute has been removed. Route retirement is now admin-only via
// Supabase Studio (Phase 1). See RouteDetailScreen — the retire button
// has been removed accordingly (AC-024b).
