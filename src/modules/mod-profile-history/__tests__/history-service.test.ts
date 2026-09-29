/**
 * Tests for mod-profile-history/history-service.ts
 *
 * Tests behaviour — not implementation.
 * All Supabase calls are mocked; no real network activity.
 */

// ── Mock supabase before any import ──────────────────────────────────────────
jest.mock('../../../lib/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
    from: jest.fn(),
  },
}));

// ── Imports after mocks ───────────────────────────────────────────────────────
import { supabase } from '../../../lib/supabase';
import {
  fetchHistoryGyms,
  fetchProfileHistory,
  fetchProfileStats,
  groupToRouteCards,
} from '../history-service';
import type { HistoryAscent } from '../types';
import { GRADE_ORDER } from '../types';

// ── Typed mock helpers ────────────────────────────────────────────────────────

const mockRpc = supabase.rpc as jest.MockedFunction<typeof supabase.rpc>;
const mockFrom = supabase.from as jest.MockedFunction<typeof supabase.from>;

const MOCK_USER_ID = 'user-001';

// ── fetchProfileHistory ───────────────────────────────────────────────────────

describe('fetchProfileHistory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls get_profile_history RPC with correct params and returns mapped rows', async () => {
    const rawRows = [
      {
        ascent_id: 'asc-001',
        route_id: 'route-001',
        gym_id: 'gym-001',
        gym_name: 'Test Gym',
        grade: 'V3',
        color_tag: 'blue',
        section_label: null,
        style: 'top',
        attempts: 2,
        note: null,
        logged_at: '2026-09-20T10:00:00Z',
        is_private: false,
      },
    ];

    mockRpc.mockReturnValueOnce(
      Promise.resolve({ data: rawRows, error: null }) as unknown as ReturnType<typeof supabase.rpc>,
    );

    const result = await fetchProfileHistory(MOCK_USER_ID);

    expect(result).toHaveLength(1);
    expect(result[0].ascent_id).toBe('asc-001');
    expect(result[0].grade).toBe('V3');
    expect(result[0].gym_name).toBe('Test Gym');
    expect(result[0].style).toBe('top');
    // All filter params must be null — filters removed from this call
    expect(mockRpc).toHaveBeenCalledWith(
      'get_profile_history',
      expect.objectContaining({
        p_user_id: MOCK_USER_ID,
        p_gym_id: null,
        p_grade: null,
        p_date_from: null,
        p_date_to: null,
      }),
    );
  });

  it('returns empty array when data is null (privacy-blocked — zero rows from RPC)', async () => {
    mockRpc.mockReturnValueOnce(
      Promise.resolve({ data: null, error: null }) as unknown as ReturnType<typeof supabase.rpc>,
    );

    const result = await fetchProfileHistory(MOCK_USER_ID);

    expect(result).toEqual([]);
  });

  it('returns empty array when RPC returns empty array', async () => {
    mockRpc.mockReturnValueOnce(
      Promise.resolve({ data: [], error: null }) as unknown as ReturnType<typeof supabase.rpc>,
    );

    const result = await fetchProfileHistory(MOCK_USER_ID);

    expect(result).toEqual([]);
  });

  it('throws a user-facing error on RPC failure', async () => {
    mockRpc.mockReturnValueOnce(
      Promise.resolve({
        data: null,
        error: { code: 'PGRST301', message: 'db error' },
      }) as unknown as ReturnType<typeof supabase.rpc>,
    );

    await expect(
      fetchProfileHistory(MOCK_USER_ID),
    ).rejects.toThrow('Failed to load send history. Please try again.');
  });

  it('always passes null filter params regardless of call site', async () => {
    mockRpc.mockReturnValueOnce(
      Promise.resolve({ data: [], error: null }) as unknown as ReturnType<typeof supabase.rpc>,
    );

    await fetchProfileHistory(MOCK_USER_ID);

    expect(mockRpc).toHaveBeenCalledWith(
      'get_profile_history',
      expect.objectContaining({
        p_gym_id: null,
        p_grade: null,
        p_date_from: null,
        p_date_to: null,
      }),
    );
  });
});

// ── fetchProfileStats ─────────────────────────────────────────────────────────

describe('fetchProfileStats', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns normalized stats with all grades from VB to V10', async () => {
    const rpcData = {
      total_sends: 5,
      sends_by_grade: [
        { grade: 'V3', count: 3 },
        { grade: 'V5', count: 2 },
      ],
      accumulated_days: 3,
      highest_grade: 'V5',
    };

    // Stats RPC uses .single() — mock chain: rpc().single()
    const singleMock = jest.fn().mockResolvedValueOnce({ data: rpcData, error: null });
    mockRpc.mockReturnValueOnce({ single: singleMock } as unknown as ReturnType<typeof supabase.rpc>);

    const result = await fetchProfileStats(MOCK_USER_ID);

    expect(result.total_sends).toBe(5);
    expect(result.accumulated_days).toBe(3);
    expect(result.highest_grade).toBe('V5');

    // sends_by_grade must include ALL grades in canonical order
    expect(result.sends_by_grade).toHaveLength(GRADE_ORDER.length);
    expect(result.sends_by_grade[0].grade).toBe('VB');
    expect(result.sends_by_grade[GRADE_ORDER.length - 1].grade).toBe('V10');

    // Grades in the DB data have correct counts
    const v3 = result.sends_by_grade.find((g) => g.grade === 'V3');
    const v5 = result.sends_by_grade.find((g) => g.grade === 'V5');
    expect(v3?.count).toBe(3);
    expect(v5?.count).toBe(2);

    // Grades not in the DB data default to 0
    const vb = result.sends_by_grade.find((g) => g.grade === 'VB');
    expect(vb?.count).toBe(0);
  });

  it('returns zeroed stats when RPC returns null (privacy blocked)', async () => {
    const singleMock = jest.fn().mockResolvedValueOnce({ data: null, error: null });
    mockRpc.mockReturnValueOnce({ single: singleMock } as unknown as ReturnType<typeof supabase.rpc>);

    const result = await fetchProfileStats(MOCK_USER_ID);

    expect(result.total_sends).toBe(0);
    expect(result.accumulated_days).toBe(0);
    expect(result.highest_grade).toBeNull();
    expect(result.sends_by_grade).toHaveLength(GRADE_ORDER.length);
    result.sends_by_grade.forEach((g) => {
      expect(g.count).toBe(0);
    });
  });

  it('throws a user-facing error on RPC failure', async () => {
    const singleMock = jest.fn().mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST301', message: 'db error' },
    });
    mockRpc.mockReturnValueOnce({ single: singleMock } as unknown as ReturnType<typeof supabase.rpc>);

    await expect(fetchProfileStats(MOCK_USER_ID)).rejects.toThrow(
      'Failed to load stats. Please try again.',
    );
  });

  it('handles sends_by_grade as a JSON string (Supabase sometimes returns JSON columns as strings)', async () => {
    const rpcData = {
      total_sends: 2,
      sends_by_grade: JSON.stringify([{ grade: 'V2', count: 2 }]),
      accumulated_days: 1,
      highest_grade: 'V2',
    };

    const singleMock = jest.fn().mockResolvedValueOnce({ data: rpcData, error: null });
    mockRpc.mockReturnValueOnce({ single: singleMock } as unknown as ReturnType<typeof supabase.rpc>);

    const result = await fetchProfileStats(MOCK_USER_ID);

    const v2 = result.sends_by_grade.find((g) => g.grade === 'V2');
    expect(v2?.count).toBe(2);
  });

  it('handles sends_by_grade as null gracefully', async () => {
    const rpcData = {
      total_sends: 0,
      sends_by_grade: null,
      accumulated_days: 0,
      highest_grade: null,
    };

    const singleMock = jest.fn().mockResolvedValueOnce({ data: rpcData, error: null });
    mockRpc.mockReturnValueOnce({ single: singleMock } as unknown as ReturnType<typeof supabase.rpc>);

    const result = await fetchProfileStats(MOCK_USER_ID);
    expect(result.sends_by_grade).toHaveLength(GRADE_ORDER.length);
    result.sends_by_grade.forEach((g) => expect(g.count).toBe(0));
  });
});

// ── fetchHistoryGyms ──────────────────────────────────────────────────────────

describe('fetchHistoryGyms', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /** Builds a chainable query builder for from() that resolves to `result`. */
  function makeQueryBuilder(result: { data: unknown; error: unknown }) {
    const resolvedPromise = Promise.resolve(result);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test mock
    const builder: any = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      then: resolvedPromise.then.bind(resolvedPromise),
      catch: resolvedPromise.catch.bind(resolvedPromise),
      finally: resolvedPromise.finally.bind(resolvedPromise),
    };
    return builder;
  }

  it('returns distinct gyms ordered alphabetically', async () => {
    const rawData = [
      { routes: { gym_id: 'gym-001', gyms: { id: 'gym-001', name: 'Beta Cave' } } },
      { routes: { gym_id: 'gym-001', gyms: { id: 'gym-001', name: 'Beta Cave' } } }, // duplicate
      { routes: { gym_id: 'gym-002', gyms: { id: 'gym-002', name: 'Alpha Rock' } } },
    ];

    const qb = makeQueryBuilder({ data: rawData, error: null });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    const result = await fetchHistoryGyms(MOCK_USER_ID);

    // Deduplication — only 2 distinct gyms
    expect(result).toHaveLength(2);
    // Alphabetical order: Alpha Rock < Beta Cave
    expect(result[0].name).toBe('Alpha Rock');
    expect(result[1].name).toBe('Beta Cave');
  });

  it('returns empty array when there are no ascents', async () => {
    const qb = makeQueryBuilder({ data: [], error: null });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    const result = await fetchHistoryGyms(MOCK_USER_ID);

    expect(result).toEqual([]);
  });

  it('returns empty array when data is null', async () => {
    const qb = makeQueryBuilder({ data: null, error: null });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    const result = await fetchHistoryGyms(MOCK_USER_ID);

    expect(result).toEqual([]);
  });

  it('throws a user-facing error on DB failure', async () => {
    const qb = makeQueryBuilder({
      data: null,
      error: { code: 'PGRST301', message: 'db error' },
    });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    await expect(fetchHistoryGyms(MOCK_USER_ID)).rejects.toThrow(
      'Failed to load gyms. Please try again.',
    );
  });

  it('skips rows where routes or gyms join is null', async () => {
    const rawData = [
      { routes: null },
      { routes: { gym_id: 'gym-001', gyms: null } },
      { routes: { gym_id: 'gym-002', gyms: { id: 'gym-002', name: 'Valid Gym' } } },
    ];

    const qb = makeQueryBuilder({ data: rawData, error: null });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    const result = await fetchHistoryGyms(MOCK_USER_ID);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Valid Gym');
  });
});

// ── groupToRouteCards ─────────────────────────────────────────────────────────

describe('groupToRouteCards', () => {
  function makeAscent(overrides: Partial<HistoryAscent>): HistoryAscent {
    return {
      ascent_id: 'asc-001',
      route_id: 'route-001',
      gym_id: 'gym-001',
      gym_name: 'Test Gym',
      grade: 'V3',
      color_tag: 'blue',
      section_label: null,
      style: 'top',
      attempts: 1,
      note: null,
      logged_at: '2026-09-15T10:00:00Z',
      is_private: false,
      ...overrides,
    };
  }

  it('groups multiple sends to same route into one card', () => {
    const ascents = [
      makeAscent({ ascent_id: 'asc-001', style: 'top', logged_at: '2026-09-01T10:00:00Z' }),
      makeAscent({ ascent_id: 'asc-002', style: 'top', logged_at: '2026-09-15T10:00:00Z' }),
    ];

    const result = groupToRouteCards(ascents);

    expect(result).toHaveLength(1);
    expect(result[0].route_id).toBe('route-001');
    expect(result[0].best_style).toBe('top');
    expect(result[0].most_recent_date).toBe('2026-09-15T10:00:00Z');
  });

  it('prefers flash over top for best_style', () => {
    const ascents = [
      makeAscent({ ascent_id: 'asc-001', style: 'top', logged_at: '2026-09-01T10:00:00Z' }),
      makeAscent({ ascent_id: 'asc-002', style: 'flash', logged_at: '2026-09-10T10:00:00Z' }),
    ];

    const result = groupToRouteCards(ascents);

    expect(result).toHaveLength(1);
    expect(result[0].best_style).toBe('flash');
  });

  it('excludes attempt-only routes', () => {
    const ascents = [
      makeAscent({ ascent_id: 'asc-001', style: 'attempt' }),
    ];

    const result = groupToRouteCards(ascents);

    expect(result).toHaveLength(0);
  });

  it('produces separate cards for different routes', () => {
    const ascents = [
      makeAscent({ ascent_id: 'asc-001', route_id: 'route-001', grade: 'V3' }),
      makeAscent({ ascent_id: 'asc-002', route_id: 'route-002', grade: 'V5' }),
    ];

    const result = groupToRouteCards(ascents);

    expect(result).toHaveLength(2);
    const routeIds = result.map((c) => c.route_id);
    expect(routeIds).toContain('route-001');
    expect(routeIds).toContain('route-002');
  });

  it('returns empty array for empty input', () => {
    expect(groupToRouteCards([])).toEqual([]);
  });

  it('skips attempts even when mixed with sends for the same route', () => {
    const ascents = [
      makeAscent({ ascent_id: 'asc-001', style: 'attempt' }),
      makeAscent({ ascent_id: 'asc-002', style: 'top' }),
    ];

    const result = groupToRouteCards(ascents);

    expect(result).toHaveLength(1);
    expect(result[0].best_style).toBe('top');
  });
});
