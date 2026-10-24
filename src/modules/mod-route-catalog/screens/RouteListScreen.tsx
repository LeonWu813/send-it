/**
 * RouteListScreen.
 *
 * Shows the active routes at a gym with grade + hold-color filter chips.
 *
 * AC-040: filterable by grade and hold color. RL-2: one "Filter" row opens a sheet (grade + colour);
 *         active filters show as removable chips; "+" (add route) sits in the header trailing slot.
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
  BottomSheet,
  Button,
  ButtonGroup,
  Chip,
  EmptyState,
  IconButton,
  PageLoading,
  useLoadingPhase,
} from '../../../components/ui';
import { ICON } from '../../../lib/icons';
import { useLayout, useTheme } from '../../../lib/theme';
import { useAppHeader, useTabBarInset } from '@/lib/AppHeaderContext';
import { useTapeSwatch } from '../components/RouteColorBadge';
import { fetchUserAchievements } from '../../mod-send-logging';
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
  /**
   * Controlled filter state — when provided by a parent navigator, filter selections
   * survive RouteListScreen unmount/remount (e.g. navigate-to-detail then back).
   * When absent, the screen manages filter state internally (used in tests).
   */
  gradeFilter?: RouteGrade | null;
  colorFilter?: RouteColor | null;
  onGradeFilterChange?: (grade: RouteGrade | null) => void;
  onColorFilterChange?: (color: RouteColor | null) => void;
  /** Stories / tests only: open the filter sheet on mount. */
  initialFilterSheetOpen?: boolean;
}

export default function RouteListScreen({
  gymId,
  gymName,
  onSelectRoute,
  onSubmitRoute,
  onBack,
  gradeFilter: controlledGradeFilter,
  colorFilter: controlledColorFilter,
  onGradeFilterChange,
  onColorFilterChange,
  initialFilterSheetOpen = false,
}: RouteListScreenProps): React.JSX.Element {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const { screenMargin } = useLayout();
  const styles = makeStyles(theme, screenMargin);
  const tabInset = useTabBarInset();

  const [routes, setRoutes] = useState<RouteSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const loadingPhase = useLoadingPhase(isLoading);

  // Filter state — grade and color only (AC-040); status is always 'active'.
  // When the parent navigator passes controlled props (gradeFilter/colorFilter +
  // onGradeFilterChange/onColorFilterChange), those values are used and the local
  // state is ignored — this keeps filter selections alive across the
  // unmount/remount cycle that occurs when navigating to a detail screen and back.
  // When no controlled props are provided (e.g. in tests), the screen manages
  // filter state internally.
  const [internalGradeFilter, setInternalGradeFilter] = useState<RouteGrade | null>(null);
  const [internalColorFilter, setInternalColorFilter] = useState<RouteColor | null>(null);

  const gradeFilter = controlledGradeFilter !== undefined ? controlledGradeFilter : internalGradeFilter;
  const colorFilter = controlledColorFilter !== undefined ? controlledColorFilter : internalColorFilter;

  // RL-2: filter sheet (grade + colour)
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(initialFilterSheetOpen);

  // RL-2: "+" in the header trailing slot (AC-043: forwards the current filters to the submit screen)
  useAppHeader({
    title: gymName,
    onBack,
    trailing: (
      <IconButton
        variant="float"
        name={ICON.add.outline}
        size={24}
        onPress={() => onSubmitRoute(gradeFilter ?? undefined, colorFilter ?? undefined)}
        accessibilityLabel={t('routes.submit.title')}
      />
    ),
  });

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
    const next = gradeFilter === grade ? null : grade;
    if (onGradeFilterChange) {
      onGradeFilterChange(next);
    } else {
      setInternalGradeFilter(next);
    }
  }

  function toggleColorFilter(color: RouteColor): void {
    const next = colorFilter === color ? null : color;
    if (onColorFilterChange) {
      onColorFilterChange(next);
    } else {
      setInternalColorFilter(next);
    }
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
      section: item.section_label,
    };

    // RouteCard (Rev 39/40) handles bookmark icon and send badge natively via props.
    // No overlay Views needed — the card is fully presentational and wired here.
    return (
      <View>
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

  function clearGradeFilter(): void {
    if (onGradeFilterChange) onGradeFilterChange(null);
    else setInternalGradeFilter(null);
  }

  function clearColorFilter(): void {
    if (onColorFilterChange) onColorFilterChange(null);
    else setInternalColorFilter(null);
  }

  const hasActiveFilters = gradeFilter !== null || colorFilter !== null;

  function clearAllFilters(): void {
    clearGradeFilter();
    clearColorFilter();
  }

  function addRoute(): void {
    onSubmitRoute(gradeFilter ?? undefined, colorFilter ?? undefined);
  }

  /** RL-2: one row. "Filter" opens the sheet; each active filter is a removable chip after it. */
  const listHeader = (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.filterRow}
      testID="filter-row"
    >
      <Chip
        variant="filter"
        icon={ICON.filter.outline}
        label={t('routeCatalog.filter.button')}
        onPress={() => setIsFilterSheetOpen(true)}
      />
      {gradeFilter !== null ? (
        <Chip
          variant="filter"
          selected
          label={gradeFilter}
          onPress={() => setIsFilterSheetOpen(true)}
          onClear={clearGradeFilter}
          clearAccessibilityLabel={t('routeCatalog.filter.removeChip', { label: gradeFilter })}
        />
      ) : null}
      {colorFilter !== null ? (
        <ActiveColorChip
          color={colorFilter}
          onPress={() => setIsFilterSheetOpen(true)}
          onClear={clearColorFilter}
        />
      ) : null}
    </ScrollView>
  );

  const filterSheet = (
    <BottomSheet
      visible={isFilterSheetOpen}
      onClose={() => setIsFilterSheetOpen(false)}
      title={t('routeCatalog.filter.sheetTitle')}
      variant="content"
      footer={
        <ButtonGroup
          buttons={
            hasActiveFilters
              ? [
                  { label: t('common.done'), onPress: () => setIsFilterSheetOpen(false) },
                  {
                    label: t('routeCatalog.filter.clearAll'),
                    variant: 'secondary',
                    onPress: clearAllFilters,
                  },
                ]
              : [{ label: t('common.done'), onPress: () => setIsFilterSheetOpen(false) }]
          }
        />
      }
    >
      <View style={styles.sheetBody}>
        <View style={styles.sheetGroup}>
          <AppText variant="headline">{t('routeCatalog.filter.grade')}</AppText>
          <View style={styles.chipWrap} accessibilityRole="radiogroup">
            {ROUTE_GRADES.map((grade) => (
              <Chip
                key={grade}
                variant="choice"
                label={grade}
                on="surface"
                selected={gradeFilter === grade}
                onPress={() => toggleGradeFilter(grade)}
              />
            ))}
          </View>
        </View>
        <View style={styles.sheetGroup}>
          <AppText variant="headline">{t('routeCatalog.filter.color')}</AppText>
          <View style={[styles.chipWrap, styles.colorChipWrap]} accessibilityRole="radiogroup">
            {ROUTE_COLORS.map((color) => (
              <ColorFilterChip
                key={color}
                color={color}
                selected={colorFilter === color}
                onPress={() => toggleColorFilter(color)}
              />
            ))}
          </View>
        </View>
      </View>
    </BottomSheet>
  );

  // Full-page loading: nothing for 300ms, then PageLoading; after 10s the E4 error replaces it
  // (a late success swaps back to content).
  if (isLoading && loadingPhase !== 'timeout') {
    return loadingPhase === 'loading' ? <PageLoading /> : <View style={styles.root} />;
  }

  if (isLoading || errorMessage) {
    return (
      <View style={styles.root}>
        <EmptyState
          variant="error"
          title={t('routeCatalog.loadErrorTitle')}
          description={t('routeCatalog.loadErrorDescription')}
          primaryLabel={t('common.retry')}
          onPrimary={() => { void fetchRoutes(); }}
        />
      </View>
    );
  }

  // 0 routes and no filter applied: E1 page empty, no filter row (the header "+" stays).
  const isFirstUseEmpty = sortedRoutes.length === 0 && !hasActiveFilters;

  return (
    <SwipeBackWrapper onBack={onBack ?? (() => {})}>
      <View style={styles.root}>
        <FlatList
          data={sortedRoutes}
          keyExtractor={(item) => item.id}
          renderItem={renderRouteCard}
          ListHeaderComponent={isFirstUseEmpty ? null : listHeader}
          ListHeaderComponentStyle={styles.listHeader}
          ItemSeparatorComponent={CardSeparator}
          contentContainerStyle={[styles.listContent, isFirstUseEmpty && styles.listContentEmpty, { paddingBottom: tabInset.contentBottom || theme.spacing.md }]}
          scrollIndicatorInsets={{ bottom: tabInset.indicatorBottom }}
          keyboardShouldPersistTaps="handled"
          ListFooterComponent={
            sortedRoutes.length > 0 ? (
              <Button
                variant="text"
                placement="inline"
                label={t('routeCatalog.addRoute')}
                onPress={addRoute}
                style={{ marginTop: theme.spacing.md }}
              />
            ) : null
          }
          ListEmptyComponent={
            isFirstUseEmpty ? (
              <EmptyState
                variant="page"
                icon={ICON.route.outline}
                title={t('routeCatalog.emptyTitle')}
                description={t('routeCatalog.emptyDescription')}
                primaryLabel={t('routeCatalog.submit.addRoute')}
                onPrimary={addRoute}
              />
            ) : (
              <EmptyState
                variant="filtered"
                icon={ICON.filter.outline}
                title={t('routeCatalog.noResults')}
                description={t('routeCatalog.filteredDescription')}
                primaryLabel={t('routeCatalog.filter.clearAll')}
                onPrimary={clearAllFilters}
                secondaryLabel={t('routeCatalog.addRoute')}
                onSecondary={addRoute}
              />
            )
          }
        />
        {filterSheet}
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
      selected={selected}
      onPress={onPress}
    />
  );
}

/** RL-2: an applied colour filter as a removable chip (swatch + name + separate clear button). */
function ActiveColorChip({
  color,
  onPress,
  onClear,
}: {
  color: RouteColor;
  onPress: () => void;
  onClear: () => void;
}): React.JSX.Element {
  const { t } = useTranslation('common');
  const swatch = useTapeSwatch(color);
  const label = t(`routeCatalog.colors.${color}`);
  return (
    <Chip
      variant="filter"
      selected
      label={label}
      swatch={swatch.fill}
      onPress={onPress}
      onClear={onClear}
      clearAccessibilityLabel={t('routeCatalog.filter.removeChip', { label })}
    />
  );
}

/** R6: card ↔ card gap `cardGap`, owned by the list (not a per-card margin). */
function CardSeparator(): React.JSX.Element {
  const { theme } = useTheme();
  return <View style={{ height: theme.layout.cardGap }} />;
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function makeStyles(theme: ReturnType<typeof useTheme>['theme'], screenMargin: number) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    // R0/R10: the list owns the margin; the chip row adds no vertical padding of its own.
    listContent: {
      paddingHorizontal: screenMargin,
      paddingTop: theme.spacing.md,
    },
    // First-use E1 starts 48pt below the header (EmptyState owns it): no extra list top padding.
    listContentEmpty: {
      paddingTop: 0,
    },
    // Filter row -> first card = md (R10)
    listHeader: {
      marginBottom: theme.spacing.md,
      marginHorizontal: -screenMargin,
    },
    filterRow: {
      paddingHorizontal: screenMargin,
      columnGap: theme.layout.inlineGap,
      alignItems: 'center',
    },
    sheetBody: {
      gap: theme.layout.sectionGap,
    },
    sheetGroup: {
      gap: theme.layout.sectionHeaderGap,
    },
    // C4/A8: transparent colour chips: pull the row left by the chip's 14pt padding so the swatch sits on the 20 keyline
    colorChipWrap: {
      marginLeft: -14,
    },
    chipWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      columnGap: theme.layout.inlineGap,
      rowGap: theme.layout.inlineGap,
    },
  });
}
