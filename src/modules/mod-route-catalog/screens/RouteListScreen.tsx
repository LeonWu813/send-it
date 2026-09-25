/**
 * RouteListScreen.
 *
 * Shows the active routes at a gym with grade + hold-color filter chips.
 *
 * AC-040: filterable by grade and hold color chip selectors.
 *         No free-text search. No status filter for normal users.
 * AC-041: shows active routes only for normal users.
 * AC-045: route display name composed as "{grade} {LocalizedColor} ({section_label}?)".
 * AC-046: achievement icons from MOD-004's fetchUserAchievements (cross-module read).
 * AC-047: read-only filled bookmark indicator on saved route cards.
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

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../../lib/theme';
import { fetchUserAchievements } from '../../mod-send-logging/send-service';
import { fetchSavedRouteIds, listRoutes } from '../route-service';
import type { RouteColor, RouteGrade, RouteListFilters, RouteSummary } from '../types';
import { ROUTE_COLORS, ROUTE_GRADES } from '../types';

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

/** Achievement icon config per ascent style. */
type AchievementStyle = 'flash' | 'top' | 'attempt';

interface AchievementIconProps {
  style: AchievementStyle;
  theme: ReturnType<typeof useTheme>['theme'];
}

function AchievementIcon({ style, theme }: AchievementIconProps): React.JSX.Element {
  switch (style) {
    case 'flash':
      return <Ionicons name="flash" size={16} color="#FFD700" />;
    case 'top':
      return <Ionicons name="checkmark-circle" size={16} color={theme.colors.success} />;
    case 'attempt':
      return <Ionicons name="ellipse-outline" size={16} color={theme.colors.textSecondary} />;
  }
}

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
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme, insets.top);

  const [routes, setRoutes] = useState<RouteSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filter state — grade and color only (AC-040); status is always 'active'
  const [gradeFilter, setGradeFilter] = useState<RouteGrade | null>(null);
  const [colorFilter, setColorFilter] = useState<RouteColor | null>(null);

  // AC-046: achievement icon map (route_id → best style)
  const [achievements, setAchievements] = useState<Record<string, AchievementStyle>>({});

  // AC-047: set of saved route IDs (read-only filled bookmark indicator)
  const [savedRouteIds, setSavedRouteIds] = useState<Set<string>>(new Set());

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

  const fetchRoutes = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await listRoutes(gymId, filters);
      setRoutes(data);

      // AC-046: fetch achievements once after routes load; one call with all ids
      if (data.length > 0) {
        try {
          const ach = await fetchUserAchievements(data.map((r) => r.id));
          setAchievements(ach);
        } catch {
          // Achievement overlay is best-effort — silently ignore failures
        }
      } else {
        setAchievements({});
      }
    } catch {
      setErrorMessage(t('routes.errors.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [gymId, filters, t]);

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

    return (
      <Pressable
        style={({ pressed }) => [
          styles.card,
          pressed && styles.cardPressed,
        ]}
        onPress={() => onSelectRoute(item.id)}
        accessibilityRole="button"
        accessibilityLabel={routeName}
      >
        <View style={styles.cardHeader}>
          {/* AC-045: formatted route name + AC-046: achievement icon directly beside name */}
          <View style={styles.routeNameRow}>
            <Text style={styles.routeName} numberOfLines={1} testID="route-name">
              {routeName}
            </Text>
            {achievement ? (
              <AchievementIcon style={achievement} theme={theme} />
            ) : null}
          </View>
          {/* AC-047: read-only saved bookmark indicator (no tap action) */}
          {isSaved ? (
            <Ionicons
              name="bookmark"
              size={16}
              color={theme.colors.warning}
              accessibilityLabel={t('routeCatalog.bookmark.saved')}
            />
          ) : null}
        </View>
        <Text style={styles.dateText}>
          {new Date(item.created_at).toLocaleDateString()}
        </Text>
      </Pressable>
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
        data={routes}
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
