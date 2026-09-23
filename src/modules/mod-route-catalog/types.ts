/**
 * Type definitions for MOD-003 Route Catalog.
 */

/** V-scale grade options available in Phase 1. Order matches display order. */
export const ROUTE_GRADES = [
  'VB', 'V0', 'V1', 'V2', 'V3', 'V4',
  'V5', 'V6', 'V7', 'V8', 'V9', 'V10',
] as const;

export type RouteGrade = (typeof ROUTE_GRADES)[number];

/** Fixed hold/tape color enum. Exactly 9 values — no free-text input. */
export const ROUTE_COLORS = [
  'red', 'orange', 'yellow', 'green', 'blue',
  'purple', 'pink', 'white', 'black',
] as const;

export type RouteColor = (typeof ROUTE_COLORS)[number];

/** Route lifecycle status. */
export type RouteStatus = 'active' | 'pending' | 'retired' | 'rejected';

/**
 * Full Route row — mirrors the `routes` DB table.
 * Used for the route detail screen and match results.
 */
export interface Route {
  id: string;
  gym_id: string;
  section_label: string | null;
  grade: RouteGrade;
  color_tag: RouteColor;
  photo_url: string;
  status: RouteStatus;
  submitted_by_user_id: string;
  created_at: string;
  retired_at: string | null;
  retired_by_user_id: string | null;
}

/**
 * Minimal route row used in the gym route list.
 * Fetched with a SELECT projection — not the full table shape.
 */
export interface RouteSummary {
  id: string;
  gym_id: string;
  section_label: string | null;
  grade: RouteGrade;
  color_tag: RouteColor;
  photo_url: string;
  status: RouteStatus;
  created_at: string;
}

/**
 * Input payload for submitting a new route.
 * photo_url must be resolved before submission (uploaded to Storage first).
 */
export interface RouteSubmitInput {
  gym_id: string;
  grade: RouteGrade;
  color_tag: RouteColor;
  photo_url: string;
  section_label: string | null;
}

/** Filter state for the gym route list. */
export interface RouteListFilters {
  grade: RouteGrade | null;
  colorTag: RouteColor | null;
}
