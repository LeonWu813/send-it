/**
 * Type definitions for MOD-002 Gym Directory.
 */

/** Gym type as stored in the DB. */
export type GymType = 'bouldering' | 'top_rope' | 'both';

/** Request status for gym submission queue. */
export type GymRequestStatus = 'pending' | 'added' | 'rejected';

/**
 * Full gym row — mirrors the `gyms` DB table.
 * Used for the gym detail screen.
 */
export interface Gym {
  id: string;
  name: string;
  name_zh: string;
  branch_label: string | null;
  city: string;
  city_zh: string;
  district: string;
  district_zh: string;
  address_text: string;
  lat: number;
  lng: number;
  gym_type: GymType;
  photo_url: string | null;
  official_grading_system: string;
  bouldering_only_note: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Minimal gym row used in the gym list and search results.
 * Fetched with a SELECT projection — not the full table shape.
 */
export interface GymSummary {
  id: string;
  name: string;
  name_zh: string;
  branch_label: string | null;
  city: string;
  city_zh: string;
  district: string;
  district_zh: string;
  gym_type: GymType;
  photo_url: string | null;
}

/**
 * Input payload for submitting a "request a gym" form.
 */
export interface GymRequestInput {
  name: string;
  city: string;
  google_maps_url: string | null;
}

/** Filter state for the gym list screen. */
export interface GymListFilters {
  searchText: string;
  city: string | null;
}
