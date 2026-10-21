/**
 * Tests for home-service.ts (MOD-012).
 *
 * Covers: fetchSavedGym, fetchProjectingRoutes, clearCache / cache helpers.
 * Supabase is mocked via the shared lib/supabase mock.
 */

jest.mock('../../../lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
  },
}));

import {
  fetchSavedGym,
  fetchProjectingRoutes,
  clearCache,
  getNewBetaCache,
  setNewBetaCache,
} from '../home-service';
import { supabase } from '../../../lib/supabase';

const mockFrom = supabase.from as jest.MockedFunction<typeof supabase.from>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeQueryBuilder(result: { data: unknown; error: null | object }): any {
  const promise = Promise.resolve(result);
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    then: promise.then.bind(promise),
  };
}

describe('home-service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearCache();
  });

  // ── fetchSavedGym ───────────────────────────────────────────────────────────

  describe('fetchSavedGym', () => {
    it('returns an empty array when the user has no saved gyms', async () => {
      mockFrom.mockImplementation(() => makeQueryBuilder({ data: [], error: null }));
      const result = await fetchSavedGym('user-001');
      expect(result).toEqual([]);
    });

    it('throws when the saved_gyms query fails', async () => {
      mockFrom.mockImplementationOnce(() =>
        makeQueryBuilder({ data: null, error: { message: 'DB error' } }),
      );
      await expect(fetchSavedGym('user-001')).rejects.toThrow('Failed to load saved gyms');
    });

    it('returns gyms with lastViewedAt null when no visit data exists', async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === 'saved_gyms') {
          return makeQueryBuilder({
            data: [
              {
                gym_id: 'gym-001',
                gyms: { id: 'gym-001', name: 'MegaSTONE', photo_url: null, cover_photo_url: null },
              },
            ],
            error: null,
          });
        }
        // user_route_visits returns empty.
        return makeQueryBuilder({ data: [], error: null });
      });

      const result = await fetchSavedGym('user-001');
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'gym-001',
        name: 'MegaSTONE',
        lastViewedAt: null,
      });
    });

    it('attaches lastViewedAt from user_route_visits when visit data exists', async () => {
      const visitedAt = '2026-10-01T10:00:00Z';
      mockFrom.mockImplementation((table: string) => {
        if (table === 'saved_gyms') {
          return makeQueryBuilder({
            data: [
              {
                gym_id: 'gym-001',
                gyms: { id: 'gym-001', name: 'MegaSTONE', photo_url: null, cover_photo_url: null },
              },
            ],
            error: null,
          });
        }
        if (table === 'user_route_visits') {
          return makeQueryBuilder({
            data: [{ last_viewed_at: visitedAt, routes: { gym_id: 'gym-001' } }],
            error: null,
          });
        }
        return makeQueryBuilder({ data: [], error: null });
      });

      const result = await fetchSavedGym('user-001');
      expect(result[0].lastViewedAt).toBe(visitedAt);
    });

    it('sorts gyms with recency data before gyms without', async () => {
      const recentAt = '2026-10-10T10:00:00Z';
      mockFrom.mockImplementation((table: string) => {
        if (table === 'saved_gyms') {
          return makeQueryBuilder({
            data: [
              {
                gym_id: 'gym-no-visits',
                gyms: { id: 'gym-no-visits', name: 'GymB', photo_url: null, cover_photo_url: null },
              },
              {
                gym_id: 'gym-with-visits',
                gyms: { id: 'gym-with-visits', name: 'GymA', photo_url: null, cover_photo_url: null },
              },
            ],
            error: null,
          });
        }
        if (table === 'user_route_visits') {
          return makeQueryBuilder({
            data: [{ last_viewed_at: recentAt, routes: { gym_id: 'gym-with-visits' } }],
            error: null,
          });
        }
        return makeQueryBuilder({ data: [], error: null });
      });

      const result = await fetchSavedGym('user-001');
      // GymA (has visits) should come before GymB (no visits).
      expect(result[0].name).toBe('GymA');
      expect(result[1].name).toBe('GymB');
    });
  });

  // ── fetchProjectingRoutes ───────────────────────────────────────────────────

  describe('fetchProjectingRoutes', () => {
    it('returns an empty array when given no route IDs', async () => {
      const result = await fetchProjectingRoutes([]);
      expect(result).toEqual([]);
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it('returns mapped routes for given saved route IDs', async () => {
      mockFrom.mockImplementation(() =>
        makeQueryBuilder({
          data: [
            {
              id: 'route-001',
              gym_id: 'gym-001',
              grade: 'V5',
              color_tag: 'red',
              photo_url: null,
              section_label: null,
              gyms: { name: 'MegaSTONE' },
            },
          ],
          error: null,
        }),
      );

      const result = await fetchProjectingRoutes(['route-001']);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'route-001',
        gym_id: 'gym-001',
        grade: 'V5',
        color_tag: 'red',
        gym_name: 'MegaSTONE',
      });
    });

    it('throws when the routes query fails', async () => {
      mockFrom.mockImplementation(() =>
        makeQueryBuilder({ data: null, error: { message: 'DB error' } }),
      );
      await expect(fetchProjectingRoutes(['route-001'])).rejects.toThrow(
        'Failed to load projecting routes',
      );
    });

    it('returns null gym_name when gyms embed is null', async () => {
      mockFrom.mockImplementation(() =>
        makeQueryBuilder({
          data: [
            {
              id: 'route-001',
              gym_id: 'gym-001',
              grade: 'V3',
              color_tag: 'blue',
              photo_url: null,
              section_label: null,
              gyms: null,
            },
          ],
          error: null,
        }),
      );

      const result = await fetchProjectingRoutes(['route-001']);
      expect(result[0].gym_name).toBeNull();
    });
  });

  // ── clearCache / getNewBetaCache / setNewBetaCache ─────────────────────────

  describe('cache helpers', () => {
    it('returns null for a cache miss (no entry)', () => {
      expect(getNewBetaCache('route-001')).toBeNull();
    });

    it('returns the cached Set after setNewBetaCache', () => {
      const ids = new Set(['route-001', 'route-002']);
      setNewBetaCache('route-001,route-002', ids);
      const result = getNewBetaCache('route-001,route-002');
      expect(result).toBe(ids);
    });

    it('returns null after clearCache is called', () => {
      setNewBetaCache('key', new Set(['route-001']));
      clearCache();
      expect(getNewBetaCache('key')).toBeNull();
    });

    it('returns null when route-id key does not match', () => {
      setNewBetaCache('route-A', new Set(['route-001']));
      expect(getNewBetaCache('route-B')).toBeNull();
    });
  });
});
