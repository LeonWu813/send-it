/**
 * Types for MOD-005: Beta Video.
 *
 * BetaVideo: a row from the beta_videos table. Each video is attached to exactly
 * one Route (route_id FK). Video and thumbnail are stored in Supabase Storage;
 * the URLs stored here are storage paths (not pre-signed URLs — sign at render time).
 */

/** A beta video row as returned from Supabase. */
export interface BetaVideo {
  id: string;
  route_id: string;
  user_id: string;
  video_url: string;
  thumbnail_url: string;
  duration_seconds: number;
  caption: string | null;
  created_at: string;
  /** True when any user has filed a one-tap report via report_beta_video() RPC (AC-140). */
  is_reported: boolean;
  /** True when an admin has dismissed the report via Supabase Studio (AC-143). */
  report_dismissed: boolean;
  /** Poster's display name, joined from public.users via beta_videos_user_id_fkey (AC-144). */
  display_name: string | null;
  /** Poster's avatar URL, joined from public.users via beta_videos_user_id_fkey (AC-144). */
  avatar_url: string | null;
}

/** Input payload for uploading a new beta video. */
export interface BetaVideoUploadInput {
  /** The route this video is attached to (pre-filled from RouteDetailScreen). */
  route_id: string;
  /** Local file URI of the compressed MP4 to upload. */
  localVideoUri: string;
  /** Local file URI of the thumbnail image to upload. */
  localThumbnailUri: string;
  /** Duration in seconds (must be ≤ 60; validated before upload begins). */
  duration_seconds: number;
  /** Optional user caption. */
  caption?: string;
}

/** Upload progress state (0–100). */
export interface UploadProgress {
  /** 0–100 integer representing upload completion percentage. */
  percent: number;
  /** Which phase of the upload we are in. */
  phase: 'thumbnail' | 'video' | 'saving';
}
