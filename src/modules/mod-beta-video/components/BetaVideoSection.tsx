/**
 * BetaVideoSection — the public entry point for MOD-005 on RouteDetailScreen.
 *
 * This component:
 *   1. Fetches beta videos for the given route.
 *   2. Renders inline video players (AC-033) for each video.
 *   3. Exposes the "Add beta video" upload launcher (AC-037).
 *
 * RouteDetailScreen imports ONLY this component from mod-beta-video (cross-module
 * import rule: never import internal screens/ or components/ directly from another
 * module — import only the public entry-point component).
 *
 * AC-032: each BetaVideo is attached to exactly one route (route_id pre-filled).
 * AC-033: inline playback without leaving the app.
 * AC-036: upload progress overlay is owned by BetaVideoUploader.
 * AC-037: "Add beta video" entry point visible on route detail screen.
 */

import type { Session } from '@supabase/supabase-js';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTheme } from '../../../lib/theme';
import { fetchBetaVideosForRoute, getThumbnailSignedUrl, getVideoSignedUrl } from '../beta-video-service';
import type { BetaVideo } from '../types';
import BetaVideoPlayer from './BetaVideoPlayer';
import BetaVideoUploader from './BetaVideoUploader';

interface BetaVideoSectionProps {
  /** The route whose beta videos to display. Pre-attached to the uploader (AC-037). */
  routeId: string;
  /** Authenticated session — used to derive userId for uploads. */
  session: Session;
}

/** A BetaVideo row paired with its signed URLs (signed at render time). */
interface SignedBetaVideo {
  video: BetaVideo;
  signedVideoUrl: string;
  signedThumbnailUrl: string | null;
}

export default function BetaVideoSection({
  routeId,
  session,
}: BetaVideoSectionProps): React.JSX.Element {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const styles = makeStyles(theme);

  const [betaVideos, setBetaVideos] = useState<SignedBetaVideo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadVideos = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const rows = await fetchBetaVideosForRoute(routeId);
      // Sign all URLs in parallel for fast render
      const signed = await Promise.all(
        rows.map(async (video): Promise<SignedBetaVideo> => {
          const [signedVideoUrl, signedThumbnailUrl] = await Promise.all([
            getVideoSignedUrl(video.video_url).catch(() => video.video_url),
            getThumbnailSignedUrl(video.thumbnail_url).catch(() => null),
          ]);
          return { video, signedVideoUrl, signedThumbnailUrl };
        }),
      );
      setBetaVideos(signed);
    } catch {
      setLoadError(t('betaVideo.errors.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [routeId, t]);

  useEffect(() => {
    void loadVideos();
  }, [loadVideos]);

  /**
   * AC-037: after a successful upload, prepend the new video to the list
   * and sign its URLs immediately so it appears without a full reload.
   */
  const handleUploadSuccess = useCallback(async (video: BetaVideo): Promise<void> => {
    const [signedVideoUrl, signedThumbnailUrl] = await Promise.all([
      getVideoSignedUrl(video.video_url).catch(() => video.video_url),
      getThumbnailSignedUrl(video.thumbnail_url).catch(() => null),
    ]);
    setBetaVideos((prev) => [{ video, signedVideoUrl, signedThumbnailUrl }, ...prev]);
  }, []);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={theme.colors.primary} size="small" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Section header */}
      <Text style={styles.sectionTitle}>{t('betaVideo.sectionTitle')}</Text>

      {/* Load error (non-fatal) */}
      {loadError ? (
        <Text style={styles.errorText}>{loadError}</Text>
      ) : null}

      {/* Empty state */}
      {!loadError && betaVideos.length === 0 ? (
        <Text style={styles.emptyText}>{t('betaVideo.noVideos')}</Text>
      ) : null}

      {/* AC-033: Inline video players */}
      {betaVideos.map(({ video, signedVideoUrl, signedThumbnailUrl }) => (
        <BetaVideoPlayer
          key={video.id}
          videoUrl={signedVideoUrl}
          thumbnailUrl={signedThumbnailUrl}
          durationSeconds={video.duration_seconds}
          caption={video.caption}
          testID={`beta-video-player-${video.id}`}
        />
      ))}

      {/* AC-037: "Add beta video" entry point with route context pre-attached */}
      <BetaVideoUploader
        routeId={routeId}
        userId={session.user.id}
        onUploadSuccess={(video) => { void handleUploadSuccess(video); }}
      />
    </View>
  );
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function makeStyles(theme: ReturnType<typeof useTheme>['theme']) {
  return StyleSheet.create({
    container: {
      marginTop: theme.spacing.xl,
    },
    loadingContainer: {
      marginTop: theme.spacing.xl,
      alignItems: 'center',
      paddingVertical: theme.spacing.md,
    },
    sectionTitle: {
      fontSize: theme.fontSize.xs,
      fontWeight: theme.fontWeight.semibold,
      color: theme.colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: theme.spacing.md,
    },
    emptyText: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.textDisabled,
      marginBottom: theme.spacing.sm,
    },
    errorText: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.error,
      marginBottom: theme.spacing.sm,
    },
  });
}
