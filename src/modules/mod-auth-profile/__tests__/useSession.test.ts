/**
 * Tests for mod-auth-profile/hooks/useSession.ts
 *
 * Verifies that the hook:
 * - Returns isLoading: true initially
 * - Returns the session once loaded
 * - Returns null profile if not found
 */

// ── Mocks before imports ──────────────────────────────────────────────────────
jest.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(),
    },
  },
}));

jest.mock('../auth-service', () => ({
  loadProfile: jest.fn(),
}));

// ── Imports after mocks ───────────────────────────────────────────────────────
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { supabase } from '../../../lib/supabase';
import { loadProfile } from '../auth-service';
import { useSession } from '../hooks/useSession';

// ── Typed mocks ───────────────────────────────────────────────────────────────
const mockGetSession = supabase.auth.getSession as jest.MockedFunction<
  typeof supabase.auth.getSession
>;
const mockOnAuthStateChange = supabase.auth
  .onAuthStateChange as jest.MockedFunction<
  typeof supabase.auth.onAuthStateChange
>;
const mockLoadProfile = loadProfile as jest.MockedFunction<typeof loadProfile>;

function makeSubscription() {
  // ReturnType is Subscription — cast via any for test mock
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return {
    data: { subscription: { unsubscribe: jest.fn() } },
  } as any as ReturnType<typeof supabase.auth.onAuthStateChange>;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useSession', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: no active session
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    mockOnAuthStateChange.mockReturnValue(makeSubscription());
    mockLoadProfile.mockResolvedValue(null);
  });

  it('returns isLoading: true before the session resolves', () => {
    // getSession never resolves during this tick
    mockGetSession.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useSession());
    expect(result.current.isLoading).toBe(true);
  });

  it('returns isLoading: false and session: null when no session exists', async () => {
    const { result } = renderHook(() => useSession());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.session).toBeNull();
    expect(result.current.profile).toBeNull();
  });

  it('returns the session and profile when a session exists', async () => {
    const mockSession = {
      user: { id: 'user-123' },
      access_token: 'token',
    };
    const mockProfile = {
      id: 'user-123',
      display_name: 'Leon',
      avatar_url: null,
      home_gym_id: null,
      bio: null,
      privacy_setting: 'public' as const,
      created_at: '2026-01-01T00:00:00Z',
    };
    mockGetSession.mockResolvedValue({
      data: { session: mockSession as unknown as import('@supabase/supabase-js').Session },
      error: null,
    });
    mockLoadProfile.mockResolvedValue(mockProfile);

    const { result } = renderHook(() => useSession());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.session).toEqual(mockSession);
    expect(result.current.profile).toEqual(mockProfile);
  });

  it('clears profile when session becomes null', async () => {
    type AuthChangeCallback = Parameters<typeof supabase.auth.onAuthStateChange>[0];
    let capturedCallback: AuthChangeCallback = async () => { /* placeholder until onAuthStateChange mock fires */ };

    mockOnAuthStateChange.mockImplementation((cb: AuthChangeCallback) => {
      capturedCallback = cb;
      return makeSubscription();
    });

    const mockSession = { user: { id: 'user-123' }, access_token: 'token' };
    mockGetSession.mockResolvedValue({
      data: { session: mockSession as unknown as import('@supabase/supabase-js').Session },
      error: null,
    });
    mockLoadProfile.mockResolvedValue({
      id: 'user-123',
      display_name: 'Leon',
      avatar_url: null,
      home_gym_id: null,
      bio: null,
      privacy_setting: 'public' as const,
      created_at: '2026-01-01T00:00:00Z',
    });

    const { result } = renderHook(() => useSession());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Simulate sign-out
    act(() => {
      capturedCallback('SIGNED_OUT', null);
    });

    await waitFor(() => expect(result.current.session).toBeNull());
    expect(result.current.profile).toBeNull();
  });
});
