/**
 * Public API for MOD-008 Profile History & Stats.
 *
 * Other modules (e.g. MOD-001 ProfileScreen) must import from this barrel file,
 * not from internal module files (screens/, components/, history-service.ts) directly.
 */

// ── Types ──────────────────────────────────────────────────────────────────────
export type {
  GradeCount,
  HistoryAscent,
  HistoryFilters,
  HistoryVisibility,
  ProfileStats,
  VGrade,
} from './types';
export { EMPTY_FILTERS, GRADE_ORDER } from './types';

// ── Service functions ──────────────────────────────────────────────────────────
export {
  fetchHistoryGyms,
  fetchProfileHistory,
  fetchProfileStats,
} from './history-service';
export type { GymSummary } from './history-service';

// ── Public components ──────────────────────────────────────────────────────────
export { default as SendHistoryProfile } from './components/SendHistoryProfile';
