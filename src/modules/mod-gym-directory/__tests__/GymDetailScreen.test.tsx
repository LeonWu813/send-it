/**
 * Tests for GymDetailScreen.
 *
 * Tests behaviour: rendering gym details, error states, back navigation.
 * gym-service.loadGym is mocked to avoid real network calls.
 */

// ── Mocks ────────────────────────────────────────────────────────────────────
jest.mock('../gym-service');
jest.mock('../../../lib/supabase', () => ({
  supabase: { from: jest.fn() },
}));

// ── Imports ───────────────────────────────────────────────────────────────────
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import GymDetailScreen from '../screens/GymDetailScreen';
import * as gymService from '../gym-service';
import type { Gym } from '../types';
import { renderOptions } from '../test-utils';

// ── Typed mock helpers ────────────────────────────────────────────────────────
const mockLoadGym = gymService.loadGym as jest.MockedFunction<
  typeof gymService.loadGym
>;
const mockFetchSavedGymIds = gymService.fetchSavedGymIds as jest.MockedFunction<
  typeof gymService.fetchSavedGymIds
>;
const mockSaveGym = gymService.saveGym as jest.MockedFunction<
  typeof gymService.saveGym
>;
const mockUnsaveGym = gymService.unsaveGym as jest.MockedFunction<
  typeof gymService.unsaveGym
>;

const BOULDERING_GYM: Gym = {
  id: 'gym-001',
  name: 'MegaSTONE Climbing Gym',
  name_zh: 'MegaSTONE 巨石攀岩館',
  branch_label: null,
  city: 'New Taipei',
  city_zh: '新北市',
  district: 'Xinzhuang',
  district_zh: '新莊區',
  address_text: '新北市新莊區思源路171號',
  lat: 25.0363,
  lng: 121.4447,
  gym_type: 'bouldering',
  photo_url: null,
  official_grading_system: 'V',
  bouldering_only_note: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const MIXED_GYM: Gym = {
  id: 'gym-009',
  name: 'double8 Climbing Lab',
  name_zh: 'double8 岩究所',
  branch_label: null,
  city: 'Taipei',
  city_zh: '台北市',
  district: 'Dadaocheng',
  district_zh: '大同區',
  address_text: '台北市大同區迪化街一段14號',
  lat: 25.0572,
  lng: 121.5098,
  gym_type: 'both',
  photo_url: null,
  official_grading_system: 'V',
  bouldering_only_note:
    'Only the bouldering area is represented in Send It. Top-rope routes are excluded.',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GymDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: no saved gyms (safe baseline for all existing tests)
    mockFetchSavedGymIds.mockResolvedValue([]);
    mockSaveGym.mockResolvedValue(undefined);
    mockUnsaveGym.mockResolvedValue(undefined);
  });

  it('renders gym name, city/district, address, and grading system', async () => {
    mockLoadGym.mockResolvedValueOnce(BOULDERING_GYM);

    render(<GymDetailScreen gymId="gym-001" onBack={jest.fn()} onViewRoutes={jest.fn()} />, renderOptions());

    await waitFor(() =>
      expect(screen.getByText('MegaSTONE Climbing Gym')).toBeTruthy(),
    );

    expect(screen.getByText('MegaSTONE 巨石攀岩館')).toBeTruthy();
    expect(screen.getByText('New Taipei · Xinzhuang')).toBeTruthy();
    expect(screen.getByText('新北市新莊區思源路171號')).toBeTruthy();
    expect(screen.getByText('V')).toBeTruthy();
  });

  it('shows bouldering_only_note for mixed gyms', async () => {
    mockLoadGym.mockResolvedValueOnce(MIXED_GYM);

    render(<GymDetailScreen gymId="gym-009" onBack={jest.fn()} onViewRoutes={jest.fn()} />, renderOptions());

    await waitFor(() =>
      expect(screen.getByText('double8 Climbing Lab')).toBeTruthy(),
    );

    expect(
      screen.getByText(
        'Only the bouldering area is represented in Send It. Top-rope routes are excluded.',
      ),
    ).toBeTruthy();
  });

  it('shows branch_label when present', async () => {
    const gymWithBranch: Gym = {
      ...BOULDERING_GYM,
      id: 'gym-004',
      name: 'T-UP 原岩攀岩館 — Wanhua',
      branch_label: '萬華',
    };
    mockLoadGym.mockResolvedValueOnce(gymWithBranch);

    render(<GymDetailScreen gymId="gym-004" onBack={jest.fn()} onViewRoutes={jest.fn()} />, renderOptions());

    await waitFor(() =>
      expect(screen.getByText('T-UP 原岩攀岩館 — Wanhua')).toBeTruthy(),
    );

    expect(screen.getByText('萬華')).toBeTruthy();
  });

  it('shows an error message when gym is not found', async () => {
    mockLoadGym.mockResolvedValueOnce(null);

    render(<GymDetailScreen gymId="nonexistent" onBack={jest.fn()} onViewRoutes={jest.fn()} />, renderOptions());

    await waitFor(() => {
      expect(screen.getByText('Gym not found.')).toBeTruthy();
    });
  });

  it('shows an error message when loading fails', async () => {
    mockLoadGym.mockRejectedValueOnce(new Error('DB error'));

    render(<GymDetailScreen gymId="gym-001" onBack={jest.fn()} onViewRoutes={jest.fn()} />, renderOptions());

    await waitFor(() => {
      expect(
        screen.getByText('Failed to load gyms. Please try again.'),
      ).toBeTruthy();
    });
  });

  it('calls onBack when the back link is pressed', async () => {
    const onBack = jest.fn();
    mockLoadGym.mockResolvedValueOnce(BOULDERING_GYM);

    render(<GymDetailScreen gymId="gym-001" onBack={onBack} onViewRoutes={jest.fn()} />, renderOptions());

    await waitFor(() =>
      expect(screen.getByText('MegaSTONE Climbing Gym')).toBeTruthy(),
    );

    fireEvent.press(screen.getByLabelText('Back'));
    expect(onBack).toHaveBeenCalled();
  });

  it('calls onViewRoutes with gymId and gymName when View Routes is pressed', async () => {
    const onViewRoutes = jest.fn();
    mockLoadGym.mockResolvedValueOnce(BOULDERING_GYM);

    render(
      <GymDetailScreen gymId="gym-001" onBack={jest.fn()} onViewRoutes={onViewRoutes} />,
      renderOptions(),
    );

    await waitFor(() =>
      expect(screen.getByText('MegaSTONE Climbing Gym')).toBeTruthy(),
    );

    fireEvent.press(screen.getByText('View Routes'));
    expect(onViewRoutes).toHaveBeenCalledWith('gym-001', 'MegaSTONE Climbing Gym');
  });

  // AC-120, AC-121: Bookmark icon
  it('shows bookmark-outline (unsaved) when the gym is not in saved list (AC-120)', async () => {
    mockLoadGym.mockResolvedValueOnce(BOULDERING_GYM);
    mockFetchSavedGymIds.mockResolvedValueOnce([]); // gym-001 not saved

    render(
      <GymDetailScreen gymId="gym-001" onBack={jest.fn()} onViewRoutes={jest.fn()} />,
      renderOptions(),
    );

    await waitFor(() =>
      expect(screen.getByText('MegaSTONE Climbing Gym')).toBeTruthy(),
    );

    // Button accessible as "Save gym" (unsaved state label)
    expect(screen.getByLabelText('Save gym')).toBeTruthy();
  });

  it('shows bookmark (saved/filled) when the gym is in the saved list (AC-120)', async () => {
    mockLoadGym.mockResolvedValueOnce(BOULDERING_GYM);
    mockFetchSavedGymIds.mockResolvedValueOnce(['gym-001']); // gym-001 is saved

    render(
      <GymDetailScreen gymId="gym-001" onBack={jest.fn()} onViewRoutes={jest.fn()} />,
      renderOptions(),
    );

    await waitFor(() =>
      expect(screen.getByText('MegaSTONE Climbing Gym')).toBeTruthy(),
    );

    // Button accessible as "Unsave gym" (saved state label)
    expect(screen.getByLabelText('Unsave gym')).toBeTruthy();
  });

  it('optimistically toggles from unsaved to saved on bookmark press and calls saveGym (AC-121)', async () => {
    mockLoadGym.mockResolvedValueOnce(BOULDERING_GYM);
    mockFetchSavedGymIds.mockResolvedValueOnce([]); // start unsaved

    render(
      <GymDetailScreen gymId="gym-001" onBack={jest.fn()} onViewRoutes={jest.fn()} />,
      renderOptions(),
    );

    await waitFor(() =>
      expect(screen.getByText('MegaSTONE Climbing Gym')).toBeTruthy(),
    );

    // Press the "Save gym" button
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Save gym'));
    });

    // After toggle, label should be "Unsave gym"
    expect(screen.getByLabelText('Unsave gym')).toBeTruthy();
    expect(mockSaveGym).toHaveBeenCalledWith('gym-001');
  });

  it('optimistically toggles from saved to unsaved on bookmark press and calls unsaveGym (AC-121)', async () => {
    mockLoadGym.mockResolvedValueOnce(BOULDERING_GYM);
    mockFetchSavedGymIds.mockResolvedValueOnce(['gym-001']); // start saved

    render(
      <GymDetailScreen gymId="gym-001" onBack={jest.fn()} onViewRoutes={jest.fn()} />,
      renderOptions(),
    );

    await waitFor(() =>
      expect(screen.getByText('MegaSTONE Climbing Gym')).toBeTruthy(),
    );

    // Press the "Unsave gym" button
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Unsave gym'));
    });

    // After toggle, label should be "Save gym"
    expect(screen.getByLabelText('Save gym')).toBeTruthy();
    expect(mockUnsaveGym).toHaveBeenCalledWith('gym-001');
  });

  it('reverts bookmark state when saveGym throws (AC-121 optimistic revert)', async () => {
    mockLoadGym.mockResolvedValueOnce(BOULDERING_GYM);
    mockFetchSavedGymIds.mockResolvedValueOnce([]); // start unsaved
    mockSaveGym.mockRejectedValueOnce(new Error('network error'));

    render(
      <GymDetailScreen gymId="gym-001" onBack={jest.fn()} onViewRoutes={jest.fn()} />,
      renderOptions(),
    );

    await waitFor(() =>
      expect(screen.getByText('MegaSTONE Climbing Gym')).toBeTruthy(),
    );

    // Press save — should optimistically flip then revert
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Save gym'));
    });

    // Revert: back to "Save gym" (unsaved state)
    await waitFor(() =>
      expect(screen.getByLabelText('Save gym')).toBeTruthy(),
    );
  });
});
