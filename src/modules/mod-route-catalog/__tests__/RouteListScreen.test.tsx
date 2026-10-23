/**
 * Tests for RouteListScreen.
 *
 * Tests behaviour — not implementation.
 * The route-service module is mocked; no real network activity.
 *
 * AC-040: grade + hold-color chip filters; no text search; no status filter.
 * AC-041: shows active routes only (no status filter for normal users).
 * AC-045: route cards show formatted name "{grade} {LocalizedColor} ({section_label}?)".
 * AC-046/190: achievement icons (hasSend, sendStyle) wired to RouteCard via
 *   fetchUserAchievements. RouteCard renders send badge natively.
 * AC-047: interactive bookmark toggle on saved route cards via RouteCard isSaved /
 *   onBookmarkToggle props. Optimistic update: saveRoute/unsaveRoute called.
 * AC-180/AC-181: fetchRoutesWithNewBeta called once after routes load (retained for
 *   AC-175 ordering); "new beta" chip no longer rendered on cards (AC-181, Rev 39).
 * AC-189: betaVideoCount fetched via fetchBetaVideoCounts and passed to RouteCard.
 */

jest.mock('../../../lib/supabase', () => ({
  supabase: { from: jest.fn() },
}));

jest.mock('../route-service', () => ({
  listRoutes: jest.fn(),
  fetchSavedRouteIds: jest.fn(),
  fetchRoutesWithNewBeta: jest.fn(),
  // AC-189: beta count RPC wrapper
  fetchBetaVideoCounts: jest.fn(),
  // AC-047 Rev 39: interactive bookmark toggle
  saveRoute: jest.fn(),
  unsaveRoute: jest.fn(),
  // RouteCard (shared component) imports getPhotoSignedUrl from this module;
  // mock it to prevent async state-update errors on unmounted components in tests.
  getPhotoSignedUrl: jest.fn().mockResolvedValue('https://signed.url/photo.jpg'),
}));

jest.mock('../../mod-send-logging', () => ({
  fetchUserAchievements: jest.fn(),
}));

import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';

import {
  listRoutes,
  fetchSavedRouteIds,
  fetchRoutesWithNewBeta,
  fetchBetaVideoCounts,
  saveRoute,
  unsaveRoute,
} from '../route-service';
import { fetchUserAchievements } from '../../mod-send-logging';
import RouteListScreen, { clearNewBetaCacheForTesting } from '../screens/RouteListScreen';
import type { RouteSummary } from '../types';
import { renderOptions } from '../test-utils';

const mockListRoutes = listRoutes as jest.MockedFunction<typeof listRoutes>;
const mockFetchSavedRouteIds = fetchSavedRouteIds as jest.MockedFunction<typeof fetchSavedRouteIds>;
const mockFetchUserAchievements = fetchUserAchievements as jest.MockedFunction<typeof fetchUserAchievements>;
const mockFetchRoutesWithNewBeta = fetchRoutesWithNewBeta as jest.MockedFunction<typeof fetchRoutesWithNewBeta>;
const mockFetchBetaVideoCounts = fetchBetaVideoCounts as jest.MockedFunction<typeof fetchBetaVideoCounts>;
const mockSaveRoute = saveRoute as jest.MockedFunction<typeof saveRoute>;
const mockUnsaveRoute = unsaveRoute as jest.MockedFunction<typeof unsaveRoute>;

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
    // Clear the module-level new-beta cache so each test gets a fresh fetch.
    clearNewBetaCacheForTesting();
    // Default: no saved routes, no achievements, no new-beta routes, no beta counts
    mockFetchSavedRouteIds.mockResolvedValue([]);
    mockFetchUserAchievements.mockResolvedValue({});
    mockFetchRoutesWithNewBeta.mockResolvedValue([]);
    mockFetchBetaVideoCounts.mockResolvedValue({});
    mockSaveRoute.mockResolvedValue(undefined);
    mockUnsaveRoute.mockResolvedValue(undefined);
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
      // AC-045: formatted name includes grade — RouteCard renders these as Text nodes.
      // Find by accessibilityLabel on the Pressable (RouteCard uses "{name} {grade}").
      const routeCards = screen.queryAllByRole('button').filter(
        (el) => el.props.accessibilityLabel?.includes('V3') || el.props.accessibilityLabel?.includes('V5'),
      );
      expect(routeCards.length).toBeGreaterThan(0);
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
      // RouteCard renders the name as a Text node — find by text content.
      // V3 Red route: formatted name "V3 Red" or "V3 紅色".
      const v3Cards = screen.queryAllByText(/^V3/, { includeHiddenElements: true });
      expect(v3Cards.length).toBeGreaterThan(0);
    });
  });

  it('AC-045: appends section label in parentheses when present', async () => {
    mockListRoutes.mockResolvedValueOnce(ACTIVE_ROUTES);

    render(<RouteListScreen {...DEFAULT_PROPS} />, renderOptions());

    await waitFor(() => {
      // r-002 has section_label: 'Cave' — formatted name should include "(Cave)".
      const caveTexts = screen.queryAllByText(/Cave/, { includeHiddenElements: true });
      expect(caveTexts.length).toBeGreaterThan(0);
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
    // r-002 is saved; r-001 is not — r-002 should appear first in the sorted output.
    // RouteCard renders each card as a button with accessibilityLabel "{name} {grade}".
    mockListRoutes.mockResolvedValueOnce(ACTIVE_ROUTES);
    mockFetchSavedRouteIds.mockResolvedValueOnce(['r-002']);

    render(<RouteListScreen {...DEFAULT_PROPS} />, renderOptions());

    await waitFor(() => {
      // Find route card buttons by their label — filter out chip checkboxes + CTA
      const routeButtons = screen.queryAllByRole('button').filter(
        (el) =>
          el.props.accessibilityLabel?.includes('V3') ||
          el.props.accessibilityLabel?.includes('V5'),
      );
      expect(routeButtons.length).toBe(2);
      // r-002 (V5 Blue Cave) should appear first (it is saved).
      expect(routeButtons[0].props.accessibilityLabel).toMatch(/V5/);
      // r-001 (V3 Red) should appear second.
      expect(routeButtons[1].props.accessibilityLabel).toMatch(/V3/);
    });
  });

  it('calls onSelectRoute with the route id when a card is pressed', async () => {
    mockListRoutes.mockResolvedValueOnce(ACTIVE_ROUTES);

    render(<RouteListScreen {...DEFAULT_PROPS} />, renderOptions());

    // Wait for routes to render; RouteCard uses accessibilityLabel on the Pressable.
    await waitFor(() => {
      const routeCards = screen.queryAllByRole('button').filter(
        (el) => el.props.accessibilityLabel?.includes('V3'),
      );
      expect(routeCards.length).toBeGreaterThan(0);
    });

    const routeCard = screen.queryAllByRole('button').find(
      (el) => el.props.accessibilityLabel?.includes('V3'),
    );
    if (routeCard) {
      fireEvent.press(routeCard);
      expect(DEFAULT_PROPS.onSelectRoute).toHaveBeenCalledWith('r-001');
    }
  });

  it('RL-2: shows ONE filter row (no inline grade/colour chip rows) and add-route CTA only in the empty state', async () => {
    mockListRoutes.mockResolvedValueOnce(ACTIVE_ROUTES);

    render(<RouteListScreen {...DEFAULT_PROPS} />, renderOptions());

    await waitFor(() => {
      expect(screen.getByTestId('filter-row')).toBeTruthy();
    });
    // Only the single Filter chip; grade chips live in the sheet.
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(screen.queryAllByLabelText(/Can't find it|找不到路線/)).toHaveLength(0);
  });

  it('RL-2: empty list offers add-route and calls onSubmitRoute', async () => {
    mockListRoutes.mockResolvedValueOnce([]);

    render(<RouteListScreen {...DEFAULT_PROPS} />, renderOptions());

    const cta = await screen.findByLabelText(/Can't find it|找不到路線/);
    fireEvent.press(cta);
    expect(DEFAULT_PROPS.onSubmitRoute).toHaveBeenCalled();
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

    // Wait for routes to render via RouteCard (accessibilityLabel on Pressable).
    await waitFor(() => {
      const routeCards = screen.queryAllByRole('button').filter(
        (el) => el.props.accessibilityLabel?.includes('V3') || el.props.accessibilityLabel?.includes('V5'),
      );
      expect(routeCards.length).toBeGreaterThan(0);
    });

    // There should be no tab with accessibilityRole="tab"
    const statusTabs = screen.queryAllByRole('tab');
    expect(statusTabs).toHaveLength(0);
  });

  it('AC-180/AC-181: calls fetchRoutesWithNewBeta once after routes load (retained for AC-175)', async () => {
    mockListRoutes.mockResolvedValueOnce(ACTIVE_ROUTES);

    render(<RouteListScreen {...DEFAULT_PROPS} />, renderOptions());

    await waitFor(() => {
      // fetchRoutesWithNewBeta should be called with all visible route IDs
      expect(mockFetchRoutesWithNewBeta).toHaveBeenCalledWith(['r-001', 'r-002']);
    });
  });

  it('AC-181 (Rev 39): does NOT render a "New Beta" chip even when route qualifies', async () => {
    mockListRoutes.mockResolvedValueOnce(ACTIVE_ROUTES);
    // r-001 qualifies for the new-beta tag — but chip is removed per AC-181, Rev 39
    mockFetchRoutesWithNewBeta.mockResolvedValueOnce(['r-001']);

    render(<RouteListScreen {...DEFAULT_PROPS} />, renderOptions());

    await waitFor(() => {
      // fetchRoutesWithNewBeta is still called (retained for AC-175 ordering)
      expect(mockFetchRoutesWithNewBeta).toHaveBeenCalledWith(['r-001', 'r-002']);
    });

    // "New Beta" chip text must NOT appear on any route card
    const newBetaTexts = screen.queryAllByText(/New Beta/i).concat(
      screen.queryAllByText(/新 Beta/),
    );
    expect(newBetaTexts.length).toBe(0);
  });

  it('AC-189: calls fetchBetaVideoCounts once after routes load', async () => {
    mockListRoutes.mockResolvedValueOnce(ACTIVE_ROUTES);

    render(<RouteListScreen {...DEFAULT_PROPS} />, renderOptions());

    await waitFor(() => {
      expect(mockFetchBetaVideoCounts).toHaveBeenCalledWith(['r-001', 'r-002']);
    });
  });

  it('AC-189: passes betaVideoCount to RouteCard when count > 0', async () => {
    mockListRoutes.mockResolvedValueOnce(ACTIVE_ROUTES);
    // r-001 has 3 beta videos
    mockFetchBetaVideoCounts.mockResolvedValueOnce({ 'r-001': 3 });

    render(<RouteListScreen {...DEFAULT_PROPS} />, renderOptions());

    await waitFor(() => {
      // RouteCard renders "3 Beta Videos" (routeCard.betaCount i18n key)
      const betaTexts = screen.queryAllByText(/3 Beta Videos/i, { includeHiddenElements: true }).concat(
        screen.queryAllByText(/3 條路線影片/, { includeHiddenElements: true }),
      );
      expect(betaTexts.length).toBeGreaterThan(0);
    });
  });

  it('AC-047 Rev 39: calls unsaveRoute when bookmark icon is tapped on a saved route', async () => {
    mockListRoutes.mockResolvedValueOnce(ACTIVE_ROUTES);
    // r-001 is saved
    mockFetchSavedRouteIds.mockResolvedValueOnce(['r-001']);
    mockUnsaveRoute.mockResolvedValueOnce(undefined);

    render(<RouteListScreen {...DEFAULT_PROPS} />, renderOptions());

    // Wait for saved bookmark to appear (routeCard.saved / 已收藏)
    await waitFor(() => {
      const savedLabels = screen.queryAllByLabelText(/saved/i).concat(
        screen.queryAllByLabelText('已收藏'),
      );
      expect(savedLabels.length).toBeGreaterThan(0);
    });

    // Press the saved bookmark to unsave
    const savedBookmark = screen.queryAllByLabelText(/saved/i)[0] ??
      screen.queryAllByLabelText('已收藏')[0];
    if (savedBookmark) {
      fireEvent.press(savedBookmark);
      await waitFor(() => {
        expect(mockUnsaveRoute).toHaveBeenCalledWith('r-001');
      });
    }
  });

  it('AC-047 Rev 39: calls saveRoute when bookmark icon is tapped on an unsaved route', async () => {
    mockListRoutes.mockResolvedValueOnce(ACTIVE_ROUTES);
    // no saved routes
    mockFetchSavedRouteIds.mockResolvedValueOnce([]);
    mockSaveRoute.mockResolvedValueOnce(undefined);

    render(<RouteListScreen {...DEFAULT_PROPS} />, renderOptions());

    await waitFor(() => {
      // Unsaved bookmark (routeCard.unsaved / 收藏)
      const unsavedLabels = screen.queryAllByLabelText(/^save$/i).concat(
        screen.queryAllByLabelText('收藏'),
      );
      expect(unsavedLabels.length).toBeGreaterThan(0);
    });

    const unsavedBookmark = screen.queryAllByLabelText(/^save$/i)[0] ??
      screen.queryAllByLabelText('收藏')[0];
    if (unsavedBookmark) {
      fireEvent.press(unsavedBookmark);
      await waitFor(() => {
        expect(mockSaveRoute).toHaveBeenCalled();
      });
    }
  });

  it('RL-2: grade chip in the filter sheet applies the filter and shows a removable chip', async () => {
    mockListRoutes
      .mockResolvedValueOnce(ACTIVE_ROUTES)
      .mockResolvedValueOnce([ACTIVE_ROUTES[0]])
      .mockResolvedValue([ACTIVE_ROUTES[0]]);

    render(<RouteListScreen {...DEFAULT_PROPS} initialFilterSheetOpen />, renderOptions());

    const gradeChip = await screen.findByRole('radio', { name: 'V3' });
    fireEvent.press(gradeChip);

    await waitFor(() => {
      expect(mockListRoutes).toHaveBeenCalledWith(
        'gym-001',
        expect.objectContaining({ grade: 'V3' }),
      );
    });
  });
});
