/**
 * Tests for NotificationPreferenceScreen (MOD-007).
 *
 * AC-057: toggle for beta_video_like push notifications.
 *   - Toggle ON  → push enabled.
 *   - Toggle OFF → no push, but in-app inbox still shows likes.
 *
 * notification-service is mocked; no real network activity.
 */

jest.mock('../../../lib/supabase', () => ({
  supabase: { from: jest.fn(), rpc: jest.fn(), auth: { getSession: jest.fn() } },
}));

jest.mock('../notification-service', () => ({
  fetchNotificationPreference: jest.fn(),
  updateNotificationPreference: jest.fn(),
}));

import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import type { Session } from '@supabase/supabase-js';
import React from 'react';

import {
  fetchNotificationPreference,
  updateNotificationPreference,
} from '../notification-service';
import NotificationPreferenceScreen from '../screens/NotificationPreferenceScreen';
import { renderOptions } from '../test-utils';
import type { NotificationPreference } from '../types';

const mockFetchNotificationPreference = fetchNotificationPreference as jest.MockedFunction<
  typeof fetchNotificationPreference
>;
const mockUpdateNotificationPreference = updateNotificationPreference as jest.MockedFunction<
  typeof updateNotificationPreference
>;

const MOCK_SESSION = {
  user: { id: 'user-001' },
} as unknown as Session;

const MOCK_PREFERENCE_ON: NotificationPreference = {
  user_id: 'user-001',
  beta_video_like: true,
  updated_at: '2026-09-24T10:00:00Z',
};

const MOCK_PREFERENCE_OFF: NotificationPreference = {
  user_id: 'user-001',
  beta_video_like: false,
  updated_at: '2026-09-24T11:00:00Z',
};

describe('NotificationPreferenceScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the section header', async () => {
    mockFetchNotificationPreference.mockResolvedValueOnce(MOCK_PREFERENCE_ON);

    render(
      <NotificationPreferenceScreen session={MOCK_SESSION} />,
      renderOptions(),
    );

    await waitFor(() => {
      expect(screen.getByText('Push Notifications')).toBeTruthy();
    });
  });

  it('renders the beta video like toggle label', async () => {
    mockFetchNotificationPreference.mockResolvedValueOnce(MOCK_PREFERENCE_ON);

    render(
      <NotificationPreferenceScreen session={MOCK_SESSION} />,
      renderOptions(),
    );

    await waitFor(() => {
      expect(screen.getByText('Beta Video Likes')).toBeTruthy();
    });
  });

  it('shows toggle as on when preference is true', async () => {
    mockFetchNotificationPreference.mockResolvedValueOnce(MOCK_PREFERENCE_ON);

    render(
      <NotificationPreferenceScreen session={MOCK_SESSION} />,
      renderOptions(),
    );

    await waitFor(() => {
      const toggle = screen.getByRole('switch');
      expect(toggle.props.value).toBe(true);
    });
  });

  it('shows toggle as off when preference is false', async () => {
    mockFetchNotificationPreference.mockResolvedValueOnce(MOCK_PREFERENCE_OFF);

    render(
      <NotificationPreferenceScreen session={MOCK_SESSION} />,
      renderOptions(),
    );

    await waitFor(() => {
      const toggle = screen.getByRole('switch');
      expect(toggle.props.value).toBe(false);
    });
  });

  it('defaults toggle to true when no preference row exists', async () => {
    mockFetchNotificationPreference.mockResolvedValueOnce(null);

    render(
      <NotificationPreferenceScreen session={MOCK_SESSION} />,
      renderOptions(),
    );

    await waitFor(() => {
      const toggle = screen.getByRole('switch');
      expect(toggle.props.value).toBe(true);
    });
  });

  it('calls updateNotificationPreference when toggle is changed', async () => {
    mockFetchNotificationPreference.mockResolvedValueOnce(MOCK_PREFERENCE_ON);
    mockUpdateNotificationPreference.mockResolvedValueOnce(undefined);

    render(
      <NotificationPreferenceScreen session={MOCK_SESSION} />,
      renderOptions(),
    );

    await waitFor(() => {
      expect(screen.getByRole('switch')).toBeTruthy();
    });

    fireEvent(screen.getByRole('switch'), 'valueChange', false);

    await waitFor(() => {
      expect(mockUpdateNotificationPreference).toHaveBeenCalledWith(false);
    });
  });

  it('reverts toggle on update failure', async () => {
    mockFetchNotificationPreference.mockResolvedValueOnce(MOCK_PREFERENCE_ON);
    mockUpdateNotificationPreference.mockRejectedValueOnce(
      new Error('Failed to update notification preferences. Please try again.'),
    );

    render(
      <NotificationPreferenceScreen session={MOCK_SESSION} />,
      renderOptions(),
    );

    await waitFor(() => {
      expect(screen.getByRole('switch')).toBeTruthy();
    });

    fireEvent(screen.getByRole('switch'), 'valueChange', false);

    await waitFor(() => {
      // Error should be shown
      expect(
        screen.getByText('Failed to update notification preferences. Please try again.'),
      ).toBeTruthy();
      // Toggle should revert to original value
      expect(screen.getByRole('switch').props.value).toBe(true);
    });
  });

  it('shows error when fetchNotificationPreference fails', async () => {
    mockFetchNotificationPreference.mockRejectedValueOnce(
      new Error('Failed to load notification preferences. Please try again.'),
    );

    render(
      <NotificationPreferenceScreen session={MOCK_SESSION} />,
      renderOptions(),
    );

    await waitFor(() => {
      expect(
        screen.getByText('Failed to load notification preferences. Please try again.'),
      ).toBeTruthy();
    });
  });
});
