/**
 * NotificationPreferenceScreen — Push notification settings for MOD-007.
 *
 * AC-057: exposes a Settings screen toggle for beta-video-like push notifications.
 *   - When toggle is ON:  push is enqueued on beta-video-like events.
 *   - When toggle is OFF: no push, but the in-app Notification row is still created.
 *
 * The toggle reflects the current state of NotificationPreference.beta_video_like.
 * State changes are written immediately (optimistic update + server sync).
 *
 * Safe area: useSafeAreaInsets() + makeStyles(theme, topInset) pattern.
 * i18n: all user-facing strings use useTranslation('common') hook.
 */

import type { Session } from '@supabase/supabase-js';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AppText,
  EmptyState,
  InlineError,
  ListRow,
  PageLoading,
  useLoadingPhase,
} from '../../../components/ui';
import { CONTINUOUS, useLayout, useTheme } from '../../../lib/theme';
import { useAppHeader } from '@/lib/AppHeaderContext';
import {
  fetchNotificationPreference,
  updateNotificationPreference,
} from '../notification-service';

// ── Default preference value when no row exists yet ───────────────────────────
const DEFAULT_BETA_VIDEO_LIKE = true;

// ── Types ─────────────────────────────────────────────────────────────────────

interface NotificationPreferenceScreenProps {
  session: Session;
  /** Back action for the nested header; returns to wherever the screen was opened from (N-1). */
  onBack?: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function NotificationPreferenceScreen({
  session: _session,
  onBack,
}: NotificationPreferenceScreenProps): React.JSX.Element {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { screenMargin } = useLayout();
  const styles = makeStyles(theme, insets.top, screenMargin, onBack !== undefined);

  // N-1: the AppShell overlay scope renders the nested header (back + title); no-op outside AppShell.
  useAppHeader({ title: t('notifications.title'), onBack });

  const [betaVideoLike, setBetaVideoLike] = useState<boolean>(DEFAULT_BETA_VIDEO_LIKE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadingPhase = useLoadingPhase(loading);

  // ── Load preference ─────────────────────────────────────────────────────────

  const loadPreference = useCallback(async (): Promise<void> => {
    setError(null);
    try {
      const pref = await fetchNotificationPreference();
      // If no row exists, default to true (opt-in by default per spec).
      setBetaVideoLike(pref?.beta_video_like ?? DEFAULT_BETA_VIDEO_LIKE);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t('notifications.errors.loadPreferenceFailed');
      setError(message);
    }
  }, [t]);

  useEffect(() => {
    setLoading(true);
    void loadPreference().finally(() => setLoading(false));
  }, [loadPreference]);

  // ── Toggle handler ──────────────────────────────────────────────────────────

  const handleToggle = useCallback(
    async (value: boolean): Promise<void> => {
      // Optimistic update — reflect immediately in UI.
      const previous = betaVideoLike;
      setBetaVideoLike(value);
      setError(null);
      setSaving(true);

      try {
        await updateNotificationPreference(value);
      } catch (err) {
        // Revert optimistic update on failure.
        setBetaVideoLike(previous);
        const message =
          err instanceof Error ? err.message : t('notifications.errors.updatePreferenceFailed');
        setError(message);
      } finally {
        setSaving(false);
      }
    },
    [betaVideoLike, t],
  );

  // ── Render ──────────────────────────────────────────────────────────────────

  // Full-page loading: PageLoading after 300ms; after 10s E4 replaces it (a late success swaps back to content).
  if (loading) {
    if (loadingPhase === 'loading') return <PageLoading />;
    if (loadingPhase === 'timeout') {
      return (
        <View style={styles.root}>
          <EmptyState
            variant="error"
            title={t('notifications.loadPreferenceErrorTitle')}
            description={t('notifications.loadErrorDescription')}
            primaryLabel={t('common.retry')}
            onPrimary={() => {
              setLoading(true);
              void loadPreference().finally(() => setLoading(false));
            }}
          />
        </View>
      );
    }
    return <View style={styles.root} />;
  }

  return (
    <View style={styles.root}>
      {/* Section header */}
      <AppText variant="groupHeader" accessibilityRole="header" style={styles.sectionHeader}>
        {t('notifications.preferencesTitle')}
      </AppText>

      {/* Error block */}
      {error !== null && (
        <InlineError variant="block" message={error} style={styles.errorBlock} />
      )}

      {/* beta_video_like toggle row (AC-057), on a surface container */}
      <View style={styles.group}>
        <ListRow
          variant="toggle"
          inset="grouped"
          density="content" // N-1: description wraps to 2 lines instead of truncating
          divider={false}
          title={t('notifications.betaVideoLikeLabel')}
          subtitle={t('notifications.betaVideoLikeDescription')}
          toggleValue={betaVideoLike}
          onToggle={(value) => void handleToggle(value)}
          disabled={saving}
        />
      </View>

      {/* Explanatory note — inbox still shows likes even when push is off */}
      <AppText variant="footnote" color="textSecondary" style={styles.footnote}>
        {t('notifications.pushOffNote')}
      </AppText>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

function makeStyles(
  theme: ReturnType<typeof useTheme>['theme'],
  topInset: number,
  screenMargin: number,
  hasHeader: boolean,
) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.colors.background,
      // R0: with the nested header the safe-area inset is already applied by the header
      paddingTop: hasHeader ? 0 : topInset + theme.spacing.md,
    },
    group: {
      marginHorizontal: screenMargin,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.card,
      ...CONTINUOUS,
      overflow: 'hidden',
    },
    sectionHeader: {
      paddingTop: hasHeader ? theme.spacing.md : 0,
      paddingHorizontal: screenMargin,
      paddingBottom: theme.spacing.sm,
    },
    errorBlock: {
      marginHorizontal: screenMargin,
      marginBottom: theme.spacing.sm,
    },
    footnote: {
      paddingHorizontal: screenMargin,
      paddingTop: theme.spacing.sm,
    },
  });
}
