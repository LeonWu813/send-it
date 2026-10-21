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

// AC-054: expo-notifications mock — permissions granted, token available.
jest.mock('expo-notifications', () => ({
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted', granted: true }),
  getExpoPushTokenAsync: jest.fn().mockResolvedValue({ data: 'ExponentPushToken[test]' }),
}));

// AC-054: registerDeviceToken mock — prevents real Supabase calls in tests.
jest.mock('../../mod-notifications/notification-service', () => ({
  registerDeviceToken: jest.fn().mockResolvedValue(undefined),
}));

// ── Imports after mocks ───────────────────────────────────────────────────────
import { act, renderHook, waitFor } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import { PermissionStatus } from 'expo-modules-core';
import { supabase } from '../../../lib/supabase';
import { loadProfile } from '../auth-service';
import { registerDeviceToken } from '../../mod-notifications';
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
const mockRequestPermissions = Notifications.requestPermissionsAsync as jest.MockedFunction<
  typeof Notifications.requestPermissionsAsync
>;
const mockGetExpoPushToken = Notifications.getExpoPushTokenAsync as jest.MockedFunction<
  typeof Notifications.getExpoPushTokenAsync
>;
const mockRegisterDeviceToken = registerDeviceToken as jest.MockedFunction<typeof registerDeviceToken>;

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
    // Default AC-054 mocks: permissions granted, token available.
    mockRequestPermissions.mockResolvedValue({ status: PermissionStatus.GRANTED, granted: true, expires: 'never', canAskAgain: true });
    mockGetExpoPushToken.mockResolvedValue({ data: 'ExponentPushToken[test]', type: 'expo' });
    mockRegisterDeviceToken.mockResolvedValue(undefined);
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

  // AC-054: device token registration on SIGNED_IN event
  it('calls registerDeviceToken with expo push token on SIGNED_IN (AC-054)', async () => {
    type AuthChangeCallback = Parameters<typeof supabase.auth.onAuthStateChange>[0];
    let capturedCallback: AuthChangeCallback = async () => { /* placeholder */ };

    mockOnAuthStateChange.mockImplementation((cb: AuthChangeCallback) => {
      capturedCallback = cb;
      return makeSubscription();
    });
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });

    renderHook(() => useSession());

    const fakeSession = {
      user: { id: 'user-abc' },
      access_token: 'tok',
    } as unknown as import('@supabase/supabase-js').Session;

    // Fire the SIGNED_IN auth state change event
    act(() => {
      capturedCallback('SIGNED_IN', fakeSession);
    });

    // Wait for the async fire-and-forget registration to complete
    await waitFor(() => expect(mockRegisterDeviceToken).toHaveBeenCalledTimes(1));
    expect(mockRequestPermissions).toHaveBeenCalledTimes(1);
    expect(mockGetExpoPushToken).toHaveBeenCalledTimes(1);
    expect(mockRegisterDeviceToken).toHaveBeenCalledWith(
      'ExponentPushToken[test]',
      'ExponentPushToken[test]',
    );
  });

  it('skips device token registration when permissions are denied (AC-054)', async () => {
    type AuthChangeCallback = Parameters<typeof supabase.auth.onAuthStateChange>[0];
    let capturedCallback: AuthChangeCallback = async () => { /* placeholder */ };

    mockOnAuthStateChange.mockImplementation((cb: AuthChangeCallback) => {
      capturedCallback = cb;
      return makeSubscription();
    });
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    mockRequestPermissions.mockResolvedValue({ status: PermissionStatus.DENIED, granted: false, expires: 'never', canAskAgain: false });

    renderHook(() => useSession());

    const fakeSession = {
      user: { id: 'user-abc' },
      access_token: 'tok',
    } as unknown as import('@supabase/supabase-js').Session;

    act(() => {
      capturedCallback('SIGNED_IN', fakeSession);
    });

    // Give the async path time to run
    await waitFor(() => expect(mockRequestPermissions).toHaveBeenCalledTimes(1));
    // Token fetch and registration must not be called when permission is denied
    expect(mockGetExpoPushToken).not.toHaveBeenCalled();
    expect(mockRegisterDeviceToken).not.toHaveBeenCalled();
  });

  it('does not call registerDeviceToken on non-SIGNED_IN events (AC-054)', async () => {
    type AuthChangeCallback = Parameters<typeof supabase.auth.onAuthStateChange>[0];
    let capturedCallback: AuthChangeCallback = async () => { /* placeholder */ };

    mockOnAuthStateChange.mockImplementation((cb: AuthChangeCallback) => {
      capturedCallback = cb;
      return makeSubscription();
    });
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });

    renderHook(() => useSession());

    const fakeSession = {
      user: { id: 'user-abc' },
      access_token: 'tok',
    } as unknown as import('@supabase/supabase-js').Session;

    // TOKEN_REFRESHED is not SIGNED_IN — should not trigger registration
    act(() => {
      capturedCallback('TOKEN_REFRESHED', fakeSession);
    });

    // Allow any micro-task ticks to run
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(mockRegisterDeviceToken).not.toHaveBeenCalled();
  });
});
