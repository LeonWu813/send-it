/**
 * MOD-001: Auth & Profile — public module barrel.
 *
 * Only items listed here are accessible to other modules.
 * Cross-module import rule: other modules must import only from this barrel,
 * never from internal paths directly.
 */

// ── Components / Navigators ───────────────────────────────────────────────────

export { default as ProfileNavigator } from './ProfileNavigator';
export { default as AuthNavigator } from './AuthNavigator';

// ── Service functions ─────────────────────────────────────────────────────────

export {
  signUpWithEmail,
  signInWithEmail,
  signInWithApple,
  signInWithGoogle,
  signOut,
  loadProfile,
  upsertProfile,
  /** AC-157: update the current user's beta_video_privacy column. Consumed by MOD-010 SettingsScreen. */
  updateBetaVideoPrivacy,
  uploadAvatar,
} from './auth-service';
export type { SignUpEmailParams } from './auth-service';

// ── Hooks ─────────────────────────────────────────────────────────────────────

export { useSession } from './hooks/useSession';

// ── Types ─────────────────────────────────────────────────────────────────────

export type { UserProfile, PrivacySetting } from './types';
