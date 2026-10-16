/**
 * OtherUserProfileScreen — view another user's profile with Report + Block controls.
 *
 * Displays:
 *   - display_name + avatar (fetched from `public.users`)
 *   - ModerationActions (Report + Block) below the avatar section
 *   - Back + title via the AppShell header (useAppHeader)
 *   - Send history via fetchProfileHistory RPC (server-side privacy gate;
 *     returns [] if privacy blocks access — shown as empty state).
 *
 * Safe area: useHeaderContentInset() (0 when the AppShell header is in flow).
 *
 * AC-080: Report User → opens ReportSheet.
 * AC-082, AC-083, AC-084: Block/Unblock via ModerationActions.
 */

import type { Session } from '@supabase/supabase-js';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import SwipeBackWrapper from '../../../components/SwipeBackWrapper';
import { AppText, Avatar, Card, InlineError, Spinner } from '../../../components/ui';
import { supabase } from '../../../lib/supabase';
import { useLayout, useTheme } from '../../../lib/theme';
import { fetchProfileHistory } from '../../mod-profile-history/history-service';
import type { HistoryAscent } from '../../mod-profile-history/types';
import { useAppHeader, useHeaderContentInset, useTabBarInset } from '@/lib/AppHeaderContext';
import ModerationActions from '../components/ModerationActions';

// ── Types ─────────────────────────────────────────────────────────────────────

interface OtherUserProfileScreenProps {
  /** UUID of the user whose profile is being viewed. */
  userId: string;
  /** Active Supabase session for the current user. */
  session: Session;
  /** Called when the back button is pressed. */
  onBack: () => void;
}

interface TargetUserProfile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  privacy_setting: 'public' | 'followers_only';
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function OtherUserProfileScreen({
  userId,
  session,
  onBack,
}: OtherUserProfileScreenProps): React.JSX.Element {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const { screenMargin } = useLayout();
  const tabInset = useTabBarInset();
  const headerInset = useHeaderContentInset();
  const styles = makeStyles(theme, headerInset, screenMargin);

  const [profile, setProfile] = useState<TargetUserProfile | null>(null);
  const [history, setHistory] = useState<HistoryAscent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentUserId = session.user.id;

  useAppHeader({ title: profile?.display_name ?? '', onBack });

  // ── Load profile + history ──────────────────────────────────────────────────

  const loadData = useCallback(async (): Promise<void> => {
    setError(null);
    try {
      const [profileResult, historyResult] = await Promise.all([
        supabase
          .from('users')
          .select('id, display_name, avatar_url, bio, privacy_setting')
          .eq('id', userId)
          .single(),
        fetchProfileHistory(userId).catch(() => [] as HistoryAscent[]),
      ]);

      if (profileResult.error) {
        throw new Error(t('socialFeed.errors.profileLoadFailed'));
      }

      setProfile(profileResult.data as TargetUserProfile);
      setHistory(historyResult);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t('socialFeed.errors.profileLoadFailed');
      setError(message);
    }
  }, [userId, t]);

  useEffect(() => {
    setLoading(true);
    void loadData().finally(() => setLoading(false));
  }, [loadData]);

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.centered}>
        <Spinner size="large" />
      </View>
    );
  }

  return (
    <SwipeBackWrapper onBack={onBack}>
      <ScrollView
        style={styles.root}
        contentContainerStyle={[styles.contentContainer, { paddingBottom: tabInset.contentBottom || theme.spacing.xxl }]}
        scrollIndicatorInsets={{ bottom: tabInset.indicatorBottom }}
        showsVerticalScrollIndicator={false}
      >
        {/* Error */}
        {error !== null && (
          <View style={styles.errorContainer}>
            <InlineError variant="block" message={error} actionLabel={t('common.retry')} onAction={() => void loadData()} />
          </View>
        )}

        {profile !== null && (
          <>
            {/* Header card: Avatar lg + name + bio, then the moderation row (never for own profile) */}
            <Card variant="static" style={styles.headerCard}>
              <View style={styles.identityRow}>
                <Avatar size="lg" uri={profile.avatar_url ?? undefined} name={profile.display_name} decorative />
                <View style={styles.identityText}>
                  <AppText variant="title3" numberOfLines={2}>
                    {profile.display_name}
                  </AppText>
                  {profile.bio !== null && profile.bio !== '' && (
                    <AppText variant="footnote" color="textSecondary" numberOfLines={2}>
                      {profile.bio}
                    </AppText>
                  )}
                </View>
              </View>
              {userId !== currentUserId && (
                <View style={styles.actions}>
                  <ModerationActions
                    targetUserId={userId}
                    currentUserId={currentUserId}
                    targetName={profile.display_name}
                    on="surface"
                    onBlock={() => void loadData()}
                  />
                </View>
              )}
            </Card>

            {/* Send history (privacy-gated server-side; empty state if blocked) */}
            <View style={styles.historySection}>
              <AppText variant="pageSection" style={styles.historySectionTitle}>
                {t('profile.sendHistory')}
              </AppText>
              {history.length === 0 ? (
                <AppText variant="subhead" color="textSecondary" align="center" style={styles.historyEmpty}>
                  {t('profileHistory.empty')}
                </AppText>
              ) : (
                <Card variant="static" padding={0}>
                  {history.slice(0, 20).map((ascent, i, arr) => (
                    <View
                      key={ascent.ascent_id}
                      style={[styles.historyItem, i < arr.length - 1 && styles.historyItemDivider]}
                    >
                      <AppText variant="body" weight="600">{ascent.grade}</AppText>
                      <AppText variant="subhead" color="textSecondary">
                        {new Date(ascent.logged_at).toLocaleDateString()}
                      </AppText>
                    </View>
                  ))}
                </Card>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SwipeBackWrapper>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function makeStyles(theme: ReturnType<typeof useTheme>['theme'], topInset: number, screenMargin: number) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    contentContainer: {
      paddingTop: topInset + theme.spacing.sm,
      paddingHorizontal: screenMargin,
      paddingBottom: theme.spacing.xxl,
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.colors.background,
    },
    errorContainer: {
      marginBottom: theme.spacing.md,
    },
    headerCard: {
      marginBottom: theme.layout.sectionGap,
    },
    identityRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
    },
    identityText: {
      flex: 1,
      gap: theme.spacing.xxs,
    },
    actions: {
      marginTop: theme.spacing.md,
    },
    historySection: {
      marginTop: theme.layout.sectionGap,
    },
    historySectionTitle: {
      marginBottom: theme.spacing.sm,
    },
    historyEmpty: {
      paddingVertical: theme.spacing.lg,
    },
    historyItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      minHeight: theme.layout.listRowMinHeight,
      paddingVertical: theme.layout.listRowPaddingV,
      paddingHorizontal: theme.layout.cardPadding,
    },
    historyItemDivider: {
      borderBottomWidth: theme.stroke.thin,
      borderBottomColor: theme.colors.divider,
    },
  });
}
