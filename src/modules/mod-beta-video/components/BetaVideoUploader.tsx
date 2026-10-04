/**
 * BetaVideoUploader — video selection and upload flow for a single route.
 *
 * AC-030: rejects videos longer than 60 seconds before upload begins.
 * AC-031 (Rev 26): picker uses iOS `Automatic` mode — HEVC/HLG is transcoded to
 *         H.264 SDR by iOS before the URI is returned. The picker-returned file is
 *         uploaded directly after the AC-169 size gate passes. No client-side
 *         compression step.
 * AC-035: validates that the selected video file is an MP4 or MOV container
 *         before upload (PRD Revision 12 — .mov accepted for iPhone-camera
 *         footage). If validation fails, surfaces a clear error and does not
 *         upload.
 * AC-036 (Rev 24): progress overlay covers a single "Uploading…" phase (0–100%).
 *         There is no "Compressing…" phase — compression removed in Rev 24.
 *         The overlay blocks further interaction until upload completes or fails.
 * AC-037: receives route_id so the upload is bound to the correct route.
 * AC-166 (Rev 28): upload control is always enabled. On activation, if
 *         hasExistingVideo === true (cached from mount-time checkExistingBetaVideo
 *         call), a confirmation dialog is shown before opening the picker.
 *         Confirming proceeds to the picker; cancelling dismisses with no action.
 *         No disabled-button state; no "delete first" static message.
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
  Alert,
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
  /**
   * AC-130: When provided, BetaVideoUploader registers its handleSelectVideo
   * function via this callback so the parent (BetaVideoSection) can wire it
   * through to the external launcher ref (RouteDetailScreen's header button).
   * This is the single upload implementation — no duplicate logic in BetaVideoSection.
   */
  onRegisterSelectHandler?: (fn: () => Promise<void>) => void;
  /**
   * AC-130: When true, the visible "Add beta video" button is not rendered.
   * The progress modal and all AC logic remain active.
   * Used when the upload trigger lives outside the section (header button).
   */
  hideButton?: boolean;
}

// AC-161: no per-upload visibility/privacy toggle exists in this component.
// Beta-video visibility is the account-level users.beta_video_privacy setting
// (AC-156/AC-157), not a per-upload field.

export default function BetaVideoUploader({
  routeId,
  userId,
  onUploadSuccess,
  onUploadError,
  onRegisterSelectHandler,
  hideButton = false,
}: BetaVideoUploaderProps): React.JSX.Element {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const styles = makeStyles(theme);

  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // AC-166 (Rev 28): check whether the user already has a video for this route on
  // mount. Cached in state — do NOT re-call checkExistingBetaVideo on every tap.
  // If true, a confirmation dialog is shown before the picker opens (see handleSelectVideo).
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

    // AC-166 (Rev 28): if user already has a video, confirm before opening picker.
    // Uses the cached hasExistingVideo state (set on mount) — no re-fetch on tap.
    if (hasExistingVideo) {
      const confirmed = await new Promise<boolean>((resolve) => {
        Alert.alert(
          t('betaVideo.replaceConfirmTitle'),
          t('betaVideo.replaceConfirmMessage'),
          [
            {
              text: t('betaVideo.replaceConfirmCancel'),
              style: 'cancel',
              onPress: () => resolve(false),
            },
            {
              text: t('betaVideo.replaceConfirmOk'),
              style: 'destructive',
              onPress: () => resolve(true),
            },
          ],
          { cancelable: false },
        );
      });
      if (!confirmed) return;
    }

    // Request permissions
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      const msg = t('betaVideo.errors.permissionDenied');
      setErrorMessage(msg);
      onUploadError?.(msg);
      return;
    }

    // Launch picker — video only, max 60 seconds enforced by the picker.
    // AC-031 (Rev 26): omit preferredAssetRepresentationMode so iOS uses Automatic mode,
    // which transcodes HEVC/HLG → H.264 SDR before returning the URI — preventing
    // overexposure in expo-video's VideoView (Phase 1 limitation; Phase 2 fixes properly).
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      videoMaxDuration: MAX_DURATION_SECONDS,
      allowsEditing: false,
      quality: 1, // No quality reduction — native file is uploaded as-is (AC-031 Rev 26)
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
      // AC-166 (Rev 28) / AC-165: the uploadBetaVideo service uses upsert (ON CONFLICT
      // on user_id,route_id), so no manual delete step is needed here. The upsert
      // handles both the new-video and the replace case at the DB level.
      // The confirmation dialog (shown above when hasExistingVideo === true) ensures
      // the user has explicitly confirmed the replacement before reaching this point.
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
      // After a successful replace, the "has existing video" state remains true
      // (there is still a video for this route — just a new one). No reset needed.
      onUploadSuccess(video);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('betaVideo.errors.uploadFailed');
      setErrorMessage(msg);
      onUploadError?.(msg);
    } finally {
      setIsUploading(false);
      setProgress(null);
    }
  }, [hasExistingVideo, routeId, userId, onUploadSuccess, onUploadError, t]);

  /**
   * AC-130: Register handleSelectVideo with the parent so the external launcher
   * (RouteDetailScreen's header button) can invoke the single upload implementation
   * that includes AC-166 dialog, AC-169 size gate, and all other AC logic.
   * Called once after handleSelectVideo is stable (useCallback identity).
   */
  useEffect(() => {
    onRegisterSelectHandler?.(handleSelectVideo);
  }, [onRegisterSelectHandler, handleSelectVideo]);

  return (
    <>
      {/* AC-037: "Add beta video" entry point — visible on route detail screen.
          AC-166 (Rev 28): upload control is always enabled. When hasExistingVideo
          is true, a confirmation dialog is shown (handleSelectVideo) before the
          picker opens — no disabled-button state, no "delete first" message.
          AC-130: hideButton=true suppresses this button when the trigger is the
          external header button registered via onRegisterSelectHandler. */}
      {hideButton ? null : (
        <Pressable
          style={styles.addButton}
          onPress={() => { void handleSelectVideo(); }}
          disabled={isUploading}
          accessibilityRole="button"
          accessibilityLabel={t('betaVideo.addVideo')}
          accessibilityState={{ disabled: isUploading }}
        >
          <Ionicons
            name="videocam-outline"
            size={18}
            color={theme.colors.primary}
          />
          <Text style={styles.addButtonText}>
            {t('betaVideo.addVideo')}
          </Text>
        </Pressable>
      )}

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
