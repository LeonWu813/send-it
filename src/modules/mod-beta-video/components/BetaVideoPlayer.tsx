/**
 * BetaVideoPlayer — inline video player for a single beta video.
 *
 * AC-033: plays beta videos inline on the route detail page without leaving the app.
 * AC-034: same component is used in the activity feed (MOD-006 embeds it).
 *
 * The component receives a signed video URL and signed thumbnail URL (callers
 * must sign storage paths before passing them in). It uses expo-av's Video
 * component for inline playback.
 *
 * Note on expo-av Video component (Expo SDK 57 / expo-av 15.x):
 * The legacy Video component from expo-av is used here (not expo-video) because
 * expo-av is the installed package. The Video component renders inline via
 * useNativeControls and resizeMode="contain".
 */

import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import React, { useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTheme } from '../../../lib/theme';

interface BetaVideoPlayerProps {
  /** Signed URL for the video (valid for ~1 hour). */
  videoUrl: string;
  /** Signed URL for the thumbnail image shown before playback begins. */
  thumbnailUrl: string | null;
  /** Duration label shown on the thumbnail (e.g. "0:45"). */
  durationSeconds: number;
  /** Optional user caption shown below the player. */
  caption: string | null;
  /** Test ID for automated testing. */
  testID?: string;
}

/**
 * Format duration seconds into "M:SS" display string.
 */
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function BetaVideoPlayer({
  videoUrl,
  thumbnailUrl,
  durationSeconds,
  caption,
  testID,
}: BetaVideoPlayerProps): React.JSX.Element {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const videoRef = useRef<Video>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);

  const handlePlayPress = useCallback((): void => {
    setIsPlaying(true);
    setIsBuffering(true);
  }, []);

  const handlePlaybackStatusUpdate = useCallback(
    (status: { isLoaded?: boolean; isPlaying?: boolean; isBuffering?: boolean }): void => {
      if (status.isLoaded) {
        setIsBuffering(status.isBuffering ?? false);
      }
    },
    [],
  );

  return (
    <View style={styles.container} testID={testID}>
      {!isPlaying ? (
        /* Thumbnail + play button overlay */
        <Pressable
          style={styles.thumbnailContainer}
          onPress={handlePlayPress}
          accessibilityRole="button"
          accessibilityLabel={t('betaVideo.player.play')}
        >
          {thumbnailUrl ? (
            <Image
              source={{ uri: thumbnailUrl }}
              style={styles.thumbnail}
              resizeMode="cover"
              accessibilityLabel={t('betaVideo.player.thumbnailAlt')}
            />
          ) : (
            <View style={[styles.thumbnail, styles.thumbnailPlaceholder]} />
          )}
          {/* Duration badge */}
          <View style={styles.durationBadge}>
            <Text style={styles.durationText}>{formatDuration(durationSeconds)}</Text>
          </View>
          {/* Play button overlay */}
          <View style={styles.playOverlay}>
            <View style={styles.playButton}>
              <Ionicons name="play" size={28} color={theme.colors.textInverse} />
            </View>
          </View>
        </Pressable>
      ) : (
        /* Active video player */
        <View style={styles.videoContainer}>
          <Video
            ref={videoRef}
            source={{ uri: videoUrl }}
            style={styles.video}
            resizeMode={ResizeMode.CONTAIN}
            useNativeControls
            shouldPlay
            onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
          />
          {isBuffering ? (
            <View style={styles.bufferingOverlay}>
              <ActivityIndicator color={theme.colors.textInverse} size="large" />
            </View>
          ) : null}
        </View>
      )}
      {/* Optional caption */}
      {caption ? (
        <Text style={styles.caption}>{caption}</Text>
      ) : null}
    </View>
  );
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function makeStyles(theme: ReturnType<typeof useTheme>['theme']) {
  return StyleSheet.create({
    container: {
      marginBottom: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      overflow: 'hidden',
      backgroundColor: theme.colors.surface,
    },
    thumbnailContainer: {
      width: '100%',
      aspectRatio: 16 / 9,
      position: 'relative',
    },
    thumbnail: {
      width: '100%',
      height: '100%',
    },
    thumbnailPlaceholder: {
      backgroundColor: theme.colors.textDisabled,
    },
    durationBadge: {
      position: 'absolute',
      bottom: theme.spacing.sm,
      right: theme.spacing.sm,
      backgroundColor: theme.colors.overlay,
      borderRadius: theme.borderRadius.sm,
      paddingHorizontal: theme.spacing.xs,
      paddingVertical: 2,
    },
    durationText: {
      color: theme.colors.textInverse,
      fontSize: theme.fontSize.xs,
      fontWeight: theme.fontWeight.semibold,
    },
    playOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    playButton: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: theme.colors.overlay,
      alignItems: 'center',
      justifyContent: 'center',
    },
    videoContainer: {
      width: '100%',
      aspectRatio: 16 / 9,
    },
    video: {
      width: '100%',
      height: '100%',
    },
    bufferingOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.overlay,
    },
    caption: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.textSecondary,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
    },
  });
}
