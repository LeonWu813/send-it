/**
 * Auth service for MOD-001.
 *
 * All Supabase Auth calls go through here — never call supabase.auth directly
 * from components. Error messages are kept generic (never expose raw Supabase
 * errors to the UI) and surfaced via thrown Error instances.
 */

import * as AppleAuthentication from 'expo-apple-authentication';
import * as AuthSession from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
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
 */
export async function signInWithApple(): Promise<void> {
  if (Platform.OS !== 'ios') {
    throw new Error('Apple Sign-In is only available on iOS.');
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

  const redirectUri = AuthSession.makeRedirectUri({ scheme: 'send-it' });

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

  // Extract the session from the URL fragment that Supabase returns
  const url = result.url;
  const params = new URLSearchParams(url.includes('#') ? url.split('#')[1] : url.split('?')[1]);
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
      'id, display_name, avatar_url, home_gym_id, bio, privacy_setting, created_at',
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
      'id, display_name, avatar_url, home_gym_id, bio, privacy_setting, created_at',
    )
    .single();

  if (error) {
    throw new Error('Failed to save profile.');
  }

  return data as UserProfile;
}

/**
 * Set the user's home gym.
 */
export async function setHomeGym(
  userId: string,
  gymId: string,
): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({ home_gym_id: gymId })
    .eq('id', userId);

  if (error) {
    throw new Error('Failed to save home gym. Please try again.');
  }
}

/**
 * Upload an avatar image to Supabase Storage and return the public URL.
 * The file must be a JPEG or PNG obtained from expo-image-picker.
 */
export async function uploadAvatar(
  userId: string,
  imageUri: string,
): Promise<string> {
  const fileExtension = imageUri.split('.').pop() ?? 'jpg';
  const fileName = `${userId}.${fileExtension}`;
  const storagePath = `avatars/${fileName}`;

  // Fetch the image as a blob
  const response = await fetch(imageUri);
  if (!response.ok) {
    throw new Error('Failed to upload photo. Please try again.');
  }
  const blob = await response.blob();

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(storagePath, blob, {
      cacheControl: '3600',
      upsert: true,
      contentType: blob.type || 'image/jpeg',
    });

  if (uploadError) {
    throw new Error('Failed to upload photo. Please try again.');
  }

  const { data } = supabase.storage.from('avatars').getPublicUrl(storagePath);
  return data.publicUrl;
}
