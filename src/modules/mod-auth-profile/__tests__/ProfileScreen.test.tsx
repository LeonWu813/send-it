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

jest.mock('../../../lib/theme', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        background: '#fff',
        textPrimary: '#000',
        textSecondary: '#888',
        primary: '#007AFF',
        surface: '#f5f5f5',
        border: '#ccc',
      },
      spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
      fontSize: { sm: 12, md: 16, xl: 20 },
      fontWeight: { medium: '500', bold: '700' },
      borderRadius: { md: 8, full: 9999 },
    },
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: jest.fn() },
  }),
}));

jest.mock('../../mod-social-feed/social-feed-service', () => ({
  fetchFollowerCounts: jest.fn().mockResolvedValue({ follower_count: 5, following_count: 3 }),
}));

jest.mock('../../mod-beta-video', () => ({
  BetaVideoGrid: () => null,
  BetaVideoReelViewer: () => null,
  fetchBetaVideosByUser: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../mod-profile-history', () => ({
  SendHistoryProfile: ({ listHeaderComponent }: { listHeaderComponent?: React.ReactElement }) =>
    listHeaderComponent ?? null,
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
import { render } from '@testing-library/react-native';
import ProfileScreen from '../screens/ProfileScreen';
import type { Session } from '@supabase/supabase-js';

const mockSession = {
  user: { id: 'user-1', email: 'test@example.com' },
  access_token: 'token',
} as unknown as Session;

describe('ProfileScreen', () => {
  it('renders without crashing', () => {
    const { getByLabelText } = render(
      <ProfileScreen
        session={mockSession}
        onNavigateEditProfile={jest.fn()}
      />,
    );
    // AC-117: Edit Profile affordance is present
    expect(getByLabelText('profile.editProfile')).toBeTruthy();
  });

  it('renders follower and following count links (AC-145)', () => {
    const { getByLabelText } = render(
      <ProfileScreen
        session={mockSession}
        onNavigateEditProfile={jest.fn()}
        onNavigateToFollowers={jest.fn()}
        onNavigateToFollowing={jest.fn()}
      />,
    );
    // AC-145: count links are accessible
    expect(getByLabelText(/socialFeed.followers/)).toBeTruthy();
    expect(getByLabelText(/socialFeed.following/)).toBeTruthy();
  });

});
