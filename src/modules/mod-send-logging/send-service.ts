/**
 * Send Logging service — all Supabase data access for MOD-004.
 *
 * Rules:
 * - Uses the shared Supabase singleton from src/lib/supabase.ts.
 * - Grade is NEVER stored on an ascent. Never add a grade column.
 * - Ascents are inserted with the authenticated user's ID (RLS-enforced).
 * - Reading ascents for a route includes public ascents from all users
 *   plus the current user's own private ascents (enforced by RLS).
 * - All errors are wrapped with user-facing messages before propagation.
 */

import { supabase } from '../../lib/supabase';
import type { Ascent, AscentLogInput, AscentWithProfile } from './types';

/** Fields selected for the ascent list on a route detail page. */
const ASCENT_LIST_SELECT =
  'id, user_id, route_id, style, attempts, note, logged_at, is_private, users(display_name)';

/**
 * Log a new ascent (send) for the authenticated user.
 *
 * Grade is never stored — pass only the fields in AscentLogInput.
 * On any network or DB failure, throws an Error with a user-facing message.
 *
 * @param userId  The authenticated user's UUID (RLS enforces this matches auth.uid()).
 * @param input   Validated ascent input payload.
 * @returns       The newly created Ascent row.
 * @throws {Error} with a user-facing message on failure.
 */
export async function logAscent(
  userId: string,
  input: AscentLogInput,
): Promise<Ascent> {
  const { data, error } = await supabase
    .from('ascents')
    .insert({
      user_id: userId,
      route_id: input.route_id,
      style: input.style,
      attempts: input.attempts,
      note: input.note,
      logged_at: input.logged_at,
      is_private: input.is_private,
    })
    .select('id, user_id, route_id, style, attempts, note, logged_at, is_private')
    .single();

  if (error) {
    throw new Error('Failed to save your send. Please check your connection and try again.');
  }

  return data as Ascent;
}

/**
 * Load all visible ascents for a route, most recent first.
 *
 * Returns the current user's own ascents (including private) plus all public
 * ascents from other users. RLS enforces visibility server-side.
 *
 * The result includes the display_name of each ascent's author via a join
 * on the `users` table so the route detail screen can render the username.
 *
 * @param routeId  UUID of the route.
 * @returns        Array of AscentWithProfile rows ordered by logged_at descending.
 * @throws {Error} with a user-facing message on failure.
 */
export async function loadAscentsForRoute(
  routeId: string,
): Promise<AscentWithProfile[]> {
  const { data, error } = await supabase
    .from('ascents')
    .select(ASCENT_LIST_SELECT)
    .eq('route_id', routeId)
    .order('logged_at', { ascending: false });

  if (error) {
    throw new Error('Failed to load sends for this route. Please try again.');
  }

  if (!data) {
    return [];
  }

  // Flatten the nested users join into a flat AscentWithProfile shape.
  return data.map((row) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase join shape is untyped at runtime
    const usersJoin = (row as any).users;
    const displayName: string =
      usersJoin?.display_name ?? usersJoin?.[0]?.display_name ?? 'Unknown';
    return {
      id: row.id as string,
      user_id: row.user_id as string,
      route_id: row.route_id as string,
      style: row.style as AscentWithProfile['style'],
      attempts: row.attempts as number,
      note: row.note as string | null,
      logged_at: row.logged_at as string,
      is_private: row.is_private as boolean,
      display_name: displayName,
    };
  });
}
