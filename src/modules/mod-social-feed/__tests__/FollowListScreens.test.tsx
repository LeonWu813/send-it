/**
 * Tests for FollowersListScreen / FollowingListScreen header wiring (v2.2 §30).
 * The AppShell header is driven through useAppHeader({ title, onBack }).
 */

const mockUseAppHeader = jest.fn();
jest.mock('@/lib/AppHeaderContext', () => ({
  useAppHeader: (cfg: unknown): void => { mockUseAppHeader(cfg); },
  useTabBarInset: () => ({ contentBottom: 0, indicatorBottom: 0 }),
}));

jest.mock('../../mod-moderation', () => ({
  fetchBlockedUserIds: jest.fn(),
}));

jest.mock('../social-feed-service', () => ({
  fetchFollowersList: jest.fn(),
  fetchFollowingList: jest.fn(),
}));

import { render, waitFor, screen } from '@testing-library/react-native';
import React from 'react';

import { fetchBlockedUserIds } from '../../mod-moderation';
import { fetchFollowersList, fetchFollowingList } from '../social-feed-service';
import FollowersListScreen from '../screens/FollowersListScreen';
import FollowingListScreen from '../screens/FollowingListScreen';
import { renderOptions } from '../test-utils';

const USERS = [{ userId: 'u1', displayName: 'Bob', avatarUrl: null }];

describe.each([
  ['FollowersListScreen', FollowersListScreen, 'Followers', fetchFollowersList],
  ['FollowingListScreen', FollowingListScreen, 'Following', fetchFollowingList],
] as const)('%s', (_name, Screen, title, fetcher) => {
  beforeEach(() => {
    jest.clearAllMocks();
    (fetchBlockedUserIds as jest.Mock).mockResolvedValue(new Set<string>());
    (fetcher as jest.Mock).mockResolvedValue(USERS);
  });

  it('registers the AppShell header with its title and onBack', async () => {
    const onBack = jest.fn();
    render(<Screen userId="me" onBack={onBack} onNavigateToUser={jest.fn()} />, renderOptions());

    await waitFor(() => { expect(screen.getByText('Bob')).toBeTruthy(); });
    expect(mockUseAppHeader).toHaveBeenLastCalledWith(expect.objectContaining({ title, onBack }));
    (mockUseAppHeader.mock.calls[0][0] as { onBack: () => void }).onBack();
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
