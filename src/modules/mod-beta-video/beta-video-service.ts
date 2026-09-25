/**
 * Beta Video service — all Supabase data access for MOD-005.
 *
 * Rules:
 * - Uses the shared Supabase singleton from src/lib/supabase.ts.
 * - Never calls createClient() directly.
 * - Storage bucket: 'beta-videos' (must be created via Studio / CLI).
 * - Video and thumbnail paths are stored as storage paths; callers sign them
 *   at render time via getVideoSignedUrl / getThumbnailSignedUrl.
 * - AC-032: one BetaVideo row attached to exactly one Route (route_id FK).
 * - AC-035: codec validation is caller-side; this service inserts only after
 *   the caller has verified H.264/AAC/MP4 conformance.
 */

import { supabase } from '../../lib/supabase';
import type { BetaVideo, BetaVideoUploadInput, UploadProgress } from './types';

/** Storage bucket for beta video artifacts. */
const BETA_VIDEO_BUCKET = 'beta-videos';

/** Signed URL expiry in seconds (1 hour). */
const SIGNED_URL_EXPIRY = 3600;

/**
 * Fetch all beta videos for a given route, ordered newest-first.
 *
 * @param routeId  UUID of the route.
 * @returns        Array of BetaVideo rows.
 * @throws {Error} with a user-facing message on failure.
 */
export async function fetchBetaVideosForRoute(routeId: string): Promise<BetaVideo[]> {
  const { data, error } = await supabase
    .from('beta_videos')
    .select('id, route_id, user_id, video_url, thumbnail_url, duration_seconds, caption, created_at')
    .eq('route_id', routeId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error('Failed to load beta videos. Please try again.');
  }

  return (data ?? []) as BetaVideo[];
}

/**
 * Upload a beta video (compressed MP4) and its thumbnail to Supabase Storage,
 * then insert a BetaVideo row linking them to the given route.
 *
 * Progress is reported via the onProgress callback for each phase:
 *   thumbnail → video → saving row
 *
 * AC-032: the returned BetaVideo row is attached to exactly one route.
 * AC-036: progress overlay percentage is driven by onProgress.
 *
 * @param input       Upload payload (validated by caller: duration ≤ 60, codec H.264/AAC/MP4).
 * @param userId      Authenticated user UUID.
 * @param onProgress  Called with UploadProgress as each phase completes.
 * @returns           The inserted BetaVideo row.
 * @throws {Error}    with a user-facing message on any failure; no partial artifacts are stored.
 */
export async function uploadBetaVideo(
  input: BetaVideoUploadInput,
  userId: string,
  onProgress?: (progress: UploadProgress) => void,
): Promise<BetaVideo> {
  const timestamp = Date.now();
  const videoPath = `${userId}/${input.route_id}/${timestamp}.mp4`;
  const thumbnailPath = `${userId}/${input.route_id}/${timestamp}_thumb.jpg`;

  // ── Phase 1: Upload thumbnail ─────────────────────────────────────────────
  onProgress?.({ percent: 10, phase: 'thumbnail' });

  const thumbnailBlob = await uriToBlob(input.localThumbnailUri);
  const { error: thumbError } = await supabase.storage
    .from(BETA_VIDEO_BUCKET)
    .upload(thumbnailPath, thumbnailBlob, {
      contentType: 'image/jpeg',
      upsert: false,
    });

  if (thumbError) {
    throw new Error('Failed to upload thumbnail. Please try again.');
  }

  onProgress?.({ percent: 30, phase: 'thumbnail' });

  // ── Phase 2: Upload video ─────────────────────────────────────────────────
  onProgress?.({ percent: 40, phase: 'video' });

  const videoBlob = await uriToBlob(input.localVideoUri);
  const { error: videoError } = await supabase.storage
    .from(BETA_VIDEO_BUCKET)
    .upload(videoPath, videoBlob, {
      contentType: 'video/mp4',
      upsert: false,
    });

  if (videoError) {
    // Clean up the thumbnail we already uploaded
    await supabase.storage.from(BETA_VIDEO_BUCKET).remove([thumbnailPath]);
    throw new Error('Failed to upload video. Please try again.');
  }

  onProgress?.({ percent: 80, phase: 'video' });

  // ── Phase 3: Insert BetaVideo row ─────────────────────────────────────────
  onProgress?.({ percent: 90, phase: 'saving' });

  const { data, error: insertError } = await supabase
    .from('beta_videos')
    .insert({
      route_id: input.route_id,
      user_id: userId,
      video_url: videoPath,
      thumbnail_url: thumbnailPath,
      duration_seconds: input.duration_seconds,
      caption: input.caption ?? null,
    })
    .select('id, route_id, user_id, video_url, thumbnail_url, duration_seconds, caption, created_at')
    .single();

  if (insertError) {
    // Clean up both artifacts
    await supabase.storage.from(BETA_VIDEO_BUCKET).remove([videoPath, thumbnailPath]);
    throw new Error('Failed to save beta video. Please try again.');
  }

  onProgress?.({ percent: 100, phase: 'saving' });

  return data as BetaVideo;
}

/**
 * Generate a 1-hour signed URL for a beta video stored in Supabase Storage.
 *
 * @param storagePath  The storage path as stored in BetaVideo.video_url.
 * @returns            A signed URL valid for 1 hour.
 * @throws {Error}     on failure.
 */
export async function getVideoSignedUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BETA_VIDEO_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_EXPIRY);

  if (error || !data?.signedUrl) {
    throw new Error('Failed to generate video URL.');
  }

  return data.signedUrl;
}

/**
 * Generate a 1-hour signed URL for a beta video thumbnail stored in Supabase Storage.
 *
 * @param storagePath  The storage path as stored in BetaVideo.thumbnail_url.
 * @returns            A signed URL valid for 1 hour.
 * @throws {Error}     on failure.
 */
export async function getThumbnailSignedUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BETA_VIDEO_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_EXPIRY);

  if (error || !data?.signedUrl) {
    throw new Error('Failed to generate thumbnail URL.');
  }

  return data.signedUrl;
}

/**
 * Convert a local file URI to a Blob for Supabase Storage upload.
 * Uses fetch() which works in both React Native (Hermes) and test environments.
 *
 * @param uri  Local file URI (e.g. file:///path/to/video.mp4).
 * @returns    A Blob of the file content.
 * @throws {Error} on any fetch or conversion failure.
 */
async function uriToBlob(uri: string): Promise<Blob> {
  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error(`Failed to read local file: ${uri}`);
  }
  return response.blob();
}
