/**
 * UserProfileScreen — view another user's public profile with follow/unfollow.
 *
 * AC-050: follow/unfollow any other user; counts reflect immediately.
 * AC-063 (privacy): if the target user has a `followers_only` profile, their
 * activity is not visible to non-followers. This screen shows basic profile info
 * to all authenticated users (per MOD-001 RLS: all authenticated users can read
 * the `users` table), but the activity list is omitted in Phase 1 (that is
 * MOD-008's surface). The follow/unfollow button is the primary action here.
 *
 * Stats section: fetchProfileStats cross-module import from mod-profile-history
 * (public service — permitted per production.md Cross-Module Imports convention).
 * The get_profile_stats RPC enforces privacy server-side; followers_only non-followers
 * receive zeroed stats — no special consumer-side handling needed.
 *
 * Three-dots sheet (AC-150): BottomSheet `list-single` (design system §32.10) with
 * "Report and block" (AC-151, one tap, with a consequence subtitle) and the
 * Block/Unblock toggle (AC-152). Only rendered when !isOwnProfile.
 *
 * Blocked state (AC-153): fetchBlockedUserIds() called in loadProfile() Promise.all.
 * If a block exists in either direction, shows "This profile isn't available".
 *
 * Design system v2.2 (§30, §32.10, §32.11): no screen-drawn back row; the AppShell `nested`
 * AppHeader owns back + title (swipe-back stays via SwipeBackWrapper). The profile header is a
 * Card (Avatar lg 64 + title3 name + footnote bio, counts, capsule Follow button). The "⋯" menu is a
 * floating `list-single` sheet. Page sections use `pageSection`.
 */

import type { Session } from '@supabase/supabase-js';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, View } from 'react-native';

import { fetchProfileStats } from '../../mod-profile-history/history-service';
import type { ProfileStats } from '../../mod-profile-history/types';
import {
  BetaVideoGrid,
  BetaVideoReelViewer,
  fetchBetaVideosByUser,
} from '../../mod-beta-video';
import type { BetaVideo } from '../../mod-beta-video';
import {
  blockUser,
  fetchBlockedUserIds,
  reportUser,
  unblockUser,
} from '../../mod-moderation/moderation-service';
import { supabase } from '../../../lib/supabase';
import { ICON } from '../../../lib/icons';
import { useLayout, useTheme } from '../../../lib/theme';
import { useAppHeader, useTabBarInset } from '@/lib/AppHeaderContext';
import SwipeBackWrapper from '../../../components/SwipeBackWrapper';
import {
  AppText,
  Avatar,
  BottomSheet,
  Button,
  Card,
  EmptyState,
  IconButton,
  InlineError,
  ListRow,
  Spinner,
} from '../../../components/ui';
import {
  fetchFollowerCounts,
  fetchIsFollowing,
  follow,
  unfollow,
} from '../social-feed-service';
import type { FollowerCounts } from '../types';

// ── Constants ──────────────────────────────────────────────────────────────────

/** Minimum bar width (px) so zero-count bars are still visible as a hairline. */
const BAR_MIN_WIDTH = 2;
/** Maximum bar track width — bar fills proportionally within this. */
const BAR_TRACK_WIDTH = 160;

// ── Types ─────────────────────────────────────────────────────────────────────

interface UserProfileScreenProps {
  /** UUID of the user whose profile is being viewed. */
  targetUserId: string;
  /** Authenticated session of the current user. */
  session: Session;
  /** Called when the back button is pressed. */
  onBack: () => void;
}

/** Minimal user profile fields needed for this screen. */
interface TargetUserProfile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  privacy_setting: 'public' | 'followers_only';
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function UserProfileScreen({
  targetUserId,
  session,
  onBack,
}: UserProfileScreenProps): React.JSX.Element {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const { screenMargin } = useLayout();
  const tabInset = useTabBarInset();
  const styles = makeStyles(theme, screenMargin);

  const [profile, setProfile] = useState<TargetUserProfile | null>(null);
  const [counts, setCounts] = useState<FollowerCounts>({ follower_count: 0, following_count: 0 });
  const [isFollowing, setIsFollowing] = useState(false);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // AC-153: blocked state
  const [isProfileBlocked, setIsProfileBlocked] = useState(false);
  const [isBlockedByMe, setIsBlockedByMe] = useState(false);

  // AC-150: sheet visibility
  const [sheetVisible, setSheetVisible] = useState(false);

  // AC-163: beta video grid + reel viewer
  const [betaVideos, setBetaVideos] = useState<BetaVideo[]>([]);
  const [reelStartIndex, setReelStartIndex] = useState(0);
  const [showReel, setShowReel] = useState(false);

  // Sheet action state
  const [sheetLoading, setSheetLoading] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);

  const isOwnProfile = session.user.id === targetUserId;

  // Tracks whether the first data load has completed. Used to decide whether to
  // show the full-screen loading spinner (first load only) or silently refetch
  // in the background on subsequent focus events.
  const hasLoadedOnce = useRef(false);

  // ── Load profile data ───────────────────────────────────────────────────────

  const loadProfile = useCallback(async (): Promise<void> => {
    setError(null);
    try {
      // AC-153: include fetchBlockedUserIds() in the Promise.all
      const [profileResult, countsResult, followingResult, statsResult, blockedIds, videosResult] =
        await Promise.all([
          supabase
            .from('users')
            .select('id, display_name, avatar_url, bio, privacy_setting')
            .eq('id', targetUserId)
            .single(),
          fetchFollowerCounts(targetUserId),
          isOwnProfile ? Promise.resolve(false) : fetchIsFollowing(targetUserId),
          fetchProfileStats(targetUserId).catch(() => null),
          // AC-153: fetch block set (both directions)
          isOwnProfile ? Promise.resolve(new Set<string>()) : fetchBlockedUserIds().catch(() => new Set<string>()),
          // AC-163: fetch beta videos for profile grid
          fetchBetaVideosByUser(targetUserId).catch(() => [] as BetaVideo[]),
        ]);

      if (profileResult.error) {
        throw new Error(t('socialFeed.errors.profileLoadFailed'));
      }

      setProfile(profileResult.data as TargetUserProfile);
      setCounts(countsResult);
      setIsFollowing(followingResult);
      setStats(statsResult);
      // AC-163: set beta videos (silently empty on error via .catch above)
      setBetaVideos(videosResult as BetaVideo[]);

      // AC-153: derive blocked states
      const blocked = blockedIds as Set<string>;
      const profileBlocked = blocked.has(targetUserId);
      setIsProfileBlocked(profileBlocked);

      // isBlockedByMe: check if viewer is the blocker (not just blocked by target).
      // fetchBlockedUserIds() returns both directions; to know if *I* blocked *them*,
      // check the blocks table for a row where blocker = me, blocked = target.
      if (profileBlocked) {
        const { data: myBlockRow } = await supabase
          .from('blocks')
          .select('blocked_user_id')
          .eq('blocker_user_id', session.user.id)
          .eq('blocked_user_id', targetUserId)
          .maybeSingle();
        setIsBlockedByMe(myBlockRow !== null);
      } else {
        setIsBlockedByMe(false);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t('socialFeed.errors.profileLoadFailed');
      setError(message);
    }
  }, [targetUserId, isOwnProfile, t, session.user.id]);

  // The screen is mounted as a conditional overlay (AppShell renders it only when
  // targetUserId is non-null). Each open is a fresh mount, so a plain useEffect
  // fires on every open — identical to the "every focus" behaviour useFocusEffect
  // was intended to provide, without requiring a NavigationContainer ancestor.
  useEffect(() => {
    if (!hasLoadedOnce.current) {
      setLoading(true);
    }
    void loadProfile().finally(() => {
      hasLoadedOnce.current = true;
      setLoading(false);
    });
  }, [loadProfile]);

  // ── Follow / Unfollow ───────────────────────────────────────────────────────

  const handleFollowToggle = useCallback(async (): Promise<void> => {
    setFollowLoading(true);
    const wasFollowing = isFollowing;

    // Optimistic update
    setIsFollowing(!wasFollowing);
    setCounts((prev) => ({
      ...prev,
      follower_count: prev.follower_count + (wasFollowing ? -1 : 1),
    }));

    try {
      if (wasFollowing) {
        await unfollow(targetUserId);
      } else {
        await follow(targetUserId);
      }
      // Re-fetch authoritative counts from DB
      const freshCounts = await fetchFollowerCounts(targetUserId);
      const freshIsFollowing = await fetchIsFollowing(targetUserId);
      setCounts(freshCounts);
      setIsFollowing(freshIsFollowing);
    } catch (err) {
      // Revert optimistic update
      setIsFollowing(wasFollowing);
      setCounts((prev) => ({
        ...prev,
        follower_count: prev.follower_count + (wasFollowing ? 1 : -1),
      }));
      const message =
        err instanceof Error ? err.message : t('socialFeed.errors.followFailed');
      setError(message);
    } finally {
      setFollowLoading(false);
    }
  }, [isFollowing, targetUserId, t]);

  // ── Sheet actions ───────────────────────────────────────────────────────────

  const handleReport = useCallback(async (): Promise<void> => {
    setSheetLoading(true);
    setSheetError(null);
    try {
      // AC-151: report then block sequentially
      await reportUser(targetUserId, 'inappropriate');
      await blockUser(targetUserId);
      // On success: close sheet, mark profile as blocked by me
      setSheetVisible(false);
      setIsProfileBlocked(true);
      setIsBlockedByMe(true);
    } catch (err) {
      void err;
      setSheetError(t('socialFeed.menu.actionFailed'));
    } finally {
      setSheetLoading(false);
    }
  }, [targetUserId, t]);

  const handleBlockToggle = useCallback(async (): Promise<void> => {
    setSheetLoading(true);
    setSheetError(null);
    try {
      if (isBlockedByMe) {
        // AC-152: unblock
        await unblockUser(targetUserId);
        setSheetVisible(false);
        setIsProfileBlocked(false);
        setIsBlockedByMe(false);
        // Reload profile now that the block is lifted
        void loadProfile();
      } else {
        // AC-152: block
        await blockUser(targetUserId);
        setSheetVisible(false);
        setIsProfileBlocked(true);
        setIsBlockedByMe(true);
      }
    } catch (err) {
      void err;
      setSheetError(t('socialFeed.menu.actionFailed'));
    } finally {
      setSheetLoading(false);
    }
  }, [isBlockedByMe, targetUserId, t, loadProfile]);

  // ── Render ──────────────────────────────────────────────────────────────────

  // Header (§30): back + title + "⋯" trailing. The AppShell overlay scope renders this nested header
  // above the screen, so content starts below it (no screen-drawn back/"⋯" row, no top safe-area padding).
  useAppHeader({
    title: profile?.display_name ?? '',
    onBack,
    trailing: !isOwnProfile && (!isProfileBlocked || isBlockedByMe) ? (
      <IconButton
        variant="float"
        name={ICON.more.outline}
        accessibilityLabel={t('socialFeed.moreOptions')}
        onPress={() => { setSheetVisible(true); }}
      />
    ) : undefined,
  });

  const actionSheet = !isOwnProfile ? (
    <ActionSheet
      visible={sheetVisible}
      onClose={() => { setSheetVisible(false); setSheetError(null); }}
      isBlockedByMe={isBlockedByMe}
      sheetLoading={sheetLoading}
      sheetError={sheetError}
      onReport={() => { void handleReport(); }}
      onBlockToggle={() => { void handleBlockToggle(); }}
      t={t}
    />
  ) : null;

  if (loading) {
    return (
      <SwipeBackWrapper onBack={onBack}>
        <View style={styles.centered}>
          <Spinner size="large" color="primary" accessibilityLabel={t('common.loading')} />
        </View>
      </SwipeBackWrapper>
    );
  }

  // Compute bar chart max for proportional widths
  const maxBarCount = stats !== null
    ? Math.max(...stats.sends_by_grade.filter((g) => g.count > 0).map((g) => g.count), 1)
    : 1;

  // AC-153: blocked state rendering
  if (isProfileBlocked) {
    return (
      <SwipeBackWrapper onBack={onBack} enabled={!sheetVisible}>
        <View style={styles.root}>
          {/* Blocked state message */}
          <View style={styles.centered}>
            <AppText variant="body" color="textSecondary" align="center" style={styles.profileUnavailableText}>
              {t('moderation.profileUnavailable')}
            </AppText>
          </View>

          {actionSheet}
        </View>
      </SwipeBackWrapper>
    );
  }

  return (
    <SwipeBackWrapper onBack={onBack} enabled={!sheetVisible && !showReel}>
      <ScrollView
        style={styles.root}
        contentContainerStyle={[styles.contentContainer, tabInset.contentBottom > 0 && { paddingBottom: tabInset.contentBottom }]}
        scrollIndicatorInsets={{ bottom: tabInset.indicatorBottom }}
        showsVerticalScrollIndicator={false}
      >
        {/* Error */}
        {error !== null && (
          <InlineError variant="block" message={error} style={styles.errorBlock} />
        )}

        {profile !== null && (
          <>
            {/* Profile header Card (§32.11): Avatar lg + name + info, counts, Follow button */}
            <Card variant="static" style={styles.profileCard}>
              <View style={styles.identityRow}>
                <Avatar
                  size="lg"
                  uri={profile.avatar_url}
                  name={profile.display_name}
                  decorative
                />
                <View style={styles.identityText}>
                  <AppText variant="title3" numberOfLines={2}>
                    {profile.display_name}
                  </AppText>
                  {profile.bio !== null && profile.bio !== '' && (
                    <AppText variant="footnote" color="textSecondary" style={styles.bio}>
                      {profile.bio}
                    </AppText>
                  )}
                  {profile.privacy_setting === 'followers_only' && (
                    <View style={styles.privateBadge}>
                      <Ionicons
                        name={ICON.locked.outline}
                        size={theme.iconSize.xs}
                        color={theme.colors.textSecondary}
                      />
                      <AppText variant="caption1" color="textSecondary">
                        {t('socialFeed.privateProfile')}
                      </AppText>
                    </View>
                  )}
                </View>
              </View>

              {/* Follower counts (AC-050: update immediately) */}
              <View style={styles.countsRow}>
                <View style={styles.countItem}>
                  <AppText variant="title2" numeric>{counts.follower_count}</AppText>
                  <AppText variant="caption1" color="textSecondary">{t('socialFeed.followers')}</AppText>
                </View>
                <View style={styles.countDivider} />
                <View style={styles.countItem}>
                  <AppText variant="title2" numeric>{counts.following_count}</AppText>
                  <AppText variant="caption1" color="textSecondary">{t('socialFeed.following')}</AppText>
                </View>
              </View>

              {/* Follow / Following button — hidden for own profile.
                  Following = text-only secondary capsule; its accessibility label stays "Unfollow". */}
              {!isOwnProfile && (
                <Button
                  variant={isFollowing ? 'secondary' : 'primary'}
                  size="md"
                  fullWidth
                  label={isFollowing ? t('socialFeed.following') : t('socialFeed.follow')}
                  accessibilityLabel={
                    isFollowing ? t('socialFeed.unfollow') : t('socialFeed.follow')
                  }
                  loading={followLoading}
                  onPress={() => void handleFollowToggle()}
                />
              )}
            </Card>

            {/* Stats section — shown when stats loaded successfully */}
            {stats !== null && (
              <>
                {/* Section divider */}
                <View style={styles.statsDivider} />

                {/* Summary row: Total Sends / Days Climbed / Best Grade */}
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <AppText variant="title2" numeric>{stats.total_sends}</AppText>
                    <AppText variant="caption1" color="textSecondary" align="center" style={styles.statLabel}>
                      {t('profileHistory.stats.totalSends')}
                    </AppText>
                  </View>
                  <View style={styles.statItemDivider} />
                  <View style={styles.statItem}>
                    <AppText variant="title2" numeric>{stats.accumulated_days}</AppText>
                    <AppText variant="caption1" color="textSecondary" align="center" style={styles.statLabel}>
                      {t('profileHistory.stats.accumulatedDays')}
                    </AppText>
                  </View>
                  <View style={styles.statItemDivider} />
                  <View style={styles.statItem}>
                    <AppText variant="title2" numeric>
                      {stats.highest_grade ?? t('profileHistory.stats.noGrade')}
                    </AppText>
                    <AppText variant="caption1" color="textSecondary" align="center" style={styles.statLabel}>
                      {t('profileHistory.stats.highestGrade')}
                    </AppText>
                  </View>
                </View>

                {/* Grade bar chart — only when there are sends */}
                {stats.total_sends > 0 && (
                  <View
                    style={styles.chartContainer}
                    accessibilityLabel={t('profileHistory.stats.chartA11y')}
                  >
                    <AppText variant="pageSection" style={styles.chartTitle}>
                      {t('profileHistory.stats.chartTitle')}
                    </AppText>
                    {stats.sends_by_grade
                      .filter(({ count }) => count > 0)
                      .map(({ grade, count }) => {
                        const barWidth = Math.max(
                          BAR_MIN_WIDTH,
                          Math.round((count / maxBarCount) * BAR_TRACK_WIDTH),
                        );
                        return (
                          <View key={grade} style={styles.barRow}>
                            <AppText variant="caption2" color="textSecondary" style={styles.barGradeLabel}>
                              {grade}
                            </AppText>
                            <View style={styles.barTrack}>
                              <View style={[styles.bar, { width: barWidth }]} />
                            </View>
                            <AppText variant="caption2" color="textSecondary" numeric align="right" style={styles.barCount}>
                              {count}
                            </AppText>
                          </View>
                        );
                      })}
                  </View>
                )}
              </>
            )}

            {/* AC-163: Beta video grid — below stats section.
                Subject to AC-063/AC-064 privacy gating: hidden/403 state for
                followers_only profiles when the viewer is not a follower. */}
            {profile.privacy_setting === 'followers_only' && !isFollowing ? null : (
              <View style={styles.videoSection}>
                <AppText variant="pageSection" style={styles.videoSectionTitle}>
                  {t('betaVideo.userVideos')}
                </AppText>
                <BetaVideoGrid
                  videos={betaVideos}
                  onPressVideo={(index) => {
                    setReelStartIndex(index);
                    setShowReel(true);
                  }}
                  emptyState={
                    <EmptyState variant="inline" description={t('betaVideo.noVideosYet')} />
                  }
                />
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* AC-163: BetaVideoReelViewer — rendered at top level to overlay correctly */}
      <BetaVideoReelViewer
        videos={betaVideos}
        initialIndex={reelStartIndex}
        visible={showReel}
        onDismiss={() => { setShowReel(false); }}
        session={session}
        reelContext="profile"
      />

      {/* AC-150: action sheet — rendered outside ScrollView */}
      {actionSheet}
    </SwipeBackWrapper>
  );
}

// ── ActionSheet component ─────────────────────────────────────────────────────

interface ActionSheetProps {
  visible: boolean;
  onClose: () => void;
  isBlockedByMe: boolean;
  sheetLoading: boolean;
  sheetError: string | null;
  onReport: () => void;
  onBlockToggle: () => void;
  t: (key: string) => string;
}

/**
 * "..." menu (design system §32.10 B): BottomSheet `list-single`. "Report and block" keeps its
 * one-tap behaviour but now says what will happen in its subtitle. No cancel row (close button).
 */
function ActionSheet({
  visible,
  onClose,
  isBlockedByMe,
  sheetLoading,
  sheetError,
  onReport,
  onBlockToggle,
  t,
}: ActionSheetProps): React.JSX.Element {
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      variant="list-single"
      loading={sheetLoading}
      error={sheetError ?? undefined}
    >
      {/* Report and block — AC-151 */}
      <ListRow
        variant="action"
        on="elevated"
        destructive
        leadingIcon={ICON.report.outline}
        title={t('moderation.sheetReport')}
        subtitle={t('moderation.sheetReportHint')}
        disabled={sheetLoading}
        onPress={onReport}
      />

      {/* Block / Unblock toggle — AC-152 */}
      <ListRow
        variant="action"
        on="elevated"
        destructive={!isBlockedByMe}
        leadingIcon={ICON.block.outline}
        title={isBlockedByMe ? t('moderation.sheetUnblock') : t('moderation.sheetBlock')}
        disabled={sheetLoading}
        divider={false}
        onPress={onBlockToggle}
      />
    </BottomSheet>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

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
    contentContainer: {
      paddingTop: theme.spacing.sm,
      paddingHorizontal: screenMargin,
      paddingBottom: theme.spacing.xxl,
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.colors.background,
    },
    profileUnavailableText: {
      paddingHorizontal: screenMargin,
    },
    errorBlock: {
      marginBottom: theme.spacing.md,
    },
    profileCard: {
      marginBottom: theme.layout.sectionGap,
    },
    identityRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
    },
    identityText: {
      flex: 1,
      alignItems: 'flex-start',
    },
    bio: {
      marginTop: theme.spacing.xs,
    },
    privateBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.layout.iconTextGap,
      borderWidth: theme.stroke.thin,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.full,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xxs,
      marginTop: theme.spacing.sm,
    },
    countsRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginVertical: theme.spacing.md,
    },
    countItem: {
      alignItems: 'center',
      paddingHorizontal: theme.spacing.xl,
    },
    countDivider: {
      alignSelf: 'stretch',
      width: theme.stroke.hairline,
      backgroundColor: theme.colors.divider,
    },
    // ── Stats section ────────────────────────────────────────────────────────
    statsDivider: {
      height: theme.stroke.hairline,
      backgroundColor: theme.colors.divider,
      marginVertical: theme.layout.sectionGap,
    },
    statsRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'center',
      marginBottom: theme.layout.sectionGap,
    },
    statItem: {
      alignItems: 'center',
      flex: 1,
    },
    statLabel: {
      marginTop: theme.spacing.xs,
    },
    statItemDivider: {
      alignSelf: 'stretch',
      width: theme.stroke.hairline,
      backgroundColor: theme.colors.divider,
    },
    chartContainer: {
      marginBottom: theme.layout.sectionGap,
    },
    chartTitle: {
      marginBottom: theme.layout.sectionHeaderGap,
    },
    barRow: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: theme.spacing.lg,
    },
    barGradeLabel: {
      minWidth: theme.spacing.xl,
    },
    barTrack: {
      flex: 1,
      height: theme.spacing.smd,
      backgroundColor: theme.colors.surfaceAlt,
      borderRadius: theme.radius.full,
      overflow: 'hidden',
    },
    bar: {
      height: '100%',
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radius.full,
    },
    barCount: {
      minWidth: theme.spacing.lg + theme.spacing.xs,
    },
    // ── Beta video grid section (AC-163) ─────────────────────────────────────
    videoSection: {
      paddingTop: theme.layout.sectionGap,
    },
    videoSectionTitle: {
      marginBottom: theme.layout.sectionHeaderGap,
    },
  });
}
