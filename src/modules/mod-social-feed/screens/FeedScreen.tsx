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
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLayout, useTheme } from '../../../lib/theme';
import {
  AppText,
  Avatar,
  Card,
  EmptyState,
  FistBumpIcon,
  InlineError,
  Spinner,
} from '../../../components/ui';
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
  const { screenMargin } = useLayout();
  const styles = makeStyles(theme, insets.top, screenMargin);

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
        <Spinner size="large" color="primary" accessibilityLabel={t('common.loading')} />
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
      <AppText variant="largeTitle" style={styles.screenTitle}>
        {t('socialFeed.title')}
      </AppText>

      {/* Error banner */}
      {error !== null && (
        <InlineError
          variant="block"
          message={error}
          actionLabel={t('common.retry')}
          onAction={() => void handleRefresh()}
        />
      )}

      {/* Empty state */}
      {error === null && items.length === 0 && (
        <EmptyState variant="inline" description={t('socialFeed.empty')} />
      )}

      {/* Feed items — AC-053: no comment UI; likes only on beta_video items */}
      {items.map((item) =>
        item.item_type === 'ascent'
          ? renderAscentCard(item, styles, t)
          : renderBetaVideoCard(item, styles, t, likeMap, handleLikeToggle, theme),
      )}
    </ScrollView>
  );
}

// ── Feed card renderers ───────────────────────────────────────────────────────

type Translate = (key: string, opts?: Record<string, unknown>) => string;

function renderActorRow(
  item: FeedItem,
  styles: ReturnType<typeof makeStyles>,
): React.JSX.Element {
  return (
    <View style={styles.actorRow}>
      <Avatar size="md" uri={item.actor_avatar_url} name={item.actor_name} decorative />
      <View style={styles.actorInfo}>
        <AppText variant="subhead" weight="600" numberOfLines={1}>
          {item.actor_name}
        </AppText>
        <AppText variant="caption1" color="textSecondary">
          {formatDate(item.created_at)}
        </AppText>
      </View>
    </View>
  );
}

function renderAscentCard(
  item: FeedItem,
  styles: ReturnType<typeof makeStyles>,
  t: Translate,
): React.JSX.Element {
  return (
    <Card key={item.item_id} variant="static" padding={0}>
      {renderActorRow(item, styles)}

      {/* Ascent body — AC-053: NO like button on ascent items */}
      <View style={styles.cardBody}>
        <AppText variant="sectionHeader">{t('socialFeed.logged')}</AppText>
        <AppText variant="title1">{item.route_grade}</AppText>
        {item.ascent_style !== null && (
          <AppText variant="subhead" color="textSecondary" style={styles.ascentDetail}>
            {t(`sends.styles.${item.ascent_style}`)}
            {item.ascent_attempts !== null
              ? ` · ${t('sends.attemptsCount', { count: item.ascent_attempts })}`
              : ''}
          </AppText>
        )}
      </View>
    </Card>
  );
}

function renderBetaVideoCard(
  item: FeedItem,
  styles: ReturnType<typeof makeStyles>,
  t: Translate,
  likeMap: LikeMap,
  onLikeToggle: (itemId: string) => void,
  theme: ReturnType<typeof useTheme>['theme'],
): React.JSX.Element {
  const likeInfo = likeMap[item.item_id] ?? { like_count: 0, user_has_liked: false };

  return (
    <Card key={item.item_id} variant="static" padding={0}>
      {renderActorRow(item, styles)}

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
            <AppText variant="sectionHeader" color="onMedia">
              {t('betaVideo.sectionTitle')}
            </AppText>
            <AppText variant="title2" color="onMedia">
              {item.route_grade}
            </AppText>
          </View>
        </View>
      )}

      {/* Caption */}
      {item.video_caption !== null && (
        <AppText variant="subhead" color="textSecondary" style={styles.caption}>
          {item.video_caption}
        </AppText>
      )}

      {/* Like button — AC-052: only on beta_video items; AC-053: NOT on ascents */}
      <View style={styles.likeRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            likeInfo.user_has_liked
              ? t('socialFeed.unlike')
              : t('socialFeed.like')
          }
          accessibilityState={{ selected: likeInfo.user_has_liked }}
          style={styles.likeButton}
          onPress={() => onLikeToggle(item.item_id)}
        >
          <FistBumpIcon
            variant={likeInfo.user_has_liked ? 'filled' : 'outline'}
            size={theme.iconSize.md}
            color={likeInfo.user_has_liked ? theme.colors.primary : theme.colors.textSecondary}
          />
        </Pressable>
        {likeInfo.like_count > 0 && (
          <AppText variant="subhead" color="textSecondary" numeric>
            {likeInfo.like_count}
          </AppText>
        )}
      </View>
    </Card>
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
function makeStyles(
  theme: ReturnType<typeof useTheme>['theme'],
  topInset: number,
  screenMargin: number,
) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    contentContainer: {
      paddingTop: topInset + theme.spacing.md,
      paddingHorizontal: screenMargin,
      paddingBottom: theme.spacing.xxl,
      gap: theme.layout.cardGap,
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.colors.background,
    },
    screenTitle: {
      marginBottom: theme.spacing.sm,
    },
    actorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: theme.layout.cardPadding,
      gap: theme.spacing.smd,
    },
    actorInfo: {
      flex: 1,
    },
    cardBody: {
      paddingHorizontal: theme.layout.cardPadding,
      paddingBottom: theme.layout.cardPadding,
    },
    ascentDetail: {
      marginTop: theme.spacing.xs,
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
    videoOverlay: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: theme.colors.mediaScrim,
      paddingHorizontal: theme.layout.cardPadding,
      paddingVertical: theme.spacing.sm,
    },
    caption: {
      paddingHorizontal: theme.layout.cardPadding,
      paddingTop: theme.spacing.sm,
    },
    likeButton: {
      minWidth: theme.layout.minTouchTarget,
      minHeight: theme.layout.minTouchTarget,
      alignItems: 'center',
      justifyContent: 'center',
    },
    likeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.sm,
      gap: theme.layout.iconTextGap,
    },
  });
}
