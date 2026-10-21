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

// ── Storage builder helper ────────────────────────────────────────────────────
/**
 * Builds a chainable storage builder for mocking supabase.storage.from().
 * Supports upload, getPublicUrl, and createSignedUrl.
 */
function makeStorageBuilder(opts: {
  uploadResult?: { error: unknown };
  publicUrl?: string;
  signedUrlResult?: { data: { signedUrl: string } | null; error: unknown };
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test mock
  const builder: any = {
    upload: jest.fn().mockResolvedValue(opts.uploadResult ?? { error: null }),
    getPublicUrl: jest
      .fn()
      .mockReturnValue({ data: { publicUrl: opts.publicUrl ?? '' } }),
    createSignedUrl: jest
      .fn()
      .mockResolvedValue(
        opts.signedUrlResult ?? { data: { signedUrl: 'https://signed.url/photo.jpg' }, error: null },
      ),
  };
  return builder;
}

// ── Imports after mocks ───────────────────────────────────────────────────────
import { clearCacheForTesting } from '../../../lib/signedUrlCache';
import { supabase } from '../../../lib/supabase';
import {
  fetchBetaVideoCounts,
  fetchSavedRouteIds,
  getPhotoSignedUrl,
  listRoutes,
  loadRoute,
  saveRoute,
  submitRoute,
  unsaveRoute,
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

// findMatchingActiveRoutes was removed in Rev 37 — it was dead code from the
// removed match-before-create flow. The describe block is deleted accordingly.

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

  it('calls submit_route RPC and returns the created Route (AC-020)', async () => {
    mockRpc.mockResolvedValueOnce({ data: MOCK_ROUTE, error: null } as never);

    const result = await submitRoute({
      gym_id: 'gym-001',
      grade: 'V4',
      color_tag: 'blue',
      photo_url: 'https://example.com/photo.jpg',
      section_label: null,
    });

    expect(result).toEqual(MOCK_ROUTE);
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith('submit_route', {
      p_gym_id: 'gym-001',
      p_grade: 'V4',
      p_color_tag: 'blue',
      p_photo_url: 'https://example.com/photo.jpg',
      p_section_label: null,
    });
  });

  it('does not call check_route_duplicate RPC — duplicate check is client-side (AC-187)', async () => {
    mockRpc.mockResolvedValueOnce({ data: MOCK_ROUTE, error: null } as never);

    await submitRoute({
      gym_id: 'gym-001',
      grade: 'V4',
      color_tag: 'blue',
      photo_url: 'https://example.com/photo.jpg',
      section_label: null,
    });

    // Only submit_route must be called — no check_route_duplicate RPC
    expect(mockRpc).toHaveBeenCalledTimes(1);
    const rpcNames = (mockRpc as jest.Mock).mock.calls.map(
      (call: unknown[]) => call[0],
    );
    expect(rpcNames).not.toContain('check_route_duplicate');
  });

  it('works for pending routes — no extra RPC call (AC-025)', async () => {
    const pendingRoute: Route = { ...MOCK_ROUTE, status: 'pending' };
    mockRpc.mockResolvedValueOnce({ data: pendingRoute, error: null } as never);

    const result = await submitRoute({
      gym_id: 'gym-001',
      grade: 'V4',
      color_tag: 'blue',
      photo_url: 'https://example.com/photo.jpg',
      section_label: null,
    });

    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('pending');
  });

  it('throws a user-friendly error on submit_route RPC failure', async () => {
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

  it('resolves when the route row is deleted (data contains 1 row)', async () => {
    const qb = makeQueryBuilder({ data: [{ id: 'route-001' }], error: null });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    await withdrawRoute('route-001');

    expect(mockFrom).toHaveBeenCalledWith('routes');
    expect(qb.delete).toHaveBeenCalled();
    expect(qb.eq).toHaveBeenCalledWith('id', 'route-001');
  });

  it('throws when RLS silently blocks the delete (data is empty array)', async () => {
    const qb = makeQueryBuilder({ data: [], error: null });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    await expect(withdrawRoute('route-001')).rejects.toThrow(
      'Route could not be withdrawn — it may not be pending or may belong to another user.',
    );
  });

  it('throws when PostgREST returns null data (treat as 0 rows affected)', async () => {
    const qb = makeQueryBuilder({ data: null, error: null });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    await expect(withdrawRoute('route-001')).rejects.toThrow(
      'Route could not be withdrawn — it may not be pending or may belong to another user.',
    );
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

// ── getPhotoSignedUrl ─────────────────────────────────────────────────────────

describe('getPhotoSignedUrl', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Prevent cross-test cache leakage — each test starts with an empty cache.
    clearCacheForTesting();
  });

  const STORED_URL =
    'https://abc.supabase.co/storage/v1/object/public/route-photos/user-001/1234567890-abc.jpg';
  const SIGNED_URL = 'https://abc.supabase.co/storage/v1/object/sign/route-photos/user-001/1234567890-abc.jpg?token=xyz';

  it('extracts the storage path and returns a signed URL', async () => {
    const storageBuilder = makeStorageBuilder({
      signedUrlResult: { data: { signedUrl: SIGNED_URL }, error: null },
    });
    mockStorageFrom.mockReturnValueOnce(storageBuilder as unknown as ReturnType<typeof supabase.storage.from>);

    const result = await getPhotoSignedUrl(STORED_URL);

    expect(result).toBe(SIGNED_URL);
    expect(mockStorageFrom).toHaveBeenCalledWith('route-photos');
    expect(storageBuilder.createSignedUrl).toHaveBeenCalledWith(
      'user-001/1234567890-abc.jpg',
      3600,
    );
  });

  it('throws a user-facing error when the URL does not contain the expected prefix', async () => {
    await expect(
      getPhotoSignedUrl('https://example.com/some/other/path.jpg'),
    ).rejects.toThrow('Failed to load route photo. Please try again.');
  });

  it('throws a user-facing error when createSignedUrl returns an error', async () => {
    const storageBuilder = makeStorageBuilder({
      signedUrlResult: { data: null, error: { message: 'signing failed' } },
    });
    mockStorageFrom.mockReturnValueOnce(storageBuilder as unknown as ReturnType<typeof supabase.storage.from>);

    await expect(getPhotoSignedUrl(STORED_URL)).rejects.toThrow(
      'Failed to load route photo. Please try again.',
    );
  });

  it('throws a user-facing error when signedUrl is missing from response', async () => {
    const storageBuilder = makeStorageBuilder({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test mock
      signedUrlResult: { data: { signedUrl: '' } as any, error: null },
    });
    mockStorageFrom.mockReturnValueOnce(storageBuilder as unknown as ReturnType<typeof supabase.storage.from>);

    await expect(getPhotoSignedUrl(STORED_URL)).rejects.toThrow(
      'Failed to load route photo. Please try again.',
    );
  });

  it('calls createSignedUrl only once when getPhotoSignedUrl is called twice with the same URL (cache hit)', async () => {
    const storageBuilder = makeStorageBuilder({
      signedUrlResult: { data: { signedUrl: SIGNED_URL }, error: null },
    });
    // mockReturnValue (not Once) — but cache ensures createSignedUrl is only called once.
    mockStorageFrom.mockReturnValue(storageBuilder as unknown as ReturnType<typeof supabase.storage.from>);

    const first = await getPhotoSignedUrl(STORED_URL);
    const second = await getPhotoSignedUrl(STORED_URL);

    expect(first).toBe(SIGNED_URL);
    expect(second).toBe(SIGNED_URL);
    // The Supabase storage mock must be invoked only once — the second call is
    // served from the in-memory cache.
    expect(storageBuilder.createSignedUrl).toHaveBeenCalledTimes(1);
  });
});

// ── Storage mock declared to prevent unused-var lint errors ──────────────────
// (uploadRoutePhoto is tested separately as it requires fetch + storage mocks)
void mockStorageFrom;

// ── fetchSavedRouteIds ────────────────────────────────────────────────────────

describe('fetchSavedRouteIds', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns an array of route_id strings when saved routes exist', async () => {
    const qb = makeQueryBuilder({
      data: [{ route_id: 'r-001' }, { route_id: 'r-002' }],
      error: null,
    });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    const result = await fetchSavedRouteIds();

    expect(result).toEqual(['r-001', 'r-002']);
    expect(mockFrom).toHaveBeenCalledWith('saved_routes');
    expect(qb.select).toHaveBeenCalledWith('route_id');
  });

  it('returns an empty array when no saved routes exist', async () => {
    const qb = makeQueryBuilder({ data: [], error: null });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    const result = await fetchSavedRouteIds();

    expect(result).toEqual([]);
  });

  it('returns an empty array when data is null', async () => {
    const qb = makeQueryBuilder({ data: null, error: null });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    const result = await fetchSavedRouteIds();

    expect(result).toEqual([]);
  });

  it('throws a user-friendly error on DB failure', async () => {
    const qb = makeQueryBuilder({
      data: null,
      error: { code: 'PGRST301', message: 'DB error' },
    });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    await expect(fetchSavedRouteIds()).rejects.toThrow(
      'Failed to load saved routes. Please try again.',
    );
  });
});

// ── saveRoute ─────────────────────────────────────────────────────────────────

describe('saveRoute', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('inserts a row into saved_routes for the given routeId', async () => {
    const qb = makeQueryBuilder({ data: null, error: null });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    await saveRoute('r-001');

    expect(mockFrom).toHaveBeenCalledWith('saved_routes');
    expect(qb.insert).toHaveBeenCalledWith({ route_id: 'r-001' });
  });

  it('throws a user-friendly error when insert fails', async () => {
    const qb = makeQueryBuilder({
      data: null,
      error: { code: 'PGRST301', message: 'DB error' },
    });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    await expect(saveRoute('r-001')).rejects.toThrow(
      'Failed to save route. Please try again.',
    );
  });
});

// ── fetchBetaVideoCounts ──────────────────────────────────────────────────────

describe('fetchBetaVideoCounts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns an empty object when routeIds array is empty', async () => {
    const result = await fetchBetaVideoCounts([]);
    expect(result).toEqual({});
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('calls count_beta_videos_by_routes RPC and returns a route_id → count map', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [
        { route_id: 'r-001', beta_count: 3 },
        { route_id: 'r-002', beta_count: 1 },
      ],
      error: null,
    } as never);

    const result = await fetchBetaVideoCounts(['r-001', 'r-002', 'r-003']);

    expect(mockRpc).toHaveBeenCalledWith('count_beta_videos_by_routes', {
      route_ids: ['r-001', 'r-002', 'r-003'],
    });
    expect(result).toEqual({ 'r-001': 3, 'r-002': 1 });
    // r-003 has no visible beta videos — absent from result (callers default to 0)
    expect(result['r-003']).toBeUndefined();
  });

  it('returns empty object on RPC error (non-fatal)', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST500', message: 'server error' },
    } as never);

    const result = await fetchBetaVideoCounts(['r-001']);

    expect(result).toEqual({});
  });

  it('returns empty object when RPC returns null data', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: null } as never);

    const result = await fetchBetaVideoCounts(['r-001']);

    expect(result).toEqual({});
  });
});

// ── unsaveRoute ───────────────────────────────────────────────────────────────

describe('unsaveRoute', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deletes the saved_routes row for the given routeId', async () => {
    const qb = makeQueryBuilder({ data: null, error: null });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    await unsaveRoute('r-001');

    expect(mockFrom).toHaveBeenCalledWith('saved_routes');
    expect(qb.delete).toHaveBeenCalled();
    expect(qb.eq).toHaveBeenCalledWith('route_id', 'r-001');
  });

  it('throws a user-friendly error when delete fails', async () => {
    const qb = makeQueryBuilder({
      data: null,
      error: { code: 'PGRST301', message: 'DB error' },
    });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    await expect(unsaveRoute('r-001')).rejects.toThrow(
      'Failed to unsave route. Please try again.',
    );
  });
});
