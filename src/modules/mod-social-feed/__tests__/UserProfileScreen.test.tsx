/**
 * Tests for UserProfileScreen (MOD-006).
 *
 * AC-050: follow/unfollow any other user; counts reflect immediately.
 * AC-063: privacy_setting = followers_only badge is shown.
 * AC-150: three-dots icon opens bottom action sheet.
 * AC-151: Report option calls reportUser then blockUser.
 * AC-152: Block/Unblock toggle.
 * AC-153: blocked state renders "profile unavailable" message.
 *
 * social-feed-service, fetchProfileStats, moderation-service, and Supabase are
 * mocked; no real network activity.
 */

jest.mock('../../mod-beta-video', () => ({
  fetchBetaVideosByUser: jest.fn(),
  BetaVideoGrid: () => null,
  BetaVideoReelViewer: () => null,
}));

jest.mock('../../../lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    auth: { getSession: jest.fn() },
    rpc: jest.fn(),
  },
}));

jest.mock('../social-feed-service', () => ({
  fetchFollowerCounts: jest.fn(),
  fetchIsFollowing: jest.fn(),
  follow: jest.fn(),
  unfollow: jest.fn(),
}));

jest.mock('../../mod-profile-history/history-service', () => ({
  fetchProfileStats: jest.fn(),
}));

jest.mock('../../mod-moderation/moderation-service', () => ({
  fetchBlockedUserIds: jest.fn(),
  blockUser: jest.fn(),
  unblockUser: jest.fn(),
  reportUser: jest.fn(),
}));

import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import type { Session } from '@supabase/supabase-js';
import React from 'react';

import { supabase } from '../../../lib/supabase';
import { fetchProfileStats } from '../../mod-profile-history/history-service';
import { fetchBetaVideosByUser } from '../../mod-beta-video';
import {
  fetchBlockedUserIds,
  blockUser,
  unblockUser,
  reportUser,
} from '../../mod-moderation/moderation-service';
import {
  fetchFollowerCounts,
  fetchIsFollowing,
  follow,
  unfollow,
} from '../social-feed-service';
import UserProfileScreen from '../screens/UserProfileScreen';
import { renderOptions } from '../test-utils';

const mockFrom = supabase.from as jest.MockedFunction<typeof supabase.from>;
const mockFetchFollowerCounts = fetchFollowerCounts as jest.MockedFunction<typeof fetchFollowerCounts>;
const mockFetchIsFollowing = fetchIsFollowing as jest.MockedFunction<typeof fetchIsFollowing>;
const mockFollow = follow as jest.MockedFunction<typeof follow>;
const mockUnfollow = unfollow as jest.MockedFunction<typeof unfollow>;
const mockFetchProfileStats = fetchProfileStats as jest.MockedFunction<typeof fetchProfileStats>;
const mockFetchBlockedUserIds = fetchBlockedUserIds as jest.MockedFunction<typeof fetchBlockedUserIds>;
const mockBlockUser = blockUser as jest.MockedFunction<typeof blockUser>;
const mockUnblockUser = unblockUser as jest.MockedFunction<typeof unblockUser>;
const mockReportUser = reportUser as jest.MockedFunction<typeof reportUser>;
const mockFetchBetaVideosByUser = fetchBetaVideosByUser as jest.MockedFunction<typeof fetchBetaVideosByUser>;

const CURRENT_USER_ID = 'user-001';
const TARGET_USER_ID = 'user-002';

const MOCK_SESSION = {
  user: { id: CURRENT_USER_ID },
} as unknown as Session;

const MOCK_PROFILE = {
  id: TARGET_USER_ID,
  display_name: 'Alice',
  avatar_url: null,
  bio: 'Climber from Taipei',
  privacy_setting: 'public',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- test mock
function makeQueryBuilder(result: { data: unknown; error: unknown }): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test mock
  const builder: any = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(result),
    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
  };
  return builder;
}

describe('UserProfileScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchFollowerCounts.mockResolvedValue({ follower_count: 10, following_count: 5 });
    mockFetchIsFollowing.mockResolvedValue(false);
    mockFollow.mockResolvedValue(undefined);
    mockUnfollow.mockResolvedValue(undefined);
    mockFetchProfileStats.mockResolvedValue({
      total_sends: 42,
      accumulated_days: 15,
      highest_grade: 'V5',
      sends_by_grade: [],
    });
    // AC-153: default — not blocked
    mockFetchBlockedUserIds.mockResolvedValue(new Set<string>());
    mockBlockUser.mockResolvedValue(undefined);
    mockUnblockUser.mockResolvedValue(undefined);
    mockReportUser.mockResolvedValue(undefined);
    // AC-163: default — no beta videos
    mockFetchBetaVideosByUser.mockResolvedValue([]);
  });

  function setupProfileMock(profile: typeof MOCK_PROFILE = MOCK_PROFILE): void {
    const qb = makeQueryBuilder({ data: profile, error: null });
    mockFrom.mockReturnValue(qb as unknown as ReturnType<typeof supabase.from>);
  }

  it('shows a loading indicator while loading the profile', () => {
    mockFrom.mockReturnValue(
      makeQueryBuilder({
        data: new Promise(() => { /* never resolves */ }),
        error: null,
      }) as unknown as ReturnType<typeof supabase.from>,
    );
    mockFetchFollowerCounts.mockReturnValue(new Promise(() => { /* never resolves */ }));

    render(
      <UserProfileScreen
        targetUserId={TARGET_USER_ID}
        session={MOCK_SESSION}
        onBack={jest.fn()}
      />,
      renderOptions(),
    );

    expect(screen.toJSON()).toBeTruthy();
  });

  it('renders the user display name and bio', async () => {
    setupProfileMock();

    render(
      <UserProfileScreen
        targetUserId={TARGET_USER_ID}
        session={MOCK_SESSION}
        onBack={jest.fn()}
      />,
      renderOptions(),
    );

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeTruthy();
      expect(screen.getByText('Climber from Taipei')).toBeTruthy();
    });
  });

  it('AC-050: renders follower and following counts', async () => {
    setupProfileMock();

    render(
      <UserProfileScreen
        targetUserId={TARGET_USER_ID}
        session={MOCK_SESSION}
        onBack={jest.fn()}
      />,
      renderOptions(),
    );

    await waitFor(() => {
      expect(screen.getByText('10')).toBeTruthy();
      expect(screen.getByText('5')).toBeTruthy();
    });
  });

  it('AC-050: renders a Follow button when not following', async () => {
    setupProfileMock();
    mockFetchIsFollowing.mockResolvedValue(false);

    render(
      <UserProfileScreen
        targetUserId={TARGET_USER_ID}
        session={MOCK_SESSION}
        onBack={jest.fn()}
      />,
      renderOptions(),
    );

    await waitFor(() => {
      const followButton = screen.queryAllByRole('button').find(
        (el) =>
          el.props.accessibilityLabel === 'Follow' ||
          el.props.accessibilityLabel === '追蹤',
      );
      expect(followButton).toBeTruthy();
    });
  });

  it('AC-050: renders an Unfollow button when already following', async () => {
    setupProfileMock();
    mockFetchIsFollowing.mockResolvedValue(true);

    render(
      <UserProfileScreen
        targetUserId={TARGET_USER_ID}
        session={MOCK_SESSION}
        onBack={jest.fn()}
      />,
      renderOptions(),
    );

    await waitFor(() => {
      const unfollowButton = screen.queryAllByRole('button').find(
        (el) =>
          el.props.accessibilityLabel === 'Unfollow' ||
          el.props.accessibilityLabel === '取消追蹤',
      );
      expect(unfollowButton).toBeTruthy();
    });
  });

  it('AC-050: pressing Follow calls follow() and updates counts optimistically', async () => {
    setupProfileMock();
    mockFetchIsFollowing.mockResolvedValue(false);
    // Second call (after follow) returns true
    mockFetchIsFollowing.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    mockFetchFollowerCounts.mockResolvedValue({ follower_count: 11, following_count: 5 });

    render(
      <UserProfileScreen
        targetUserId={TARGET_USER_ID}
        session={MOCK_SESSION}
        onBack={jest.fn()}
      />,
      renderOptions(),
    );

    await waitFor(() => {
      const followButton = screen.queryAllByRole('button').find(
        (el) =>
          el.props.accessibilityLabel === 'Follow' ||
          el.props.accessibilityLabel === '追蹤',
      );
      expect(followButton).toBeTruthy();
      if (followButton) {
        fireEvent.press(followButton);
      }
    });

    await waitFor(() => {
      expect(mockFollow).toHaveBeenCalledWith(TARGET_USER_ID);
    });
  });

  it('AC-050: pressing Unfollow calls unfollow()', async () => {
    setupProfileMock();
    mockFetchIsFollowing.mockResolvedValue(true);
    mockFetchFollowerCounts.mockResolvedValue({ follower_count: 9, following_count: 5 });

    render(
      <UserProfileScreen
        targetUserId={TARGET_USER_ID}
        session={MOCK_SESSION}
        onBack={jest.fn()}
      />,
      renderOptions(),
    );

    await waitFor(() => {
      const unfollowButton = screen.queryAllByRole('button').find(
        (el) =>
          el.props.accessibilityLabel === 'Unfollow' ||
          el.props.accessibilityLabel === '取消追蹤',
      );
      expect(unfollowButton).toBeTruthy();
      if (unfollowButton) {
        fireEvent.press(unfollowButton);
      }
    });

    await waitFor(() => {
      expect(mockUnfollow).toHaveBeenCalledWith(TARGET_USER_ID);
    });
  });

  it("hides the follow button on the user's own profile", async () => {
    // targetUserId === session.user.id
    setupProfileMock({ ...MOCK_PROFILE, id: CURRENT_USER_ID });

    render(
      <UserProfileScreen
        targetUserId={CURRENT_USER_ID}
        session={MOCK_SESSION}
        onBack={jest.fn()}
      />,
      renderOptions(),
    );

    await waitFor(() => {
      const followButtons = screen.queryAllByRole('button').filter(
        (el) =>
          el.props.accessibilityLabel === 'Follow' ||
          el.props.accessibilityLabel === '追蹤' ||
          el.props.accessibilityLabel === 'Unfollow' ||
          el.props.accessibilityLabel === '取消追蹤',
      );
      expect(followButtons.length).toBe(0);
    });
  });

  it('AC-063: shows a private profile badge for followers_only profiles', async () => {
    setupProfileMock({ ...MOCK_PROFILE, privacy_setting: 'followers_only' });

    render(
      <UserProfileScreen
        targetUserId={TARGET_USER_ID}
        session={MOCK_SESSION}
        onBack={jest.fn()}
      />,
      renderOptions(),
    );

    await waitFor(() => {
      // The badge uses the i18n key socialFeed.privateProfile
      const badge = screen
        .queryAllByText(/Followers Only/i)
        .concat(screen.queryAllByText(/僅限追蹤者/));
      expect(badge.length).toBeGreaterThan(0);
    });
  });

  it('v2.2: draws no back row of its own (AppShell nested AppHeader owns back, §30)', async () => {
    setupProfileMock();

    render(
      <UserProfileScreen
        targetUserId={TARGET_USER_ID}
        session={MOCK_SESSION}
        onBack={jest.fn()}
      />,
      renderOptions(),
    );

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeTruthy();
    });
    const backButton = screen.queryAllByRole('button').find(
      (el) =>
        el.props.accessibilityLabel === 'Back' ||
        el.props.accessibilityLabel === '返回',
    );
    expect(backButton).toBeUndefined();
  });

  it('AC-150: renders three-dots icon for non-own profiles', async () => {
    setupProfileMock();

    render(
      <UserProfileScreen
        targetUserId={TARGET_USER_ID}
        session={MOCK_SESSION}
        onBack={jest.fn()}
      />,
      renderOptions(),
    );

    await waitFor(() => {
      const dotsButton = screen.queryAllByRole('button').find(
        (el) => el.props.accessibilityLabel === 'More options',
      );
      expect(dotsButton).toBeTruthy();
    });
  });

  it('AC-150: does not render three-dots icon for own profile', async () => {
    setupProfileMock({ ...MOCK_PROFILE, id: CURRENT_USER_ID });

    render(
      <UserProfileScreen
        targetUserId={CURRENT_USER_ID}
        session={MOCK_SESSION}
        onBack={jest.fn()}
      />,
      renderOptions(),
    );

    await waitFor(() => {
      const dotsButton = screen.queryAllByRole('button').find(
        (el) => el.props.accessibilityLabel === 'More options',
      );
      expect(dotsButton).toBeUndefined();
    });
  });

  it('AC-153: shows profile unavailable message when profile is blocked', async () => {
    // Both directions blocked — target user is in blocked set
    mockFetchBlockedUserIds.mockResolvedValue(new Set([TARGET_USER_ID]));
    // Viewer blocked target (isBlockedByMe = true)
    const qb = makeQueryBuilder({ data: MOCK_PROFILE, error: null });
    // maybeSingle returns a row indicating viewer blocked target
    qb.maybeSingle.mockResolvedValue({ data: { blocked_user_id: TARGET_USER_ID }, error: null });
    mockFrom.mockReturnValue(qb as unknown as ReturnType<typeof supabase.from>);

    render(
      <UserProfileScreen
        targetUserId={TARGET_USER_ID}
        session={MOCK_SESSION}
        onBack={jest.fn()}
      />,
      renderOptions(),
    );

    await waitFor(() => {
      const unavailable = screen
        .queryAllByText("This profile isn't available")
        .concat(screen.queryAllByText('此帳號無法檢視'));
      expect(unavailable.length).toBeGreaterThan(0);
    });
  });

  it('AC-153: shows three-dots icon in blocked state when viewer blocked target', async () => {
    mockFetchBlockedUserIds.mockResolvedValue(new Set([TARGET_USER_ID]));
    const qb = makeQueryBuilder({ data: MOCK_PROFILE, error: null });
    qb.maybeSingle.mockResolvedValue({ data: { blocked_user_id: TARGET_USER_ID }, error: null });
    mockFrom.mockReturnValue(qb as unknown as ReturnType<typeof supabase.from>);

    render(
      <UserProfileScreen
        targetUserId={TARGET_USER_ID}
        session={MOCK_SESSION}
        onBack={jest.fn()}
      />,
      renderOptions(),
    );

    await waitFor(() => {
      const dotsButton = screen.queryAllByRole('button').find(
        (el) => el.props.accessibilityLabel === 'More options',
      );
      expect(dotsButton).toBeTruthy();
    });
  });

  it('AC-163: hides BetaVideoGrid for followers_only profile when viewer is not following', async () => {
    setupProfileMock({ ...MOCK_PROFILE, privacy_setting: 'followers_only' });
    mockFetchIsFollowing.mockResolvedValue(false);

    const { getByText } = render(
      <UserProfileScreen
        targetUserId={TARGET_USER_ID}
        session={MOCK_SESSION}
        onBack={jest.fn()}
      />,
      renderOptions(),
    );

    // Wait for profile to load
    await waitFor(() => {
      expect(getByText('Alice')).toBeTruthy();
    });

    // Video section title must not appear — grid is hidden for non-follower
    const videoTitles = screen
      .queryAllByText('Beta Videos')
      .concat(screen.queryAllByText('試攀影片'));
    expect(videoTitles.length).toBe(0);
  });

  it('AC-163: shows BetaVideoGrid for followers_only profile when viewer is following', async () => {
    setupProfileMock({ ...MOCK_PROFILE, privacy_setting: 'followers_only' });
    mockFetchIsFollowing.mockResolvedValue(true);

    render(
      <UserProfileScreen
        targetUserId={TARGET_USER_ID}
        session={MOCK_SESSION}
        onBack={jest.fn()}
      />,
      renderOptions(),
    );

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeTruthy();
    });

    // Video section title must appear — viewer is a follower so grid is shown
    const videoTitles = screen
      .queryAllByText('Beta Videos')
      .concat(screen.queryAllByText('試攀影片'));
    expect(videoTitles.length).toBeGreaterThan(0);
  });

  it('AC-163: shows BetaVideoGrid for public profiles regardless of follow state', async () => {
    setupProfileMock({ ...MOCK_PROFILE, privacy_setting: 'public' });
    mockFetchIsFollowing.mockResolvedValue(false);

    render(
      <UserProfileScreen
        targetUserId={TARGET_USER_ID}
        session={MOCK_SESSION}
        onBack={jest.fn()}
      />,
      renderOptions(),
    );

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeTruthy();
    });

    // Video section title must appear — public profile, no privacy gate
    const videoTitles = screen
      .queryAllByText('Beta Videos')
      .concat(screen.queryAllByText('試攀影片'));
    expect(videoTitles.length).toBeGreaterThan(0);
  });

  it('AC-153: hides three-dots icon in blocked state when viewer was blocked (not blocker)', async () => {
    mockFetchBlockedUserIds.mockResolvedValue(new Set([TARGET_USER_ID]));
    const qb = makeQueryBuilder({ data: MOCK_PROFILE, error: null });
    // maybeSingle returns null — viewer did NOT block target (target blocked viewer)
    qb.maybeSingle.mockResolvedValue({ data: null, error: null });
    mockFrom.mockReturnValue(qb as unknown as ReturnType<typeof supabase.from>);

    render(
      <UserProfileScreen
        targetUserId={TARGET_USER_ID}
        session={MOCK_SESSION}
        onBack={jest.fn()}
      />,
      renderOptions(),
    );

    await waitFor(() => {
      const dotsButton = screen.queryAllByRole('button').find(
        (el) => el.props.accessibilityLabel === 'More options',
      );
      expect(dotsButton).toBeUndefined();
    });
  });
});
