/**
 * BetaVideoUploader — video selection and upload flow for a single route.
 *
 * AC-030: rejects videos longer than 60 seconds before upload begins.
 * AC-031: client-side compression note — expo-image-picker is used for video
 *         selection with videoMaxDuration:60 as a guard. In Phase 1, the
 *         library choice (expo-image-picker) may produce device-dependent codecs
 *         on some iPhones. The recommended production upgrade is to
 *         ffmpeg-kit-react-native for guaranteed H.264/AAC/MP4 output (spec
 *         note: final library confirmed as expo-image-picker for Phase 1 POC;
 *         upgrade path documented in spec).
 * AC-035: validates that the selected video file is an MP4 before upload.
 *         If validation fails, surfaces a clear error and does not upload.
 * AC-036: progress overlay is displayed during upload (0–100%), blocking
 *         further interaction until the upload completes or fails.
 * AC-037: receives route_id so the upload is bound to the correct route.
 *
 * Phase 1 simplification: expo-image-picker handles video selection only;
 * no in-app capture flow. Compression relies on the device's media pipeline
 * (acceptable for Phase 1 iOS-only scope).
 */

import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTheme } from '../../../lib/theme';
import { uploadBetaVideo } from '../beta-video-service';
import type { BetaVideo, UploadProgress } from '../types';

/** Maximum allowed video duration in seconds (AC-030). */
const MAX_DURATION_SECONDS = 60;

interface BetaVideoUploaderProps {
  /** Route this video will be attached to (AC-037 — pre-attached route context). */
  routeId: string;
  /** Authenticated user's UUID. */
  userId: string;
  /** Called when the upload succeeds with the newly created BetaVideo row. */
  onUploadSuccess: (video: BetaVideo) => void;
  /** Called when the user cancels or an error occurs. */
  onUploadError?: (message: string) => void;
}

export default function BetaVideoUploader({
  routeId,
  userId,
  onUploadSuccess,
  onUploadError,
}: BetaVideoUploaderProps): React.JSX.Element {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const styles = makeStyles(theme);

  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  /**
   * AC-035: Validate the selected video conforms to MP4 container only.
   * expo-image-picker returns a MIME type when available. If the MIME type is
   * not video/mp4, reject with a clear error before upload begins.
   * On iOS, device-native compression may output .mov (QuickTime container) —
   * this is rejected because the spec requires an MP4 container for guaranteed
   * AVPlayer cross-device playback after Cloudflare Stream migration.
   */
  function validateVideoFormat(asset: ImagePicker.ImagePickerAsset): string | null {
    // expo-image-picker does not always return mimeType; when available, check it
    if (asset.mimeType && asset.mimeType !== 'video/mp4') {
      return t('betaVideo.errors.invalidFormat');
    }
    // Check URI extension as a secondary signal when mimeType is absent.
    // Only .mp4 is accepted — .mov is a QuickTime container, not MP4 (AC-035).
    if (!asset.mimeType && !asset.uri.toLowerCase().endsWith('.mp4')) {
      return t('betaVideo.errors.invalidFormat');
    }
    return null;
  }

  /**
   * AC-030: Check duration before compression/upload begins.
   * Returns an error message string if too long, null if valid.
   */
  function validateDuration(asset: ImagePicker.ImagePickerAsset): string | null {
    const durationMs = asset.duration ?? 0;
    const durationSec = durationMs / 1000;
    if (durationSec > MAX_DURATION_SECONDS) {
      return t('betaVideo.errors.tooLong');
    }
    return null;
  }

  const handleSelectVideo = useCallback(async (): Promise<void> => {
    setErrorMessage(null);

    // Request permissions
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      const msg = t('betaVideo.errors.permissionDenied');
      setErrorMessage(msg);
      onUploadError?.(msg);
      return;
    }

    // Launch picker — video only, max 60 seconds enforced by the picker
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      videoMaxDuration: MAX_DURATION_SECONDS,
      allowsEditing: false,
      quality: 0.7, // Expo quality hint; actual compression is device-dependent
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return;
    }

    const asset = result.assets[0];

    // AC-030: Validate duration
    const durationError = validateDuration(asset);
    if (durationError) {
      setErrorMessage(durationError);
      onUploadError?.(durationError);
      return;
    }

    // AC-035: Validate format
    const formatError = validateVideoFormat(asset);
    if (formatError) {
      setErrorMessage(formatError);
      onUploadError?.(formatError);
      return;
    }

    // Duration in seconds for storage
    const durationSeconds = (asset.duration ?? 0) / 1000;

    // For Phase 1, use the selected video URI directly as the thumbnail source.
    // A proper client-side thumbnail would require ffmpeg-kit-react-native
    // (Phase 2). Phase 1 uses the video's first-frame as captured by the picker.
    // expo-image-picker does not expose a thumbnail URI separately for video;
    // we use a placeholder thumbnail path pointing to the same file.
    // In a real implementation with ffmpeg-kit, a frame at 1s would be extracted.
    const localThumbnailUri = asset.uri; // Phase 1 simplification

    setIsUploading(true);
    setProgress({ percent: 0, phase: 'thumbnail' });

    try {
      const video = await uploadBetaVideo(
        {
          route_id: routeId,
          localVideoUri: asset.uri,
          localThumbnailUri,
          duration_seconds: Math.max(durationSeconds, 0.1), // guard against 0
        },
        userId,
        (prog) => setProgress(prog),
      );
      onUploadSuccess(video);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('betaVideo.errors.uploadFailed');
      setErrorMessage(msg);
      onUploadError?.(msg);
    } finally {
      setIsUploading(false);
      setProgress(null);
    }
  }, [routeId, userId, onUploadSuccess, onUploadError, t]);

  return (
    <>
      {/* AC-037: "Add beta video" entry point — visible on route detail screen */}
      <Pressable
        style={styles.addButton}
        onPress={() => { void handleSelectVideo(); }}
        disabled={isUploading}
        accessibilityRole="button"
        accessibilityLabel={t('betaVideo.addVideo')}
        accessibilityState={{ disabled: isUploading }}
      >
        <Ionicons name="videocam-outline" size={18} color={theme.colors.primary} />
        <Text style={styles.addButtonText}>{t('betaVideo.addVideo')}</Text>
      </Pressable>

      {/* Inline error message */}
      {errorMessage ? (
        <Text style={styles.errorText}>{errorMessage}</Text>
      ) : null}

      {/* AC-036: Progress overlay — blocks further interaction during upload */}
      <Modal
        visible={isUploading}
        transparent
        animationType="fade"
        onRequestClose={() => { /* intentionally non-dismissable during upload */ }}
      >
        <View style={styles.progressOverlay}>
          <View style={styles.progressCard}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.progressTitle}>{t('betaVideo.uploading')}</Text>
            {progress ? (
              <Text style={styles.progressPercent}>
                {t('betaVideo.uploadProgress', { percent: progress.percent })}
              </Text>
            ) : null}
          </View>
        </View>
      </Modal>
    </>
  );
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function makeStyles(theme: ReturnType<typeof useTheme>['theme']) {
  return StyleSheet.create({
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.primary,
      alignSelf: 'flex-start',
      marginTop: theme.spacing.sm,
    },
    addButtonText: {
      fontSize: theme.fontSize.sm,
      fontWeight: theme.fontWeight.medium,
      color: theme.colors.primary,
    },
    errorText: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.error,
      marginTop: theme.spacing.xs,
    },
    progressOverlay: {
      flex: 1,
      backgroundColor: theme.colors.overlay,
      alignItems: 'center',
      justifyContent: 'center',
    },
    progressCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.xl,
      alignItems: 'center',
      minWidth: 200,
      gap: theme.spacing.md,
    },
    progressTitle: {
      fontSize: theme.fontSize.md,
      fontWeight: theme.fontWeight.semibold,
      color: theme.colors.textPrimary,
    },
    progressPercent: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.textSecondary,
    },
  });
}
