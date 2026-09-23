/**
 * Tests for mod-route-catalog/route-service.ts
 *
 * Tests behaviour — not implementation.
 * All Supabase calls are mocked; no real network activity.
 */

// ── Mock supabase before any import ──────────────────────────────────────────
jest.mock('../../../lib/supabase', () => {
  return {
    supabase: {
      from: jest.fn(),
      rpc: jest.fn(),
      storage: {
        from: jest.fn(),
      },
    },
  };
});

// ── Imports after mocks ───────────────────────────────────────────────────────
import { supabase } from '../../../lib/supabase';
import {
  findMatchingActiveRoutes,
  listRoutes,
  loadRoute,
  submitRoute,
  withdrawRoute,
} from '../route-service';
import type { Route, RouteSummary } from '../types';

// ── Typed mock helpers ────────────────────────────────────────────────────────
const mockFrom = supabase.from as jest.MockedFunction<typeof supabase.from>;
const mockRpc = supabase.rpc as jest.MockedFunction<typeof supabase.rpc>;
const mockStorageFrom = supabase.storage.from as jest.MockedFunction<
  typeof supabase.storage.from
>;

/**
 * Builds a chainable query builder that resolves to `result`.
 *
 * The builder is made thenable (Promise-like) so that `await builder.order()`
 * chains resolve correctly — mirroring how supabase-js returns a thenable
 * PostgrestFilterBuilder from every chained method.
 */
function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const resolvedPromise = Promise.resolve(result);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test mock; type safety not required here
  const builder: any = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
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

const MOCK_ROUTE_SUMMARY: RouteSummary = {
  id: 'route-001',
  gym_id: 'gym-001',
  section_label: null,
  grade: 'V4',
  color_tag: 'blue',
  photo_url: 'https://example.com/photo.jpg',
  status: 'active',
  created_at: '2026-09-20T10:00:00Z',
};

const MOCK_ROUTE: Route = {
  ...MOCK_ROUTE_SUMMARY,
  submitted_by_user_id: 'user-001',
  retired_at: null,
  retired_by_user_id: null,
};

// ── findMatchingActiveRoutes ──────────────────────────────────────────────────

describe('findMatchingActiveRoutes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns matching active routes when found', async () => {
    const qb = makeQueryBuilder({ data: [MOCK_ROUTE_SUMMARY], error: null });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    const result = await findMatchingActiveRoutes('gym-001', 'V4', 'blue');

    expect(result).toEqual([MOCK_ROUTE_SUMMARY]);
    expect(mockFrom).toHaveBeenCalledWith('routes');
    expect(qb.eq).toHaveBeenCalledWith('gym_id', 'gym-001');
    expect(qb.eq).toHaveBeenCalledWith('grade', 'V4');
    expect(qb.eq).toHaveBeenCalledWith('color_tag', 'blue');
    expect(qb.eq).toHaveBeenCalledWith('status', 'active');
  });

  it('returns an empty array when no matching active routes exist', async () => {
    const qb = makeQueryBuilder({ data: [], error: null });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    const result = await findMatchingActiveRoutes('gym-001', 'V4', 'blue');

    expect(result).toEqual([]);
  });

  it('returns an empty array when data is null', async () => {
    const qb = makeQueryBuilder({ data: null, error: null });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    const result = await findMatchingActiveRoutes('gym-001', 'V4', 'blue');

    expect(result).toEqual([]);
  });

  it('throws a user-friendly error when Supabase returns an error', async () => {
    const qb = makeQueryBuilder({
      data: null,
      error: { code: 'PGRST301', message: 'DB error' },
    });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    await expect(
      findMatchingActiveRoutes('gym-001', 'V4', 'blue'),
    ).rejects.toThrow('Failed to check for existing routes. Please try again.');
  });
});

// ── loadRoute ─────────────────────────────────────────────────────────────────

describe('loadRoute', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the full Route row when found', async () => {
    const qb = makeQueryBuilder({ data: MOCK_ROUTE, error: null });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    const result = await loadRoute('route-001');

    expect(result).toEqual(MOCK_ROUTE);
    expect(qb.eq).toHaveBeenCalledWith('id', 'route-001');
    expect(qb.single).toHaveBeenCalled();
  });

  it('returns null when the route is not found (PGRST116)', async () => {
    const qb = makeQueryBuilder({
      data: null,
      error: { code: 'PGRST116', message: 'no rows' },
    });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    const result = await loadRoute('nonexistent-id');

    expect(result).toBeNull();
  });

  it('throws a user-friendly error on unexpected DB failure', async () => {
    const qb = makeQueryBuilder({
      data: null,
      error: { code: 'PGRST500', message: 'server error' },
    });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    await expect(loadRoute('route-001')).rejects.toThrow(
      'Failed to load route details. Please try again.',
    );
  });
});

// ── listRoutes ────────────────────────────────────────────────────────────────

describe('listRoutes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns active routes for a gym (always status=active, AC-041)', async () => {
    const qb = makeQueryBuilder({ data: [MOCK_ROUTE_SUMMARY], error: null });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    const result = await listRoutes('gym-001', { grade: null, colorTag: null });

    expect(result).toEqual([MOCK_ROUTE_SUMMARY]);
    expect(qb.eq).toHaveBeenCalledWith('gym_id', 'gym-001');
    expect(qb.eq).toHaveBeenCalledWith('status', 'active');
  });

  it('applies grade filter when provided', async () => {
    const qb = makeQueryBuilder({ data: [MOCK_ROUTE_SUMMARY], error: null });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    await listRoutes('gym-001', { grade: 'V4', colorTag: null });

    expect(qb.eq).toHaveBeenCalledWith('grade', 'V4');
  });

  it('does not apply grade filter when grade is null', async () => {
    const qb = makeQueryBuilder({ data: [], error: null });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    await listRoutes('gym-001', { grade: null, colorTag: null });

    const gradeCalls = (qb.eq as jest.Mock).mock.calls.filter(
      (call: unknown[]) => call[0] === 'grade',
    );
    expect(gradeCalls).toHaveLength(0);
  });

  it('applies colorTag filter when provided', async () => {
    const qb = makeQueryBuilder({ data: [MOCK_ROUTE_SUMMARY], error: null });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    await listRoutes('gym-001', { grade: null, colorTag: 'blue' });

    expect(qb.eq).toHaveBeenCalledWith('color_tag', 'blue');
  });

  it('does not apply colorTag filter when colorTag is null', async () => {
    const qb = makeQueryBuilder({ data: [], error: null });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    await listRoutes('gym-001', { grade: null, colorTag: null });

    const colorCalls = (qb.eq as jest.Mock).mock.calls.filter(
      (call: unknown[]) => call[0] === 'color_tag',
    );
    expect(colorCalls).toHaveLength(0);
  });

  it('returns an empty array when there are no routes', async () => {
    const qb = makeQueryBuilder({ data: null, error: null });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    const result = await listRoutes('gym-001', { grade: null, colorTag: null });

    expect(result).toEqual([]);
  });

  it('throws a user-friendly error on DB failure', async () => {
    const qb = makeQueryBuilder({
      data: null,
      error: { code: 'PGRST301', message: 'DB error' },
    });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    await expect(
      listRoutes('gym-001', { grade: null, colorTag: null }),
    ).rejects.toThrow('Failed to load routes. Please try again.');
  });
});

// ── submitRoute ───────────────────────────────────────────────────────────────

describe('submitRoute', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls submit_route RPC and returns the created Route', async () => {
    mockRpc.mockResolvedValueOnce({ data: MOCK_ROUTE, error: null } as never);

    const result = await submitRoute({
      gym_id: 'gym-001',
      grade: 'V4',
      color_tag: 'blue',
      photo_url: 'https://example.com/photo.jpg',
      section_label: null,
    });

    expect(result).toEqual(MOCK_ROUTE);
    expect(mockRpc).toHaveBeenCalledWith('submit_route', {
      p_gym_id: 'gym-001',
      p_grade: 'V4',
      p_color_tag: 'blue',
      p_photo_url: 'https://example.com/photo.jpg',
      p_section_label: null,
    });
  });

  it('throws a duplicate-route error when the unique constraint is violated (23505)', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { code: '23505', message: 'unique constraint violation' },
    } as never);

    await expect(
      submitRoute({
        gym_id: 'gym-001',
        grade: 'V4',
        color_tag: 'blue',
        photo_url: 'https://example.com/photo.jpg',
        section_label: null,
      }),
    ).rejects.toThrow(
      'An active route with this grade and color already exists at this gym.',
    );
  });

  it('throws a pending-submission error when duplicate pending exists', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { code: 'P0001', message: 'You already have a pending submission for this route combination' },
    } as never);

    await expect(
      submitRoute({
        gym_id: 'gym-001',
        grade: 'V4',
        color_tag: 'blue',
        photo_url: 'https://example.com/photo.jpg',
        section_label: null,
      }),
    ).rejects.toThrow(
      'You already have a pending submission for this grade and color at this gym.',
    );
  });

  it('throws a user-friendly error on unexpected RPC failure', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST500', message: 'server error' },
    } as never);

    await expect(
      submitRoute({
        gym_id: 'gym-001',
        grade: 'V4',
        color_tag: 'blue',
        photo_url: 'https://example.com/photo.jpg',
        section_label: null,
      }),
    ).rejects.toThrow('Failed to submit route. Please try again.');
  });
});

// ── withdrawRoute ─────────────────────────────────────────────────────────────

describe('withdrawRoute', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls delete on routes with the given routeId', async () => {
    const qb = makeQueryBuilder({ data: null, error: null });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    await withdrawRoute('route-001');

    expect(mockFrom).toHaveBeenCalledWith('routes');
    expect(qb.delete).toHaveBeenCalled();
    expect(qb.eq).toHaveBeenCalledWith('id', 'route-001');
  });

  it('throws a user-friendly error when the delete fails', async () => {
    const qb = makeQueryBuilder({
      data: null,
      error: { code: 'PGRST301', message: 'DB error' },
    });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    await expect(withdrawRoute('route-001')).rejects.toThrow(
      'Failed to withdraw route. Please try again.',
    );
  });
});

// ── Storage mock not invoked for non-upload tests ────────────────────────────
// (uploadRoutePhoto is tested separately as it requires fetch + storage mocks)
// The mockStorageFrom is declared to prevent unused-var lint errors.
void mockStorageFrom;
