/**
 * Tests for HomeScreen (MOD-012).
 *
 * Tests behaviour: banner section, saved gyms strip, following climbers
 * empty state, and navigation callbacks.
 *
 * gym-service and supabase are mocked to avoid real network calls.
 */

// ── Mocks ─────────────────────────────────────────────────────────────────────
jest.mock('../../mod-gym-directory/gym-service');
jest.mock('../../../lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

// Mock BANNERS so banner-related behaviour is deterministic in tests
jest.mock('../../../lib/banners', () => ({
  BANNERS: [
    {
      id: 'banner-1',
      titleKey: 'home.banners.competition',
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      imageSource: require('../../../assets/banners/banner1.png'),
    },
  ],
}));

// ── Imports ───────────────────────────────────────────────────────────────────
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import type { Session } from '@supabase/supabase-js';

import HomeScreen from '../screens/HomeScreen';
import * as gymService from '../../mod-gym-directory/gym-service';
import { supabase } from '../../../lib/supabase';
import { renderOptions } from '../test-utils';

// ── Typed helpers ─────────────────────────────────────────────────────────────
const mockFetchSavedGymIds = gymService.fetchSavedGymIds as jest.MockedFunction<
  typeof gymService.fetchSavedGymIds
>;
const mockFrom = supabase.from as jest.MockedFunction<typeof supabase.from>;

const MOCK_SESSION = {
  user: { id: 'user-001' },
  access_token: 'tok',
} as unknown as Session;

const GYM_FIXTURES = [
  { id: 'gym-001', name: 'MegaSTONE Climbing Gym', photo_url: null },
  { id: 'gym-002', name: 'T-UP Wanhua', photo_url: 'https://example.com/photo.jpg' },
];

/**
 * Builds a minimal chainable Supabase query builder for a SELECT.in chain.
 * Matches how HomeScreen queries: supabase.from('gyms').select(...).in('id', ids)
 */
function makeSelectInBuilder(result: { data: unknown; error: unknown }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const resolvedPromise = Promise.resolve(result);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const builder: any = {
    select: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    then: resolvedPromise.then.bind(resolvedPromise),
  };
  return builder;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('HomeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Banner section (AC-112) ──────────────────────────────────────────────────

  it('renders banner cards when BANNERS is non-empty (AC-112)', async () => {
    mockFetchSavedGymIds.mockResolvedValue([]);

    render(
      <HomeScreen
        session={MOCK_SESSION}
        onViewAllGyms={jest.fn()}
        onSelectGym={jest.fn()}
      />,
      renderOptions(),
    );

    await waitFor(() => {
      expect(screen.getByText('Competition')).toBeTruthy();
    });
  });

  // ── Saved Gyms section (AC-113, AC-114, AC-115) ──────────────────────────────

  it('shows empty prompt when user has no saved gyms (AC-115)', async () => {
    mockFetchSavedGymIds.mockResolvedValue([]);

    render(
      <HomeScreen
        session={MOCK_SESSION}
        onViewAllGyms={jest.fn()}
        onSelectGym={jest.fn()}
      />,
      renderOptions(),
    );

    await waitFor(() => {
      expect(
        screen.getByText('Tap the bookmark on any gym to save it.'),
      ).toBeTruthy();
    });
  });

  it('renders saved gym chips when the user has saved gyms (AC-113)', async () => {
    mockFetchSavedGymIds.mockResolvedValue(['gym-001', 'gym-002']);
    const qb = makeSelectInBuilder({ data: GYM_FIXTURES, error: null });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);

    render(
      <HomeScreen
        session={MOCK_SESSION}
        onViewAllGyms={jest.fn()}
        onSelectGym={jest.fn()}
      />,
      renderOptions(),
    );

    await waitFor(() => {
      expect(screen.getByText('MegaSTONE Climbing Gym')).toBeTruthy();
      expect(screen.getByText('T-UP Wanhua')).toBeTruthy();
    });
  });

  it('calls onViewAllGyms when the View All pressable is tapped (AC-113)', async () => {
    mockFetchSavedGymIds.mockResolvedValue([]);
    const onViewAllGyms = jest.fn();

    render(
      <HomeScreen
        session={MOCK_SESSION}
        onViewAllGyms={onViewAllGyms}
        onSelectGym={jest.fn()}
      />,
      renderOptions(),
    );

    await waitFor(() => {
      expect(screen.getByText('View All')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('View All'));
    expect(onViewAllGyms).toHaveBeenCalledTimes(1);
  });

  it('calls onSelectGym with the gym ID when a gym chip is tapped (AC-114)', async () => {
    mockFetchSavedGymIds.mockResolvedValue(['gym-001']);
    const qb = makeSelectInBuilder({ data: [GYM_FIXTURES[0]], error: null });
    mockFrom.mockReturnValueOnce(qb as unknown as ReturnType<typeof supabase.from>);
    const onSelectGym = jest.fn();

    render(
      <HomeScreen
        session={MOCK_SESSION}
        onViewAllGyms={jest.fn()}
        onSelectGym={onSelectGym}
      />,
      renderOptions(),
    );

    await waitFor(() => {
      expect(screen.getByText('MegaSTONE Climbing Gym')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('MegaSTONE Climbing Gym'));
    expect(onSelectGym).toHaveBeenCalledWith('gym-001');
  });

  // ── Following Climbers section (AC-123, AC-124) ──────────────────────────────

  it('renders the Following section empty state (AC-124)', async () => {
    mockFetchSavedGymIds.mockResolvedValue([]);

    render(
      <HomeScreen
        session={MOCK_SESSION}
        onViewAllGyms={jest.fn()}
        onSelectGym={jest.fn()}
      />,
      renderOptions(),
    );

    await waitFor(() => {
      expect(screen.getByText('Follow climbers to see them here')).toBeTruthy();
    });
  });

  it('renders the Following section header (AC-123)', async () => {
    mockFetchSavedGymIds.mockResolvedValue([]);

    render(
      <HomeScreen
        session={MOCK_SESSION}
        onViewAllGyms={jest.fn()}
        onSelectGym={jest.fn()}
      />,
      renderOptions(),
    );

    await waitFor(() => {
      expect(screen.getByText('Following')).toBeTruthy();
    });
  });
});
