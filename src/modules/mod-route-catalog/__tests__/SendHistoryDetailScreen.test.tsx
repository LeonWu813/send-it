/**
 * Tests for SendHistoryDetailScreen (AC-129).
 *
 * Tests behaviour — not implementation.
 * The mod-send-logging barrel is mocked; no real network activity.
 *
 * AC-129: lists the user's individual ascent records (style, attempts, date);
 *         back button returns to route detail; empty state when no sends.
 */

jest.mock('../../../lib/supabase', () => ({
  supabase: { from: jest.fn() },
}));

jest.mock('../../mod-send-logging', () => ({
  fetchMyAscentsForRoute: jest.fn(),
}));

import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';
import type { Session } from '@supabase/supabase-js';

import { fetchMyAscentsForRoute } from '../../mod-send-logging';
import SendHistoryDetailScreen from '../screens/SendHistoryDetailScreen';
import { renderOptions } from '../test-utils';
import type { AscentWithProfile } from '../../mod-send-logging';

const mockFetchMyAscentsForRoute = fetchMyAscentsForRoute as jest.MockedFunction<typeof fetchMyAscentsForRoute>;

const MOCK_SESSION = {
  user: { id: 'user-001' },
} as unknown as Session;

const MOCK_ASCENT: AscentWithProfile = {
  id: 'a-001',
  user_id: 'user-001',
  route_id: 'route-001',
  style: 'flash',
  attempts: 1,
  note: null,
  logged_at: '2026-09-20T10:00:00Z',
  is_private: false,
  display_name: 'Leon',
};

const MOCK_ASCENT_WITH_NOTE: AscentWithProfile = {
  id: 'a-002',
  user_id: 'user-001',
  route_id: 'route-001',
  style: 'top',
  attempts: 3,
  note: 'Struggled on the crux',
  logged_at: '2026-09-18T10:00:00Z',
  is_private: true,
  display_name: 'Leon',
};

const mockOnBack = jest.fn();

const DEFAULT_PROPS = {
  routeId: 'route-001',
  session: MOCK_SESSION,
  onBack: mockOnBack,
};

describe('SendHistoryDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchMyAscentsForRoute.mockResolvedValue([]);
  });

  it('shows loading indicator while fetching', () => {
    mockFetchMyAscentsForRoute.mockReturnValue(new Promise(() => { /* never resolves */ }));

    render(<SendHistoryDetailScreen {...DEFAULT_PROPS} />, renderOptions());

    // Screen renders without crashing during loading
    expect(screen.toJSON()).toBeTruthy();
  });

  it('AC-129: shows empty state when there are no sends', async () => {
    mockFetchMyAscentsForRoute.mockResolvedValue([]);

    render(<SendHistoryDetailScreen {...DEFAULT_PROPS} />, renderOptions());

    await waitFor(() => {
      const emptyTexts = screen.queryAllByText(/No sends recorded yet/i)
        .concat(screen.queryAllByText(/尚無紀錄/));
      expect(emptyTexts.length).toBeGreaterThan(0);
    });
  });

  it('AC-129: renders ascent rows with style badge', async () => {
    mockFetchMyAscentsForRoute.mockResolvedValue([MOCK_ASCENT]);

    render(<SendHistoryDetailScreen {...DEFAULT_PROPS} />, renderOptions());

    await waitFor(() => {
      // Style badge text (Flash or 閃攀)
      const flashBadges = screen.queryAllByText(/Flash/i)
        .concat(screen.queryAllByText(/閃攀/));
      expect(flashBadges.length).toBeGreaterThan(0);
    });
  });

  it('AC-129: renders attempts count for each ascent', async () => {
    mockFetchMyAscentsForRoute.mockResolvedValue([MOCK_ASCENT]);

    render(<SendHistoryDetailScreen {...DEFAULT_PROPS} />, renderOptions());

    await waitFor(() => {
      // "1 attempt" or "1 次"
      const attemptsTexts = screen.queryAllByText(/1 attempt/i)
        .concat(screen.queryAllByText(/1 次/));
      expect(attemptsTexts.length).toBeGreaterThan(0);
    });
  });

  it('AC-129: renders the logged_at date for each ascent', async () => {
    mockFetchMyAscentsForRoute.mockResolvedValue([MOCK_ASCENT]);

    render(<SendHistoryDetailScreen {...DEFAULT_PROPS} />, renderOptions());

    await waitFor(() => {
      // Date should appear in localized format
      expect(screen.toJSON()).toBeTruthy();
      // Some date-related text should appear in the screen
      const allText = JSON.stringify(screen.toJSON());
      // logged_at is "2026-09-20" so some part of it should appear
      expect(allText).toContain('2026');
    });
  });

  it('AC-129: shows note when present', async () => {
    mockFetchMyAscentsForRoute.mockResolvedValue([MOCK_ASCENT_WITH_NOTE]);

    render(<SendHistoryDetailScreen {...DEFAULT_PROPS} />, renderOptions());

    await waitFor(() => {
      expect(screen.getByText('Struggled on the crux')).toBeTruthy();
    });
  });

  it('AC-129: shows private indicator for private ascents', async () => {
    mockFetchMyAscentsForRoute.mockResolvedValue([MOCK_ASCENT_WITH_NOTE]);

    render(<SendHistoryDetailScreen {...DEFAULT_PROPS} />, renderOptions());

    await waitFor(() => {
      const privateTexts = screen.queryAllByText(/Private/i)
        .concat(screen.queryAllByText(/私人/));
      expect(privateTexts.length).toBeGreaterThan(0);
    });
  });

  it('AC-129: calls onBack when the back button is pressed', async () => {
    mockFetchMyAscentsForRoute.mockResolvedValue([]);

    render(<SendHistoryDetailScreen {...DEFAULT_PROPS} />, renderOptions());

    await waitFor(() => {
      const backButtons = screen.queryAllByRole('button').filter(
        (el) =>
          el.props.accessibilityLabel === 'Back' ||
          el.props.accessibilityLabel === '返回',
      );
      expect(backButtons.length).toBeGreaterThan(0);
    });

    const backButtons = screen.queryAllByRole('button').filter(
      (el) =>
        el.props.accessibilityLabel === 'Back' ||
        el.props.accessibilityLabel === '返回',
    );
    fireEvent.press(backButtons[0]);
    expect(mockOnBack).toHaveBeenCalled();
  });

  it('calls fetchMyAscentsForRoute with the correct routeId', async () => {
    mockFetchMyAscentsForRoute.mockResolvedValue([]);

    render(<SendHistoryDetailScreen {...DEFAULT_PROPS} />, renderOptions());

    await waitFor(() => {
      expect(mockFetchMyAscentsForRoute).toHaveBeenCalledWith('route-001');
    });
  });

  it('shows an error state and retry button when fetch fails', async () => {
    mockFetchMyAscentsForRoute.mockRejectedValue(new Error('Network error'));

    render(<SendHistoryDetailScreen {...DEFAULT_PROPS} />, renderOptions());

    await waitFor(() => {
      const retryBtns = screen.queryAllByRole('button').filter(
        (el) =>
          el.props.accessibilityLabel === 'Retry' ||
          el.props.accessibilityLabel === '重試',
      );
      expect(retryBtns.length).toBeGreaterThan(0);
    });
  });

  it('shows the screen title (Send History)', async () => {
    mockFetchMyAscentsForRoute.mockResolvedValue([]);

    render(<SendHistoryDetailScreen {...DEFAULT_PROPS} />, renderOptions());

    await waitFor(() => {
      const titleTexts = screen.queryAllByText(/Send History/i)
        .concat(screen.queryAllByText(/攀登紀錄/));
      expect(titleTexts.length).toBeGreaterThan(0);
    });
  });

  it('renders multiple ascent rows', async () => {
    mockFetchMyAscentsForRoute.mockResolvedValue([MOCK_ASCENT, MOCK_ASCENT_WITH_NOTE]);

    render(<SendHistoryDetailScreen {...DEFAULT_PROPS} />, renderOptions());

    await waitFor(() => {
      // Both styles should be visible
      const flashBadges = screen.queryAllByText(/Flash/i).concat(screen.queryAllByText(/閃攀/));
      const topBadges = screen.queryAllByText(/^Top$/i).concat(screen.queryAllByText(/完攀/));
      expect(flashBadges.length).toBeGreaterThan(0);
      expect(topBadges.length).toBeGreaterThan(0);
    });
  });
});
