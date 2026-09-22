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
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import GymDetailScreen from '../screens/GymDetailScreen';
import * as gymService from '../gym-service';
import type { Gym } from '../types';
import { renderOptions } from '../test-utils';

// ── Typed mock helper ─────────────────────────────────────────────────────────
const mockLoadGym = gymService.loadGym as jest.MockedFunction<
  typeof gymService.loadGym
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
  });

  it('renders gym name, city/district, address, and grading system', async () => {
    mockLoadGym.mockResolvedValueOnce(BOULDERING_GYM);

    render(<GymDetailScreen gymId="gym-001" onBack={jest.fn()} />, renderOptions());

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

    render(<GymDetailScreen gymId="gym-009" onBack={jest.fn()} />, renderOptions());

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

    render(<GymDetailScreen gymId="gym-004" onBack={jest.fn()} />, renderOptions());

    await waitFor(() =>
      expect(screen.getByText('T-UP 原岩攀岩館 — Wanhua')).toBeTruthy(),
    );

    expect(screen.getByText('萬華')).toBeTruthy();
  });

  it('shows an error message when gym is not found', async () => {
    mockLoadGym.mockResolvedValueOnce(null);

    render(<GymDetailScreen gymId="nonexistent" onBack={jest.fn()} />, renderOptions());

    await waitFor(() => {
      expect(screen.getByText('Gym not found.')).toBeTruthy();
    });
  });

  it('shows an error message when loading fails', async () => {
    mockLoadGym.mockRejectedValueOnce(new Error('DB error'));

    render(<GymDetailScreen gymId="gym-001" onBack={jest.fn()} />, renderOptions());

    await waitFor(() => {
      expect(
        screen.getByText('Failed to load gyms. Please try again.'),
      ).toBeTruthy();
    });
  });

  it('calls onBack when the back link is pressed', async () => {
    const onBack = jest.fn();
    mockLoadGym.mockResolvedValueOnce(BOULDERING_GYM);

    render(<GymDetailScreen gymId="gym-001" onBack={onBack} />, renderOptions());

    await waitFor(() =>
      expect(screen.getByText('MegaSTONE Climbing Gym')).toBeTruthy(),
    );

    fireEvent.press(screen.getByText('Back'));
    expect(onBack).toHaveBeenCalled();
  });
});
