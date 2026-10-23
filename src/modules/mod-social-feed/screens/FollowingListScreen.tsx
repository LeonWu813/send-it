/**
 * FollowingListScreen — list of users the profile owner follows.
 *
 * AC-147: Following list screen showing circular avatar and display_name
 *         per card. Same card layout as FollowersListScreen (AC-146).
 *         Tapping a card navigates to that user's profile.
 *         Blocked users are excluded.
 *
 * Blocked users are filtered client-side using fetchBlockedUserIds()
 * from mod-moderation (AC-082, AC-084). Both directions are covered:
 * users the current user has blocked AND users who have blocked the current user.
 *
 * Safe area: useSafeAreaInsets() + makeStyles(theme, topInset) pattern.
 * Design system v2.2: no screen-drawn back/title row; the AppShell `nested` AppHeader owns them (§30).
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, StyleSheet, View } from 'react-native';

import { fetchBlockedUserIds } from '../../mod-moderation';
import { ICON } from '../../../lib/icons';
import { AVATAR_SIZE, useLayout, useTheme } from '../../../lib/theme';
import { fetchFollowingList } from '../social-feed-service';
import type { UserListItem } from '../types';
import { useAppHeader, useTabBarInset } from '@/lib/AppHeaderContext';
import SwipeBackWrapper from '../../../components/SwipeBackWrapper';
import {
  Avatar,
  EmptyState,
  InlineError,
  ListRow,
  Spinner,
} from '../../../components/ui';

// ── Props ─────────────────────────────────────────────────────────────────────

export interface FollowingListScreenProps {
  /** UUID of the profile being viewed. */
  userId: string;
  /** Called when the back button is pressed. */
  onBack: () => void;
  /** Called when the user taps a card to navigate to that user's profile. */
  onNavigateToUser: (userId: string) => void;
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function FollowingListScreen({
  userId,
  onBack,
  onNavigateToUser,
}: FollowingListScreenProps): React.JSX.Element {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const { screenMargin } = useLayout();
  const styles = makeStyles(theme, screenMargin);
  const tabInset = useTabBarInset();
  useAppHeader({ title: t('socialFeed.following'), onBack });

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
          <Spinner size="large" color="primary" accessibilityLabel={t('common.loading')} />
        </View>
      );
    }

    if (error !== null) {
      return (
        <View style={styles.errorWrap}>
          <InlineError variant="block" message={error} />
        </View>
      );
    }

    return (
      <FlatList
        data={users}
        contentContainerStyle={[styles.listContent, { paddingBottom: tabInset.contentBottom }]}
        scrollIndicatorInsets={{ bottom: tabInset.indicatorBottom }}
        keyExtractor={(item) => item.userId}
        renderItem={({ item, index }) => (
          <ListRow
            variant="content"
            inset="screen"
            title={item.displayName}
            accessibilityLabel={item.displayName}
            leading={<Avatar size="sm" uri={item.avatarUrl} name={item.displayName} decorative />}
            leadingWidth={AVATAR_SIZE.sm}
            divider={index < users.length - 1}
            inScroll
            onPress={() => { onNavigateToUser(item.userId); }}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            variant="firstUse"
            icon={ICON.followers.outline}
            title={t('socialFeed.noFollowing')}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    );
  }

  return (
    <SwipeBackWrapper onBack={onBack}>
      <View style={styles.root}>
        {renderContent()}
      </View>
    </SwipeBackWrapper>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function makeStyles(theme: ReturnType<typeof useTheme>['theme'], screenMargin: number) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    listContent: {
      paddingTop: 0,
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: theme.spacing.xl,
    },
    errorWrap: {
      padding: screenMargin,
    },
  });
}
