/**
 * Tests for HomeScreen (MOD-012).
 *
 * Tests behaviour: banner section, saved gyms strip, following climbers
 * strip and empty state, and navigation callbacks.
 *
 * gym-service, social-feed-service, and supabase are mocked to avoid real
 * network calls.
 */

// ── Mocks ─────────────────────────────────────────────────────────────────────
jest.mock('../../mod-gym-directory/gym-service');
jest.mock('../../mod-social-feed/social-feed-service');
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
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import type { Session } from '@supabase/supabase-js';

import HomeScreen from '../screens/HomeScreen';
import * as gymService from '../../mod-gym-directory/gym-service';
import * as socialFeedService from '../../mod-social-feed/social-feed-service';
import { supabase } from '../../../lib/supabase';
import { renderOptions } from '../test-utils';

// ── Typed helpers ─────────────────────────────────────────────────────────────
const mockFetchSavedGymIds = gymService.fetchSavedGymIds as jest.MockedFunction<
  typeof gymService.fetchSavedGymIds
>;
const mockFetchFollowing = socialFeedService.fetchFollowing as jest.MockedFunction<
  typeof socialFeedService.fetchFollowing
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

const FOLLOWING_FIXTURES = [
  { id: 'user-002', display_name: 'Alice Chen', avatar_url: null },
  { id: 'user-003', display_name: 'Bob Lin', avatar_url: 'https://example.com/bob.jpg' },
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
    // Default: no followed users — prevents tests that don't care about the
    // following strip from hanging on an unresolved promise.
    mockFetchFollowing.mockResolvedValue([]);
  });

  // ── Banner section (AC-112) ──────────────────────────────────────────────────

  it('renders banner cards when BANNERS is non-empty (AC-112)', async () => {
    mockFetchSavedGymIds.mockResolvedValue([]);

    render(
      <HomeScreen
        session={MOCK_SESSION}
        isActive={true}
        onViewAllGyms={jest.fn()}
        onSelectGym={jest.fn()}
        onSelectClimber={jest.fn()}
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
        isActive={true}
        onViewAllGyms={jest.fn()}
        onSelectGym={jest.fn()}
        onSelectClimber={jest.fn()}
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
    mockFrom.mockReturnValue(qb as unknown as ReturnType<typeof supabase.from>);

    render(
      <HomeScreen
        session={MOCK_SESSION}
        isActive={true}
        onViewAllGyms={jest.fn()}
        onSelectGym={jest.fn()}
        onSelectClimber={jest.fn()}
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
        isActive={true}
        onViewAllGyms={onViewAllGyms}
        onSelectGym={jest.fn()}
        onSelectClimber={jest.fn()}
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
    mockFrom.mockReturnValue(qb as unknown as ReturnType<typeof supabase.from>);
    const onSelectGym = jest.fn();

    render(
      <HomeScreen
        session={MOCK_SESSION}
        isActive={true}
        onViewAllGyms={jest.fn()}
        onSelectGym={onSelectGym}
        onSelectClimber={jest.fn()}
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

  it('renders the Following section empty state when user follows no one (AC-124)', async () => {
    mockFetchSavedGymIds.mockResolvedValue([]);
    // mockFetchFollowing already returns [] via beforeEach default

    render(
      <HomeScreen
        session={MOCK_SESSION}
        isActive={true}
        onViewAllGyms={jest.fn()}
        onSelectGym={jest.fn()}
        onSelectClimber={jest.fn()}
      />,
      renderOptions(),
    );

    await waitFor(() => {
      expect(screen.getByText('Follow climbers to see their activity')).toBeTruthy();
    });
  });

  it('renders the Following section header (AC-123)', async () => {
    mockFetchSavedGymIds.mockResolvedValue([]);

    render(
      <HomeScreen
        session={MOCK_SESSION}
        isActive={true}
        onViewAllGyms={jest.fn()}
        onSelectGym={jest.fn()}
        onSelectClimber={jest.fn()}
      />,
      renderOptions(),
    );

    await waitFor(() => {
      expect(screen.getByText('Following')).toBeTruthy();
    });
  });

  it('renders followed user chips when the user follows others (AC-123)', async () => {
    mockFetchSavedGymIds.mockResolvedValue([]);
    mockFetchFollowing.mockResolvedValue(FOLLOWING_FIXTURES);

    render(
      <HomeScreen
        session={MOCK_SESSION}
        isActive={true}
        onViewAllGyms={jest.fn()}
        onSelectGym={jest.fn()}
        onSelectClimber={jest.fn()}
      />,
      renderOptions(),
    );

    await waitFor(() => {
      expect(screen.getByText('Alice Chen')).toBeTruthy();
      expect(screen.getByText('Bob Lin')).toBeTruthy();
    });
  });

  it('calls fetchFollowing with the current user id (AC-123)', async () => {
    mockFetchSavedGymIds.mockResolvedValue([]);
    mockFetchFollowing.mockResolvedValue([]);

    render(
      <HomeScreen
        session={MOCK_SESSION}
        isActive={true}
        onViewAllGyms={jest.fn()}
        onSelectGym={jest.fn()}
        onSelectClimber={jest.fn()}
      />,
      renderOptions(),
    );

    await waitFor(() => {
      expect(mockFetchFollowing).toHaveBeenCalledWith('user-001');
    });
  });

  it('calls onSelectClimber with the correct user ID when a climber chip is tapped (AC-123)', async () => {
    mockFetchSavedGymIds.mockResolvedValue([]);
    mockFetchFollowing.mockResolvedValue(FOLLOWING_FIXTURES);
    const onSelectClimber = jest.fn();

    render(
      <HomeScreen
        session={MOCK_SESSION}
        isActive={true}
        onViewAllGyms={jest.fn()}
        onSelectGym={jest.fn()}
        onSelectClimber={onSelectClimber}
      />,
      renderOptions(),
    );

    await waitFor(() => {
      expect(screen.getByText('Alice Chen')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Alice Chen'));
    expect(onSelectClimber).toHaveBeenCalledWith('user-002');
  });

  // ── Focus-triggered refetch (Bug 2 fix) ─────────────────────────────────────

  it('refetches saved gyms when isActive changes from false to true', async () => {
    // Initially inactive — render with no saved gyms
    mockFetchSavedGymIds.mockResolvedValue([]);

    const { rerender } = render(
      <HomeScreen
        session={MOCK_SESSION}
        isActive={false}
        onViewAllGyms={jest.fn()}
        onSelectGym={jest.fn()}
        onSelectClimber={jest.fn()}
      />,
      renderOptions(),
    );

    // Simulate user saving a gym on the Gyms tab, then switching back to Home
    mockFetchSavedGymIds.mockResolvedValue(['gym-001']);
    const qb = makeSelectInBuilder({ data: [GYM_FIXTURES[0]], error: null });
    mockFrom.mockReturnValue(qb as unknown as ReturnType<typeof supabase.from>);

    await act(async () => {
      rerender(
        <HomeScreen
          session={MOCK_SESSION}
          isActive={true}
          onViewAllGyms={jest.fn()}
          onSelectGym={jest.fn()}
          onSelectClimber={jest.fn()}
        />,
      );
    });

    await waitFor(() => {
      expect(screen.getByText('MegaSTONE Climbing Gym')).toBeTruthy();
    });
  });

  it('refetches following list when isActive changes from false to true', async () => {
    mockFetchSavedGymIds.mockResolvedValue([]);
    // Initially inactive with no following
    mockFetchFollowing.mockResolvedValue([]);

    const { rerender } = render(
      <HomeScreen
        session={MOCK_SESSION}
        isActive={false}
        onViewAllGyms={jest.fn()}
        onSelectGym={jest.fn()}
        onSelectClimber={jest.fn()}
      />,
      renderOptions(),
    );

    // Simulate following a user on a different screen, then returning to Home
    mockFetchFollowing.mockResolvedValue(FOLLOWING_FIXTURES);

    await act(async () => {
      rerender(
        <HomeScreen
          session={MOCK_SESSION}
          isActive={true}
          onViewAllGyms={jest.fn()}
          onSelectGym={jest.fn()}
          onSelectClimber={jest.fn()}
        />,
      );
    });

    await waitFor(() => {
      expect(screen.getByText('Alice Chen')).toBeTruthy();
    });
  });
});
