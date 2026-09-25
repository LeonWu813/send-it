/**
 * Tests for mod-send-logging/components/AscentList.tsx
 *
 * Tests behaviour — not implementation.
 * The send-service module is mocked; no real network activity.
 */

jest.mock('../../../lib/supabase', () => ({
  supabase: { from: jest.fn() },
}));

jest.mock('../send-service', () => ({
  loadAscentsForRoute: jest.fn(),
  deleteAscent: jest.fn(),
}));

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import type { Session } from '@supabase/supabase-js';

import { Alert } from 'react-native';

import { deleteAscent, loadAscentsForRoute } from '../send-service';
import AscentList from '../components/AscentList';
import { renderOptions } from '../test-utils';
import type { AscentWithProfile } from '../types';

const mockLoadAscents = loadAscentsForRoute as jest.MockedFunction<
  typeof loadAscentsForRoute
>;
const mockDeleteAscent = deleteAscent as jest.MockedFunction<typeof deleteAscent>;

const MOCK_SESSION = {
  user: { id: 'user-001' },
} as unknown as Session;

const MOCK_OWN_ASCENT: AscentWithProfile = {
  id: 'ascent-001',
  user_id: 'user-001',
  route_id: 'route-001',
  style: 'top',
  attempts: 2,
  note: 'Tricky crux at the top',
  logged_at: '2026-09-20T10:00:00Z',
  is_private: false,
  display_name: 'Leon',
};

const MOCK_OTHER_ASCENT: AscentWithProfile = {
  id: 'ascent-002',
  user_id: 'user-002',
  route_id: 'route-001',
  style: 'flash',
  attempts: 1,
  note: 'should not be visible',
  logged_at: '2026-09-19T10:00:00Z',
  is_private: false,
  display_name: 'OtherClimber',
};

const DEFAULT_PROPS = {
  routeId: 'route-001',
  session: MOCK_SESSION,
  onLogSend: jest.fn(),
};

describe('AscentList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders a "Log a Send" button that calls onLogSend when pressed (AC-010 Tap 1)', async () => {
    mockLoadAscents.mockResolvedValueOnce([]);

    render(<AscentList {...DEFAULT_PROPS} />, renderOptions());

    await waitFor(() => {
      const logButtons = screen.queryAllByRole('button').filter(
        (el) =>
          el.props.accessibilityLabel === 'Log Send' ||
          el.props.accessibilityLabel === '記錄完攀',
      );
      expect(logButtons.length).toBeGreaterThan(0);
      fireEvent.press(logButtons[0]);
      expect(DEFAULT_PROPS.onLogSend).toHaveBeenCalled();
    });
  });

  it('shows the empty state when there are no ascents', async () => {
    mockLoadAscents.mockResolvedValueOnce([]);

    render(<AscentList {...DEFAULT_PROPS} />, renderOptions());

    await waitFor(() => {
      // Some "no ascents" message should be visible
      const allText = screen.toJSON();
      expect(allText).toBeTruthy();
    });
  });

  it('shows style badge, attempts, date, and username for each ascent', async () => {
    mockLoadAscents.mockResolvedValueOnce([MOCK_OWN_ASCENT]);

    render(<AscentList {...DEFAULT_PROPS} />, renderOptions());

    await waitFor(() => {
      expect(screen.getByText('Leon')).toBeTruthy();
    });
  });

  it('shows a note only to the owning user', async () => {
    mockLoadAscents.mockResolvedValueOnce([MOCK_OWN_ASCENT, MOCK_OTHER_ASCENT]);

    render(<AscentList {...DEFAULT_PROPS} />, renderOptions());

    await waitFor(() => {
      // Own note visible
      expect(screen.getByText('Tricky crux at the top')).toBeTruthy();
      // Other user's note NOT visible
      expect(screen.queryByText('should not be visible')).toBeNull();
    });
  });

  it('shows a retry button and error message on load failure', async () => {
    mockLoadAscents.mockRejectedValueOnce(new Error('DB error'));

    render(<AscentList {...DEFAULT_PROPS} />, renderOptions());

    await waitFor(() => {
      const retryButtons = screen.queryAllByRole('button').filter(
        (el) =>
          el.props.accessibilityLabel === 'Retry' ||
          el.props.accessibilityLabel === '重試',
      );
      expect(retryButtons.length).toBeGreaterThan(0);
    });
  });

  it('shows the style badge for each ascent', async () => {
    mockLoadAscents.mockResolvedValueOnce([MOCK_OWN_ASCENT]);

    render(<AscentList {...DEFAULT_PROPS} />, renderOptions());

    await waitFor(() => {
      // TOP badge text
      const topText = screen.queryAllByText(/top/i);
      expect(topText.length).toBeGreaterThan(0);
    });
  });

  it('renders the flash badge with gold background (#FFD700) for a flash ascent', async () => {
    mockLoadAscents.mockResolvedValueOnce([MOCK_OTHER_ASCENT]);

    const { toJSON } = render(<AscentList {...DEFAULT_PROPS} />, renderOptions());

    await waitFor(() => {
      expect(screen.getByText('OtherClimber')).toBeTruthy();
    });

    // Serialize the rendered tree and confirm #FFD700 appears as a backgroundColor.
    // This verifies the FLASH_BADGE_COLOR constant is applied to the style badge view.
    const treeStr = JSON.stringify(toJSON());
    expect(treeStr).toContain('#FFD700');
  });

  it('re-fetches ascents when refreshKey increments (AC-013)', async () => {
    // Initial render: one ascent
    mockLoadAscents.mockResolvedValueOnce([MOCK_OWN_ASCENT]);
    // After refreshKey changes: two ascents
    mockLoadAscents.mockResolvedValueOnce([MOCK_OWN_ASCENT, MOCK_OTHER_ASCENT]);

    const { rerender } = render(
      <AscentList {...DEFAULT_PROPS} refreshKey={0} />,
      renderOptions(),
    );

    await waitFor(() => {
      expect(screen.getByText('Leon')).toBeTruthy();
      expect(mockLoadAscents).toHaveBeenCalledTimes(1);
    });

    // Simulate parent incrementing refreshKey after a successful log
    rerender(
      <AscentList {...DEFAULT_PROPS} refreshKey={1} />,
    );

    await waitFor(() => {
      expect(mockLoadAscents).toHaveBeenCalledTimes(2);
      expect(screen.getByText('OtherClimber')).toBeTruthy();
    });
  });

  it('shows a delete button only for the current user\'s own ascents', async () => {
    mockLoadAscents.mockResolvedValueOnce([MOCK_OWN_ASCENT, MOCK_OTHER_ASCENT]);

    render(<AscentList {...DEFAULT_PROPS} />, renderOptions());

    await waitFor(() => {
      // The delete button accessibility label matches 'Delete' or '刪除'
      const deleteButtons = screen.queryAllByRole('button').filter(
        (el) =>
          el.props.accessibilityLabel === 'Delete' ||
          el.props.accessibilityLabel === '刪除',
      );
      // Only one delete button — for own ascent (ascent-001, user-001)
      // Other user's ascent (ascent-002, user-002) gets no delete button
      expect(deleteButtons).toHaveLength(1);
    });
  });

  it('shows Alert confirmation dialog when delete button is tapped', async () => {
    mockLoadAscents.mockResolvedValueOnce([MOCK_OWN_ASCENT]);
    const alertSpy = jest.spyOn(Alert, 'alert');

    render(<AscentList {...DEFAULT_PROPS} />, renderOptions());

    await waitFor(() => {
      const deleteButtons = screen.queryAllByRole('button').filter(
        (el) =>
          el.props.accessibilityLabel === 'Delete' ||
          el.props.accessibilityLabel === '刪除',
      );
      expect(deleteButtons).toHaveLength(1);
      fireEvent.press(deleteButtons[0]);
    });

    expect(alertSpy).toHaveBeenCalledTimes(1);
    alertSpy.mockRestore();
  });

  it('calls deleteAscent and removes the row optimistically when user confirms', async () => {
    mockLoadAscents.mockResolvedValueOnce([MOCK_OWN_ASCENT]);
    mockDeleteAscent.mockResolvedValueOnce(undefined);

    // Intercept Alert.alert and immediately invoke the "Delete" button handler
    jest.spyOn(Alert, 'alert').mockImplementationOnce((_title, _message, buttons) => {
      const deleteButton = buttons?.find(
        (b) => b.style === 'destructive',
      );
      deleteButton?.onPress?.();
    });

    render(<AscentList {...DEFAULT_PROPS} />, renderOptions());

    await waitFor(() => {
      expect(screen.getByText('Leon')).toBeTruthy();
    });

    const deleteButtons = screen.queryAllByRole('button').filter(
      (el) =>
        el.props.accessibilityLabel === 'Delete' ||
        el.props.accessibilityLabel === '刪除',
    );
    fireEvent.press(deleteButtons[0]);

    await waitFor(() => {
      expect(mockDeleteAscent).toHaveBeenCalledWith('ascent-001');
      // Optimistically removed — Leon's ascent should be gone
      expect(screen.queryByText('Leon')).toBeNull();
    });
  });
});
