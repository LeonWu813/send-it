/**
 * AscentList — displays ascents for a route on the route detail screen.
 *
 * Wires up the placeholder slot left by MOD-003 (RouteDetailScreen).
 * Each ascent shows: style badge, attempts, date, note (own only), username.
 *
 * Grade is NOT shown on each ascent row — it is displayed at the route level.
 * (Grade comes from Route.grade, never from the ascent row.)
 */

import type { Session } from '@supabase/supabase-js';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useTheme } from '../../../lib/theme';
import { loadAscentsForRoute } from '../send-service';
import type { AscentStyle, AscentWithProfile } from '../types';

interface AscentListProps {
  routeId: string;
  session: Session;
  /** Called when the user taps the "Log a Send" button — opens LogSendScreen. */
  onLogSend: () => void;
  /**
   * Opaque counter incremented by the parent after each successful log
   * (AC-013). Changing this value causes the useEffect to re-run, which
   * re-fetches the ascent list without requiring re-navigation.
   */
  refreshKey?: number;
}

/** Style badge label to token color mapping — uses theme tokens only. */
function getStyleBadgeColor(
  style: AscentStyle,
  theme: ReturnType<typeof useTheme>['theme'],
): string {
  switch (style) {
    case 'flash':
      return theme.colors.warning;
    case 'top':
      return theme.colors.success;
    case 'attempt':
      return theme.colors.textSecondary;
    case 'project':
      return theme.colors.primary;
  }
}

export default function AscentList({
  routeId,
  session,
  onLogSend,
  refreshKey = 0,
}: AscentListProps): React.JSX.Element {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const styles = makeStyles(theme);

  const [ascents, setAscents] = useState<AscentWithProfile[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchAscents = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await loadAscentsForRoute(routeId);
      setAscents(data);
    } catch {
      setErrorMessage(t('sends.errors.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [routeId, t]);

  // refreshKey is intentionally included here (not in useCallback) so that
  // the parent can trigger a re-fetch after a successful send log (AC-013)
  // by incrementing the key, without widening the fetchAscents identity.
  useEffect(() => {
    void fetchAscents();
  }, [fetchAscents, refreshKey]);

  return (
    <View style={styles.root}>
      {/* Section header + Log Send button — Tap 1 in the ≤4-tap flow (AC-010) */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{t('sends.ascentsSectionTitle')}</Text>
        <Pressable
          onPress={onLogSend}
          accessibilityRole="button"
          accessibilityLabel={t('sends.logSend')}
          style={styles.logButton}
        >
          <Text style={styles.logButtonText}>{t('sends.logSend')}</Text>
        </Pressable>
      </View>

      {/* Loading state */}
      {isLoading && (
        <ActivityIndicator
          color={theme.colors.primary}
          style={styles.loader}
        />
      )}

      {/* Error state */}
      {errorMessage !== null && !isLoading && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{errorMessage}</Text>
          <Pressable
            onPress={() => void fetchAscents()}
            accessibilityRole="button"
            accessibilityLabel={t('common.retry')}
            style={styles.retryButton}
          >
            <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
          </Pressable>
        </View>
      )}

      {/* Empty state */}
      {!isLoading && errorMessage === null && ascents.length === 0 && (
        <Text style={styles.emptyText}>{t('sends.noAscents')}</Text>
      )}

      {/* Ascent rows */}
      {!isLoading &&
        errorMessage === null &&
        ascents.map((ascent) => (
          <AscentRow
            key={ascent.id}
            ascent={ascent}
            isOwn={ascent.user_id === session.user.id}
            theme={theme}
          />
        ))}
    </View>
  );
}

// ── AscentRow sub-component ────────────────────────────────────────────────────

interface AscentRowProps {
  ascent: AscentWithProfile;
  isOwn: boolean;
  theme: ReturnType<typeof useTheme>['theme'];
}

function AscentRow({ ascent, isOwn, theme }: AscentRowProps): React.JSX.Element {
  const { t } = useTranslation('common');
  const styles = makeStyles(theme);

  const badgeColor = getStyleBadgeColor(ascent.style, theme);
  const displayDate = new Date(ascent.logged_at).toLocaleDateString();

  return (
    <View style={styles.ascentRow}>
      {/* Style badge */}
      <View style={[styles.styleBadge, { backgroundColor: badgeColor }]}>
        <Text style={styles.styleBadgeText}>
          {t(`sends.styles.${ascent.style}`)}
        </Text>
      </View>

      {/* Attempts + date */}
      <View style={styles.ascentMeta}>
        <Text style={styles.attemptsText}>
          {t('sends.attemptsCount', { count: ascent.attempts })}
        </Text>
        <Text style={styles.dateText}>{displayDate}</Text>
        <Text style={styles.usernameText}>{ascent.display_name}</Text>
      </View>

      {/* Note — shown only to the owning user */}
      {isOwn && ascent.note !== null && (
        <View style={styles.noteContainer}>
          <Text style={styles.noteText}>{ascent.note}</Text>
        </View>
      )}

      {/* Private indicator */}
      {ascent.is_private && (
        <Text style={styles.privateIndicator}>{t('sends.privateLabel')}</Text>
      )}
    </View>
  );
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function makeStyles(theme: ReturnType<typeof useTheme>['theme']) {
  return StyleSheet.create({
    root: {
      marginTop: theme.spacing.xl,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: theme.spacing.md,
    },
    sectionTitle: {
      fontSize: theme.fontSize.md,
      fontWeight: theme.fontWeight.semibold,
      color: theme.colors.textPrimary,
    },
    logButton: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.primary,
    },
    logButtonText: {
      fontSize: theme.fontSize.sm,
      fontWeight: theme.fontWeight.medium,
      color: theme.colors.textInverse,
    },
    loader: {
      marginVertical: theme.spacing.md,
    },
    errorContainer: {
      padding: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      backgroundColor: theme.colors.surface,
      marginBottom: theme.spacing.md,
    },
    errorText: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.error,
      marginBottom: theme.spacing.sm,
    },
    retryButton: {
      alignSelf: 'flex-start',
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.borderRadius.sm,
      borderWidth: 1,
      borderColor: theme.colors.primary,
    },
    retryButtonText: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.primary,
    },
    emptyText: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      paddingVertical: theme.spacing.md,
    },
    ascentRow: {
      padding: theme.spacing.md,
      marginBottom: theme.spacing.sm,
      borderRadius: theme.borderRadius.md,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    styleBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 2,
      borderRadius: theme.borderRadius.sm,
      marginBottom: theme.spacing.xs,
    },
    styleBadgeText: {
      fontSize: theme.fontSize.xs,
      fontWeight: theme.fontWeight.semibold,
      color: theme.colors.textInverse,
      textTransform: 'uppercase',
    },
    ascentMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      flexWrap: 'wrap',
    },
    attemptsText: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.textPrimary,
    },
    dateText: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.textSecondary,
    },
    usernameText: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.textSecondary,
      fontWeight: theme.fontWeight.medium,
    },
    noteContainer: {
      marginTop: theme.spacing.sm,
      padding: theme.spacing.sm,
      borderRadius: theme.borderRadius.sm,
      backgroundColor: theme.colors.divider,
    },
    noteText: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.textPrimary,
      fontStyle: 'italic',
    },
    privateIndicator: {
      marginTop: theme.spacing.xs,
      fontSize: theme.fontSize.xs,
      color: theme.colors.textDisabled,
    },
  });
}
