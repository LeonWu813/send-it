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
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}));

jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
  openAuthSessionAsync: jest.fn(),
}));

jest.mock('expo-auth-session', () => ({
  makeRedirectUri: jest.fn(() => 'send-it://auth'),
}));

jest.mock('expo-crypto', () => ({
  getRandomBytesAsync: jest.fn().mockResolvedValue(new Uint8Array(16)),
  digestStringAsync: jest.fn().mockResolvedValue('hashed-nonce'),
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
}));

// ── Imports after mocks ───────────────────────────────────────────────────────
import { supabase } from '../../../lib/supabase';
import {
  loadProfile,
  signInWithEmail,
  signOut,
  signUpWithEmail,
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
