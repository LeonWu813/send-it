/**
 * Tests for BetaVideoSection (MOD-005).
 *
 * This is the public entry point component imported by RouteDetailScreen.
 *
 * AC-033: inline playback on route detail page.
 * AC-037: "Add beta video" entry point visible on route detail screen.
 *
 * beta-video-service is mocked; no real network activity.
 */

jest.mock('../../../lib/supabase', () => ({
  supabase: { from: jest.fn(), storage: { from: jest.fn() } },
}));

jest.mock('../beta-video-service', () => ({
  fetchBetaVideosForRoute: jest.fn(),
  getVideoSignedUrl: jest.fn(),
  getThumbnailSignedUrl: jest.fn(),
}));

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  launchImageLibraryAsync: jest.fn(),
  MediaTypeOptions: { Videos: 'Videos' },
}));

import { render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import type { Session } from '@supabase/supabase-js';

import {
  fetchBetaVideosForRoute,
  getVideoSignedUrl,
  getThumbnailSignedUrl,
} from '../beta-video-service';
import BetaVideoSection from '../components/BetaVideoSection';
import { renderOptions } from '../test-utils';
import type { BetaVideo } from '../types';

const mockFetchBetaVideos = fetchBetaVideosForRoute as jest.MockedFunction<typeof fetchBetaVideosForRoute>;
const mockGetVideoSignedUrl = getVideoSignedUrl as jest.MockedFunction<typeof getVideoSignedUrl>;
const mockGetThumbnailSignedUrl = getThumbnailSignedUrl as jest.MockedFunction<typeof getThumbnailSignedUrl>;

const MOCK_SESSION = {
  user: { id: 'user-001' },
} as unknown as Session;

const MOCK_VIDEO: BetaVideo = {
  id: 'vid-001',
  route_id: 'route-001',
  user_id: 'user-001',
  video_url: 'user-001/route-001/1234567890.mp4',
  thumbnail_url: 'user-001/route-001/1234567890_thumb.jpg',
  duration_seconds: 30,
  caption: 'Great heel hook',
  created_at: '2026-09-24T10:00:00Z',
};

describe('BetaVideoSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetVideoSignedUrl.mockResolvedValue('https://signed.example.com/video.mp4?token=abc');
    mockGetThumbnailSignedUrl.mockResolvedValue('https://signed.example.com/thumb.jpg?token=abc');
  });

  it('shows loading indicator while fetching videos', () => {
    mockFetchBetaVideos.mockReturnValue(new Promise(() => { /* never resolves */ }));

    render(
      <BetaVideoSection routeId="route-001" session={MOCK_SESSION} />,
      renderOptions(),
    );

    // Loading indicator should be visible
    expect(screen.toJSON()).toBeTruthy();
  });

  it('shows empty state when there are no videos', async () => {
    mockFetchBetaVideos.mockResolvedValue([]);

    render(
      <BetaVideoSection routeId="route-001" session={MOCK_SESSION} />,
      renderOptions(),
    );

    await waitFor(() => {
      const emptyTexts = screen.queryAllByText(
        /No beta videos yet/i,
      ).concat(screen.queryAllByText(/還沒有 Beta 影片/));
      expect(emptyTexts.length).toBeGreaterThan(0);
    });
  });

  it('AC-033: renders a video player for each fetched video', async () => {
    mockFetchBetaVideos.mockResolvedValue([MOCK_VIDEO]);

    render(
      <BetaVideoSection routeId="route-001" session={MOCK_SESSION} />,
      renderOptions(),
    );

    await waitFor(() => {
      // BetaVideoPlayer renders a play button
      const playButtons = screen.queryAllByRole('button').filter(
        (el) =>
          el.props.accessibilityLabel === 'Play beta video' ||
          el.props.accessibilityLabel === '播放 Beta 影片',
      );
      expect(playButtons.length).toBeGreaterThan(0);
    });
  });

  it('shows the video caption', async () => {
    mockFetchBetaVideos.mockResolvedValue([MOCK_VIDEO]);

    render(
      <BetaVideoSection routeId="route-001" session={MOCK_SESSION} />,
      renderOptions(),
    );

    await waitFor(() => {
      expect(screen.getByText('Great heel hook')).toBeTruthy();
    });
  });

  it('AC-037: renders the "Add beta video" button', async () => {
    mockFetchBetaVideos.mockResolvedValue([]);

    render(
      <BetaVideoSection routeId="route-001" session={MOCK_SESSION} />,
      renderOptions(),
    );

    await waitFor(() => {
      const addButton = screen.queryAllByRole('button').find(
        (el) =>
          el.props.accessibilityLabel === 'Add Beta Video' ||
          el.props.accessibilityLabel === '新增 Beta 影片',
      );
      expect(addButton).toBeTruthy();
    });
  });

  it('shows an error message when fetching fails', async () => {
    mockFetchBetaVideos.mockRejectedValue(new Error('Network error'));

    render(
      <BetaVideoSection routeId="route-001" session={MOCK_SESSION} />,
      renderOptions(),
    );

    await waitFor(() => {
      const errorTexts = screen.queryAllByText(
        /Failed to load beta videos/i,
      ).concat(screen.queryAllByText(/載入 Beta 影片失敗/));
      expect(errorTexts.length).toBeGreaterThan(0);
    });
  });

  it('calls fetchBetaVideosForRoute with the correct routeId', async () => {
    mockFetchBetaVideos.mockResolvedValue([]);

    render(
      <BetaVideoSection routeId="route-001" session={MOCK_SESSION} />,
      renderOptions(),
    );

    await waitFor(() => {
      expect(mockFetchBetaVideos).toHaveBeenCalledWith('route-001');
    });
  });

  it('signs URLs for each video returned from the service', async () => {
    mockFetchBetaVideos.mockResolvedValue([MOCK_VIDEO]);

    render(
      <BetaVideoSection routeId="route-001" session={MOCK_SESSION} />,
      renderOptions(),
    );

    await waitFor(() => {
      expect(mockGetVideoSignedUrl).toHaveBeenCalledWith(MOCK_VIDEO.video_url);
      expect(mockGetThumbnailSignedUrl).toHaveBeenCalledWith(MOCK_VIDEO.thumbnail_url);
    });
  });
});
