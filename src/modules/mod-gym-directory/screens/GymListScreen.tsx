/**
 * GymListScreen.
 *
 * Displays the admin-curated gym directory as a searchable, filterable list.
 * Each card shows the gym name and city/district.
 *
 * AC-004: renders the Taipei/New Taipei branch-level gym directory with every
 * gym showing name, city/district, and (if present) photo when a user opens
 * the Gyms tab.
 * AC-122: saved gym cards display a filled bookmark status marker (read-only).
 *
 * Filter support: text search (name/city/district in both languages) + city filter chips.
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, AppState, FlatList, StyleSheet, View } from 'react-native';

import {
  AppText,
  Button,
  Card,
  Chip,
  EmptyState,
  InlineError,
  Skeleton,
  SkeletonGroup,
  TextField,
  useSkeletonPhase,
} from '../../../components/ui';
import i18n from '../../../lib/i18n';
import { ICON } from '../../../lib/icons';
import { useLayout, useTheme } from '../../../lib/theme';
import { useAppHeaderRoot } from '../../mod-home/components/AppHeaderContext';
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
  const { screenMargin } = useLayout();
  const header = useAppHeaderRoot();
  const topPad = header.contentTopInset > 0 ? header.contentTopInset : theme.spacing.md;
  const styles = makeStyles(theme, screenMargin, topPad, header.contentBottomInset);

  const [gyms, setGyms] = useState<GymSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const skeletonPhase = useSkeletonPhase(isLoading);
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
      <Card
        variant="pressable"
        inScroll
        onPress={() => onSelectGym(item.id)}
        accessibilityLabel={`${item.name}, ${localizedDistrict(item)}`}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleBlock}>
            <AppText variant="headline" numberOfLines={2}>
              {item.name}
            </AppText>
            {item.branch_label ? (
              <AppText variant="footnote" color="textSecondary">
                {item.branch_label}
              </AppText>
            ) : null}
          </View>
          {/* AC-122: filled bookmark status marker for saved gyms only (read-only, not pressable) */}
          {isItemSaved ? (
            <Ionicons
              name={ICON.bookmark.filled}
              size={theme.iconSize.sm}
              color={theme.colors.textSecondary}
              accessibilityLabel={t('gymDirectory.bookmark.saved')}
            />
          ) : null}
        </View>
        <AppText variant="subhead" color="textSecondary" style={styles.district}>
          {localizedCity(item)} · {localizedDistrict(item)}
        </AppText>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <View style={[styles.root, styles.pageTop]}>
        {skeletonPhase !== 'idle' ? (
          <SkeletonGroup label={t('gymDirectory.title')} style={styles.skeletonList}>
            {[0, 1, 2, 3].map((i) => (
              <Card key={i}>
                <Skeleton shape="text" textVariant="headline" width="60%" />
                <Skeleton shape="text" textVariant="footnote" width="30%" />
                <View style={styles.skeletonDistrict}>
                  <Skeleton shape="text" textVariant="subhead" width="45%" />
                </View>
              </Card>
            ))}
          </SkeletonGroup>
        ) : null}
      </View>
    );
  }

  if (errorMessage) {
    return (
      <View style={[styles.root, styles.pageTop]}>
        <InlineError
          variant="block"
          message={errorMessage}
          actionLabel={t('common.retry')}
          onAction={() => {
            void fetchGyms();
          }}
        />
      </View>
    );
  }

  const listHeader = (
    <>
      {/* Search input */}
      <View style={styles.searchWrap}>
        <TextField
          variant="search"
          value={searchText}
          onChangeText={setSearchText}
          placeholder={t('gymDirectory.searchPlaceholder')}
          accessibilityLabel={t('gymDirectory.searchPlaceholder')}
          autoCorrect={false}
        />
      </View>

      {/* City filter chips */}
      <View style={styles.filterRow}>
        <Chip
          variant="multi"
          label={t('gymDirectory.cityFilter.taipei')}
          on="background"
          selected={cityFilter === 'Taipei'}
          onPress={() => setCityFilter(cityFilter === 'Taipei' ? null : 'Taipei')}
        />
        <Chip
          variant="multi"
          label={t('gymDirectory.cityFilter.newTaipei')}
          on="background"
          selected={cityFilter === 'New Taipei'}
          onPress={() => setCityFilter(cityFilter === 'New Taipei' ? null : 'New Taipei')}
        />
      </View>
    </>
  );

  // Request a gym link
  const listFooter = (
    <View style={styles.requestRow}>
      <Button
        variant="ghost"
        size="md"
        on="background"
        label={t('gymDirectory.requestGym.cta')}
        trailingIcon={ICON.forward.outline}
        onPress={onRequestGym}
      />
    </View>
  );

  return (
    <View style={styles.root}>
      {/* The AppShell header shows the tab title; search + chips scroll with the list. */}
      <Animated.FlatList
        data={sortedGyms}
        keyExtractor={(item: GymSummary) => item.id}
        renderItem={renderGymCard}
        contentContainerStyle={styles.listContent}
        scrollIndicatorInsets={{ top: header.contentTopInset, bottom: header.indicatorBottomInset }}
        onScroll={header.onScroll}
        onContentSizeChange={header.onContentSizeChange}
        onLayout={header.onLayout}
        scrollEventThrottle={header.scrollEventThrottle}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={listHeader}
        ListFooterComponent={listFooter}
        ListEmptyComponent={
          <EmptyState variant="filtered" title={t('gymDirectory.noResults')} />
        }
      />
    </View>
  );
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function makeStyles(
  theme: ReturnType<typeof useTheme>['theme'],
  screenMargin: number,
  topPad: number,
  bottomInset: number,
) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.colors.background,
      paddingHorizontal: screenMargin,
    },
    pageTop: {
      paddingTop: topPad,
    },
    skeletonList: {
      gap: theme.layout.cardGap,
    },
    skeletonDistrict: {
      marginTop: theme.spacing.xs,
    },
    searchWrap: {
      marginBottom: theme.spacing.smd,
    },
    filterRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      columnGap: theme.spacing.sm,
      rowGap: theme.spacing.smd,
      marginBottom: theme.spacing.md,
    },
    listContent: {
      gap: theme.layout.cardGap,
      paddingTop: topPad,
      paddingBottom: bottomInset > 0 ? bottomInset : theme.spacing.lg,
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
    district: {
      marginTop: theme.spacing.xs,
    },
    requestRow: {
      alignItems: 'center',
    },
  });
}
