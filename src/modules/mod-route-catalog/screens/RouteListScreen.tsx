/**
 * RouteListScreen.
 *
 * Shows the active routes at a gym with grade + status filter controls.
 *
 * AC-040: filterable by grade and active/retired status.
 * AC-041: defaults to status = 'active' when no filter is explicitly set.
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

import { useTheme } from '../../../lib/theme';
import RouteColorBadge from '../components/RouteColorBadge';
import { listRoutes } from '../route-service';
import type { RouteGrade, RouteListFilters, RouteSummary } from '../types';
import { ROUTE_GRADES } from '../types';

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
  const styles = makeStyles(theme);

  const [routes, setRoutes] = useState<RouteSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filter state — default status = 'active' per AC-041
  const [filters, setFilters] = useState<RouteListFilters>({
    grade: null,
    status: 'active',
  });

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
    setFilters((prev) => ({
      ...prev,
      grade: prev.grade === grade ? null : grade,
    }));
  }

  function toggleStatusFilter(status: 'active' | 'retired'): void {
    setFilters((prev) => ({ ...prev, status }));
  }

  // Deduplicated grades present in the current route list (for filter chips)
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
          {item.status === 'retired' && (
            <View style={styles.retiredBadge}>
              <Text style={styles.retiredBadgeText}>
                {t('routes.status.retired')}
              </Text>
            </View>
          )}
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
    const isActive = filters.grade === grade;
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

  const listHeader = (
    <View>
      {/* Status filter tabs */}
      <View style={styles.statusTabRow}>
        <Pressable
          style={[
            styles.statusTab,
            filters.status === 'active' && styles.statusTabActive,
          ]}
          onPress={() => toggleStatusFilter('active')}
          accessibilityRole="tab"
          accessibilityState={{ selected: filters.status === 'active' }}
          accessibilityLabel={t('routes.status.active')}
        >
          <Text
            style={[
              styles.statusTabText,
              filters.status === 'active' && styles.statusTabTextActive,
            ]}
          >
            {t('routes.status.active')}
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.statusTab,
            filters.status === 'retired' && styles.statusTabActive,
          ]}
          onPress={() => toggleStatusFilter('retired')}
          accessibilityRole="tab"
          accessibilityState={{ selected: filters.status === 'retired' }}
          accessibilityLabel={t('routes.status.retired')}
        >
          <Text
            style={[
              styles.statusTabText,
              filters.status === 'retired' && styles.statusTabTextActive,
            ]}
          >
            {t('routes.status.retired')}
          </Text>
        </Pressable>
      </View>

      {/* Grade filter chips — only shown when routes are loaded */}
      {availableGrades.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.gradeFilterRow}
        >
          {availableGrades.map(renderGradeChip)}
        </ScrollView>
      )}
    </View>
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
        <Pressable
          style={styles.submitButton}
          onPress={onSubmitRoute}
          accessibilityRole="button"
          accessibilityLabel={t('routes.submit.cta')}
        >
          <Text style={styles.submitButtonText}>{t('routes.submit.cta')}</Text>
        </Pressable>
      </View>

      <FlatList
        data={routes}
        keyExtractor={(item) => item.id}
        renderItem={renderRouteCard}
        ListHeaderComponent={listHeader}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <Text style={styles.emptyText}>{t('routes.noResults')}</Text>
        }
      />
    </View>
  );
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function makeStyles(theme: ReturnType<typeof useTheme>['theme']) {
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
      padding: theme.spacing.lg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.xl,
      paddingBottom: theme.spacing.md,
      flexWrap: 'wrap',
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
      marginRight: theme.spacing.sm,
    },
    submitButton: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.borderRadius.md,
      backgroundColor: theme.colors.primary,
    },
    submitButtonText: {
      fontSize: theme.fontSize.sm,
      fontWeight: theme.fontWeight.semibold,
      color: theme.colors.textInverse,
    },
    statusTabRow: {
      flexDirection: 'row',
      paddingHorizontal: theme.spacing.lg,
      marginBottom: theme.spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.divider,
    },
    statusTab: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      marginRight: theme.spacing.sm,
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    statusTabActive: {
      borderBottomColor: theme.colors.primary,
    },
    statusTabText: {
      fontSize: theme.fontSize.md,
      color: theme.colors.textSecondary,
    },
    statusTabTextActive: {
      color: theme.colors.primary,
      fontWeight: theme.fontWeight.semibold,
    },
    gradeFilterRow: {
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
    listContent: {
      paddingBottom: theme.spacing.xxl,
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
    retiredBadge: {
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 2,
      borderRadius: theme.borderRadius.sm,
      backgroundColor: theme.colors.border,
    },
    retiredBadgeText: {
      fontSize: theme.fontSize.xs,
      color: theme.colors.textSecondary,
      fontWeight: theme.fontWeight.medium,
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
