/**
 * Tests for GymListScreen.
 *
 * Tests behaviour: rendering, search filtering, navigation callbacks.
 * gym-service is mocked to avoid real network calls.
 */

// ── Mocks ────────────────────────────────────────────────────────────────────
jest.mock('../gym-service');
jest.mock('../../../lib/supabase', () => ({
  supabase: { from: jest.fn() },
}));

// ── Imports ───────────────────────────────────────────────────────────────────
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import GymListScreen from '../screens/GymListScreen';
import * as gymService from '../gym-service';
import type { GymSummary } from '../types';
import { renderOptions } from '../test-utils';

// ── Helpers ───────────────────────────────────────────────────────────────────
const mockListGyms = gymService.listGyms as jest.MockedFunction<typeof gymService.listGyms>;
const mockFetchSavedGymIds = gymService.fetchSavedGymIds as jest.MockedFunction<
  typeof gymService.fetchSavedGymIds
>;

const GYM_FIXTURES: GymSummary[] = [
  {
    id: 'gym-001',
    name: 'MegaSTONE Climbing Gym',
    name_zh: 'MegaSTONE 巨石攀岩館',
    branch_label: null,
    city: 'New Taipei',
    city_zh: '新北市',
    district: 'Xinzhuang',
    district_zh: '新莊區',
    gym_type: 'bouldering',
    photo_url: null,
  },
  {
    id: 'gym-002',
    name: 'T-UP 原岩攀岩館 — Wanhua',
    name_zh: '原岩攀岩館',
    branch_label: '萬華',
    city: 'Taipei',
    city_zh: '台北市',
    district: 'Wanhua',
    district_zh: '萬華區',
    gym_type: 'bouldering',
    photo_url: null,
  },
  {
    id: 'gym-003',
    name: 'double8 Climbing Lab',
    name_zh: 'double8 岩究所',
    branch_label: null,
    city: 'Taipei',
    city_zh: '台北市',
    district: 'Dadaocheng',
    district_zh: '大同區',
    gym_type: 'both',
    photo_url: null,
  },
];

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GymListScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: no saved gyms — safe baseline for all existing tests
    mockFetchSavedGymIds.mockResolvedValue([]);
  });

  it('renders gym cards after loading', async () => {
    mockListGyms.mockResolvedValueOnce(GYM_FIXTURES);

    render(
      <GymListScreen
        onSelectGym={jest.fn()}
        onRequestGym={jest.fn()}
      />,
      renderOptions(),
    );

    // Initially shows a loading indicator
    expect(screen.queryByText('MegaSTONE Climbing Gym')).toBeNull();

    // After data loads, cards appear
    await waitFor(() => {
      expect(screen.getByText('MegaSTONE Climbing Gym')).toBeTruthy();
    });
    expect(screen.getByText('T-UP 原岩攀岩館 — Wanhua')).toBeTruthy();
    expect(screen.getByText('double8 Climbing Lab')).toBeTruthy();
  });

  it('shows empty state text when no gyms match the search query', async () => {
    mockListGyms.mockResolvedValueOnce(GYM_FIXTURES);

    render(
      <GymListScreen
        onSelectGym={jest.fn()}
        onRequestGym={jest.fn()}
      />,
      renderOptions(),
    );

    await waitFor(() =>
      expect(screen.getByText('MegaSTONE Climbing Gym')).toBeTruthy(),
    );

    const searchInput = screen.getByPlaceholderText('Search gyms…');
    fireEvent.changeText(searchInput, 'zzz no match');

    await waitFor(() => {
      expect(screen.getByText('No gyms found.')).toBeTruthy();
    });
  });

  it('calls onSelectGym with the gym id when a card is pressed', async () => {
    const onSelectGym = jest.fn();
    mockListGyms.mockResolvedValueOnce(GYM_FIXTURES);

    render(
      <GymListScreen
        onSelectGym={onSelectGym}
        onRequestGym={jest.fn()}
      />,
      renderOptions(),
    );

    await waitFor(() =>
      expect(screen.getByText('MegaSTONE Climbing Gym')).toBeTruthy(),
    );

    fireEvent.press(screen.getByText('MegaSTONE Climbing Gym'));
    expect(onSelectGym).toHaveBeenCalledWith('gym-001');
  });

  it('calls onRequestGym when the request link is pressed', async () => {
    const onRequestGym = jest.fn();
    mockListGyms.mockResolvedValueOnce(GYM_FIXTURES);

    render(
      <GymListScreen
        onSelectGym={jest.fn()}
        onRequestGym={onRequestGym}
      />,
      renderOptions(),
    );

    await waitFor(() =>
      expect(screen.getByText('MegaSTONE Climbing Gym')).toBeTruthy(),
    );

    fireEvent.press(screen.getByText("Can't find your gym? Request it →"));
    expect(onRequestGym).toHaveBeenCalled();
  });

  it('shows an error message and retry button when loading fails', async () => {
    mockListGyms.mockRejectedValueOnce(new Error('Network error'));

    render(
      <GymListScreen
        onSelectGym={jest.fn()}
        onRequestGym={jest.fn()}
      />,
      renderOptions(),
    );

    await waitFor(() => {
      expect(screen.getByText('Failed to load gyms. Please try again.')).toBeTruthy();
    });
    expect(screen.getByText('Retry')).toBeTruthy();
  });

  it('retries loading when the retry button is pressed', async () => {
    mockListGyms
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(GYM_FIXTURES);

    render(
      <GymListScreen
        onSelectGym={jest.fn()}
        onRequestGym={jest.fn()}
      />,
      renderOptions(),
    );

    await waitFor(() =>
      expect(screen.getByText('Failed to load gyms. Please try again.')).toBeTruthy(),
    );

    fireEvent.press(screen.getByText('Retry'));

    await waitFor(() =>
      expect(screen.getByText('MegaSTONE Climbing Gym')).toBeTruthy(),
    );
  });

  // AC-122: saved gym cards show a bookmark indicator
  it('shows a "Saved" bookmark indicator on saved gym cards only (AC-122)', async () => {
    mockListGyms.mockResolvedValueOnce(GYM_FIXTURES);
    // gym-001 is saved; gym-002 and gym-003 are not
    mockFetchSavedGymIds.mockResolvedValueOnce(['gym-001']);

    render(
      <GymListScreen
        onSelectGym={jest.fn()}
        onRequestGym={jest.fn()}
      />,
      renderOptions(),
    );

    await waitFor(() =>
      expect(screen.getByText('MegaSTONE Climbing Gym')).toBeTruthy(),
    );

    // The "Saved" accessibility label should appear exactly once (for gym-001)
    const savedLabels = screen.getAllByLabelText('Saved');
    expect(savedLabels).toHaveLength(1);
  });

  it('shows no bookmark indicator when no gyms are saved (AC-122)', async () => {
    mockListGyms.mockResolvedValueOnce(GYM_FIXTURES);
    mockFetchSavedGymIds.mockResolvedValueOnce([]); // nothing saved

    render(
      <GymListScreen
        onSelectGym={jest.fn()}
        onRequestGym={jest.fn()}
      />,
      renderOptions(),
    );

    await waitFor(() =>
      expect(screen.getByText('MegaSTONE Climbing Gym')).toBeTruthy(),
    );

    expect(screen.queryByLabelText('Saved')).toBeNull();
  });

  it('places saved gyms above unsaved gyms in the list', async () => {
    // gym-002 and gym-003 are in the middle/end of the fixture array; gym-002 is saved.
    // After sorting, gym-002 (saved) should appear before gym-001 and gym-003 (unsaved).
    mockListGyms.mockResolvedValueOnce(GYM_FIXTURES);
    mockFetchSavedGymIds.mockResolvedValueOnce(['gym-002']);

    render(
      <GymListScreen
        onSelectGym={jest.fn()}
        onRequestGym={jest.fn()}
      />,
      renderOptions(),
    );

    await waitFor(() =>
      expect(screen.getByText('T-UP 原岩攀岩館 — Wanhua')).toBeTruthy(),
    );

    // getAllByRole('button') returns cards in DOM order (top to bottom).
    // The first card should be gym-002 (saved), followed by gym-001 and gym-003.
    const cards = screen.getAllByRole('button');
    // Filter to gym cards only (exclude the request-gym button at the bottom)
    const gymCards = cards.filter((el) => {
      const label = el.props?.accessibilityLabel ?? '';
      return (
        label.includes('MegaSTONE') ||
        label.includes('Wanhua') ||
        label.includes('double8')
      );
    });

    expect(gymCards[0].props.accessibilityLabel).toContain('Wanhua'); // gym-002 (saved) — first
    expect(gymCards[1].props.accessibilityLabel).toContain('MegaSTONE'); // gym-001 (unsaved) — second
    expect(gymCards[2].props.accessibilityLabel).toContain('double8'); // gym-003 (unsaved) — third
  });
});
