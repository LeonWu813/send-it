/**
 * RouteDetailScreen.
 *
 * Shows the full detail of a single route:
 *   - Route name (large font) with gym name as subtitle beneath it (AC-125)
 *   - Grade, color badge, photo, status (active/retired)
 *   - Two-column send-summary section: Sends + Attempts (AC-127)
 *   - Two action buttons: Record Send / Upload Beta Video (AC-130)
 *   - My sends list — fetched via fetchMyAscentsForRoute (MOD-004 service)
 *   - Beta video section (MOD-005)
 *   - Added date as footer at the bottom (AC-126)
 *
 * AC-045: route display name composed as "{grade} {LocalizedColor} ({section_label}?)".
 * AC-046: bookmark toggle (filled yellow = saved; outline gray = unsaved) in header;
 *         optimistic update; achievement icon next to route name.
 * AC-125: gym name as subtitle directly beneath the route name; no "岩館" section label.
 * AC-126: added date as footer at the very bottom of the ScrollView.
 * AC-127: two-column send summary (Sends / Attempts) from summarizeAscents.
 * AC-128: tapping either summary card navigates to SendHistoryDetailScreen.
 * AC-130: two action buttons (Record Send, Upload Beta Video) below the summary section;
 *         old entry points ("Log Send" button in ascent header, BetaVideoUploader button
 *         inside BetaVideoSection) have been removed.
 *
 * Note: Route retirement is now admin-only via Supabase Studio (AC-024b).
 * The retire button and retireRoute() call have been removed.
 *
 * Ascent fetch: uses fetchMyAscentsForRoute instead of loadAscentsForRoute so the
 * list is scoped to the current user's own sends.
 */

import type { Session } from '@supabase/supabase-js';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  summarizeAscents,
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
  /** AC-128: navigates to the Send History Detail screen for this route. */
  onViewSendHistory: (routeId: string) => void;
}

export default function RouteDetailScreen({
  routeId,
  gymName,
  session,
  onBack,
  onViewSendHistory,
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
   * AC-130: ref to the BetaVideoSection's upload launcher.
   * BetaVideoSection registers its launch handler here via onRegisterUploadLauncher.
   * The "Upload Beta Video" action button calls this ref when pressed.
   */
  const uploadLauncherRef = useRef<(() => void) | null>(null);

  const handleRegisterUploadLauncher = useCallback((launcher: () => void): void => {
    uploadLauncherRef.current = launcher;
  }, []);

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

  function handleUploadBetaPress(): void {
    uploadLauncherRef.current?.();
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

  // AC-127: derive send summary client-side from already-fetched ascents
  const summary = summarizeAscents(myAscents);

  // AC-126: format the added date
  const addedDateStr = new Date(route.created_at).toISOString().slice(0, 10); // YYYY-MM-DD
  const addedDateLabel = t('routeCatalog.detail.addedDate', { date: addedDateStr });

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

      {/* Route photo — rendered only when a signed URL was successfully generated. */}
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

      {/* AC-125 / AC-045: route name (large) + AC-046: achievement icon */}
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

      {/* AC-125: gym name as subtitle directly beneath the route name */}
      <Text style={styles.gymSubtitle}>{gymName}</Text>

      {/* Section label (if present) — keep as informational detail */}
      {route.section_label ? (
        <>
          <Text style={styles.sectionLabel}>
            {t('routes.detail.section')}
          </Text>
          <Text style={styles.infoText}>{route.section_label}</Text>
        </>
      ) : null}

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

      {/* ── AC-127: Two-column send summary ──────────────────────────────────── */}
      <View style={styles.summaryRow}>
        {/* Sends card */}
        <Pressable
          style={styles.summaryCard}
          onPress={() => { onViewSendHistory(route.id); }}
          accessibilityRole="button"
          accessibilityLabel={t('routeCatalog.detail.sends')}
          testID="sends-summary-card"
        >
          <Text style={styles.summaryValue}>{summary.sends}</Text>
          <Text style={styles.summaryLabel}>{t('routeCatalog.detail.sends')}</Text>
        </Pressable>
        {/* Attempts card */}
        <Pressable
          style={styles.summaryCard}
          onPress={() => { onViewSendHistory(route.id); }}
          accessibilityRole="button"
          accessibilityLabel={t('routeCatalog.detail.attempts')}
          testID="attempts-summary-card"
        >
          <Text style={styles.summaryValue}>{summary.attempts}</Text>
          <Text style={styles.summaryLabel}>{t('routeCatalog.detail.attempts')}</Text>
        </Pressable>
      </View>

      {/* ── AC-130: Action buttons row ───────────────────────────────────────── */}
      <View style={styles.actionRow}>
        <Pressable
          style={styles.actionButton}
          onPress={handleLogSendPress}
          accessibilityRole="button"
          accessibilityLabel={t('routeCatalog.detail.recordSend')}
        >
          <Ionicons name="add-circle-outline" size={18} color={theme.colors.textInverse} />
          <Text style={styles.actionButtonText}>{t('routeCatalog.detail.recordSend')}</Text>
        </Pressable>
        <Pressable
          style={[styles.actionButton, styles.actionButtonSecondary]}
          onPress={handleUploadBetaPress}
          accessibilityRole="button"
          accessibilityLabel={t('routeCatalog.detail.uploadBeta')}
        >
          <Ionicons name="videocam-outline" size={18} color={theme.colors.primary} />
          <Text style={styles.actionButtonSecondaryText}>{t('routeCatalog.detail.uploadBeta')}</Text>
        </Pressable>
      </View>

      {/* ── My Sends (MOD-004 service, current user only) ─────────────────── */}
      {/* Uses fetchMyAscentsForRoute so only the logged-in user's sends appear.
          loadAscentsForRoute would include other users' public sends via RLS. */}
      <View style={styles.ascentSectionRoot}>
        {/* AC-130: Log Send button removed from ascent section header.
            It now lives in the AC-130 action row above. */}
        <Text style={styles.ascentSectionTitle}>{t('sends.ascentsSectionTitle')}</Text>

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

      {/* Log Send modal — opens on tap of the AC-130 "Record Send" button */}
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
           AC-130: onRegisterUploadLauncher wires the AC-130 "Upload Beta Video"
           button to BetaVideoSection's upload flow, so no upload button is
           rendered inside the section itself. */}
      <BetaVideoSection
        routeId={route.id}
        session={session}
        onRegisterUploadLauncher={handleRegisterUploadLauncher}
      />

      {/* ── AC-126: Added date footer ─────────────────────────────────────── */}
      <Text style={styles.addedDateFooter}>{addedDateLabel}</Text>

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
    // AC-125: large font for the route name title
    routeNameText: {
      fontSize: 26,
      fontWeight: theme.fontWeight.bold,
      color: theme.colors.textPrimary,
      flexShrink: 1,
    },
    // AC-125: gym name as subtitle beneath the route name; no "岩館" label
    gymSubtitle: {
      fontSize: theme.fontSize.md,
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing.md,
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
    // ── AC-127: send summary ──────────────────────────────────────────────────
    summaryRow: {
      flexDirection: 'row',
      gap: theme.spacing.md,
      marginTop: theme.spacing.lg,
      marginBottom: theme.spacing.sm,
    },
    summaryCard: {
      flex: 1,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.sm,
      borderRadius: theme.borderRadius.md,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
    },
    summaryValue: {
      fontSize: 28,
      fontWeight: theme.fontWeight.bold,
      color: theme.colors.textPrimary,
    },
    summaryLabel: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    // ── AC-130: action row ────────────────────────────────────────────────────
    actionRow: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
      marginTop: theme.spacing.sm,
      marginBottom: theme.spacing.lg,
    },
    actionButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.xs,
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      backgroundColor: theme.colors.primary,
    },
    actionButtonText: {
      fontSize: theme.fontSize.sm,
      fontWeight: theme.fontWeight.semibold,
      color: theme.colors.textInverse,
    },
    actionButtonSecondary: {
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.primary,
    },
    actionButtonSecondaryText: {
      fontSize: theme.fontSize.sm,
      fontWeight: theme.fontWeight.semibold,
      color: theme.colors.primary,
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
    ascentSectionTitle: {
      fontSize: theme.fontSize.md,
      fontWeight: theme.fontWeight.semibold,
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing.md,
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
    // ── AC-126: added date footer ─────────────────────────────────────────────
    addedDateFooter: {
      marginTop: theme.spacing.xl,
      fontSize: theme.fontSize.sm,
      color: theme.colors.textDisabled,
      textAlign: 'center',
    },
  });
}
