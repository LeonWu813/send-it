/**
 * Auth service for MOD-001.
 *
 * All Supabase Auth calls go through here — never call supabase.auth directly
 * from components. Error messages are kept generic (never expose raw Supabase
 * errors to the UI) and surfaced via thrown Error instances.
 *
 * AC-201 profile prefill (Q-A hybrid / Q-B):
 *   Google: The Supabase trigger (handle_new_auth_user) fills display_name and
 *           avatar_url from raw_user_meta_data on new-account creation. After
 *           sign-in the app also copies the Google photo to the avatars Storage
 *           bucket so the app is not dependent on Google's CDN for the avatar.
 *   Apple:  The trigger does not receive the Apple-provided name (Apple sends
 *           PersonNameComponents only to the native SDK, not in the JWT). After
 *           signInWithIdToken succeeds, the app reads credential.fullName and
 *           fills display_name in the users row if the field is currently empty.
 *           Apple sends fullName only on the very first sign-in; on later
 *           sign-ins credential.fullName is nil and the in-app update is skipped.
 */

import * as AppleAuthentication from 'expo-apple-authentication';
import * as AuthSession from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import { File as ExpoFile } from 'expo-file-system';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { supabase } from '../../lib/supabase';
import type { UserProfile } from './types';

// Ensure the auth session redirect can close the browser tab on iOS
WebBrowser.maybeCompleteAuthSession();

// ─── Email / password ─────────────────────────────────────────────────────────

export interface SignUpEmailParams {
  email: string;
  password: string;
  displayName: string;
}

/**
 * Sign up with email + password. Creates the Supabase auth user; the
 * corresponding `User` profile row is created by a Supabase trigger or by
 * `ensureProfile()` on first session load.
 */
export async function signUpWithEmail(params: SignUpEmailParams): Promise<void> {
  const { email, password, displayName } = params;
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName,
      },
    },
  });
  if (error) {
    throw new Error('Sign up failed. Please try again.');
  }
}

/**
 * Sign in with email + password.
 */
export async function signInWithEmail(
  email: string,
  password: string,
): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error('Sign in failed. Please check your credentials.');
  }
}

// ─── Apple Sign-In ────────────────────────────────────────────────────────────

/**
 * Sign in with Apple.
 *
 * Apple Sign-In is required by the App Store because Google Sign-In is offered.
 * It must be visually equivalent (not smaller or hidden) to Google Sign-In per
 * App Store review guidelines.
 *
 * Availability: The entitlement is only present in production/TestFlight builds
 * signed with an Apple Developer account. On a simulator without the entitlement
 * (or on any non-iOS platform), isAvailableAsync() returns false and this
 * function returns early without error. The UI hides the button in that case.
 */
export async function signInWithApple(): Promise<void> {
  if (Platform.OS !== 'ios') {
    throw new Error('Apple Sign-In is only available on iOS.');
  }

  const available = await AppleAuthentication.isAvailableAsync();
  if (!available) {
    // Not available on this device/build (e.g. simulator without the entitlement).
    // Return silently — the UI must not show the button when unavailable.
    return;
  }

  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
  } catch (err) {
    const appleErr = err as { code?: string };
    if (appleErr.code === 'ERR_REQUEST_CANCELED') {
      // User cancelled — treat as a no-op, do not surface an error
      return;
    }
    throw new Error('Apple Sign-In failed. Please try again.');
  }

  if (!credential.identityToken) {
    throw new Error('Apple Sign-In failed. Please try again.');
  }

  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
    nonce: credential.authorizationCode ?? undefined,
  });

  if (error) {
    throw new Error('Apple Sign-In failed. Please try again.');
  }

  // AC-201 Q-A (Apple): Best-effort display_name prefill on first sign-in.
  // Apple sends PersonNameComponents to the native SDK only on the very first
  // sign-in; on later sign-ins credential.fullName is nil and composedName
  // will be empty, so the update is skipped automatically.
  const givenName = credential.fullName?.givenName?.trim() ?? '';
  const familyName = credential.fullName?.familyName?.trim() ?? '';
  const composedName = [givenName, familyName].filter(Boolean).join(' ');
  if (composedName) {
    // Errors are non-fatal — sign-in already succeeded; the user can edit their
    // name in Edit Profile if the prefill is missed.
    await fillDisplayNameIfEmpty(composedName).catch((err: unknown) => {
      console.error('[signInWithApple] display_name prefill error:', err);
    });
  }
}

// ─── Google Sign-In (OAuth via Supabase) ─────────────────────────────────────

/**
 * Sign in with Google via Supabase OAuth.
 *
 * Uses the PKCE flow with expo-auth-session so Supabase can verify the
 * code_challenge server-side without needing a client secret on the device.
 */
export async function signInWithGoogle(): Promise<void> {
  // Generate a random code verifier for PKCE
  const rawNonce = Array.from(
    await Crypto.getRandomBytesAsync(16),
  )
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce,
  );

  const redirectUri = AuthSession.makeRedirectUri({ scheme: 'projectday' });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectUri,
      queryParams: {
        nonce: hashedNonce,
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });

  if (error || !data.url) {
    throw new Error('Google Sign-In failed. Please try again.');
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);

  if (result.type !== 'success') {
    // User cancelled or session was dismissed — treat as no-op
    return;
  }

  // Extract the session tokens from the redirect URL.
  //
  // Supabase PKCE can return the refresh token in the query string while other
  // params (access_token, token_type, …) are in the fragment. Picking only one
  // side drops whichever the other side carries — the original `url.split('#')[1]`
  // approach silently dropped the refresh token, producing a session that could
  // not silently refresh after ~1 hour.
  //
  // Strategy: parse both sides and merge them. Fragment params win on collision
  // (Supabase convention — the fragment is the authoritative side for auth data).
  const parsedUrl = new URL(result.url);

  // Start from fragment params (authoritative per Supabase convention), then
  // fill in any keys that only appear in the query string.
  const params = new URLSearchParams(parsedUrl.hash.replace(/^#/, ''));
  parsedUrl.searchParams.forEach((value, key) => {
    if (!params.has(key)) params.set(key, value);
  });

  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');

  if (!accessToken) {
    throw new Error('Google Sign-In failed. Please try again.');
  }

  const { error: sessionError } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken ?? '',
  });

  if (sessionError) {
    throw new Error('Google Sign-In failed. Please try again.');
  }

  // AC-201 Q-B: Best-effort copy of the Google profile photo to the avatars
  // Storage bucket. The trigger set avatar_url to a Google CDN URL; we copy it
  // so the app is not permanently dependent on Google's CDN.
  // Errors are swallowed — the Google URL stays as the accepted fallback.
  await copyGoogleAvatarToBucket().catch((err: unknown) => {
    console.error('[signInWithGoogle] avatar copy error:', err);
  });
}

// ─── Sign out ─────────────────────────────────────────────────────────────────

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw new Error('Sign out failed. Please try again.');
  }
}

// ─── Profile helpers ──────────────────────────────────────────────────────────

/**
 * Load the current user's profile row from the `users` table.
 * Returns null if the row does not exist yet (first sign-in before
 * the profile trigger has fired, or trigger not yet configured).
 */
export async function loadProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('users')
    .select(
      'id, display_name, avatar_url, bio, privacy_setting, created_at',
    )
    .eq('id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // Row not found — profile not yet created
      return null;
    }
    throw new Error('Failed to load profile.');
  }

  return data as UserProfile;
}

/**
 * Create or update the `users` row for the current user.
 */
export async function upsertProfile(
  userId: string,
  fields: Partial<Omit<UserProfile, 'id' | 'created_at'>>,
): Promise<UserProfile> {
  const { data, error } = await supabase
    .from('users')
    .upsert({ id: userId, ...fields }, { onConflict: 'id' })
    .select(
      'id, display_name, avatar_url, bio, privacy_setting, created_at',
    )
    .single();

  if (error) {
    throw new Error('Failed to save profile.');
  }

  return data as UserProfile;
}

/**
 * Upload an avatar image to Supabase Storage and return the public URL.
 * The file must be a local URI obtained from expo-image-picker (JPEG, PNG, or
 * WebP). Passing a remote https:// URL is not supported and will throw — only
 * local device file URIs are valid here. This guard prevents
 * EditProfileScreen.tsx from accidentally uploading a remote Google/Apple URL
 * as a local file (AC-201 Q-B).
 */
export async function uploadAvatar(
  userId: string,
  imageUri: string,
): Promise<string> {
  if (imageUri.startsWith('https://') || imageUri.startsWith('http://')) {
    throw new Error(
      'uploadAvatar requires a local file URI, not a remote URL. ' +
        'Use copyGoogleAvatarToBucket for remote-to-bucket copies.',
    );
  }

  const fileExtension = imageUri.split('.').pop() ?? 'jpg';
  const fileName = `${userId}.${fileExtension}`;
  const storagePath = `avatars/${fileName}`;
  const contentType = fileExtension === 'png' ? 'image/png' : 'image/jpeg';

  // Read the local file as raw bytes using expo-file-system's File class.
  // The fetch-then-blob approach is unreliable in React Native / Expo SDK 57+:
  // the native blob store encodes data via base64, causing silent upload
  // failures for real-world file sizes. File.bytes() returns a Uint8Array
  // directly — no base64 detour, no fetch corruption risk.
  const expoFile = new ExpoFile(imageUri);
  const uint8Array = await expoFile.bytes();

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(storagePath, uint8Array, {
      cacheControl: '3600',
      upsert: true,
      contentType,
    });

  if (uploadError) {
    throw new Error('Failed to upload photo. Please try again.');
  }

  const { data } = supabase.storage.from('avatars').getPublicUrl(storagePath);
  // Append a version query-param so every replace produces a distinct URL,
  // bypassing the device image cache and any CDN layer. The stored avatar_url
  // value changes on each upload, so all consumers (ProfileScreen, reel viewer,
  // feed cards, etc.) pick up the new image without requiring a cache expiry.
  return `${data.publicUrl}?v=${Date.now()}`;
}

// ─── AC-201 helpers (internal — not exported) ────────────────────────────────

/**
 * Fill `users.display_name` from `name` only when the field is currently
 * null or blank (trim-empty). Used after Apple Sign-In to capture the
 * PersonNameComponents that Apple provides only on the very first sign-in.
 *
 * Not exported — callers go through signInWithApple().
 */
async function fillDisplayNameIfEmpty(name: string): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return;

  const userId = session.user.id;

  const { data: profileRow, error: selectError } = await supabase
    .from('users')
    .select('display_name')
    .eq('id', userId)
    .single();

  if (selectError) {
    console.error('[fillDisplayNameIfEmpty] select error:', selectError);
    return;
  }

  // Only fill when the field is currently empty (trim-blank or null).
  const existing = (profileRow as { display_name: string | null } | null)
    ?.display_name;
  if (existing?.trim()) return;

  const { error: updateError } = await supabase
    .from('users')
    .update({ display_name: name })
    .eq('id', userId);

  if (updateError) {
    console.error('[fillDisplayNameIfEmpty] update error:', updateError);
  }
}

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
 * Not exported — callers go through signInWithGoogle().
 */
async function copyGoogleAvatarToBucket(): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return;

  const userId = session.user.id;

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

/**
 * AC-157 / AC-156: Update the current user's beta_video_privacy column.
 *
 * MOD-001 owns this write; MOD-010's SettingsScreen calls this function for
 * the "Beta Video Privacy" toggle (AC-157). Governing spec: spec.md AC-156.
 */
export async function updateBetaVideoPrivacy(
  value: 'public' | 'followers_only',
): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw new Error('Not authenticated');
  }

  const { error } = await supabase
    .from('users')
    .update({ beta_video_privacy: value })
    .eq('id', session.user.id);

  if (error) {
    throw new Error('Failed to update beta video privacy setting. Please try again.');
  }
}
