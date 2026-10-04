/**
 * Tests for BetaVideoUploader (MOD-005).
 *
 * AC-030: rejects videos longer than 60 seconds before upload.
 * AC-031 (Rev 24): uploads the native video file directly — no compression step.
 * AC-035: rejects videos with unsupported format.
 * AC-036 (Rev 24): progress overlay shows "Uploading…" only (no "Compressing…" phase).
 * AC-037: "Add beta video" button visible with route context pre-attached.
 * AC-169 (Rev 24): upfront native file size gate blocks upload if native file >= 45 MB.
 *                   Fails closed: size === 0 treated as oversized.
 *
 * expo-image-picker, beta-video-service, and expo-file-system are mocked.
 * react-native-compressor is NOT used or mocked (removed in Rev 24).
 * Tests behaviour — not implementation.
 */

jest.mock('../../../lib/supabase', () => ({
  supabase: { from: jest.fn(), storage: { from: jest.fn() } },
}));

jest.mock('../beta-video-service', () => ({
  uploadBetaVideo: jest.fn(),
  // AC-166: checkExistingBetaVideo is called on mount; default to no existing video.
  checkExistingBetaVideo: jest.fn().mockResolvedValue(false),
}));

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  launchImageLibraryAsync: jest.fn(),
  MediaTypeOptions: { Videos: 'Videos' },
  // AC-031 (Rev 26): preferredAssetRepresentationMode is NOT set by BetaVideoUploader;
  // the enum is kept in the mock only so referencing it elsewhere does not throw.
  UIImagePickerPreferredAssetRepresentationMode: {
    Automatic: 'automatic',
    Compatible: 'compatible',
    Current: 'current',
  },
}));

import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';
import * as ImagePicker from 'expo-image-picker';
import { PermissionStatus } from 'expo-modules-core';
import * as ExpoFileSystem from 'expo-file-system';

import { uploadBetaVideo, checkExistingBetaVideo } from '../beta-video-service';
import BetaVideoUploader from '../components/BetaVideoUploader';
import { renderOptions } from '../test-utils';
import type { BetaVideo } from '../types';

const mockLaunchImageLibrary = ImagePicker.launchImageLibraryAsync as jest.MockedFunction<
  typeof ImagePicker.launchImageLibraryAsync
>;
const mockRequestPermissions =
  ImagePicker.requestMediaLibraryPermissionsAsync as jest.MockedFunction<
    typeof ImagePicker.requestMediaLibraryPermissionsAsync
  >;
const mockUploadBetaVideo = uploadBetaVideo as jest.MockedFunction<typeof uploadBetaVideo>;
const mockCheckExistingBetaVideo = checkExistingBetaVideo as jest.MockedFunction<typeof checkExistingBetaVideo>;

// AC-169 (Rev 24): expo-file-system File.size mock helper — controls the .size property
// returned by all File instances created during a test.
const setMockFileSize = (ExpoFileSystem as any).__setMockFileSize as (bytes: number) => void;

const MOCK_VIDEO: BetaVideo = {
  id: 'vid-001',
  route_id: 'route-001',
  user_id: 'user-001',
  video_url: 'user-001/route-001/video.mp4',
  thumbnail_url: 'user-001/route-001/thumb.jpg',
  duration_seconds: 30,
  caption: null,
  created_at: '2026-09-24T10:00:00Z',
  is_reported: false,
  report_dismissed: false,
  display_name: null,
  avatar_url: null,
};

const DEFAULT_PROPS = {
  routeId: 'route-001',
  userId: 'user-001',
  onUploadSuccess: jest.fn(),
  onUploadError: jest.fn(),
};

/** A valid 30-second MP4 picker result. */
function validAsset(): ImagePicker.ImagePickerSuccessResult {
  return {
    canceled: false,
    assets: [
      {
        uri: 'file:///video.mp4',
        mimeType: 'video/mp4',
        duration: 30_000, // 30 seconds in ms
        type: 'video',
        width: 1920,
        height: 1080,
        fileName: 'video.mp4',
        fileSize: 10_000_000,
        assetId: null,
        base64: null,
        exif: null,
        pairedVideoAsset: null,
      },
    ],
  };
}

describe('BetaVideoUploader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequestPermissions.mockResolvedValue({
      granted: true,
      expires: 'never',
      canAskAgain: true,
      status: PermissionStatus.GRANTED,
    });
    // AC-166: default — no existing video for this route.
    mockCheckExistingBetaVideo.mockResolvedValue(false);
    // AC-169 (Rev 24): default — native file is well under 45 MB.
    setMockFileSize(5 * 1024 * 1024); // 5 MB
  });

  it('AC-037: renders the "Add beta video" button', () => {
    render(<BetaVideoUploader {...DEFAULT_PROPS} />, renderOptions());

    const addButton = screen.queryAllByRole('button').find(
      (el) =>
        el.props.accessibilityLabel === 'Add Beta Video' ||
        el.props.accessibilityLabel === '新增 Beta 影片',
    );
    expect(addButton).toBeTruthy();
  });

  it('calls onUploadSuccess after a successful upload', async () => {
    mockLaunchImageLibrary.mockResolvedValue(validAsset());
    mockUploadBetaVideo.mockResolvedValue(MOCK_VIDEO);

    render(<BetaVideoUploader {...DEFAULT_PROPS} />, renderOptions());

    const addButton = screen.queryAllByRole('button').find(
      (el) =>
        el.props.accessibilityLabel === 'Add Beta Video' ||
        el.props.accessibilityLabel === '新增 Beta 影片',
    );
    if (addButton) {
      fireEvent.press(addButton);
    }

    await waitFor(() => {
      expect(DEFAULT_PROPS.onUploadSuccess).toHaveBeenCalledWith(MOCK_VIDEO);
    });
  });

  it('AC-030: shows error and does not upload when video is longer than 60 seconds', async () => {
    const longVideoAsset: ImagePicker.ImagePickerSuccessResult = {
      canceled: false,
      assets: [
        {
          uri: 'file:///long-video.mp4',
          mimeType: 'video/mp4',
          duration: 90_000, // 90 seconds — over limit
          type: 'video',
          width: 1920,
          height: 1080,
          fileName: 'long-video.mp4',
          fileSize: 50_000_000,
          assetId: null,
          base64: null,
          exif: null,
          pairedVideoAsset: null,
        },
      ],
    };
    mockLaunchImageLibrary.mockResolvedValue(longVideoAsset);

    render(<BetaVideoUploader {...DEFAULT_PROPS} />, renderOptions());

    const addButton = screen.queryAllByRole('button').find(
      (el) =>
        el.props.accessibilityLabel === 'Add Beta Video' ||
        el.props.accessibilityLabel === '新增 Beta 影片',
    );
    if (addButton) {
      fireEvent.press(addButton);
    }

    await waitFor(() => {
      const errorTexts = screen
        .queryAllByText(/Video must be 60 seconds or shorter/i)
        .concat(screen.queryAllByText(/影片長度必須在 60 秒以內/));
      expect(errorTexts.length).toBeGreaterThan(0);
    });

    expect(mockUploadBetaVideo).not.toHaveBeenCalled();
  });

  it('AC-035: shows error and does not upload for unsupported video format (HEVC mimeType)', async () => {
    const hevcAsset: ImagePicker.ImagePickerSuccessResult = {
      canceled: false,
      assets: [
        {
          uri: 'file:///video.hevc',
          mimeType: 'video/hevc',
          duration: 30_000,
          type: 'video',
          width: 1920,
          height: 1080,
          fileName: 'video.hevc',
          fileSize: 10_000_000,
          assetId: null,
          base64: null,
          exif: null,
          pairedVideoAsset: null,
        },
      ],
    };
    mockLaunchImageLibrary.mockResolvedValue(hevcAsset);

    render(<BetaVideoUploader {...DEFAULT_PROPS} />, renderOptions());

    const addButton = screen.queryAllByRole('button').find(
      (el) =>
        el.props.accessibilityLabel === 'Add Beta Video' ||
        el.props.accessibilityLabel === '新增 Beta 影片',
    );
    if (addButton) {
      fireEvent.press(addButton);
    }

    await waitFor(() => {
      const errorTexts = screen
        .queryAllByText(/Only MP4 and MOV videos are supported/i)
        .concat(screen.queryAllByText(/僅支援 MP4 和 MOV 格式的影片/));
      expect(errorTexts.length).toBeGreaterThan(0);
    });

    expect(mockUploadBetaVideo).not.toHaveBeenCalled();
  });

  it('AC-035: accepts .mov files with no mimeType (QuickTime container allowed per PRD Rev 12)', async () => {
    // A .mov URI with no mimeType must now be accepted — spec accepts both .mp4 and .mov.
    const movAsset: ImagePicker.ImagePickerSuccessResult = {
      canceled: false,
      assets: [
        {
          uri: 'file:///video.mov',
          mimeType: undefined,
          duration: 30_000,
          type: 'video',
          width: 1920,
          height: 1080,
          fileName: 'video.mov',
          fileSize: 10_000_000,
          assetId: null,
          base64: null,
          exif: null,
          pairedVideoAsset: null,
        },
      ],
    };
    mockLaunchImageLibrary.mockResolvedValue(movAsset);
    mockUploadBetaVideo.mockResolvedValue(MOCK_VIDEO);

    render(<BetaVideoUploader {...DEFAULT_PROPS} />, renderOptions());

    const addButton = screen.queryAllByRole('button').find(
      (el) =>
        el.props.accessibilityLabel === 'Add Beta Video' ||
        el.props.accessibilityLabel === '新增 Beta 影片',
    );
    if (addButton) {
      fireEvent.press(addButton);
    }

    await waitFor(() => {
      expect(mockUploadBetaVideo).toHaveBeenCalled();
    });

    expect(DEFAULT_PROPS.onUploadSuccess).toHaveBeenCalledWith(MOCK_VIDEO);
  });

  it('AC-035: accepts .mov files with mimeType video/quicktime', async () => {
    // video/quicktime is the standard MIME type for iPhone-camera .mov files.
    const movQuicktimeAsset: ImagePicker.ImagePickerSuccessResult = {
      canceled: false,
      assets: [
        {
          uri: 'file:///iphone_clip.mov',
          mimeType: 'video/quicktime',
          duration: 30_000,
          type: 'video',
          width: 1920,
          height: 1080,
          fileName: 'iphone_clip.mov',
          fileSize: 10_000_000,
          assetId: null,
          base64: null,
          exif: null,
          pairedVideoAsset: null,
        },
      ],
    };
    mockLaunchImageLibrary.mockResolvedValue(movQuicktimeAsset);
    mockUploadBetaVideo.mockResolvedValue(MOCK_VIDEO);

    render(<BetaVideoUploader {...DEFAULT_PROPS} />, renderOptions());

    const addButton = screen.queryAllByRole('button').find(
      (el) =>
        el.props.accessibilityLabel === 'Add Beta Video' ||
        el.props.accessibilityLabel === '新增 Beta 影片',
    );
    if (addButton) {
      fireEvent.press(addButton);
    }

    await waitFor(() => {
      expect(mockUploadBetaVideo).toHaveBeenCalled();
    });

    expect(DEFAULT_PROPS.onUploadSuccess).toHaveBeenCalledWith(MOCK_VIDEO);
  });

  it('AC-035: rejects .avi files (unsupported container)', async () => {
    const aviAsset: ImagePicker.ImagePickerSuccessResult = {
      canceled: false,
      assets: [
        {
          uri: 'file:///video.avi',
          mimeType: 'video/x-msvideo',
          duration: 30_000,
          type: 'video',
          width: 1920,
          height: 1080,
          fileName: 'video.avi',
          fileSize: 10_000_000,
          assetId: null,
          base64: null,
          exif: null,
          pairedVideoAsset: null,
        },
      ],
    };
    mockLaunchImageLibrary.mockResolvedValue(aviAsset);

    render(<BetaVideoUploader {...DEFAULT_PROPS} />, renderOptions());

    const addButton = screen.queryAllByRole('button').find(
      (el) =>
        el.props.accessibilityLabel === 'Add Beta Video' ||
        el.props.accessibilityLabel === '新增 Beta 影片',
    );
    if (addButton) {
      fireEvent.press(addButton);
    }

    await waitFor(() => {
      const errorTexts = screen
        .queryAllByText(/Only MP4 and MOV videos are supported/i)
        .concat(screen.queryAllByText(/僅支援 MP4 和 MOV 格式的影片/));
      expect(errorTexts.length).toBeGreaterThan(0);
    });

    expect(mockUploadBetaVideo).not.toHaveBeenCalled();
  });

  it('AC-035: rejects .mkv files (unsupported container, no mimeType)', async () => {
    const mkvAsset: ImagePicker.ImagePickerSuccessResult = {
      canceled: false,
      assets: [
        {
          uri: 'file:///video.mkv',
          mimeType: undefined,
          duration: 30_000,
          type: 'video',
          width: 1920,
          height: 1080,
          fileName: 'video.mkv',
          fileSize: 10_000_000,
          assetId: null,
          base64: null,
          exif: null,
          pairedVideoAsset: null,
        },
      ],
    };
    mockLaunchImageLibrary.mockResolvedValue(mkvAsset);

    render(<BetaVideoUploader {...DEFAULT_PROPS} />, renderOptions());

    const addButton = screen.queryAllByRole('button').find(
      (el) =>
        el.props.accessibilityLabel === 'Add Beta Video' ||
        el.props.accessibilityLabel === '新增 Beta 影片',
    );
    if (addButton) {
      fireEvent.press(addButton);
    }

    await waitFor(() => {
      const errorTexts = screen
        .queryAllByText(/Only MP4 and MOV videos are supported/i)
        .concat(screen.queryAllByText(/僅支援 MP4 和 MOV 格式的影片/));
      expect(errorTexts.length).toBeGreaterThan(0);
    });

    expect(mockUploadBetaVideo).not.toHaveBeenCalled();
  });

  it('shows error when permission is denied', async () => {
    mockRequestPermissions.mockResolvedValue({
      granted: false,
      expires: 'never',
      canAskAgain: false,
      status: PermissionStatus.DENIED,
    });

    render(<BetaVideoUploader {...DEFAULT_PROPS} />, renderOptions());

    const addButton = screen.queryAllByRole('button').find(
      (el) =>
        el.props.accessibilityLabel === 'Add Beta Video' ||
        el.props.accessibilityLabel === '新增 Beta 影片',
    );
    if (addButton) {
      fireEvent.press(addButton);
    }

    await waitFor(() => {
      const errorTexts = screen
        .queryAllByText(/Photo library access is required/i)
        .concat(screen.queryAllByText(/需要相簿存取權限/));
      expect(errorTexts.length).toBeGreaterThan(0);
    });

    expect(mockUploadBetaVideo).not.toHaveBeenCalled();
  });

  it('does not call upload when picker is canceled', async () => {
    mockLaunchImageLibrary.mockResolvedValue({ canceled: true, assets: null });

    render(<BetaVideoUploader {...DEFAULT_PROPS} />, renderOptions());

    const addButton = screen.queryAllByRole('button').find(
      (el) =>
        el.props.accessibilityLabel === 'Add Beta Video' ||
        el.props.accessibilityLabel === '新增 Beta 影片',
    );
    if (addButton) {
      fireEvent.press(addButton);
    }

    // Give time for async operations
    await waitFor(() => {
      expect(mockUploadBetaVideo).not.toHaveBeenCalled();
    });
  });

  it('shows error and calls onUploadError when upload service throws', async () => {
    mockLaunchImageLibrary.mockResolvedValue(validAsset());
    mockUploadBetaVideo.mockRejectedValue(
      new Error('Failed to upload video. Please try again.'),
    );

    render(<BetaVideoUploader {...DEFAULT_PROPS} />, renderOptions());

    const addButton = screen.queryAllByRole('button').find(
      (el) =>
        el.props.accessibilityLabel === 'Add Beta Video' ||
        el.props.accessibilityLabel === '新增 Beta 影片',
    );
    if (addButton) {
      fireEvent.press(addButton);
    }

    await waitFor(() => {
      expect(DEFAULT_PROPS.onUploadError).toHaveBeenCalled();
    });
  });

  it('AC-031 (Rev 26): passes asset.uri directly to uploadBetaVideo — no compression, Automatic picker mode', async () => {
    // Rev 26: no react-native-compressor; the native file URI is passed directly.
    // preferredAssetRepresentationMode is NOT set — iOS uses Automatic mode (HEVC/HLG → H.264 SDR).
    mockLaunchImageLibrary.mockResolvedValue(validAsset());
    mockUploadBetaVideo.mockResolvedValue(MOCK_VIDEO);

    render(<BetaVideoUploader {...DEFAULT_PROPS} />, renderOptions());

    const addButton = screen.queryAllByRole('button').find(
      (el) =>
        el.props.accessibilityLabel === 'Add Beta Video' ||
        el.props.accessibilityLabel === '新增 Beta 影片',
    );
    if (addButton) {
      fireEvent.press(addButton);
    }

    await waitFor(() => {
      expect(DEFAULT_PROPS.onUploadSuccess).toHaveBeenCalledWith(MOCK_VIDEO);
    });

    // uploadBetaVideo must receive the original asset URI (no compression URI)
    expect(mockUploadBetaVideo).toHaveBeenCalledWith(
      expect.objectContaining({ localVideoUri: 'file:///video.mp4' }),
      DEFAULT_PROPS.userId,
      expect.any(Function),
    );

    // AC-031 (Rev 26): picker must NOT set preferredAssetRepresentationMode — iOS Automatic
    // mode transcodes HEVC/HLG → H.264 SDR, which prevents overexposure in VideoView.
    expect(mockLaunchImageLibrary).toHaveBeenCalledWith(
      expect.not.objectContaining({
        preferredAssetRepresentationMode: expect.anything(),
      }),
    );
  });

  it('AC-169 (Rev 24): shows error and does not upload when native file exceeds 45 MB', async () => {
    mockLaunchImageLibrary.mockResolvedValue(validAsset());
    // Simulate native file exceeding 45 MB — upfront gate should block upload
    setMockFileSize(60 * 1024 * 1024); // 60 MB

    render(<BetaVideoUploader {...DEFAULT_PROPS} />, renderOptions());

    const addButton = screen.queryAllByRole('button').find(
      (el) =>
        el.props.accessibilityLabel === 'Add Beta Video' ||
        el.props.accessibilityLabel === '新增 Beta 影片',
    );
    if (addButton) {
      fireEvent.press(addButton);
    }

    await waitFor(() => {
      const errorTexts = screen
        .queryAllByText(/Video is too large/i)
        .concat(screen.queryAllByText(/影片檔案過大/));
      expect(errorTexts.length).toBeGreaterThan(0);
    });

    expect(mockUploadBetaVideo).not.toHaveBeenCalled();
  });

  it('AC-169 (Rev 24): shows error and does not upload when native file size is 0 (unreadable — fail closed)', async () => {
    mockLaunchImageLibrary.mockResolvedValue(validAsset());
    // size === 0 means unreadable — must be treated as oversized (fail closed)
    setMockFileSize(0);

    render(<BetaVideoUploader {...DEFAULT_PROPS} />, renderOptions());

    const addButton = screen.queryAllByRole('button').find(
      (el) =>
        el.props.accessibilityLabel === 'Add Beta Video' ||
        el.props.accessibilityLabel === '新增 Beta 影片',
    );
    if (addButton) {
      fireEvent.press(addButton);
    }

    await waitFor(() => {
      const errorTexts = screen
        .queryAllByText(/Video is too large/i)
        .concat(screen.queryAllByText(/影片檔案過大/));
      expect(errorTexts.length).toBeGreaterThan(0);
    });

    expect(mockUploadBetaVideo).not.toHaveBeenCalled();
  });

  it('AC-166 (revised): shows blocking message and disables button when user already has a video', async () => {
    // When hasExistingVideo is true, the button must be disabled and a blocking
    // message must appear instructing the user to delete first — not a replace warning.
    mockCheckExistingBetaVideo.mockResolvedValue(true);

    render(<BetaVideoUploader {...DEFAULT_PROPS} />, renderOptions());

    await waitFor(() => {
      const blockingTexts = screen
        .queryAllByText(/You already have a beta video for this route/i)
        .concat(screen.queryAllByText(/你已有此路線的 Beta 影片/));
      expect(blockingTexts.length).toBeGreaterThan(0);
    });

    // Button must be disabled (accessibilityState.disabled === true)
    const addButton = screen.queryAllByRole('button').find(
      (el) =>
        el.props.accessibilityLabel === 'Add Beta Video' ||
        el.props.accessibilityLabel === '新增 Beta 影片',
    );
    expect(addButton).toBeTruthy();
    expect(addButton?.props.accessibilityState?.disabled).toBe(true);
  });

  it('AC-166 (revised): does not call upload when button is disabled due to existing video', async () => {
    mockCheckExistingBetaVideo.mockResolvedValue(true);
    mockLaunchImageLibrary.mockResolvedValue(validAsset());

    render(<BetaVideoUploader {...DEFAULT_PROPS} />, renderOptions());

    // Wait for the check to resolve
    await waitFor(() => {
      const blockingTexts = screen
        .queryAllByText(/You already have a beta video for this route/i)
        .concat(screen.queryAllByText(/你已有此路線的 Beta 影片/));
      expect(blockingTexts.length).toBeGreaterThan(0);
    });

    // Even if the user somehow triggers the button, upload must not be called
    const addButton = screen.queryAllByRole('button').find(
      (el) =>
        el.props.accessibilityLabel === 'Add Beta Video' ||
        el.props.accessibilityLabel === '新增 Beta 影片',
    );
    if (addButton) {
      fireEvent.press(addButton);
    }

    // Upload must never be called — button is disabled
    await waitFor(() => {
      expect(mockUploadBetaVideo).not.toHaveBeenCalled();
    });
  });

  it('AC-169 (Rev 24): proceeds to upload when native file is exactly at 45 MB threshold', async () => {
    mockLaunchImageLibrary.mockResolvedValue(validAsset());
    // Exactly 45,000,000 bytes — should NOT be blocked (> 45,000,000 is the threshold)
    setMockFileSize(45 * 1_000_000); // 45 MB (decimal)
    mockUploadBetaVideo.mockResolvedValue(MOCK_VIDEO);

    render(<BetaVideoUploader {...DEFAULT_PROPS} />, renderOptions());

    const addButton = screen.queryAllByRole('button').find(
      (el) =>
        el.props.accessibilityLabel === 'Add Beta Video' ||
        el.props.accessibilityLabel === '新增 Beta 影片',
    );
    if (addButton) {
      fireEvent.press(addButton);
    }

    await waitFor(() => {
      expect(DEFAULT_PROPS.onUploadSuccess).toHaveBeenCalledWith(MOCK_VIDEO);
    });
    expect(mockUploadBetaVideo).toHaveBeenCalled();
  });
});
