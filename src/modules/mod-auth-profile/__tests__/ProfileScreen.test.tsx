/**
 * Tests for ProfileScreen (MOD-001).
 *
 * Verifies that the profile header, follower/following counts, beta-video grid,
 * and edit-profile affordance render correctly for an authenticated user.
 *
 * ProfileScreen uses only core React hooks (useEffect/useCallback/useRef/useState)
 * and the isActive prop for keep-alive tab focus — no NavigationContainer required.
 */

jest.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: { getSession: jest.fn(), onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })) },
    from: jest.fn(),
  },
}));

const mockOpenHistory = jest.fn();
const mockFetchStats = jest.fn();
const mockFetchCounts = jest.fn();

jest.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => undefined },
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: jest.fn() },
  }),
}));

jest.mock('../../mod-social-feed', () => ({
  fetchFollowerCounts: (...args: unknown[]) => mockFetchCounts(...args),
}));

jest.mock('../../mod-beta-video', () => ({
  BetaVideoGrid: () => null,
  BetaVideoReelViewer: () => null,
  fetchBetaVideosByUser: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../mod-profile-history', () => ({
  fetchProfileHistory: jest.fn().mockResolvedValue([]),
  fetchProfileStats: (...args: unknown[]) => mockFetchStats(...args),
  groupToRouteCards: jest.fn().mockReturnValue([]),
  StatsPanel: ({ onOpenDetails }: { onOpenDetails?: () => void }) => {
    const { Pressable } = jest.requireActual('react-native');
    return <Pressable accessibilityLabel="compact-stats" onPress={onOpenDetails} />;
  },
  useOpenProfileHistory: () => mockOpenHistory,
}));

jest.mock('../hooks/useSession', () => ({
  useSession: () => ({
    profile: {
      id: 'user-1',
      display_name: 'Test User',
      avatar_url: null,
      bio: 'Hello',
      privacy_setting: 'public',
      beta_video_privacy: 'public',
      created_at: '2026-01-01T00:00:00Z',
    },
    session: null,
    isLoading: false,
  }),
}));

import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import ProfileScreen from '../screens/ProfileScreen';
import { ThemeProvider } from '../../../lib/theme';
import type { Session } from '@supabase/supabase-js';

const mockSession = {
  user: { id: 'user-1', email: 'test@example.com' },
  access_token: 'token',
} as unknown as Session;

const STATS = { total_sends: 85, sends_by_grade: [], accumulated_days: 30, highest_grade: 'V6' };

function renderScreen(props: Partial<React.ComponentProps<typeof ProfileScreen>> = {}) {
  return render(
    <ThemeProvider>
      <ProfileScreen session={mockSession} onNavigateEditProfile={jest.fn()} {...props} />
    </ThemeProvider>,
  );
}

describe('ProfileScreen', () => {
  beforeEach(() => {
    mockFetchStats.mockResolvedValue(STATS);
    mockFetchCounts.mockResolvedValue({ follower_count: 5, following_count: 3 });
  });

  it('renders the Edit Profile affordance once loaded (AC-117)', async () => {
    const { findByLabelText } = renderScreen();
    expect(await findByLabelText('profile.editProfile')).toBeTruthy();
  });

  it('renders follower and following count links (AC-145)', async () => {
    const { findByLabelText } = renderScreen({
      onNavigateToFollowers: jest.fn(),
      onNavigateToFollowing: jest.fn(),
    });
    expect(await findByLabelText(/socialFeed.followers/)).toBeTruthy();
    expect(await findByLabelText(/socialFeed.following/)).toBeTruthy();
  });

  it('draws no fake zero counts before the first load finishes', async () => {
    let resolveCounts: (v: { follower_count: number; following_count: number }) => void = () => undefined;
    mockFetchCounts.mockReturnValue(new Promise((r) => { resolveCounts = r; }));
    const { queryByLabelText, findByLabelText } = renderScreen();
    expect(queryByLabelText(/socialFeed.followers/)).toBeNull();
    expect(queryByLabelText('profile.editProfile')).toBeNull();
    resolveCounts({ follower_count: 5, following_count: 3 });
    expect(await findByLabelText('5 socialFeed.followers')).toBeTruthy();
  });

  it('shows the compact stats row that opens Profile History for own profile (P-1)', async () => {
    const { findByLabelText } = renderScreen();
    const stats = await findByLabelText('compact-stats');
    fireEvent.press(stats);
    await waitFor(() => expect(mockOpenHistory).toHaveBeenCalledWith('user-1', true));
  });

  it('hides the StatsPanel and shows the section empty sentence when there are 0 sends', async () => {
    mockFetchStats.mockResolvedValue({ ...STATS, total_sends: 0 });
    const { findByText, queryByLabelText } = renderScreen();
    expect(await findByText('profile.noSendsYet')).toBeTruthy();
    expect(queryByLabelText('compact-stats')).toBeNull();
  });

  it('offers the Find routes action in the empty history only when onFindRoutes is given', async () => {
    mockFetchStats.mockResolvedValue({ ...STATS, total_sends: 0 });
    const onFindRoutes = jest.fn();
    const { findByText } = renderScreen({ onFindRoutes });
    fireEvent.press(await findByText('profileHistory.stats.promptAction'));
    expect(onFindRoutes).toHaveBeenCalled();
  });

  it('shows the page error with a retry when the first load fails', async () => {
    mockFetchCounts.mockRejectedValueOnce(new Error('boom'));
    const { findByText, queryByLabelText } = renderScreen();
    expect(await findByText('profile.errors.loadFailedTitle')).toBeTruthy();
    expect(queryByLabelText('compact-stats')).toBeNull();
    fireEvent.press(await findByText('common.retry'));
    await waitFor(() => expect(queryByLabelText('compact-stats')).toBeTruthy());
  });
});
