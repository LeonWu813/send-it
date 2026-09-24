/**
 * GymListScreen.
 *
 * Displays the admin-curated gym directory as a searchable, filterable list.
 * Each card shows the gym name and city/district.
 *
 * AC-004: renders the Taipei/New Taipei branch-level gym directory with every
 * gym showing name, city/district, and (if present) photo when a user opens
 * the Gyms tab.
 * AC-122: saved gym cards display a filled yellow bookmark indicator (read-only).
 *
 * Filter support: text search (name/city/district in both languages) + city filter chips.
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  AppState,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import i18n from '../../../lib/i18n';
import { useTheme } from '../../../lib/theme';
import { fetchSavedGymIds, listGyms } from '../gym-service';
import type { GymSummary } from '../types';

interface GymListScreenProps {
  onSelectGym: (gymId: string) => void;
  onRequestGym: () => void;
}

function localizedCity(gym: { city: string; city_zh: string }): string {
  return i18n.language.startsWith('zh') ? gym.city_zh : gym.city;
}
function localizedDistrict(gym: { district: string; district_zh: string }): string {
  return i18n.language.startsWith('zh') ? gym.district_zh : gym.district;
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
  const [cityFilter, setCityFilter] = useState<string | null>(null);

  // AC-122: set of saved gym IDs (read-only indicator on cards)
  const [savedGymIds, setSavedGymIds] = useState<Set<string>>(new Set());

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

  const fetchSaved = useCallback(async (): Promise<void> => {
    try {
      const ids = await fetchSavedGymIds();
      setSavedGymIds(new Set(ids));
    } catch {
      // Saved indicator is best-effort — silently ignore failures
    }
  }, []);

  useEffect(() => {
    void fetchGyms();
    void fetchSaved();
  }, [fetchGyms, fetchSaved]);

  // Re-fetch saved IDs when the app comes back to the foreground (e.g. after
  // the user saves/unsaves on GymDetailScreen and returns to the list).
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

  // Apply search text + city filter
  const filteredGyms = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    return gyms.filter((gym) => {
      const matchesSearch =
        !query ||
        gym.name.toLowerCase().includes(query) ||
        gym.name_zh.toLowerCase().includes(query) ||
        gym.city.toLowerCase().includes(query) ||
        gym.city_zh.toLowerCase().includes(query) ||
        gym.district.toLowerCase().includes(query) ||
        gym.district_zh.toLowerCase().includes(query) ||
        (gym.branch_label?.toLowerCase().includes(query) ?? false);

      const matchesCity =
        cityFilter === null || gym.city === cityFilter;

      return matchesSearch && matchesCity;
    });
  }, [gyms, searchText, cityFilter]);

  // Sort: saved gyms float to the top; order within each group is preserved.
  const sortedGyms = useMemo(() => {
    if (savedGymIds.size === 0) return filteredGyms;
    return [...filteredGyms].sort((a, b) => {
      const aSaved = savedGymIds.has(a.id) ? 0 : 1;
      const bSaved = savedGymIds.has(b.id) ? 0 : 1;
      return aSaved - bSaved;
    });
  }, [filteredGyms, savedGymIds]);

  function renderGymCard({ item }: { item: GymSummary }): React.JSX.Element {
    const isItemSaved = savedGymIds.has(item.id);
    return (
      <Pressable
        style={({ pressed }) => [
          styles.card,
          pressed && styles.cardPressed,
        ]}
        onPress={() => onSelectGym(item.id)}
        accessibilityRole="button"
        accessibilityLabel={`${item.name}, ${localizedDistrict(item)}`}
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
          {/* AC-122: filled yellow bookmark indicator for saved gyms only (read-only) */}
          {isItemSaved ? (
            <Ionicons
              name="bookmark"
              size={20}
              color={theme.colors.warning}
              accessibilityLabel={t('gymDirectory.bookmark.saved')}
            />
          ) : null}
        </View>
        <Text style={styles.district}>
          {localizedCity(item)} · {localizedDistrict(item)}
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

      {/* City filter chips */}
      <View style={styles.filterRow}>
        <Pressable
          style={[styles.chip, cityFilter === 'Taipei' && styles.chipActive]}
          onPress={() => setCityFilter(cityFilter === 'Taipei' ? null : 'Taipei')}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: cityFilter === 'Taipei' }}
          accessibilityLabel={t('gymDirectory.cityFilter.taipei')}
        >
          <Text style={[styles.chipText, cityFilter === 'Taipei' && styles.chipTextActive]}>
            {t('gymDirectory.cityFilter.taipei')}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.chip, cityFilter === 'New Taipei' && styles.chipActive]}
          onPress={() => setCityFilter(cityFilter === 'New Taipei' ? null : 'New Taipei')}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: cityFilter === 'New Taipei' }}
          accessibilityLabel={t('gymDirectory.cityFilter.newTaipei')}
        >
          <Text style={[styles.chipText, cityFilter === 'New Taipei' && styles.chipTextActive]}>
            {t('gymDirectory.cityFilter.newTaipei')}
          </Text>
        </Pressable>
      </View>

      {/* Gym list */}
      <FlatList
        data={sortedGyms}
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
