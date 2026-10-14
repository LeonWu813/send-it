/**
 * Type definitions for MOD-008 Profile History & Stats.
 *
 * Grade is never stored on an Ascent — it is always joined from Route.grade
 * at display time. These types reflect the joined view returned by the
 * `get_profile_history` and `get_profile_stats` RPCs.
 */

// ── Grade ordering ─────────────────────────────────────────────────────────────

/**
 * All valid V-scale grade strings, ordered from easiest to hardest.
 * Must match the `route_grade` Postgres enum in the migration.
 */
export const GRADE_ORDER = [
  'VB', 'V0', 'V1', 'V2', 'V3', 'V4',
  'V5', 'V6', 'V7', 'V8', 'V9', 'V10',
] as const;

export type VGrade = (typeof GRADE_ORDER)[number];

// ── Ascent history row (joined) ────────────────────────────────────────────────

/**
 * A single ascent row with grade and gym info joined from related tables.
 * Returned by the `get_profile_history` RPC.
 */
export interface HistoryAscent {
  ascent_id: string;
  route_id: string;
  gym_id: string;
  gym_name: string;
  /** Grade string from routes.grade — never stored on ascents. */
  grade: string;
  color_tag: string;
  section_label: string | null;
  /** Route photo URL from routes.photo_url — null when no photo is set. */
  photo_url: string | null;
  style: 'flash' | 'top' | 'attempt';
  attempts: number;
  note: string | null;
  logged_at: string;
  is_private: boolean;
}

// ── Stats ──────────────────────────────────────────────────────────────────────

/**
 * One entry in the sends-by-grade bar chart data.
 */
export interface GradeCount {
  grade: string;
  count: number;
}

/**
 * Aggregate stats for a user's send history.
 * Returned by the `get_profile_stats` RPC.
 */
export interface ProfileStats {
  /** Total number of sends (style = flash | top). */
  total_sends: number;
  /** Send count per grade, ordered VB → V10. Grades with zero sends are included. */
  sends_by_grade: GradeCount[];
  /** Total distinct calendar days on which the user recorded ≥1 flash or top. */
  accumulated_days: number;
  /** Highest V-grade sent, or null if no sends recorded. */
  highest_grade: string | null;
}

// ── Filter state ───────────────────────────────────────────────────────────────

/**
 * Active filter values for the history list.
 * All fields are optional — null means no filter applied.
 */
export interface HistoryFilters {
  gym_id: string | null;
  grade: string | null;
  date_from: string | null;
  date_to: string | null;
}

/** Default (no-filter) state. */
export const EMPTY_FILTERS: HistoryFilters = {
  gym_id: null,
  grade: null,
  date_from: null,
  date_to: null,
};

// ── Privacy hidden state ───────────────────────────────────────────────────────

/**
 * When viewing another user's profile and they have followers_only privacy
 * and the current user is not a follower, the history is in a "hidden" state.
 */
export type HistoryVisibility = 'visible' | 'hidden' | 'loading' | 'error';
