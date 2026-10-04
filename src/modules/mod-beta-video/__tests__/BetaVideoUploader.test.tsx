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
  // AC-031 (Rev 29): BetaVideoUploader sets preferredAssetRepresentationMode.Current;
  // the enum is kept in the mock so the component can reference it without throwing.
  UIImagePickerPreferredAssetRepresentationMode: {
    Automatic: 'automatic',
    Compatible: 'compatible',
    Current: 'current',
  },
}));

import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Alert } from 'react-native';
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

  it('AC-031 (Rev 29): passes asset.uri directly to uploadBetaVideo — no compression, Current picker mode preserves native HEVC/HLG', async () => {
    // Rev 29: no react-native-compressor; the native file URI is passed directly.
    // preferredAssetRepresentationMode.Current is set — iOS returns the original asset
    // without transcoding so the native HEVC/HLG file is uploaded as-is.
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

    // AC-031 (Rev 29): picker must set preferredAssetRepresentationMode.Current so
    // PHPickerViewController returns the original file without iOS transcoding.
    const mockLaunchImageLibraryAsync = ImagePicker.launchImageLibraryAsync as jest.MockedFunction<
      typeof ImagePicker.launchImageLibraryAsync
    >;
    expect(mockLaunchImageLibraryAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        preferredAssetRepresentationMode:
          ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current,
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

  describe('AC-166 (Rev 28): pre-picker confirmation dialog when existing video', () => {
    it('calls Alert.alert with correct title and message when hasExistingVideo is true', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      mockCheckExistingBetaVideo.mockResolvedValue(true);

      render(<BetaVideoUploader {...DEFAULT_PROPS} />, renderOptions());

      // Wait for mount-time check to resolve
      await waitFor(() => expect(mockCheckExistingBetaVideo).toHaveBeenCalled());

      const addButton = screen.queryAllByRole('button').find(
        (el) =>
          el.props.accessibilityLabel === 'Add Beta Video' ||
          el.props.accessibilityLabel === '新增 Beta 影片',
      );
      expect(addButton).toBeTruthy();
      fireEvent.press(addButton!);

      await waitFor(() => expect(alertSpy).toHaveBeenCalled());

      const [title, message] = alertSpy.mock.calls[0];
      expect(title).toMatch(/Replace Beta Video|替換 Beta 影片/);
      expect(message).toMatch(/already have a beta video|已有此路線的 Beta 影片/);

      alertSpy.mockRestore();
    });

    it('opens picker when user confirms Replace in the dialog', async () => {
      mockCheckExistingBetaVideo.mockResolvedValue(true);
      mockLaunchImageLibrary.mockResolvedValue(validAsset());
      mockUploadBetaVideo.mockResolvedValue(MOCK_VIDEO);

      // Simulate user pressing the destructive "Replace" button (index 1)
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(
        (_title, _message, buttons) => {
          const confirmButton = (buttons as Alert.AlertButton[])[1];
          confirmButton?.onPress?.();
        },
      );

      render(<BetaVideoUploader {...DEFAULT_PROPS} />, renderOptions());
      await waitFor(() => expect(mockCheckExistingBetaVideo).toHaveBeenCalled());

      const addButton = screen.queryAllByRole('button').find(
        (el) =>
          el.props.accessibilityLabel === 'Add Beta Video' ||
          el.props.accessibilityLabel === '新增 Beta 影片',
      );
      fireEvent.press(addButton!);

      await waitFor(() => expect(mockLaunchImageLibrary).toHaveBeenCalled());
      await waitFor(() => expect(DEFAULT_PROPS.onUploadSuccess).toHaveBeenCalledWith(MOCK_VIDEO));

      alertSpy.mockRestore();
    });

    it('does NOT open picker when user cancels the dialog', async () => {
      mockCheckExistingBetaVideo.mockResolvedValue(true);
      mockLaunchImageLibrary.mockResolvedValue(validAsset());

      // Simulate user pressing the "Cancel" button (index 0)
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(
        (_title, _message, buttons) => {
          const cancelButton = (buttons as Alert.AlertButton[])[0];
          cancelButton?.onPress?.();
        },
      );

      render(<BetaVideoUploader {...DEFAULT_PROPS} />, renderOptions());
      await waitFor(() => expect(mockCheckExistingBetaVideo).toHaveBeenCalled());

      const addButton = screen.queryAllByRole('button').find(
        (el) =>
          el.props.accessibilityLabel === 'Add Beta Video' ||
          el.props.accessibilityLabel === '新增 Beta 影片',
      );
      fireEvent.press(addButton!);

      await waitFor(() => expect(alertSpy).toHaveBeenCalled());
      // Picker must not have been opened
      expect(mockLaunchImageLibrary).not.toHaveBeenCalled();
      expect(mockUploadBetaVideo).not.toHaveBeenCalled();

      alertSpy.mockRestore();
    });

    it('does NOT call Alert when hasExistingVideo is false — picker opens directly', async () => {
      mockCheckExistingBetaVideo.mockResolvedValue(false);
      mockLaunchImageLibrary.mockResolvedValue(validAsset());
      mockUploadBetaVideo.mockResolvedValue(MOCK_VIDEO);

      const alertSpy = jest.spyOn(Alert, 'alert');

      render(<BetaVideoUploader {...DEFAULT_PROPS} />, renderOptions());
      await waitFor(() => expect(mockCheckExistingBetaVideo).toHaveBeenCalled());

      const addButton = screen.queryAllByRole('button').find(
        (el) =>
          el.props.accessibilityLabel === 'Add Beta Video' ||
          el.props.accessibilityLabel === '新增 Beta 影片',
      );
      fireEvent.press(addButton!);

      await waitFor(() => expect(mockLaunchImageLibrary).toHaveBeenCalled());
      expect(alertSpy).not.toHaveBeenCalled();

      alertSpy.mockRestore();
    });
  });

  describe('Fix 2 (suppressInlineError)', () => {
    it('does NOT render inline error text when suppressInlineError is true', async () => {
      // When suppressInlineError is true the error message must NOT appear inline;
      // onUploadError must still be called with the message.
      const unsupportedAsset: ImagePicker.ImagePickerSuccessResult = {
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
      mockLaunchImageLibrary.mockResolvedValue(unsupportedAsset);

      const onUploadError = jest.fn();

      render(
        <BetaVideoUploader
          {...DEFAULT_PROPS}
          onUploadError={onUploadError}
          suppressInlineError
        />,
        renderOptions(),
      );

      const addButton = screen.queryAllByRole('button').find(
        (el) =>
          el.props.accessibilityLabel === 'Add Beta Video' ||
          el.props.accessibilityLabel === '新增 Beta 影片',
      );
      if (addButton) {
        fireEvent.press(addButton);
      }

      // onUploadError must still be called (error propagation is unaffected).
      await waitFor(() => expect(onUploadError).toHaveBeenCalled());

      // Inline error text must NOT be rendered.
      const inlineErrors = screen
        .queryAllByText(/Only MP4 and MOV videos are supported/i)
        .concat(screen.queryAllByText(/僅支援 MP4 和 MOV 格式的影片/));
      expect(inlineErrors).toHaveLength(0);
    });

    it('renders inline error text when suppressInlineError is false (default)', async () => {
      // Baseline: default behavior renders inline error text when suppressInlineError is absent.
      const unsupportedAsset: ImagePicker.ImagePickerSuccessResult = {
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
      mockLaunchImageLibrary.mockResolvedValue(unsupportedAsset);

      render(<BetaVideoUploader {...DEFAULT_PROPS} />, renderOptions());

      const addButton = screen.queryAllByRole('button').find(
        (el) =>
          el.props.accessibilityLabel === 'Add Beta Video' ||
          el.props.accessibilityLabel === '新增 Beta 影片',
      );
      if (addButton) {
        fireEvent.press(addButton);
      }

      // Inline error text must appear (suppressInlineError defaults to false).
      await waitFor(() => {
        const inlineErrors = screen
          .queryAllByText(/Only MP4 and MOV videos are supported/i)
          .concat(screen.queryAllByText(/僅支援 MP4 和 MOV 格式的影片/));
        expect(inlineErrors.length).toBeGreaterThan(0);
      });
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
