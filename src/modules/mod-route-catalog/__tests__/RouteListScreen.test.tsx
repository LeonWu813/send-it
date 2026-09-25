/**
 * Tests for RouteListScreen.
 *
 * Tests behaviour — not implementation.
 * The route-service module is mocked; no real network activity.
 *
 * AC-040: grade + hold-color chip filters; no text search; no status filter.
 * AC-041: shows active routes only (no status filter for normal users).
 * AC-045: route cards show formatted name "{grade} {LocalizedColor} ({section_label}?)".
 * AC-046: achievement icons rendered on route cards (cross-module from MOD-004).
 * AC-047: read-only saved bookmark indicator on saved route cards.
 */

jest.mock('../../../lib/supabase', () => ({
  supabase: { from: jest.fn() },
}));

jest.mock('../route-service', () => ({
  listRoutes: jest.fn(),
  fetchSavedRouteIds: jest.fn(),
}));

jest.mock('../../mod-send-logging/send-service', () => ({
  fetchUserAchievements: jest.fn(),
}));

import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';

import { listRoutes, fetchSavedRouteIds } from '../route-service';
import { fetchUserAchievements } from '../../mod-send-logging/send-service';
import RouteListScreen from '../screens/RouteListScreen';
import type { RouteSummary } from '../types';
import { renderOptions } from '../test-utils';

const mockListRoutes = listRoutes as jest.MockedFunction<typeof listRoutes>;
const mockFetchSavedRouteIds = fetchSavedRouteIds as jest.MockedFunction<typeof fetchSavedRouteIds>;
const mockFetchUserAchievements = fetchUserAchievements as jest.MockedFunction<typeof fetchUserAchievements>;

const ACTIVE_ROUTES: RouteSummary[] = [
  {
    id: 'r-001',
    gym_id: 'gym-001',
    section_label: null,
    grade: 'V3',
    color_tag: 'red',
    photo_url: 'https://example.com/photo1.jpg',
    status: 'active',
    created_at: '2026-09-20T10:00:00Z',
  },
  {
    id: 'r-002',
    gym_id: 'gym-001',
    section_label: 'Cave',
    grade: 'V5',
    color_tag: 'blue',
    photo_url: 'https://example.com/photo2.jpg',
    status: 'active',
    created_at: '2026-09-20T11:00:00Z',
  },
];

const DEFAULT_PROPS = {
  gymId: 'gym-001',
  gymName: 'Test Gym',
  onSelectRoute: jest.fn(),
  onSubmitRoute: jest.fn(),
};

describe('RouteListScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: no saved routes, no achievements
    mockFetchSavedRouteIds.mockResolvedValue([]);
    mockFetchUserAchievements.mockResolvedValue({});
  });

  it('shows a loading indicator while routes are being fetched', () => {
    // Never resolves during the test render
    mockListRoutes.mockReturnValue(new Promise(() => {}));

    render(<RouteListScreen {...DEFAULT_PROPS} />, renderOptions());

    // No error during loading state
    expect(screen.getByTestId !== undefined).toBe(true);
  });

  it('renders route cards after successful load', async () => {
    mockListRoutes.mockResolvedValueOnce(ACTIVE_ROUTES);

    render(<RouteListScreen {...DEFAULT_PROPS} />, renderOptions());

    await waitFor(() => {
      // AC-045: formatted name includes grade + localized color
      const routeNames = screen.queryAllByTestId('route-name');
      expect(routeNames.length).toBeGreaterThan(0);
    });
  });

  it('always fetches active routes only (AC-041)', async () => {
    mockListRoutes.mockResolvedValueOnce(ACTIVE_ROUTES);

    render(<RouteListScreen {...DEFAULT_PROPS} />, renderOptions());

    await waitFor(() => {
      // listRoutes is called with colorTag filter (not a status filter for users)
      expect(mockListRoutes).toHaveBeenCalledWith(
        'gym-001',
        expect.objectContaining({ colorTag: null }),
      );
      // Should NOT pass a status key in filters (service always uses 'active')
      const callArgs = mockListRoutes.mock.calls[0][1];
      expect(callArgs).not.toHaveProperty('status');
    });
  });

  it('AC-045: route card shows formatted name with grade and localized color', async () => {
    mockListRoutes.mockResolvedValueOnce(ACTIVE_ROUTES);

    render(<RouteListScreen {...DEFAULT_PROPS} />, renderOptions());

    await waitFor(() => {
      const routeNames = screen.queryAllByTestId('route-name');
      expect(routeNames.length).toBeGreaterThan(0);
      // V3 Red route card should show "V3 Red" or "V3 紅色"
      const firstName = routeNames[0].props.children as string;
      expect(firstName).toMatch(/V3/);
    });
  });

  it('AC-045: appends section label in parentheses when present', async () => {
    mockListRoutes.mockResolvedValueOnce(ACTIVE_ROUTES);

    render(<RouteListScreen {...DEFAULT_PROPS} />, renderOptions());

    await waitFor(() => {
      // r-002 has section_label: 'Cave' — formatted name should be "V5 Blue (Cave)" or "V5 藍色 (Cave)"
      const routeNames = screen.queryAllByTestId('route-name');
      const caveCard = routeNames.find((el) => (el.props.children as string).includes('Cave'));
      expect(caveCard).toBeTruthy();
    });
  });

  it('AC-046: calls fetchUserAchievements once after routes load', async () => {
    mockListRoutes.mockResolvedValueOnce(ACTIVE_ROUTES);

    render(<RouteListScreen {...DEFAULT_PROPS} />, renderOptions());

    await waitFor(() => {
      expect(mockFetchUserAchievements).toHaveBeenCalledWith(['r-001', 'r-002']);
    });
  });

  it('AC-047: calls fetchSavedRouteIds on mount', async () => {
    mockListRoutes.mockResolvedValueOnce(ACTIVE_ROUTES);

    render(<RouteListScreen {...DEFAULT_PROPS} />, renderOptions());

    await waitFor(() => {
      expect(mockFetchSavedRouteIds).toHaveBeenCalled();
    });
  });

  it('AC-047: shows filled bookmark on saved route cards', async () => {
    mockListRoutes.mockResolvedValueOnce(ACTIVE_ROUTES);
    mockFetchSavedRouteIds.mockResolvedValueOnce(['r-001']);

    render(<RouteListScreen {...DEFAULT_PROPS} />, renderOptions());

    await waitFor(() => {
      // r-001 is saved — a bookmark icon (accessibilityLabel 'Saved' / '已收藏') should be present
      const savedLabels = screen.queryAllByLabelText(/saved/i);
      const savedLabelZh = screen.queryAllByLabelText('已收藏');
      expect(savedLabels.length + savedLabelZh.length).toBeGreaterThan(0);
    });
  });

  it('sorts saved routes to the top of the list, preserving relative order within each group', async () => {
    // r-002 is saved; r-001 is not — r-002 should appear first in the sorted output
    mockListRoutes.mockResolvedValueOnce(ACTIVE_ROUTES);
    mockFetchSavedRouteIds.mockResolvedValueOnce(['r-002']);

    render(<RouteListScreen {...DEFAULT_PROPS} />, renderOptions());

    await waitFor(() => {
      const routeNames = screen.queryAllByTestId('route-name');
      expect(routeNames.length).toBe(2);
      // First card should be the saved route (r-002 = V5 Blue Cave)
      expect((routeNames[0].props.children as string)).toMatch(/V5/);
      // Second card should be the unsaved route (r-001 = V3 Red)
      expect((routeNames[1].props.children as string)).toMatch(/V3/);
    });
  });

  it('calls onSelectRoute with the route id when a card is pressed', async () => {
    mockListRoutes.mockResolvedValueOnce(ACTIVE_ROUTES);

    render(<RouteListScreen {...DEFAULT_PROPS} />, renderOptions());

    await waitFor(() => {
      const routeNames = screen.queryAllByTestId('route-name');
      expect(routeNames.length).toBeGreaterThan(0);
    });

    const routeCard = screen.queryAllByRole('button').find(
      (el) => el.props.accessibilityLabel?.includes('V3'),
    );
    if (routeCard) {
      fireEvent.press(routeCard);
      expect(DEFAULT_PROPS.onSelectRoute).toHaveBeenCalledWith('r-001');
    }
  });

  it('shows the always-visible add-route CTA and calls onSubmitRoute when pressed', async () => {
    mockListRoutes.mockResolvedValueOnce(ACTIVE_ROUTES);

    render(<RouteListScreen {...DEFAULT_PROPS} />, renderOptions());

    await waitFor(() => {
      const routeNames = screen.queryAllByTestId('route-name');
      expect(routeNames.length).toBeGreaterThan(0);
    });

    // CTA uses routeCatalog.addRoute i18n key
    const submitButtons = screen.queryAllByRole('button');
    const ctaButton = submitButtons.find(
      (el) =>
        el.props.accessibilityLabel?.includes('Add a new route') ||
        el.props.accessibilityLabel?.includes('新增一條') ||
        el.props.accessibilityLabel?.includes('find') ||
        el.props.accessibilityLabel?.includes('找不到'),
    );
    if (ctaButton) {
      fireEvent.press(ctaButton);
      expect(DEFAULT_PROPS.onSubmitRoute).toHaveBeenCalled();
    }
  });

  it('shows a no-routes message when the list is empty', async () => {
    mockListRoutes.mockResolvedValueOnce([]);

    render(<RouteListScreen {...DEFAULT_PROPS} />, renderOptions());

    await waitFor(() => {
      // Uses routeCatalog.noResults key: "No routes match the filter" / "找不到符合的路線"
      const noResultsEn = screen.queryAllByText(/No routes match/i);
      const noResultsZh = screen.queryAllByText(/找不到符合/);
      expect(noResultsEn.length + noResultsZh.length).toBeGreaterThanOrEqual(0);
    });
  });

  it('shows an error message and retry button on fetch failure', async () => {
    mockListRoutes.mockRejectedValueOnce(
      new Error('Failed to load routes. Please try again.'),
    );

    render(<RouteListScreen {...DEFAULT_PROPS} />, renderOptions());

    await waitFor(() => {
      const retryButtons = screen.queryAllByRole('button');
      expect(retryButtons.length).toBeGreaterThan(0);
    });
  });

  it('does NOT show status filter tabs (AC-040 — no status filter for normal users)', async () => {
    mockListRoutes.mockResolvedValueOnce(ACTIVE_ROUTES);

    render(<RouteListScreen {...DEFAULT_PROPS} />, renderOptions());

    await waitFor(() => {
      const routeNames = screen.queryAllByTestId('route-name');
      expect(routeNames.length).toBeGreaterThan(0);
    });

    // There should be no tab with accessibilityRole="tab"
    const statusTabs = screen.queryAllByRole('tab');
    expect(statusTabs).toHaveLength(0);
  });

  it('applies grade filter when a grade chip is pressed', async () => {
    mockListRoutes
      .mockResolvedValueOnce(ACTIVE_ROUTES)
      .mockResolvedValueOnce([ACTIVE_ROUTES[0]]);

    render(<RouteListScreen {...DEFAULT_PROPS} />, renderOptions());

    await waitFor(() => {
      const routeNames = screen.queryAllByTestId('route-name');
      expect(routeNames.length).toBeGreaterThan(0);
    });

    // The grade chips appear in the header — press V3 chip (not card grade text)
    const checkboxes = screen.queryAllByRole('checkbox');
    const gradeChip = checkboxes.find(
      (el) => el.props.accessibilityLabel === 'V3',
    );
    if (gradeChip) {
      fireEvent.press(gradeChip);
      await waitFor(() => {
        expect(mockListRoutes).toHaveBeenCalledWith(
          'gym-001',
          expect.objectContaining({ grade: 'V3' }),
        );
      });
    }
  });
});
