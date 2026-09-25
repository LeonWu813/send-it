/**
 * Tests for mod-notifications/notification-service.ts
 *
 * Tests behaviour — not implementation.
 * All Supabase calls are mocked; no real network activity.
 */

// ── Mock supabase before any import ──────────────────────────────────────────
jest.mock('../../../lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    auth: {
      getSession: jest.fn(),
    },
    rpc: jest.fn(),
  },
}));

// ── Imports after mocks ───────────────────────────────────────────────────────
import { supabase } from '../../../lib/supabase';
import {
  fetchNotificationPreference,
  fetchNotifications,
  markNotificationsRead,
  registerDeviceToken,
  updateNotificationPreference,
} from '../notification-service';

// ── Typed mock helpers ────────────────────────────────────────────────────────
const mockFrom = supabase.from as jest.MockedFunction<typeof supabase.from>;
const mockRpc = supabase.rpc as jest.MockedFunction<typeof supabase.rpc>;

/**
 * Builds a chainable query builder that resolves to `result` when awaited.
 *
 * Supports chaining: select, eq, order, limit, not, maybeSingle.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- test mock
function makeQueryBuilder(result: { data: unknown; error: unknown }): any {
  const resolvedPromise = Promise.resolve(result);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test mock
  const builder: any = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    not: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue(result),
    single: jest.fn().mockResolvedValue(result),
    then: resolvedPromise.then.bind(resolvedPromise),
  };
  return builder;
}

/**
 * Builds a thenable RPC result (no chaining needed for these RPCs).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- test mock
function makeRpcResult(result: { data: unknown; error: unknown }): any {
  const resolvedPromise = Promise.resolve(result);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test mock
  const builder: any = {
    then: resolvedPromise.then.bind(resolvedPromise),
  };
  return builder;
}

// ── registerDeviceToken ───────────────────────────────────────────────────────

describe('registerDeviceToken', () => {
  beforeEach(() => jest.resetAllMocks());

  it('calls upsert_device_token RPC with device_token and expo_push_token', async () => {
    const rpc = makeRpcResult({ data: null, error: null });
    mockRpc.mockReturnValueOnce(rpc);

    await registerDeviceToken('device-abc', 'ExponentPushToken[abc]');

    expect(mockRpc).toHaveBeenCalledWith('upsert_device_token', {
      p_device_token: 'device-abc',
      p_expo_push_token: 'ExponentPushToken[abc]',
    });
  });

  it('calls upsert_device_token RPC with null expo_push_token when not provided', async () => {
    const rpc = makeRpcResult({ data: null, error: null });
    mockRpc.mockReturnValueOnce(rpc);

    await registerDeviceToken('device-abc');

    expect(mockRpc).toHaveBeenCalledWith('upsert_device_token', {
      p_device_token: 'device-abc',
      p_expo_push_token: null,
    });
  });

  it('throws a user-friendly error on RPC failure', async () => {
    const rpc = makeRpcResult({ data: null, error: { code: 'PGRST500', message: 'fail' } });
    mockRpc.mockReturnValueOnce(rpc);

    await expect(registerDeviceToken('device-abc')).rejects.toThrow(
      'Failed to register device token. Please try again.',
    );
  });
});

// ── fetchNotifications ────────────────────────────────────────────────────────

describe('fetchNotifications', () => {
  beforeEach(() => jest.resetAllMocks());

  it('returns a flat list of Notification rows with actor info', async () => {
    const mockData = [
      {
        id: 'notif-001',
        recipient_user_id: 'user-001',
        actor_user_id: 'user-002',
        type: 'beta_video_like',
        target_type: 'beta_video',
        target_id: 'video-001',
        is_read: false,
        created_at: '2026-09-24T10:00:00Z',
        users: { display_name: 'Alice', avatar_url: null },
      },
    ];
    const qb = makeQueryBuilder({ data: mockData, error: null });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    const result = await fetchNotifications();

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'notif-001',
      actor_display_name: 'Alice',
      actor_avatar_url: null,
      type: 'beta_video_like',
      is_read: false,
    });
    expect(mockFrom).toHaveBeenCalledWith('notifications');
    expect(qb.order).toHaveBeenCalledWith('created_at', { ascending: false });
  });

  it('returns an empty array when data is null', async () => {
    const qb = makeQueryBuilder({ data: null, error: null });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    const result = await fetchNotifications();

    expect(result).toEqual([]);
  });

  it('handles rows where actor user is null', async () => {
    const mockData = [
      {
        id: 'notif-002',
        recipient_user_id: 'user-001',
        actor_user_id: 'user-003',
        type: 'beta_video_like',
        target_type: 'beta_video',
        target_id: 'video-002',
        is_read: true,
        created_at: '2026-09-24T09:00:00Z',
        users: null,
      },
    ];
    const qb = makeQueryBuilder({ data: mockData, error: null });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    const result = await fetchNotifications();

    expect(result).toHaveLength(1);
    expect(result[0].actor_display_name).toBeUndefined();
    expect(result[0].actor_avatar_url).toBeNull();
  });

  it('respects the limit parameter', async () => {
    const qb = makeQueryBuilder({ data: [], error: null });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    await fetchNotifications(10);

    expect(qb.limit).toHaveBeenCalledWith(10);
  });

  it('throws a user-friendly error on query failure', async () => {
    const qb = makeQueryBuilder({ data: null, error: { code: 'PGRST500' } });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    await expect(fetchNotifications()).rejects.toThrow(
      'Failed to load notifications. Please try again.',
    );
  });
});

// ── markNotificationsRead ─────────────────────────────────────────────────────

describe('markNotificationsRead', () => {
  beforeEach(() => jest.resetAllMocks());

  it('calls mark_notifications_read RPC', async () => {
    const rpc = makeRpcResult({ data: null, error: null });
    mockRpc.mockReturnValueOnce(rpc);

    await markNotificationsRead();

    expect(mockRpc).toHaveBeenCalledWith('mark_notifications_read');
  });

  it('throws a user-friendly error on RPC failure', async () => {
    const rpc = makeRpcResult({ data: null, error: { code: 'PGRST500' } });
    mockRpc.mockReturnValueOnce(rpc);

    await expect(markNotificationsRead()).rejects.toThrow(
      'Failed to mark notifications as read. Please try again.',
    );
  });
});

// ── fetchNotificationPreference ───────────────────────────────────────────────

describe('fetchNotificationPreference', () => {
  beforeEach(() => jest.resetAllMocks());

  it('returns the preference row when it exists', async () => {
    const mockPref = {
      user_id: 'user-001',
      beta_video_like: true,
      updated_at: '2026-09-24T10:00:00Z',
    };
    const qb = makeQueryBuilder({ data: mockPref, error: null });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    const result = await fetchNotificationPreference();

    expect(result).toEqual(mockPref);
    expect(mockFrom).toHaveBeenCalledWith('notification_preferences');
  });

  it('returns null when no preference row exists', async () => {
    const qb = makeQueryBuilder({ data: null, error: null });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    const result = await fetchNotificationPreference();

    expect(result).toBeNull();
  });

  it('returns preference with beta_video_like = false', async () => {
    const mockPref = {
      user_id: 'user-001',
      beta_video_like: false,
      updated_at: '2026-09-24T11:00:00Z',
    };
    const qb = makeQueryBuilder({ data: mockPref, error: null });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    const result = await fetchNotificationPreference();

    expect(result?.beta_video_like).toBe(false);
  });

  it('throws a user-friendly error on query failure', async () => {
    const qb = makeQueryBuilder({ data: null, error: { code: 'PGRST500' } });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    await expect(fetchNotificationPreference()).rejects.toThrow(
      'Failed to load notification preferences. Please try again.',
    );
  });
});

// ── updateNotificationPreference ──────────────────────────────────────────────

describe('updateNotificationPreference', () => {
  beforeEach(() => jest.resetAllMocks());

  it('calls upsert_notification_preference RPC with the given value', async () => {
    const rpc = makeRpcResult({ data: null, error: null });
    mockRpc.mockReturnValueOnce(rpc);

    await updateNotificationPreference(false);

    expect(mockRpc).toHaveBeenCalledWith('upsert_notification_preference', {
      p_beta_video_like: false,
    });
  });

  it('calls RPC with true when enabling push', async () => {
    const rpc = makeRpcResult({ data: null, error: null });
    mockRpc.mockReturnValueOnce(rpc);

    await updateNotificationPreference(true);

    expect(mockRpc).toHaveBeenCalledWith('upsert_notification_preference', {
      p_beta_video_like: true,
    });
  });

  it('throws a user-friendly error on RPC failure', async () => {
    const rpc = makeRpcResult({ data: null, error: { code: 'PGRST500' } });
    mockRpc.mockReturnValueOnce(rpc);

    await expect(updateNotificationPreference(true)).rejects.toThrow(
      'Failed to update notification preferences. Please try again.',
    );
  });
});
