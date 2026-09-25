/**
 * RouteDetailScreen.
 *
 * Shows the full detail of a single route:
 *   - Grade, gym/section, color badge, photo, status (active/retired)
 *   - Submitted by, created_at, retired_at (when applicable)
 *   - Ascent list (MOD-004) — wired via AscentList component
 *   - Placeholder slot for beta videos (MOD-005)
 *
 * AC-045: route display name composed as "{grade} {LocalizedColor} ({section_label}?)".
 * AC-046: bookmark toggle (filled yellow = saved; outline gray = unsaved) in header;
 *         optimistic update; achievement icon next to route name.
 *
 * Note: Route retirement is now admin-only via Supabase Studio (AC-024b).
 * The retire button and retireRoute() call have been removed.
 */

import type { Session } from '@supabase/supabase-js';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
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
import { fetchUserAchievements } from '../../mod-send-logging/send-service';
import RouteColorBadge from '../components/RouteColorBadge';
import { fetchSavedRouteIds, getPhotoSignedUrl, loadRoute, saveRoute, unsaveRoute } from '../route-service';
import type { Route, RouteColor } from '../types';

/**
 * AC-045: Compose the display name for a route at render time.
 * Format: "{grade} {LocalizedColor}" or "{grade} {LocalizedColor} ({section_label})".
 * The color string uses the i18n routeCatalog.colors.<color_tag> key.
 */
function formatRouteName(
  grade: string,
  colorTag: RouteColor,
  sectionLabel: string | null,
  t: TFunction,
): string {
  const color = t(`routeCatalog.colors.${colorTag}`);
  const base = `${grade} ${color}`;
  return sectionLabel ? `${base} (${sectionLabel})` : base;
}

type AchievementStyle = 'flash' | 'top' | 'attempt';

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

  // AC-046: bookmark state
  const [isSaved, setIsSaved] = useState(false);

  // AC-046: achievement icon for this route
  const [achievement, setAchievement] = useState<AchievementStyle | null>(null);

  const fetchRoute = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      // Fetch route detail and saved status in parallel
      const [data, savedIds] = await Promise.all([
        loadRoute(routeId),
        fetchSavedRouteIds(),
      ]);

      if (!data) {
        setErrorMessage(t('routes.errors.notFound'));
      } else {
        setRoute(data);
        setIsSaved(savedIds.includes(routeId));

        // Generate a signed URL for the private route-photos bucket.
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

        // AC-046: fetch achievement icon for this route
        try {
          const ach = await fetchUserAchievements([routeId]);
          const style = ach[routeId] as AchievementStyle | undefined;
          setAchievement(style ?? null);
        } catch {
          // Achievement overlay is best-effort — silently ignore failures
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

  /**
   * AC-046: Optimistic bookmark toggle.
   * Flips the icon immediately, fires the DB write async, reverts on error.
   */
  const handleBookmarkToggle = useCallback(async (): Promise<void> => {
    const wasSaved = isSaved;
    setIsSaved(!wasSaved);
    try {
      if (wasSaved) {
        await unsaveRoute(routeId);
      } else {
        await saveRoute(routeId);
      }
    } catch {
      // Revert optimistic update on failure
      setIsSaved(wasSaved);
    }
  }, [routeId, isSaved]);

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
  // AC-045: composed route display name
  const routeName = formatRouteName(route.grade, route.color_tag, route.section_label, t);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.contentContainer}
    >
      {/* Header row: back navigation + bookmark toggle (AC-046) */}
      <View style={styles.headerRow}>
        <Pressable
          onPress={onBack}
          style={styles.backLink}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Ionicons name="chevron-back" size={24} color={theme.colors.primary} />
        </Pressable>
        {/* AC-046: bookmark toggle — filled yellow = saved, outline gray = unsaved */}
        <Pressable
          onPress={() => { void handleBookmarkToggle(); }}
          style={styles.bookmarkButton}
          accessibilityRole="button"
          accessibilityLabel={
            isSaved
              ? t('routeCatalog.bookmark.unsave')
              : t('routeCatalog.bookmark.save')
          }
          accessibilityState={{ selected: isSaved }}
        >
          <Ionicons
            name={isSaved ? 'bookmark' : 'bookmark-outline'}
            size={28}
            color={isSaved ? theme.colors.warning : theme.colors.textSecondary}
          />
        </Pressable>
      </View>

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

      {/* AC-045: route name + AC-046: achievement icon in header area */}
      <View style={styles.routeNameRow}>
        <Text style={styles.routeNameText}>{routeName}</Text>
        {achievement === 'flash' ? (
          <Ionicons name="flash" size={22} color={theme.colors.warning} />
        ) : achievement === 'top' ? (
          <Ionicons name="checkmark-circle" size={22} color={theme.colors.success} />
        ) : achievement === 'attempt' ? (
          <Ionicons name="ellipse-outline" size={22} color={theme.colors.textSecondary} />
        ) : null}
      </View>

      {/* Grade + color badge kept for visual clarity */}
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
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing.md,
    },
    backLink: {
      // no extra margin — headerRow handles spacing
    },
    bookmarkButton: {
      padding: theme.spacing.xs,
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
    routeNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.xs,
    },
    routeNameText: {
      fontSize: theme.fontSize.xl,
      fontWeight: theme.fontWeight.bold,
      color: theme.colors.textPrimary,
      flexShrink: 1,
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
