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
 * Three-dots sheet (AC-150): Bottom action sheet with Report (AC-151) and
 * Block/Unblock toggle (AC-152). Only rendered when !isOwnProfile.
 *
 * Blocked state (AC-153): fetchBlockedUserIds() called in loadProfile() Promise.all.
 * If a block exists in either direction, shows "This profile isn't available".
 *
 * Safe area: useSafeAreaInsets() + makeStyles(theme, topInset) pattern.
 */

import type { Session } from '@supabase/supabase-js';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fetchProfileStats } from '../../mod-profile-history/history-service';
import type { ProfileStats } from '../../mod-profile-history/types';
import {
  blockUser,
  fetchBlockedUserIds,
  reportUser,
  unblockUser,
} from '../../mod-moderation/moderation-service';
import { supabase } from '../../../lib/supabase';
import { useTheme } from '../../../lib/theme';
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
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme, insets.top);

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

  // Sheet action state
  const [sheetLoading, setSheetLoading] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);

  const isOwnProfile = session.user.id === targetUserId;

  // ── Load profile data ───────────────────────────────────────────────────────

  const loadProfile = useCallback(async (): Promise<void> => {
    setError(null);
    try {
      // AC-153: include fetchBlockedUserIds() in the Promise.all
      const [profileResult, countsResult, followingResult, statsResult, blockedIds] =
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
        ]);

      if (profileResult.error) {
        throw new Error(t('socialFeed.errors.profileLoadFailed'));
      }

      setProfile(profileResult.data as TargetUserProfile);
      setCounts(countsResult);
      setIsFollowing(followingResult);
      setStats(statsResult);

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

  useEffect(() => {
    setLoading(true);
    void loadProfile().finally(() => setLoading(false));
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
      const message =
        err instanceof Error ? err.message : t('socialFeed.errors.profileLoadFailed');
      setSheetError(message);
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
      const message =
        err instanceof Error ? err.message : t('socialFeed.errors.profileLoadFailed');
      setSheetError(message);
    } finally {
      setSheetLoading(false);
    }
  }, [isBlockedByMe, targetUserId, t, loadProfile]);

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  // Compute bar chart max for proportional widths
  const maxBarCount = stats !== null
    ? Math.max(...stats.sends_by_grade.filter((g) => g.count > 0).map((g) => g.count), 1)
    : 1;

  // AC-153: blocked state rendering
  if (isProfileBlocked) {
    return (
      <View style={styles.root}>
        {/* Header row: back button + optional dots icon */}
        <View style={styles.blockedHeader}>
          <Pressable
            style={styles.backButton}
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            hitSlop={8}
          >
            <Text style={styles.backButtonText}>{t('common.back')}</Text>
          </Pressable>
          {/* Three-dots icon only shown when isBlockedByMe (viewer can unblock) */}
          {!isOwnProfile && isBlockedByMe && (
            <Pressable
              style={styles.dotsButton}
              onPress={() => { setSheetVisible(true); }}
              accessibilityRole="button"
              accessibilityLabel="More options"
              hitSlop={8}
            >
              <Ionicons name="ellipsis-vertical" size={22} color={theme.colors.textPrimary} />
            </Pressable>
          )}
        </View>

        {/* Blocked state message */}
        <View style={styles.centered}>
          <Text style={styles.profileUnavailableText}>
            {t('moderation.profileUnavailable')}
          </Text>
        </View>

        {/* Bottom action sheet (Modal) */}
        {!isOwnProfile && (
          <ActionSheet
            visible={sheetVisible}
            onClose={() => { setSheetVisible(false); setSheetError(null); }}
            isBlockedByMe={isBlockedByMe}
            sheetLoading={sheetLoading}
            sheetError={sheetError}
            onReport={() => { void handleReport(); }}
            onBlockToggle={() => { void handleBlockToggle(); }}
            theme={theme}
            insets={insets}
            t={t}
          />
        )}
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Header row: back button + dots icon */}
        <View style={styles.headerRow}>
          <Pressable
            style={styles.backButton}
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            hitSlop={8}
          >
            <Text style={styles.backButtonText}>{t('common.back')}</Text>
          </Pressable>

          {/* AC-150: three-dots icon, only for !isOwnProfile */}
          {!isOwnProfile && (
            <Pressable
              style={styles.dotsButton}
              onPress={() => { setSheetVisible(true); }}
              accessibilityRole="button"
              accessibilityLabel="More options"
              hitSlop={8}
            >
              <Ionicons name="ellipsis-vertical" size={22} color={theme.colors.textPrimary} />
            </Pressable>
          )}
        </View>

        {/* Error */}
        {error !== null && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {profile !== null && (
          <>
            {/* Avatar + name */}
            <View style={styles.avatarSection}>
              {profile.avatar_url !== null ? (
                <Image
                  source={{ uri: profile.avatar_url }}
                  style={styles.avatar}
                  accessibilityLabel={profile.display_name}
                />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]} />
              )}
              <Text style={styles.displayName}>{profile.display_name}</Text>
              {profile.bio !== null && profile.bio !== '' && (
                <Text style={styles.bio}>{profile.bio}</Text>
              )}
              {profile.privacy_setting === 'followers_only' && (
                <Text style={styles.privateBadge}>
                  {t('socialFeed.privateProfile')}
                </Text>
              )}
            </View>

            {/* Follower counts (AC-050: update immediately) */}
            <View style={styles.countsRow}>
              <View style={styles.countItem}>
                <Text style={styles.countValue}>{counts.follower_count}</Text>
                <Text style={styles.countLabel}>{t('socialFeed.followers')}</Text>
              </View>
              <View style={styles.countDivider} />
              <View style={styles.countItem}>
                <Text style={styles.countValue}>{counts.following_count}</Text>
                <Text style={styles.countLabel}>{t('socialFeed.following')}</Text>
              </View>
            </View>

            {/* Follow / Unfollow button — hidden for own profile */}
            {!isOwnProfile && (
              <Pressable
                style={[
                  styles.followButton,
                  isFollowing && styles.followButtonActive,
                  followLoading && styles.followButtonDisabled,
                ]}
                onPress={() => void handleFollowToggle()}
                disabled={followLoading}
                accessibilityRole="button"
                accessibilityLabel={
                  isFollowing
                    ? t('socialFeed.unfollow')
                    : t('socialFeed.follow')
                }
                accessibilityState={{ disabled: followLoading }}
              >
                {followLoading ? (
                  <ActivityIndicator size="small" color={theme.colors.textInverse} />
                ) : (
                  <Text
                    style={[
                      styles.followButtonText,
                      isFollowing && styles.followButtonTextActive,
                    ]}
                  >
                    {isFollowing ? t('socialFeed.unfollow') : t('socialFeed.follow')}
                  </Text>
                )}
              </Pressable>
            )}

            {/* Stats section — shown when stats loaded successfully */}
            {stats !== null && (
              <>
                {/* Section divider */}
                <View style={styles.statsDivider} />

                {/* Summary row: Total Sends / Days Climbed / Best Grade */}
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{stats.total_sends}</Text>
                    <Text style={styles.statLabel}>{t('profileHistory.stats.totalSends')}</Text>
                  </View>
                  <View style={styles.statItemDivider} />
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{stats.accumulated_days}</Text>
                    <Text style={styles.statLabel}>{t('profileHistory.stats.accumulatedDays')}</Text>
                  </View>
                  <View style={styles.statItemDivider} />
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>
                      {stats.highest_grade ?? t('profileHistory.stats.noGrade')}
                    </Text>
                    <Text style={styles.statLabel}>{t('profileHistory.stats.highestGrade')}</Text>
                  </View>
                </View>

                {/* Grade bar chart — only when there are sends */}
                {stats.total_sends > 0 && (
                  <View
                    style={styles.chartContainer}
                    accessibilityLabel={t('profileHistory.stats.chartA11y')}
                  >
                    <Text style={styles.chartTitle}>{t('profileHistory.stats.chartTitle')}</Text>
                    {stats.sends_by_grade
                      .filter(({ count }) => count > 0)
                      .map(({ grade, count }) => {
                        const barWidth = Math.max(
                          BAR_MIN_WIDTH,
                          Math.round((count / maxBarCount) * BAR_TRACK_WIDTH),
                        );
                        return (
                          <View key={grade} style={styles.barRow}>
                            <Text style={styles.barGradeLabel}>{grade}</Text>
                            <View style={styles.barTrack}>
                              <View style={[styles.bar, { width: barWidth }]} />
                            </View>
                            <Text style={styles.barCount}>{count}</Text>
                          </View>
                        );
                      })}
                  </View>
                )}
              </>
            )}
          </>
        )}
      </ScrollView>

      {/* AC-150: Bottom action sheet modal — rendered outside ScrollView */}
      {!isOwnProfile && (
        <ActionSheet
          visible={sheetVisible}
          onClose={() => { setSheetVisible(false); setSheetError(null); }}
          isBlockedByMe={isBlockedByMe}
          sheetLoading={sheetLoading}
          sheetError={sheetError}
          onReport={() => { void handleReport(); }}
          onBlockToggle={() => { void handleBlockToggle(); }}
          theme={theme}
          insets={insets}
          t={t}
        />
      )}
    </>
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
  theme: ReturnType<typeof useTheme>['theme'];
  insets: { bottom: number };
  t: (key: string) => string;
}

function ActionSheet({
  visible,
  onClose,
  isBlockedByMe,
  sheetLoading,
  sheetError,
  onReport,
  onBlockToggle,
  theme,
  insets,
  t,
}: ActionSheetProps): React.JSX.Element {
  const sheetStyles = makeSheetStyles(theme, insets.bottom);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      {/* Full-screen translucent overlay — tappable to dismiss */}
      <Pressable style={sheetStyles.overlay} onPress={onClose}>
        {/* Sheet panel — tap does NOT propagate to overlay */}
        <Pressable
          style={sheetStyles.sheet}
          onPress={(e) => { e.stopPropagation(); }}
          accessibilityRole="none"
        >
          {/* Drag handle */}
          <View style={sheetStyles.handleContainer}>
            <View style={sheetStyles.handle} />
          </View>

          {/* Inline error message */}
          {sheetError !== null && (
            <View style={sheetStyles.errorRow}>
              <Text style={sheetStyles.errorText}>{sheetError}</Text>
            </View>
          )}

          {/* Report option — AC-151 */}
          <Pressable
            style={sheetStyles.optionRow}
            onPress={onReport}
            disabled={sheetLoading}
            accessibilityRole="button"
          >
            {sheetLoading ? (
              <ActivityIndicator size="small" color={theme.colors.error} />
            ) : (
              <Text style={sheetStyles.reportText}>{t('moderation.sheetReport')}</Text>
            )}
          </Pressable>

          {/* Block / Unblock toggle — AC-152 */}
          <Pressable
            style={sheetStyles.optionRow}
            onPress={onBlockToggle}
            disabled={sheetLoading}
            accessibilityRole="button"
          >
            {sheetLoading ? (
              <ActivityIndicator size="small" color={theme.colors.textPrimary} />
            ) : (
              <Text style={sheetStyles.optionText}>
                {isBlockedByMe ? t('moderation.sheetUnblock') : t('moderation.sheetBlock')}
              </Text>
            )}
          </Pressable>

          {/* Cancel row */}
          <Pressable
            style={sheetStyles.optionRow}
            onPress={onClose}
            disabled={sheetLoading}
            accessibilityRole="button"
          >
            <Text style={sheetStyles.optionText}>{t('moderation.sheetCancel')}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
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
      paddingHorizontal: theme.spacing.lg,
      paddingBottom: theme.spacing.xxl,
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.colors.background,
    },
    // Header row containing back button and dots icon
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: theme.spacing.md,
    },
    // Used in blocked state where root is a plain View (not ScrollView)
    blockedHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: topInset + theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
    },
    backButton: {
      alignSelf: 'flex-start',
    },
    backButtonText: {
      fontSize: theme.fontSize.md,
      color: theme.colors.primary,
    },
    dotsButton: {
      alignSelf: 'flex-start',
    },
    profileUnavailableText: {
      fontSize: theme.fontSize.md,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      paddingHorizontal: theme.spacing.lg,
    },
    errorContainer: {
      padding: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      backgroundColor: theme.colors.error,
      marginBottom: theme.spacing.md,
    },
    errorText: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.textInverse,
    },
    avatarSection: {
      alignItems: 'center',
      marginBottom: theme.spacing.lg,
    },
    avatar: {
      width: 96,
      height: 96,
      borderRadius: theme.borderRadius.full,
      marginBottom: theme.spacing.md,
    },
    avatarPlaceholder: {
      backgroundColor: theme.colors.border,
    },
    displayName: {
      fontSize: theme.fontSize.xl,
      fontWeight: theme.fontWeight.bold,
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing.xs,
      textAlign: 'center',
    },
    bio: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginBottom: theme.spacing.xs,
    },
    privateBadge: {
      fontSize: theme.fontSize.xs,
      color: theme.colors.textSecondary,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.borderRadius.full,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 2,
      marginTop: theme.spacing.xs,
    },
    countsRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: theme.spacing.lg,
    },
    countItem: {
      alignItems: 'center',
      paddingHorizontal: theme.spacing.xl,
    },
    countValue: {
      fontSize: theme.fontSize.xl,
      fontWeight: theme.fontWeight.bold,
      color: theme.colors.textPrimary,
    },
    countLabel: {
      fontSize: theme.fontSize.xs,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    countDivider: {
      width: 1,
      height: 32,
      backgroundColor: theme.colors.border,
    },
    followButton: {
      paddingVertical: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
    },
    followButtonActive: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    followButtonDisabled: {
      opacity: 0.5,
    },
    followButtonText: {
      fontSize: theme.fontSize.md,
      fontWeight: theme.fontWeight.semibold,
      color: theme.colors.textInverse,
    },
    followButtonTextActive: {
      color: theme.colors.textPrimary,
    },
    // ── Stats section ────────────────────────────────────────────────────────
    statsDivider: {
      height: 1,
      backgroundColor: theme.colors.border,
      marginTop: theme.spacing.lg,
      marginBottom: theme.spacing.lg,
    },
    statsRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'center',
      marginBottom: theme.spacing.lg,
    },
    statItem: {
      alignItems: 'center',
      flex: 1,
    },
    statValue: {
      fontSize: theme.fontSize.xl,
      fontWeight: theme.fontWeight.bold,
      color: theme.colors.textPrimary,
    },
    statLabel: {
      fontSize: theme.fontSize.xs,
      color: theme.colors.textSecondary,
      marginTop: theme.spacing.xs,
      textAlign: 'center',
    },
    statItemDivider: {
      width: 1,
      height: 40,
      backgroundColor: theme.colors.border,
    },
    chartContainer: {
      marginBottom: theme.spacing.lg,
    },
    chartTitle: {
      fontSize: theme.fontSize.sm,
      fontWeight: theme.fontWeight.semibold,
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing.sm,
    },
    barRow: {
      flexDirection: 'row',
      alignItems: 'center',
      height: 24,
    },
    barGradeLabel: {
      width: 32,
      fontSize: theme.fontSize.xs,
      color: theme.colors.textSecondary,
    },
    barTrack: {
      flex: 1,
      height: 12,
      backgroundColor: theme.colors.divider,
      borderRadius: theme.borderRadius.sm,
      overflow: 'hidden',
    },
    bar: {
      height: '100%',
      backgroundColor: theme.colors.primary,
      borderRadius: theme.borderRadius.sm,
    },
    barCount: {
      width: 28,
      fontSize: theme.fontSize.xs,
      color: theme.colors.textSecondary,
      textAlign: 'right',
    },
  });
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function makeSheetStyles(theme: ReturnType<typeof useTheme>['theme'], bottomInset: number) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    sheet: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: theme.borderRadius.lg,
      borderTopRightRadius: theme.borderRadius.lg,
      paddingBottom: bottomInset + theme.spacing.lg,
    },
    handleContainer: {
      alignItems: 'center',
      paddingTop: theme.spacing.sm,
      paddingBottom: theme.spacing.md,
    },
    handle: {
      width: 40,
      height: 4,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.border,
    },
    errorRow: {
      paddingHorizontal: theme.spacing.lg,
      paddingBottom: theme.spacing.sm,
    },
    errorText: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.error,
    },
    optionRow: {
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
    },
    reportText: {
      fontSize: theme.fontSize.md,
      color: theme.colors.error,
    },
    optionText: {
      fontSize: theme.fontSize.md,
      color: theme.colors.textPrimary,
    },
  });
}
