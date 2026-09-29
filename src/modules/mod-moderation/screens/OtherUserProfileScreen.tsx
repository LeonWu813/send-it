/**
 * OtherUserProfileScreen — view another user's profile with Report + Block controls.
 *
 * Displays:
 *   - display_name + avatar (fetched from `public.users`)
 *   - ModerationActions (Report + Block) below the avatar section
 *   - Back button (top-left)
 *   - Send history via fetchProfileHistory RPC (server-side privacy gate;
 *     returns [] if privacy blocks access — shown as empty state).
 *
 * Safe area: useSafeAreaInsets() + makeStyles(theme, topInset) pattern.
 *
 * AC-080: Report User → opens ReportSheet.
 * AC-082, AC-083, AC-084: Block/Unblock via ModerationActions.
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
import { fetchProfileHistory } from '../../mod-profile-history/history-service';
import type { HistoryAscent } from '../../mod-profile-history/types';
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
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme, insets.top);

  const [profile, setProfile] = useState<TargetUserProfile | null>(null);
  const [history, setHistory] = useState<HistoryAscent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentUserId = session.user.id;

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
        <Text style={styles.backButtonText}>{'‹  '}{t('common.back')}</Text>
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
          </View>

          {/* Moderation actions (Report + Block) — never shown for own profile */}
          <ModerationActions
            targetUserId={userId}
            currentUserId={currentUserId}
            onBlock={() => void loadData()}
          />

          {/* Send history (privacy-gated server-side; empty state if blocked) */}
          <View style={styles.historySection}>
            <Text style={styles.historySectionTitle}>{t('profile.sendHistory')}</Text>
            {history.length === 0 ? (
              <Text style={styles.historyEmpty}>{t('profileHistory.empty')}</Text>
            ) : (
              history.slice(0, 20).map((ascent) => (
                <View key={ascent.ascent_id} style={styles.historyItem}>
                  <Text style={styles.historyGrade}>{ascent.grade}</Text>
                  <Text style={styles.historyDate}>
                    {new Date(ascent.logged_at).toLocaleDateString()}
                  </Text>
                </View>
              ))
            )}
          </View>
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
    },
    historySection: {
      marginTop: theme.spacing.xl,
    },
    historySectionTitle: {
      fontSize: theme.fontSize.md,
      fontWeight: theme.fontWeight.semibold,
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing.sm,
    },
    historyEmpty: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      paddingVertical: theme.spacing.lg,
    },
    historyItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: theme.spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.divider,
    },
    historyGrade: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.textPrimary,
      fontWeight: theme.fontWeight.semibold,
    },
    historyDate: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.textSecondary,
    },
  });
}
