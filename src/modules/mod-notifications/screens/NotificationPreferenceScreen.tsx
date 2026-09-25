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
import {
  ActivityIndicator,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../../lib/theme';
import {
  fetchNotificationPreference,
  updateNotificationPreference,
} from '../notification-service';

// ── Default preference value when no row exists yet ───────────────────────────
const DEFAULT_BETA_VIDEO_LIKE = true;

// ── Types ─────────────────────────────────────────────────────────────────────

interface NotificationPreferenceScreenProps {
  session: Session;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function NotificationPreferenceScreen({
  session: _session,
}: NotificationPreferenceScreenProps): React.JSX.Element {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme, insets.top);

  const [betaVideoLike, setBetaVideoLike] = useState<boolean>(DEFAULT_BETA_VIDEO_LIKE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* Section header */}
      <Text style={styles.sectionHeader}>{t('notifications.preferencesTitle')}</Text>

      {/* Error banner */}
      {error !== null && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* beta_video_like toggle row (AC-057) */}
      <View style={styles.settingRow}>
        <View style={styles.settingContent}>
          <Text style={styles.settingLabel}>
            {t('notifications.betaVideoLikeLabel')}
          </Text>
          <Text style={styles.settingDescription}>
            {t('notifications.betaVideoLikeDescription')}
          </Text>
        </View>

        {saving ? (
          <ActivityIndicator
            size="small"
            color={theme.colors.primary}
            style={styles.savingIndicator}
          />
        ) : (
          <Switch
            value={betaVideoLike}
            onValueChange={(value) => void handleToggle(value)}
            trackColor={{
              false: theme.colors.border,
              true: theme.colors.primary,
            }}
            thumbColor={theme.colors.background}
            accessibilityRole="switch"
            accessibilityLabel={t('notifications.betaVideoLikeLabel')}
            accessibilityState={{ checked: betaVideoLike }}
          />
        )}
      </View>

      {/* Explanatory note — inbox still shows likes even when push is off */}
      <Text style={styles.footnote}>
        {t('notifications.pushOffNote')}
      </Text>
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
      paddingTop: topInset + theme.spacing.md,
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.colors.background,
    },
    sectionHeader: {
      fontSize: theme.fontSize.xs,
      fontWeight: theme.fontWeight.semibold,
      color: theme.colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      paddingHorizontal: theme.spacing.md,
      paddingBottom: theme.spacing.sm,
    },
    errorContainer: {
      marginHorizontal: theme.spacing.md,
      marginBottom: theme.spacing.sm,
      padding: theme.spacing.sm,
      borderRadius: theme.borderRadius.md,
      backgroundColor: theme.colors.error,
    },
    errorText: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.textInverse,
    },
    settingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.md,
      backgroundColor: theme.colors.surface,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: theme.colors.divider,
    },
    settingContent: {
      flex: 1,
      paddingRight: theme.spacing.md,
    },
    settingLabel: {
      fontSize: theme.fontSize.md,
      fontWeight: theme.fontWeight.medium,
      color: theme.colors.textPrimary,
    },
    settingDescription: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    savingIndicator: {
      width: 51, // same width as Switch to prevent layout shift
    },
    footnote: {
      fontSize: theme.fontSize.xs,
      color: theme.colors.textSecondary,
      paddingHorizontal: theme.spacing.md,
      paddingTop: theme.spacing.sm,
    },
  });
}
