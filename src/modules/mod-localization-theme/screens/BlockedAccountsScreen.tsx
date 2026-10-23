/**
 * BlockedAccountsScreen — list of users the current user has blocked (AC-155).
 *
 * Header: AppShell nested header via useAppHeader (back + title).
 *
 * On mount: fetches fetchMyBlockedUsers() from mod-moderation.
 * Loading state: ActivityIndicator centered.
 * Error state: error text with retry.
 * Each row (L-2): listRowMinHeight 52, Avatar sm 32, display_name, "Unblock" button centred.
 * Unblock tap: opens a confirm sheet; on confirm calls unblockUser(), removes the
 *              entry optimistically, re-fetches on error.
 * Empty state: "No blocked accounts" / "沒有已封鎖的帳號".
 *
 * useSafeAreaInsets() + useTheme() — no hardcoded hex.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  View,
} from 'react-native';

import {
  fetchMyBlockedUsers,
  unblockUser,
} from '../../mod-moderation';
import type { BlockedUser } from '../../mod-moderation';
import { AppText } from '../../../components/ui/AppText';
import { Avatar } from '../../../components/ui/Avatar';
import { BottomSheet } from '../../../components/ui/BottomSheet';
import { Button } from '../../../components/ui/Button';
import { useLayout, useTheme } from '../../../lib/theme';
import { useAppHeader, useHeaderContentInset, useTabBarInset } from '@/lib/AppHeaderContext';
import SwipeBackWrapper from '../../../components/SwipeBackWrapper';

// ── Props ─────────────────────────────────────────────────────────────────────

export interface BlockedAccountsScreenProps {
  onBack: () => void;
}

// ── Row component ─────────────────────────────────────────────────────────────

interface BlockedUserRowProps {
  item: BlockedUser;
  onUnblock: (user: BlockedUser) => void;
  theme: ReturnType<typeof useTheme>['theme'];
  screenMargin: number;
  unblockLabel: string;
}

function BlockedUserRow({
  item,
  onUnblock,
  theme,
  screenMargin,
  unblockLabel,
}: BlockedUserRowProps): React.JSX.Element {
  const styles = makeRowStyles(theme, screenMargin);

  return (
    <View style={styles.row}>
      <Avatar size="sm" uri={item.avatarUrl} name={item.displayName} decorative />

      {/* Display name */}
      <AppText variant="body" weight="600" style={styles.displayNameFlex} numberOfLines={1}>
        {item.displayName}
      </AppText>

      {/* Unblock button: alignSelf centre overrides Button's flex-start so it is vertically centred */}
      <Button
        variant="secondary"
        size="sm"
        label={unblockLabel}
        onPress={() => { onUnblock(item); }}
        style={styles.unblock}
      />
    </View>
  );
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function makeRowStyles(theme: ReturnType<typeof useTheme>['theme'], screenMargin: number) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: theme.layout.listRowMinHeight,
      paddingVertical: theme.spacing.smd,
      paddingHorizontal: screenMargin,
      // card-less list: rows sit on surface, not directly on the sand background
      backgroundColor: theme.colors.surface,
      borderBottomWidth: theme.stroke.hairline,
      borderBottomColor: theme.colors.divider,
    },
    displayNameFlex: {
      flex: 1,
      marginHorizontal: theme.spacing.smd,
    },
    unblock: {
      alignSelf: 'center',
    },
  });
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function BlockedAccountsScreen({
  onBack,
}: BlockedAccountsScreenProps): React.JSX.Element {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const { screenMargin } = useLayout();
  const tabInset = useTabBarInset();
  const headerTop = useHeaderContentInset();
  const styles = makeStyles(theme);
  useAppHeader({ title: t('settings.blockedAccounts'), onBack });

  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingUnblock, setPendingUnblock] = useState<BlockedUser | null>(null);

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
            onUnblock={setPendingUnblock}
            theme={theme}
            screenMargin={screenMargin}
            unblockLabel={t('moderation.unblock')}
          />
        )}
        ListEmptyComponent={
          <View style={styles.centered}>
            <AppText variant="body" color="textSecondary" align="center">{t('moderation.noBlockedAccounts')}</AppText>
          </View>
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: headerTop + theme.spacing.md, paddingBottom: tabInset.contentBottom }}
        scrollIndicatorInsets={{ bottom: tabInset.indicatorBottom }}
      />
    );
  }

  return (
    <SwipeBackWrapper onBack={onBack}>
      {renderContent()}
      <BottomSheet
        variant="confirm"
        visible={pendingUnblock !== null}
        onClose={() => { setPendingUnblock(null); }}
        title={t('moderation.block.confirmUnblock')}
        description={t('moderation.block.confirmUnblockBody')}
        confirmLabel={t('moderation.unblock')}
        onConfirm={() => {
          const target = pendingUnblock;
          setPendingUnblock(null);
          if (target !== null) {
            void handleUnblock(target.userId);
          }
        }}
      />
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
