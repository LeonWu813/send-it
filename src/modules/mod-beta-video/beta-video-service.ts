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
 *   the caller has verified H.264/AAC/MP4 or MOV conformance.
 * - Storage upload: uses expo-file-system's File class (SDK 54+ API). File.bytes()
 *   returns a Uint8Array directly — no base64 detour, no fetch() corruption risk.
 *   The legacy readAsStringAsync API was removed in SDK 54+.
 */

import { File as ExpoFile } from 'expo-file-system';

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
  // AC-142 / AC-143: canonical exclusion predicate — visible iff not reported OR
  // reported-but-admin-dismissed. A bare `is_reported = false` would permanently
  // hide admin-dismissed videos (violates AC-143).
  // AC-144: embedded join for poster identity (display_name, avatar_url).
  // The join requires beta_videos_user_id_fkey to target public.users(id)
  // (enforced by the 20260928000001 migration FK repoint).
  const { data, error } = await supabase
    .from('beta_videos')
    .select(
      // AC-158: include beta_video_privacy from the poster's user record so the
      // followers-only filter in BetaVideoSection can be applied client-side.
      'id, route_id, user_id, video_url, thumbnail_url, duration_seconds, caption, created_at, is_reported, report_dismissed, users!beta_videos_user_id_fkey(display_name, avatar_url, beta_video_privacy)',
    )
    .eq('route_id', routeId)
    .or('is_reported.eq.false,report_dismissed.eq.true')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error('Failed to load beta videos. Please try again.');
  }

  // Flatten the embedded `users` object to top-level fields so the viewer
  // (AC-134) reads `video.display_name` / `video.avatar_url` directly.
  // Also expose `beta_video_privacy` for the AC-158 filter in BetaVideoSection.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => ({
    ...row,
    display_name: row.users?.display_name ?? null,
    avatar_url: row.users?.avatar_url ?? null,
    beta_video_privacy: row.users?.beta_video_privacy ?? 'public',
  })) as BetaVideo[];
}

/**
 * Upload a beta video (compressed MP4 or MOV) and its thumbnail to Supabase Storage,
 * then insert a BetaVideo row linking them to the given route.
 *
 * Progress is reported via the onProgress callback for each phase:
 *   video → saving row
 *
 * Upload strategy: expo-file-system File class (SDK 54+ API). File.bytes() returns a
 * Uint8Array directly — no base64 detour, no fetch() corruption risk. The legacy
 * readAsStringAsync API was removed in SDK 54+.
 *
 * AC-032: the returned BetaVideo row is attached to exactly one route.
 * AC-036: progress overlay percentage is driven by onProgress.
 *
 * @param input       Upload payload (validated by caller: duration ≤ 60, codec H.264/AAC/MP4 or MOV).
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
  try {
    // ── Phase 1: Upload video ─────────────────────────────────────────────────
    // Phase 1 PM ruling (AC-031): true JPEG thumbnail frame extraction is deferred
    // to Phase 2. The video URI itself is the placeholder thumbnail. No separate
    // thumbnail Storage upload is performed — thumbnail_url is set to the video's
    // storage path so it remains a valid retrievable URL.
    //
    // Upload strategy: expo-file-system File class (SDK 54+ API).
    //   File.bytes() returns a Uint8Array directly — no base64 detour needed.
    //   The legacy readAsStringAsync API was removed in SDK 54+ and throws at runtime.
    onProgress?.({ percent: 10, phase: 'video' });

    const ext = input.localVideoUri.split('.').pop() ?? 'mp4';
    const fileName = `${userId}/${Date.now()}.${ext}`;
    const contentType = input.localVideoUri.toLowerCase().endsWith('.mov')
      ? 'video/quicktime'
      : 'video/mp4';

    // Read the local video file as raw bytes using expo-file-system's File class.
    // The legacy readAsStringAsync API was removed in SDK 54+. File.bytes() returns
    // a Uint8Array directly — no base64 detour needed.
    const expoFile = new ExpoFile(input.localVideoUri);
    const uint8Array = await expoFile.bytes();

    const { error: storageError } = await supabase.storage
      .from(BETA_VIDEO_BUCKET)
      .upload(fileName, uint8Array, {
        contentType,
        upsert: false,
      });

    if (storageError) {
      console.error('[uploadBetaVideo] storage error:', storageError);
      throw new Error('Failed to upload video. Please try again.');
    }

    const videoPath = fileName;

    onProgress?.({ percent: 80, phase: 'video' });

    // ── Phase 2: Insert BetaVideo row ─────────────────────────────────────────
    onProgress?.({ percent: 90, phase: 'saving' });

    // AC-166 / AC-165: use upsert so a second upload for the same (user_id, route_id)
    // pair replaces the existing row instead of hitting the UNIQUE constraint.
    // The old video file in storage becomes an orphan when replaced — storage cleanup
    // on replace is deferred to Phase 2 (TODO: add a cleanup job that removes orphaned
    // storage objects whose paths are no longer referenced in beta_videos).
    const { data, error: insertError } = await supabase
      .from('beta_videos')
      .upsert(
        {
          route_id: input.route_id,
          user_id: userId,
          video_url: videoPath,
          // Phase 1: thumbnail_url stores the video storage path as a placeholder.
          // Phase 2 will replace this with a real JPEG frame URL (ffmpeg-kit-react-native).
          thumbnail_url: videoPath,
          duration_seconds: input.duration_seconds,
          caption: input.caption ?? null,
        },
        { onConflict: 'user_id,route_id' },
      )
      .select('id, route_id, user_id, video_url, thumbnail_url, duration_seconds, caption, created_at, is_reported, report_dismissed')
      .single();

    if (insertError) {
      console.error('[uploadBetaVideo] insert error:', insertError);
      // Clean up the video artifact
      await supabase.storage.from(BETA_VIDEO_BUCKET).remove([videoPath]);
      throw new Error('Failed to save beta video. Please try again.');
    }

    onProgress?.({ percent: 100, phase: 'saving' });

    // No join needed here (the uploader does not render poster overlay info).
    // display_name and avatar_url are not insert columns — default to null.
    return { ...data, display_name: null, avatar_url: null } as BetaVideo;
  } catch (error) {
    console.error('[uploadBetaVideo] error:', error);
    throw error;
  }
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
 * Fetch all beta videos uploaded by a given user, ordered newest-first.
 *
 * AC-162: service function consumed by MOD-006 (AC-163) and MOD-001 (AC-164).
 * Filters out rows where `is_reported = true AND report_dismissed = false`
 * using the canonical AC-142/AC-143 exclusion predicate.
 * Requires an authenticated session; throws if none.
 *
 * @param userId  UUID of the user whose videos to fetch.
 * @returns       Array of BetaVideo rows ordered by created_at DESC.
 * @throws {Error} if not authenticated or on Supabase error.
 */
export async function fetchBetaVideosByUser(userId: string): Promise<BetaVideo[]> {
  // Auth guard — all service functions require a valid session.
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session) {
    throw new Error('Authentication required.');
  }

  const { data, error } = await supabase
    .from('beta_videos')
    .select(
      // AC-162: include poster identity so BetaVideoReelViewer (AC-134) can render
      // the poster row (avatar + display_name) when opened from a profile screen.
      'id, route_id, user_id, video_url, thumbnail_url, duration_seconds, caption, created_at, is_reported, report_dismissed, users!beta_videos_user_id_fkey(display_name, avatar_url)',
    )
    .eq('user_id', userId)
    // AC-142 / AC-143: canonical exclusion predicate — same as fetchBetaVideosForRoute.
    .or('is_reported.eq.false,report_dismissed.eq.true')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error('Failed to load beta videos. Please try again.');
  }

  // Flatten the embedded `users` object to top-level fields so the viewer
  // (AC-134) reads `video.display_name` / `video.avatar_url` directly.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => ({
    ...row,
    display_name: (row.users as any)?.display_name ?? null,
    avatar_url: (row.users as any)?.avatar_url ?? null,
  })) as BetaVideo[];
}

/**
 * Check whether the currently authenticated user already has a beta video
 * for the given route.
 *
 * AC-166: called on component mount in UploadBetaVideoScreen (or BetaVideoUploader)
 * before the confirm/upload action to show the replace reminder.
 *
 * @param routeId  UUID of the route to check.
 * @returns        `true` if a row exists, `false` otherwise.
 * @throws {Error} if not authenticated or on Supabase error.
 */
export async function checkExistingBetaVideo(routeId: string): Promise<boolean> {
  // Auth guard.
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session) {
    throw new Error('Authentication required.');
  }

  const currentUserId = session.user.id;

  const { data, error } = await supabase
    .from('beta_videos')
    .select('id')
    .eq('user_id', currentUserId)
    .eq('route_id', routeId)
    .maybeSingle();

  if (error) {
    throw new Error('Failed to check existing beta video.');
  }

  return data !== null;
}

/**
 * Report a beta video via the SECURITY DEFINER RPC `report_beta_video`.
 *
 * The RPC sets `beta_videos.is_reported = true` and inserts one `video_reports`
 * row (idempotent via ON CONFLICT DO NOTHING). Throws if the caller is not
 * authenticated, the video does not exist, or the caller is the video owner.
 *
 * AC-140: one-tap report flow — no category or note is collected.
 * AC-139: ownership check is enforced server-side in the RPC (defense-in-depth).
 *
 * @param videoId  UUID of the beta video to report.
 * @throws {Error} with a user-facing message on failure.
 */
export async function reportBetaVideo(videoId: string): Promise<void> {
  const { error } = await supabase.rpc('report_beta_video', { p_beta_video_id: videoId });
  if (error) {
    throw new Error('Failed to report video. Please try again.');
  }
}

