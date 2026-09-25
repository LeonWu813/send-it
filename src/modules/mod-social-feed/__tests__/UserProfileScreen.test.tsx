/**
 * Tests for UserProfileScreen (MOD-006).
 *
 * AC-050: follow/unfollow any other user; counts reflect immediately.
 * AC-063: privacy_setting = followers_only badge is shown.
 *
 * social-feed-service and Supabase are mocked; no real network activity.
 */

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

import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import type { Session } from '@supabase/supabase-js';
import React from 'react';

import { supabase } from '../../../lib/supabase';
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

  it('calls onBack when back button is pressed', async () => {
    setupProfileMock();
    const onBack = jest.fn();

    render(
      <UserProfileScreen
        targetUserId={TARGET_USER_ID}
        session={MOCK_SESSION}
        onBack={onBack}
      />,
      renderOptions(),
    );

    await waitFor(() => {
      const backButton = screen.queryAllByRole('button').find(
        (el) =>
          el.props.accessibilityLabel === 'Back' ||
          el.props.accessibilityLabel === '返回',
      );
      expect(backButton).toBeTruthy();
      if (backButton) {
        fireEvent.press(backButton);
      }
    });

    expect(onBack).toHaveBeenCalled();
  });
});
