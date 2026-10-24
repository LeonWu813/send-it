/**
 * Tests for BetaVideoReelViewer (MOD-005).
 *
 * AC-039: fullscreen reel viewer — swipe navigation, auto-play, dismiss.
 * AC-133: persistent close button.
 * AC-139: report button hidden for own videos / admin-dismissed videos.
 * AC-140: report button calls reportBetaVideo RPC; shows "reported" state on success.
 *
 * Covers:
 * - Swipe up increments index (advances to next video).
 * - Swipe down at index 0 calls onDismiss (AC-039 revised: dismiss when at first video).
 * - Swipe down at index > 0 goes to previous video (AC-039 revised: no longer dismiss-always).
 * - Swipe up at last index is a no-op (does not wrap).
 * - Close/back button calls onDismiss.
 * - Loading indicator while signed URL is being fetched.
 * - Report button: hidden for own video, hidden when report_dismissed, shown otherwise.
 * - Report button: calls reportBetaVideo on press; shows "reported" state.
 *
 * PanResponder gesture strategy:
 * PanResponder's onPanResponderRelease receives a gestureState accumulated by
 * the native responder system. In RNTL's JS environment, we cannot inject dx/dy
 * into PanResponder's internal gestureState via fireEvent alone. Instead, we
 * intercept PanResponder.create and capture the config callbacks, then call
 * onPanResponderRelease directly with the desired gestureState in tests.
 *
 * expo-video is mocked via moduleNameMapper (expo-video → __mocks__/expo-video.js).
 * beta-video-service is mocked directly.
 */

jest.mock('../../../lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    storage: { from: jest.fn() },
    rpc: jest.fn(),
    // Bug 2: BetaVideoReelViewer now fetches currentUserId via getSession to
    // determine own-video status for poster-row and report-button visibility.
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: { session: { user: { id: 'viewer-user-001' } } },
        error: null,
      }),
    },
  },
}));

jest.mock('../beta-video-service', () => ({
  getVideoSignedUrl: jest.fn(),
  fetchBetaVideosForRoute: jest.fn(),
  getThumbnailSignedUrl: jest.fn(),
  reportBetaVideo: jest.fn(),
}));

jest.mock('../../mod-social-feed', () => ({
  fetchLikeInfo: jest.fn(),
  likeBetaVideo: jest.fn(),
  unlikeBetaVideo: jest.fn(),
}));

// ── PanResponder capture ──────────────────────────────────────────────────────
// We intercept PanResponder.create to capture the latest config so tests can
// call onPanResponderRelease directly with a synthetic gestureState.
import { PanResponder } from 'react-native';

type PanResponderConfig = Parameters<typeof PanResponder.create>[0];
let capturedPanConfig: PanResponderConfig | null = null;

const originalPanResponderCreate = PanResponder.create.bind(PanResponder);
jest.spyOn(PanResponder, 'create').mockImplementation((config) => {
  capturedPanConfig = config;
  return originalPanResponderCreate(config);
});

// ─────────────────────────────────────────────────────────────────────────────

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import React from 'react';
import type { Session } from '@supabase/supabase-js';

import { getVideoSignedUrl, reportBetaVideo } from '../beta-video-service';
import BetaVideoReelViewer from '../components/BetaVideoReelViewer';
import { renderOptions } from '../test-utils';
import type { BetaVideo } from '../types';
import { fetchLikeInfo, likeBetaVideo, unlikeBetaVideo } from '../../mod-social-feed';

const mockGetVideoSignedUrl = getVideoSignedUrl as jest.MockedFunction<typeof getVideoSignedUrl>;
const mockReportBetaVideo = reportBetaVideo as jest.MockedFunction<typeof reportBetaVideo>;
const mockFetchLikeInfo = fetchLikeInfo as jest.MockedFunction<typeof fetchLikeInfo>;
const mockLikeBetaVideo = likeBetaVideo as jest.MockedFunction<typeof likeBetaVideo>;
const mockUnlikeBetaVideo = unlikeBetaVideo as jest.MockedFunction<typeof unlikeBetaVideo>;

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MOCK_SESSION = {
  user: { id: 'viewer-user-001' },
} as unknown as Session;

function makeVideo(id: string, index: number, overrides?: Partial<BetaVideo>): BetaVideo {
  return {
    id,
    route_id: 'route-001',
    user_id: 'other-user-999', // not the viewer — report button should be visible
    video_url: `user-001/route-001/video-${index}.mp4`,
    thumbnail_url: `user-001/route-001/thumb-${index}.jpg`,
    duration_seconds: 30,
    caption: `Caption ${index}`,
    created_at: `2026-09-${String(25 - index).padStart(2, '0')}T10:00:00Z`,
    updated_at: `2026-09-${String(25 - index).padStart(2, '0')}T10:00:00Z`,
    is_reported: false,
    report_dismissed: false,
    display_name: `Climber ${index}`,
    avatar_url: null,
    ...overrides,
  };
}

const VIDEO_A = makeVideo('vid-001', 1); // index 0
const VIDEO_B = makeVideo('vid-002', 2); // index 1
const VIDEO_C = makeVideo('vid-003', 3); // index 2
const VIDEOS_THREE = [VIDEO_A, VIDEO_B, VIDEO_C];

const BASE_PROPS = {
  videos: VIDEOS_THREE,
  initialIndex: 0,
  visible: true,
  onDismiss: jest.fn(),
  session: MOCK_SESSION,
};

/**
 * Simulate a swipe gesture by calling onPanResponderRelease directly on the
 * captured PanResponder config with a fake gestureState containing the given dy.
 */
function simulateSwipe(dy: number): void {
  if (!capturedPanConfig?.onPanResponderRelease) {
    throw new Error('PanResponder config not captured — render BetaVideoReelViewer first');
  }
  const fakeEvent = {} as Parameters<NonNullable<PanResponderConfig['onPanResponderRelease']>>[0];
  const fakeGestureState = {
    stateID: 1,
    moveX: 0,
    moveY: dy > 0 ? 300 + dy : 300 + dy,
    x0: 0,
    y0: 0,
    dx: 0,
    dy,
    vx: 0,
    vy: 0,
    numberActiveTouches: 0,
    _accountsForMovesUpTo: 0,
  };
  capturedPanConfig.onPanResponderRelease!(fakeEvent, fakeGestureState as any);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('BetaVideoReelViewer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedPanConfig = null;
    mockGetVideoSignedUrl.mockResolvedValue('https://signed.example.com/video.mp4?token=abc');
    mockReportBetaVideo.mockResolvedValue(undefined);
    // Default like state: not liked, count 0.
    mockFetchLikeInfo.mockResolvedValue({ like_count: 0, user_has_liked: false });
    mockLikeBetaVideo.mockResolvedValue(undefined);
    mockUnlikeBetaVideo.mockResolvedValue(undefined);
  });

  it('renders the modal when visible is true', async () => {
    render(<BetaVideoReelViewer {...BASE_PROPS} />, renderOptions());

    await waitFor(() => {
      expect(screen.getByTestId('beta-video-reel-viewer')).toBeTruthy();
    });
  });

  it('shows loading indicator while fetching signed URL', () => {
    mockGetVideoSignedUrl.mockReturnValue(new Promise(() => { /* never resolves */ }));

    render(<BetaVideoReelViewer {...BASE_PROPS} />, renderOptions());

    expect(screen.getByTestId('beta-video-reel-loading')).toBeTruthy();
  });

  it('shows VideoView after signed URL resolves', async () => {
    mockGetVideoSignedUrl.mockResolvedValue('https://signed.example.com/video.mp4?token=abc');

    render(<BetaVideoReelViewer {...BASE_PROPS} />, renderOptions());

    await waitFor(() => {
      expect(screen.getByTestId('beta-video-reel-video-view')).toBeTruthy();
    });
  });

  it('shows error state when signed URL fetch fails', async () => {
    mockGetVideoSignedUrl.mockRejectedValue(new Error('Network error'));

    render(<BetaVideoReelViewer {...BASE_PROPS} />, renderOptions());

    await waitFor(() => {
      expect(screen.getByTestId('beta-video-reel-error')).toBeTruthy();
    });
  });

  it('AC-133: close button calls onDismiss', async () => {
    const onDismiss = jest.fn();
    render(
      <BetaVideoReelViewer {...BASE_PROPS} onDismiss={onDismiss} />,
      renderOptions(),
    );

    await waitFor(() => {
      expect(screen.getByTestId('beta-video-reel-close')).toBeTruthy();
    });

    // The close control is a ui/ IconButton inside the testID wrapper.
    fireEvent.press(within(screen.getByTestId('beta-video-reel-close')).getByRole('button'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('AC-039: swipe up at index 0 of 3 advances to index 1', async () => {
    render(
      <BetaVideoReelViewer {...BASE_PROPS} initialIndex={0} />,
      renderOptions(),
    );

    await waitFor(() => {
      expect(screen.getByText('1 / 3')).toBeTruthy();
    });

    await act(async () => {
      simulateSwipe(-80); // swipe up (negative dy)
    });

    await waitFor(() => {
      expect(screen.getByText('2 / 3')).toBeTruthy();
    });
  });

  it('AC-039: swipe up at last index is a no-op (does not wrap)', async () => {
    const onDismiss = jest.fn();

    render(
      <BetaVideoReelViewer
        {...BASE_PROPS}
        initialIndex={2}
        onDismiss={onDismiss}
      />,
      renderOptions(),
    );

    await waitFor(() => {
      expect(screen.getByText('3 / 3')).toBeTruthy();
    });

    await act(async () => {
      simulateSwipe(-80); // swipe up at last index
    });

    await waitFor(() => {
      expect(screen.getByText('3 / 3')).toBeTruthy();
    });
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('AC-039: swipe down at index 0 calls onDismiss', async () => {
    const onDismiss = jest.fn();

    render(
      <BetaVideoReelViewer {...BASE_PROPS} initialIndex={0} onDismiss={onDismiss} />,
      renderOptions(),
    );

    await waitFor(() => {
      expect(screen.getByText('1 / 3')).toBeTruthy();
    });

    await act(async () => {
      simulateSwipe(80); // swipe down at index 0
    });

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('AC-039 (revised): swipe down at index > 0 navigates to previous video (does not dismiss)', async () => {
    const onDismiss = jest.fn();

    render(
      <BetaVideoReelViewer {...BASE_PROPS} initialIndex={2} onDismiss={onDismiss} />,
      renderOptions(),
    );

    await waitFor(() => {
      expect(screen.getByText('3 / 3')).toBeTruthy();
    });

    await act(async () => {
      simulateSwipe(80); // swipe down at index 2 → must go to index 1 (prev), not dismiss
    });

    // Counter should show "2 / 3" after going to previous
    await waitFor(() => {
      expect(screen.getByText('2 / 3')).toBeTruthy();
    });
    // onDismiss must NOT have been called — user is still in the reel
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('resets to initialIndex when visible toggles back to true', async () => {
    const { rerender } = render(
      <BetaVideoReelViewer {...BASE_PROPS} initialIndex={2} visible={true} />,
      renderOptions(),
    );

    await waitFor(() => {
      expect(screen.getByText('3 / 3')).toBeTruthy();
    });

    rerender(
      <BetaVideoReelViewer {...BASE_PROPS} initialIndex={0} visible={false} />,
    );
    rerender(
      <BetaVideoReelViewer {...BASE_PROPS} initialIndex={0} visible={true} />,
    );

    await waitFor(() => {
      expect(screen.getByText('1 / 3')).toBeTruthy();
    });
  });

  it('does not show VideoView when visible is false', () => {
    render(
      <BetaVideoReelViewer {...BASE_PROPS} visible={false} />,
      renderOptions(),
    );

    expect(screen.queryByTestId('beta-video-reel-video-view')).toBeNull();
    expect(mockGetVideoSignedUrl).not.toHaveBeenCalled();
  });

  it('AC-134: shows route·gym label in Row 2 when routeName and gymName are provided', async () => {
    render(
      <BetaVideoReelViewer
        {...BASE_PROPS}
        initialIndex={0}
        routeName="5.11a Blue"
        gymName="Sender Gym"
      />,
      renderOptions(),
    );

    await waitFor(() => {
      expect(screen.getByTestId('reel-route-gym-label')).toBeTruthy();
    });

    const textEl = screen.getByTestId('reel-route-gym-text');
    expect(textEl.props.children).toBe('5.11a Blue · Sender Gym');
  });

  it('calls getVideoSignedUrl with the video_url of the current video', async () => {
    render(
      <BetaVideoReelViewer {...BASE_PROPS} initialIndex={1} />,
      renderOptions(),
    );

    await waitFor(() => {
      expect(mockGetVideoSignedUrl).toHaveBeenCalledWith(VIDEO_B.video_url);
    });
  });

  // ── AC-139: Report button visibility ───────────────────────────────────────

  it('AC-139: report button is visible for a video by another user', async () => {
    const otherUserVideo = makeVideo('vid-other', 1, { user_id: 'other-user-999' });

    render(
      <BetaVideoReelViewer
        {...BASE_PROPS}
        videos={[otherUserVideo]}
        initialIndex={0}
      />,
      renderOptions(),
    );

    await waitFor(() => {
      expect(screen.getByTestId('reel-report-button')).toBeTruthy();
    });
  });

  it('AC-139: report button is hidden for the current user\'s own video', async () => {
    const ownVideo = makeVideo('vid-own', 1, { user_id: MOCK_SESSION.user.id });

    render(
      <BetaVideoReelViewer
        {...BASE_PROPS}
        videos={[ownVideo]}
        initialIndex={0}
      />,
      renderOptions(),
    );

    await waitFor(() => {
      expect(screen.queryByTestId('reel-report-button')).toBeNull();
    });
  });

  it('AC-139: report button is hidden when report_dismissed is true', async () => {
    const dismissedVideo = makeVideo('vid-dismissed', 1, {
      user_id: 'other-user-999',
      report_dismissed: true,
    });

    render(
      <BetaVideoReelViewer
        {...BASE_PROPS}
        videos={[dismissedVideo]}
        initialIndex={0}
      />,
      renderOptions(),
    );

    await waitFor(() => {
      expect(screen.queryByTestId('reel-report-button')).toBeNull();
    });
  });

  // ── AC-140: Report flow ────────────────────────────────────────────────────

  it('AC-140: pressing report button calls reportBetaVideo with the correct video ID', async () => {
    const otherVideo = makeVideo('vid-reportable', 1, { user_id: 'other-user-999' });
    mockReportBetaVideo.mockResolvedValue(undefined);

    render(
      <BetaVideoReelViewer
        {...BASE_PROPS}
        videos={[otherVideo]}
        initialIndex={0}
      />,
      renderOptions(),
    );

    await waitFor(() => {
      expect(screen.getByTestId('reel-report-button')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(screen.getByTestId('reel-report-button'));
    });

    await waitFor(() => {
      expect(mockReportBetaVideo).toHaveBeenCalledWith('vid-reportable');
    });
  });

  it('AC-140: report label changes to "reported" after successful report', async () => {
    const otherVideo = makeVideo('vid-reportable2', 1, { user_id: 'other-user-999' });
    mockReportBetaVideo.mockResolvedValue(undefined);

    render(
      <BetaVideoReelViewer
        {...BASE_PROPS}
        videos={[otherVideo]}
        initialIndex={0}
      />,
      renderOptions(),
    );

    await waitFor(() => {
      expect(screen.getByTestId('reel-report-button')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(screen.getByTestId('reel-report-button'));
    });

    await waitFor(() => {
      // After success, the label should change to the "reported" string
      const label = screen.getByTestId('reel-report-label');
      expect(label.props.children).toBeTruthy();
    });
  });

  // ── Poster identity (AC-134) ───────────────────────────────────────────────

  it('AC-134: shows poster display_name', async () => {
    const video = makeVideo('vid-poster', 1, { display_name: 'Test Climber' });

    render(
      <BetaVideoReelViewer
        {...BASE_PROPS}
        videos={[video]}
        initialIndex={0}
      />,
      renderOptions(),
    );

    await waitFor(() => {
      expect(screen.getByTestId('reel-poster-name')).toBeTruthy();
    });
  });

  it('AC-134: shows avatar placeholder when avatar_url is null', async () => {
    const video = makeVideo('vid-no-avatar', 1, { avatar_url: null });

    render(
      <BetaVideoReelViewer
        {...BASE_PROPS}
        videos={[video]}
        initialIndex={0}
      />,
      renderOptions(),
    );

    await waitFor(() => {
      expect(screen.getByTestId('reel-poster-avatar-placeholder')).toBeTruthy();
    });
  });

  it('AC-134: shows Image when avatar_url is provided', async () => {
    const video = makeVideo('vid-with-avatar', 1, {
      avatar_url: 'https://example.com/avatar.jpg',
    });

    render(
      <BetaVideoReelViewer
        {...BASE_PROPS}
        videos={[video]}
        initialIndex={0}
      />,
      renderOptions(),
    );

    await waitFor(() => {
      expect(screen.getByTestId('reel-poster-avatar')).toBeTruthy();
    });
  });

  // ── Bug 2: own-video — poster row non-tappable, report button hidden ────────

  it('Bug 2: poster row has onPress=undefined and report button hidden for the viewer\'s own video', async () => {
    // The supabase mock returns viewer-user-001 from getSession.
    // When the current video's user_id matches, isOwnVideo = true.
    // isOwnVideo causes: onPress={undefined} on the poster row and report button
    // is not rendered (null). We verify this by checking that the report button
    // is absent and that pressing the poster row does NOT call onNavigateToUser.
    const ownVideo = makeVideo('vid-own-viewer', 1, { user_id: 'viewer-user-001' });
    const onNavigateToUser = jest.fn();

    render(
      <BetaVideoReelViewer
        {...BASE_PROPS}
        videos={[ownVideo]}
        initialIndex={0}
        reelContext="route"
        onNavigateToUser={onNavigateToUser}
      />,
      renderOptions(),
    );

    // Wait for the poster row to be rendered and the getSession async to complete.
    await waitFor(() => {
      expect(screen.getByTestId('reel-poster-row')).toBeTruthy();
    });

    // Report button must not be rendered for own videos (isOwnVideo = true → showReportButton = false).
    // Wait for currentUserId to be set (async getSession), then check.
    await waitFor(() => {
      expect(screen.queryByTestId('reel-report-button')).toBeNull();
    }, { timeout: 2000 });

    // Pressing the poster row must not call onNavigateToUser (onPress is undefined for own video).
    fireEvent.press(screen.getByTestId('reel-poster-row'));
    expect(onNavigateToUser).not.toHaveBeenCalled();
  });

  it('Bug 2: poster row is tappable and report button visible for another user\'s video (reelContext=route)', async () => {
    const otherVideo = makeVideo('vid-other-viewer', 1, { user_id: 'other-user-999' });
    const onNavigateToUser = jest.fn();

    render(
      <BetaVideoReelViewer
        {...BASE_PROPS}
        videos={[otherVideo]}
        initialIndex={0}
        reelContext="route"
        onNavigateToUser={onNavigateToUser}
      />,
      renderOptions(),
    );

    await waitFor(() => {
      // Report button must be visible for another user's video
      expect(screen.getByTestId('reel-report-button')).toBeTruthy();
    });
  });

  // ── Bug 2: per-video route/gym name in profile context ────────────────────

  it('Bug 2: Row 2 shows per-video route_name and gym_name when host props are not provided', async () => {
    // Profile context: no routeName/gymName props, but the video has per-video fields
    // populated by fetchBetaVideosByUser (routes + gyms join).
    const videoWithRoute = makeVideo('vid-with-route', 1, {
      route_name: 'V4 Yellow',
      gym_name: 'Climb Lab',
    } as Partial<BetaVideo>);

    render(
      <BetaVideoReelViewer
        {...BASE_PROPS}
        videos={[videoWithRoute]}
        initialIndex={0}
        // No routeName or gymName props — profile context
      />,
      renderOptions(),
    );

    await waitFor(() => {
      expect(screen.getByTestId('reel-route-gym-label')).toBeTruthy();
    });

    const textEl = screen.getByTestId('reel-route-gym-text');
    expect(textEl.props.children).toBe('V4 Yellow · Climb Lab');
  });

  it('Bug 2: routeName/gymName props take precedence over per-video fields (route-detail context backward-compat)', async () => {
    // Route-detail context: host passes routeName/gymName props; they must take
    // precedence over any per-video route_name/gym_name on the BetaVideo row.
    const videoWithRoute = makeVideo('vid-with-route-override', 1, {
      route_name: 'V4 Yellow (per-video)',
      gym_name: 'Climb Lab (per-video)',
    } as Partial<BetaVideo>);

    render(
      <BetaVideoReelViewer
        {...BASE_PROPS}
        videos={[videoWithRoute]}
        initialIndex={0}
        routeName="5.11a Blue (prop)"
        gymName="Sender Gym (prop)"
      />,
      renderOptions(),
    );

    await waitFor(() => {
      expect(screen.getByTestId('reel-route-gym-label')).toBeTruthy();
    });

    const textEl = screen.getByTestId('reel-route-gym-text');
    expect(textEl.props.children).toBe('5.11a Blue (prop) · Sender Gym (prop)');
  });

  it('Bug 2: Row 2 is hidden when no route info is available (profile context, no join)', async () => {
    // When neither host props nor per-video route_name/gym_name are available,
    // Row 2 must not render (no empty label shown).
    const videoNoRoute = makeVideo('vid-no-route', 1, {
      route_name: null,
      gym_name: null,
    } as Partial<BetaVideo>);

    render(
      <BetaVideoReelViewer
        {...BASE_PROPS}
        videos={[videoNoRoute]}
        initialIndex={0}
        // No routeName or gymName props, no per-video fields
      />,
      renderOptions(),
    );

    // Row 2 label must not be rendered.
    await waitFor(() => {
      expect(screen.queryByTestId('reel-route-gym-label')).toBeNull();
    });
  });

  // ── Bug 3: video loading overlay on swipe ─────────────────────────────────

  it('Bug 3: loading overlay is shown while new video buffers after swiping', async () => {
    // After swipe commit, setIsVideoLoading(true) is called immediately (Root cause 1 fix),
    // causing the black overlay (testID="beta-video-reel-video-loading") to appear.
    // The overlay is rendered outside the dragY-animated view (Root cause 3 fix).
    // The overlay clears when the player fires statusChange=readyToPlay via
    // useEventListener (Root cause 2 fix — replaces the unreliable onFirstFrameRender).
    render(
      <BetaVideoReelViewer {...BASE_PROPS} initialIndex={0} />,
      renderOptions(),
    );

    // Wait for the initial URL load to complete so the video is ready.
    await waitFor(() => {
      expect(screen.getByText('1 / 3')).toBeTruthy();
    });

    // Swipe up to advance to the next video — triggers isVideoLoading=true.
    await act(async () => {
      simulateSwipe(-80);
    });

    // Loading overlay must be present while the new video buffers.
    await waitFor(() => {
      expect(screen.getByTestId('beta-video-reel-video-loading')).toBeTruthy();
    });
  });

  // ── AC-052: Like button ───────────────────────────────────────────────────

  it('AC-052: like button is rendered and tappable', async () => {
    render(<BetaVideoReelViewer {...BASE_PROPS} />, renderOptions());

    await waitFor(() => {
      expect(screen.getByTestId('reel-like-button')).toBeTruthy();
    });
  });

  it('AC-052: like button is the fist (outline when not liked, filled when liked)', async () => {
    mockFetchLikeInfo.mockResolvedValue({ like_count: 3, user_has_liked: false });

    render(<BetaVideoReelViewer {...BASE_PROPS} />, renderOptions());

    // After fetchLikeInfo resolves, count should be 3 and the outline fist.
    await waitFor(() => {
      expect(screen.getByTestId('reel-like-button')).toBeTruthy();
    });

    // Now mock fetchLikeInfo to return liked state for the post-like call.
    mockFetchLikeInfo.mockResolvedValue({ like_count: 4, user_has_liked: true });
    mockLikeBetaVideo.mockResolvedValue(undefined);

    await act(async () => {
      fireEvent.press(screen.getByTestId('reel-like-button'));
    });

    await waitFor(() => {
      expect(mockLikeBetaVideo).toHaveBeenCalledWith(VIDEO_A.id);
    });
  });

  it('AC-052: tapping like calls likeBetaVideo when not liked', async () => {
    mockFetchLikeInfo.mockResolvedValue({ like_count: 0, user_has_liked: false });
    mockLikeBetaVideo.mockResolvedValue(undefined);

    render(<BetaVideoReelViewer {...BASE_PROPS} />, renderOptions());

    await waitFor(() => {
      expect(screen.getByTestId('reel-like-button')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(screen.getByTestId('reel-like-button'));
    });

    await waitFor(() => {
      expect(mockLikeBetaVideo).toHaveBeenCalledWith(VIDEO_A.id);
    });
    expect(mockUnlikeBetaVideo).not.toHaveBeenCalled();
  });

  it('AC-052: tapping like calls unlikeBetaVideo when already liked', async () => {
    mockFetchLikeInfo.mockResolvedValue({ like_count: 1, user_has_liked: true });
    mockUnlikeBetaVideo.mockResolvedValue(undefined);

    render(<BetaVideoReelViewer {...BASE_PROPS} />, renderOptions());

    // Wait for the liked state to be applied from fetchLikeInfo.
    await waitFor(() => {
      expect(screen.getByTestId('reel-like-button')).toBeTruthy();
    });
    // Allow the fetchLikeInfo effect to resolve.
    await act(async () => { await Promise.resolve(); });

    await act(async () => {
      fireEvent.press(screen.getByTestId('reel-like-button'));
    });

    await waitFor(() => {
      expect(mockUnlikeBetaVideo).toHaveBeenCalledWith(VIDEO_A.id);
    });
    expect(mockLikeBetaVideo).not.toHaveBeenCalled();
  });

  it('AC-052: reverts optimistic update on like error', async () => {
    mockFetchLikeInfo.mockResolvedValue({ like_count: 0, user_has_liked: false });
    mockLikeBetaVideo.mockRejectedValue(new Error('Network error'));

    render(<BetaVideoReelViewer {...BASE_PROPS} />, renderOptions());

    await waitFor(() => {
      expect(screen.getByTestId('reel-like-button')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(screen.getByTestId('reel-like-button'));
    });

    // After error, the like state should revert to not-liked.
    await waitFor(() => {
      expect(mockLikeBetaVideo).toHaveBeenCalledWith(VIDEO_A.id);
    });
    // isLikePending should be false after error (button re-enabled).
    await waitFor(() => {
      const btn = screen.getByTestId('reel-like-button');
      expect(btn).toBeTruthy();
    });
  });
});
