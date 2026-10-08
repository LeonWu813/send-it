-- ──────────────────────────────────────────────────────────────────────────────
-- MOD-001 AC-156: add beta_video_privacy column to users table
-- Stores the user's account-level beta-video visibility preference.
-- Separate from privacy_setting (AC-063), which governs profile/log visibility.
-- Uses the existing privacy_setting enum ('public' | 'followers_only').
-- Default 'public' backfills all existing rows to current (public) behavior.
-- ──────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS beta_video_privacy privacy_setting NOT NULL DEFAULT 'public';
