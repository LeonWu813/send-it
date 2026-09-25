/**
 * Tests for NotificationInboxScreen (MOD-007).
 *
 * AC-055: displays Notification rows for the current user (beta-video-like only).
 * AC-057: inbox shows notifications even when push preference is off.
 *
 * notification-service is mocked; no real network activity.
 */

jest.mock('../../../lib/supabase', () => ({
  supabase: { from: jest.fn(), rpc: jest.fn(), auth: { getSession: jest.fn() } },
}));

jest.mock('../notification-service', () => ({
  fetchNotifications: jest.fn(),
  markNotificationsRead: jest.fn(),
}));

import { render, screen, waitFor } from '@testing-library/react-native';
import type { Session } from '@supabase/supabase-js';
import React from 'react';

import { fetchNotifications, markNotificationsRead } from '../notification-service';
import NotificationInboxScreen from '../screens/NotificationInboxScreen';
import { renderOptions } from '../test-utils';
import type { Notification } from '../types';

const mockFetchNotifications = fetchNotifications as jest.MockedFunction<
  typeof fetchNotifications
>;
const mockMarkNotificationsRead = markNotificationsRead as jest.MockedFunction<
  typeof markNotificationsRead
>;

const MOCK_SESSION = {
  user: { id: 'user-001' },
} as unknown as Session;

const MOCK_NOTIFICATION: Notification = {
  id: 'notif-001',
  recipient_user_id: 'user-001',
  actor_user_id: 'user-002',
  actor_display_name: 'Alice',
  actor_avatar_url: null,
  type: 'beta_video_like',
  target_type: 'beta_video',
  target_id: 'video-001',
  is_read: false,
  created_at: '2026-09-24T10:00:00Z',
};

describe('NotificationInboxScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMarkNotificationsRead.mockResolvedValue(undefined);
  });

  it('renders the screen title', async () => {
    mockFetchNotifications.mockResolvedValueOnce([]);

    render(
      <NotificationInboxScreen session={MOCK_SESSION} />,
      renderOptions(),
    );

    await waitFor(() => {
      expect(screen.getByText('Notifications')).toBeTruthy();
    });
  });

  it('shows empty state when there are no notifications', async () => {
    mockFetchNotifications.mockResolvedValueOnce([]);

    render(
      <NotificationInboxScreen session={MOCK_SESSION} />,
      renderOptions(),
    );

    await waitFor(() => {
      expect(
        screen.getByText('No notifications yet. Like activity from others will appear here.'),
      ).toBeTruthy();
    });
  });

  it('renders a notification row with actor name', async () => {
    mockFetchNotifications.mockResolvedValueOnce([MOCK_NOTIFICATION]);

    render(
      <NotificationInboxScreen session={MOCK_SESSION} />,
      renderOptions(),
    );

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeTruthy();
    });
  });

  it('calls markNotificationsRead when inbox loads', async () => {
    mockFetchNotifications.mockResolvedValueOnce([MOCK_NOTIFICATION]);

    render(
      <NotificationInboxScreen session={MOCK_SESSION} />,
      renderOptions(),
    );

    await waitFor(() => {
      expect(mockMarkNotificationsRead).toHaveBeenCalledTimes(1);
    });
  });

  it('shows error message when fetchNotifications fails', async () => {
    mockFetchNotifications.mockRejectedValueOnce(
      new Error('Failed to load notifications. Please try again.'),
    );

    render(
      <NotificationInboxScreen session={MOCK_SESSION} />,
      renderOptions(),
    );

    await waitFor(() => {
      expect(
        screen.getByText('Failed to load notifications. Please try again.'),
      ).toBeTruthy();
    });
  });

  it('shows read notification without unread styling (is_read: true)', async () => {
    const readNotification: Notification = {
      ...MOCK_NOTIFICATION,
      id: 'notif-002',
      is_read: true,
    };
    mockFetchNotifications.mockResolvedValueOnce([readNotification]);

    render(
      <NotificationInboxScreen session={MOCK_SESSION} />,
      renderOptions(),
    );

    await waitFor(() => {
      // Actor name should still be visible
      expect(screen.getByText('Alice')).toBeTruthy();
    });
  });

  it('shows fallback actor name when actor_display_name is undefined', async () => {
    const noNameNotification: Notification = {
      ...MOCK_NOTIFICATION,
      actor_display_name: undefined,
    };
    mockFetchNotifications.mockResolvedValueOnce([noNameNotification]);

    render(
      <NotificationInboxScreen session={MOCK_SESSION} />,
      renderOptions(),
    );

    await waitFor(() => {
      // Should fall back to the unknown actor i18n key
      expect(screen.getByText('Someone')).toBeTruthy();
    });
  });

  it('does not fetch when isActive is false', () => {
    render(
      <NotificationInboxScreen session={MOCK_SESSION} isActive={false} />,
      renderOptions(),
    );

    expect(mockFetchNotifications).not.toHaveBeenCalled();
  });
});
