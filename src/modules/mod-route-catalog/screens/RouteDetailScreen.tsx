/**
 * RouteDetailScreen.
 *
 * Shows the full detail of a single route:
 *   - Grade, gym/section, color badge, photo, status (active/retired)
 *   - Submitted by, created_at, retired_at (when applicable)
 *   - Ascent list (MOD-004) — wired via AscentList component
 *   - Placeholder slot for beta videos (MOD-005)
 *
 * Note: Route retirement is now admin-only via Supabase Studio (AC-024b).
 * The retire button and retireRoute() call have been removed.
 */

import type { Session } from '@supabase/supabase-js';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../../lib/theme';
import AscentList from '../../mod-send-logging/components/AscentList';
import LogSendScreen from '../../mod-send-logging/screens/LogSendScreen';
import RouteColorBadge from '../components/RouteColorBadge';
import { loadRoute, getPhotoSignedUrl } from '../route-service';
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
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme, insets.top);

  const [route, setRoute] = useState<Route | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLogSendVisible, setIsLogSendVisible] = useState(false);
  /**
   * Incrementing key passed to AscentList. When this value changes,
   * AscentList's useEffect re-fires and re-fetches the ascent list,
   * satisfying AC-013 (list refreshes immediately after a successful log).
   */
  const [ascentRefreshKey, setAscentRefreshKey] = useState(0);

  const fetchRoute = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await loadRoute(routeId);
      if (!data) {
        setErrorMessage(t('routes.errors.notFound'));
      } else {
        setRoute(data);
        // Generate a signed URL for the private route-photos bucket.
        // photo_url stores the storage path (from getPublicUrl) which is
        // inaccessible for a private bucket; createSignedUrl produces a
        // time-limited URL that the Image component can actually load.
        if (data.photo_url) {
          try {
            const signed = await getPhotoSignedUrl(data.photo_url);
            setPhotoUri(signed);
          } catch {
            // Non-fatal: photo simply won't render if signing fails.
            setPhotoUri(null);
          }
        } else {
          setPhotoUri(null);
        }
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

  function handleLogSendPress(): void {
    setIsLogSendVisible(true);
  }

  function handleLogSendSuccess(): void {
    setIsLogSendVisible(false);
    // AC-013: increment the refresh key so AscentList's useEffect re-fires
    // and fetches the updated list without requiring re-navigation.
    setAscentRefreshKey((prev) => prev + 1);
  }

  function handleLogSendCancel(): void {
    setIsLogSendVisible(false);
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
          <Ionicons name="chevron-back" size={24} color={theme.colors.primary} />
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
        <Ionicons name="chevron-back" size={24} color={theme.colors.primary} />
      </Pressable>

      {/* Route photo — rendered only when a signed URL was successfully generated.
          The route-photos bucket is private; photo_url stores the raw storage
          path (returned by getPublicUrl) which is not directly accessible.
          getPhotoSignedUrl() converts it to a 1-hour signed URL (AC-021). */}
      {photoUri ? (
        <Image
          source={{ uri: photoUri }}
          style={styles.photo}
          accessibilityLabel={`${route.grade} ${route.color_tag} route photo`}
          resizeMode="cover"
        />
      ) : null}

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

      {/* ── Ascents (MOD-004) — wired via AscentList ──────────────────────── */}
      {/* refreshKey increments on each successful log to satisfy AC-013. */}
      <AscentList
        routeId={route.id}
        session={session}
        onLogSend={handleLogSendPress}
        refreshKey={ascentRefreshKey}
      />

      {/* Log Send modal — opens on tap 1, route pre-selected (AC-010) */}
      <Modal
        visible={isLogSendVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleLogSendCancel}
      >
        <LogSendScreen
          routeId={route.id}
          routeGrade={route.grade}
          session={session}
          onSuccess={handleLogSendSuccess}
          onCancel={handleLogSendCancel}
        />
      </Modal>

      {/* ── Placeholder: Beta Videos (MOD-005) ────────────────────────────── */}
      <View style={styles.placeholderSection}>
        <Text style={styles.placeholderTitle}>
          {t('routes.detail.betaVideosPlaceholder')}
        </Text>
        <Text style={styles.placeholderSubtitle}>
          {t('routes.detail.betaVideosPlaceholderSub')}
        </Text>
      </View>

    </ScrollView>
  );
}

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
    centeredContainer: {
      flex: 1,
      backgroundColor: theme.colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: topInset + theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      paddingBottom: theme.spacing.lg,
    },
    backLink: {
      marginBottom: theme.spacing.md,
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
