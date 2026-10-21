/**
 * Public barrel for MOD-003 Route Catalog.
 *
 * External modules must import from this barrel — never from internal paths
 * such as './route-service', './types', or './screens/*'.
 *
 * Cross-module imports currently deep-importing this module (to fix in a
 * future sweep — these files are in other modules' write scope):
 *   - src/modules/mod-send-logging/screens/RouteSearchScreen.tsx
 *       from '../../mod-route-catalog/route-service'  → listRoutes
 *       from '../../mod-route-catalog/types'          → RouteSummary
 *   - src/modules/mod-gym-directory/GymNavigator.tsx
 *       from '../mod-route-catalog/RouteNavigator'    → RouteNavigator (default)
 *   - src/modules/mod-home/screens/HomeScreen.tsx
 *       from '../../mod-route-catalog/route-service'  → fetchSavedRouteIds, saveRoute, unsaveRoute
 *       from '../../mod-route-catalog/types'          → RouteGrade
 *   - src/modules/mod-home/__tests__/HomeScreen.test.tsx
 *       from '../../mod-route-catalog/route-service'  → (jest.mock)
 */

// ── Navigator entry-point (consumed by MOD-002) ───────────────────────────────
export { default as RouteNavigator } from './RouteNavigator';

// ── Service functions (public data API) ───────────────────────────────────────
export {
  fetchBetaVideoCounts,
  fetchRoutesWithNewBeta,
  fetchSavedRouteIds,
  getPhotoSignedUrl,
  listRoutes,
  loadRoute,
  saveRoute,
  submitRoute,
  unsaveRoute,
  uploadRoutePhoto,
  upsertRouteVisit,
  withdrawRoute,
} from './route-service';

// ── Types and constants ───────────────────────────────────────────────────────
export type {
  Route,
  RouteColor,
  RouteGrade,
  RouteListFilters,
  RouteStatus,
  RouteSummary,
  RouteSubmitInput,
} from './types';
export { ROUTE_COLORS, ROUTE_GRADES } from './types';
