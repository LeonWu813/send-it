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

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { AppState, FlatList, ScrollView, StyleSheet, View } from 'react-native';

import RouteCard from '../../../components/RouteCard';
import SwipeBackWrapper from '../../../components/SwipeBackWrapper';
import type { RouteCardRoute } from '../../../components/RouteCard';
import {
  AppText,
  Button,
  Chip,
  EmptyState,
  IconButton,
  InlineError,
  Spinner,
} from '../../../components/ui';
import { ICON } from '../../../lib/icons';
import { useLayout, useTheme } from '../../../lib/theme';
import { useTapeSwatch } from '../components/RouteColorBadge';
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
  const { screenMargin } = useLayout();
  const styles = makeStyles(theme, screenMargin);

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
      colorTag: item.color_tag,
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
    return (
      <Chip
        key={grade}
        variant="choice"
        label={grade}
        selected={gradeFilter === grade}
        onPress={() => toggleGradeFilter(grade)}
      />
    );
  }

  function renderColorChip(color: RouteColor): React.JSX.Element {
    return (
      <ColorFilterChip
        key={color}
        color={color}
        selected={colorFilter === color}
        onPress={() => toggleColorFilter(color)}
      />
    );
  }

  const listHeader = (
    <View style={styles.filterBlock}>
      {/* Grade filter chips — all grades always shown */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
        accessibilityRole="radiogroup"
      >
        {ROUTE_GRADES.map(renderGradeChip)}
      </ScrollView>

      {/* Hold-color filter chips — all 9 colors always shown */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
        accessibilityRole="radiogroup"
      >
        {ROUTE_COLORS.map(renderColorChip)}
      </ScrollView>
    </View>
  );

  /** Always-visible "Can't find it? Add a new route" CTA at the bottom. */
  const addRouteCta = (
    <View style={styles.addRouteCta}>
      <Button
        variant="secondary"
        size="md"
        fullWidth
        icon={ICON.add.outline}
        label={t('routeCatalog.addRoute')}
        onPress={() =>
          onSubmitRoute(gradeFilter ?? undefined, colorFilter ?? undefined)
        }
      />
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.centeredContainer}>
        <Spinner />
      </View>
    );
  }

  if (errorMessage) {
    return (
      <View style={styles.centeredContainer}>
        <InlineError
          variant="block"
          message={errorMessage}
          actionLabel={t('common.retry')}
          onAction={fetchRoutes}
        />
      </View>
    );
  }

  return (
    <SwipeBackWrapper onBack={onBack ?? (() => {})}>
      <View style={styles.root}>
        {/* Screen header */}
        <View style={styles.header}>
          {onBack ? (
            <IconButton
              name={ICON.back.outline}
              size={24}
              on="background"
              onPress={onBack}
              accessibilityLabel={t('common.back')}
            />
          ) : null}
          <AppText variant="title2" numberOfLines={1} style={styles.screenTitle}>{gymName}</AppText>
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
            <EmptyState variant="filtered" title={t('routeCatalog.noResults')} />
          }
        />
      </View>
    </SwipeBackWrapper>
  );
}

/** Tape colour filter chip: 11x11 tape swatch (pops on select) + localized colour name. */
function ColorFilterChip({
  color,
  selected,
  onPress,
}: {
  color: RouteColor;
  selected: boolean;
  onPress: () => void;
}): React.JSX.Element {
  const { t } = useTranslation('common');
  const swatch = useTapeSwatch(color);
  return (
    <Chip
      variant="choice"
      label={t(`routeCatalog.colors.${color}`)}
      swatch={swatch.fill}
      swatchHair={swatch.hair}
      selected={selected}
      onPress={onPress}
    />
  );
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function makeStyles(theme: ReturnType<typeof useTheme>['theme'], screenMargin: number) {
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
      paddingHorizontal: screenMargin,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingLeft: screenMargin - theme.spacing.sm,
      paddingRight: screenMargin,
      paddingBottom: theme.spacing.xs,
      gap: theme.spacing.xs,
    },
    screenTitle: {
      flex: 1,
    },
    filterBlock: {
      paddingBottom: theme.spacing.xs,
    },
    filterRow: {
      paddingHorizontal: screenMargin,
      paddingVertical: theme.spacing.xs,
      columnGap: theme.spacing.sm,
    },
    listContent: {
      paddingBottom: theme.spacing.md,
    },
    cardWrapper: {
      marginHorizontal: screenMargin,
      marginBottom: theme.layout.cardGap,
    },
    addRouteCta: {
      marginHorizontal: screenMargin,
      marginTop: theme.layout.sectionGap,
      marginBottom: theme.spacing.xxl,
    },
  });
}
