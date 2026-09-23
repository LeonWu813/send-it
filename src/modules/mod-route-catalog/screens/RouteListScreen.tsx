/**
 * RouteListScreen.
 *
 * Shows the active routes at a gym with grade + hold-color filter chips.
 *
 * AC-040: filterable by grade and hold color chip selectors.
 *         No free-text search. No status filter for normal users.
 * AC-041: shows active routes only for normal users.
 * US-006: browse currently active routes at a gym.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../../lib/theme';
import RouteColorBadge from '../components/RouteColorBadge';
import { listRoutes } from '../route-service';
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

interface RouteListScreenProps {
  gymId: string;
  gymName: string;
  onSelectRoute: (routeId: string) => void;
  onSubmitRoute: () => void;
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

  const filters: RouteListFilters = useMemo(
    () => ({ grade: gradeFilter, colorTag: colorFilter }),
    [gradeFilter, colorFilter],
  );

  const fetchRoutes = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await listRoutes(gymId, filters);
      setRoutes(data);
    } catch {
      setErrorMessage(t('routes.errors.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [gymId, filters, t]);

  useEffect(() => {
    void fetchRoutes();
  }, [fetchRoutes]);

  function toggleGradeFilter(grade: RouteGrade): void {
    setGradeFilter((prev) => (prev === grade ? null : grade));
  }

  function toggleColorFilter(color: RouteColor): void {
    setColorFilter((prev) => (prev === color ? null : color));
  }

  // Deduplicated grades present in the loaded route list (for filter chips)
  const availableGrades = useMemo(() => {
    const seen = new Set<RouteGrade>();
    for (const r of routes) {
      seen.add(r.grade);
    }
    // Return in canonical grade order
    return ROUTE_GRADES.filter((g) => seen.has(g));
  }, [routes]);

  function renderRouteCard({ item }: { item: RouteSummary }): React.JSX.Element {
    return (
      <Pressable
        style={({ pressed }) => [
          styles.card,
          pressed && styles.cardPressed,
        ]}
        onPress={() => onSelectRoute(item.id)}
        accessibilityRole="button"
        accessibilityLabel={`${item.grade} ${item.color_tag} route`}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.gradeBadge}>{item.grade}</Text>
          <RouteColorBadge color={item.color_tag} size="sm" />
        </View>
        {item.section_label ? (
          <Text style={styles.sectionLabel}>{item.section_label}</Text>
        ) : null}
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
      {/* Grade filter chips — only shown when routes are loaded */}
      {availableGrades.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {availableGrades.map(renderGradeChip)}
        </ScrollView>
      )}

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
      onPress={onSubmitRoute}
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
            <Text style={styles.backLinkText}>{t('common.back')}</Text>
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
    backLinkText: {
      fontSize: theme.fontSize.md,
      color: theme.colors.primary,
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
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.xs,
    },
    gradeBadge: {
      fontSize: theme.fontSize.lg,
      fontWeight: theme.fontWeight.bold,
      color: theme.colors.textPrimary,
      minWidth: 36,
    },
    sectionLabel: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.textSecondary,
      marginBottom: 2,
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
