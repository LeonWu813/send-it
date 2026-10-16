/**
 * FollowersListScreen — list of users who follow the viewed profile.
 *
 * AC-146: Followers list screen showing circular avatar and display_name
 *         per card. Tapping a card navigates to that user's profile.
 *         Blocked users are excluded.
 *
 * Blocked users are filtered client-side using fetchBlockedUserIds()
 * from mod-moderation (AC-082, AC-084). Both directions are covered:
 * users the current user has blocked AND users who have blocked the current user.
 *
 * Safe area: useSafeAreaInsets() + makeStyles(theme, topInset) pattern.
 * Navigation bar: 44pt back IconButton (chevron-back), title "追蹤者"/"Followers".
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, StyleSheet, View } from 'react-native';

import { fetchBlockedUserIds } from '../../mod-moderation/moderation-service';
import { ICON } from '../../../lib/icons';
import { AVATAR_SIZE, useLayout, useTheme } from '../../../lib/theme';
import { fetchFollowersList } from '../social-feed-service';
import type { UserListItem } from '../types';
import SwipeBackWrapper from '../../../components/SwipeBackWrapper';
import {
  AppText,
  Avatar,
  EmptyState,
  IconButton,
  InlineError,
  ListRow,
  Spinner,
} from '../../../components/ui';

// ── Props ─────────────────────────────────────────────────────────────────────

export interface FollowersListScreenProps {
  /** UUID of the profile being viewed. */
  userId: string;
  /** Called when the back button is pressed. */
  onBack: () => void;
  /** Called when the user taps a card to navigate to that user's profile. */
  onNavigateToUser: (userId: string) => void;
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function FollowersListScreen({
  userId,
  onBack,
  onNavigateToUser,
}: FollowersListScreenProps): React.JSX.Element {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const { screenMargin } = useLayout();
  const styles = makeStyles(theme, screenMargin);

  const [users, setUsers] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFollowers = useCallback(async (): Promise<void> => {
    setError(null);
    try {
      const [rawList, blockedIds] = await Promise.all([
        fetchFollowersList(userId),
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
    void loadFollowers().finally(() => { setLoading(false); });
  }, [loadFollowers]);

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
        keyExtractor={(item) => item.userId}
        renderItem={({ item, index }) => (
          <ListRow
            variant="navigation"
            density="content"
            inset="screen"
            title={item.displayName}
            accessibilityLabel={item.displayName}
            leading={<Avatar size="md" uri={item.avatarUrl} name={item.displayName} decorative />}
            leadingWidth={AVATAR_SIZE.md}
            divider={index < users.length - 1}
            inScroll
            onPress={() => { onNavigateToUser(item.userId); }}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            variant="firstUse"
            icon={ICON.followers.outline}
            title={t('socialFeed.noFollowers')}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    );
  }

  return (
    <SwipeBackWrapper onBack={onBack}>
      <View style={styles.root}>
        {/* Navigation bar */}
        <View style={styles.navBar}>
          <IconButton
            name={ICON.back.outline}
            accessibilityLabel={t('settings.back')}
            onPress={onBack}
            on="background"
          />
          <AppText variant="headline" align="center" numberOfLines={1} style={styles.navTitle}>
            {t('socialFeed.followers')}
          </AppText>
          <View style={styles.navSpacer} />
        </View>

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
    navBar: {
      paddingTop: theme.spacing.md,
      paddingBottom: theme.spacing.sm,
      paddingHorizontal: screenMargin - theme.spacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth: theme.stroke.hairline,
      borderBottomColor: theme.colors.border,
      backgroundColor: theme.colors.background,
    },
    navTitle: {
      flex: 1,
    },
    navSpacer: {
      width: theme.layout.minTouchTarget,
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
