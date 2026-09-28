/**
 * Tests for BetaVideoReelViewer (MOD-005).
 *
 * AC-039: fullscreen reel viewer — swipe navigation, auto-play, dismiss.
 *
 * Covers:
 * - Swipe up increments index (advances to next video).
 * - Swipe down at any index calls onClose (AC-039: dismiss always, no prev navigation).
 * - Swipe up at last index is a no-op (does not wrap).
 * - Back/close button calls onClose.
 * - Loading indicator while signed URL is being fetched.
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
  supabase: { from: jest.fn(), storage: { from: jest.fn() } },
}));

jest.mock('../beta-video-service', () => ({
  getVideoSignedUrl: jest.fn(),
  fetchBetaVideosForRoute: jest.fn(),
  getThumbnailSignedUrl: jest.fn(),
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

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import { getVideoSignedUrl } from '../beta-video-service';
import BetaVideoReelViewer from '../components/BetaVideoReelViewer';
import { renderOptions } from '../test-utils';
import type { BetaVideo } from '../types';

const mockGetVideoSignedUrl = getVideoSignedUrl as jest.MockedFunction<typeof getVideoSignedUrl>;

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeVideo(id: string, index: number): BetaVideo {
  return {
    id,
    route_id: 'route-001',
    user_id: 'user-001',
    video_url: `user-001/route-001/video-${index}.mp4`,
    thumbnail_url: `user-001/route-001/thumb-${index}.jpg`,
    duration_seconds: 30,
    caption: `Caption ${index}`,
    created_at: `2026-09-${String(25 - index).padStart(2, '0')}T10:00:00Z`,
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
  onClose: jest.fn(),
};

/**
 * Simulate a swipe gesture by calling onPanResponderRelease directly on the
 * captured PanResponder config with a fake gestureState containing the given dy.
 *
 * This bypasses the native responder system (which RNTL cannot replicate in JS)
 * and tests the navigation logic directly.
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

  it('back button calls onClose', async () => {
    const onClose = jest.fn();
    render(
      <BetaVideoReelViewer {...BASE_PROPS} onClose={onClose} />,
      renderOptions(),
    );

    await waitFor(() => {
      expect(screen.getByTestId('beta-video-reel-close')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('beta-video-reel-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('AC-039: swipe up at index 0 of 3 advances to index 1', async () => {
    render(
      <BetaVideoReelViewer {...BASE_PROPS} initialIndex={0} />,
      renderOptions(),
    );

    // Wait for viewer to mount with counter "1 / 3"
    await waitFor(() => {
      expect(screen.getByText('1 / 3')).toBeTruthy();
    });

    await act(async () => {
      simulateSwipe(-80); // swipe up (negative dy)
    });

    // Counter should now show "2 / 3"
    await waitFor(() => {
      expect(screen.getByText('2 / 3')).toBeTruthy();
    });
  });

  it('AC-039: swipe up at last index is a no-op (does not wrap)', async () => {
    const onClose = jest.fn();

    render(
      <BetaVideoReelViewer
        {...BASE_PROPS}
        initialIndex={2} // last index
        onClose={onClose}
      />,
      renderOptions(),
    );

    await waitFor(() => {
      expect(screen.getByText('3 / 3')).toBeTruthy();
    });

    await act(async () => {
      simulateSwipe(-80); // swipe up at last index
    });

    // Counter should still show "3 / 3" — no advance, no wrap
    await waitFor(() => {
      expect(screen.getByText('3 / 3')).toBeTruthy();
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('AC-039: swipe down at index 0 calls onClose', async () => {
    const onClose = jest.fn();

    render(
      <BetaVideoReelViewer {...BASE_PROPS} initialIndex={0} onClose={onClose} />,
      renderOptions(),
    );

    await waitFor(() => {
      expect(screen.getByText('1 / 3')).toBeTruthy();
    });

    await act(async () => {
      simulateSwipe(80); // swipe down at index 0
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('AC-039: swipe down at index > 0 calls onClose (dismiss always, no prev navigation)', async () => {
    const onClose = jest.fn();

    render(
      <BetaVideoReelViewer {...BASE_PROPS} initialIndex={2} onClose={onClose} />,
      renderOptions(),
    );

    await waitFor(() => {
      expect(screen.getByText('3 / 3')).toBeTruthy();
    });

    await act(async () => {
      simulateSwipe(80); // swipe down at index 2 → must dismiss (AC-039)
    });

    // AC-039: swiping down shall dismiss the viewer at any index.
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('resets to initialIndex when visible toggles back to true', async () => {
    const { rerender } = render(
      <BetaVideoReelViewer {...BASE_PROPS} initialIndex={2} visible={true} />,
      renderOptions(),
    );

    await waitFor(() => {
      expect(screen.getByText('3 / 3')).toBeTruthy();
    });

    // Close then re-open at index 0
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

    // Modal with visible=false — VideoView should not render (getVideoSignedUrl not called)
    expect(screen.queryByTestId('beta-video-reel-video-view')).toBeNull();
    expect(mockGetVideoSignedUrl).not.toHaveBeenCalled();
  });

  it('shows caption for current video', async () => {
    render(
      <BetaVideoReelViewer {...BASE_PROPS} initialIndex={0} />,
      renderOptions(),
    );

    await waitFor(() => {
      expect(screen.getByText('Caption 1')).toBeTruthy();
    });
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
});
