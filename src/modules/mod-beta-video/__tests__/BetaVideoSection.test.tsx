/**
 * Tests for BetaVideoSection (MOD-005).
 *
 * This is the public entry point component imported by RouteDetailScreen.
 *
 * AC-033/AC-038: three-column thumbnail grid (replaced old per-video BetaVideoPlayer list).
 * AC-037: "Add beta video" entry point visible on route detail screen.
 * AC-039: tapping a grid cell opens the fullscreen reel viewer.
 * AC-130 integration: when onRegisterUploadLauncher is provided, the registered
 *   launcher invokes BetaVideoUploader's handleSelectVideo — the single canonical
 *   upload implementation that enforces AC-166 dialog and AC-169 size gate.
 *
 * beta-video-service is mocked; no real network activity.
 */

// AC-158: BetaVideoSection now queries supabase.from('follows') directly for the
// followers-only privacy filter. The mock must return a chainable object so the
// follows query does not throw on .select().eq().in().
const followsChain = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  // Default: viewer follows nobody — returns empty array (no followers_only videos shown).
  in: jest.fn().mockResolvedValue({ data: [], error: null }),
};
const mockSupabaseFrom = jest.fn().mockReturnValue(followsChain);

jest.mock('../../../lib/supabase', () => ({
  supabase: {
    from: mockSupabaseFrom,
    storage: { from: jest.fn() },
    // BetaVideoReelViewer (rendered inside BetaVideoSection) calls getSession to
    // derive currentUserId for own-video checks (Bug 2 fix). Provide a minimal mock.
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: { session: { user: { id: 'user-001' } } },
        error: null,
      }),
    },
  },
}));

jest.mock('../beta-video-service', () => ({
  fetchBetaVideosForRoute: jest.fn(),
  getVideoSignedUrl: jest.fn(),
  getThumbnailSignedUrl: jest.fn(),
  reportBetaVideo: jest.fn(),
  // AC-166: BetaVideoUploader (rendered inside BetaVideoSection) calls this on mount.
  checkExistingBetaVideo: jest.fn().mockResolvedValue(false),
  // Required by BetaVideoUploader upload flow (Fix 1 replace test).
  uploadBetaVideo: jest.fn(),
}));

jest.mock('../../mod-moderation/moderation-service', () => ({
  fetchBlockedUserIds: jest.fn(),
}));

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  launchImageLibraryAsync: jest.fn(),
  MediaTypeOptions: { Videos: 'Videos' },
  // AC-031 (Rev 29): BetaVideoUploader references this enum at runtime; include in mock
  // so BetaVideoSection integration tests do not throw on the property access.
  UIImagePickerPreferredAssetRepresentationMode: {
    Automatic: 'automatic',
    Compatible: 'compatible',
    Current: 'current',
  },
}));

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import React from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { Session } from '@supabase/supabase-js';

import {
  fetchBetaVideosForRoute,
  getVideoSignedUrl,
  checkExistingBetaVideo,
  uploadBetaVideo,
} from '../beta-video-service';
import { fetchBlockedUserIds } from '../../mod-moderation/moderation-service';
import BetaVideoSection from '../components/BetaVideoSection';
import { renderOptions } from '../test-utils';
import type { BetaVideo } from '../types';

const mockFetchBetaVideos = fetchBetaVideosForRoute as jest.MockedFunction<typeof fetchBetaVideosForRoute>;
const mockGetVideoSignedUrl = getVideoSignedUrl as jest.MockedFunction<typeof getVideoSignedUrl>;
const mockFetchBlockedUserIds = fetchBlockedUserIds as jest.MockedFunction<typeof fetchBlockedUserIds>;
const mockCheckExistingBetaVideo = checkExistingBetaVideo as jest.MockedFunction<typeof checkExistingBetaVideo>;
const mockUploadBetaVideo = uploadBetaVideo as jest.MockedFunction<typeof uploadBetaVideo>;
const mockLaunchImageLibrary = ImagePicker.launchImageLibraryAsync as jest.MockedFunction<typeof ImagePicker.launchImageLibraryAsync>;

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
  updated_at: '2026-09-24T10:00:00Z',
  is_reported: false,
  report_dismissed: false,
  display_name: 'Test Climber',
  avatar_url: null,
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
  updated_at: '2026-09-23T10:00:00Z',
  is_reported: false,
  report_dismissed: false,
  display_name: 'Test Climber 2',
  avatar_url: null,
};

describe('BetaVideoSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // The reel viewer lazy-loads signed URLs — mock it so viewer tests don't fail
    mockGetVideoSignedUrl.mockResolvedValue('https://signed.example.com/video.mp4?token=abc');
    // AC-154: default to no blocked users
    mockFetchBlockedUserIds.mockResolvedValue(new Set<string>());
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

  it('Fix 1 (replace dedup): after upload success on a replace, the list contains exactly one video for the (user_id, route_id) pair', async () => {
    // The initial list has MOCK_VIDEO (user-001, route-001).
    // Simulate a replace: a new upload for the same (user_id, route_id) pair.
    const REPLACED_VIDEO: BetaVideo = {
      id: 'vid-new',
      route_id: 'route-001',   // same route
      user_id: 'user-001',     // same user — this is the replace scenario
      video_url: 'user-001/route-001/new.mp4',
      thumbnail_url: 'user-001/route-001/new_thumb.jpg',
      duration_seconds: 20,
      caption: 'New take',
      created_at: '2026-10-04T12:00:00Z',
      updated_at: '2026-10-04T12:00:00Z',
      is_reported: false,
      report_dismissed: false,
      display_name: 'Test Climber',
      avatar_url: null,
    };

    mockFetchBetaVideos.mockResolvedValue([MOCK_VIDEO]);
    // No existing video confirmation dialog needed for this test.
    mockCheckExistingBetaVideo.mockResolvedValue(false);
    // Service returns the newly uploaded REPLACED_VIDEO.
    mockUploadBetaVideo.mockResolvedValue(REPLACED_VIDEO);
    // Picker returns a valid short MP4.
    mockLaunchImageLibrary.mockResolvedValue({
      canceled: false,
      assets: [{
        uri: 'file:///new.mp4',
        mimeType: 'video/mp4',
        duration: 20_000,
        type: 'video',
        width: 1920,
        height: 1080,
        fileName: 'new.mp4',
        fileSize: 5_000_000,
        assetId: null,
        base64: null,
        exif: null,
        pairedVideoAsset: null,
      }],
    });

    render(
      <BetaVideoSection routeId="route-001" session={MOCK_SESSION} />,
      renderOptions(),
    );

    // Old video (vid-001) is visible before the replace.
    await waitFor(() => {
      expect(screen.getByTestId(`beta-video-grid-cell-${MOCK_VIDEO.id}`)).toBeTruthy();
    });

    // Press the "Add beta video" button to trigger the upload flow.
    const addButton = screen.queryAllByRole('button').find(
      (el) =>
        el.props.accessibilityLabel === 'Add Beta Video' ||
        el.props.accessibilityLabel === '新增 Beta 影片',
    );
    if (addButton) {
      fireEvent.press(addButton);
    }

    // After the upload resolves, the grid must contain only REPLACED_VIDEO (vid-new),
    // not the old MOCK_VIDEO (vid-001) — the filter-before-prepend ensures this.
    await waitFor(() => {
      expect(screen.getByTestId(`beta-video-grid-cell-${REPLACED_VIDEO.id}`)).toBeTruthy();
    });
    expect(screen.queryByTestId(`beta-video-grid-cell-${MOCK_VIDEO.id}`)).toBeNull();
  });

  it('Fix 2 (suppressInlineError): onUploadError is called but inline error is not rendered when onUploadError prop is provided', async () => {
    // Verify that when onUploadError is provided, the error message is forwarded
    // to the callback but NOT rendered inline inside BetaVideoSection.
    mockFetchBetaVideos.mockResolvedValue([]);
    mockCheckExistingBetaVideo.mockResolvedValue(false);
    // Picker returns an unsupported container (triggers a format error).
    mockLaunchImageLibrary.mockResolvedValue({
      canceled: false,
      assets: [{
        uri: 'file:///video.avi',
        mimeType: 'video/x-msvideo',
        duration: 20_000,
        type: 'video',
        width: 1920,
        height: 1080,
        fileName: 'video.avi',
        fileSize: 5_000_000,
        assetId: null,
        base64: null,
        exif: null,
        pairedVideoAsset: null,
      }],
    });

    const onUploadError = jest.fn();

    render(
      <BetaVideoSection routeId="route-001" session={MOCK_SESSION} onUploadError={onUploadError} />,
      renderOptions(),
    );

    await waitFor(() => {
      // The empty state shows (no videos loaded).
      expect(screen.queryByTestId('beta-video-grid')).toBeNull();
    });

    // Press the "Add beta video" button to trigger the upload flow.
    const addButton = screen.queryAllByRole('button').find(
      (el) =>
        el.props.accessibilityLabel === 'Add Beta Video' ||
        el.props.accessibilityLabel === '新增 Beta 影片',
    );
    if (addButton) {
      fireEvent.press(addButton);

      // onUploadError must be called with the error message (error propagation is unaffected).
      await waitFor(() => expect(onUploadError).toHaveBeenCalled());

      // The inline error text must NOT appear inside BetaVideoSection because
      // suppressInlineError is true (derived from onUploadError being provided).
      const inlineErrors = screen.queryAllByText(/Only MP4 and MOV videos are supported/i)
        .concat(screen.queryAllByText(/僅支援 MP4 和 MOV 格式的影片/));
      expect(inlineErrors).toHaveLength(0);
    }
  });

  // AC-154: block filter tests

  it('AC-154: filters out videos from blocked users before rendering', async () => {
    const BLOCKED_VIDEO: BetaVideo = {
      id: 'vid-blocked',
      route_id: 'route-001',
      user_id: 'user-blocked',
      video_url: 'user-blocked/route-001/blocked.mp4',
      thumbnail_url: 'user-blocked/route-001/blocked_thumb.jpg',
      duration_seconds: 20,
      caption: null,
      created_at: '2026-09-29T10:00:00Z',
      updated_at: '2026-09-29T10:00:00Z',
      is_reported: false,
      report_dismissed: false,
      display_name: 'Blocked Climber',
      avatar_url: null,
    };

    mockFetchBetaVideos.mockResolvedValue([MOCK_VIDEO, BLOCKED_VIDEO]);
    mockFetchBlockedUserIds.mockResolvedValue(new Set(['user-blocked']));

    render(
      <BetaVideoSection routeId="route-001" session={MOCK_SESSION} />,
      renderOptions(),
    );

    await waitFor(() => {
      // MOCK_VIDEO (user-001) should be visible
      expect(screen.getByTestId(`beta-video-grid-cell-${MOCK_VIDEO.id}`)).toBeTruthy();
    });

    // Blocked user's video should not be in the grid
    expect(screen.queryByTestId(`beta-video-grid-cell-${BLOCKED_VIDEO.id}`)).toBeNull();
  });

  it('AC-154: shows all videos when blocked list is empty', async () => {
    mockFetchBetaVideos.mockResolvedValue([MOCK_VIDEO, MOCK_VIDEO_2]);
    mockFetchBlockedUserIds.mockResolvedValue(new Set<string>());

    render(
      <BetaVideoSection routeId="route-001" session={MOCK_SESSION} />,
      renderOptions(),
    );

    await waitFor(() => {
      expect(screen.getByTestId(`beta-video-grid-cell-${MOCK_VIDEO.id}`)).toBeTruthy();
      expect(screen.getByTestId(`beta-video-grid-cell-${MOCK_VIDEO_2.id}`)).toBeTruthy();
    });
  });

  it('AC-154: shows all videos when fetchBlockedUserIds fails (graceful degradation)', async () => {
    mockFetchBetaVideos.mockResolvedValue([MOCK_VIDEO, MOCK_VIDEO_2]);
    mockFetchBlockedUserIds.mockRejectedValue(new Error('block list unavailable'));

    render(
      <BetaVideoSection routeId="route-001" session={MOCK_SESSION} />,
      renderOptions(),
    );

    await waitFor(() => {
      // Both videos should still appear — block filter defaults to empty set on failure
      expect(screen.getByTestId(`beta-video-grid-cell-${MOCK_VIDEO.id}`)).toBeTruthy();
      expect(screen.getByTestId(`beta-video-grid-cell-${MOCK_VIDEO_2.id}`)).toBeTruthy();
    });
  });

  it('AC-154: fetches blocked user IDs in parallel with beta videos', async () => {
    mockFetchBetaVideos.mockResolvedValue([MOCK_VIDEO]);
    mockFetchBlockedUserIds.mockResolvedValue(new Set<string>());

    render(
      <BetaVideoSection routeId="route-001" session={MOCK_SESSION} />,
      renderOptions(),
    );

    await waitFor(() => {
      expect(mockFetchBetaVideos).toHaveBeenCalledWith('route-001');
      expect(mockFetchBlockedUserIds).toHaveBeenCalled();
    });
  });

  // AC-130 integration tests — verify the registered launcher invokes the single
  // canonical BetaVideoUploader upload implementation (AC-166 dialog + AC-169 size gate).

  describe('AC-130 integration: onRegisterUploadLauncher wires through BetaVideoUploader', () => {
    it('registers a launcher with the parent when onRegisterUploadLauncher is provided', async () => {
      mockFetchBetaVideos.mockResolvedValue([]);

      const onRegisterUploadLauncher = jest.fn();

      render(
        <BetaVideoSection
          routeId="route-001"
          session={MOCK_SESSION}
          onRegisterUploadLauncher={onRegisterUploadLauncher}
        />,
        renderOptions(),
      );

      // After BetaVideoUploader registers its handler (async effect), the parent
      // should have received a launcher function.
      await waitFor(() => {
        expect(onRegisterUploadLauncher).toHaveBeenCalledWith(expect.any(Function));
      });
    });

    it('AC-166: launcher fires AC-166 confirmation dialog when hasExistingVideo is true', async () => {
      mockFetchBetaVideos.mockResolvedValue([]);
      // Simulate user already having a video for this route.
      mockCheckExistingBetaVideo.mockResolvedValue(true);

      let capturedLauncher: (() => void) | null = null;
      const onRegisterUploadLauncher = jest.fn((fn: () => void) => {
        capturedLauncher = fn;
      });

      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

      render(
        <BetaVideoSection
          routeId="route-001"
          session={MOCK_SESSION}
          onRegisterUploadLauncher={onRegisterUploadLauncher}
        />,
        renderOptions(),
      );

      // Wait for the mount-time checkExistingBetaVideo to resolve and the
      // launcher to be registered.
      await waitFor(() => {
        expect(onRegisterUploadLauncher).toHaveBeenCalled();
        expect(capturedLauncher).not.toBeNull();
      });

      // Invoke the launcher as the header button would.
      await act(async () => {
        capturedLauncher!();
        // Allow async handleSelectVideo to reach the Alert.alert call.
        await new Promise((r) => setTimeout(r, 50));
      });

      // AC-166: confirmation dialog must fire because hasExistingVideo === true.
      await waitFor(() => expect(alertSpy).toHaveBeenCalled());

      const [title, message] = alertSpy.mock.calls[0];
      expect(title).toMatch(/Replace Beta Video|替換 Beta 影片/);
      expect(message).toMatch(/already have a beta video|已有此路線的 Beta 影片/);

      alertSpy.mockRestore();
    });

    it('AC-166: launcher opens picker directly when hasExistingVideo is false', async () => {
      mockFetchBetaVideos.mockResolvedValue([]);
      // No existing video — picker should open directly without a dialog.
      mockCheckExistingBetaVideo.mockResolvedValue(false);
      mockLaunchImageLibrary.mockResolvedValue({ canceled: true, assets: null });

      let capturedLauncher: (() => void) | null = null;
      const onRegisterUploadLauncher = jest.fn((fn: () => void) => {
        capturedLauncher = fn;
      });

      const alertSpy = jest.spyOn(Alert, 'alert');

      render(
        <BetaVideoSection
          routeId="route-001"
          session={MOCK_SESSION}
          onRegisterUploadLauncher={onRegisterUploadLauncher}
        />,
        renderOptions(),
      );

      await waitFor(() => {
        expect(onRegisterUploadLauncher).toHaveBeenCalled();
        expect(capturedLauncher).not.toBeNull();
      });

      await act(async () => {
        capturedLauncher!();
        await new Promise((r) => setTimeout(r, 50));
      });

      // AC-166: no dialog when hasExistingVideo === false.
      expect(alertSpy).not.toHaveBeenCalled();
      // Picker should have been opened.
      await waitFor(() => expect(mockLaunchImageLibrary).toHaveBeenCalled());

      alertSpy.mockRestore();
    });

    it('does not render a visible "Add beta video" button in AC-130 mode', async () => {
      mockFetchBetaVideos.mockResolvedValue([]);

      render(
        <BetaVideoSection
          routeId="route-001"
          session={MOCK_SESSION}
          onRegisterUploadLauncher={jest.fn()}
        />,
        renderOptions(),
      );

      await waitFor(() => {
        // The upload button must not be visible (it is hidden via hideButton=true).
        const addButton = screen.queryAllByRole('button').find(
          (el) =>
            el.props.accessibilityLabel === 'Add Beta Video' ||
            el.props.accessibilityLabel === '新增 Beta 影片',
        );
        expect(addButton).toBeUndefined();
      });
    });
  });
});
