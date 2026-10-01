/**
 * BetaVideoUploader — video selection and upload flow for a single route.
 *
 * AC-030: rejects videos longer than 60 seconds before upload begins.
 * AC-031: client-side compression using react-native-compressor (iOS AVFoundation).
 *         Compression runs after the AC-030 duration check and before the upload.
 *         Output targets H.264/AAC, ≤1080p, library-default mobile bitrate.
 * AC-035: validates that the selected video file is an MP4 or MOV container
 *         before upload (PRD Revision 12 — .mov accepted for iPhone-camera
 *         footage). If validation fails, surfaces a clear error and does not
 *         upload.
 * AC-036: progress overlay covers a "Compressing…" phase followed by an
 *         "Uploading…" phase, blocking further interaction until complete.
 * AC-037: receives route_id so the upload is bound to the correct route.
 * AC-169: after compression, checks file size via expo-file-system getInfoAsync().
 *         If still > 50 MB (free-tier bucket ceiling), blocks upload and shows
 *         a user-facing error.
 */

import { getInfoAsync } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Video as CompressorVideo } from 'react-native-compressor';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
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
import { checkExistingBetaVideo, uploadBetaVideo } from '../beta-video-service';
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

// AC-161: no per-upload visibility/privacy toggle exists in this component.
// Beta-video visibility is the account-level users.beta_video_privacy setting
// (AC-156/AC-157), not a per-upload field.

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

  // AC-166: check whether the user already has a video for this route on mount.
  // If true, show a replace reminder above the confirm button.
  const [hasExistingVideo, setHasExistingVideo] = useState(false);

  useEffect(() => {
    let cancelled = false;
    checkExistingBetaVideo(routeId)
      .then((exists) => { if (!cancelled) setHasExistingVideo(exists); })
      .catch(() => { /* non-fatal — do not block the upload flow */ });
    return () => { cancelled = true; };
  }, [routeId]);

  /**
   * AC-035: Validate the selected video is in an accepted container.
   * Accepted containers: MP4 (.mp4) and QuickTime (.mov, video/quicktime).
   * Rejection is container-based (since codec cannot be inspected client-side);
   * everything else (.avi, .mkv, .webm, etc.) is rejected with a clear error.
   * expo-image-picker returns a MIME type when available; URI extension is used
   * as a secondary signal when mimeType is absent.
   *
   * Per AC-035 (PRD Revision 12): both .mp4 and .mov containers are accepted
   * so that iPhone-camera footage (.mov/QuickTime) can be uploaded without
   * conversion. Rejection is on non-MP4/MOV containers only.
   */
  function validateVideoFormat(asset: ImagePicker.ImagePickerAsset): string | null {
    const ACCEPTED_MIME_TYPES = new Set([
      'video/mp4',
      'video/quicktime', // .mov — iPhone camera default
      'video/mov',       // alternate MIME string some pickers emit for .mov
    ]);

    // expo-image-picker does not always return mimeType; when available, check it
    if (asset.mimeType && !ACCEPTED_MIME_TYPES.has(asset.mimeType)) {
      return t('betaVideo.errors.invalidFormat');
    }

    // Check URI extension as a secondary signal when mimeType is absent.
    // Accept .mp4 and .mov; reject everything else (.avi, .mkv, .webm, …).
    const lowerUri = asset.uri.toLowerCase();
    if (
      !asset.mimeType &&
      !lowerUri.endsWith('.mp4') &&
      !lowerUri.endsWith('.mov')
    ) {
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

    setIsUploading(true);

    try {
      // AC-031: compress before upload using react-native-compressor.
      // Compression runs after the AC-030 duration check (above) and before
      // the storage upload. Output: H.264/AAC, ≤1080p, library-default bitrate.

      // Pre-compression guard: warn early if source is extremely large (>300 MB).
      // Compression will still be attempted — the post-compression AC-169 guard is the hard gate.
      // expo-file-system legacy API: size is always present on existing files (no option required).
      const sourceInfo = await getInfoAsync(asset.uri);
      if (sourceInfo.exists && sourceInfo.size !== undefined && sourceInfo.size > 300 * 1024 * 1024) {
        throw new Error(t('betaVideo.errors.videoTooLargeAfterCompression'));
      }

      setProgress({ percent: 5, phase: 'compressing' });
      const compressedUri = await CompressorVideo.compress(
        asset.uri,
        {
          compressionMethod: 'auto',
          // 'auto' targets H.264, ≤1080p, library-default mobile bitrate
        },
        (compressionProgress) => {
          // Map compressor's 0→1 progress to 5%→50% on the overlay
          setProgress({
            percent: Math.round(compressionProgress * 45) + 5,
            phase: 'compressing',
          });
        },
      );

      // AC-169: post-compression size guard.
      // If the compressed file still exceeds the Supabase Storage free-tier
      // bucket ceiling (50 MB), block the upload and show a user-facing error
      // instead of receiving a cryptic HTTP 413 from the server.
      const BUCKET_LIMIT_BYTES = 50 * 1024 * 1024; // 50 MB
      const fileInfo = await getInfoAsync(compressedUri);
      if (
        fileInfo.exists &&
        fileInfo.size !== undefined &&
        fileInfo.size > BUCKET_LIMIT_BYTES
      ) {
        throw new Error(t('betaVideo.errors.videoTooLargeAfterCompression'));
      }

      // For Phase 1, use the compressed video URI as the thumbnail source.
      // True client-side frame extraction is deferred to Phase 2 (AC-031
      // Phase 1 simplification clause).
      const localThumbnailUri = compressedUri;

      // AC-166 / AC-165: the uploadBetaVideo service uses upsert (ON CONFLICT on
      // user_id,route_id), so no manual delete step is needed here. The upsert
      // handles both the new-video and the replace case at the DB level.
      // The hasExistingVideo state is still used to show the replace reminder UI
      // to the user before they confirm (see warning text below).
      const video = await uploadBetaVideo(
        {
          route_id: routeId,
          localVideoUri: compressedUri,   // compressed, not asset.uri
          localThumbnailUri,
          duration_seconds: Math.max(durationSeconds, 0.1), // guard against 0
        },
        userId,
        (prog) => {
          // Remap upload progress to 50%–100% range (compression occupied 5%–50%)
          setProgress({ percent: Math.round(prog.percent / 2) + 50, phase: prog.phase });
        },
      );
      // After a successful replace, the "has existing video" state is still true
      // (there is now a new video for this route). No reset needed.
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

      {/* AC-166: replace reminder — shown when the user already has a video for this route */}
      {hasExistingVideo ? (
        <Text style={styles.replaceWarningText} testID="beta-video-replace-warning">
          {t('betaVideo.replaceWarning')}
        </Text>
      ) : null}

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
            <Text style={styles.progressTitle}>
              {progress?.phase === 'compressing'
                ? t('betaVideo.compressing')
                : t('betaVideo.uploading')}
            </Text>
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
    replaceWarningText: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.textSecondary,
      marginTop: theme.spacing.xs,
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
