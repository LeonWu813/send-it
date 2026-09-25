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
