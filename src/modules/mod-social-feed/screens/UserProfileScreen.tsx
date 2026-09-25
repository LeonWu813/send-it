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
 * Safe area: useSafeAreaInsets() + makeStyles(theme, topInset) pattern.
 *
 * Block/report interactions are NOT handled here — those belong to MOD-009.
 */

import type { Session } from '@supabase/supabase-js';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { supabase } from '../../../lib/supabase';
import { useTheme } from '../../../lib/theme';
import {
  fetchFollowerCounts,
  fetchIsFollowing,
  follow,
  unfollow,
} from '../social-feed-service';
import type { FollowerCounts } from '../types';

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
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOwnProfile = session.user.id === targetUserId;

  // ── Load profile data ───────────────────────────────────────────────────────

  const loadProfile = useCallback(async (): Promise<void> => {
    setError(null);
    try {
      const [profileResult, countsResult, followingResult] = await Promise.all([
        supabase
          .from('users')
          .select('id, display_name, avatar_url, bio, privacy_setting')
          .eq('id', targetUserId)
          .single(),
        fetchFollowerCounts(targetUserId),
        isOwnProfile ? Promise.resolve(false) : fetchIsFollowing(targetUserId),
      ]);

      if (profileResult.error) {
        throw new Error(t('socialFeed.errors.profileLoadFailed'));
      }

      setProfile(profileResult.data as TargetUserProfile);
      setCounts(countsResult);
      setIsFollowing(followingResult);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t('socialFeed.errors.profileLoadFailed');
      setError(message);
    }
  }, [targetUserId, isOwnProfile, t]);

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
    >
      {/* Back button */}
      <Pressable
        style={styles.backButton}
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel={t('common.back')}
        hitSlop={8}
      >
        <Text style={styles.backButtonText}>{t('common.back')}</Text>
      </Pressable>

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
        </>
      )}
    </ScrollView>
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
    backButton: {
      marginBottom: theme.spacing.md,
      alignSelf: 'flex-start',
    },
    backButtonText: {
      fontSize: theme.fontSize.md,
      color: theme.colors.primary,
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
  });
}
