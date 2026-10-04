/**
 * BetaVideoUploader — video selection and upload flow for a single route.
 *
 * AC-030: rejects videos longer than 60 seconds before upload begins.
 * AC-031 (Rev 24): uploads the original native video file as-is (no compression).
 *         No react-native-compressor step. The native file is uploaded directly
 *         after the upfront AC-169 size gate passes.
 * AC-035: validates that the selected video file is an MP4 or MOV container
 *         before upload (PRD Revision 12 — .mov accepted for iPhone-camera
 *         footage). If validation fails, surfaces a clear error and does not
 *         upload.
 * AC-036 (Rev 24): progress overlay covers a single "Uploading…" phase (0–100%).
 *         There is no "Compressing…" phase — compression removed in Rev 24.
 *         The overlay blocks further interaction until upload completes or fails.
 * AC-037: receives route_id so the upload is bound to the correct route.
 * AC-169 (Rev 24): upfront native file size gate — runs before upload begins.
 *         If native file size >= 45 MB or cannot be read, upload is rejected.
 *         Fails closed: size === 0 means unreadable, treated as oversized.
 */

import { File as ExpoFile } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
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
   * AC-030: Check duration before upload begins.
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

    // Launch picker — video only, max 60 seconds enforced by the picker.
    // AC-031 (Rev 24): preferredAssetRepresentationMode.Current tells PHPickerViewController
    // to return the original representation of the asset (no transcoding). Without this,
    // iOS PHPicker defaults to UIImagePickerPreferredAssetRepresentationMode.Automatic which
    // can transcode HEVC/HDR video to H.264/SDR before returning the URI — defeating the
    // intent of uploading the native file as-is. Setting Current skips that transcoding so
    // the URI we receive points to the original HEVC/HDR file.
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      videoMaxDuration: MAX_DURATION_SECONDS,
      allowsEditing: false,
      quality: 1, // No quality reduction — native file is uploaded as-is (AC-031 Rev 24)
      preferredAssetRepresentationMode:
        ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current,
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

    // AC-169 (Rev 24): upfront native file size gate — runs before upload, no compression ever.
    // Fail-closed: size === 0 means unreadable, treat as oversized.
    const BUCKET_LIMIT_BYTES = 45 * 1_000_000; // 45 MB decimal
    const nativeFile = new ExpoFile(asset.uri);
    const nativeSize = nativeFile.size;
    if (nativeSize === 0 || nativeSize > BUCKET_LIMIT_BYTES) {
      const msg = t('betaVideo.errors.videoTooLargeAfterCompression');
      setErrorMessage(msg);
      onUploadError?.(msg);
      return;
    }

    // Duration in seconds for storage
    const durationSeconds = (asset.duration ?? 0) / 1000;

    setIsUploading(true);

    try {
      // AC-031 (Rev 24): upload the original native file as-is — no compression step.
      // AC-166 / AC-165: the uploadBetaVideo service uses upsert (ON CONFLICT on
      // user_id,route_id), so no manual delete step is needed here. The upsert
      // handles both the new-video and the replace case at the DB level.
      // The hasExistingVideo state is still used to show the replace reminder UI
      // to the user before they confirm (see warning text below).
      const video = await uploadBetaVideo(
        {
          route_id: routeId,
          localVideoUri: asset.uri,   // native file, no compression
          localThumbnailUri: asset.uri, // Phase 1 placeholder: same URI as video (AC-031 Phase 1 simplification)
          duration_seconds: Math.max(durationSeconds, 0.1), // guard against 0
        },
        userId,
        (prog) => {
          // AC-036 (Rev 24): upload progress maps directly 0–100% (no compression phase).
          setProgress({ percent: prog.percent, phase: prog.phase });
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
      {/* AC-037: "Add beta video" entry point — visible on route detail screen.
          Bug fix: when hasExistingVideo is true, the button is disabled and greyed
          out. The user must delete their existing video first. This is a UI-level
          block only — the DB UNIQUE (user_id, route_id) constraint and upsert
          logic in beta-video-service remain unchanged (AC-165). */}
      <Pressable
        style={[styles.addButton, hasExistingVideo && styles.addButtonDisabled]}
        onPress={() => { void handleSelectVideo(); }}
        disabled={isUploading || hasExistingVideo}
        accessibilityRole="button"
        accessibilityLabel={t('betaVideo.addVideo')}
        accessibilityState={{ disabled: isUploading || hasExistingVideo }}
      >
        <Ionicons
          name="videocam-outline"
          size={18}
          color={hasExistingVideo ? theme.colors.textDisabled : theme.colors.primary}
        />
        <Text style={[styles.addButtonText, hasExistingVideo && styles.addButtonTextDisabled]}>
          {t('betaVideo.addVideo')}
        </Text>
      </Pressable>

      {/* AC-166 (revised): when the user already has a video for this route, show a
          blocking message instead of the old replace reminder. The button is disabled
          above — this message explains why. */}
      {hasExistingVideo ? (
        <Text style={styles.alreadyHasVideoText} testID="beta-video-already-has-video">
          {t('betaVideo.alreadyHasVideo')}
        </Text>
      ) : null}

      {/* Inline error message */}
      {errorMessage ? (
        <Text style={styles.errorText}>{errorMessage}</Text>
      ) : null}

      {/* AC-036 (Rev 24): Progress overlay — single "Uploading…" phase, blocks further interaction */}
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
              {t('betaVideo.uploading')}
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
    /** Applied on top of addButton when the user already has a video for this route. */
    addButtonDisabled: {
      borderColor: theme.colors.textDisabled,
      opacity: 0.6,
    },
    addButtonText: {
      fontSize: theme.fontSize.sm,
      fontWeight: theme.fontWeight.medium,
      color: theme.colors.primary,
    },
    addButtonTextDisabled: {
      color: theme.colors.textDisabled,
    },
    /**
     * Shown instead of replaceWarningText when the user already has a video
     * for this route. The button is disabled — this message explains why and
     * instructs the user to delete first.
     */
    alreadyHasVideoText: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.textSecondary,
      marginTop: theme.spacing.xs,
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
