/**
 * Type definitions for MOD-004 Send Logging.
 *
 * The `Ascent` type mirrors the `ascents` DB table.
 * Grade is intentionally absent from `Ascent` — it is always read
 * from `Route.grade` at display time (AC-011).
 */

/** Send style options — matches the `ascent_style` DB enum. */
export const ASCENT_STYLES = ['flash', 'top', 'attempt'] as const;
export type AscentStyle = (typeof ASCENT_STYLES)[number];

/**
 * Full Ascent row — mirrors the `ascents` DB table.
 * Note: no `grade` column — grade is always read from route.grade at display time.
 */
export interface Ascent {
  id: string;
  user_id: string;
  route_id: string;
  style: AscentStyle;
  attempts: number;
  note: string | null;
  logged_at: string;
  is_private: boolean;
}

/**
 * Ascent row joined with the display_name of the owning user.
 * Used on the route detail screen to show username alongside each ascent.
 */
export interface AscentWithProfile extends Ascent {
  display_name: string;
}

/**
 * Input payload for logging a new ascent.
 * route_id and user_id come from context; grade is never stored.
 */
export interface AscentLogInput {
  route_id: string;
  style: AscentStyle;
  attempts: number;
  note: string | null;
  logged_at: string;
  is_private: boolean;
}
