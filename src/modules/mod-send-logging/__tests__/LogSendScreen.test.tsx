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

import { StyleSheet } from 'react-native';
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

  it('does not render the grade display section in the log form (AC-131)', () => {
    render(<LogSendScreen {...DEFAULT_PROPS} />, renderOptions());

    // Grade must NOT appear inside the log-send form (AC-131: grade is shown on
    // route detail screen, not repeated in the log form)
    expect(screen.queryByText('V5')).toBeNull();
  });

  it('renders exactly three style chips (flash, send/top, attempt) — project is removed (AC-014)', () => {
    render(<LogSendScreen {...DEFAULT_PROPS} />, renderOptions());

    // All three valid style options must be present — query by text since i18n renders them
    expect(screen.getByText(/Flash|閃攀/)).toBeTruthy();
    expect(screen.getByText(/^Send$|^完攀$/)).toBeTruthy();
    expect(screen.getByText(/^Attempt$|^嘗試$/)).toBeTruthy();
    // 'project' must NOT appear in the UI (AC-014)
    expect(screen.queryByText(/^Project$|^項目$/)).toBeNull();
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

  it('uses an adjustable Stepper for attempts (1-9999) and clamps at the minimum', () => {
    render(<LogSendScreen {...DEFAULT_PROPS} />, renderOptions());

    const stepper = screen.getByLabelText(/^Attempts$|^嘗試次數$/);
    expect(stepper.props.accessibilityRole).toBe('adjustable');
    expect(stepper.props.accessibilityValue).toMatchObject({ min: 1, max: 9999, now: 1 });

    // decrement at the minimum stays at 1
    fireEvent(stepper, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
    expect(screen.getByLabelText(/^Attempts$|^嘗試次數$/).props.accessibilityValue.now).toBe(1);

    fireEvent(stepper, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    expect(screen.getByLabelText(/^Attempts$|^嘗試次數$/).props.accessibilityValue.now).toBe(2);
  });

  it('pads the attempts field as a C1 row band (12 top/bottom, 16 left/right)', () => {
    render(<LogSendScreen {...DEFAULT_PROPS} />, renderOptions());

    const style = StyleSheet.flatten(screen.getByLabelText(/^Attempts$|^嘗試次數$/).props.style);
    expect(style).toMatchObject({ paddingVertical: 12, paddingLeft: 16, paddingRight: 16 });
  });

  it('locks attempts to 1 for flash and restores the previous count when switching away', async () => {
    mockLogAscent.mockResolvedValue({
      id: 'ascent-001',
      user_id: 'user-001',
      route_id: 'route-001',
      style: 'top',
      attempts: 1,
      note: null,
      logged_at: '2026-09-20T00:00:00.000Z',
      is_private: true,
    });
    render(<LogSendScreen {...DEFAULT_PROPS} />, renderOptions());

    const stepper = screen.getByLabelText(/^Attempts$|^嘗試次數$/);
    fireEvent(stepper, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    fireEvent(stepper, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });

    fireEvent.press(screen.getByText(/Flash|閃攀/));
    // Locked: the container is read as text and the lock description is shown.
    await waitFor(() => {
      expect(screen.getByText(/Flash is fixed at 1|閃攀固定 1 次/)).toBeTruthy();
    });

    // Flash submits exactly 1.
    fireEvent.press(
      screen.queryAllByRole('button').filter((el) => /^Log Send$|^記錄完攀$/.test(el.props.accessibilityLabel))[0],
    );
    await waitFor(() => expect(mockLogAscent).toHaveBeenCalled());
    expect(mockLogAscent.mock.calls[0][1].attempts).toBe(1);

    // Back to Send: the previous count (3) returns.
    fireEvent.press(screen.getByText(/^Send$|^完攀$/));
    await waitFor(() => {
      expect(screen.getByLabelText(/^Attempts$|^嘗試次數$/).props.accessibilityValue.now).toBe(3);
    });
  });

  it('renders the route summary card only when routeSummary is provided', () => {
    const { rerender } = render(<LogSendScreen {...DEFAULT_PROPS} />, renderOptions());
    expect(screen.queryByText('Red · A')).toBeNull();
    rerender(
      <LogSendScreen
        {...DEFAULT_PROPS}
        routeSummary={{ color: 'red', grade: 'V4', title: 'Red · A', subtitle: 'Gym' }}
      />,
    );
    expect(screen.getByText('Red · A')).toBeTruthy();
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
      is_private: true,
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
    // AC-132: is_private must be hardcoded true — never user-supplied
    expect(callArgs[1]).toHaveProperty('is_private', true);
  });
});
