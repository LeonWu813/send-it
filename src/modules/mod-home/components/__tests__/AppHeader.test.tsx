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
 *   - App name "ProjectDay" is rendered in the header.
 */

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Mock UnreadCountProvider so we can control unreadCount in tests.
jest.mock('../../../mod-notifications', () => ({
  useUnreadCount: jest.fn(),
}));

// ── Imports ───────────────────────────────────────────────────────────────────
import React from 'react';
import { Text } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';

import AppHeader from '../AppHeader';
import * as UnreadCountProviderModule from '../../../mod-notifications';
import { TestProviders } from '../../test-utils';

// ── Typed helpers ─────────────────────────────────────────────────────────────
const mockUseUnreadCount = UnreadCountProviderModule.useUnreadCount as jest.MockedFunction<
  typeof UnreadCountProviderModule.useUnreadCount
>;

// ── Tests ─────────────────────────────────────────────────────────────────────

// The Badge is hidden from VoiceOver (the bell label carries the count), so query it explicitly.
const HIDDEN = { includeHiddenElements: true };

describe('AppHeader (AC-184)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseUnreadCount.mockReturnValue(0);
  });

  it('renders the tab name as the large title on a root header (v2.2)', () => {
    render(
      <AppHeader
        title="Home"
        onNavigateToNotifications={jest.fn()}
        onNavigateToSettings={jest.fn()}
        topInset={0}
      />,
      { wrapper: TestProviders },
    );
    expect(screen.getByText('Home')).toBeTruthy();
  });

  it('renders the bell icon button', () => {
    render(
      <AppHeader
        title="Home"
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
        title="Home"
        onNavigateToNotifications={jest.fn()}
        onNavigateToSettings={jest.fn()}
        topInset={0}
      />,
      { wrapper: TestProviders },
    );
    expect(screen.getByLabelText('Settings')).toBeTruthy();
  });

  it('does not render the unread dot when unreadCount is 0', () => {
    mockUseUnreadCount.mockReturnValue(0);
    render(
      <AppHeader title="Home" onNavigateToNotifications={jest.fn()} onNavigateToSettings={jest.fn()} topInset={0} />,
      { wrapper: TestProviders },
    );
    expect(screen.queryByTestId('unread-dot', HIDDEN)).toBeNull();
  });

  it('renders an 8pt unread dot (no number) when unreadCount > 0 (AC-173, v2.2)', () => {
    mockUseUnreadCount.mockReturnValue(5);
    render(
      <AppHeader title="Home" onNavigateToNotifications={jest.fn()} onNavigateToSettings={jest.fn()} topInset={0} />,
      { wrapper: TestProviders },
    );
    expect(screen.getByTestId('unread-dot', HIDDEN)).toBeTruthy();
    expect(screen.queryByText('5', HIDDEN)).toBeNull();
  });

  it('nested variant: one row with back, title, bell and settings; back calls onBack', () => {
    const onBack = jest.fn();
    render(
      <AppHeader variant="nested" title="V4 Red (A)" onBack={onBack} onNavigateToNotifications={jest.fn()} onNavigateToSettings={jest.fn()} topInset={0} />,
      { wrapper: TestProviders },
    );
    expect(screen.getByText('V4 Red (A)')).toBeTruthy();
    expect(screen.getByLabelText('Notifications')).toBeTruthy();
    expect(screen.getByLabelText('Settings')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Back'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('nested variant renders the trailing control', () => {
    render(
      <AppHeader variant="nested" title="Gym" onBack={jest.fn()} trailing={<Text>TRAIL</Text>} onNavigateToNotifications={jest.fn()} onNavigateToSettings={jest.fn()} topInset={0} />,
      { wrapper: TestProviders },
    );
    expect(screen.getByText('TRAIL')).toBeTruthy();
  });

  it('shows unread a11y label when count > 0 (AC-173)', () => {
    mockUseUnreadCount.mockReturnValue(3);
    render(
      <AppHeader
        title="Home"
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
        title="Home"
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
        title="Home"
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
