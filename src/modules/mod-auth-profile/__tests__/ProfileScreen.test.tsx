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

jest.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => undefined },
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: jest.fn() },
  }),
}));

jest.mock('../../mod-social-feed', () => ({
  fetchFollowerCounts: jest.fn().mockResolvedValue({ follower_count: 5, following_count: 3 }),
}));

jest.mock('../../mod-beta-video', () => ({
  BetaVideoGrid: () => null,
  BetaVideoReelViewer: () => null,
  fetchBetaVideosByUser: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../mod-profile-history', () => ({
  fetchProfileHistory: jest.fn().mockResolvedValue([]),
  fetchProfileStats: jest.fn().mockResolvedValue({
    total_sends: 85,
    sends_by_grade: [],
    accumulated_days: 30,
    highest_grade: 'V6',
  }),
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

describe('ProfileScreen', () => {
  it('renders without crashing', () => {
    const { getByLabelText } = render(
      <ThemeProvider>
      <ProfileScreen
        session={mockSession}
        onNavigateEditProfile={jest.fn()}
      />
      </ThemeProvider>,
    );
    // AC-117: Edit Profile affordance is present
    expect(getByLabelText('profile.editProfile')).toBeTruthy();
  });

  it('renders follower and following count links (AC-145)', () => {
    const { getByLabelText } = render(
      <ThemeProvider>
      <ProfileScreen
        session={mockSession}
        onNavigateEditProfile={jest.fn()}
        onNavigateToFollowers={jest.fn()}
        onNavigateToFollowing={jest.fn()}
      />
      </ThemeProvider>,
    );
    // AC-145: count links are accessible
    expect(getByLabelText(/socialFeed.followers/)).toBeTruthy();
    expect(getByLabelText(/socialFeed.following/)).toBeTruthy();
  });

  it('shows the compact stats row that opens Profile History for own profile (P-1)', async () => {
    const { findByLabelText } = render(
      <ThemeProvider>
        <ProfileScreen session={mockSession} onNavigateEditProfile={jest.fn()} />
      </ThemeProvider>,
    );
    const stats = await findByLabelText('compact-stats');
    fireEvent.press(stats);
    await waitFor(() => expect(mockOpenHistory).toHaveBeenCalledWith('user-1', true));
  });
});
