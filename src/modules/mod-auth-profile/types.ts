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
  bio: string | null;
  privacy_setting: PrivacySetting;
  created_at: string;
}

/** Navigation params for the auth stack. */
export type AuthStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
  EditProfile: undefined;
  Settings: undefined;
};

/** Navigation params for the profile navigator (Tab 3). */
export type ProfileStackParamList = {
  Profile: undefined;
  EditProfile: undefined;
};
