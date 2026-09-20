/**
 * Tests for mod-send-logging/screens/LogSendScreen.tsx
 *
 * Tests behaviour — not implementation.
 * The send-service module is mocked; no real network activity.
 */

jest.mock('../../../lib/supabase', () => ({
  supabase: { from: jest.fn() },
}));

jest.mock('../send-service', () => ({
  logAscent: jest.fn(),
}));

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import type { Session } from '@supabase/supabase-js';

import { logAscent } from '../send-service';
import LogSendScreen from '../screens/LogSendScreen';
import { renderOptions } from '../test-utils';

const mockLogAscent = logAscent as jest.MockedFunction<typeof logAscent>;

const MOCK_SESSION = {
  user: { id: 'user-001' },
} as unknown as Session;

const DEFAULT_PROPS = {
  routeId: 'route-001',
  routeGrade: 'V5',
  session: MOCK_SESSION,
  onSuccess: jest.fn(),
  onCancel: jest.fn(),
};

describe('LogSendScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the grade read-only — not editable', () => {
    render(<LogSendScreen {...DEFAULT_PROPS} />, renderOptions());

    // Grade displayed
    expect(screen.getByText('V5')).toBeTruthy();
  });

  it('renders all four style chips (flash, top, attempt, project)', () => {
    render(<LogSendScreen {...DEFAULT_PROPS} />, renderOptions());

    // All style options must be present — query by text since i18n renders them
    expect(screen.getByText(/Flash|閃攀/)).toBeTruthy();
    expect(screen.getByText(/^Top$|^完攀$/)).toBeTruthy();
    expect(screen.getByText(/^Attempt$|^嘗試$/)).toBeTruthy();
    expect(screen.getByText(/^Project$|^項目$/)).toBeTruthy();
  });

  it('calls onCancel when the cancel button is pressed', () => {
    render(<LogSendScreen {...DEFAULT_PROPS} />, renderOptions());

    const cancelButtons = screen.queryAllByRole('button').filter(
      (el) =>
        el.props.accessibilityLabel === 'Cancel' ||
        el.props.accessibilityLabel === '取消',
    );
    expect(cancelButtons.length).toBeGreaterThan(0);
    fireEvent.press(cancelButtons[0]);
    expect(DEFAULT_PROPS.onCancel).toHaveBeenCalled();
  });

  it('calls logAscent and then onSuccess when the form is submitted successfully', async () => {
    mockLogAscent.mockResolvedValueOnce({
      id: 'ascent-001',
      user_id: 'user-001',
      route_id: 'route-001',
      style: 'top',
      attempts: 1,
      note: null,
      logged_at: '2026-09-20T00:00:00.000Z',
      is_private: false,
    });

    render(<LogSendScreen {...DEFAULT_PROPS} />, renderOptions());

    const submitButtons = screen.queryAllByRole('button').filter(
      (el) =>
        el.props.accessibilityLabel === 'Log Send' ||
        el.props.accessibilityLabel === '記錄完攀',
    );
    expect(submitButtons.length).toBeGreaterThan(0);
    fireEvent.press(submitButtons[0]);

    await waitFor(() => {
      expect(mockLogAscent).toHaveBeenCalled();
      expect(DEFAULT_PROPS.onSuccess).toHaveBeenCalled();
    });
  });

  it('shows a clear error message on network failure (AC-012)', async () => {
    mockLogAscent.mockRejectedValueOnce(
      new Error('Failed to save your send. Please check your connection and try again.'),
    );

    render(<LogSendScreen {...DEFAULT_PROPS} />, renderOptions());

    const submitButtons = screen.queryAllByRole('button').filter(
      (el) =>
        el.props.accessibilityLabel === 'Log Send' ||
        el.props.accessibilityLabel === '記錄完攀',
    );
    fireEvent.press(submitButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/Failed to save your send/)).toBeTruthy();
    });
    // onSuccess must NOT have been called
    expect(DEFAULT_PROPS.onSuccess).not.toHaveBeenCalled();
  });

  it('locks attempts to 1 when flash style is selected', async () => {
    render(<LogSendScreen {...DEFAULT_PROPS} />, renderOptions());

    // Select flash — text chip says "Flash" or "閃攀"
    const flashChip = screen.getByText(/Flash|閃攀/);
    fireEvent.press(flashChip);

    // Flash hint text should appear
    await waitFor(() => {
      const flashHint = screen.queryByText(/Flash = 1 attempt only\.|閃攀限定 1 次嘗試。/);
      expect(flashHint).toBeTruthy();
    });
  });

  it('does not include a grade field in the logAscent call payload', async () => {
    mockLogAscent.mockResolvedValueOnce({
      id: 'ascent-001',
      user_id: 'user-001',
      route_id: 'route-001',
      style: 'top',
      attempts: 1,
      note: null,
      logged_at: '2026-09-20T00:00:00.000Z',
      is_private: false,
    });

    render(<LogSendScreen {...DEFAULT_PROPS} />, renderOptions());

    const submitButtons = screen.queryAllByRole('button').filter(
      (el) =>
        el.props.accessibilityLabel === 'Log Send' ||
        el.props.accessibilityLabel === '記錄完攀',
    );
    fireEvent.press(submitButtons[0]);

    await waitFor(() => {
      expect(mockLogAscent).toHaveBeenCalled();
    });

    const callArgs = mockLogAscent.mock.calls[0];
    // Second arg is the AscentLogInput — must not have grade
    expect(callArgs[1]).not.toHaveProperty('grade');
  });
});
