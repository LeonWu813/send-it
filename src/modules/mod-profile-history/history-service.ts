/**
 * Profile History & Stats service — all Supabase data access for MOD-008.
 *
 * Rules:
 * - Uses the shared Supabase singleton from src/lib/supabase.ts.
 * - Grade is NEVER read from ascents — always joined from routes.grade via RPC.
 * - Privacy enforcement is server-side (RPC-level), not client-only.
 * - All errors are wrapped with user-facing messages before propagation.
 */

import { supabase } from '../../lib/supabase';
import type {
  GradeCount,
  HistoryAscent,
  HistoryFilters,
  ProfileStats,
} from './types';
import { GRADE_ORDER } from './types';

// ── Constants ──────────────────────────────────────────────────────────────────

/** Default page size for history queries. */
const DEFAULT_PAGE_SIZE = 50;

// ── History fetch ──────────────────────────────────────────────────────────────

/**
 * Fetch paginated send history for a user via the `get_profile_history` RPC.
 *
 * Privacy: server-side enforcement inside the RPC. If the target user has
 * `followers_only` privacy and the caller is not a follower, returns [].
 *
 * Grade is joined from routes.grade inside the RPC — never stored on ascents.
 *
 * @param userId   UUID of the profile being viewed.
 * @param filters  Optional filter values (gym, grade, date range).
 * @param limit    Page size (default 50).
 * @param offset   Pagination offset (default 0).
 * @returns        Array of HistoryAscent rows, most-recent-first.
 * @throws {Error} with a user-facing message on failure.
 */
export async function fetchProfileHistory(
  userId: string,
  filters: HistoryFilters,
  limit: number = DEFAULT_PAGE_SIZE,
  offset: number = 0,
): Promise<HistoryAscent[]> {
  const { data, error } = await supabase.rpc('get_profile_history', {
    p_user_id:   userId,
    p_gym_id:    filters.gym_id   ?? null,
    p_grade:     filters.grade    ?? null,
    p_date_from: filters.date_from ?? null,
    p_date_to:   filters.date_to  ?? null,
    p_limit:     limit,
    p_offset:    offset,
  });

  if (error) {
    throw new Error('Failed to load send history. Please try again.');
  }

  if (!data) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- RPC return shape untyped at runtime
  return (data as any[]).map((row): HistoryAscent => ({
    ascent_id:    row.ascent_id   as string,
    route_id:     row.route_id    as string,
    gym_id:       row.gym_id      as string,
    gym_name:     row.gym_name    as string,
    grade:        row.grade       as string,
    color_tag:    row.color_tag   as string,
    section_label: row.section_label as string | null,
    style:        row.style       as HistoryAscent['style'],
    attempts:     row.attempts    as number,
    note:         row.note        as string | null,
    logged_at:    row.logged_at   as string,
    is_private:   row.is_private  as boolean,
  }));
}

// ── Stats fetch ────────────────────────────────────────────────────────────────

/**
 * Fetch aggregate stats for a user via the `get_profile_stats` RPC.
 *
 * Privacy: same server-side gate as fetchProfileHistory.
 * If blocked by privacy, returns zeroed stats (total_sends = 0, streak = 0, etc.).
 *
 * The sends_by_grade array is normalized to include ALL grades from VB–V10,
 * with count = 0 for grades that have no sends, so the bar chart renders a
 * full axis even when data is sparse.
 *
 * @param userId   UUID of the profile being viewed.
 * @returns        ProfileStats object.
 * @throws {Error} with a user-facing message on failure.
 */
export async function fetchProfileStats(userId: string): Promise<ProfileStats> {
  const { data, error } = await supabase
    .rpc('get_profile_stats', { p_user_id: userId })
    .single();

  if (error) {
    throw new Error('Failed to load stats. Please try again.');
  }

  const row = data as {
    total_sends: number | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- JSON column
    sends_by_grade: any;
    current_streak: number | null;
    highest_grade: string | null;
  } | null;

  const rawByGrade: GradeCount[] = (() => {
    const raw = row?.sends_by_grade;
    if (!raw) return [];
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw) as GradeCount[];
      } catch {
        return [];
      }
    }
    if (Array.isArray(raw)) return raw as GradeCount[];
    return [];
  })();

  // Build a lookup for grades returned by the RPC.
  const gradeMap: Record<string, number> = {};
  for (const entry of rawByGrade) {
    gradeMap[entry.grade] = entry.count;
  }

  // Normalize: include all grades in canonical order, filling zeros.
  const sends_by_grade: GradeCount[] = GRADE_ORDER.map((g) => ({
    grade: g,
    count: gradeMap[g] ?? 0,
  }));

  return {
    total_sends:    row?.total_sends    ?? 0,
    sends_by_grade,
    current_streak: row?.current_streak ?? 0,
    highest_grade:  row?.highest_grade  ?? null,
  };
}

// ── Gym list for filter picker ─────────────────────────────────────────────────

/**
 * Minimal gym shape for the filter dropdown.
 */
export interface GymSummary {
  id: string;
  name: string;
}

/**
 * Fetch the list of gyms that appear in a user's ascent history.
 * Used to populate the gym filter picker.
 *
 * Returns distinct gyms ordered by name.
 *
 * @param userId   UUID of the profile being viewed.
 * @returns        Array of distinct { id, name } gyms.
 * @throws {Error} with a user-facing message on failure.
 */
export async function fetchHistoryGyms(userId: string): Promise<GymSummary[]> {
  // Fetch via ascents → routes → gyms join.
  // RLS on ascents ensures only visible rows are returned.
  const { data, error } = await supabase
    .from('ascents')
    .select('routes(gym_id, gyms(id, name))')
    .eq('user_id', userId);

  if (error) {
    throw new Error('Failed to load gyms. Please try again.');
  }

  if (!data) return [];

  const seen = new Set<string>();
  const gyms: GymSummary[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- join shape untyped
  for (const row of data as any[]) {
    const route = row.routes;
    if (!route) continue;
    const gym = route.gyms;
    if (!gym) continue;
    const gymId = gym.id as string;
    if (!seen.has(gymId)) {
      seen.add(gymId);
      gyms.push({ id: gymId, name: gym.name as string });
    }
  }

  gyms.sort((a, b) => a.name.localeCompare(b.name));
  return gyms;
}
