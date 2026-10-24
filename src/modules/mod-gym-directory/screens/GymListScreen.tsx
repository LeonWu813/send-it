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
 * AC-197: cover_photo_url shown as thumbnail on each gym card when non-null;
 *   initials avatar (AC-198) shown when null. "Photos from Google" attribution
 *   shown at the bottom of the list when at least one card has a Google photo.
 * AC-198: initials avatar derived from gym name shown when cover_photo_url is null.
 *
 * Filter support: text search (name/city/district in both languages) + city filter chips.
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image } from 'expo-image';
import { Animated, AppState, FlatList, StyleSheet, View } from 'react-native';

import {
  AppText,
  Button,
  Card,
  Chip,
  EmptyState,
  PageLoading,
  TextField,
  useLoadingPhase,
} from '../../../components/ui';
import i18n from '../../../lib/i18n';
import { ICON } from '../../../lib/icons';
import { useLayout, useTheme } from '../../../lib/theme';
import { useAppHeaderRoot } from '@/lib/AppHeaderContext';
import { fetchSavedGymIds, listGyms } from '../gym-service';
import type { GymSummary } from '../types';
import { getGymInitials } from '../gym-initials';

/** Fixed gym row: 12 padding + 48 thumbnail + 12 padding (R14, G-1). */
const THUMB = 48;
const ROW_HEIGHT = 72;

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
  const styles = makeStyles(theme, screenMargin, topPad, header.contentTopInset + theme.spacing.md, header.contentBottomInset);

  const [gyms, setGyms] = useState<GymSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const loadingPhase = useLoadingPhase(isLoading);
  const [hasError, setHasError] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [cityFilter, setCityFilter] = useState<string | null>(null);

  // AC-122: set of saved gym IDs (read-only indicator on cards)
  const [savedGymIds, setSavedGymIds] = useState<Set<string>>(new Set());

  const fetchGyms = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setHasError(false);
    try {
      const data = await listGyms();
      setGyms(data);
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

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

  // AC-197: show "Photos from Google" attribution when at least one visible card has a Google photo.
  const hasGooglePhotos = useMemo(
    () => sortedGyms.some((gym) => gym.cover_photo_url !== null),
    [sortedGyms],
  );

  const Separator = useCallback(
    (): React.JSX.Element => <View style={styles.separator} />,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [theme.layout.cardGap],
  );

  function renderGymCard({ item }: { item: GymSummary }): React.JSX.Element {
    const isItemSaved = savedGymIds.has(item.id);
    return (
      <Card
        variant="pressable"
        inScroll
        padding={theme.spacing.smd}
        style={styles.card}
        onPress={() => onSelectGym(item.id)}
        accessibilityLabel={`${item.name}, ${localizedDistrict(item)}`}
      >
        <View style={styles.cardRow}>
          {/* AC-197: thumbnail slot — cover photo or initials avatar (AC-198) */}
          {item.cover_photo_url ? (
            <Image
              source={{ uri: item.cover_photo_url }}
              style={styles.thumbnail}
              contentFit="cover"
              cachePolicy="memory-disk"
              accessibilityLabel={item.name}
            />
          ) : (
            <View style={styles.initialsAvatar}>
              <AppText variant="callout" color="textSecondary">
                {getGymInitials(item.name ?? '')}
              </AppText>
            </View>
          )}

          <View style={styles.cardContent}>
            <AppText variant="headline" numberOfLines={1}>
              {item.name}
            </AppText>
            {/* R14: one meta line, stackTight gap below the name (fixed 72pt row) */}
            <AppText variant="footnote" color="textSecondary" numberOfLines={1} style={styles.meta}>
              {[item.branch_label, localizedCity(item), localizedDistrict(item)]
                .filter(Boolean)
                .join(' · ')}
            </AppText>
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
      </Card>
    );
  }

  const retryError = (
    <EmptyState
      variant="error"
      title={t('gymDirectory.errors.loadFailedTitle')}
      description={t('gymDirectory.errors.loadFailedBody')}
      primaryLabel={t('common.retry')}
      onPrimary={() => {
        void fetchGyms();
      }}
    />
  );

  // One loading design for every page: nothing for 300ms, PageLoading, then E4 after 10s.
  if (isLoading) {
    if (loadingPhase === 'loading') return <PageLoading />;
    if (loadingPhase === 'timeout') return <View style={[styles.root, styles.pageTop]}>{retryError}</View>;
    return <View style={styles.root} />;
  }

  if (hasError) {
    return <View style={[styles.root, styles.pageTop]}>{retryError}</View>;
  }

  const isFiltered = searchText.trim() !== '' || cityFilter !== null;

  // E1 (the directory itself is empty): nothing to search, so no controls above the empty state.
  const listHeader = gyms.length === 0 ? null : (
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
      {/* Empty result: the anchor is the chip row's bottom, so drop its trailing margin. */}
      <View style={[styles.filterRow, sortedGyms.length === 0 ? styles.filterRowLast : null]}>
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

  // Request a gym link + AC-197 "Photos from Google" attribution
  const listFooter = (
    <View>
      {/* AC-197: Google Maps Platform ToS — show attribution when any card has a Google photo */}
      {hasGooglePhotos ? (
        <AppText variant="footnote" color="textSecondary" style={styles.googleAttribution}>
          {t('gymDirectory.googlePhotosAttribution')}
        </AppText>
      ) : null}
      {sortedGyms.length > 0 ? (
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
      ) : null}
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
        ItemSeparatorComponent={Separator}
        ListHeaderComponent={listHeader}
        ListFooterComponent={listFooter}
        ListEmptyComponent={
          isFiltered ? (
            <EmptyState
              variant="filtered"
              title={t('gymDirectory.filteredEmpty.title')}
              description={t('gymDirectory.filteredEmpty.description')}
              primaryLabel={t('gymDirectory.filteredEmpty.clear')}
              onPrimary={() => {
                setSearchText('');
                setCityFilter(null);
              }}
              secondaryLabel={t('gymDirectory.requestGym.cta')}
              onSecondary={onRequestGym}
            />
          ) : (
            <EmptyState
              variant="page"
              icon={ICON.gyms.outline}
              title={t('gymDirectory.empty.title')}
              secondaryLabel={t('gymDirectory.requestGym.cta')}
              onSecondary={onRequestGym}
            />
          )
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
  listTopPad: number,
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
    filterRowLast: {
      marginBottom: 0,
    },
    separator: {
      height: theme.layout.cardGap,
    },
    listContent: {
      // R2: content starts 16 below the header, same as Home.
      paddingTop: listTopPad,
      paddingBottom: bottomInset > 0 ? bottomInset : theme.spacing.lg,
    },
    card: {
      height: ROW_HEIGHT,
      justifyContent: 'center',
    },
    cardRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    thumbnail: {
      width: THUMB,
      height: THUMB,
      borderRadius: theme.radius.media,
      backgroundColor: theme.colors.surfaceAlt,
      flexShrink: 0,
    },
    initialsAvatar: {
      width: THUMB,
      height: THUMB,
      borderRadius: theme.radius.media,
      backgroundColor: theme.colors.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    cardContent: {
      flex: 1,
    },
    meta: {
      marginTop: theme.layout.stackTight,
    },
    googleAttribution: {
      textAlign: 'right',
      marginTop: theme.spacing.sm,
      marginBottom: theme.spacing.xs,
    },
    // A6/A8: ghost button has 14pt padding; pull the label onto the 16pt keyline.
    requestRow: {
      alignItems: 'flex-start',
      marginLeft: -14,
    },
  });
}
