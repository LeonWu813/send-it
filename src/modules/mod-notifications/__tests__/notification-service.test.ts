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
  fetchRouteForBetaVideo,
  fetchUnreadNotificationCount,
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
 * Supports chaining: select, eq, in, order, limit, not, maybeSingle, single.
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
    in: jest.fn().mockReturnThis(),
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

  it('returns a flat list of Notification rows with actor info (two-query approach)', async () => {
    // Step 1: notifications query
    const mockNotifData = [
      {
        id: 'notif-001',
        recipient_user_id: 'user-001',
        actor_user_id: 'user-002',
        type: 'beta_video_like',
        target_type: 'beta_video',
        target_id: 'video-001',
        is_read: false,
        created_at: '2026-09-24T10:00:00Z',
      },
    ];
    const notifQb = makeQueryBuilder({ data: mockNotifData, error: null });

    // Step 2: users batch query for actor info
    const mockActorData = [{ id: 'user-002', display_name: 'Alice', avatar_url: null }];
    const usersQb = makeQueryBuilder({ data: mockActorData, error: null });

    mockFrom
      .mockReturnValueOnce(notifQb as unknown as ReturnType<typeof supabase.from>)
      .mockReturnValueOnce(usersQb as unknown as ReturnType<typeof supabase.from>);

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
    expect(mockFrom).toHaveBeenCalledWith('users');
    expect(notifQb.order).toHaveBeenCalledWith('created_at', { ascending: false });
  });

  it('returns an empty array when notification data is null', async () => {
    const qb = makeQueryBuilder({ data: null, error: null });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    const result = await fetchNotifications();

    expect(result).toEqual([]);
    // Users query should NOT be called when notifications returns null (no data)
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });

  it('returns an empty array when data is an empty array', async () => {
    const qb = makeQueryBuilder({ data: [], error: null });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    const result = await fetchNotifications();

    expect(result).toEqual([]);
    // Users query not called for empty notifications list
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });

  it('handles missing actor info gracefully (actor_user_id not in users response)', async () => {
    const mockNotifData = [
      {
        id: 'notif-002',
        recipient_user_id: 'user-001',
        actor_user_id: 'user-003',
        type: 'beta_video_like',
        target_type: 'beta_video',
        target_id: 'video-002',
        is_read: true,
        created_at: '2026-09-24T09:00:00Z',
      },
    ];
    const notifQb = makeQueryBuilder({ data: mockNotifData, error: null });
    // Users query returns empty (actor not found / deleted)
    const usersQb = makeQueryBuilder({ data: [], error: null });

    mockFrom
      .mockReturnValueOnce(notifQb as unknown as ReturnType<typeof supabase.from>)
      .mockReturnValueOnce(usersQb as unknown as ReturnType<typeof supabase.from>);

    const result = await fetchNotifications();

    expect(result).toHaveLength(1);
    expect(result[0].actor_display_name).toBeUndefined();
    expect(result[0].actor_avatar_url).toBeNull();
  });

  it('handles actor fetch error gracefully (non-fatal — rows still returned)', async () => {
    const mockNotifData = [
      {
        id: 'notif-003',
        recipient_user_id: 'user-001',
        actor_user_id: 'user-004',
        type: 'beta_video_like',
        target_type: 'beta_video',
        target_id: 'video-003',
        is_read: false,
        created_at: '2026-09-24T08:00:00Z',
      },
    ];
    const notifQb = makeQueryBuilder({ data: mockNotifData, error: null });
    // Users query fails — should be non-fatal, rows still returned without actor info
    const usersQb = makeQueryBuilder({ data: null, error: { code: 'PGRST500' } });

    mockFrom
      .mockReturnValueOnce(notifQb as unknown as ReturnType<typeof supabase.from>)
      .mockReturnValueOnce(usersQb as unknown as ReturnType<typeof supabase.from>);

    const result = await fetchNotifications();

    // Rows returned even when actor fetch fails
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

  it('throws a user-friendly error on notifications query failure', async () => {
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

// ── fetchRouteForBetaVideo ────────────────────────────────────────────────────

describe('fetchRouteForBetaVideo', () => {
  beforeEach(() => jest.resetAllMocks());

  it('returns routeId and gymId when the video exists with a route', async () => {
    const mockData = {
      route_id: 'route-001',
      routes: { gym_id: 'gym-001' },
    };
    const qb = makeQueryBuilder({ data: mockData, error: null });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    const result = await fetchRouteForBetaVideo('video-001');

    expect(result).toEqual({ routeId: 'route-001', gymId: 'gym-001' });
    expect(mockFrom).toHaveBeenCalledWith('beta_videos');
    expect(qb.eq).toHaveBeenCalledWith('id', 'video-001');
  });

  it('returns null when the query returns an error', async () => {
    const qb = makeQueryBuilder({ data: null, error: { code: 'PGRST116' } });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    const result = await fetchRouteForBetaVideo('video-missing');

    expect(result).toBeNull();
  });

  it('returns null when data is null', async () => {
    const qb = makeQueryBuilder({ data: null, error: null });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    const result = await fetchRouteForBetaVideo('video-001');

    expect(result).toBeNull();
  });

  it('returns null when route_id is null (video has no route)', async () => {
    const mockData = {
      route_id: null,
      routes: null,
    };
    const qb = makeQueryBuilder({ data: mockData, error: null });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    const result = await fetchRouteForBetaVideo('video-orphan');

    expect(result).toBeNull();
  });

  it('returns null when gym_id is null (route has no gym)', async () => {
    const mockData = {
      route_id: 'route-001',
      routes: { gym_id: null },
    };
    const qb = makeQueryBuilder({ data: mockData, error: null });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    const result = await fetchRouteForBetaVideo('video-orphan');

    expect(result).toBeNull();
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

// ── fetchUnreadNotificationCount (AC-173) ─────────────────────────────────────

describe('fetchUnreadNotificationCount', () => {
  beforeEach(() => jest.resetAllMocks());

  it('returns the count of unread notifications', async () => {
    // Supabase count query returns { count: N, error: null } with head: true.
    const qb = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      // Resolves as { count: 3, error: null } when awaited
      then: Promise.resolve({ count: 3, error: null }).then.bind(
        Promise.resolve({ count: 3, error: null }),
      ),
    };
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    const result = await fetchUnreadNotificationCount();

    expect(result).toBe(3);
    expect(mockFrom).toHaveBeenCalledWith('notifications');
    expect(qb.eq).toHaveBeenCalledWith('is_read', false);
  });

  it('returns 0 when count is null', async () => {
    const qb = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      then: Promise.resolve({ count: null, error: null }).then.bind(
        Promise.resolve({ count: null, error: null }),
      ),
    };
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    const result = await fetchUnreadNotificationCount();

    expect(result).toBe(0);
  });

  it('returns 0 on query error (non-blocking badge)', async () => {
    const qb = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      then: Promise.resolve({ count: null, error: { code: 'PGRST500' } }).then.bind(
        Promise.resolve({ count: null, error: { code: 'PGRST500' } }),
      ),
    };
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    const result = await fetchUnreadNotificationCount();

    expect(result).toBe(0);
  });
});
