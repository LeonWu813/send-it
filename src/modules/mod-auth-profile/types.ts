/**
 * Type definitions for MOD-001 Auth & Profile.
 */

/** Privacy setting as defined in the data model. Controls RLS across MOD-004, MOD-005, MOD-008. */
export type PrivacySetting = 'public' | 'followers_only';

/** The User row shape from Postgres (mirrors the DB table). */
export interface UserProfile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  home_gym_id: string | null;
  bio: string | null;
  privacy_setting: PrivacySetting;
  created_at: string;
}

/** Gym row shape as needed for home-gym selection (minimal fields only). */
export interface GymListItem {
  id: string;
  name: string;
  city: string | null;
}

/** Navigation params for the auth/onboarding stacks. */
export type AuthStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
  HomeGymSelection: { isOnboarding: boolean };
  EditProfile: undefined;
  Settings: undefined;
};
