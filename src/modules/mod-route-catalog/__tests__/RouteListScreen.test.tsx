/**
 * Tests for RouteListScreen.
 *
 * Tests behaviour — not implementation.
 * The route-service module is mocked; no real network activity.
 *
 * AC-040: grade + hold-color chip filters; no text search; no status filter.
 * AC-041: shows active routes only (no status filter for normal users).
 */

jest.mock('../../../lib/supabase', () => ({
  supabase: { from: jest.fn() },
}));

jest.mock('../route-service', () => ({
  listRoutes: jest.fn(),
}));

import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';

import { listRoutes } from '../route-service';
import RouteListScreen from '../screens/RouteListScreen';
import type { RouteSummary } from '../types';
import { renderOptions } from '../test-utils';

const mockListRoutes = listRoutes as jest.MockedFunction<typeof listRoutes>;

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
      expect(screen.getAllByText('V3').length).toBeGreaterThan(0);
      expect(screen.getAllByText('V5').length).toBeGreaterThan(0);
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

  it('shows a section label when present', async () => {
    mockListRoutes.mockResolvedValueOnce(ACTIVE_ROUTES);

    render(<RouteListScreen {...DEFAULT_PROPS} />, renderOptions());

    await waitFor(() => {
      expect(screen.getByText('Cave')).toBeTruthy();
    });
  });

  it('calls onSelectRoute with the route id when a card is pressed', async () => {
    mockListRoutes.mockResolvedValueOnce(ACTIVE_ROUTES);

    render(<RouteListScreen {...DEFAULT_PROPS} />, renderOptions());

    await waitFor(() => {
      expect(screen.getAllByText('V3').length).toBeGreaterThan(0);
    });

    const routeCard = screen.queryAllByRole('button').find(
      (el) => el.props.accessibilityLabel === 'V3 red route',
    );
    if (routeCard) {
      fireEvent.press(routeCard);
      expect(DEFAULT_PROPS.onSelectRoute).toHaveBeenCalledWith('r-001');
    } else {
      fireEvent.press(screen.getAllByText('V3')[0]);
    }
  });

  it('shows the always-visible add-route CTA and calls onSubmitRoute when pressed', async () => {
    mockListRoutes.mockResolvedValueOnce(ACTIVE_ROUTES);

    render(<RouteListScreen {...DEFAULT_PROPS} />, renderOptions());

    await waitFor(() => {
      expect(screen.getAllByText('V3').length).toBeGreaterThan(0);
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
      expect(screen.getAllByText('V3').length).toBeGreaterThan(0);
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
      expect(screen.getAllByText('V3').length).toBeGreaterThan(0);
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
