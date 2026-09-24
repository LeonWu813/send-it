/**
 * Gym Directory service — all Supabase data access for MOD-002.
 *
 * Rules:
 * - Uses the shared Supabase singleton from src/lib/supabase.ts.
 * - Gyms are read-only from the client; writes are admin-only via Studio.
 * - GymRequests are insertable by authenticated users.
 * - saved_gyms: INSERT and DELETE owned by MOD-002; SELECT scoped by RLS to
 *   auth.uid(). Table DDL is owned by MOD-012 migration.
 * - All errors are wrapped with user-facing messages before propagation.
 */

import { supabase } from '../../lib/supabase';
import type { Gym, GymRequestInput, GymSummary } from './types';

/** Fields fetched for the gym list. */
const GYM_SUMMARY_SELECT =
  'id, name, name_zh, branch_label, city, city_zh, district, district_zh, gym_type, photo_url';

/** Fields fetched for the gym detail page. */
const GYM_DETAIL_SELECT =
  'id, name, name_zh, branch_label, city, city_zh, district, district_zh, address_text, lat, lng, gym_type, photo_url, official_grading_system, bouldering_only_note, created_at, updated_at';

/**
 * Load all gyms for the directory list, ordered by city then name.
 *
 * @throws {Error} with a user-facing message on failure.
 */
export async function listGyms(): Promise<GymSummary[]> {
  const { data, error } = await supabase
    .from('gyms')
    .select(GYM_SUMMARY_SELECT)
    .order('city', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    throw new Error('Failed to load gyms. Please try again.');
  }

  return (data as GymSummary[]) ?? [];
}

/**
 * Load the full detail record for a single gym by ID.
 *
 * @param gymId  UUID of the gym to load.
 * @returns      The full `Gym` row, or null if not found.
 * @throws {Error} with a user-facing message on unexpected failure.
 */
export async function loadGym(gymId: string): Promise<Gym | null> {
  const { data, error } = await supabase
    .from('gyms')
    .select(GYM_DETAIL_SELECT)
    .eq('id', gymId)
    .single();

  if (error) {
    // PGRST116 = no rows found — return null, not an error
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error('Failed to load gym details. Please try again.');
  }

  return data as Gym;
}

// ── Saved Gyms (AC-120, AC-121, AC-122) ──────────────────────────────────────

/**
 * Returns the set of gym IDs the current user has saved.
 *
 * Uses RLS — only rows where user_id = auth.uid() are returned.
 * The `saved_gyms` table is created by the MOD-012 migration.
 *
 * @returns Array of gym ID strings (may be empty).
 * @throws {Error} with a user-facing message on unexpected failure.
 */
export async function fetchSavedGymIds(): Promise<string[]> {
  const { data, error } = await supabase
    .from('saved_gyms')
    .select('gym_id');

  if (error) {
    throw new Error('Failed to load saved gyms. Please try again.');
  }

  return ((data as { gym_id: string }[]) ?? []).map((row) => row.gym_id);
}

/**
 * Adds a gym to the current user's saved list.
 *
 * Inserts a row into `saved_gyms` for (auth.uid(), gymId).
 * RLS enforces that the user can only insert rows for their own user_id.
 * MOD-012 migration must have run before this is called.
 *
 * @param gymId UUID of the gym to save.
 * @throws {Error} so that the UI can revert the optimistic update on failure.
 */
export async function saveGym(gymId: string): Promise<void> {
  const { error } = await supabase
    .from('saved_gyms')
    .insert({ gym_id: gymId });

  if (error) {
    throw new Error('Failed to save gym. Please try again.');
  }
}

/**
 * Removes a gym from the current user's saved list.
 *
 * Deletes the (auth.uid(), gymId) row from `saved_gyms`.
 * RLS enforces that the user can only delete their own rows.
 *
 * @param gymId UUID of the gym to unsave.
 * @throws {Error} so that the UI can revert the optimistic update on failure.
 */
export async function unsaveGym(gymId: string): Promise<void> {
  const { error } = await supabase
    .from('saved_gyms')
    .delete()
    .eq('gym_id', gymId);

  if (error) {
    throw new Error('Failed to unsave gym. Please try again.');
  }
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Submit a "request a gym" form entry.
 *
 * Inserts a row into `gym_requests` with status = pending.
 * The admin reviews via Supabase Studio.
 *
 * @param userId   The authenticated user's UUID (from Supabase Auth session).
 * @param input    The gym request form data.
 * @throws {Error} with a user-facing message on failure.
 */
export async function submitGymRequest(
  userId: string,
  input: GymRequestInput,
): Promise<void> {
  const { error } = await supabase.from('gym_requests').insert({
    requested_by_user_id: userId,
    name: input.name.trim(),
    city: input.city.trim(),
    google_maps_url: input.google_maps_url?.trim() || null,
    status: 'pending',
  });

  if (error) {
    throw new Error('Failed to submit gym request. Please try again.');
  }
}
