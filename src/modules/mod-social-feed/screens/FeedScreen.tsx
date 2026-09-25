/**
 * FeedScreen — Activity feed for MOD-006 (AC-051, AC-052, AC-053).
 *
 * Renders a chronological list of sends (ascents) and beta videos from users
 * the current user follows. The feed is loaded via the `get_activity_feed`
 * SECURITY INVOKER RPC — raw client-side SELECT on ascents/beta_videos is
 * prohibited (spec hard requirement).
 *
 * AC-051: new activity from followed users appears within one refresh cycle
 *         (pull-to-refresh is provided).
 * AC-052: beta video items show a like button; like count updates immediately.
 * AC-053: no comment UI anywhere; no like affordance on ascent items.
 *
 * Safe area: useSafeAreaInsets() + makeStyles(theme, topInset) pattern.
 */

import type { Session } from '@supabase/supabase-js';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../../lib/theme';
import {
  fetchActivityFeed,
  fetchLikeInfo,
  likeBetaVideo,
  unlikeBetaVideo,
} from '../social-feed-service';
import type { FeedItem, LikeInfo } from '../types';

// ── Types ─────────────────────────────────────────────────────────────────────

interface FeedScreenProps {
  session: Session;
}

/** Like state tracked per-item (keyed by item_id). */
type LikeMap = Record<string, LikeInfo>;

// ── Component ─────────────────────────────────────────────────────────────────

export default function FeedScreen({ session: _session }: FeedScreenProps): React.JSX.Element {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme, insets.top);

  const [items, setItems] = useState<FeedItem[]>([]);
  const [likeMap, setLikeMap] = useState<LikeMap>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Load feed ───────────────────────────────────────────────────────────────

  const loadFeed = useCallback(async (): Promise<void> => {
    setError(null);
    try {
      const feedItems = await fetchActivityFeed();
      setItems(feedItems);

      // Pre-fetch like info for all beta_video items (batched, not N+1 per item).
      const videoItems = feedItems.filter((item) => item.item_type === 'beta_video');
      if (videoItems.length > 0) {
        const likeResults = await Promise.all(
          videoItems.map((item) =>
            fetchLikeInfo(item.item_id).then((info) => ({ id: item.item_id, info })),
          ),
        );
        const map: LikeMap = {};
        for (const { id, info } of likeResults) {
          map[id] = info;
        }
        setLikeMap(map);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t('socialFeed.errors.loadFailed');
      setError(message);
    }
  }, [t]);

  useEffect(() => {
    setLoading(true);
    void loadFeed().finally(() => setLoading(false));
  }, [loadFeed]);

  const handleRefresh = useCallback(async (): Promise<void> => {
    setRefreshing(true);
    await loadFeed().finally(() => setRefreshing(false));
  }, [loadFeed]);

  // ── Like toggle ─────────────────────────────────────────────────────────────

  const handleLikeToggle = useCallback(
    async (itemId: string): Promise<void> => {
      const current = likeMap[itemId];
      const wasLiked = current?.user_has_liked ?? false;

      // Optimistic update
      setLikeMap((prev) => ({
        ...prev,
        [itemId]: {
          like_count: (prev[itemId]?.like_count ?? 0) + (wasLiked ? -1 : 1),
          user_has_liked: !wasLiked,
        },
      }));

      try {
        if (wasLiked) {
          await unlikeBetaVideo(itemId);
        } else {
          await likeBetaVideo(itemId);
        }
        // Re-fetch authoritative count from DB
        const info = await fetchLikeInfo(itemId);
        setLikeMap((prev) => ({ ...prev, [itemId]: info }));
      } catch {
        // Revert optimistic update on failure
        setLikeMap((prev) => ({
          ...prev,
          [itemId]: current ?? { like_count: 0, user_has_liked: false },
        }));
      }
    },
    [likeMap],
  );

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void handleRefresh()}
          tintColor={theme.colors.primary}
        />
      }
    >
      {/* Screen title */}
      <Text style={styles.screenTitle}>{t('socialFeed.title')}</Text>

      {/* Error banner */}
      {error !== null && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable
            onPress={() => void handleRefresh()}
            accessibilityRole="button"
            accessibilityLabel={t('common.retry')}
          >
            <Text style={styles.retryText}>{t('common.retry')}</Text>
          </Pressable>
        </View>
      )}

      {/* Empty state */}
      {error === null && items.length === 0 && (
        <Text style={styles.emptyText}>{t('socialFeed.empty')}</Text>
      )}

      {/* Feed items — AC-053: no comment UI; likes only on beta_video items */}
      {items.map((item) =>
        item.item_type === 'ascent'
          ? renderAscentCard(item, styles, theme, t)
          : renderBetaVideoCard(item, styles, theme, t, likeMap, handleLikeToggle),
      )}
    </ScrollView>
  );
}

// ── Feed card renderers ───────────────────────────────────────────────────────

function renderAscentCard(
  item: FeedItem,
  styles: ReturnType<typeof makeStyles>,
  theme: ReturnType<typeof useTheme>['theme'],
  t: (key: string, opts?: Record<string, unknown>) => string,
): React.JSX.Element {
  return (
    <View key={item.item_id} style={styles.feedCard}>
      {/* Actor row */}
      <View style={styles.actorRow}>
        {item.actor_avatar_url ? (
          <Image
            source={{ uri: item.actor_avatar_url }}
            style={styles.avatar}
            accessibilityLabel={item.actor_name}
          />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]} />
        )}
        <View style={styles.actorInfo}>
          <Text style={styles.actorName}>{item.actor_name}</Text>
          <Text style={styles.timestamp}>{formatDate(item.created_at)}</Text>
        </View>
      </View>

      {/* Ascent body — AC-053: NO like button on ascent items */}
      <View style={styles.cardBody}>
        <Text style={styles.cardLabel}>{t('socialFeed.logged')}</Text>
        <Text style={styles.grade}>{item.route_grade}</Text>
        {item.ascent_style !== null && (
          <Text style={styles.ascentDetail}>
            {t(`sends.styles.${item.ascent_style}`)}
            {item.ascent_attempts !== null
              ? ` · ${t('sends.attemptsCount', { count: item.ascent_attempts })}`
              : ''}
          </Text>
        )}
      </View>
    </View>
  );
}

function renderBetaVideoCard(
  item: FeedItem,
  styles: ReturnType<typeof makeStyles>,
  theme: ReturnType<typeof useTheme>['theme'],
  t: (key: string, opts?: Record<string, unknown>) => string,
  likeMap: LikeMap,
  onLikeToggle: (itemId: string) => void,
): React.JSX.Element {
  const likeInfo = likeMap[item.item_id] ?? { like_count: 0, user_has_liked: false };

  return (
    <View key={item.item_id} style={styles.feedCard}>
      {/* Actor row */}
      <View style={styles.actorRow}>
        {item.actor_avatar_url ? (
          <Image
            source={{ uri: item.actor_avatar_url }}
            style={styles.avatar}
            accessibilityLabel={item.actor_name}
          />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]} />
        )}
        <View style={styles.actorInfo}>
          <Text style={styles.actorName}>{item.actor_name}</Text>
          <Text style={styles.timestamp}>{formatDate(item.created_at)}</Text>
        </View>
      </View>

      {/* Thumbnail */}
      {item.thumbnail_url !== null && (
        <View style={styles.thumbnailContainer}>
          <Image
            source={{ uri: item.thumbnail_url }}
            style={styles.thumbnail}
            resizeMode="cover"
            accessibilityLabel={t('betaVideo.player.thumbnailAlt')}
          />
          <View style={styles.videoOverlay}>
            <Text style={styles.videoLabel}>{t('betaVideo.sectionTitle')}</Text>
            <Text style={styles.grade}>{item.route_grade}</Text>
          </View>
        </View>
      )}

      {/* Caption */}
      {item.video_caption !== null && (
        <Text style={styles.caption}>{item.video_caption}</Text>
      )}

      {/* Like button — AC-052: only on beta_video items; AC-053: NOT on ascents */}
      <View style={styles.likeRow}>
        <Pressable
          style={styles.likeButton}
          onPress={() => onLikeToggle(item.item_id)}
          accessibilityRole="button"
          accessibilityLabel={
            likeInfo.user_has_liked
              ? t('socialFeed.unlike')
              : t('socialFeed.like')
          }
          accessibilityState={{ selected: likeInfo.user_has_liked }}
          hitSlop={8}
        >
          <Text
            style={[
              styles.likeIcon,
              likeInfo.user_has_liked && { color: theme.colors.error },
            ]}
          >
            {likeInfo.user_has_liked ? '♥' : '♡'}
          </Text>
        </Pressable>
        {likeInfo.like_count > 0 && (
          <Text style={styles.likeCount}>{likeInfo.like_count}</Text>
        )}
      </View>
    </View>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Format an ISO timestamp as a short readable date (locale-agnostic). */
function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    // e.g. "Sep 24"
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

// ── Styles ────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function makeStyles(theme: ReturnType<typeof useTheme>['theme'], topInset: number) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    contentContainer: {
      paddingTop: topInset + theme.spacing.md,
      paddingBottom: theme.spacing.xxl,
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.colors.background,
    },
    screenTitle: {
      fontSize: theme.fontSize.xl,
      fontWeight: theme.fontWeight.semibold,
      color: theme.colors.textPrimary,
      paddingHorizontal: theme.spacing.md,
      marginBottom: theme.spacing.md,
    },
    errorContainer: {
      margin: theme.spacing.md,
      padding: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      backgroundColor: theme.colors.error,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    errorText: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.textInverse,
      flex: 1,
    },
    retryText: {
      fontSize: theme.fontSize.sm,
      fontWeight: theme.fontWeight.semibold,
      color: theme.colors.textInverse,
      marginLeft: theme.spacing.sm,
    },
    emptyText: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.textSecondary,
      paddingHorizontal: theme.spacing.md,
      marginTop: theme.spacing.lg,
    },
    feedCard: {
      marginHorizontal: theme.spacing.md,
      marginBottom: theme.spacing.md,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.lg,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    actorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: theme.spacing.md,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: theme.borderRadius.full,
      marginRight: theme.spacing.sm,
    },
    avatarPlaceholder: {
      backgroundColor: theme.colors.border,
    },
    actorInfo: {
      flex: 1,
    },
    actorName: {
      fontSize: theme.fontSize.sm,
      fontWeight: theme.fontWeight.semibold,
      color: theme.colors.textPrimary,
    },
    timestamp: {
      fontSize: theme.fontSize.xs,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    cardBody: {
      paddingHorizontal: theme.spacing.md,
      paddingBottom: theme.spacing.md,
    },
    cardLabel: {
      fontSize: theme.fontSize.xs,
      fontWeight: theme.fontWeight.semibold,
      color: theme.colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: theme.spacing.xs,
    },
    grade: {
      fontSize: theme.fontSize.xl,
      fontWeight: theme.fontWeight.bold,
      color: theme.colors.textPrimary,
    },
    ascentDetail: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.textSecondary,
      marginTop: theme.spacing.xs,
    },
    thumbnailContainer: {
      width: '100%',
      height: 200,
      position: 'relative',
    },
    thumbnail: {
      width: '100%',
      height: '100%',
    },
    videoOverlay: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: 'rgba(0,0,0,0.45)',
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
    },
    videoLabel: {
      fontSize: theme.fontSize.xs,
      fontWeight: theme.fontWeight.semibold,
      color: theme.colors.textInverse,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    caption: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.textSecondary,
      paddingHorizontal: theme.spacing.md,
      paddingTop: theme.spacing.sm,
    },
    likeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderTopWidth: 1,
      borderTopColor: theme.colors.divider,
    },
    likeButton: {
      paddingRight: theme.spacing.xs,
    },
    likeIcon: {
      fontSize: theme.fontSize.xl,
      color: theme.colors.textSecondary,
    },
    likeCount: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.textSecondary,
      marginLeft: theme.spacing.xs,
    },
  });
}

