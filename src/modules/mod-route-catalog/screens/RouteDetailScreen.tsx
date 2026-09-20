/**
 * RouteDetailScreen.
 *
 * Shows the full detail of a single route:
 *   - Grade, gym/section, color badge, photo, status (active/retired)
 *   - Submitted by, created_at, retired_at (when applicable)
 *   - Retire action (any authenticated user, active routes only — AC-024)
 *   - Placeholder slots for ascents (MOD-004) and beta videos (MOD-005)
 *
 * US-014: flag a route as retired.
 */

import type { Session } from '@supabase/supabase-js';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useTheme } from '../../../lib/theme';
import RouteColorBadge from '../components/RouteColorBadge';
import { loadRoute, retireRoute } from '../route-service';
import type { Route } from '../types';

interface RouteDetailScreenProps {
  routeId: string;
  gymName: string;
  session: Session;
  onBack: () => void;
}

export default function RouteDetailScreen({
  routeId,
  gymName,
  session,
  onBack,
}: RouteDetailScreenProps): React.JSX.Element {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const styles = makeStyles(theme);

  const [route, setRoute] = useState<Route | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRetiring, setIsRetiring] = useState(false);

  const fetchRoute = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await loadRoute(routeId);
      if (!data) {
        setErrorMessage(t('routes.errors.notFound'));
      } else {
        setRoute(data);
      }
    } catch {
      setErrorMessage(t('routes.errors.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [routeId, t]);

  useEffect(() => {
    void fetchRoute();
  }, [fetchRoute]);

  function handleRetirePress(): void {
    Alert.alert(
      t('routes.retire.confirmTitle'),
      t('routes.retire.confirmBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('routes.retire.confirmAction'),
          style: 'destructive',
          onPress: () => void confirmRetire(),
        },
      ],
    );
  }

  async function confirmRetire(): Promise<void> {
    setIsRetiring(true);
    try {
      await retireRoute(routeId, session.user.id);
      // Refresh route data to reflect retired status
      await fetchRoute();
    } catch {
      Alert.alert(t('common.error'), t('routes.errors.retireFailed'));
    } finally {
      setIsRetiring(false);
    }
  }

  if (isLoading) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator color={theme.colors.primary} size="large" />
      </View>
    );
  }

  if (errorMessage || !route) {
    return (
      <View style={styles.centeredContainer}>
        <Pressable
          onPress={onBack}
          style={styles.backLink}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Text style={styles.backLinkText}>{t('common.back')}</Text>
        </Pressable>
        <Text style={styles.errorText}>
          {errorMessage ?? t('common.error')}
        </Text>
        <Pressable
          style={styles.retryButton}
          onPress={fetchRoute}
          accessibilityRole="button"
          accessibilityLabel={t('common.retry')}
        >
          <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
        </Pressable>
      </View>
    );
  }

  const isRetired = route.status === 'retired';

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.contentContainer}
    >
      {/* Back navigation */}
      <Pressable
        onPress={onBack}
        style={styles.backLink}
        accessibilityRole="button"
        accessibilityLabel={t('common.back')}
      >
        <Text style={styles.backLinkText}>{t('common.back')}</Text>
      </Pressable>

      {/* Route photo */}
      <Image
        source={{ uri: route.photo_url }}
        style={styles.photo}
        accessibilityLabel={`${route.grade} ${route.color_tag} route photo`}
        resizeMode="cover"
      />

      {/* Status badge (retired only — active is the default state) */}
      {isRetired && (
        <View style={styles.retiredStatusBadge}>
          <Text style={styles.retiredStatusText}>
            {t('routes.status.retired')}
          </Text>
        </View>
      )}

      {/* Grade + color */}
      <View style={styles.gradeRow}>
        <Text style={styles.gradeText}>{route.grade}</Text>
        <RouteColorBadge color={route.color_tag} size="md" />
      </View>

      {/* Gym / section */}
      <Text style={styles.sectionLabel}>
        {t('routes.detail.gym')}
      </Text>
      <Text style={styles.infoText}>{gymName}</Text>
      {route.section_label ? (
        <>
          <Text style={styles.sectionLabel}>
            {t('routes.detail.section')}
          </Text>
          <Text style={styles.infoText}>{route.section_label}</Text>
        </>
      ) : null}

      {/* Submitted by + date */}
      <Text style={styles.sectionLabel}>
        {t('routes.detail.submittedBy')}
      </Text>
      <Text style={styles.infoText}>{route.submitted_by_user_id}</Text>
      <Text style={styles.sectionLabel}>
        {t('routes.detail.addedOn')}
      </Text>
      <Text style={styles.infoText}>
        {new Date(route.created_at).toLocaleDateString()}
      </Text>

      {/* Retired info */}
      {isRetired && route.retired_at ? (
        <>
          <Text style={styles.sectionLabel}>
            {t('routes.detail.retiredOn')}
          </Text>
          <Text style={styles.infoText}>
            {new Date(route.retired_at).toLocaleDateString()}
          </Text>
        </>
      ) : null}

      {/* ── Placeholder: Ascents (MOD-004) ────────────────────────────────── */}
      <View style={styles.placeholderSection}>
        <Text style={styles.placeholderTitle}>
          {t('routes.detail.ascentsPlaceholder')}
        </Text>
        <Text style={styles.placeholderSubtitle}>
          {t('routes.detail.ascentsPlaceholderSub')}
        </Text>
      </View>

      {/* ── Placeholder: Beta Videos (MOD-005) ────────────────────────────── */}
      <View style={styles.placeholderSection}>
        <Text style={styles.placeholderTitle}>
          {t('routes.detail.betaVideosPlaceholder')}
        </Text>
        <Text style={styles.placeholderSubtitle}>
          {t('routes.detail.betaVideosPlaceholderSub')}
        </Text>
      </View>

      {/* Retire action — only for active routes */}
      {!isRetired && (
        <Pressable
          style={[styles.retireButton, isRetiring && styles.retireButtonDisabled]}
          onPress={handleRetirePress}
          disabled={isRetiring}
          accessibilityRole="button"
          accessibilityLabel={t('routes.retire.action')}
          accessibilityState={{ disabled: isRetiring }}
        >
          {isRetiring ? (
            <ActivityIndicator size="small" color={theme.colors.error} />
          ) : (
            <Text style={styles.retireButtonText}>
              {t('routes.retire.action')}
            </Text>
          )}
        </Pressable>
      )}
    </ScrollView>
  );
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function makeStyles(theme: ReturnType<typeof useTheme>['theme']) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    contentContainer: {
      padding: theme.spacing.lg,
      paddingBottom: theme.spacing.xxl,
    },
    centeredContainer: {
      flex: 1,
      backgroundColor: theme.colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.spacing.lg,
    },
    backLink: {
      marginBottom: theme.spacing.md,
    },
    backLinkText: {
      fontSize: theme.fontSize.md,
      color: theme.colors.primary,
    },
    photo: {
      width: '100%',
      height: 280,
      borderRadius: theme.borderRadius.lg,
      marginBottom: theme.spacing.md,
      backgroundColor: theme.colors.surface,
    },
    retiredStatusBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 3,
      borderRadius: theme.borderRadius.sm,
      backgroundColor: theme.colors.textDisabled,
      marginBottom: theme.spacing.sm,
    },
    retiredStatusText: {
      fontSize: theme.fontSize.xs,
      fontWeight: theme.fontWeight.semibold,
      color: theme.colors.textInverse,
      textTransform: 'uppercase',
    },
    gradeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.md,
    },
    gradeText: {
      fontSize: theme.fontSize.display,
      fontWeight: theme.fontWeight.bold,
      color: theme.colors.textPrimary,
    },
    sectionLabel: {
      fontSize: theme.fontSize.xs,
      fontWeight: theme.fontWeight.semibold,
      color: theme.colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginTop: theme.spacing.lg,
      marginBottom: theme.spacing.xs,
    },
    infoText: {
      fontSize: theme.fontSize.md,
      color: theme.colors.textPrimary,
    },
    placeholderSection: {
      marginTop: theme.spacing.xl,
      padding: theme.spacing.lg,
      borderRadius: theme.borderRadius.md,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderStyle: 'dashed',
    },
    placeholderTitle: {
      fontSize: theme.fontSize.md,
      fontWeight: theme.fontWeight.semibold,
      color: theme.colors.textDisabled,
      marginBottom: 4,
    },
    placeholderSubtitle: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.textDisabled,
    },
    retireButton: {
      marginTop: theme.spacing.xl,
      paddingVertical: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.error,
      alignItems: 'center',
    },
    retireButtonDisabled: {
      opacity: 0.5,
    },
    retireButtonText: {
      fontSize: theme.fontSize.md,
      color: theme.colors.error,
      fontWeight: theme.fontWeight.medium,
    },
    errorText: {
      fontSize: theme.fontSize.md,
      color: theme.colors.error,
      textAlign: 'center',
      marginBottom: theme.spacing.md,
    },
    retryButton: {
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.primary,
    },
    retryButtonText: {
      fontSize: theme.fontSize.md,
      color: theme.colors.primary,
    },
  });
}
