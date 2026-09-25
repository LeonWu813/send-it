/**
 * Tests for mod-social-feed/social-feed-service.ts
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
  fetchActivityFeed,
  fetchFollowerCounts,
  fetchFollowing,
  fetchIsFollowing,
  fetchLikeInfo,
  follow,
  likeBetaVideo,
  unfollow,
  unlikeBetaVideo,
} from '../social-feed-service';

// ── Typed mock helpers ────────────────────────────────────────────────────────
const mockFrom = supabase.from as jest.MockedFunction<typeof supabase.from>;
const mockRpc = supabase.rpc as jest.MockedFunction<typeof supabase.rpc>;
const mockGetSession = supabase.auth.getSession as jest.MockedFunction<
  typeof supabase.auth.getSession
>;

const MOCK_USER_ID = 'user-001';

/**
 * The shape supabase.auth.getSession() returns:
 * { data: { session: Session | null }, error: AuthError | null }
 */
const MOCK_GET_SESSION_RESULT = {
  data: { session: { user: { id: MOCK_USER_ID } } },
  error: null,
};

const MOCK_GET_SESSION_NO_AUTH = {
  data: { session: null },
  error: null,
};

/**
 * Builds a chainable query builder that resolves to `result` when awaited.
 *
 * Supports: select, insert, delete, eq, order, maybeSingle, single.
 * The builder is thenable so `await builder.select().eq()` resolves to `result`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- test mock
function makeQueryBuilder(result: { data: unknown; error: unknown }): any {
  const resolvedPromise = Promise.resolve(result);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test mock
  const builder: any = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue(result),
    single: jest.fn().mockResolvedValue(result),
    then: resolvedPromise.then.bind(resolvedPromise),
  };
  return builder;
}

/**
 * Builds a thenable RPC result (supports .single() chaining).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- test mock
function makeRpcBuilder(result: { data: unknown; error: unknown }): any {
  const resolvedPromise = Promise.resolve(result);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test mock
  const builder: any = {
    single: jest.fn().mockResolvedValue(result),
    then: resolvedPromise.then.bind(resolvedPromise),
  };
  return builder;
}

// ── follow ────────────────────────────────────────────────────────────────────

describe('follow', () => {
  beforeEach(() => jest.resetAllMocks());

  it('inserts a follows row for the given followeeId', async () => {
    const qb = makeQueryBuilder({ data: null, error: null });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    await follow('user-002');

    expect(mockFrom).toHaveBeenCalledWith('follows');
    expect(qb.insert).toHaveBeenCalledWith({ followee_id: 'user-002' });
  });

  it('treats a unique_violation (23505) as a no-op (idempotent)', async () => {
    const qb = makeQueryBuilder({ data: null, error: { code: '23505', message: 'dup' } });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    await expect(follow('user-002')).resolves.toBeUndefined();
  });

  it('throws a user-friendly error on other failures', async () => {
    const qb = makeQueryBuilder({ data: null, error: { code: 'PGRST301', message: 'fail' } });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    await expect(follow('user-002')).rejects.toThrow('Failed to follow user. Please try again.');
  });
});

// ── unfollow ──────────────────────────────────────────────────────────────────

describe('unfollow', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockGetSession.mockResolvedValue(
      MOCK_GET_SESSION_RESULT as unknown as Awaited<ReturnType<typeof supabase.auth.getSession>>,
    );
  });

  it('deletes the follows row matching follower and followee', async () => {
    const qb = makeQueryBuilder({ data: null, error: null });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    await unfollow('user-002');

    expect(mockFrom).toHaveBeenCalledWith('follows');
    expect(qb.delete).toHaveBeenCalled();
    expect(qb.eq).toHaveBeenCalledWith('follower_id', MOCK_USER_ID);
    expect(qb.eq).toHaveBeenCalledWith('followee_id', 'user-002');
  });

  it('throws when not authenticated', async () => {
    mockGetSession.mockResolvedValueOnce(
      MOCK_GET_SESSION_NO_AUTH as unknown as Awaited<ReturnType<typeof supabase.auth.getSession>>,
    );

    await expect(unfollow('user-002')).rejects.toThrow('Not authenticated.');
  });

  it('throws a user-friendly error on Supabase failure', async () => {
    const qb = makeQueryBuilder({ data: null, error: { code: 'PGRST500', message: 'fail' } });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    await expect(unfollow('user-002')).rejects.toThrow('Failed to unfollow user. Please try again.');
  });
});

// ── fetchIsFollowing ──────────────────────────────────────────────────────────

describe('fetchIsFollowing', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockGetSession.mockResolvedValue(
      MOCK_GET_SESSION_RESULT as unknown as Awaited<ReturnType<typeof supabase.auth.getSession>>,
    );
  });

  it('returns true when a follow row exists', async () => {
    const qb = makeQueryBuilder({ data: { follower_id: MOCK_USER_ID }, error: null });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    const result = await fetchIsFollowing('user-002');

    expect(result).toBe(true);
  });

  it('returns false when no follow row exists', async () => {
    const qb = makeQueryBuilder({ data: null, error: null });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    const result = await fetchIsFollowing('user-002');

    expect(result).toBe(false);
  });

  it('returns false when not authenticated', async () => {
    mockGetSession.mockResolvedValueOnce(
      MOCK_GET_SESSION_NO_AUTH as unknown as Awaited<ReturnType<typeof supabase.auth.getSession>>,
    );

    const result = await fetchIsFollowing('user-002');

    expect(result).toBe(false);
  });

  it('throws on Supabase error', async () => {
    const qb = makeQueryBuilder({ data: null, error: { code: 'PGRST500' } });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    await expect(fetchIsFollowing('user-002')).rejects.toThrow(
      'Failed to check follow status. Please try again.',
    );
  });
});

// ── fetchFollowerCounts ───────────────────────────────────────────────────────

describe('fetchFollowerCounts', () => {
  beforeEach(() => jest.resetAllMocks());

  it('returns follower and following counts from the RPC', async () => {
    const rpcBuilder = makeRpcBuilder({
      data: { follower_count: 5, following_count: 10 },
      error: null,
    });
    mockRpc.mockReturnValueOnce(rpcBuilder as unknown as ReturnType<typeof supabase.rpc>);

    const result = await fetchFollowerCounts('user-001');

    expect(result).toEqual({ follower_count: 5, following_count: 10 });
    expect(mockRpc).toHaveBeenCalledWith('get_follower_counts', { p_user_id: 'user-001' });
  });

  it('returns zeros when RPC returns null data', async () => {
    const rpcBuilder = makeRpcBuilder({ data: null, error: null });
    mockRpc.mockReturnValueOnce(rpcBuilder as unknown as ReturnType<typeof supabase.rpc>);

    const result = await fetchFollowerCounts('user-001');

    expect(result).toEqual({ follower_count: 0, following_count: 0 });
  });

  it('throws a user-friendly error on RPC failure', async () => {
    const rpcBuilder = makeRpcBuilder({ data: null, error: { code: 'PGRST500' } });
    mockRpc.mockReturnValueOnce(rpcBuilder as unknown as ReturnType<typeof supabase.rpc>);

    await expect(fetchFollowerCounts('user-001')).rejects.toThrow(
      'Failed to load follower counts. Please try again.',
    );
  });
});

// ── fetchActivityFeed ─────────────────────────────────────────────────────────

describe('fetchActivityFeed', () => {
  beforeEach(() => jest.resetAllMocks());

  it('calls get_activity_feed RPC with default pagination', async () => {
    const mockFeedData = [
      {
        item_type: 'ascent',
        item_id: 'ascent-001',
        actor_user_id: 'user-002',
        actor_name: 'Alice',
        actor_avatar_url: null,
        route_id: 'route-001',
        route_grade: 'V3',
        created_at: '2026-09-24T10:00:00Z',
        ascent_style: 'flash',
        ascent_attempts: 1,
        ascent_note: null,
        video_url: null,
        thumbnail_url: null,
        video_caption: null,
      },
    ];
    const resolvedPromise = Promise.resolve({ data: mockFeedData, error: null });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test mock
    const rpcBuilder: any = { then: resolvedPromise.then.bind(resolvedPromise) };
    mockRpc.mockReturnValueOnce(rpcBuilder as unknown as ReturnType<typeof supabase.rpc>);

    const result = await fetchActivityFeed();

    expect(mockRpc).toHaveBeenCalledWith('get_activity_feed', {
      p_limit: 20,
      p_offset: 0,
    });
    expect(result).toEqual(mockFeedData);
  });

  it('returns an empty array when the feed is empty', async () => {
    const resolvedPromise = Promise.resolve({ data: null, error: null });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test mock
    const rpcBuilder: any = { then: resolvedPromise.then.bind(resolvedPromise) };
    mockRpc.mockReturnValueOnce(rpcBuilder as unknown as ReturnType<typeof supabase.rpc>);

    const result = await fetchActivityFeed();

    expect(result).toEqual([]);
  });

  it('passes custom limit and offset to the RPC', async () => {
    const resolvedPromise = Promise.resolve({ data: [], error: null });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test mock
    const rpcBuilder: any = { then: resolvedPromise.then.bind(resolvedPromise) };
    mockRpc.mockReturnValueOnce(rpcBuilder as unknown as ReturnType<typeof supabase.rpc>);

    await fetchActivityFeed(10, 20);

    expect(mockRpc).toHaveBeenCalledWith('get_activity_feed', {
      p_limit: 10,
      p_offset: 20,
    });
  });

  it('throws a user-friendly error when the RPC fails', async () => {
    const resolvedPromise = Promise.resolve({ data: null, error: { code: 'PGRST500' } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test mock
    const rpcBuilder: any = { then: resolvedPromise.then.bind(resolvedPromise) };
    mockRpc.mockReturnValueOnce(rpcBuilder as unknown as ReturnType<typeof supabase.rpc>);

    await expect(fetchActivityFeed()).rejects.toThrow(
      'Failed to load activity feed. Please try again.',
    );
  });
});

// ── likeBetaVideo ─────────────────────────────────────────────────────────────

describe('likeBetaVideo', () => {
  beforeEach(() => jest.resetAllMocks());

  it('inserts a reaction row with target_type beta_video', async () => {
    const qb = makeQueryBuilder({ data: null, error: null });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    await likeBetaVideo('video-001');

    expect(mockFrom).toHaveBeenCalledWith('reactions');
    expect(qb.insert).toHaveBeenCalledWith({
      target_type: 'beta_video',
      target_id: 'video-001',
    });
  });

  it('treats a unique_violation (23505) as a no-op (idempotent)', async () => {
    const qb = makeQueryBuilder({ data: null, error: { code: '23505', message: 'dup' } });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    await expect(likeBetaVideo('video-001')).resolves.toBeUndefined();
  });

  it('throws a user-friendly error on other failures', async () => {
    const qb = makeQueryBuilder({ data: null, error: { code: 'PGRST500', message: 'fail' } });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    await expect(likeBetaVideo('video-001')).rejects.toThrow('Failed to like video. Please try again.');
  });
});

// ── unlikeBetaVideo ───────────────────────────────────────────────────────────

describe('unlikeBetaVideo', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockGetSession.mockResolvedValue(
      MOCK_GET_SESSION_RESULT as unknown as Awaited<ReturnType<typeof supabase.auth.getSession>>,
    );
  });

  it('deletes the reaction row for the current user and target video', async () => {
    const qb = makeQueryBuilder({ data: null, error: null });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    await unlikeBetaVideo('video-001');

    expect(mockFrom).toHaveBeenCalledWith('reactions');
    expect(qb.delete).toHaveBeenCalled();
    expect(qb.eq).toHaveBeenCalledWith('user_id', MOCK_USER_ID);
    expect(qb.eq).toHaveBeenCalledWith('target_type', 'beta_video');
    expect(qb.eq).toHaveBeenCalledWith('target_id', 'video-001');
  });

  it('throws when not authenticated', async () => {
    mockGetSession.mockResolvedValueOnce(
      MOCK_GET_SESSION_NO_AUTH as unknown as Awaited<ReturnType<typeof supabase.auth.getSession>>,
    );

    await expect(unlikeBetaVideo('video-001')).rejects.toThrow('Not authenticated.');
  });

  it('throws a user-friendly error on failure', async () => {
    const qb = makeQueryBuilder({ data: null, error: { code: 'PGRST500', message: 'fail' } });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    await expect(unlikeBetaVideo('video-001')).rejects.toThrow('Failed to unlike video. Please try again.');
  });
});

// ── fetchLikeInfo ─────────────────────────────────────────────────────────────

describe('fetchLikeInfo', () => {
  beforeEach(() => jest.resetAllMocks());

  it('returns like_count and user_has_liked from the RPC', async () => {
    const rpcBuilder = makeRpcBuilder({
      data: { like_count: 7, user_has_liked: true },
      error: null,
    });
    mockRpc.mockReturnValueOnce(rpcBuilder as unknown as ReturnType<typeof supabase.rpc>);

    const result = await fetchLikeInfo('video-001');

    expect(result).toEqual({ like_count: 7, user_has_liked: true });
    expect(mockRpc).toHaveBeenCalledWith('get_like_info', {
      p_target_type: 'beta_video',
      p_target_id: 'video-001',
    });
  });

  it('returns zeros when RPC data is null', async () => {
    const rpcBuilder = makeRpcBuilder({ data: null, error: null });
    mockRpc.mockReturnValueOnce(rpcBuilder as unknown as ReturnType<typeof supabase.rpc>);

    const result = await fetchLikeInfo('video-001');

    expect(result).toEqual({ like_count: 0, user_has_liked: false });
  });

  it('throws a user-friendly error on RPC failure', async () => {
    const rpcBuilder = makeRpcBuilder({ data: null, error: { code: 'PGRST500' } });
    mockRpc.mockReturnValueOnce(rpcBuilder as unknown as ReturnType<typeof supabase.rpc>);

    await expect(fetchLikeInfo('video-001')).rejects.toThrow(
      'Failed to load like info. Please try again.',
    );
  });
});

// ── fetchFollowing ────────────────────────────────────────────────────────────

describe('fetchFollowing', () => {
  beforeEach(() => jest.resetAllMocks());

  it('returns a flat list of FollowingUser from the joined query', async () => {
    const mockData = [
      {
        followee_id: 'user-002',
        users: { id: 'user-002', display_name: 'Alice', avatar_url: null },
      },
      {
        followee_id: 'user-003',
        users: { id: 'user-003', display_name: 'Bob', avatar_url: 'https://example.com/bob.jpg' },
      },
    ];
    const qb = makeQueryBuilder({ data: mockData, error: null });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    const result = await fetchFollowing('user-001');

    expect(result).toEqual([
      { id: 'user-002', display_name: 'Alice', avatar_url: null },
      { id: 'user-003', display_name: 'Bob', avatar_url: 'https://example.com/bob.jpg' },
    ]);
    expect(mockFrom).toHaveBeenCalledWith('follows');
    expect(qb.eq).toHaveBeenCalledWith('follower_id', 'user-001');
  });

  it('returns an empty array when data is null', async () => {
    const qb = makeQueryBuilder({ data: null, error: null });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    const result = await fetchFollowing('user-001');

    expect(result).toEqual([]);
  });

  it('skips rows where the joined user is null', async () => {
    const mockData = [
      { followee_id: 'user-002', users: null },
    ];
    const qb = makeQueryBuilder({ data: mockData, error: null });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    const result = await fetchFollowing('user-001');

    expect(result).toEqual([]);
  });

  it('throws a user-friendly error on failure', async () => {
    const qb = makeQueryBuilder({ data: null, error: { code: 'PGRST500' } });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    await expect(fetchFollowing('user-001')).rejects.toThrow(
      'Failed to load following list. Please try again.',
    );
  });
});
