/**
 * Tests for mod-moderation/moderation-service.ts
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
  },
}));

// ── Imports after mocks ───────────────────────────────────────────────────────
import { supabase } from '../../../lib/supabase';
import {
  blockUser,
  fetchBlockedUserIds,
  isBlocked,
  reportUser,
  unblockUser,
} from '../moderation-service';

// ── Typed mock helpers ────────────────────────────────────────────────────────
const mockFrom = supabase.from as jest.MockedFunction<typeof supabase.from>;
const mockGetSession = supabase.auth.getSession as jest.MockedFunction<
  typeof supabase.auth.getSession
>;

const MOCK_USER_ID = 'user-current-001';
const MOCK_TARGET_ID = 'user-target-002';

/** Returns a resolved getSession result for the given user ID. */
function mockSessionSuccess(userId: string = MOCK_USER_ID) {
  mockGetSession.mockResolvedValueOnce({
    data: { session: { user: { id: userId } } },
    error: null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test helper cast
  } as any);
}

/** Returns a resolved getSession result with no active session. */
function mockSessionUnauthenticated() {
  mockGetSession.mockResolvedValueOnce({
    data: { session: null },
    error: null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test helper cast
  } as any);
}

/**
 * Builds a chainable Supabase query builder that resolves to `result`.
 * Mirrors the pattern used in mod-send-logging and mod-route-catalog tests.
 */
function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const resolvedPromise = Promise.resolve(result);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test mock
  const builder: any = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(result),
    then: resolvedPromise.then.bind(resolvedPromise),
    catch: resolvedPromise.catch.bind(resolvedPromise),
    finally: resolvedPromise.finally.bind(resolvedPromise),
  };

  return builder;
}

// ── blockUser ─────────────────────────────────────────────────────────────────

describe('blockUser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('inserts a block row with blocker_user_id and blocked_user_id', async () => {
    mockSessionSuccess();
    const qb = makeQueryBuilder({ data: null, error: null });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    await expect(blockUser(MOCK_TARGET_ID)).resolves.toBeUndefined();

    expect(mockFrom).toHaveBeenCalledWith('blocks');
    expect(qb.insert).toHaveBeenCalledWith({
      blocker_user_id: MOCK_USER_ID,
      blocked_user_id: MOCK_TARGET_ID,
    });
  });

  it('throws when the user tries to block themselves', async () => {
    mockSessionSuccess();

    await expect(blockUser(MOCK_USER_ID)).rejects.toThrow('Cannot block yourself');
    // Must not reach Supabase — guard fires before the network call
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('throws a user-facing error when not authenticated', async () => {
    mockSessionUnauthenticated();

    await expect(blockUser(MOCK_TARGET_ID)).rejects.toThrow('Not authenticated.');
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('treats a duplicate block (23505 unique_violation) as success (idempotent)', async () => {
    mockSessionSuccess();
    const qb = makeQueryBuilder({
      data: null,
      error: { code: '23505', message: 'duplicate key' },
    });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    await expect(blockUser(MOCK_TARGET_ID)).resolves.toBeUndefined();
  });

  it('throws a user-facing error on non-duplicate DB failure', async () => {
    mockSessionSuccess();
    const qb = makeQueryBuilder({
      data: null,
      error: { code: 'PGRST301', message: 'network error' },
    });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    await expect(blockUser(MOCK_TARGET_ID)).rejects.toThrow('Action failed. Please try again.');
  });
});

// ── unblockUser ───────────────────────────────────────────────────────────────

describe('unblockUser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deletes the block row matching blocker and blocked user IDs', async () => {
    mockSessionSuccess();
    const qb = makeQueryBuilder({ data: null, error: null });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    await expect(unblockUser(MOCK_TARGET_ID)).resolves.toBeUndefined();

    expect(mockFrom).toHaveBeenCalledWith('blocks');
    expect(qb.delete).toHaveBeenCalled();
    expect(qb.eq).toHaveBeenCalledWith('blocker_user_id', MOCK_USER_ID);
    expect(qb.eq).toHaveBeenCalledWith('blocked_user_id', MOCK_TARGET_ID);
  });

  it('throws a user-facing error when not authenticated', async () => {
    mockSessionUnauthenticated();

    await expect(unblockUser(MOCK_TARGET_ID)).rejects.toThrow('Not authenticated.');
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('throws a user-facing error on DB failure', async () => {
    mockSessionSuccess();
    const qb = makeQueryBuilder({
      data: null,
      error: { code: 'PGRST301', message: 'DB error' },
    });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    await expect(unblockUser(MOCK_TARGET_ID)).rejects.toThrow('Action failed. Please try again.');
  });
});

// ── fetchBlockedUserIds ───────────────────────────────────────────────────────

describe('fetchBlockedUserIds', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the IDs of users blocked by the current user', async () => {
    mockSessionSuccess();
    const rows = [
      { blocker_user_id: MOCK_USER_ID, blocked_user_id: 'user-A' },
      { blocker_user_id: MOCK_USER_ID, blocked_user_id: 'user-B' },
    ];
    const qb = makeQueryBuilder({ data: rows, error: null });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    const result = await fetchBlockedUserIds();

    expect(result).toBeInstanceOf(Set);
    expect(result.has('user-A')).toBe(true);
    expect(result.has('user-B')).toBe(true);
    expect(result.size).toBe(2);
  });

  it('returns the IDs of users who have blocked the current user', async () => {
    mockSessionSuccess();
    const rows = [
      { blocker_user_id: 'user-C', blocked_user_id: MOCK_USER_ID },
    ];
    const qb = makeQueryBuilder({ data: rows, error: null });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    const result = await fetchBlockedUserIds();

    expect(result.has('user-C')).toBe(true);
    expect(result.size).toBe(1);
  });

  it('returns an empty Set when there are no block relationships', async () => {
    mockSessionSuccess();
    const qb = makeQueryBuilder({ data: [], error: null });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    const result = await fetchBlockedUserIds();

    expect(result).toBeInstanceOf(Set);
    expect(result.size).toBe(0);
  });

  it('returns an empty Set when not authenticated', async () => {
    mockSessionUnauthenticated();

    const result = await fetchBlockedUserIds();

    expect(result).toBeInstanceOf(Set);
    expect(result.size).toBe(0);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('throws a user-facing error on DB failure', async () => {
    mockSessionSuccess();
    const qb = makeQueryBuilder({
      data: null,
      error: { code: 'PGRST301', message: 'DB error' },
    });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    await expect(fetchBlockedUserIds()).rejects.toThrow(
      'Failed to load block list. Please try again.',
    );
  });
});

// ── isBlocked ─────────────────────────────────────────────────────────────────

describe('isBlocked', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns true when a block relationship exists for the given user ID', async () => {
    mockSessionSuccess();
    const rows = [{ blocker_user_id: MOCK_USER_ID, blocked_user_id: MOCK_TARGET_ID }];
    const qb = makeQueryBuilder({ data: rows, error: null });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    const result = await isBlocked(MOCK_TARGET_ID);

    expect(result).toBe(true);
  });

  it('returns false when no block relationship exists for the given user ID', async () => {
    mockSessionSuccess();
    const qb = makeQueryBuilder({ data: [], error: null });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    const result = await isBlocked(MOCK_TARGET_ID);

    expect(result).toBe(false);
  });
});

// ── reportUser ────────────────────────────────────────────────────────────────

describe('reportUser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('inserts a report row with the correct payload', async () => {
    mockSessionSuccess();
    const qb = makeQueryBuilder({ data: null, error: null });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    await expect(reportUser(MOCK_TARGET_ID, 'spam')).resolves.toBeUndefined();

    expect(mockFrom).toHaveBeenCalledWith('reports');
    expect(qb.insert).toHaveBeenCalledWith({
      reporter_user_id: MOCK_USER_ID,
      target_type: 'user',
      target_id: MOCK_TARGET_ID,
      category: 'spam',
      note: null,
      status: 'open',
    });
  });

  it('passes an optional note when provided', async () => {
    mockSessionSuccess();
    const qb = makeQueryBuilder({ data: null, error: null });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    await reportUser(MOCK_TARGET_ID, 'harassment', 'Threatening message');

    const insertPayload = (qb.insert as jest.Mock).mock.calls[0][0];
    expect(insertPayload.note).toBe('Threatening message');
  });

  it('stores null for note when no note is provided', async () => {
    mockSessionSuccess();
    const qb = makeQueryBuilder({ data: null, error: null });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    await reportUser(MOCK_TARGET_ID, 'inappropriate');

    const insertPayload = (qb.insert as jest.Mock).mock.calls[0][0];
    expect(insertPayload.note).toBeNull();
  });

  it('throws when the user tries to report themselves', async () => {
    mockSessionSuccess();

    await expect(reportUser(MOCK_USER_ID, 'spam')).rejects.toThrow('Cannot report yourself');
    // Must not reach Supabase — guard fires before the network call
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('throws a user-facing error when not authenticated', async () => {
    mockSessionUnauthenticated();

    await expect(reportUser(MOCK_TARGET_ID, 'other')).rejects.toThrow('Not authenticated.');
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('throws a user-facing error on DB failure', async () => {
    mockSessionSuccess();
    const qb = makeQueryBuilder({
      data: null,
      error: { code: 'PGRST301', message: 'permission denied' },
    });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    await expect(reportUser(MOCK_TARGET_ID, 'spam')).rejects.toThrow(
      'Failed to submit report. Please try again.',
    );
  });
});
