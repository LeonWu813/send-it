/**
 * ProfileScreen.
 *
 * Displays the current user's profile: avatar, display name, bio.
 * Exposes an Edit Profile entry point (AC-117).
 * Embeds the MOD-008 send history surface (AC-118).
 * Renders the current user's own beta-video grid below the send history (AC-164).
 *
 * AC-116: shows display name, avatar, bio.
 * AC-117: "Edit Profile" navigates to EditProfileScreen.
 * AC-118: send history section via MOD-008 SendHistoryProfile.
 * AC-145: follower/following count links immediately below bio, tapping
 *          navigates to FollowersListScreen / FollowingListScreen.
 * AC-164: 3-column BetaVideoGrid below send history; tapping opens
 *          BetaVideoReelViewer with reelContext="profile".
 * AC-167: Logout control removed from ProfileScreen (moved to MOD-010 SettingsScreen).
 * AC-184: Notification bell and settings gear removed from ProfileScreen header —
 *          both controls now live on MOD-012's global app-level header.
 *
 * Page-review P-1 (DS v2.3): left-aligned header card (R13) with inline follower / following
 * counts, then the COMPACT StatsPanel row (3 tiles) which opens the pushed Profile History
 * (full StatsPanel: hero + chart), then the sends list. Content sits at screenMargin (R0).
 *
 * Scroll architecture: one Animated.FlatList is the sole scroll container (sends list), with the
 * header card + compact stats as ListHeaderComponent and the beta-video grid as ListFooterComponent.
 */

import type { Session } from '@supabase/supabase-js';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, StyleSheet, View } from 'react-native';
import SharedRouteCard from '../../../components/RouteCard';
import { AppText, Avatar, Button, Card, EmptyState, PressableScale, Spinner } from '../../../components/ui';
import { ICON } from '../../../lib/icons';
import { useLayout, useTheme } from '../../../lib/theme';
import {
  BetaVideoGrid,
  BetaVideoReelViewer,
  fetchBetaVideosByUser,
} from '../../mod-beta-video';
import type { BetaVideo } from '../../mod-beta-video';
import {
  fetchProfileHistory,
  fetchProfileStats,
  groupToRouteCards,
  StatsPanel,
  useOpenProfileHistory,
} from '../../mod-profile-history';
import type { ProfileStats, RouteCard } from '../../mod-profile-history';
import { fetchFollowerCounts } from '../../mod-social-feed';
import { useAppHeaderRoot } from '@/lib/AppHeaderContext';
import { useSession } from '../hooks/useSession';

/** Grows the follower / following target to 44pt without changing layout (A4). */
const FOLLOW_HIT_SLOP = { top: 12, bottom: 12, left: 8, right: 8 };

interface ProfileScreenProps {
  session: Session;
  onNavigateEditProfile: () => void;
  /** True when the Profile tab is the active tab. Used to trigger refetch on
   *  tab focus (AC-062) — the keep-alive pattern means the component never
   *  remounts on tab switch, so we increment refetchKey when isActive flips
   *  from false to true. */
  isActive?: boolean;
  /**
   * Callback invoked when the user taps a route card in the send history
   * surface. Switches to the Gyms tab and opens the route detail screen within
   * the correct gym's route list.
   */
  onNavigateToRoute?: (routeId: string, gymId: string) => void;
  /** Callback to navigate to the FollowersListScreen (AC-145). */
  onNavigateToFollowers?: () => void;
  /** Callback to navigate to the FollowingListScreen (AC-145). */
  onNavigateToFollowing?: () => void;
}

export default function ProfileScreen({
  session: _session,
  onNavigateEditProfile,
  isActive = false,
  onNavigateToRoute,
  onNavigateToFollowers,
  onNavigateToFollowing,
}: ProfileScreenProps): React.JSX.Element {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const { screenMargin } = useLayout();
  // v2.2: bind the list (owned by SendHistoryProfile) to the AppShell header and TabBar insets.
  const h = useAppHeaderRoot();
  const styles = makeStyles(theme, screenMargin);

  const { profile } = useSession();

  // AC-145: follower/following counts — loaded on mount; 0 placeholder during load.
  // On fetch failure, counts remain at 0 (non-critical display, no error banner).
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  // Sends list + compact stats (P-1). `loaded` flips after the first fetch settles.
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [routeCards, setRouteCards] = useState<RouteCard[]>([]);
  const [loaded, setLoaded] = useState(false);
  const openHistory = useOpenProfileHistory();

  // AC-164: beta video grid state.
  const [betaVideos, setBetaVideos] = useState<BetaVideo[]>([]);
  const [reelStartIndex, setReelStartIndex] = useState(0);
  const [showReel, setShowReel] = useState(false);

  // AC-062: Increment refetchKey each time the Profile tab becomes active so
  // the stats + sends list re-fetch even though the component never
  // unmounts (keep-alive display:none pattern in AppShell).
  const [refetchKey, setRefetchKey] = useState(0);
  useEffect(() => {
    if (isActive) setRefetchKey((prev) => prev + 1);
  }, [isActive]);
  useEffect(() => {
    if (refetchKey > 0 && hasLoadedOnce.current) void loadData();
  }, [refetchKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tracks whether the first data load has completed. Used to decide whether to
  // show a loading state (first load only) or silently refetch in the background
  // on subsequent focus events without resetting counts/videos to empty.
  const hasLoadedOnce = useRef(false);

  // AC-145 + AC-164: Memoised fetch — does NOT reset state before fetching so
  // existing data stays visible during a silent background refresh (no flash).
  const loadData = useCallback(async (): Promise<void> => {
    if (!profile?.id) return;
    const userId = profile.id;
    const [counts, videos, history, statsData] = await Promise.all([
      fetchFollowerCounts(userId),
      fetchBetaVideosByUser(userId),
      fetchProfileHistory(userId).catch(() => []),
      fetchProfileStats(userId).catch(() => null),
    ]);
    setFollowerCount(counts.follower_count);
    setFollowingCount(counts.following_count);
    setBetaVideos(videos);
    setRouteCards(groupToRouteCards(history));
    setStats(statsData);
    setLoaded(true);
    hasLoadedOnce.current = true;
  }, [profile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Initial load: fires on mount once profile.id is available.
  // Keep-alive pattern — no NavigationContainer, no useFocusEffect.
  useEffect(() => {
    if (!profile?.id) return;
    void loadData();
  }, [profile?.id, loadData]);

  // ── Profile header (AC-116 + AC-117 + AC-145) ───────────────────────────────
  // Passed as listHeaderComponent to SendHistoryProfile so it scrolls with
  // the FlatList rather than requiring a wrapping ScrollView.
  // AC-184: Notification bell and settings gear are NOT rendered here — they
  //         live on MOD-012's global app-level header.
  const hasRecords = routeCards.length > 0 || (stats?.total_sends ?? 0) > 0;
  const profileHeader = (
    <View style={styles.headerContainer}>
      {/* R13: left-aligned header card; avatar beside name + inline counts (AC-116, AC-145) */}
      <Card variant="static" style={styles.headerCard}>
        <View style={styles.identityRow}>
          <Avatar size="lg" uri={profile?.avatar_url} name={profile?.display_name} decorative />
          <View style={styles.identityText}>
            <AppText variant="title2" numberOfLines={1}>
              {profile?.display_name ?? ''}
            </AppText>
            <View style={styles.followCountsRow}>
              <PressableScale
                feedback="row"
                pressedColor={theme.colors.surfaceAltPressed}
                style={styles.followCountItem}
                hitSlop={FOLLOW_HIT_SLOP}
                onPress={onNavigateToFollowers}
                accessibilityRole="button"
                accessibilityLabel={`${followerCount} ${t('socialFeed.followers')}`}
              >
                <AppText variant="headline" numeric>
                  {followerCount}
                </AppText>
                <AppText variant="footnote" color="textSecondary">
                  {t('socialFeed.followers')}
                </AppText>
              </PressableScale>
              <PressableScale
                feedback="row"
                pressedColor={theme.colors.surfaceAltPressed}
                style={styles.followCountItem}
                hitSlop={FOLLOW_HIT_SLOP}
                onPress={onNavigateToFollowing}
                accessibilityRole="button"
                accessibilityLabel={`${followingCount} ${t('socialFeed.following')}`}
              >
                <AppText variant="headline" numeric>
                  {followingCount}
                </AppText>
                <AppText variant="footnote" color="textSecondary">
                  {t('socialFeed.following')}
                </AppText>
              </PressableScale>
            </View>
          </View>
        </View>
        {profile?.bio ? (
          <AppText variant="body" color="textSecondary">
            {profile.bio}
          </AppText>
        ) : null}
        {/* Edit Profile entry (AC-117) */}
        <Button
          label={t('profile.editProfile')}
          onPress={onNavigateEditProfile}
          variant="secondary"
          size="md"
          fullWidth
          accessibilityLabel={t('profile.editProfile')}
        />
      </Card>

      {/* P-1: compact stats row; opens Profile History (full StatsPanel) */}
      {stats ? (
        <StatsPanel
          variant="compact"
          stats={stats}
          onOpenDetails={profile?.id ? () => openHistory(profile.id, true) : undefined}
        />
      ) : null}

      {hasRecords ? (
        <AppText variant="pageSection" accessibilityRole="header">
          {t('profile.sendHistory')}
        </AppText>
      ) : null}
    </View>
  );

  // ── Profile footer (AC-164) ───────────────────────────────────────────────
  // Beta-video grid section — passed as listFooterComponent to SendHistoryProfile
  // so it appears after the send history list and scrolls with it.
  // AC-167: Logout button removed from ProfileScreen (moved to MOD-010 SettingsScreen).
  const profileFooter = (
    <View style={styles.videoSectionContainer}>
      <AppText variant="pageSection" style={styles.videoSectionTitle}>
        {t('betaVideo.myVideos')}
      </AppText>
      <BetaVideoGrid
        videos={betaVideos}
        onPressVideo={(index) => {
          setReelStartIndex(index);
          setShowReel(true);
        }}
        horizontalPadding={screenMargin}
        emptyState={
          <AppText
            variant="footnote"
            color="textSecondary"
            align="center"
            style={styles.videoSectionEmpty}
          >
            {t('betaVideo.noVideosYet')}
          </AppText>
        }
      />
    </View>
  );

  // ── Root: FlatList (sends list) is the sole scroll container ────────────────
  const listEmpty = !loaded ? (
    <Spinner />
  ) : hasRecords ? null : (
    <EmptyState variant="inline" description={t('profileHistory.empty')} icon={ICON.sends.outline} />
  );

  return (
    <View style={styles.root}>
      <Animated.FlatList
        data={routeCards}
        keyExtractor={(item) => item.route_id}
        renderItem={({ item }) => {
          return (
            <SharedRouteCard
              route={{
                id: item.route_id,
                name: item.grade,
                grade: item.grade,
                photo_url: item.photo_url,
                gymName: item.gym_name,
                colorTag: item.color_tag ?? undefined,
                section: item.section_label,
              }}
              onPress={() => onNavigateToRoute?.(item.route_id, item.gym_id)}
            />
          );
        }}
        ItemSeparatorComponent={() => <View style={{ height: theme.layout.cardGap }} />}
        ListHeaderComponent={profileHeader}
        ListEmptyComponent={listEmpty}
        ListFooterComponent={profileFooter}
        showsVerticalScrollIndicator={false}
        onScroll={h.onScroll}
        onContentSizeChange={h.onContentSizeChange}
        onLayout={h.onLayout}
        scrollEventThrottle={h.scrollEventThrottle}
        contentContainerStyle={{
          paddingTop: h.contentTopInset,
          paddingBottom: h.contentBottomInset,
          paddingHorizontal: screenMargin,
        }}
        scrollIndicatorInsets={{ top: h.contentTopInset, bottom: h.indicatorBottomInset }}
      />

      {/* AC-164: Beta video reel viewer — rendered as a fullscreen Modal overlay */}
      {showReel ? (
        <BetaVideoReelViewer
          videos={betaVideos}
          initialIndex={reelStartIndex}
          visible={showReel}
          onDismiss={() => { setShowReel(false); }}
          session={_session}
          reelContext="profile"
        />
      ) : null}
    </View>
  );
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function makeStyles(
  theme: ReturnType<typeof useTheme>['theme'],
  screenMargin: number,
) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    // R0: the list's contentContainer owns screenMargin; sections add no horizontal padding.
    headerContainer: {
      paddingTop: theme.spacing.md,
      paddingBottom: theme.spacing.md,
      gap: theme.spacing.md,
    },
    headerCard: {
      gap: theme.spacing.md,
    },
    identityRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
    },
    identityText: {
      flex: 1,
      gap: theme.spacing.xs,
    },
    // AC-145: inline follower / following counts
    followCountsRow: {
      flexDirection: 'row',
      gap: theme.spacing.lg,
    },
    // A4: no minHeight here (it inflated the text block below the avatar's centre);
    // the 44pt target comes from hitSlop on the Pressable instead.
    followCountItem: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: theme.spacing.xs,
    },
    // AC-164: beta-video grid section (listFooterComponent)
    videoSectionContainer: {
      paddingTop: theme.layout.sectionGap,
      paddingBottom: theme.spacing.xl,
    },
    videoSectionTitle: {
      marginBottom: theme.spacing.sm,
    },
    videoSectionEmpty: {
      paddingVertical: theme.spacing.lg,
      paddingHorizontal: theme.spacing.lg,
    },
  });
}
