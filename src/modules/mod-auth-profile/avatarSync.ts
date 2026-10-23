/**
 * avatarSync.ts — avatar bucket synchronisation helper for MOD-001.
 *
 * Extracted from auth-service.ts (INT-032a) to keep auth-service.ts focused
 * on Supabase Auth calls. The caller passes the already-known userId so this
 * module never needs to call getSession() itself.
 *
 * All Supabase calls go through the shared singleton from src/lib/supabase.ts.
 */

import { supabase } from '../../lib/supabase';

/**
 * Copy the Google profile photo from its Google CDN URL to the Supabase
 * avatars Storage bucket and update `users.avatar_url` to the bucket URL.
 *
 * Conditions:
 *  - Only runs when `avatar_url` is a Google URL (lh3.googleusercontent.com).
 *  - Content-type must be jpeg, png, or webp; other types are skipped.
 *  - If the download or upload fails, `avatar_url` stays on the Google URL
 *    (the Avatar component handles broken URLs by showing the user's initial).
 *
 * Uses fetch + arrayBuffer() — NOT fetch + blob(). The blob() approach is
 * prohibited by the production.md convention because it routes data through
 * the native blob store via base64 encoding. arrayBuffer() returns raw bytes
 * and does not share that limitation.
 *
 * @param userId - The authenticated user's UUID. The caller (signInWithGoogle
 *                 in auth-service.ts) already holds the session and passes the
 *                 id directly to avoid a redundant getSession() call here
 *                 (INT-032a).
 */
export async function copyGoogleAvatarToBucket(userId: string): Promise<void> {
  const { data: profileRow, error: selectError } = await supabase
    .from('users')
    .select('avatar_url')
    .eq('id', userId)
    .single();

  if (selectError) {
    console.error('[copyGoogleAvatarToBucket] select error:', selectError);
    return;
  }

  const currentUrl = (profileRow as { avatar_url: string | null } | null)
    ?.avatar_url;
  if (!currentUrl) return;

  // Only copy Google CDN URLs — skip if already a bucket URL or other provider.
  if (!currentUrl.startsWith('https://lh3.googleusercontent.com')) return;

  // Download the image via fetch. Use arrayBuffer() (NOT blob()) so we get
  // raw bytes without the base64 detour the React Native native blob store adds.
  const response = await fetch(currentUrl);
  if (!response.ok) {
    console.error(
      '[copyGoogleAvatarToBucket] download failed, status:',
      response.status,
    );
    return;
  }

  const contentType = response.headers.get('content-type') ?? '';
  const isValidType =
    contentType.includes('image/jpeg') ||
    contentType.includes('image/png') ||
    contentType.includes('image/webp');
  if (!isValidType) {
    console.error(
      '[copyGoogleAvatarToBucket] unexpected content-type:',
      contentType,
    );
    return;
  }

  const arrayBuffer = await response.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);

  const fileExtension = contentType.includes('png')
    ? 'png'
    : contentType.includes('webp')
      ? 'webp'
      : 'jpg';
  const storagePath = `avatars/${userId}.${fileExtension}`;
  // Strip charset or boundary directives (e.g. "image/jpeg; charset=utf-8").
  const exactContentType = contentType.split(';')[0].trim();

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(storagePath, uint8Array, {
      contentType: exactContentType,
      cacheControl: '3600',
      upsert: true,
    });

  if (uploadError) {
    console.error('[copyGoogleAvatarToBucket] upload error:', uploadError);
    return; // Leave avatar_url as Google URL (accepted fallback per AC-201 Q-B)
  }

  const { data: urlData } = supabase.storage
    .from('avatars')
    .getPublicUrl(storagePath);
  const bucketUrl = `${urlData.publicUrl}?v=${Date.now()}`;

  const { error: updateError } = await supabase
    .from('users')
    .update({ avatar_url: bucketUrl })
    .eq('id', userId);

  if (updateError) {
    console.error('[copyGoogleAvatarToBucket] DB update error:', updateError);
  }
}
