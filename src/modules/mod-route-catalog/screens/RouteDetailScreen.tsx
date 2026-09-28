/**
 * RouteDetailScreen.
 *
 * Shows the full detail of a single route:
 *   - Grade, gym/section, color badge, photo, status (active/retired)
 *   - Submitted by, created_at, retired_at (when applicable)
 *   - My sends list — fetched via fetchMyAscentsForRoute (MOD-004 service)
 *     so that only the current user's own sends are shown (not all users').
 *   - Placeholder slot for beta videos (MOD-005)
 *
 * AC-045: route display name composed as "{grade} {LocalizedColor} ({section_label}?)".
 * AC-046: bookmark toggle (filled yellow = saved; outline gray = unsaved) in header;
 *         optimistic update; achievement icon next to route name.
 *
 * Note: Route retirement is now admin-only via Supabase Studio (AC-024b).
 * The retire button and retireRoute() call have been removed.
 *
 * Ascent fetch: uses fetchMyAscentsForRoute instead of loadAscentsForRoute so the
 * list is scoped to the current user's own sends. The RLS SELECT policy on ascents
 * allows reading other users' public rows (auth.uid() = user_id OR is_private =
 * FALSE), so loadAscentsForRoute would return other users' sends too — this screen
 * intentionally shows only the current user's history.
 */

import type { Session } from '@supabase/supabase-js';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import {
  ActivityIndicator,
  Alert,
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
import BetaVideoSection from '../../mod-beta-video/components/BetaVideoSection';
import LogSendScreen from '../../mod-send-logging/screens/LogSendScreen';
import {
  deleteAscent,
  fetchMyAscentsForRoute,
  fetchUserAchievements,
} from '../../mod-send-logging/send-service';
import type { AscentStyle, AscentWithProfile } from '../../mod-send-logging/types';
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

/** Gold color for the flash ascent style badge — matches the flash achievement icon. */
const FLASH_BADGE_COLOR = '#FFD700';

function getStyleBadgeColor(
  style: AscentStyle,
  theme: ReturnType<typeof useTheme>['theme'],
): string {
  switch (style) {
    case 'flash':
      return FLASH_BADGE_COLOR;
    case 'top':
      return theme.colors.success;
    case 'attempt':
      return theme.colors.textSecondary;
  }
}

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

  // AC-046: bookmark state
  const [isSaved, setIsSaved] = useState(false);

  // AC-046: achievement icon for this route
  const [achievement, setAchievement] = useState<AchievementStyle | null>(null);

  // My sends — scoped to the current user only (fetchMyAscentsForRoute).
  const [myAscents, setMyAscents] = useState<AscentWithProfile[]>([]);
  const [ascentsLoading, setAscentsLoading] = useState(false);
  const [ascentsError, setAscentsError] = useState<string | null>(null);

  /**
   * Fetch the current user's ascents for this route.
   * Separated from fetchRoute so it can be re-called independently after
   * a successful log (AC-013) without reloading the full route detail.
   */
  const fetchMyAscents = useCallback(async (): Promise<void> => {
    setAscentsLoading(true);
    setAscentsError(null);
    try {
      const data = await fetchMyAscentsForRoute(routeId);
      setMyAscents(data);
    } catch {
      setAscentsError(t('sends.errors.loadFailed'));
    } finally {
      setAscentsLoading(false);
    }
  }, [routeId, t]);

  const fetchRoute = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      // Fetch route detail, saved status, and current user's ascents in parallel.
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
    void fetchMyAscents();
  }, [fetchRoute, fetchMyAscents]);

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
    // AC-013: re-fetch the user's own ascents so the list reflects the new send.
    void fetchMyAscents();
  }

  function handleLogSendCancel(): void {
    setIsLogSendVisible(false);
  }

  /**
   * Optimistically remove an ascent, then call deleteAscent.
   * On failure, re-fetch to restore accurate state.
   */
  const handleDeleteAscent = useCallback(
    (ascentId: string): void => {
      Alert.alert(
        t('sendLogging.delete.confirm'),
        undefined,
        [
          {
            text: t('sendLogging.delete.cancel'),
            style: 'cancel',
          },
          {
            text: t('sendLogging.delete.delete'),
            style: 'destructive',
            onPress: () => {
              // Optimistic remove
              setMyAscents((prev) => prev.filter((a) => a.id !== ascentId));
              void deleteAscent(ascentId).catch(() => {
                // Revert optimistic update on failure by re-fetching
                void fetchMyAscents();
              });
            },
          },
        ],
      );
    },
    [t, fetchMyAscents],
  );

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
    <View style={styles.root}>
      {/* Sticky top bar — stays fixed above the scroll area (back + bookmark). */}
      <View style={styles.topBar}>
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

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
      >

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
          <Ionicons name="flash" size={22} color="#FFD700" />
        ) : achievement === 'top' ? (
          <Ionicons name="checkmark-circle" size={22} color={theme.colors.success} />
        ) : achievement === 'attempt' ? (
          <Ionicons name="ellipse-outline" size={22} color={theme.colors.textSecondary} />
        ) : null}
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

      {/* Added on date */}
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

      {/* ── My Sends (MOD-004 service, current user only) ─────────────────── */}
      {/* Uses fetchMyAscentsForRoute so only the logged-in user's sends appear.
          loadAscentsForRoute would include other users' public sends via RLS. */}
      <View style={styles.ascentSectionRoot}>
        <View style={styles.ascentSectionHeader}>
          <Text style={styles.ascentSectionTitle}>{t('sends.ascentsSectionTitle')}</Text>
          <Pressable
            onPress={handleLogSendPress}
            accessibilityRole="button"
            accessibilityLabel={t('sends.logSend')}
            style={styles.logButton}
          >
            <Text style={styles.logButtonText}>{t('sends.logSend')}</Text>
          </Pressable>
        </View>

        {ascentsLoading && (
          <ActivityIndicator color={theme.colors.primary} style={styles.ascentsLoader} />
        )}

        {ascentsError !== null && !ascentsLoading && (
          <View style={styles.ascentsErrorContainer}>
            <Text style={styles.ascentsErrorText}>{ascentsError}</Text>
            <Pressable
              onPress={() => void fetchMyAscents()}
              accessibilityRole="button"
              accessibilityLabel={t('common.retry')}
              style={styles.ascentsRetryButton}
            >
              <Text style={styles.ascentsRetryButtonText}>{t('common.retry')}</Text>
            </Pressable>
          </View>
        )}

        {!ascentsLoading && ascentsError === null && myAscents.length === 0 && (
          <Text style={styles.ascentsEmptyText}>{t('sends.noAscents')}</Text>
        )}

        {!ascentsLoading &&
          ascentsError === null &&
          myAscents.map((ascent) => {
            const badgeColor = getStyleBadgeColor(ascent.style, theme);
            const displayDate = new Date(ascent.logged_at).toLocaleDateString();
            const isOwn = ascent.user_id === session.user.id;
            return (
              <View key={ascent.id} style={styles.ascentRow}>
                <View style={styles.ascentRowHeader}>
                  <View style={[styles.styleBadge, { backgroundColor: badgeColor }]}>
                    <Text style={styles.styleBadgeText}>
                      {t(`sends.styles.${ascent.style}`)}
                    </Text>
                  </View>
                  {isOwn && (
                    <Pressable
                      onPress={() => handleDeleteAscent(ascent.id)}
                      accessibilityRole="button"
                      accessibilityLabel={t('sendLogging.delete.delete')}
                      style={styles.deleteButton}
                      hitSlop={8}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={16}
                        color={theme.colors.textSecondary}
                      />
                    </Pressable>
                  )}
                </View>
                <View style={styles.ascentMeta}>
                  <Text style={styles.attemptsText}>
                    {t('sends.attemptsCount', { count: ascent.attempts })}
                  </Text>
                  <Text style={styles.dateText}>{displayDate}</Text>
                  <Text style={styles.usernameText}>{ascent.display_name}</Text>
                </View>
                {isOwn && ascent.note !== null && (
                  <View style={styles.noteContainer}>
                    <Text style={styles.noteText}>{ascent.note}</Text>
                  </View>
                )}
                {ascent.is_private && (
                  <Text style={styles.privateIndicator}>{t('sends.privateLabel')}</Text>
                )}
              </View>
            );
          })}
      </View>

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

      {/* ── Beta Videos (MOD-005) — AC-033, AC-037 ───────────────────────────
           BetaVideoSection is the public entry point imported from mod-beta-video.
           Cross-module import rule: only this component is imported, never internal
           screens/ or components/ from mod-beta-video directly. */}
      <BetaVideoSection routeId={route.id} session={session} />

      </ScrollView>
    </View>
  );
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function makeStyles(theme: ReturnType<typeof useTheme>['theme'], topInset: number) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    /**
     * Sticky top bar — renders above the ScrollView so back/bookmark buttons
     * remain visible as the user scrolls through route content.
     * paddingTop = insets.top so the bar sits flush under the status bar /
     * Dynamic Island. No paddingTop on the ScrollView below.
     */
    topBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: topInset,
      paddingHorizontal: theme.spacing.lg,
      paddingBottom: theme.spacing.sm,
      backgroundColor: theme.colors.background,
    },
    scrollView: {
      flex: 1,
    },
    contentContainer: {
      paddingTop: theme.spacing.md,
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
      // no extra margin — topBar handles spacing
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
    // ── Ascent section styles ─────────────────────────────────────────────────
    ascentSectionRoot: {
      marginTop: theme.spacing.xl,
    },
    ascentSectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: theme.spacing.md,
    },
    ascentSectionTitle: {
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
    ascentsLoader: {
      marginVertical: theme.spacing.md,
    },
    ascentsErrorContainer: {
      padding: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      backgroundColor: theme.colors.surface,
      marginBottom: theme.spacing.md,
    },
    ascentsErrorText: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.error,
      marginBottom: theme.spacing.sm,
    },
    ascentsRetryButton: {
      alignSelf: 'flex-start',
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.borderRadius.sm,
      borderWidth: 1,
      borderColor: theme.colors.primary,
    },
    ascentsRetryButtonText: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.primary,
    },
    ascentsEmptyText: {
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
    ascentRowHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: theme.spacing.xs,
    },
    styleBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 2,
      borderRadius: theme.borderRadius.sm,
    },
    deleteButton: {
      padding: theme.spacing.xs,
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
