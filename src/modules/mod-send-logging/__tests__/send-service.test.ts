/**
 * Tests for mod-send-logging/send-service.ts
 *
 * Tests behaviour — not implementation.
 * All Supabase calls are mocked; no real network activity.
 */

// ── Mock supabase before any import ──────────────────────────────────────────
jest.mock('../../../lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

// ── Imports after mocks ───────────────────────────────────────────────────────
import { supabase } from '../../../lib/supabase';
import { deleteAscent, loadAscentsForRoute, logAscent } from '../send-service';
import type { Ascent, AscentWithProfile } from '../types';

// ── Typed mock helpers ────────────────────────────────────────────────────────
const mockFrom = supabase.from as jest.MockedFunction<typeof supabase.from>;

/**
 * Builds a chainable query builder that resolves to `result`.
 * Mirrors the approach used in mod-route-catalog tests.
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

const MOCK_ASCENT: Ascent = {
  id: 'ascent-001',
  user_id: 'user-001',
  route_id: 'route-001',
  style: 'top',
  attempts: 3,
  note: null,
  logged_at: '2026-09-20T10:00:00Z',
  is_private: false,
};

const MOCK_ASCENT_WITH_PROFILE: AscentWithProfile = {
  ...MOCK_ASCENT,
  display_name: 'Leon',
};

// ── logAscent ─────────────────────────────────────────────────────────────────

describe('logAscent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('inserts an ascent row and returns the created Ascent', async () => {
    const qb = makeQueryBuilder({ data: MOCK_ASCENT, error: null });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    const result = await logAscent('user-001', {
      route_id: 'route-001',
      style: 'top',
      attempts: 3,
      note: null,
      logged_at: '2026-09-20T00:00:00.000Z',
      is_private: false,
    });

    expect(result).toEqual(MOCK_ASCENT);
    expect(mockFrom).toHaveBeenCalledWith('ascents');
    expect(qb.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-001',
        route_id: 'route-001',
        style: 'top',
        attempts: 3,
        is_private: false,
      }),
    );
  });

  it('does not include a grade field in the insert payload', async () => {
    const qb = makeQueryBuilder({ data: MOCK_ASCENT, error: null });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    await logAscent('user-001', {
      route_id: 'route-001',
      style: 'flash',
      attempts: 1,
      note: null,
      logged_at: '2026-09-20T00:00:00.000Z',
      is_private: false,
    });

    const insertPayload = (qb.insert as jest.Mock).mock.calls[0][0];
    expect(insertPayload).not.toHaveProperty('grade');
  });

  it('throws a user-friendly error on network / DB failure', async () => {
    const qb = makeQueryBuilder({
      data: null,
      error: { code: 'PGRST301', message: 'network error' },
    });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    await expect(
      logAscent('user-001', {
        route_id: 'route-001',
        style: 'top',
        attempts: 1,
        note: null,
        logged_at: '2026-09-20T00:00:00.000Z',
        is_private: false,
      }),
    ).rejects.toThrow(
      'Failed to save your send. Please check your connection and try again.',
    );
  });

  it('stores note as null when the input note is null', async () => {
    const ascentWithoutNote = { ...MOCK_ASCENT, note: null };
    const qb = makeQueryBuilder({ data: ascentWithoutNote, error: null });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    const result = await logAscent('user-001', {
      route_id: 'route-001',
      style: 'top',
      attempts: 2,
      note: null,
      logged_at: '2026-09-20T00:00:00.000Z',
      is_private: false,
    });

    expect(result.note).toBeNull();
    const insertPayload = (qb.insert as jest.Mock).mock.calls[0][0];
    expect(insertPayload.note).toBeNull();
  });

  it('stores is_private = true when the user marks the send private', async () => {
    const privateAscent = { ...MOCK_ASCENT, is_private: true };
    const qb = makeQueryBuilder({ data: privateAscent, error: null });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    const result = await logAscent('user-001', {
      route_id: 'route-001',
      style: 'top',
      attempts: 1,
      note: null,
      logged_at: '2026-09-20T00:00:00.000Z',
      is_private: true,
    });

    expect(result.is_private).toBe(true);
    const insertPayload = (qb.insert as jest.Mock).mock.calls[0][0];
    expect(insertPayload.is_private).toBe(true);
  });
});

// ── loadAscentsForRoute ───────────────────────────────────────────────────────

describe('loadAscentsForRoute', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns ascents with display_name joined from users', async () => {
    const rawRow = { ...MOCK_ASCENT, users: { display_name: 'Leon' } };
    const qb = makeQueryBuilder({ data: [rawRow], error: null });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    const result = await loadAscentsForRoute('route-001');

    expect(result).toHaveLength(1);
    expect(result[0].display_name).toBe('Leon');
    expect(result[0].id).toBe(MOCK_ASCENT_WITH_PROFILE.id);
    expect(mockFrom).toHaveBeenCalledWith('ascents');
    expect(qb.eq).toHaveBeenCalledWith('route_id', 'route-001');
    expect(qb.order).toHaveBeenCalledWith('logged_at', { ascending: false });
  });

  it('returns an empty array when there are no ascents', async () => {
    const qb = makeQueryBuilder({ data: [], error: null });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    const result = await loadAscentsForRoute('route-001');

    expect(result).toEqual([]);
  });

  it('returns an empty array when data is null', async () => {
    const qb = makeQueryBuilder({ data: null, error: null });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    const result = await loadAscentsForRoute('route-001');

    expect(result).toEqual([]);
  });

  it('throws a user-friendly error on DB failure', async () => {
    const qb = makeQueryBuilder({
      data: null,
      error: { code: 'PGRST301', message: 'DB error' },
    });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    await expect(loadAscentsForRoute('route-001')).rejects.toThrow(
      'Failed to load sends for this route. Please try again.',
    );
  });

  it('falls back to "Unknown" display_name when users join returns null', async () => {
    const rawRow = { ...MOCK_ASCENT, users: null };
    const qb = makeQueryBuilder({ data: [rawRow], error: null });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    const result = await loadAscentsForRoute('route-001');

    expect(result[0].display_name).toBe('Unknown');
  });
});

// ── deleteAscent ──────────────────────────────────────────────────────────────

describe('deleteAscent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deletes an ascent row by ID without returning data', async () => {
    const qb = makeQueryBuilder({ data: null, error: null });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    await expect(deleteAscent('ascent-001')).resolves.toBeUndefined();

    expect(mockFrom).toHaveBeenCalledWith('ascents');
    expect(qb.delete).toHaveBeenCalled();
    expect(qb.eq).toHaveBeenCalledWith('id', 'ascent-001');
  });

  it('throws a user-friendly error on network / DB failure', async () => {
    const qb = makeQueryBuilder({
      data: null,
      error: { code: 'PGRST301', message: 'network error' },
    });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    await expect(deleteAscent('ascent-001')).rejects.toThrow(
      'Failed to delete your send. Please try again.',
    );
  });
});
