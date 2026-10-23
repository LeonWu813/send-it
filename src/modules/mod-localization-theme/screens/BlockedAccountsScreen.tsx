/**
 * BlockedAccountsScreen — list of users the current user has blocked (AC-155).
 *
 * Header: AppShell nested header via useAppHeader (back + title).
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

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  View,
} from 'react-native';

import {
  fetchMyBlockedUsers,
  unblockUser,
} from '../../mod-moderation';
import type { BlockedUser } from '../../mod-moderation';
import { AppText } from '../../../components/ui/AppText';
import { Button } from '../../../components/ui/Button';
import { useTheme } from '../../../lib/theme';
import { useAppHeader, useHeaderContentInset, useTabBarInset } from '@/lib/AppHeaderContext';
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
      <AppText variant="body" weight="600" style={styles.displayNameFlex} numberOfLines={1}>
        {item.displayName}
      </AppText>

      {/* Unblock button — capsule secondary button */}
      <Button
        variant="secondary"
        size="sm"
        label={unblockLabel}
        onPress={() => { onUnblock(item.userId); }}
      />
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
      borderBottomWidth: theme.stroke.hairline,
      borderBottomColor: theme.colors.divider,
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: theme.radius.full,
      marginRight: theme.spacing.md,
    },
    avatarPlaceholder: {
      backgroundColor: theme.colors.surfaceAlt,
    },
    displayNameFlex: {
      flex: 1,
    },
  });
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function BlockedAccountsScreen({
  onBack,
}: BlockedAccountsScreenProps): React.JSX.Element {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const tabInset = useTabBarInset();
  const headerTop = useHeaderContentInset();
  const styles = makeStyles(theme);
  useAppHeader({ title: t('settings.blockedAccounts'), onBack });

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
          <AppText variant="body" color="error" align="center" style={styles.errorText}>{error}</AppText>
          <Button
            variant="secondary"
            size="sm"
            label={t('common.retry')}
            onPress={() => {
              setLoading(true);
              void loadBlockedUsers().finally(() => { setLoading(false); });
            }}
          />
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
            <AppText variant="body" color="textSecondary" align="center">{t('moderation.noBlockedAccounts')}</AppText>
          </View>
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: headerTop, paddingBottom: tabInset.contentBottom }}
        scrollIndicatorInsets={{ bottom: tabInset.indicatorBottom }}
      />
    );
  }

  return (
    <SwipeBackWrapper onBack={onBack}>
      {renderContent()}
    </SwipeBackWrapper>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function makeStyles(theme: ReturnType<typeof useTheme>['theme']) {
  return StyleSheet.create({
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: theme.spacing.xl,
    },
    errorText: {
      marginBottom: theme.spacing.md,
    },
  });
}
