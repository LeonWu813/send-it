/**
 * GymDetailScreen.
 *
 * Shows the full detail record for a single gym including name, branch,
 * city/district, address, map pin coordinates, gym type, photo (when present),
 * and a note for mixed gyms (bouldering areas only).
 *
 * AC-004 (gym detail portion): gym showing name, city/district, address,
 * map pin, gym type, and (if present) photo when a user opens the gym.
 * AC-120: bookmark icon reflecting saved state (filled primary / outline textSecondary).
 * AC-121: tapping the bookmark icon optimistically toggles save/unsave.
 * AC-196: cover_photo_url rendered at top when non-null; "Photos from Google"
 *   attribution shown adjacent to the image (Google Maps Platform ToS requirement).
 * AC-198: initials avatar derived from gym name shown when cover_photo_url is null.
 * Tappable address: pressing the address row opens Google Maps via Linking.openURL.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

import SwipeBackWrapper from '../../../components/SwipeBackWrapper';
import {
  AppText,
  Button,
  EmptyState,
  IconButton,
  NoticeBox,
  PageLoading,
  PressableScale,
  useLoadingPhase,
} from '../../../components/ui';
import i18n from '../../../lib/i18n';
import { ICON } from '../../../lib/icons';
import { CONTINUOUS, RADIUS, useLayout, useTheme } from '../../../lib/theme';
import { fetchSavedGymIds, loadGym, saveGym, unsaveGym } from '../gym-service';
import { useAppHeader, useTabBarInset } from '@/lib/AppHeaderContext';
import type { Gym } from '../types';

interface GymDetailScreenProps {
  gymId: string;
  onBack: () => void;
  onViewRoutes: (gymId: string, gymName: string) => void;
}

function localizedCity(gym: { city: string; city_zh: string }): string {
  return i18n.language.startsWith('zh') ? gym.city_zh : gym.city;
}
function localizedDistrict(gym: { district: string; district_zh: string }): string {
  return i18n.language.startsWith('zh') ? gym.district_zh : gym.district;
}

export default function GymDetailScreen({
  gymId,
  onBack,
  onViewRoutes,
}: GymDetailScreenProps): React.JSX.Element {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const { screenMargin } = useLayout();
  const tabInset = useTabBarInset();
  const styles = makeStyles(theme, screenMargin, tabInset.contentBottom);

  const [gym, setGym] = useState<Gym | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const loadingPhase = useLoadingPhase(isLoading);
  // 'notFound' = the row is gone (no retry can help); 'network' = the request threw (retry).
  const [loadError, setLoadError] = useState<'notFound' | 'network' | null>(null);

  // AC-120, AC-121: saved-gym bookmark state
  const [isSaved, setIsSaved] = useState(false);

  // G-2: the header title appears only once the in-body title has scrolled off.
  const [titleScrolledOff, setTitleScrolledOff] = useState(false);
  const titleBottom = useRef(Number.POSITIVE_INFINITY);
  const handleTitleLayout = useCallback((e: LayoutChangeEvent): void => {
    const { y, height } = e.nativeEvent.layout;
    titleBottom.current = y + height;
  }, []);
  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>): void => {
    setTitleScrolledOff(e.nativeEvent.contentOffset.y >= titleBottom.current);
  }, []);

  const fetchGym = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setLoadError(null);
    try {
      // Fetch gym detail and saved status in parallel
      const [data, savedIds] = await Promise.all([
        loadGym(gymId),
        fetchSavedGymIds(),
      ]);
      if (!data) {
        setLoadError('notFound');
      } else {
        setGym(data);
        setIsSaved(savedIds.includes(gymId));
      }
    } catch {
      setLoadError('network');
    } finally {
      setIsLoading(false);
    }
  }, [gymId]);

  useEffect(() => {
    void fetchGym();
  }, [fetchGym]);

  /**
   * AC-121: Optimistic bookmark toggle.
   * Flips the icon immediately, fires the DB write async, reverts on error.
   */
  const handleBookmarkToggle = useCallback(async (): Promise<void> => {
    const wasSaved = isSaved;
    setIsSaved(!wasSaved);
    try {
      if (wasSaved) {
        await unsaveGym(gymId);
      } else {
        await saveGym(gymId);
      }
    } catch {
      // Revert optimistic update on failure
      setIsSaved(wasSaved);
    }
  }, [gymId, isSaved]);

  // v2.2: AppShell header owns back + title; the bookmark toggle is its trailing control.
  useAppHeader({
    title: titleScrolledOff ? (gym?.name ?? '') : '',
    onBack,
    trailing: gym ? (
      <IconButton
        variant="float"
        name={isSaved ? ICON.bookmark.filled : ICON.bookmark.outline}
        accessibilityLabel={
          isSaved ? t('gymDirectory.bookmark.unsave') : t('gymDirectory.bookmark.save')
        }
        onPress={() => {
          void handleBookmarkToggle();
        }}
      />
    ) : undefined,
  });

  const isMixed = gym?.gym_type === 'both';
  // Photo author (truncatable first part of the credit capsule). No data yet; see the capsule comment.
  const author: string | null = null;
  const creditLabel = author
    ? `${author} · ${t('gymDirectory.googlePhotosAttribution')}`
    : t('gymDirectory.googlePhotosAttribution');

  const networkError = (
    <EmptyState
      variant="error"
      title={t('gymDirectory.errors.loadFailedTitle')}
      description={t('gymDirectory.errors.loadFailedBody')}
      primaryLabel={t('common.retry')}
      onPrimary={() => {
        void fetchGym();
      }}
    />
  );

  // One loading design for every page: nothing for 300ms, PageLoading, then E4 after 10s.
  if (isLoading) {
    return (
      <SwipeBackWrapper onBack={onBack} enabled={false}>
        {loadingPhase === 'loading' ? (
          <PageLoading />
        ) : (
          <View style={[styles.root, loadingPhase === 'timeout' ? styles.pageState : null]}>
            {loadingPhase === 'timeout' ? networkError : null}
          </View>
        )}
      </SwipeBackWrapper>
    );
  }

  if (loadError || !gym) {
    return (
      <SwipeBackWrapper onBack={onBack}>
        <View style={[styles.root, styles.pageState]}>
          {loadError === 'network' ? (
            networkError
          ) : (
            <EmptyState
              variant="page"
              icon={ICON.gyms.outline}
              title={t('gymDirectory.errors.notFoundTitle')}
              description={t('gymDirectory.errors.notFoundBody')}
            />
          )}
        </View>
      </SwipeBackWrapper>
    );
  }

  return (
    <SwipeBackWrapper onBack={onBack}>
      <View style={styles.root}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.contentContainer}
          scrollIndicatorInsets={{ bottom: 0 }}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          {/* AC-196: cover photo from Places API seeder. G-2: no photo => no photo area at all. */}
          {gym.cover_photo_url ? (
            <View>
              <Image
                source={{ uri: gym.cover_photo_url }}
                style={styles.coverPhoto}
                accessibilityLabel={gym.name ?? ''}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
              {/*
                AC-196: Google Maps Platform ToS attribution, overlaid as a scrim capsule (states-audit-ui 2.2).
                Only the author part truncates; the credit part never shrinks or wraps.
                `author` has no data source yet (needs the seeder to store authorAttributions).
              */}
              <View pointerEvents="box-none" style={styles.creditOuter}>
                <View accessible accessibilityLabel={creditLabel} style={styles.creditPill}>
                  {author ? (
                    <AppText
                      variant="footnote"
                      color="onMedia"
                      numberOfLines={1}
                      maxFontSizeMultiplier={1.2}
                      style={styles.creditAuthor}
                    >
                      {author}
                      {' · '}
                    </AppText>
                  ) : null}
                  <AppText
                    variant="footnote"
                    color="onMedia"
                    numberOfLines={1}
                    maxFontSizeMultiplier={1.2}
                    style={styles.creditText}
                  >
                    {t('gymDirectory.googlePhotosAttribution')}
                  </AppText>
                </View>
              </View>
            </View>
          ) : null}

          {/* Name + branch */}
          <View onLayout={handleTitleLayout}>
            <AppText variant="title1">{gym.name}</AppText>
            <AppText variant="title3" color="textSecondary" style={styles.nameZh}>
              {gym.name_zh}
            </AppText>
            {gym.branch_label ? (
              <AppText variant="callout" color="textSecondary" style={styles.branchLabel}>
                {gym.branch_label}
              </AppText>
            ) : null}
          </View>

          {/* Location section */}
          <View>
            <AppText variant="pageSection" style={styles.sectionLabel}>
              {t('gymDirectory.detail.location')}
            </AppText>
            <AppText variant="body">
              {localizedCity(gym)} · {localizedDistrict(gym)}
            </AppText>
            <PressableScale
              feedback="row"
              pressedColor={theme.colors.surfacePressed}
              accessibilityRole="link"
              accessibilityLabel={gym.address_text}
              onPress={() => {
                const mapsUrl =
                  gym.lat != null && gym.lng != null
                    ? `https://maps.google.com/?q=${gym.lat},${gym.lng}`
                    : `https://maps.google.com/?q=${encodeURIComponent(gym.address_text)}`;
                void Linking.openURL(mapsUrl);
              }}
              style={styles.addressRow}
            >
              <AppText variant="body" color="primary" style={styles.addressText}>
                {gym.address_text}
              </AppText>
              <Ionicons name={ICON.external.outline} size={16} color={theme.colors.primary} />
            </PressableScale>
          </View>

          {/* Mixed gym note */}
          {isMixed && gym.bouldering_only_note ? (
            <NoticeBox message={gym.bouldering_only_note} />
          ) : null}
        </ScrollView>

        {/* G-2: View Routes CTA pinned at the bottom (AC-005) */}
        <View style={styles.cta}>
          <Button
            variant="primary"
            fullWidth
            label={t('gymDirectory.detail.viewRoutes')}
            onPress={() => onViewRoutes(gym.id, gym.name)}
          />
        </View>
      </View>
    </SwipeBackWrapper>
  );
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function makeStyles(
  theme: ReturnType<typeof useTheme>['theme'],
  screenMargin: number,
  bottomInset: number,
) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scroll: {
      flex: 1,
    },
    // R0: the gap between sections is set once, here.
    contentContainer: {
      paddingTop: theme.spacing.md,
      paddingHorizontal: screenMargin,
      paddingBottom: theme.spacing.md,
      gap: theme.layout.sectionGap,
    },
    // E1 / E4 sit 48 below the header bottom (EmptyState adds the 48), so no top padding here.
    pageState: {
      paddingHorizontal: screenMargin,
    },
    coverPhoto: {
      width: '100%',
      height: 200,
      borderRadius: RADIUS.card,
      ...CONTINUOUS,
      overflow: 'hidden',
      backgroundColor: theme.colors.surfaceAlt,
    },
    creditOuter: {
      position: 'absolute',
      left: theme.spacing.sm,
      right: theme.spacing.sm,
      bottom: theme.spacing.sm,
      alignItems: 'flex-end',
    },
    creditPill: {
      flexDirection: 'row',
      maxWidth: '100%',
      height: 24,
      paddingHorizontal: theme.spacing.sm,
      alignItems: 'center',
      borderRadius: RADIUS.full,
      backgroundColor: theme.colors.mediaScrimStrong,
    },
    creditAuthor: {
      flexShrink: 1,
    },
    creditText: {
      flexShrink: 0,
    },
    nameZh: {
      marginTop: theme.layout.stackTight,
    },
    addressRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
    },
    addressText: {
      flex: 1,
    },
    branchLabel: {
      marginTop: theme.layout.stackTight,
    },
    sectionLabel: {
      marginBottom: theme.layout.sectionHeaderGap,
    },
    cta: {
      paddingHorizontal: screenMargin,
      paddingTop: theme.spacing.smd,
      paddingBottom: bottomInset > 0 ? bottomInset : theme.spacing.md,
      backgroundColor: theme.colors.background,
    },
  });
}
