/**
 * Tests for mod-auth-profile/auth-service.ts
 *
 * Tests behaviour — not implementation.
 * All Supabase calls are mocked so no real network activity occurs.
 */

// ── Mock supabase before any import ──────────────────────────────────────────
jest.mock('../../../lib/supabase', () => {
  const mockAuth = {
    signUp: jest.fn(),
    signInWithPassword: jest.fn(),
    signInWithIdToken: jest.fn(),
    signInWithOAuth: jest.fn(),
    setSession: jest.fn(),
    signOut: jest.fn(),
    // AC-201: getSession used by fillDisplayNameIfEmpty and copyGoogleAvatarToBucket
    getSession: jest.fn(),
  };
  const mockStorageBucket = {
    upload: jest.fn().mockResolvedValue({ error: null }),
    getPublicUrl: jest.fn().mockReturnValue({
      data: { publicUrl: 'https://example.com/avatar.jpg' },
    }),
  };
  return {
    supabase: {
      auth: mockAuth,
      from: jest.fn(),
      storage: {
        from: jest.fn().mockReturnValue(mockStorageBucket),
      },
    },
  };
});

jest.mock('expo-apple-authentication', () => ({
  signInAsync: jest.fn(),
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}));

jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
  openAuthSessionAsync: jest.fn(),
}));

jest.mock('expo-auth-session', () => ({
  makeRedirectUri: jest.fn(() => 'projectday://auth'),
}));

jest.mock('expo-crypto', () => ({
  getRandomBytesAsync: jest.fn().mockResolvedValue(new Uint8Array(16)),
  digestStringAsync: jest.fn().mockResolvedValue('hashed-nonce'),
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
}));

// ── Imports after mocks ───────────────────────────────────────────────────────
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '../../../lib/supabase';
import {
  loadProfile,
  signInWithApple,
  signInWithEmail,
  signInWithGoogle,
  signOut,
  signUpWithEmail,
  uploadAvatar,
  upsertProfile,
} from '../auth-service';

// ── Typed mock helpers ────────────────────────────────────────────────────────
const mockAuth = supabase.auth as jest.Mocked<typeof supabase.auth>;
const mockFrom = supabase.from as jest.MockedFunction<typeof supabase.from>;

function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    // For select().eq().single() chain
    single: jest.fn().mockResolvedValue(result),
    // For update().eq() chain (resolves directly)
    update: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockReturnThis(),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('signUpWithEmail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls supabase.auth.signUp with email, password, and displayName', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockAuth.signUp.mockResolvedValueOnce({ data: { user: null, session: null }, error: null } as any);
    await signUpWithEmail({
      email: 'user@example.com',
      password: 'password123',
      displayName: 'Leon',
    });
    expect(mockAuth.signUp).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'password123',
      options: { data: { display_name: 'Leon' } },
    });
  });

  it('throws a user-friendly error when Supabase returns an error', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockAuth.signUp.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { message: 'User already registered', name: 'AuthError', status: 400, code: 'email_taken', __isAuthError: true, toJSON: () => ({}) },
    } as any);
    await expect(
      signUpWithEmail({
        email: 'user@example.com',
        password: 'password123',
        displayName: 'Leon',
      }),
    ).rejects.toThrow('Sign up failed. Please try again.');
  });
});

describe('signInWithEmail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls supabase.auth.signInWithPassword', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockAuth.signInWithPassword.mockResolvedValueOnce({
      data: { user: null, session: null, weakPassword: null },
      error: null,
    } as any);
    await signInWithEmail('user@example.com', 'password123');
    expect(mockAuth.signInWithPassword).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'password123',
    });
  });

  it('throws a user-friendly error on bad credentials', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockAuth.signInWithPassword.mockResolvedValueOnce({
      data: { user: null, session: null, weakPassword: null },
      error: { message: 'Invalid login credentials', name: 'AuthError', status: 400, code: 'invalid_credentials', __isAuthError: true, toJSON: () => ({}) },
    } as any);
    await expect(signInWithEmail('bad@example.com', 'wrong')).rejects.toThrow(
      'Sign in failed. Please check your credentials.',
    );
  });
});

describe('signOut', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls supabase.auth.signOut', async () => {
    mockAuth.signOut.mockResolvedValueOnce({ error: null });
    await signOut();
    expect(mockAuth.signOut).toHaveBeenCalled();
  });

  it('throws a user-friendly error on failure', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockAuth.signOut.mockResolvedValueOnce({
      error: { message: 'Network error', name: 'AuthError', status: 500, code: 'network_error', __isAuthError: true, toJSON: () => ({}) },
    } as any);
    await expect(signOut()).rejects.toThrow(
      'Sign out failed. Please try again.',
    );
  });
});

describe('loadProfile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the user profile when found', async () => {
    const mockProfile = {
      id: 'user-123',
      display_name: 'Leon',
      avatar_url: null,
      bio: null,
      privacy_setting: 'public',
      created_at: '2026-01-01T00:00:00Z',
    };
    const qb = makeQueryBuilder({ data: mockProfile, error: null });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    const result = await loadProfile('user-123');
    expect(result).toEqual(mockProfile);
  });

  it('returns null when the profile row does not exist (PGRST116)', async () => {
    const qb = makeQueryBuilder({ data: null, error: { code: 'PGRST116' } });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    const result = await loadProfile('new-user');
    expect(result).toBeNull();
  });

  it('throws when an unexpected error occurs', async () => {
    const qb = makeQueryBuilder({
      data: null,
      error: { code: 'UNKNOWN', message: 'DB error' },
    });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    await expect(loadProfile('user-123')).rejects.toThrow(
      'Failed to load profile.',
    );
  });
});

describe('upsertProfile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the updated profile on success', async () => {
    const updated = {
      id: 'user-123',
      display_name: 'New Name',
      avatar_url: null,
      bio: 'I climb V5',
      privacy_setting: 'followers_only',
      created_at: '2026-01-01T00:00:00Z',
    };
    const qb = makeQueryBuilder({ data: updated, error: null });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    const result = await upsertProfile('user-123', {
      display_name: 'New Name',
      privacy_setting: 'followers_only',
    });
    expect(result).toEqual(updated);
  });

  it('throws a user-friendly error on failure', async () => {
    const qb = makeQueryBuilder({ data: null, error: { message: 'DB error' } });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    await expect(
      upsertProfile('user-123', { display_name: 'x' }),
    ).rejects.toThrow('Failed to save profile.');
  });
});

describe('uploadAvatar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns a URL with a ?v= cache-busting query parameter (INT-024)', async () => {
    // The storage mock always returns 'https://example.com/avatar.jpg' from
    // getPublicUrl; uploadAvatar must append ?v=<timestamp> so every replace
    // produces a distinct URL, preventing device / CDN cache hits.
    const url = await uploadAvatar('user-123', 'file:///tmp/photo.jpg');
    expect(url).toMatch(/^https:\/\/example\.com\/avatar\.jpg\?v=\d+$/);
  });

  it('throws a user-friendly error when the storage upload fails', async () => {
    const mockStorage = supabase.storage as jest.Mocked<typeof supabase.storage>;
    (mockStorage.from as jest.Mock).mockReturnValueOnce({
      upload: jest.fn().mockResolvedValue({ error: { message: 'Storage error' } }),
      getPublicUrl: jest.fn().mockReturnValue({ data: { publicUrl: '' } }),
    });

    await expect(uploadAvatar('user-123', 'file:///tmp/photo.jpg')).rejects.toThrow(
      'Failed to upload photo. Please try again.',
    );
  });

  it('throws when a remote https:// URL is passed (AC-201 Q-B guard)', async () => {
    // uploadAvatar must only accept local file URIs. Passing a remote URL
    // (e.g. a Google CDN URL) must be rejected immediately so EditProfileScreen
    // cannot accidentally upload a remote avatar_url as a local file.
    await expect(
      uploadAvatar('user-123', 'https://lh3.googleusercontent.com/photo.jpg'),
    ).rejects.toThrow('uploadAvatar requires a local file URI');
  });
});

// ── AC-201: Apple Sign-In display_name prefill ────────────────────────────────

describe('signInWithApple AC-201 display_name prefill', () => {
  const mockAppleAuth = AppleAuthentication as jest.Mocked<typeof AppleAuthentication>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fills display_name when credential.fullName is provided and display_name is currently empty', async () => {
    // Arrange
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockAppleAuth.isAvailableAsync as jest.Mock).mockResolvedValueOnce(true);
    (mockAppleAuth.signInAsync as jest.Mock).mockResolvedValueOnce({
      identityToken: 'mock-token',
      authorizationCode: 'mock-code',
      fullName: { givenName: 'Leon', familyName: 'Wu', middleName: null, namePrefix: null, nameSuffix: null, nickname: null },
      email: 'leon@example.com',
      user: 'user-apple-123',
      realUserStatus: 1,
      state: null,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockAuth.signInWithIdToken.mockResolvedValueOnce({ data: { user: null, session: null }, error: null } as any);
    // fillDisplayNameIfEmpty: getSession → select → update
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockAuth.getSession.mockResolvedValueOnce({ data: { session: { user: { id: 'user-apple-123' } } } } as any);
    // select display_name → empty
    const selectQb = makeQueryBuilder({ data: { display_name: '' }, error: null });
    const updateQb = makeQueryBuilder({ data: null, error: null });
    mockFrom
      .mockReturnValueOnce(selectQb as unknown as ReturnType<typeof supabase.from>)
      .mockReturnValueOnce(updateQb as unknown as ReturnType<typeof supabase.from>);

    // Act
    await signInWithApple();

    // Assert — select was called to read display_name, update was called to write it
    expect(mockFrom).toHaveBeenCalledTimes(2);
    expect(selectQb.select).toHaveBeenCalledWith('display_name');
    expect(updateQb.update).toHaveBeenCalledWith({ display_name: 'Leon Wu' });
  });

  it('skips display_name update when credential.fullName is nil (subsequent sign-ins)', async () => {
    // Apple sends fullName only on the very first sign-in. On later sign-ins it
    // is null, so no in-app update should be attempted.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockAppleAuth.isAvailableAsync as jest.Mock).mockResolvedValueOnce(true);
    (mockAppleAuth.signInAsync as jest.Mock).mockResolvedValueOnce({
      identityToken: 'mock-token',
      authorizationCode: null,
      fullName: null,
      email: null,
      user: 'user-apple-123',
      realUserStatus: 1,
      state: null,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockAuth.signInWithIdToken.mockResolvedValueOnce({ data: { user: null, session: null }, error: null } as any);

    await signInWithApple();

    // No from() calls — composedName is empty, update is skipped
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockAuth.getSession).not.toHaveBeenCalled();
  });

  it('skips display_name update when display_name is already non-empty (existing profile)', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockAppleAuth.isAvailableAsync as jest.Mock).mockResolvedValueOnce(true);
    (mockAppleAuth.signInAsync as jest.Mock).mockResolvedValueOnce({
      identityToken: 'mock-token',
      authorizationCode: null,
      fullName: { givenName: 'Leon', familyName: 'Wu', middleName: null, namePrefix: null, nameSuffix: null, nickname: null },
      email: null,
      user: 'user-apple-123',
      realUserStatus: 1,
      state: null,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockAuth.signInWithIdToken.mockResolvedValueOnce({ data: { user: null, session: null }, error: null } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockAuth.getSession.mockResolvedValueOnce({ data: { session: { user: { id: 'user-apple-123' } } } } as any);
    // display_name is already set — update must NOT be called
    const selectQb = makeQueryBuilder({ data: { display_name: 'Existing Name' }, error: null });
    mockFrom.mockReturnValueOnce(selectQb as unknown as ReturnType<typeof supabase.from>);

    await signInWithApple();

    // Only one from() call (the select); no second from() call for update
    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(selectQb.update).not.toHaveBeenCalled();
  });
});

// ── AC-201 Q-B: Google Sign-In avatar bucket copy ────────────────────────────

describe('signInWithGoogle AC-201 Q-B: avatar copy to bucket', () => {
  /** Helper: mock the OAuth redirect part so signInWithGoogle reaches setSession */
  function setupGoogleOAuthMocks(): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockAuth.signInWithOAuth as jest.Mock).mockResolvedValueOnce({ data: { url: 'https://oauth.google.com/auth' }, error: null } as any);
    const fakeRedirectUrl = 'projectday://auth#access_token=tok&refresh_token=ref&token_type=bearer';
    (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValueOnce({ type: 'success', url: fakeRedirectUrl });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockAuth.setSession as jest.Mock).mockResolvedValueOnce({ data: { session: null, user: null }, error: null } as any);
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('copies Google avatar to bucket when avatar_url is a Google URL', async () => {
    setupGoogleOAuthMocks();

    // copyGoogleAvatarToBucket: getSession → select → fetch → storage upload → storage getPublicUrl → update
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockAuth.getSession.mockResolvedValueOnce({ data: { session: { user: { id: 'user-g-1' } } } } as any);

    const selectQb = makeQueryBuilder({
      data: { avatar_url: 'https://lh3.googleusercontent.com/a-/photo.jpg' },
      error: null,
    });
    const updateQb = makeQueryBuilder({ data: null, error: null });
    mockFrom
      .mockReturnValueOnce(selectQb as unknown as ReturnType<typeof supabase.from>)
      .mockReturnValueOnce(updateQb as unknown as ReturnType<typeof supabase.from>);

    // Mock global.fetch for image download
    const mockFetchResponse = {
      ok: true,
      status: 200,
      headers: { get: (h: string) => (h === 'content-type' ? 'image/jpeg' : null) },
      arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(8)),
    };
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(mockFetchResponse as unknown as Response);

    await signInWithGoogle();

    // Verify the copy chain ran
    expect(global.fetch).toHaveBeenCalledWith('https://lh3.googleusercontent.com/a-/photo.jpg');
    expect(supabase.storage.from).toHaveBeenCalledWith('avatars');
    expect(updateQb.update).toHaveBeenCalledWith(
      expect.objectContaining({ avatar_url: expect.stringMatching(/^https:\/\/example\.com\/avatar\.jpg\?v=\d+$/) }),
    );
  });

  it('skips avatar copy when avatar_url is not a Google URL', async () => {
    setupGoogleOAuthMocks();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockAuth.getSession.mockResolvedValueOnce({ data: { session: { user: { id: 'user-g-1' } } } } as any);

    const selectQb = makeQueryBuilder({
      data: { avatar_url: 'https://example.supabase.co/storage/v1/object/public/avatars/user-g-1.jpg' },
      error: null,
    });
    mockFrom.mockReturnValueOnce(selectQb as unknown as ReturnType<typeof supabase.from>);

    const fetchSpy = jest.spyOn(global, 'fetch');

    await signInWithGoogle();

    // avatar_url is not a Google URL — fetch must not be called
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('skips avatar copy when avatar_url is null', async () => {
    setupGoogleOAuthMocks();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockAuth.getSession.mockResolvedValueOnce({ data: { session: { user: { id: 'user-g-1' } } } } as any);

    const selectQb = makeQueryBuilder({ data: { avatar_url: null }, error: null });
    mockFrom.mockReturnValueOnce(selectQb as unknown as ReturnType<typeof supabase.from>);

    const fetchSpy = jest.spyOn(global, 'fetch');

    await signInWithGoogle();

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('does not throw when the download fails — Google URL stays as fallback', async () => {
    setupGoogleOAuthMocks();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockAuth.getSession.mockResolvedValueOnce({ data: { session: { user: { id: 'user-g-1' } } } } as any);

    const selectQb = makeQueryBuilder({
      data: { avatar_url: 'https://lh3.googleusercontent.com/a-/photo.jpg' },
      error: null,
    });
    mockFrom.mockReturnValueOnce(selectQb as unknown as ReturnType<typeof supabase.from>);

    // Simulate a network failure during download
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({ ok: false, status: 503 } as unknown as Response);

    // signInWithGoogle must resolve without throwing even though the copy failed
    await expect(signInWithGoogle()).resolves.toBeUndefined();
  });
});
