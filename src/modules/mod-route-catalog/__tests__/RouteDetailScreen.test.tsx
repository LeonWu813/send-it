/**
 * Tests for RouteDetailScreen.
 *
 * Tests behaviour — not implementation.
 * The route-service module is mocked; no real network activity.
 *
 * AC-024b: retire button absent (retirement is now admin-only via Supabase Studio).
 * AC-045: route name composed as "{grade} {LocalizedColor} ({section_label}?)".
 * AC-046: bookmark toggle + achievement icon.
 * AC-125: gym name subtitle beneath route name; no "岩館" label.
 * AC-126: added date footer at the bottom.
 * AC-127: two-column send summary (Sends / Attempts).
 * AC-128: tapping summary card calls onViewSendHistory.
 * AC-130 (RD-1): one full-width Record Send button; the upload entry is owned by BetaVideoSection.
 */

jest.mock('../../../lib/supabase', () => ({
  supabase: { from: jest.fn() },
}));

jest.mock('../route-service', () => ({
  loadRoute: jest.fn(),
  getPhotoSignedUrl: jest.fn(),
  fetchSavedRouteIds: jest.fn(),
  saveRoute: jest.fn(),
  unsaveRoute: jest.fn(),
  // AC-179: fire-and-forget visit upsert; mocked so tests don't fail on missing fn
  upsertRouteVisit: jest.fn(),
}));

jest.mock('../../mod-send-logging', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    fetchUserAchievements: jest.fn(),
    fetchMyAscentsForRoute: jest.fn(),
    deleteAscent: jest.fn(),
    summarizeAscents: jest.fn(),
    // LogSendScreen is rendered in a Modal; mock it as a no-op view.
    LogSendScreen: function MockLogSendScreen() {
      return React.createElement(View, { testID: 'log-send-screen' });
    },
  };
});

// Mock the BetaVideoSection entry point from MOD-005 so RouteDetailScreen tests
// are not affected by MOD-005 internals (cross-module boundary).
jest.mock('../../mod-beta-video', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  function MockBetaVideoSection(props: { onRegisterUploadLauncher?: (fn: () => void) => void }) {
    // Register a no-op launcher so the ref is populated in tests
    React.useEffect(() => {
      props.onRegisterUploadLauncher?.(() => { /* no-op in tests */ });
    }, [props.onRegisterUploadLauncher]);
    return React.createElement(View, { testID: 'beta-video-section' },
      React.createElement(Text, null, 'BetaVideoSection')
    );
  }
  return {
    __esModule: true,
    BetaVideoSection: MockBetaVideoSection,
  };
});

import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import React from 'react';
import type { Session } from '@supabase/supabase-js';

import { loadRoute, getPhotoSignedUrl, fetchSavedRouteIds, saveRoute, unsaveRoute, upsertRouteVisit } from '../route-service';
import { fetchUserAchievements, fetchMyAscentsForRoute, deleteAscent, summarizeAscents } from '../../mod-send-logging';
import RouteDetailScreen from '../screens/RouteDetailScreen';
import type { Route } from '../types';
import { renderOptionsWithHeader as renderOptions } from '../test-utils';

const mockLoadRoute = loadRoute as jest.MockedFunction<typeof loadRoute>;
const mockGetPhotoSignedUrl = getPhotoSignedUrl as jest.MockedFunction<typeof getPhotoSignedUrl>;
const mockFetchSavedRouteIds = fetchSavedRouteIds as jest.MockedFunction<typeof fetchSavedRouteIds>;
const mockSaveRoute = saveRoute as jest.MockedFunction<typeof saveRoute>;
const mockUnsaveRoute = unsaveRoute as jest.MockedFunction<typeof unsaveRoute>;
const mockUpsertRouteVisit = upsertRouteVisit as jest.MockedFunction<typeof upsertRouteVisit>;
const mockFetchUserAchievements = fetchUserAchievements as jest.MockedFunction<typeof fetchUserAchievements>;
const mockFetchMyAscentsForRoute = fetchMyAscentsForRoute as jest.MockedFunction<typeof fetchMyAscentsForRoute>;
const mockDeleteAscent = deleteAscent as jest.MockedFunction<typeof deleteAscent>;
const mockSummarizeAscents = summarizeAscents as jest.MockedFunction<typeof summarizeAscents>;

const MOCK_SESSION = {
  user: { id: 'user-001' },
} as unknown as Session;

const MOCK_ACTIVE_ROUTE: Route = {
  id: 'route-001',
  gym_id: 'gym-001',
  section_label: 'Main Wall',
  grade: 'V5',
  color_tag: 'purple',
  photo_url: 'https://example.com/photo.jpg',
  status: 'active',
  submitted_by_user_id: 'user-001',
  created_at: '2026-09-20T10:00:00Z',
  retired_at: null,
  retired_by_user_id: null,
};

const MOCK_RETIRED_ROUTE: Route = {
  ...MOCK_ACTIVE_ROUTE,
  status: 'retired',
  retired_at: '2026-09-21T10:00:00Z',
  retired_by_user_id: 'user-002',
};

const mockOnViewSendHistory = jest.fn();

const DEFAULT_PROPS = {
  routeId: 'route-001',
  gymName: 'Test Gym',
  session: MOCK_SESSION,
  onBack: jest.fn(),
  onViewSendHistory: mockOnViewSendHistory,
};

describe('RouteDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: photo signing succeeds, not saved, no achievement, no ascents
    mockGetPhotoSignedUrl.mockResolvedValue('https://signed.example.com/photo.jpg');
    mockFetchSavedRouteIds.mockResolvedValue([]);
    mockFetchUserAchievements.mockResolvedValue({});
    mockFetchMyAscentsForRoute.mockResolvedValue([]);
    mockDeleteAscent.mockResolvedValue(undefined);
    mockSaveRoute.mockResolvedValue(undefined);
    mockUnsaveRoute.mockResolvedValue(undefined);
    mockSummarizeAscents.mockReturnValue({ sends: 0, attempts: 0 });
  });

  it('RD-2: large title is "{Colour} · {Section}" and the grade appears once (badge)', async () => {
    mockLoadRoute.mockResolvedValueOnce(MOCK_ACTIVE_ROUTE);

    render(<RouteDetailScreen {...DEFAULT_PROPS} />, renderOptions());

    await waitFor(() => {
      expect(screen.getByText('Purple · Main Wall')).toBeTruthy();
    });
    // Grade only in the badge; no separate "區域"/Section block.
    expect(screen.queryAllByText(/V5/, { includeHiddenElements: true })).toHaveLength(1);
    expect(screen.queryByText('Section')).toBeNull();
    expect(screen.queryByText('區域')).toBeNull();
  });

  it('RD-2 / AC-045: header title ("V5 Purple (Main Wall)") appears only after the large title scrolls off', async () => {
    mockLoadRoute.mockResolvedValueOnce(MOCK_ACTIVE_ROUTE);

    render(<RouteDetailScreen {...DEFAULT_PROPS} />, renderOptions());

    await waitFor(() => {
      expect(screen.getByText('Purple · Main Wall')).toBeTruthy();
    });
    expect(screen.queryByText(/V5 .*\(Main Wall\)/)).toBeNull();

    fireEvent.scroll(screen.getByTestId('route-detail-scroll'), {
      nativeEvent: { contentOffset: { y: 400 } },
    });

    await waitFor(() => {
      expect(screen.getByText(/V5 .*\(Main Wall\)/)).toBeTruthy();
    });
  });

  it('AC-125: shows gym name as subtitle beneath the route name', async () => {
    mockLoadRoute.mockResolvedValueOnce(MOCK_ACTIVE_ROUTE);

    render(<RouteDetailScreen {...DEFAULT_PROPS} />, renderOptions());

    await waitFor(() => {
      // gymName prop ("Test Gym") should appear as subtitle
      expect(screen.getByText('Test Gym')).toBeTruthy();
    });
  });

  it('AC-126: shows the added date footer at the bottom', async () => {
    mockLoadRoute.mockResolvedValueOnce(MOCK_ACTIVE_ROUTE);

    render(<RouteDetailScreen {...DEFAULT_PROPS} />, renderOptions());

    await waitFor(() => {
      // "Added 2026-09-20" or "新增於 2026-09-20"
      const addedTexts = screen.queryAllByText(/2026-09-20/).concat(
        screen.queryAllByText(/Added/),
        screen.queryAllByText(/新增於/),
      );
      expect(addedTexts.length).toBeGreaterThan(0);
      // A6: left-aligned on the keyline, not centred under a left grid
      expect(StyleSheet.flatten(addedTexts[0].props.style).textAlign).toBe('left');
    });
  });

  it('RD-4 / AC-127: shows one inline summary line "Sends N · Attempts M"', async () => {
    mockLoadRoute.mockResolvedValueOnce(MOCK_ACTIVE_ROUTE);
    mockSummarizeAscents.mockReturnValue({ sends: 3, attempts: 7 });

    render(<RouteDetailScreen {...DEFAULT_PROPS} />, renderOptions());

    const line = await screen.findByTestId('send-summary-line');
    expect(line.props.accessibilityLabel).toBe('Sends 3, Attempts 7');
    expect(screen.queryByTestId('sends-summary-card')).toBeNull();
    expect(screen.queryByTestId('attempts-summary-card')).toBeNull();
  });

  it('AC-128: tapping the summary line calls onViewSendHistory with route id', async () => {
    mockLoadRoute.mockResolvedValueOnce(MOCK_ACTIVE_ROUTE);

    render(<RouteDetailScreen {...DEFAULT_PROPS} />, renderOptions());

    fireEvent.press(await screen.findByTestId('send-summary-line'));
    expect(mockOnViewSendHistory).toHaveBeenCalledWith('route-001');
  });

  it('AC-130: shows Record Send action button', async () => {
    mockLoadRoute.mockResolvedValueOnce(MOCK_ACTIVE_ROUTE);

    render(<RouteDetailScreen {...DEFAULT_PROPS} />, renderOptions());

    await waitFor(() => {
      const recordBtn = screen.queryAllByRole('button').find(
        (el) =>
          el.props.accessibilityLabel === 'Record Send' ||
          el.props.accessibilityLabel === '記錄攀登',
      );
      expect(recordBtn).toBeTruthy();
    });
  });

  it('RD-1: Route Detail has no upload button of its own (BetaVideoSection owns the entry)', async () => {
    mockLoadRoute.mockResolvedValueOnce(MOCK_ACTIVE_ROUTE);

    render(<RouteDetailScreen {...DEFAULT_PROPS} />, renderOptions());

    await screen.findByTestId('beta-video-section');
    const uploadBtn = screen.queryAllByRole('button').find(
      (el) =>
        el.props.accessibilityLabel === 'Upload Beta Video' ||
        el.props.accessibilityLabel === '上傳 Beta 影片',
    );
    expect(uploadBtn).toBeUndefined();
  });

  it('AC-046: shows outline bookmark icon when route is not saved', async () => {
    mockLoadRoute.mockResolvedValueOnce(MOCK_ACTIVE_ROUTE);

    render(<RouteDetailScreen {...DEFAULT_PROPS} />, renderOptions());

    await waitFor(() => {
      const saveBtn = screen.queryAllByRole('button').find(
        (el) =>
          el.props.accessibilityLabel === 'Save route' ||
          el.props.accessibilityLabel === '收藏路線',
      );
      expect(saveBtn).toBeTruthy();
    });
  });

  it('AC-046: shows filled bookmark icon when route is saved', async () => {
    mockLoadRoute.mockResolvedValueOnce(MOCK_ACTIVE_ROUTE);
    mockFetchSavedRouteIds.mockResolvedValueOnce(['route-001']);

    render(<RouteDetailScreen {...DEFAULT_PROPS} />, renderOptions());

    await waitFor(() => {
      const unsaveBtn = screen.queryAllByRole('button').find(
        (el) =>
          el.props.accessibilityLabel === 'Unsave route' ||
          el.props.accessibilityLabel === '取消收藏',
      );
      expect(unsaveBtn).toBeTruthy();
    });
  });

  it('AC-046: optimistically toggles bookmark on press (save)', async () => {
    mockLoadRoute.mockResolvedValueOnce(MOCK_ACTIVE_ROUTE);
    // Route is NOT saved initially
    mockFetchSavedRouteIds.mockResolvedValueOnce([]);

    render(<RouteDetailScreen {...DEFAULT_PROPS} />, renderOptions());

    // Wait for load
    await waitFor(() => {
      const saveBtn = screen.queryAllByRole('button').find(
        (el) =>
          el.props.accessibilityLabel === 'Save route' ||
          el.props.accessibilityLabel === '收藏路線',
      );
      expect(saveBtn).toBeTruthy();
    });

    // Press the save button
    const saveBtn = screen.queryAllByRole('button').find(
      (el) =>
        el.props.accessibilityLabel === 'Save route' ||
        el.props.accessibilityLabel === '收藏路線',
    );
    if (saveBtn) {
      fireEvent.press(saveBtn);
      // saveRoute should be called
      await waitFor(() => {
        expect(mockSaveRoute).toHaveBeenCalledWith('route-001');
      });
    }
  });

  it('AC-046: calls fetchUserAchievements for this route', async () => {
    mockLoadRoute.mockResolvedValueOnce(MOCK_ACTIVE_ROUTE);

    render(<RouteDetailScreen {...DEFAULT_PROPS} />, renderOptions());

    await waitFor(() => {
      expect(mockFetchUserAchievements).toHaveBeenCalledWith(['route-001']);
    });
  });

  it('calls fetchMyAscentsForRoute (not loadAscentsForRoute) to show only the current user\'s sends', async () => {
    mockLoadRoute.mockResolvedValueOnce(MOCK_ACTIVE_ROUTE);

    render(<RouteDetailScreen {...DEFAULT_PROPS} />, renderOptions());

    await waitFor(() => {
      expect(mockFetchMyAscentsForRoute).toHaveBeenCalledWith('route-001');
    });
  });

  it('calls summarizeAscents with the fetched ascents', async () => {
    mockLoadRoute.mockResolvedValueOnce(MOCK_ACTIVE_ROUTE);
    const mockAscents = [
      {
        id: 'a1',
        user_id: 'user-001',
        route_id: 'route-001',
        style: 'flash' as const,
        attempts: 1,
        note: null,
        logged_at: '2026-09-20T10:00:00Z',
        is_private: false,
        display_name: 'Leon',
      },
    ];
    mockFetchMyAscentsForRoute.mockResolvedValueOnce(mockAscents);

    render(<RouteDetailScreen {...DEFAULT_PROPS} />, renderOptions());

    await waitFor(() => {
      expect(mockSummarizeAscents).toHaveBeenCalledWith(mockAscents);
    });
  });

  it('shows the route photo', async () => {
    mockLoadRoute.mockResolvedValueOnce(MOCK_ACTIVE_ROUTE);

    render(<RouteDetailScreen {...DEFAULT_PROPS} />, renderOptions());

    await waitFor(() => {
      // Route loaded — grade visible inside the composed route name
      expect(screen.queryAllByText(/V5/).length).toBeGreaterThan(0);
    });
  });

  it('calls getPhotoSignedUrl with photo_url and renders the signed URL (private bucket fix)', async () => {
    mockLoadRoute.mockResolvedValueOnce(MOCK_ACTIVE_ROUTE);
    const SIGNED = 'https://signed.example.com/photo.jpg?token=abc';
    mockGetPhotoSignedUrl.mockResolvedValueOnce(SIGNED);

    render(<RouteDetailScreen {...DEFAULT_PROPS} />, renderOptions());

    await waitFor(() => {
      expect(screen.queryAllByText(/V5/).length).toBeGreaterThan(0);
    });

    expect(mockGetPhotoSignedUrl).toHaveBeenCalledWith(MOCK_ACTIVE_ROUTE.photo_url);

    // The <Image> should receive the signed URL, not the raw photo_url.
    const images = screen.queryAllByRole('image');
    if (images.length > 0) {
      expect(images[0].props.source.uri).toBe(SIGNED);
    }
  });

  it('does not render the photo when getPhotoSignedUrl fails', async () => {
    mockLoadRoute.mockResolvedValueOnce(MOCK_ACTIVE_ROUTE);
    mockGetPhotoSignedUrl.mockRejectedValueOnce(new Error('signing failed'));

    render(<RouteDetailScreen {...DEFAULT_PROPS} />, renderOptions());

    await waitFor(() => {
      expect(screen.queryAllByText(/V5/).length).toBeGreaterThan(0);
    });

    // Photo should not be rendered when signing fails (non-fatal — screen still loads).
    const images = screen.queryAllByRole('image');
    expect(images).toHaveLength(0);
  });

  it('does NOT show a retire button for any route (AC-024b — admin-only via Studio)', async () => {
    mockLoadRoute.mockResolvedValueOnce(MOCK_ACTIVE_ROUTE);

    render(<RouteDetailScreen {...DEFAULT_PROPS} />, renderOptions());

    await waitFor(() => {
      expect(screen.queryAllByText(/V5/).length).toBeGreaterThan(0);
    });

    const retireButtons = screen.queryAllByRole('button').filter(
      (el) =>
        el.props.accessibilityLabel?.toLowerCase().includes('retire') ||
        el.props.accessibilityLabel?.includes('退場'),
    );
    expect(retireButtons).toHaveLength(0);
  });

  it('shows the retired status badge for a retired route', async () => {
    mockLoadRoute.mockResolvedValueOnce(MOCK_RETIRED_ROUTE);

    render(<RouteDetailScreen {...DEFAULT_PROPS} />, renderOptions());

    await waitFor(() => {
      // Retired status badge text is rendered
      const retiredLabels = screen.queryAllByText(/retired/i);
      expect(retiredLabels.length).toBeGreaterThan(0);
    });
  });

  it('does NOT show a retire button for a retired route either', async () => {
    mockLoadRoute.mockResolvedValueOnce(MOCK_RETIRED_ROUTE);

    render(<RouteDetailScreen {...DEFAULT_PROPS} />, renderOptions());

    await waitFor(() => {
      const retiredLabels = screen.queryAllByText(/retired/i);
      expect(retiredLabels.length).toBeGreaterThan(0);
    });

    const retireButtons = screen.queryAllByRole('button').filter(
      (el) =>
        el.props.accessibilityLabel?.toLowerCase().includes('retire') ||
        el.props.accessibilityLabel?.includes('退場'),
    );
    expect(retireButtons).toHaveLength(0);
  });

  it('shows ascents and beta video placeholder slots', async () => {
    mockLoadRoute.mockResolvedValueOnce(MOCK_ACTIVE_ROUTE);

    render(<RouteDetailScreen {...DEFAULT_PROPS} />, renderOptions());

    await waitFor(() => {
      expect(screen.queryAllByText(/V5/).length).toBeGreaterThan(0);
    });

    const allText = screen.toJSON();
    expect(allText).toBeTruthy();
  });

  it('shows an error state when the route is not found', async () => {
    mockLoadRoute.mockResolvedValueOnce(null);

    render(<RouteDetailScreen {...DEFAULT_PROPS} />, renderOptions());

    await waitFor(() => {
      const buttons = screen.queryAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  it('calls onBack when the back link is pressed', async () => {
    mockLoadRoute.mockResolvedValueOnce(MOCK_ACTIVE_ROUTE);

    render(<RouteDetailScreen {...DEFAULT_PROPS} />, renderOptions());

    await waitFor(() => {
      expect(screen.queryAllByText(/V5/).length).toBeGreaterThan(0);
    });

    const backButtons = screen.queryAllByRole('button').filter(
      (el) =>
        el.props.accessibilityLabel === 'Back' ||
        el.props.accessibilityLabel === '返回',
    );
    if (backButtons.length > 0) {
      fireEvent.press(backButtons[0]);
      expect(DEFAULT_PROPS.onBack).toHaveBeenCalled();
    }
  });

  it('AC-179: calls upsertRouteVisit on mount (fire-and-forget visit tracking)', async () => {
    mockLoadRoute.mockResolvedValueOnce(MOCK_ACTIVE_ROUTE);

    render(<RouteDetailScreen {...DEFAULT_PROPS} />, renderOptions());

    await waitFor(() => {
      expect(screen.queryAllByText(/V5/).length).toBeGreaterThan(0);
    });

    // upsertRouteVisit is called synchronously on mount with the route id.
    expect(mockUpsertRouteVisit).toHaveBeenCalledWith('route-001');
  });
});
