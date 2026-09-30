/**
 * FollowingListScreen — list of users the profile owner follows.
 *
 * AC-147: Following list screen showing circular avatar, display_name,
 *         total sends count, and highest grade per card. Same card layout
 *         as FollowersListScreen (AC-146). Tapping a card navigates to
 *         that user's profile. Blocked users are excluded.
 *
 * AC-148: Per-card sends count and highest grade are sourced from
 *         fetchProfileStats (MOD-008 / mod-profile-history), fetched
 *         lazily per visible card via useEffect inside the card component.
 *
 * Cross-module import: fetchProfileStats from mod-profile-history/history-service
 * is a public service — permitted per production.md Cross-Module Imports convention.
 *
 * Blocked users are filtered client-side using fetchBlockedUserIds()
 * from mod-moderation (AC-082, AC-084). Both directions are covered:
 * users the current user has blocked AND users who have blocked the current user.
 *
 * Safe area: useSafeAreaInsets() + makeStyles(theme, topInset) pattern.
 * Navigation bar: chevron-back icon + "返回"/"Back" label, title "追蹤中"/"Following".
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fetchProfileStats } from '../../mod-profile-history/history-service';
import type { ProfileStats } from '../../mod-profile-history/types';
import { fetchBlockedUserIds } from '../../mod-moderation/moderation-service';
import { useTheme } from '../../../lib/theme';
import { fetchFollowingList } from '../social-feed-service';
import type { UserListItem } from '../types';

// ── Props ─────────────────────────────────────────────────────────────────────

export interface FollowingListScreenProps {
  /** UUID of the profile being viewed. */
  userId: string;
  /** Called when the back button is pressed. */
  onBack: () => void;
  /** Called when the user taps a card to navigate to that user's profile. */
  onNavigateToUser: (userId: string) => void;
}

// ── Per-card stats hook ───────────────────────────────────────────────────────

interface CardStats {
  totalSends: number;
  highestGrade: string | null;
  loaded: boolean;
}

function useCardStats(cardUserId: string): CardStats {
  const [stats, setStats] = useState<CardStats>({
    totalSends: 0,
    highestGrade: null,
    loaded: false,
  });

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const result: ProfileStats = await fetchProfileStats(cardUserId);
        if (!cancelled) {
          setStats({
            totalSends: result.total_sends,
            highestGrade: result.highest_grade,
            loaded: true,
          });
        }
      } catch {
        // On error, leave placeholder values — no spinner per spec
        if (!cancelled) {
          setStats((prev) => ({ ...prev, loaded: true }));
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [cardUserId]);

  return stats;
}

// ── User card component ───────────────────────────────────────────────────────

interface UserCardProps {
  item: UserListItem;
  onPress: (userId: string) => void;
  theme: ReturnType<typeof useTheme>['theme'];
}

function UserCard({ item, onPress, theme }: UserCardProps): React.JSX.Element {
  const { t } = useTranslation('common');
  const cardStats = useCardStats(item.userId);
  const styles = makeCardStyles(theme);

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() => { onPress(item.userId); }}
      accessibilityRole="button"
      accessibilityLabel={item.displayName}
    >
      {/* Circular avatar */}
      {item.avatarUrl !== null ? (
        <Image
          source={{ uri: item.avatarUrl }}
          style={styles.avatar}
          accessibilityLabel={item.displayName}
        />
      ) : (
        <View style={[styles.avatar, styles.avatarPlaceholder]} />
      )}

      {/* User info */}
      <View style={styles.info}>
        <Text style={styles.displayName} numberOfLines={1}>
          {item.displayName}
        </Text>
        <Text style={styles.statLine} numberOfLines={1}>
          {t('socialFeed.sends', { count: cardStats.totalSends })}
          {'  '}
          {cardStats.highestGrade !== null
            ? t('socialFeed.highestGrade', { grade: cardStats.highestGrade })
            : t('socialFeed.noGrade')}
        </Text>
      </View>
    </Pressable>
  );
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function makeCardStyles(theme: ReturnType<typeof useTheme>['theme']) {
  return StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      backgroundColor: theme.colors.background,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.divider,
    },
    cardPressed: {
      backgroundColor: theme.colors.surface,
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: theme.borderRadius.full,
      marginRight: theme.spacing.md,
    },
    avatarPlaceholder: {
      backgroundColor: theme.colors.border,
    },
    info: {
      flex: 1,
    },
    displayName: {
      fontSize: theme.fontSize.md,
      fontWeight: theme.fontWeight.bold,
      color: theme.colors.textPrimary,
      marginBottom: 2,
    },
    statLine: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.textSecondary,
    },
  });
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function FollowingListScreen({
  userId,
  onBack,
  onNavigateToUser,
}: FollowingListScreenProps): React.JSX.Element {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme, insets.top);

  const [users, setUsers] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFollowing = useCallback(async (): Promise<void> => {
    setError(null);
    try {
      const [rawList, blockedIds] = await Promise.all([
        fetchFollowingList(userId),
        fetchBlockedUserIds(),
      ]);
      // Filter out blocked users (both directions — AC-082, AC-084)
      const filtered = rawList.filter((u) => !blockedIds.has(u.userId));
      setUsers(filtered);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t('socialFeed.errors.loadFailed');
      setError(message);
    }
  }, [userId, t]);

  useEffect(() => {
    setLoading(true);
    void loadFollowing().finally(() => { setLoading(false); });
  }, [loadFollowing]);

  // ── Render ────────────────────────────────────────────────────────────────

  function renderContent(): React.JSX.Element {
    if (loading) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      );
    }

    if (error !== null) {
      return (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      );
    }

    return (
      <FlatList
        data={users}
        keyExtractor={(item) => item.userId}
        renderItem={({ item }) => (
          <UserCard
            item={item}
            onPress={onNavigateToUser}
            theme={theme}
          />
        )}
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={styles.emptyText}>{t('socialFeed.noFollowing')}</Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />
    );
  }

  return (
    <View style={styles.root}>
      {/* Navigation bar */}
      <View style={styles.navBar}>
        <Pressable
          style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel={t('settings.back')}
        >
          <Ionicons name="chevron-back" size={20} color={theme.colors.primary} />
          <Text style={styles.backButtonText}>{t('settings.back')}</Text>
        </Pressable>
        <Text style={styles.navTitle}>{t('socialFeed.following')}</Text>
        <View style={styles.navSpacer} />
      </View>

      {renderContent()}
    </View>
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
    navBar: {
      paddingTop: topInset + theme.spacing.md,
      paddingBottom: theme.spacing.md,
      paddingHorizontal: theme.spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      backgroundColor: theme.colors.background,
    },
    backButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      paddingVertical: theme.spacing.xs,
      paddingHorizontal: theme.spacing.xs,
      borderRadius: theme.borderRadius.md,
      minWidth: 60,
    },
    backButtonPressed: {
      backgroundColor: theme.colors.surface,
    },
    backButtonText: {
      fontSize: theme.fontSize.md,
      color: theme.colors.primary,
      fontWeight: theme.fontWeight.medium,
    },
    navTitle: {
      flex: 1,
      textAlign: 'center',
      fontSize: theme.fontSize.lg,
      fontWeight: theme.fontWeight.semibold,
      color: theme.colors.textPrimary,
    },
    navSpacer: {
      width: 60,
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: theme.spacing.xl,
    },
    emptyText: {
      fontSize: theme.fontSize.md,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    errorText: {
      fontSize: theme.fontSize.md,
      color: theme.colors.error,
      textAlign: 'center',
    },
  });
}
