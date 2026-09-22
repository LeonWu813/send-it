/**
 * GymListScreen.
 *
 * Displays the admin-curated gym directory as a searchable, filterable list.
 * Each card shows the gym name, district, and gym_type badge.
 *
 * AC-004: renders the Taipei/New Taipei branch-level gym directory with every
 * gym showing name, city/district, gym type (and photo when present).
 *
 * Filter support: text search (name/district) + district filter + gym_type filter.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../../lib/theme';
import { listGyms } from '../gym-service';
import type { GymSummary, GymType } from '../types';

interface GymListScreenProps {
  onSelectGym: (gymId: string) => void;
  onRequestGym: () => void;
}

export default function GymListScreen({
  onSelectGym,
  onRequestGym,
}: GymListScreenProps): React.JSX.Element {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme, insets.top);

  const [gyms, setGyms] = useState<GymSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [districtFilter, setDistrictFilter] = useState<string | null>(null);
  const [gymTypeFilter, setGymTypeFilter] = useState<GymType | null>(null);

  const fetchGyms = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await listGyms();
      setGyms(data);
    } catch {
      setErrorMessage(t('gymDirectory.errors.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void fetchGyms();
  }, [fetchGyms]);

  // Derive unique districts for filter chips
  const availableDistricts = useMemo(() => {
    const seen = new Set<string>();
    for (const gym of gyms) {
      seen.add(gym.district);
    }
    return Array.from(seen).sort();
  }, [gyms]);

  // Apply search text + district + gym_type filters
  const filteredGyms = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    return gyms.filter((gym) => {
      const matchesSearch =
        !query ||
        gym.name.toLowerCase().includes(query) ||
        gym.name_zh.toLowerCase().includes(query) ||
        gym.district.toLowerCase().includes(query) ||
        (gym.branch_label?.toLowerCase().includes(query) ?? false);

      const matchesDistrict =
        districtFilter === null || gym.district === districtFilter;

      const matchesType =
        gymTypeFilter === null || gym.gym_type === gymTypeFilter;

      return matchesSearch && matchesDistrict && matchesType;
    });
  }, [gyms, searchText, districtFilter, gymTypeFilter]);

  function gymTypeBadgeLabel(gymType: GymType): string {
    switch (gymType) {
      case 'bouldering':
        return t('gymDirectory.gymTypeBadge.bouldering');
      case 'top_rope':
        return t('gymDirectory.gymTypeBadge.topRope');
      case 'both':
        return t('gymDirectory.gymTypeBadge.both');
    }
  }

  function renderGymCard({ item }: { item: GymSummary }): React.JSX.Element {
    const isMixed = item.gym_type === 'both';
    return (
      <Pressable
        style={({ pressed }) => [
          styles.card,
          pressed && styles.cardPressed,
        ]}
        onPress={() => onSelectGym(item.id)}
        accessibilityRole="button"
        accessibilityLabel={`${item.name}, ${item.district}`}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleBlock}>
            <Text style={styles.gymName} numberOfLines={2}>
              {item.name}
            </Text>
            {item.branch_label ? (
              <Text style={styles.branchLabel}>{item.branch_label}</Text>
            ) : null}
          </View>
          <View
            style={[
              styles.badge,
              isMixed ? styles.badgeMixed : styles.badgeBouldering,
            ]}
          >
            <Text style={styles.badgeText}>{gymTypeBadgeLabel(item.gym_type)}</Text>
          </View>
        </View>
        <Text style={styles.district}>
          {item.city} · {item.district}
        </Text>
      </Pressable>
    );
  }

  function renderDistrictChip(district: string): React.JSX.Element {
    const isActive = districtFilter === district;
    return (
      <Pressable
        key={district}
        style={[styles.chip, isActive && styles.chipActive]}
        onPress={() => setDistrictFilter(isActive ? null : district)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isActive }}
        accessibilityLabel={district}
      >
        <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
          {district}
        </Text>
      </Pressable>
    );
  }

  function renderGymTypeChip(
    gymType: GymType,
    label: string,
  ): React.JSX.Element {
    const isActive = gymTypeFilter === gymType;
    return (
      <Pressable
        key={gymType}
        style={[styles.chip, isActive && styles.chipActive]}
        onPress={() => setGymTypeFilter(isActive ? null : gymType)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isActive }}
        accessibilityLabel={label}
      >
        <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
          {label}
        </Text>
      </Pressable>
    );
  }

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
          onPress={fetchGyms}
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
      {/* Screen title */}
      <Text style={styles.screenTitle}>{t('gymDirectory.title')}</Text>

      {/* Search input */}
      <TextInput
        style={styles.searchInput}
        value={searchText}
        onChangeText={setSearchText}
        placeholder={t('gymDirectory.searchPlaceholder')}
        placeholderTextColor={theme.colors.textDisabled}
        autoCorrect={false}
        clearButtonMode="while-editing"
        accessibilityLabel={t('gymDirectory.searchPlaceholder')}
      />

      {/* Filter chips row */}
      <View style={styles.filterRow}>
        {/* Gym type filters */}
        {renderGymTypeChip(
          'bouldering',
          t('gymDirectory.gymTypeBadge.bouldering'),
        )}
        {renderGymTypeChip('both', t('gymDirectory.gymTypeBadge.mixed'))}
        {/* District filters */}
        {availableDistricts.map(renderDistrictChip)}
      </View>

      {/* Gym list */}
      <FlatList
        data={filteredGyms}
        keyExtractor={(item) => item.id}
        renderItem={renderGymCard}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <Text style={styles.emptyText}>{t('gymDirectory.noResults')}</Text>
        }
      />

      {/* Request a gym link */}
      <Pressable
        style={styles.requestButton}
        onPress={onRequestGym}
        accessibilityRole="button"
        accessibilityLabel={t('gymDirectory.requestGym.cta')}
      >
        <Text style={styles.requestButtonText}>
          {t('gymDirectory.requestGym.cta')}
        </Text>
      </Pressable>
    </View>
  );
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function makeStyles(theme: ReturnType<typeof useTheme>['theme'], topInset: number) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.colors.background,
      paddingHorizontal: theme.spacing.lg,
      paddingTop: topInset + theme.spacing.md,
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
    screenTitle: {
      fontSize: theme.fontSize.xxl,
      fontWeight: theme.fontWeight.bold,
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing.md,
    },
    searchInput: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.borderRadius.md,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm + 4,
      fontSize: theme.fontSize.md,
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing.sm,
    },
    filterRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.xs,
      marginBottom: theme.spacing.md,
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
      paddingBottom: theme.spacing.lg,
    },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.sm,
    },
    cardPressed: {
      opacity: 0.85,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: theme.spacing.sm,
    },
    cardTitleBlock: {
      flex: 1,
    },
    gymName: {
      fontSize: theme.fontSize.md,
      fontWeight: theme.fontWeight.semibold,
      color: theme.colors.textPrimary,
    },
    branchLabel: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    district: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.textSecondary,
      marginTop: theme.spacing.xs,
    },
    badge: {
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 3,
      borderRadius: theme.borderRadius.sm,
      flexShrink: 0,
    },
    badgeBouldering: {
      backgroundColor: theme.colors.primary,
    },
    badgeMixed: {
      backgroundColor: theme.colors.warning,
    },
    badgeText: {
      fontSize: theme.fontSize.xs,
      fontWeight: theme.fontWeight.semibold,
      color: theme.colors.textInverse,
    },
    emptyText: {
      textAlign: 'center',
      fontSize: theme.fontSize.md,
      color: theme.colors.textSecondary,
      marginTop: theme.spacing.xl,
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
    requestButton: {
      paddingVertical: theme.spacing.md,
      alignItems: 'center',
    },
    requestButtonText: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.primary,
      fontWeight: theme.fontWeight.medium,
    },
  });
}
