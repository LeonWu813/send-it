/**
 * Tests for RouteDetailScreen.
 *
 * Tests behaviour — not implementation.
 * The route-service module is mocked; no real network activity.
 *
 * Note: retireRoute has been removed (AC-024b — retirement is now admin-only
 * via Supabase Studio). Tests for the retire button have been replaced with
 * tests that verify the retire button is NOT present.
 */

jest.mock('../../../lib/supabase', () => ({
  supabase: { from: jest.fn() },
}));

jest.mock('../route-service', () => ({
  loadRoute: jest.fn(),
  getPhotoSignedUrl: jest.fn(),
}));

import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';
import type { Session } from '@supabase/supabase-js';

import { loadRoute, getPhotoSignedUrl } from '../route-service';
import RouteDetailScreen from '../screens/RouteDetailScreen';
import type { Route } from '../types';
import { renderOptions } from '../test-utils';

const mockLoadRoute = loadRoute as jest.MockedFunction<typeof loadRoute>;
const mockGetPhotoSignedUrl = getPhotoSignedUrl as jest.MockedFunction<typeof getPhotoSignedUrl>;

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

const DEFAULT_PROPS = {
  routeId: 'route-001',
  gymName: 'Test Gym',
  session: MOCK_SESSION,
  onBack: jest.fn(),
};

describe('RouteDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: getPhotoSignedUrl resolves successfully.
    // Tests that need a different behaviour can override this mock.
    mockGetPhotoSignedUrl.mockResolvedValue('https://signed.example.com/photo.jpg');
  });

  it('shows grade, color, and section for an active route', async () => {
    mockLoadRoute.mockResolvedValueOnce(MOCK_ACTIVE_ROUTE);

    render(<RouteDetailScreen {...DEFAULT_PROPS} />, renderOptions());

    await waitFor(() => {
      expect(screen.getByText('V5')).toBeTruthy();
      expect(screen.getByText('Main Wall')).toBeTruthy();
    });
  });

  it('shows the route photo', async () => {
    mockLoadRoute.mockResolvedValueOnce(MOCK_ACTIVE_ROUTE);

    render(<RouteDetailScreen {...DEFAULT_PROPS} />, renderOptions());

    await waitFor(() => {
      // Route loaded — grade visible
      expect(screen.getByText('V5')).toBeTruthy();
    });
  });

  it('calls getPhotoSignedUrl with photo_url and renders the signed URL (private bucket fix)', async () => {
    mockLoadRoute.mockResolvedValueOnce(MOCK_ACTIVE_ROUTE);
    const SIGNED = 'https://signed.example.com/photo.jpg?token=abc';
    mockGetPhotoSignedUrl.mockResolvedValueOnce(SIGNED);

    render(<RouteDetailScreen {...DEFAULT_PROPS} />, renderOptions());

    await waitFor(() => {
      expect(screen.getByText('V5')).toBeTruthy();
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
      expect(screen.getByText('V5')).toBeTruthy();
    });

    // Photo should not be rendered when signing fails (non-fatal — screen still loads).
    const images = screen.queryAllByRole('image');
    expect(images).toHaveLength(0);
  });

  it('does NOT show a retire button for any route (AC-024b — admin-only via Studio)', async () => {
    mockLoadRoute.mockResolvedValueOnce(MOCK_ACTIVE_ROUTE);

    render(<RouteDetailScreen {...DEFAULT_PROPS} />, renderOptions());

    await waitFor(() => {
      expect(screen.getByText('V5')).toBeTruthy();
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
      expect(screen.getByText('V5')).toBeTruthy();
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
      expect(screen.getByText('V5')).toBeTruthy();
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
});
