/**
 * Tests for HomeScreen (MOD-012, Rev 36).
 *
 * Covers: AC-111 rev (4 sections), AC-112 (admin banner), AC-113/AC-115 (saved
 * gyms strip + empty state), AC-174 (admin_banners table source), AC-175
 * (most-recently-viewed ordering), AC-177 (projecting routes section + empty
 * state), AC-178 (route card tap → onSelectRoute), AC-181 (new beta badge),
 * AC-182 (following activity section + empty state + tap → onSelectClimber).
 *
 * Mocks:
 *   - supabase (all .from() calls)
 *   - mod-route-catalog/route-service (fetchSavedRouteIds)
 *   - mod-social-feed barrel (fetchFollowing)
 *   - src/components/RouteCard (isolates RouteCard rendering from HomeScreen)
 */

// ── Mocks ─────────────────────────────────────────────────────────────────────
jest.mock('../../mod-route-catalog');
jest.mock('../../mod-social-feed');
jest.mock('../../mod-send-logging');
jest.mock('../../../lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
  },
}));
// Shallow-mock RouteCard so HomeScreen tests assert on props, not RouteCard internals.
// Updated for Rev 39/40: accepts betaVideoCount, hasSend, sendStyle, isSaved, onBookmarkToggle.
// hasNewBetaVideo is removed (AC-181 Rev 39).
jest.mock('../../../components/RouteCard', () => {
  const React = require('react');
  const { Text, Pressable } = require('react-native');
  return {
    __esModule: true,
    default: ({
      route,
      onPress,
      hasSend,
      sendStyle,
    }: {
      route: { name: string; grade: string };
      onPress: () => void;
      hasSend?: boolean;
      sendStyle?: 'flash' | 'top' | null;
    }) =>
      React.createElement(
        Pressable,
        { onPress, testID: `route-card-${route.name}`, accessibilityRole: 'button' },
        React.createElement(Text, null, route.name),
        React.createElement(Text, null, route.grade),
        hasSend && sendStyle === 'flash' ? React.createElement(Text, null, 'Flash') : null,
        hasSend && sendStyle === 'top' ? React.createElement(Text, null, 'Top') : null,
      ),
  };
});

// ── Imports ───────────────────────────────────────────────────────────────────
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import type { Session } from '@supabase/supabase-js';

import HomeScreen from '../screens/HomeScreen';
import { clearCache as clearNewBetaCache } from '../home-service';
import * as routeService from '../../mod-route-catalog';
import * as socialFeedService from '../../mod-social-feed';
import * as sendLogging from '../../mod-send-logging';
import { supabase } from '../../../lib/supabase';
import { renderOptions } from '../test-utils';

// ── Typed helpers ─────────────────────────────────────────────────────────────
const mockFetchSavedRouteIds = routeService.fetchSavedRouteIds as jest.MockedFunction<
  typeof routeService.fetchSavedRouteIds
>;
const mockSaveRoute = routeService.saveRoute as jest.MockedFunction<
  typeof routeService.saveRoute
>;
const mockUnsaveRoute = routeService.unsaveRoute as jest.MockedFunction<
  typeof routeService.unsaveRoute
>;
const mockFetchFollowing = socialFeedService.fetchFollowing as jest.MockedFunction<
  typeof socialFeedService.fetchFollowing
>;
const mockFetchUserAchievements = sendLogging.fetchUserAchievements as jest.MockedFunction<
  typeof sendLogging.fetchUserAchievements
>;
const mockFrom = supabase.from as jest.MockedFunction<typeof supabase.from>;
const mockRpc = supabase.rpc as jest.MockedFunction<typeof supabase.rpc>;

// ── Mock session ──────────────────────────────────────────────────────────────
const MOCK_SESSION = {
  user: { id: 'user-001' },
  access_token: 'tok',
} as unknown as Session;

// ── Mock props ────────────────────────────────────────────────────────────────
const DEFAULT_PROPS = {
  session: MOCK_SESSION,
  isActive: true,
  onViewAllGyms: jest.fn(),
  onSelectGym: jest.fn(),
  onSelectRoute: jest.fn(),
  onSelectClimber: jest.fn(),
};

// ── Builder helpers ───────────────────────────────────────────────────────────

/** Builds a chainable mock query builder that resolves to `result`. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeQueryBuilder(result: { data: unknown; error: null | object }): any {
  const promise = Promise.resolve(result);
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockReturnValue(Promise.resolve(result)),
    then: promise.then.bind(promise),
  };
}

/** Overrides tables on top of the empty defaults. */
function mockTables(tables: Record<string, unknown[]>): void {
  mockFrom.mockImplementation((table: string) => {
    if (table === 'admin_banners') return makeQueryBuilder({ data: null, error: null });
    return makeQueryBuilder({ data: tables[table] ?? [], error: null });
  });
}

function mockSavedGym(): void {
  mockTables({ saved_gyms: [{ gym_id: 'gym-001', gyms: { id: 'gym-001', name: 'Gym One', photo_url: null } }] });
}

/** Saved routes in the given grades (one route per grade entry). */
function mockSavedRoutes(grades: string[]): void {
  mockFetchSavedRouteIds.mockResolvedValue(grades.map((_, i) => `route-00${i}`));
  mockTables({
    routes: grades.map((grade, i) => ({
      id: `route-00${i}`,
      gym_id: 'gym-001',
      grade,
      color_tag: 'red',
      photo_url: null,
    })),
  });
}

function mockFollowed(names: string[]): void {
  mockFetchFollowing.mockResolvedValue(names.map((n, i) => ({ id: `user-10${i}`, display_name: n, avatar_url: null })));
  mockTables({
    beta_videos: names.map((_, i) => ({ user_id: `user-10${i}`, updated_at: new Date().toISOString() })),
  });
}

// ── Default mock setup ────────────────────────────────────────────────────────

/** Sets up supabase.from() to return sensible defaults for all tables. */
function setupDefaultMocks() {
  mockFetchSavedRouteIds.mockResolvedValue([]);
  mockSaveRoute.mockResolvedValue(undefined);
  mockUnsaveRoute.mockResolvedValue(undefined);
  mockFetchFollowing.mockResolvedValue([]);
  mockFetchUserAchievements.mockResolvedValue({});
  mockRpc.mockResolvedValue({ data: [], error: null } as never);

  mockFrom.mockImplementation((table: string) => {
    if (table === 'admin_banners') {
      return makeQueryBuilder({ data: null, error: null });
    }
    if (table === 'saved_gyms') {
      return makeQueryBuilder({ data: [], error: null });
    }
    if (table === 'user_route_visits') {
      return makeQueryBuilder({ data: [], error: null });
    }
    if (table === 'routes') {
      return makeQueryBuilder({ data: [], error: null });
    }
    if (table === 'beta_videos') {
      return makeQueryBuilder({ data: [], error: null });
    }
    return makeQueryBuilder({ data: null, error: null });
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('HomeScreen (Rev 36)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearNewBetaCache();
    setupDefaultMocks();
  });

  // ── AC-112 / AC-174: Events Banner ────────────────────────────────────────

  describe('Events Banner (AC-112, AC-174)', () => {
    it('hides the banner section when no active banner exists', async () => {
      // Default: admin_banners returns null.
      render(<HomeScreen {...DEFAULT_PROPS} />, renderOptions());
      await waitFor(() => {
        // No banner text should be rendered.
        expect(screen.queryByText('Competition')).toBeNull();
      });
    });

    it('renders the banner title when an active banner exists (AC-112)', async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === 'admin_banners') {
          return makeQueryBuilder({
            data: {
              id: 'banner-1',
              title: 'Summer Comp',
              body: 'Sign up now!',
              image_url: null,
            },
            error: null,
          });
        }
        return makeQueryBuilder({ data: [], error: null });
      });

      render(<HomeScreen {...DEFAULT_PROPS} />, renderOptions());
      await waitFor(() => {
        expect(screen.getByText('Summer Comp')).toBeTruthy();
      });
    });

    it('renders the banner body text (AC-112)', async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === 'admin_banners') {
          return makeQueryBuilder({
            data: {
              id: 'banner-1',
              title: 'Summer Comp',
              body: 'Sign up now!',
              image_url: null,
            },
            error: null,
          });
        }
        return makeQueryBuilder({ data: [], error: null });
      });

      render(<HomeScreen {...DEFAULT_PROPS} />, renderOptions());
      await waitFor(() => {
        expect(screen.getByText('Sign up now!')).toBeTruthy();
      });
    });

    it('reads from admin_banners table (AC-174)', async () => {
      render(<HomeScreen {...DEFAULT_PROPS} />, renderOptions());
      await waitFor(() => {
        expect(mockFrom).toHaveBeenCalledWith('admin_banners');
      });
    });
  });

  // ── AC-113 / AC-115: Saved Gyms ───────────────────────────────────────────

  describe('Saved Gyms (AC-113, AC-115)', () => {
    it('renders the "Saved Gyms" section title', async () => {
      render(<HomeScreen {...DEFAULT_PROPS} />, renderOptions());
      await waitFor(() => {
        expect(screen.getByText('Saved Gyms')).toBeTruthy();
      });
    });

    it('shows empty state when user has no saved gyms (AC-115)', async () => {
      render(<HomeScreen {...DEFAULT_PROPS} />, renderOptions());
      await waitFor(() => {
        expect(
          screen.getByText('Tap the bookmark on any gym to save it.'),
        ).toBeTruthy();
      });
    });

    it('renders gym chips for saved gyms (AC-113)', async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === 'admin_banners') {
          return makeQueryBuilder({ data: null, error: null });
        }
        if (table === 'saved_gyms') {
          return makeQueryBuilder({
            data: [
              {
                gym_id: 'gym-001',
                gyms: { id: 'gym-001', name: 'MegaSTONE', photo_url: null },
              },
            ],
            error: null,
          });
        }
        if (table === 'user_route_visits') {
          return makeQueryBuilder({ data: [], error: null });
        }
        return makeQueryBuilder({ data: [], error: null });
      });

      render(<HomeScreen {...DEFAULT_PROPS} />, renderOptions());
      await waitFor(() => {
        expect(screen.getByText('MegaSTONE')).toBeTruthy();
      });
    });

    it('calls onSelectGym with gymId and gymName when gym chip is pressed (AC-114/AC-176)', async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === 'admin_banners') {
          return makeQueryBuilder({ data: null, error: null });
        }
        if (table === 'saved_gyms') {
          return makeQueryBuilder({
            data: [
              {
                gym_id: 'gym-001',
                gyms: { id: 'gym-001', name: 'MegaSTONE', photo_url: null },
              },
            ],
            error: null,
          });
        }
        if (table === 'user_route_visits') {
          return makeQueryBuilder({ data: [], error: null });
        }
        return makeQueryBuilder({ data: [], error: null });
      });

      const mockOnSelectGym = jest.fn();
      render(
        <HomeScreen {...DEFAULT_PROPS} onSelectGym={mockOnSelectGym} />,
        renderOptions(),
      );
      await waitFor(() => screen.getByText('MegaSTONE'));
      fireEvent.press(screen.getByText('MegaSTONE'));
      expect(mockOnSelectGym).toHaveBeenCalledWith('gym-001', 'MegaSTONE');
    });

    it('calls onViewAllGyms when "View All" is pressed (AC-113)', async () => {
      const mockOnViewAll = jest.fn();
      mockSavedGym();
      render(
        <HomeScreen {...DEFAULT_PROPS} onViewAllGyms={mockOnViewAll} />,
        renderOptions(),
      );
      await waitFor(() => screen.getByText('Gym One'));
      fireEvent.press(screen.getByText('View All'));
      expect(mockOnViewAll).toHaveBeenCalledTimes(1);
    });
  });

  // ── AC-177 / AC-178 / AC-181: Projecting Routes ───────────────────────────

  describe('Projecting Routes (AC-177, AC-178, AC-181)', () => {
    it('renders the "Projecting" section title', async () => {
      render(<HomeScreen {...DEFAULT_PROPS} />, renderOptions());
      await waitFor(() => {
        expect(screen.getByText('Projecting')).toBeTruthy();
      });
    });

    it('shows empty state when user has no saved routes (AC-177)', async () => {
      mockFetchSavedRouteIds.mockResolvedValue([]);
      render(<HomeScreen {...DEFAULT_PROPS} />, renderOptions());
      await waitFor(() => {
        expect(
          screen.getByText('Save a route to track your projects.'),
        ).toBeTruthy();
      });
    });

    it('renders route cards for projecting routes (AC-177)', async () => {
      mockFetchSavedRouteIds.mockResolvedValue(['route-001']);
      mockFrom.mockImplementation((table: string) => {
        if (table === 'admin_banners') return makeQueryBuilder({ data: null, error: null });
        if (table === 'saved_gyms') return makeQueryBuilder({ data: [], error: null });
        if (table === 'user_route_visits') return makeQueryBuilder({ data: [], error: null });
        if (table === 'beta_videos') return makeQueryBuilder({ data: [], error: null });
        if (table === 'routes') {
          return makeQueryBuilder({
            data: [
              {
                id: 'route-001',
                gym_id: 'gym-001',
                grade: 'V5',
                color_tag: 'red',
                photo_url: null,
              },
            ],
            error: null,
          });
        }
        return makeQueryBuilder({ data: [], error: null });
      });
      mockRpc.mockResolvedValue({ data: [], error: null } as never);

      render(<HomeScreen {...DEFAULT_PROPS} />, renderOptions());
      await waitFor(() => {
        expect(screen.getByText('V5 Red')).toBeTruthy();
      });
    });

    it('does not render a "New Beta" chip on any route card (AC-181 Rev 39)', async () => {
      // Rev 39 removed the "New Beta" chip from RouteCard entirely.
      // Even when the routes_with_new_beta RPC returns results, no chip appears.
      mockFetchSavedRouteIds.mockResolvedValue(['route-001']);
      mockFrom.mockImplementation((table: string) => {
        if (table === 'admin_banners') return makeQueryBuilder({ data: null, error: null });
        if (table === 'saved_gyms') return makeQueryBuilder({ data: [], error: null });
        if (table === 'user_route_visits') return makeQueryBuilder({ data: [], error: null });
        if (table === 'beta_videos') return makeQueryBuilder({ data: [], error: null });
        if (table === 'routes') {
          return makeQueryBuilder({
            data: [{ id: 'route-001', gym_id: 'gym-001', grade: 'V5', color_tag: 'red', photo_url: null }],
            error: null,
          });
        }
        return makeQueryBuilder({ data: [], error: null });
      });
      // RPC returns route-001 as having new beta — but the chip must still not appear.
      mockRpc.mockResolvedValue({
        data: [{ route_id: 'route-001' }],
        error: null,
      } as never);

      render(<HomeScreen {...DEFAULT_PROPS} />, renderOptions());
      // Wait for the route card to render, then confirm no "New Beta" text appears.
      await waitFor(() => {
        expect(screen.getByText('V5 Red')).toBeTruthy();
      });
      expect(screen.queryByText('New Beta')).toBeNull();
    });

    it('calls onSelectRoute when a route card is pressed (AC-178)', async () => {
      mockFetchSavedRouteIds.mockResolvedValue(['route-001']);
      mockFrom.mockImplementation((table: string) => {
        if (table === 'admin_banners') return makeQueryBuilder({ data: null, error: null });
        if (table === 'saved_gyms') return makeQueryBuilder({ data: [], error: null });
        if (table === 'user_route_visits') return makeQueryBuilder({ data: [], error: null });
        if (table === 'beta_videos') return makeQueryBuilder({ data: [], error: null });
        if (table === 'routes') {
          return makeQueryBuilder({
            data: [{ id: 'route-001', gym_id: 'gym-001', grade: 'V5', color_tag: 'red', photo_url: null }],
            error: null,
          });
        }
        return makeQueryBuilder({ data: [], error: null });
      });
      mockRpc.mockResolvedValue({ data: [], error: null } as never);

      const mockOnSelectRoute = jest.fn();
      render(
        <HomeScreen {...DEFAULT_PROPS} onSelectRoute={mockOnSelectRoute} />,
        renderOptions(),
      );
      await waitFor(() => screen.getByText('V5 Red'));
      fireEvent.press(screen.getByTestId('route-card-V5 Red'));
      expect(mockOnSelectRoute).toHaveBeenCalledWith('route-001', 'gym-001');
    });

    it('shows the grade chips only when the saved routes span 2+ grades (AC-177)', async () => {
      mockSavedRoutes(['V4', 'V6']);
      render(<HomeScreen {...DEFAULT_PROPS} />, renderOptions());
      await waitFor(() => screen.getByText('V4 Red'));
      expect(screen.getByText('All')).toBeTruthy();
      // 「V6」 is both a chip label and the mocked card's grade line.
      expect(screen.getAllByText('V6').length).toBeGreaterThanOrEqual(2);
    });

    it('never shows a lone 「All」 chip: none with 0 routes or a single grade (AC-177)', async () => {
      const { unmount } = render(<HomeScreen {...DEFAULT_PROPS} />, renderOptions());
      await waitFor(() => screen.getByText('Save a route to track your projects.'));
      expect(screen.queryByText('All')).toBeNull();
      unmount();

      mockSavedRoutes(['V4', 'V4']);
      render(<HomeScreen {...DEFAULT_PROPS} />, renderOptions());
      await waitFor(() => screen.getAllByText('V4 Red'));
      expect(screen.queryByText('All')).toBeNull();
    });

    it('calls routes_with_new_beta RPC (AC-181)', async () => {
      mockFetchSavedRouteIds.mockResolvedValue(['route-001']);
      mockFrom.mockImplementation((table: string) => {
        if (table === 'admin_banners') return makeQueryBuilder({ data: null, error: null });
        if (table === 'saved_gyms') return makeQueryBuilder({ data: [], error: null });
        if (table === 'user_route_visits') return makeQueryBuilder({ data: [], error: null });
        if (table === 'beta_videos') return makeQueryBuilder({ data: [], error: null });
        if (table === 'routes') {
          return makeQueryBuilder({
            data: [{ id: 'route-001', gym_id: 'gym-001', grade: 'V3', color_tag: 'blue', photo_url: null }],
            error: null,
          });
        }
        return makeQueryBuilder({ data: [], error: null });
      });

      render(<HomeScreen {...DEFAULT_PROPS} />, renderOptions());
      await waitFor(() => {
        expect(mockRpc).toHaveBeenCalledWith('routes_with_new_beta', {
          route_ids: ['route-001'],
        });
      });
    });

    it('does not reuse cache when the route-id set changes (cache key mismatch)', async () => {
      // First render: route-set A = ['route-001'], RPC returns route-001 as new-beta.
      // Render with isActive=false so only the mount effect fires (avoids double-call from
      // the isActive focus-refetch effect, keeping the first-render RPC count predictable).
      mockFetchSavedRouteIds.mockResolvedValue(['route-001']);
      mockFrom.mockImplementation((table: string) => {
        if (table === 'admin_banners') return makeQueryBuilder({ data: null, error: null });
        if (table === 'saved_gyms') return makeQueryBuilder({ data: [], error: null });
        if (table === 'user_route_visits') return makeQueryBuilder({ data: [], error: null });
        if (table === 'beta_videos') return makeQueryBuilder({ data: [], error: null });
        if (table === 'routes') {
          return makeQueryBuilder({
            data: [{ id: 'route-001', gym_id: 'gym-001', grade: 'V3', color_tag: 'blue', photo_url: null }],
            error: null,
          });
        }
        return makeQueryBuilder({ data: [], error: null });
      });
      mockRpc.mockResolvedValue({
        data: [{ route_id: 'route-001' }],
        error: null,
      } as never);

      const { unmount } = render(
        <HomeScreen {...DEFAULT_PROPS} isActive={false} />,
        renderOptions(),
      );
      // Wait for the RPC to be called at least once — cache now primed for route-set A.
      await waitFor(() => {
        expect(mockRpc).toHaveBeenCalledWith('routes_with_new_beta', {
          route_ids: ['route-001'],
        });
      });
      const callsAfterFirstRender = mockRpc.mock.calls.length;
      unmount();

      // Second render: route-set B = ['route-002'] — different set, cache key changes.
      // The RPC MUST be called again (not reusing the stale cache from set A).
      jest.clearAllMocks();
      setupDefaultMocks();
      mockFetchSavedRouteIds.mockResolvedValue(['route-002']);
      mockFrom.mockImplementation((table: string) => {
        if (table === 'admin_banners') return makeQueryBuilder({ data: null, error: null });
        if (table === 'saved_gyms') return makeQueryBuilder({ data: [], error: null });
        if (table === 'user_route_visits') return makeQueryBuilder({ data: [], error: null });
        if (table === 'beta_videos') return makeQueryBuilder({ data: [], error: null });
        if (table === 'routes') {
          return makeQueryBuilder({
            data: [{ id: 'route-002', gym_id: 'gym-001', grade: 'V4', color_tag: 'green', photo_url: null }],
            error: null,
          });
        }
        return makeQueryBuilder({ data: [], error: null });
      });
      // RPC returns empty for route-set B — route-002 has no new beta.
      mockRpc.mockResolvedValue({ data: [], error: null } as never);

      render(
        <HomeScreen {...DEFAULT_PROPS} isActive={false} />,
        renderOptions(),
      );
      await waitFor(() => {
        // RPC must have been called for route-set B (cache miss — different key).
        expect(mockRpc).toHaveBeenCalledWith('routes_with_new_beta', {
          route_ids: ['route-002'],
        });
        // 'New Beta' badge must NOT appear — route-002 is not in the new-beta set.
        expect(screen.queryByText('New Beta')).toBeNull();
      });
      // Suppress unused variable warning — used to confirm first render completed.
      expect(callsAfterFirstRender).toBeGreaterThanOrEqual(1);
    });
  });

  // ── AC-182: Following Activity ─────────────────────────────────────────────

  describe('Following strip (AC-182, home-v2)', () => {
    it('renders the section title and one tile per climber with name + relative time', async () => {
      mockFollowed(['Alice Chen']);
      render(<HomeScreen {...DEFAULT_PROPS} />, renderOptions());
      await waitFor(() => screen.getByText('Alice Chen'));
      expect(screen.getByText('New beta videos')).toBeTruthy();
      expect(screen.getByText('today')).toBeTruthy();
      // The fixed 「new video upload」 label moved to the title: no per-tile label, no new-video marker.
      expect(screen.queryByText(/new video upload/)).toBeNull();
    });

    it('calls onSelectClimber with the userId when a tile is tapped (AC-182)', async () => {
      mockFollowed(['Alice Chen']);
      const onSelectClimber = jest.fn();
      render(<HomeScreen {...DEFAULT_PROPS} onSelectClimber={onSelectClimber} />, renderOptions());
      await waitFor(() => screen.getByText('Alice Chen'));
      fireEvent.press(screen.getByLabelText('Alice Chen, new video upload, today'));
      expect(onSelectClimber).toHaveBeenCalledWith('user-100');
    });

    it('shows every followed climber with activity in the strip (no 3-row cap, no expander)', async () => {
      mockFollowed(['Climber A', 'Climber B', 'Climber C', 'Climber D', 'Climber E']);
      render(<HomeScreen {...DEFAULT_PROPS} />, renderOptions());
      await waitFor(() => screen.getByText('Climber A'));
      expect(screen.getByText('Climber E')).toBeTruthy();
      expect(screen.queryByLabelText(/Show all/)).toBeNull();
    });

    it('「View All」 opens the Following list for the signed-in user', async () => {
      mockFollowed(['Alice Chen']);
      const onViewAllFollowing = jest.fn();
      render(<HomeScreen {...DEFAULT_PROPS} onViewAllFollowing={onViewAllFollowing} />, renderOptions());
      await waitFor(() => screen.getByText('Alice Chen'));
      // Saved Gyms is empty (no link), so the only 「View All」 is Following's.
      fireEvent.press(screen.getByLabelText('View All'));
      expect(onViewAllFollowing).toHaveBeenCalledWith(MOCK_SESSION.user.id);
    });

    it('uses fetchFollowing from mod-social-feed to get followed user list (AC-182)', async () => {
      render(<HomeScreen {...DEFAULT_PROPS} />, renderOptions());
      await waitFor(() => {
        expect(mockFetchFollowing).toHaveBeenCalledWith(MOCK_SESSION.user.id);
      });
    });
  });

  // ── AC-111: Section ordering ───────────────────────────────────────────────

  describe('Section ordering (AC-111 restored by home-v2)', () => {
    it('renders the section titles in order: Saved Gyms, Projecting, Following', async () => {
      render(<HomeScreen {...DEFAULT_PROPS} />, renderOptions());
      await waitFor(() => {
        expect(screen.getByText('Saved Gyms')).toBeTruthy();
        expect(screen.getByText('Projecting')).toBeTruthy();
        expect(screen.getByText('New beta videos')).toBeTruthy();
      });
      const tree = JSON.stringify(screen.toJSON());
      const at = (s: string): number => tree.indexOf(`"${s}"`);
      expect(at('Saved Gyms')).toBeGreaterThan(-1);
      expect(at('Saved Gyms')).toBeLessThan(at('Projecting'));
      expect(at('Projecting')).toBeLessThan(at('New beta videos'));
    });
  });

  // ── Empty states: one inline form for all three sections ──────────────────

  describe('Inline empty states (home-v2)', () => {
    it('shows an inline sentence + a ghost action in every empty section, and hides 「View All」', async () => {
      const onViewAllGyms = jest.fn();
      const onFindClimbers = jest.fn();
      render(<HomeScreen {...DEFAULT_PROPS} onViewAllGyms={onViewAllGyms} onFindClimbers={onFindClimbers} />, renderOptions());
      await waitFor(() => screen.getByText('Follow climbers to see their new beta videos'));
      expect(screen.getByText('Tap the bookmark on any gym to save it.')).toBeTruthy();
      expect(screen.getByText('Save a route to track your projects.')).toBeTruthy();
      expect(screen.queryByText('View All')).toBeNull();
      expect(screen.queryByText('All')).toBeNull();

      fireEvent.press(screen.getByText('Explore gyms'));
      fireEvent.press(screen.getByText('Browse routes'));
      expect(onViewAllGyms).toHaveBeenCalledTimes(2);
      fireEvent.press(screen.getByText('Find climbers'));
      expect(onFindClimbers).toHaveBeenCalledTimes(1);
    });

    it('also shows the Following empty state when followed users have no new beta videos', async () => {
      mockFetchFollowing.mockResolvedValue([{ id: 'user-002', display_name: 'Alice', avatar_url: null }]);
      render(<HomeScreen {...DEFAULT_PROPS} />, renderOptions());
      await waitFor(() => screen.getByText('Follow climbers to see their new beta videos'));
    });
  });

  // ── Keep-alive re-fetch (isActive) ────────────────────────────────────────

  describe('Keep-alive re-fetch pattern', () => {
    it('re-fetches saved gyms when isActive flips to true', async () => {
      const { rerender } = render(
        <HomeScreen {...DEFAULT_PROPS} isActive={false} />,
        renderOptions(),
      );
      const callsBefore = mockFrom.mock.calls.filter(
        (c) => c[0] === 'saved_gyms',
      ).length;

      rerender(<HomeScreen {...DEFAULT_PROPS} isActive={true} />);
      await waitFor(() => {
        const callsAfter = mockFrom.mock.calls.filter(
          (c) => c[0] === 'saved_gyms',
        ).length;
        expect(callsAfter).toBeGreaterThan(callsBefore);
      });
    });
  });
});
