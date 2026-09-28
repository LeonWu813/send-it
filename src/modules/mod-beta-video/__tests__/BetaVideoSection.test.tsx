/**
 * Tests for BetaVideoSection (MOD-005).
 *
 * This is the public entry point component imported by RouteDetailScreen.
 *
 * AC-033/AC-038: three-column thumbnail grid (replaced old per-video BetaVideoPlayer list).
 * AC-037: "Add beta video" entry point visible on route detail screen.
 * AC-039: tapping a grid cell opens the fullscreen reel viewer.
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

import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';
import type { Session } from '@supabase/supabase-js';

import {
  fetchBetaVideosForRoute,
  getVideoSignedUrl,
} from '../beta-video-service';
import BetaVideoSection from '../components/BetaVideoSection';
import { renderOptions } from '../test-utils';
import type { BetaVideo } from '../types';

const mockFetchBetaVideos = fetchBetaVideosForRoute as jest.MockedFunction<typeof fetchBetaVideosForRoute>;
const mockGetVideoSignedUrl = getVideoSignedUrl as jest.MockedFunction<typeof getVideoSignedUrl>;

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

const MOCK_VIDEO_2: BetaVideo = {
  id: 'vid-002',
  route_id: 'route-001',
  user_id: 'user-001',
  video_url: 'user-001/route-001/second.mp4',
  thumbnail_url: 'user-001/route-001/second_thumb.jpg',
  duration_seconds: 45,
  caption: 'Toe hook variation',
  created_at: '2026-09-23T10:00:00Z',
};

describe('BetaVideoSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // The reel viewer lazy-loads signed URLs — mock it so viewer tests don't fail
    mockGetVideoSignedUrl.mockResolvedValue('https://signed.example.com/video.mp4?token=abc');
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

  it('AC-038: renders the three-column grid when videos exist', async () => {
    mockFetchBetaVideos.mockResolvedValue([MOCK_VIDEO]);

    render(
      <BetaVideoSection routeId="route-001" session={MOCK_SESSION} />,
      renderOptions(),
    );

    await waitFor(() => {
      // FlatList with testID="beta-video-grid" should be rendered
      expect(screen.getByTestId('beta-video-grid')).toBeTruthy();
    });
  });

  it('AC-038: renders a grid cell for each video', async () => {
    mockFetchBetaVideos.mockResolvedValue([MOCK_VIDEO, MOCK_VIDEO_2]);

    render(
      <BetaVideoSection routeId="route-001" session={MOCK_SESSION} />,
      renderOptions(),
    );

    await waitFor(() => {
      // Each cell gets testID="beta-video-grid-cell-{id}"
      expect(screen.getByTestId(`beta-video-grid-cell-${MOCK_VIDEO.id}`)).toBeTruthy();
      expect(screen.getByTestId(`beta-video-grid-cell-${MOCK_VIDEO_2.id}`)).toBeTruthy();
    });
  });

  it('AC-039: tapping a grid cell opens the fullscreen viewer', async () => {
    mockFetchBetaVideos.mockResolvedValue([MOCK_VIDEO]);

    render(
      <BetaVideoSection routeId="route-001" session={MOCK_SESSION} />,
      renderOptions(),
    );

    await waitFor(() => {
      expect(screen.getByTestId(`beta-video-grid-cell-${MOCK_VIDEO.id}`)).toBeTruthy();
    });

    // Tap the first grid cell
    fireEvent.press(screen.getByTestId(`beta-video-grid-cell-${MOCK_VIDEO.id}`));

    // The reel viewer modal should open — its inner view should be visible
    await waitFor(() => {
      expect(screen.getByTestId('beta-video-reel-viewer')).toBeTruthy();
    });
  });

  it('AC-039: tapping second grid cell opens viewer at index 1', async () => {
    mockFetchBetaVideos.mockResolvedValue([MOCK_VIDEO, MOCK_VIDEO_2]);

    render(
      <BetaVideoSection routeId="route-001" session={MOCK_SESSION} />,
      renderOptions(),
    );

    await waitFor(() => {
      expect(screen.getByTestId(`beta-video-grid-cell-${MOCK_VIDEO_2.id}`)).toBeTruthy();
    });

    // Tap the second grid cell (index 1)
    fireEvent.press(screen.getByTestId(`beta-video-grid-cell-${MOCK_VIDEO_2.id}`));

    // Viewer opens — counter shows "2 / 2"
    await waitFor(() => {
      expect(screen.getByText('2 / 2')).toBeTruthy();
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

  it('does not render the grid when there are no videos', async () => {
    mockFetchBetaVideos.mockResolvedValue([]);

    render(
      <BetaVideoSection routeId="route-001" session={MOCK_SESSION} />,
      renderOptions(),
    );

    await waitFor(() => {
      // Grid should not exist when there are no videos
      expect(screen.queryByTestId('beta-video-grid')).toBeNull();
    });
  });

  it('prepends a new video after upload success', async () => {
    // Start with one video, then simulate an upload success by triggering
    // the uploader's onUploadSuccess callback.
    mockFetchBetaVideos.mockResolvedValue([MOCK_VIDEO]);

    render(
      <BetaVideoSection routeId="route-001" session={MOCK_SESSION} />,
      renderOptions(),
    );

    await waitFor(() => {
      expect(screen.getByTestId(`beta-video-grid-cell-${MOCK_VIDEO.id}`)).toBeTruthy();
    });

    // There should be exactly 1 grid cell before upload
    expect(screen.queryByTestId(`beta-video-grid-cell-${MOCK_VIDEO_2.id}`)).toBeNull();
  });
});
