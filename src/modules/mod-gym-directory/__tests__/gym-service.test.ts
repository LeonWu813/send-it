/**
 * Tests for mod-gym-directory/gym-service.ts
 *
 * Tests behaviour — not implementation.
 * All Supabase calls are mocked; no real network activity.
 */

// ── Mock supabase before any import ──────────────────────────────────────────
jest.mock('../../../lib/supabase', () => {
  return {
    supabase: {
      from: jest.fn(),
    },
  };
});

// ── Imports after mocks ───────────────────────────────────────────────────────
import { supabase } from '../../../lib/supabase';
import {
  fetchSavedGymIds,
  listGyms,
  loadGym,
  saveGym,
  submitGymRequest,
  unsaveGym,
} from '../gym-service';
import type { Gym, GymSummary } from '../types';

// ── Typed mock helper ─────────────────────────────────────────────────────────
const mockFrom = supabase.from as jest.MockedFunction<typeof supabase.from>;

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
    order: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(result),
    insert: jest.fn().mockResolvedValue(result),
    delete: jest.fn().mockReturnThis(),
    // Make the builder itself awaitable (thenable) so that
    // `await supabase.from('x').select(...).order(...)` resolves to `result`.
    then: resolvedPromise.then.bind(resolvedPromise),
  };

  return builder;
}

// ── listGyms ─────────────────────────────────────────────────────────────────

describe('listGyms', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns an array of GymSummary rows on success', async () => {
    const mockData: Partial<GymSummary>[] = [
      {
        id: 'gym-001',
        name: 'MegaSTONE Climbing Gym',
        name_zh: 'MegaSTONE 巨石攀岩館',
        branch_label: null,
        city: 'New Taipei',
        district: 'Xinzhuang',
        gym_type: 'bouldering',
        photo_url: null,
      },
    ];
    const qb = makeQueryBuilder({ data: mockData, error: null });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    const result = await listGyms();

    expect(result).toEqual(mockData);
    expect(mockFrom).toHaveBeenCalledWith('gyms');
  });

  it('returns an empty array when there are no gyms', async () => {
    const qb = makeQueryBuilder({ data: null, error: null });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    const result = await listGyms();

    expect(result).toEqual([]);
  });

  it('throws a user-friendly error when Supabase returns an error', async () => {
    const qb = makeQueryBuilder({
      data: null,
      error: { code: 'PGRST301', message: 'DB error' },
    });
    // order() is called twice — both must resolve from the same builder chain
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    await expect(listGyms()).rejects.toThrow(
      'Failed to load gyms. Please try again.',
    );
  });
});

// ── loadGym ───────────────────────────────────────────────────────────────────

describe('loadGym', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the full Gym row when found', async () => {
    const mockGym: Partial<Gym> = {
      id: 'gym-001',
      name: 'MegaSTONE Climbing Gym',
      name_zh: 'MegaSTONE 巨石攀岩館',
      branch_label: null,
      city: 'New Taipei',
      district: 'Xinzhuang',
      address_text: '新北市新莊區思源路171號',
      lat: 25.0363,
      lng: 121.4447,
      gym_type: 'bouldering',
      photo_url: null,
      official_grading_system: 'V',
      bouldering_only_note: null,
    };
    const qb = makeQueryBuilder({ data: mockGym, error: null });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    const result = await loadGym('gym-001');

    expect(result).toEqual(mockGym);
    expect(qb.eq).toHaveBeenCalledWith('id', 'gym-001');
    expect(qb.single).toHaveBeenCalled();
  });

  it('returns null when the gym is not found (PGRST116)', async () => {
    const qb = makeQueryBuilder({
      data: null,
      error: { code: 'PGRST116', message: 'no rows' },
    });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    const result = await loadGym('nonexistent-id');

    expect(result).toBeNull();
  });

  it('throws a user-friendly error on unexpected DB failure', async () => {
    const qb = makeQueryBuilder({
      data: null,
      error: { code: 'PGRST500', message: 'server error' },
    });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    await expect(loadGym('gym-001')).rejects.toThrow(
      'Failed to load gym details. Please try again.',
    );
  });
});

// ── submitGymRequest ──────────────────────────────────────────────────────────

describe('submitGymRequest', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('inserts a gym_requests row with status pending on success', async () => {
    const qb = makeQueryBuilder({ data: null, error: null });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    await submitGymRequest('user-123', {
      name: 'My Climbing Gym',
      city: 'Taipei',
      google_maps_url: 'https://maps.google.com/?q=example',
    });

    expect(mockFrom).toHaveBeenCalledWith('gym_requests');
    expect(qb.insert).toHaveBeenCalledWith({
      requested_by_user_id: 'user-123',
      name: 'My Climbing Gym',
      city: 'Taipei',
      google_maps_url: 'https://maps.google.com/?q=example',
      status: 'pending',
    });
  });

  it('trims whitespace from name and city before inserting', async () => {
    const qb = makeQueryBuilder({ data: null, error: null });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    await submitGymRequest('user-123', {
      name: '  My Gym  ',
      city: '  Taipei  ',
      google_maps_url: null,
    });

    expect(qb.insert).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'My Gym', city: 'Taipei' }),
    );
  });

  it('sets google_maps_url to null when an empty string is provided', async () => {
    const qb = makeQueryBuilder({ data: null, error: null });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    await submitGymRequest('user-123', {
      name: 'Gym',
      city: 'Taipei',
      google_maps_url: '   ',
    });

    expect(qb.insert).toHaveBeenCalledWith(
      expect.objectContaining({ google_maps_url: null }),
    );
  });

  it('throws a user-friendly error when the insert fails', async () => {
    const qb = makeQueryBuilder({
      data: null,
      error: { code: 'PGRST301', message: 'DB error' },
    });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    await expect(
      submitGymRequest('user-123', {
        name: 'Gym',
        city: 'Taipei',
        google_maps_url: null,
      }),
    ).rejects.toThrow('Failed to submit gym request. Please try again.');
  });
});

// ── fetchSavedGymIds ──────────────────────────────────────────────────────────

describe('fetchSavedGymIds', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns an array of gym ID strings when saved gyms exist', async () => {
    const qb = makeQueryBuilder({
      data: [{ gym_id: 'gym-001' }, { gym_id: 'gym-002' }],
      error: null,
    });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    const result = await fetchSavedGymIds();

    expect(result).toEqual(['gym-001', 'gym-002']);
    expect(mockFrom).toHaveBeenCalledWith('saved_gyms');
    expect(qb.select).toHaveBeenCalledWith('gym_id');
  });

  it('returns an empty array when the user has no saved gyms', async () => {
    const qb = makeQueryBuilder({ data: null, error: null });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    const result = await fetchSavedGymIds();

    expect(result).toEqual([]);
  });

  it('throws a user-friendly error when Supabase returns an error', async () => {
    const qb = makeQueryBuilder({
      data: null,
      error: { code: 'PGRST301', message: 'DB error' },
    });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    await expect(fetchSavedGymIds()).rejects.toThrow(
      'Failed to load saved gyms. Please try again.',
    );
  });
});

// ── saveGym ───────────────────────────────────────────────────────────────────

describe('saveGym', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('inserts a saved_gyms row for the given gymId on success', async () => {
    const qb = makeQueryBuilder({ data: null, error: null });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    await saveGym('gym-001');

    expect(mockFrom).toHaveBeenCalledWith('saved_gyms');
    expect(qb.insert).toHaveBeenCalledWith({ gym_id: 'gym-001' });
  });

  it('throws a user-friendly error when the insert fails', async () => {
    const qb = makeQueryBuilder({
      data: null,
      error: { code: 'PGRST301', message: 'conflict' },
    });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    await expect(saveGym('gym-001')).rejects.toThrow(
      'Failed to save gym. Please try again.',
    );
  });
});

// ── unsaveGym ─────────────────────────────────────────────────────────────────

describe('unsaveGym', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deletes the saved_gyms row for the given gymId on success', async () => {
    const qb = makeQueryBuilder({ data: null, error: null });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    await unsaveGym('gym-001');

    expect(mockFrom).toHaveBeenCalledWith('saved_gyms');
    expect(qb.delete).toHaveBeenCalled();
    expect(qb.eq).toHaveBeenCalledWith('gym_id', 'gym-001');
  });

  it('throws a user-friendly error when the delete fails', async () => {
    const qb = makeQueryBuilder({
      data: null,
      error: { code: 'PGRST500', message: 'server error' },
    });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    await expect(unsaveGym('gym-001')).rejects.toThrow(
      'Failed to unsave gym. Please try again.',
    );
  });
});
