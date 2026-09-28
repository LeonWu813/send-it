/**
 * Public API for MOD-004 Send Logging.
 *
 * Other modules (e.g. MOD-003) must import from this barrel file,
 * not from internal module files directly.
 */

// ── Types ──────────────────────────────────────────────────────────────────────
export type { Ascent, AscentLogInput, AscentStyle, AscentWithProfile } from './types';
export { ASCENT_STYLES } from './types';

// ── Service functions ──────────────────────────────────────────────────────────
export {
  deleteAscent,
  fetchMyAscentsForRoute,
  fetchUserAchievements,
  loadAscentsForRoute,
  logAscent,
  summarizeAscents,
} from './send-service';
