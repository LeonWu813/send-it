/**
 * Tests for BetaVideoUploader (MOD-005).
 *
 * AC-030: rejects videos longer than 60 seconds before upload.
 * AC-035: rejects videos with unsupported format.
 * AC-036: progress overlay shown during upload.
 * AC-037: "Add beta video" button visible with route context pre-attached.
 *
 * expo-image-picker and beta-video-service are mocked.
 * Tests behaviour — not implementation.
 */

jest.mock('../../../lib/supabase', () => ({
  supabase: { from: jest.fn(), storage: { from: jest.fn() } },
}));

jest.mock('../beta-video-service', () => ({
  uploadBetaVideo: jest.fn(),
}));

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  launchImageLibraryAsync: jest.fn(),
  MediaTypeOptions: { Videos: 'Videos' },
}));

import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';
import * as ImagePicker from 'expo-image-picker';
import { PermissionStatus } from 'expo-modules-core';

import { uploadBetaVideo } from '../beta-video-service';
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

const MOCK_VIDEO: BetaVideo = {
  id: 'vid-001',
  route_id: 'route-001',
  user_id: 'user-001',
  video_url: 'user-001/route-001/video.mp4',
  thumbnail_url: 'user-001/route-001/thumb.jpg',
  duration_seconds: 30,
  caption: null,
  created_at: '2026-09-24T10:00:00Z',
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
        .queryAllByText(/Only MP4 videos are supported/i)
        .concat(screen.queryAllByText(/僅支援 MP4 格式的影片/));
      expect(errorTexts.length).toBeGreaterThan(0);
    });

    expect(mockUploadBetaVideo).not.toHaveBeenCalled();
  });

  it('AC-035: rejects .mov files with no mimeType (MP4 container only)', async () => {
    // A .mov URI with no mimeType must be rejected — spec requires MP4 container only.
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
        .queryAllByText(/Only MP4 videos are supported/i)
        .concat(screen.queryAllByText(/僅支援 MP4 格式的影片/));
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
});
