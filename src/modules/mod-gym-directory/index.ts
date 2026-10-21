/**
 * Public API barrel for mod-gym-directory (MOD-002 — Gym Directory).
 *
 * Other modules must import from this barrel rather than reaching into
 * internal files (gym-service.ts, gym-initials.ts, types.ts, screens/) directly.
 *
 * Cross-module import rule (production.md): other modules may import only
 * public service functions and navigator entry-point components from this
 * barrel — never internal screens/ or components/ subdirectories directly.
 */

// ── Navigator entry point ─────────────────────────────────────────────────────

/**
 * Public entry-point for AppShell (MOD-012) to mount the gym directory tab.
 */
export { default as GymNavigator } from './GymNavigator';

// ── Service functions ─────────────────────────────────────────────────────────

export {
  listGyms,
  loadGym,
  fetchSavedGymIds,
  saveGym,
  unsaveGym,
  submitGymRequest,
} from './gym-service';

// ── Utility functions ─────────────────────────────────────────────────────────

/**
 * Derives initials from a gym name for the avatar fallback (AC-198).
 * Consumed by mod-home HomeScreen for the saved-gyms strip.
 */
export { getGymInitials } from './gym-initials';

// ── Types ─────────────────────────────────────────────────────────────────────

export type {
  Gym,
  GymSummary,
  GymType,
  GymRequestStatus,
  GymRequestInput,
  GymListFilters,
} from './types';
