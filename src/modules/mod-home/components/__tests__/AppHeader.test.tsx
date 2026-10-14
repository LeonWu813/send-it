/**
 * Tests for AppHeader (AC-184).
 *
 * Verifies:
 *   - Bell and settings icons are rendered.
 *   - Unread badge is hidden when unreadCount is 0.
 *   - Unread badge shows the count when unreadCount > 0.
 *   - Unread badge shows "99+" when unreadCount > 99.
 *   - Tapping the bell calls onNavigateToNotifications.
 *   - Tapping the settings icon calls onNavigateToSettings.
 *   - App name "Send It" is rendered in the header.
 */

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Mock UnreadCountProvider so we can control unreadCount in tests.
jest.mock('../../../mod-notifications/UnreadCountProvider', () => ({
  useUnreadCount: jest.fn(),
}));

// ── Imports ───────────────────────────────────────────────────────────────────
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

import AppHeader from '../AppHeader';
import * as UnreadCountProviderModule from '../../../mod-notifications/UnreadCountProvider';
import { TestProviders } from '../../test-utils';

// ── Typed helpers ─────────────────────────────────────────────────────────────
const mockUseUnreadCount = UnreadCountProviderModule.useUnreadCount as jest.MockedFunction<
  typeof UnreadCountProviderModule.useUnreadCount
>;

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AppHeader (AC-184)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseUnreadCount.mockReturnValue(0);
  });

  it('renders the app name', () => {
    render(
      <AppHeader
        onNavigateToNotifications={jest.fn()}
        onNavigateToSettings={jest.fn()}
        topInset={0}
      />,
      { wrapper: TestProviders },
    );
    expect(screen.getByText('Send It')).toBeTruthy();
  });

  it('renders the bell icon button', () => {
    render(
      <AppHeader
        onNavigateToNotifications={jest.fn()}
        onNavigateToSettings={jest.fn()}
        topInset={0}
      />,
      { wrapper: TestProviders },
    );
    expect(screen.getByLabelText('Notifications')).toBeTruthy();
  });

  it('renders the settings icon button', () => {
    render(
      <AppHeader
        onNavigateToNotifications={jest.fn()}
        onNavigateToSettings={jest.fn()}
        topInset={0}
      />,
      { wrapper: TestProviders },
    );
    expect(screen.getByLabelText('Settings')).toBeTruthy();
  });

  it('does not render a badge when unreadCount is 0', () => {
    mockUseUnreadCount.mockReturnValue(0);
    render(
      <AppHeader
        onNavigateToNotifications={jest.fn()}
        onNavigateToSettings={jest.fn()}
        topInset={0}
      />,
      { wrapper: TestProviders },
    );
    // Badge text should not be present when count is 0.
    expect(screen.queryByText('0')).toBeNull();
  });

  it('renders the unread badge with count when unreadCount > 0 (AC-173)', () => {
    mockUseUnreadCount.mockReturnValue(5);
    render(
      <AppHeader
        onNavigateToNotifications={jest.fn()}
        onNavigateToSettings={jest.fn()}
        topInset={0}
      />,
      { wrapper: TestProviders },
    );
    expect(screen.getByText('5')).toBeTruthy();
  });

  it('renders "99+" badge when unreadCount exceeds 99 (AC-173)', () => {
    mockUseUnreadCount.mockReturnValue(150);
    render(
      <AppHeader
        onNavigateToNotifications={jest.fn()}
        onNavigateToSettings={jest.fn()}
        topInset={0}
      />,
      { wrapper: TestProviders },
    );
    expect(screen.getByText('99+')).toBeTruthy();
  });

  it('shows unread a11y label when count > 0 (AC-173)', () => {
    mockUseUnreadCount.mockReturnValue(3);
    render(
      <AppHeader
        onNavigateToNotifications={jest.fn()}
        onNavigateToSettings={jest.fn()}
        topInset={0}
      />,
      { wrapper: TestProviders },
    );
    expect(screen.getByLabelText('Notifications, 3 unread')).toBeTruthy();
  });

  it('calls onNavigateToNotifications when bell is pressed (AC-184)', () => {
    const mockNav = jest.fn();
    render(
      <AppHeader
        onNavigateToNotifications={mockNav}
        onNavigateToSettings={jest.fn()}
        topInset={0}
      />,
      { wrapper: TestProviders },
    );
    fireEvent.press(screen.getByLabelText('Notifications'));
    expect(mockNav).toHaveBeenCalledTimes(1);
  });

  it('calls onNavigateToSettings when settings icon is pressed (AC-184)', () => {
    const mockSettings = jest.fn();
    render(
      <AppHeader
        onNavigateToNotifications={jest.fn()}
        onNavigateToSettings={mockSettings}
        topInset={0}
      />,
      { wrapper: TestProviders },
    );
    fireEvent.press(screen.getByLabelText('Settings'));
    expect(mockSettings).toHaveBeenCalledTimes(1);
  });
});
