/**
 * Tests for RequestGymScreen.
 *
 * Tests behaviour: form validation, submission, success state, error state.
 * gym-service.submitGymRequest is mocked to avoid real network calls.
 */

// ── Mocks ────────────────────────────────────────────────────────────────────
jest.mock('../gym-service');
jest.mock('../../../lib/supabase', () => ({
  supabase: { from: jest.fn() },
}));

// ── Imports ───────────────────────────────────────────────────────────────────
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import type { Session } from '@supabase/supabase-js';
import RequestGymScreen from '../screens/RequestGymScreen';
import * as gymService from '../gym-service';
import { renderOptions } from '../test-utils';

// ── Typed mock helper ─────────────────────────────────────────────────────────
const mockSubmitGymRequest = gymService.submitGymRequest as jest.MockedFunction<
  typeof gymService.submitGymRequest
>;

// Minimal session stub
const MOCK_SESSION: Session = {
  user: {
    id: 'user-123',
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: '2026-01-01T00:00:00Z',
  },
  access_token: 'token',
  refresh_token: 'refresh',
  expires_in: 3600,
  expires_at: 9999999999,
  token_type: 'bearer',
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('RequestGymScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the form with name, city, and optional maps URL fields', () => {
    render(
      <RequestGymScreen session={MOCK_SESSION} onBack={jest.fn()} />,
      renderOptions(),
    );

    expect(screen.getByText('Request a Gym')).toBeTruthy();
    expect(screen.getByPlaceholderText('e.g. My Climbing Gym')).toBeTruthy();
    expect(screen.getByPlaceholderText('e.g. Taipei')).toBeTruthy();
    expect(screen.getByPlaceholderText('https://maps.google.com/...')).toBeTruthy();
  });

  it('submits successfully and shows the confirmation state', async () => {
    mockSubmitGymRequest.mockResolvedValueOnce(undefined);

    render(
      <RequestGymScreen session={MOCK_SESSION} onBack={jest.fn()} />,
      renderOptions(),
    );

    fireEvent.changeText(
      screen.getByPlaceholderText('e.g. My Climbing Gym'),
      'My Climbing Gym',
    );
    fireEvent.changeText(
      screen.getByPlaceholderText('e.g. Taipei'),
      'Taipei',
    );

    fireEvent.press(screen.getByText('Submit Request'));

    await waitFor(() => {
      expect(screen.getByText('Request Submitted!')).toBeTruthy();
    });

    expect(mockSubmitGymRequest).toHaveBeenCalledWith('user-123', {
      name: 'My Climbing Gym',
      city: 'Taipei',
      google_maps_url: null,
    });
  });

  it('includes the google_maps_url when provided', async () => {
    mockSubmitGymRequest.mockResolvedValueOnce(undefined);

    render(
      <RequestGymScreen session={MOCK_SESSION} onBack={jest.fn()} />,
      renderOptions(),
    );

    fireEvent.changeText(
      screen.getByPlaceholderText('e.g. My Climbing Gym'),
      'Rock Gym',
    );
    fireEvent.changeText(
      screen.getByPlaceholderText('e.g. Taipei'),
      'New Taipei',
    );
    fireEvent.changeText(
      screen.getByPlaceholderText('https://maps.google.com/...'),
      'https://maps.google.com/?q=rock+gym',
    );

    fireEvent.press(screen.getByText('Submit Request'));

    await waitFor(() => {
      expect(mockSubmitGymRequest).toHaveBeenCalledWith('user-123', {
        name: 'Rock Gym',
        city: 'New Taipei',
        google_maps_url: 'https://maps.google.com/?q=rock+gym',
      });
    });
  });

  it('shows an error message when submission fails', async () => {
    mockSubmitGymRequest.mockRejectedValueOnce(
      new Error('Failed to submit gym request. Please try again.'),
    );

    render(
      <RequestGymScreen session={MOCK_SESSION} onBack={jest.fn()} />,
      renderOptions(),
    );

    fireEvent.changeText(
      screen.getByPlaceholderText('e.g. My Climbing Gym'),
      'Gym',
    );
    fireEvent.changeText(
      screen.getByPlaceholderText('e.g. Taipei'),
      'Taipei',
    );

    fireEvent.press(screen.getByText('Submit Request'));

    await waitFor(() => {
      expect(
        screen.getByText('Failed to submit gym request. Please try again.'),
      ).toBeTruthy();
    });
  });

  it('calls onBack when the Done button is pressed on the success screen', async () => {
    const onBack = jest.fn();
    mockSubmitGymRequest.mockResolvedValueOnce(undefined);

    render(
      <RequestGymScreen session={MOCK_SESSION} onBack={onBack} />,
      renderOptions(),
    );

    fireEvent.changeText(
      screen.getByPlaceholderText('e.g. My Climbing Gym'),
      'Gym',
    );
    fireEvent.changeText(
      screen.getByPlaceholderText('e.g. Taipei'),
      'Taipei',
    );

    fireEvent.press(screen.getByText('Submit Request'));

    await waitFor(() =>
      expect(screen.getByText('Request Submitted!')).toBeTruthy(),
    );

    fireEvent.press(screen.getByText('Done'));
    expect(onBack).toHaveBeenCalled();
  });

  it('calls onBack when the back link is pressed from the form', () => {
    const onBack = jest.fn();
    render(
      <RequestGymScreen session={MOCK_SESSION} onBack={onBack} />,
      renderOptions(),
    );

    fireEvent.press(screen.getByText('Back'));
    expect(onBack).toHaveBeenCalled();
  });
});
