/**
 * RouteListScreen.
 *
 * Shows the active routes at a gym with grade + hold-color filter chips.
 *
 * AC-040: filterable by grade and hold color chip selectors.
 *         No free-text search. No status filter for normal users.
 * AC-041: shows active routes only for normal users.
 * AC-045: route display name composed as "{grade} {LocalizedColor} ({section_label}?)".
 * AC-046/047: achievement icons and interactive bookmark via RouteCard props.
 * AC-047: interactive bookmark toggle on route cards (isSaved + onBookmarkToggle).
 * AC-181: new-beta tag chip removed (AC-181, Rev 39); fetchRoutesWithNewBeta retained
 *         for AC-175 most-recently-viewed ordering.
 * AC-189: betaVideoCount fetched via count_beta_videos_by_routes RPC, passed to RouteCard.
 * AC-190: hasSend + sendStyle derived from fetchUserAchievements, passed to RouteCard.
 * US-006: browse currently active routes at a gym.
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import {
  ActivityIndicator,
  AppState,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useTheme } from '../../../lib/theme';
import RouteCard from '../../../components/RouteCard';
import type { RouteCardRoute } from '../../../components/RouteCard';
import { fetchUserAchievements } from '../../mod-send-logging/send-service';
import {
  fetchBetaVideoCounts,
  fetchRoutesWithNewBeta,
  fetchSavedRouteIds,
  listRoutes,
  saveRoute,
  unsaveRoute,
} from '../route-service';
import type { RouteColor, RouteGrade, RouteListFilters, RouteSummary } from '../types';
import { ROUTE_COLORS, ROUTE_GRADES } from '../types';

// ── New-beta tag in-memory cache (AC-181) ─────────────────────────────────────
//
// Keyed on gymId. TTL: 60 seconds. Fetched once per gym screen load; not per
// route card. Cache is module-level so it survives filter changes within the
// same screen session but resets on sign-out / process restart.
const NEW_BETA_CACHE_TTL_MS = 60_000;

interface NewBetaCacheEntry {
  routeIds: Set<string>;
  fetchedAt: number;
}

const newBetaCache = new Map<string, NewBetaCacheEntry>();

/**
 * Clears the module-level new-beta cache. Exported for test teardown only —
 * do not call in production code paths.
 * @internal
 */
export function clearNewBetaCacheForTesting(): void {
  newBetaCache.clear();
}

/** Map each RouteColor enum value to a React Native named color string. */
const COLOR_SWATCH: Record<RouteColor, string> = {
  red: 'red',
  orange: 'orange',
  yellow: 'yellow',
  green: 'green',
  blue: 'blue',
  purple: 'purple',
  pink: 'pink',
  white: 'white',
  black: 'black',
};

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

/** Best ascent style for the current user on a route. */
type AchievementStyle = 'flash' | 'top' | 'attempt';

interface RouteListScreenProps {
  gymId: string;
  gymName: string;
  onSelectRoute: (routeId: string) => void;
  /**
   * AC-043: passes the current grade + color filter values so the submit screen
   * can pre-fill the corresponding chips.
   */
  onSubmitRoute: (grade?: RouteGrade, colorTag?: RouteColor) => void;
  /** Navigate back to the gym detail page. */
  onBack?: () => void;
}

export default function RouteListScreen({
  gymId,
  gymName,
  onSelectRoute,
  onSubmitRoute,
  onBack,
}: RouteListScreenProps): React.JSX.Element {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const styles = makeStyles(theme, 0);

  const [routes, setRoutes] = useState<RouteSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filter state — grade and color only (AC-040); status is always 'active'
  const [gradeFilter, setGradeFilter] = useState<RouteGrade | null>(null);
  const [colorFilter, setColorFilter] = useState<RouteColor | null>(null);

  // AC-046/190: achievement map (route_id → best ascent style for the current user)
  const [achievements, setAchievements] = useState<Record<string, AchievementStyle>>({});

  // AC-047: set of saved route IDs (interactive bookmark toggle, AC-046/047 Rev 39)
  const [savedRouteIds, setSavedRouteIds] = useState<Set<string>>(new Set());

  // AC-189: map of route_id → visible beta video count
  const [betaCountMap, setBetaCountMap] = useState<Record<string, number>>({});

  // AC-181 (retained for AC-175): set of route IDs that qualify for the new-beta tag.
  // Chip no longer rendered (AC-181, Rev 39) but fetchRoutesWithNewBeta is retained for
  // the most-recently-viewed Saved Gyms ordering (AC-175).
  const [newBetaRouteIds, setNewBetaRouteIds] = useState<Set<string>>(new Set());

  const filters: RouteListFilters = useMemo(
    () => ({ grade: gradeFilter, colorTag: colorFilter }),
    [gradeFilter, colorFilter],
  );

  const fetchSaved = useCallback(async (): Promise<void> => {
    try {
      const ids = await fetchSavedRouteIds();
      setSavedRouteIds(new Set(ids));
    } catch {
      // Saved indicator is best-effort — silently ignore failures
    }
  }, []);

  /**
   * AC-047 (Rev 39): Optimistically toggle the saved state for a route.
   * Updates savedRouteIds locally, then calls saveRoute/unsaveRoute.
   * Reverts on error.
   */
  const handleBookmarkToggle = useCallback((routeId: string): void => {
    setSavedRouteIds((prev) => {
      const next = new Set(prev);
      if (next.has(routeId)) {
        next.delete(routeId);
        // Fire async save; revert on failure
        void unsaveRoute(routeId).catch(() => {
          setSavedRouteIds((current) => {
            const reverted = new Set(current);
            reverted.add(routeId);
            return reverted;
          });
        });
      } else {
        next.add(routeId);
        // Fire async save; revert on failure
        void saveRoute(routeId).catch(() => {
          setSavedRouteIds((current) => {
            const reverted = new Set(current);
            reverted.delete(routeId);
            return reverted;
          });
        });
      }
      return next;
    });
  }, []);

  // Fix 1: saved routes sort to top, preserving relative order within each group.
  const sortedRoutes = useMemo((): RouteSummary[] => {
    if (savedRouteIds.size === 0) return routes;
    const saved: RouteSummary[] = [];
    const unsaved: RouteSummary[] = [];
    for (const route of routes) {
      if (savedRouteIds.has(route.id)) {
        saved.push(route);
      } else {
        unsaved.push(route);
      }
    }
    return [...saved, ...unsaved];
  }, [routes, savedRouteIds]);

  /**
   * Fetches the "new beta" tag set for this gym's visible routes.
   * Respects a 60-second in-memory cache keyed on gymId so the RPC is not
   * called on every filter chip change — only on the first load per TTL window.
   * AC-181: one call per gym screen load, not per route card.
   */
  const fetchNewBeta = useCallback(async (routeIds: string[]): Promise<void> => {
    if (routeIds.length === 0) {
      setNewBetaRouteIds(new Set());
      return;
    }

    const cached = newBetaCache.get(gymId);
    const now = Date.now();
    if (cached && now - cached.fetchedAt < NEW_BETA_CACHE_TTL_MS) {
      // Use the cached result — do not re-fetch within the TTL window.
      setNewBetaRouteIds(cached.routeIds);
      return;
    }

    try {
      // fetchRoutesWithNewBeta accepts ALL currently visible route IDs so the
      // RPC resolves the full set in a single round-trip (no N+1).
      const ids = await fetchRoutesWithNewBeta(routeIds);
      const idSet = new Set(ids);
      newBetaCache.set(gymId, { routeIds: idSet, fetchedAt: now });
      setNewBetaRouteIds(idSet);
    } catch {
      // New-beta tag is best-effort — silently ignore failures.
      setNewBetaRouteIds(new Set());
    }
  }, [gymId]);

  const fetchRoutes = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await listRoutes(gymId, filters);
      setRoutes(data);

      // AC-046/189/190: fetch achievements and beta counts once after routes load;
      // both are batched (one call per load, no N+1).
      if (data.length > 0) {
        const routeIds = data.map((r) => r.id);

        // Fetch achievements (AC-046/190) and beta counts (AC-189) in parallel.
        const [ach, counts] = await Promise.all([
          fetchUserAchievements(routeIds).catch(() => ({} as Record<string, AchievementStyle>)),
          fetchBetaVideoCounts(routeIds).catch(() => ({} as Record<string, number>)),
        ]);
        setAchievements(ach);
        setBetaCountMap(counts);

        // AC-181 (retained for AC-175): fetch new-beta tag set.
        // Fire in parallel after main fetches — non-blocking, best-effort.
        void fetchNewBeta(routeIds);
      } else {
        setAchievements({});
        setBetaCountMap({});
        setNewBetaRouteIds(new Set());
      }
    } catch {
      setErrorMessage(t('routes.errors.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [gymId, filters, t, fetchNewBeta]);

  useEffect(() => {
    void fetchRoutes();
    void fetchSaved();
  }, [fetchRoutes, fetchSaved]);

  // AC-047: re-fetch saved IDs when the app returns to the foreground
  // (e.g. after the user saves/unsaves on RouteDetailScreen and returns).
  const appState = useRef(AppState.currentState);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextState === 'active'
      ) {
        void fetchSaved();
      }
      appState.current = nextState;
    });
    return () => subscription.remove();
  }, [fetchSaved]);

  function toggleGradeFilter(grade: RouteGrade): void {
    setGradeFilter((prev) => (prev === grade ? null : grade));
  }

  function toggleColorFilter(color: RouteColor): void {
    setColorFilter((prev) => (prev === color ? null : color));
  }

  function renderRouteCard({ item }: { item: RouteSummary }): React.JSX.Element {
    const routeName = formatRouteName(item.grade, item.color_tag, item.section_label, t);
    const achievement = achievements[item.id] as AchievementStyle | undefined;
    const isSaved = savedRouteIds.has(item.id);
    const betaVideoCount = betaCountMap[item.id] ?? 0;

    // Derive hasSend and sendStyle from the achievement map (AC-190).
    // 'attempt' is not a send; only 'flash' and 'top' qualify.
    const hasSend = achievement === 'flash' || achievement === 'top';
    const sendStyle: 'flash' | 'top' | null =
      achievement === 'flash' ? 'flash' : achievement === 'top' ? 'top' : null;

    // Build the RouteCardRoute shape expected by the shared RouteCard component.
    const cardRoute: RouteCardRoute = {
      id: item.id,
      name: routeName,
      grade: item.grade,
      photo_url: item.photo_url ?? null,
    };

    // RouteCard (Rev 39/40) handles bookmark icon and send badge natively via props.
    // No overlay Views needed — the card is fully presentational and wired here.
    return (
      <View style={styles.cardWrapper}>
        <RouteCard
          route={cardRoute}
          onPress={() => onSelectRoute(item.id)}
          betaVideoCount={betaVideoCount}
          hasSend={hasSend}
          sendStyle={sendStyle}
          isSaved={isSaved}
          onBookmarkToggle={() => handleBookmarkToggle(item.id)}
        />
      </View>
    );
  }

  function renderGradeChip(grade: RouteGrade): React.JSX.Element {
    const isActive = gradeFilter === grade;
    return (
      <Pressable
        key={grade}
        style={[styles.chip, isActive && styles.chipActive]}
        onPress={() => toggleGradeFilter(grade)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isActive }}
        accessibilityLabel={grade}
      >
        <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
          {grade}
        </Text>
      </Pressable>
    );
  }

  function renderColorChip(color: RouteColor): React.JSX.Element {
    const isActive = colorFilter === color;
    const colorLabel = t(`routeCatalog.colors.${color}`);
    return (
      <Pressable
        key={color}
        style={[styles.colorChip, isActive && styles.colorChipActive]}
        onPress={() => toggleColorFilter(color)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isActive }}
        accessibilityLabel={colorLabel}
      >
        <View
          style={[
            styles.colorDot,
            { backgroundColor: COLOR_SWATCH[color] },
            color === 'white' && styles.colorDotBordered,
          ]}
        />
        <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
          {colorLabel}
        </Text>
      </Pressable>
    );
  }

  const listHeader = (
    <View>
      {/* Grade filter chips — all grades always shown */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {ROUTE_GRADES.map(renderGradeChip)}
      </ScrollView>

      {/* Hold-color filter chips — all 9 colors always shown */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {ROUTE_COLORS.map(renderColorChip)}
      </ScrollView>
    </View>
  );

  /** Always-visible "Can't find it? Add a new route" CTA at the bottom. */
  const addRouteCta = (
    <Pressable
      style={styles.addRouteCta}
      onPress={() =>
        onSubmitRoute(gradeFilter ?? undefined, colorFilter ?? undefined)
      }
      accessibilityRole="button"
      accessibilityLabel={t('routeCatalog.addRoute')}
    >
      <Text style={styles.addRouteCtaText}>{t('routeCatalog.addRoute')}</Text>
    </Pressable>
  );

  if (isLoading) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator color={theme.colors.primary} size="large" />
      </View>
    );
  }

  if (errorMessage) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.errorText}>{errorMessage}</Text>
        <Pressable
          style={styles.retryButton}
          onPress={fetchRoutes}
          accessibilityRole="button"
          accessibilityLabel={t('common.retry')}
        >
          <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* Screen header */}
      <View style={styles.header}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            style={styles.backLink}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
          >
            <Ionicons name="chevron-back" size={24} color={theme.colors.primary} />
          </Pressable>
        ) : null}
        <Text style={styles.screenTitle}>{gymName}</Text>
      </View>

      <FlatList
        data={sortedRoutes}
        keyExtractor={(item) => item.id}
        renderItem={renderRouteCard}
        ListHeaderComponent={listHeader}
        ListFooterComponent={addRouteCta}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <Text style={styles.emptyText}>{t('routeCatalog.noResults')}</Text>
        }
      />
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
    centeredContainer: {
      flex: 1,
      backgroundColor: theme.colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: topInset + theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      paddingBottom: theme.spacing.lg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.lg,
      paddingTop: topInset + theme.spacing.md,
      paddingBottom: theme.spacing.md,
      gap: theme.spacing.xs,
    },
    backLink: {
      marginRight: theme.spacing.xs,
    },
    screenTitle: {
      flex: 1,
      fontSize: theme.fontSize.xl,
      fontWeight: theme.fontWeight.bold,
      color: theme.colors.textPrimary,
    },
    filterRow: {
      paddingHorizontal: theme.spacing.lg,
      paddingBottom: theme.spacing.sm,
      gap: theme.spacing.xs,
    },
    chip: {
      paddingHorizontal: theme.spacing.sm + 4,
      paddingVertical: theme.spacing.xs + 2,
      borderRadius: theme.borderRadius.full,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    chipActive: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primary,
    },
    chipText: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.textSecondary,
    },
    chipTextActive: {
      color: theme.colors.textInverse,
      fontWeight: theme.fontWeight.semibold,
    },
    colorChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: theme.spacing.sm + 4,
      paddingVertical: theme.spacing.xs + 2,
      borderRadius: theme.borderRadius.full,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    colorChipActive: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primary,
    },
    colorDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
    },
    colorDotBordered: {
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    listContent: {
      paddingBottom: theme.spacing.md,
    },
    // AC-181: wrapper around RouteCard to allow overlay positioning.
    cardWrapper: {
      marginHorizontal: theme.spacing.lg,
      marginBottom: theme.spacing.sm,
      position: 'relative',
    },
    // AC-046: achievement icon pinned to the top-right corner of the card.
    achievementOverlay: {
      position: 'absolute',
      top: theme.spacing.sm,
      right: theme.spacing.md + 48 + theme.spacing.sm, // right of thumbnail
      zIndex: 1,
    },
    // AC-047: saved bookmark indicator pinned to the top-right corner of the card.
    savedOverlay: {
      position: 'absolute',
      top: theme.spacing.sm,
      right: theme.spacing.sm,
      zIndex: 1,
    },
    // Legacy card styles kept for any remaining inline card rendering paths.
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing.md,
      marginHorizontal: theme.spacing.lg,
      marginBottom: theme.spacing.sm,
    },
    cardPressed: {
      opacity: 0.85,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.xs,
    },
    routeNameRow: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    routeName: {
      flexShrink: 1,
      fontSize: theme.fontSize.md,
      fontWeight: theme.fontWeight.semibold,
      color: theme.colors.textPrimary,
    },
    dateText: {
      fontSize: theme.fontSize.xs,
      color: theme.colors.textDisabled,
      marginTop: 2,
    },
    emptyText: {
      textAlign: 'center',
      fontSize: theme.fontSize.md,
      color: theme.colors.textSecondary,
      marginTop: theme.spacing.xl,
      paddingHorizontal: theme.spacing.lg,
    },
    addRouteCta: {
      marginHorizontal: theme.spacing.lg,
      marginTop: theme.spacing.lg,
      marginBottom: theme.spacing.xxl,
      paddingVertical: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.primary,
      alignItems: 'center',
    },
    addRouteCtaText: {
      fontSize: theme.fontSize.md,
      color: theme.colors.primary,
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
