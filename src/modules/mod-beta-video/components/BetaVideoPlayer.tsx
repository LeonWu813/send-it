/**
 * BetaVideoPlayer — inline video player for a single beta video.
 *
 * AC-033: plays beta videos inline on the route detail page without leaving the app.
 * AC-034: same component is used in the activity feed (MOD-006 embeds it).
 *
 * The component receives a signed video URL and signed thumbnail URL (callers
 * must sign storage paths before passing them in). It uses expo-video's VideoView
 * component for inline playback (SDK 57 successor to expo-av).
 *
 * Design system v1.2 (off-spec design work): everything on the video / thumbnail uses the fixed
 * media tokens (`onMedia` on `mediaScrim`), type roles come from AppText, glyph sizes from ICON.
 */

import { VideoView, useVideoPlayer } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, View } from 'react-native';
import { AppText } from '../../../components/ui/AppText';
import { PressableScale } from '../../../components/ui/PressableScale';
import { Spinner } from '../../../components/ui/ProgressBar';
import { ICON } from '../../../lib/icons';
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
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);

  const player = useVideoPlayer(videoUrl, (p) => {
    p.loop = false;
  });

  const handlePlayPress = useCallback((): void => {
    setIsPlaying(true);
    setIsBuffering(true);
    // expo-video's player starts loading on mount; we track buffering via status
    // and clear it when playback begins.
    const subscription = player.addListener('playingChange', () => {
      setIsBuffering(false);
      subscription.remove();
    });
    player.play();
  }, [player]);

  return (
    <View style={styles.container} testID={testID}>
      {!isPlaying ? (
        /* Thumbnail + play button overlay */
        <PressableScale
          feedback="row"
          style={styles.thumbnailContainer}
          onPress={handlePlayPress}
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
            <AppText variant="caption1" weight="600" numeric color="onMedia">
              {formatDuration(durationSeconds)}
            </AppText>
          </View>
          {/* Play button overlay */}
          <View style={styles.playOverlay}>
            <View style={styles.playButton}>
              <Ionicons name={ICON.play.filled} size={theme.iconSize.xl} color={theme.colors.onMedia} />
            </View>
          </View>
        </PressableScale>
      ) : (
        /* Active video player */
        <View style={styles.videoContainer}>
          <VideoView
            player={player}
            style={styles.video}
            contentFit="contain"
            nativeControls
          />
          {isBuffering ? (
            <View style={styles.bufferingOverlay}>
              <Spinner color="onMedia" size="large" />
            </View>
          ) : null}
        </View>
      )}
      {/* Optional caption */}
      {caption ? (
        <AppText variant="footnote" color="textSecondary" style={styles.caption}>
          {caption}
        </AppText>
      ) : null}
    </View>
  );
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function makeStyles(theme: ReturnType<typeof useTheme>['theme']) {
  return StyleSheet.create({
    container: {
      marginBottom: theme.spacing.md,
      borderRadius: theme.radius.media,
      overflow: 'hidden',
      backgroundColor: theme.colors.surfaceAlt,
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
      backgroundColor: theme.colors.surfaceAlt,
    },
    durationBadge: {
      position: 'absolute',
      bottom: theme.spacing.sm,
      right: theme.spacing.sm,
      backgroundColor: theme.colors.mediaScrim,
      borderRadius: theme.radius.minor,
      paddingHorizontal: theme.spacing.xs,
      paddingVertical: theme.spacing.xxs,
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
    // 44pt target + smd: a disc comfortably larger than the 28pt glyph.
    playButton: {
      width: theme.layout.minTouchTarget + theme.spacing.smd,
      height: theme.layout.minTouchTarget + theme.spacing.smd,
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors.mediaScrim,
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
      backgroundColor: theme.colors.mediaScrim,
    },
    caption: {
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
    },
  });
}
