/**
 * BlockedAccountsScreen — list of users the current user has blocked (AC-155).
 *
 * Nav bar: chevron-back + back label text (same pattern as SettingsScreen) +
 * centered title ("Blocked Accounts" / "已封鎖的帳號").
 *
 * On mount: fetches fetchMyBlockedUsers() from mod-moderation.
 * Loading state: ActivityIndicator centered.
 * Error state: error text with retry.
 * Each row: circular 48×48 avatar + display_name + "Unblock" outlined button.
 * Unblock tap: calls unblockUser(), removes entry optimistically, re-fetches
 *              on error.
 * Empty state: "No blocked accounts" / "沒有已封鎖的帳號".
 *
 * useSafeAreaInsets() + useTheme() — no hardcoded hex.
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

import {
  fetchMyBlockedUsers,
  unblockUser,
} from '../../mod-moderation/moderation-service';
import type { BlockedUser } from '../../mod-moderation/moderation-service';
import { useTheme } from '../../../lib/theme';
import SwipeBackWrapper from '../../../components/SwipeBackWrapper';

// ── Props ─────────────────────────────────────────────────────────────────────

export interface BlockedAccountsScreenProps {
  onBack: () => void;
}

// ── Row component ─────────────────────────────────────────────────────────────

interface BlockedUserRowProps {
  item: BlockedUser;
  onUnblock: (userId: string) => void;
  theme: ReturnType<typeof useTheme>['theme'];
  unblockLabel: string;
}

function BlockedUserRow({
  item,
  onUnblock,
  theme,
  unblockLabel,
}: BlockedUserRowProps): React.JSX.Element {
  const styles = makeRowStyles(theme);

  return (
    <View style={styles.row}>
      {/* Circular avatar — same 48×48 pattern as FollowersListScreen */}
      {item.avatarUrl !== null ? (
        <Image
          source={{ uri: item.avatarUrl }}
          style={styles.avatar}
          accessibilityLabel={item.displayName}
        />
      ) : (
        <View style={[styles.avatar, styles.avatarPlaceholder]} />
      )}

      {/* Display name */}
      <Text style={styles.displayName} numberOfLines={1}>
        {item.displayName}
      </Text>

      {/* Unblock button — outlined, primary color */}
      <Pressable
        style={({ pressed }) => [
          styles.unblockButton,
          pressed && styles.unblockButtonPressed,
        ]}
        onPress={() => { onUnblock(item.userId); }}
        accessibilityRole="button"
        accessibilityLabel={unblockLabel}
      >
        <Text style={styles.unblockButtonText}>{unblockLabel}</Text>
      </Pressable>
    </View>
  );
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function makeRowStyles(theme: ReturnType<typeof useTheme>['theme']) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      // card-less list: rows sit on surface, not directly on the sand background
      backgroundColor: theme.colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.divider,
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: theme.borderRadius.full,
      marginRight: theme.spacing.md,
    },
    avatarPlaceholder: {
      backgroundColor: theme.colors.surfaceAlt,
    },
    displayName: {
      flex: 1,
      fontSize: theme.fontSize.md,
      fontWeight: theme.fontWeight.bold,
      color: theme.colors.textPrimary,
    },
    unblockButton: {
      borderWidth: 1,
      borderColor: theme.colors.primary,
      borderRadius: theme.borderRadius.md,
      minHeight: theme.layout.minTouchTarget,
      justifyContent: 'center',
      paddingHorizontal: theme.spacing.md,
    },
    unblockButtonPressed: {
      backgroundColor: theme.colors.surfacePressed,
    },
    unblockButtonText: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.primary,
      fontWeight: theme.fontWeight.medium,
    },
  });
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function BlockedAccountsScreen({
  onBack,
}: BlockedAccountsScreenProps): React.JSX.Element {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme, insets.top);

  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBlockedUsers = useCallback(async (): Promise<void> => {
    setError(null);
    try {
      const list = await fetchMyBlockedUsers();
      setBlockedUsers(list);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t('common.error');
      setError(message);
    }
  }, [t]);

  useEffect(() => {
    setLoading(true);
    void loadBlockedUsers().finally(() => { setLoading(false); });
  }, [loadBlockedUsers]);

  const handleUnblock = useCallback(
    async (userId: string): Promise<void> => {
      // Optimistic removal
      setBlockedUsers((prev) => prev.filter((u) => u.userId !== userId));
      try {
        await unblockUser(userId);
      } catch {
        // Re-fetch on error to restore accurate state
        await loadBlockedUsers();
      }
    },
    [loadBlockedUsers],
  );

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
          <Pressable
            style={({ pressed }) => [
              styles.retryButton,
              pressed && styles.retryButtonPressed,
            ]}
            onPress={() => {
              setLoading(true);
              void loadBlockedUsers().finally(() => { setLoading(false); });
            }}
            accessibilityRole="button"
          >
            <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <FlatList
        data={blockedUsers}
        keyExtractor={(item) => item.userId}
        renderItem={({ item }) => (
          <BlockedUserRow
            item={item}
            onUnblock={(userId) => { void handleUnblock(userId); }}
            theme={theme}
            unblockLabel={t('moderation.unblock')}
          />
        )}
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={styles.emptyText}>{t('moderation.noBlockedAccounts')}</Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />
    );
  }

  return (
    <SwipeBackWrapper onBack={onBack}>
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
        <Text style={styles.navTitle}>{t('settings.blockedAccounts')}</Text>
        <View style={styles.navSpacer} />
      </View>

      {renderContent()}
    </SwipeBackWrapper>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function makeStyles(theme: ReturnType<typeof useTheme>['theme'], topInset: number) {
  return StyleSheet.create({
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
      minHeight: theme.layout.minTouchTarget,
    },
    backButtonPressed: {
      backgroundColor: theme.colors.surfacePressed,
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
      minWidth: 60,
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
      marginBottom: theme.spacing.md,
    },
    retryButton: {
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.lg,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.primary,
    },
    retryButtonPressed: {
      backgroundColor: theme.colors.surfacePressed,
    },
    retryButtonText: {
      fontSize: theme.fontSize.md,
      color: theme.colors.primary,
      fontWeight: theme.fontWeight.medium,
    },
  });
}
