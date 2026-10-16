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
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, ScrollView, StyleSheet, View } from 'react-native';

import SwipeBackWrapper from '../../../components/SwipeBackWrapper';
import {
  AppText,
  Button,
  IconButton,
  InlineError,
  NoticeBox,
  Skeleton,
  SkeletonGroup,
  useSkeletonPhase,
} from '../../../components/ui';
import i18n from '../../../lib/i18n';
import { ICON } from '../../../lib/icons';
import { CONTINUOUS, RADIUS, useLayout, useTheme } from '../../../lib/theme';
import { fetchSavedGymIds, loadGym, saveGym, unsaveGym } from '../gym-service';
import { useAppHeader, useTabBarInset } from '../../mod-home/components/AppHeaderContext';
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
  const skeletonPhase = useSkeletonPhase(isLoading);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // AC-120, AC-121: saved-gym bookmark state
  const [isSaved, setIsSaved] = useState(false);

  const fetchGym = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      // Fetch gym detail and saved status in parallel
      const [data, savedIds] = await Promise.all([
        loadGym(gymId),
        fetchSavedGymIds(),
      ]);
      if (!data) {
        setErrorMessage(t('gymDirectory.errors.notFound'));
      } else {
        setGym(data);
        setIsSaved(savedIds.includes(gymId));
      }
    } catch {
      setErrorMessage(t('gymDirectory.errors.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [gymId, t]);

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
    title: gym?.name ?? '',
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

  if (isLoading) {
    return (
      <SwipeBackWrapper onBack={onBack} enabled={false}>
        <View style={styles.root}>
          <View style={styles.contentContainer}>
            {skeletonPhase !== 'idle' ? (
              <SkeletonGroup label={t('gymDirectory.title')} style={styles.skeletonGroup}>
                <Skeleton shape="card" surface="page" height={160} />
                <Skeleton shape="text" textVariant="title1" width="70%" surface="page" />
                <Skeleton shape="text" textVariant="title3" width="45%" surface="page" />
                <Skeleton shape="text" textVariant="title3" width="30%" surface="page" />
                <Skeleton shape="text" textVariant="body" width="60%" surface="page" />
                <Skeleton shape="text" textVariant="body" width="80%" surface="page" />
              </SkeletonGroup>
            ) : null}
          </View>
        </View>
      </SwipeBackWrapper>
    );
  }

  if (errorMessage || !gym) {
    return (
      <SwipeBackWrapper onBack={onBack}>
        <View style={styles.root}>
          <View style={styles.contentContainer}>
            <InlineError
              variant="block"
              message={errorMessage ?? t('common.error')}
              actionLabel={t('common.retry')}
              onAction={() => {
                void fetchGym();
              }}
            />
          </View>
        </View>
      </SwipeBackWrapper>
    );
  }

  return (
    <SwipeBackWrapper onBack={onBack}>
      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.contentContainer}
        scrollIndicatorInsets={{ bottom: tabInset.indicatorBottom }}
      >
        {/* Gym photo (when present) */}
        {gym.photo_url ? (
          <Image
            source={{ uri: gym.photo_url }}
            style={styles.photo}
            accessibilityLabel={gym.name}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.photoPlaceholder}>
            <AppText variant="footnote" color="textDisabled">
              {t('gymDirectory.detail.noPhoto')}
            </AppText>
          </View>
        )}

        {/* Name + branch */}
        <AppText variant="title1">{gym.name}</AppText>
        <AppText variant="title3" color="textSecondary">
          {gym.name_zh}
        </AppText>
        {gym.branch_label ? (
          <AppText variant="callout" color="textSecondary" style={styles.branchLabel}>
            {gym.branch_label}
          </AppText>
        ) : null}

        {/* Location section */}
        <AppText variant="pageSection" style={styles.sectionLabel}>
          {t('gymDirectory.detail.location')}
        </AppText>
        <AppText variant="body">
          {localizedCity(gym)} · {localizedDistrict(gym)}
        </AppText>
        <AppText variant="body">{gym.address_text}</AppText>
        <AppText variant="footnote" color="textSecondary" numeric style={styles.coordinates}>
          {t('gymDirectory.detail.coordinates')}: {gym.lat.toFixed(4)},{' '}
          {gym.lng.toFixed(4)}
        </AppText>

        {/* Grade system */}
        <AppText variant="pageSection" style={styles.sectionLabel}>
          {t('gymDirectory.detail.gradingSystem')}
        </AppText>
        <AppText variant="body">{gym.official_grading_system}</AppText>

        {/* Mixed gym note */}
        {isMixed && gym.bouldering_only_note ? (
          <NoticeBox message={gym.bouldering_only_note} style={styles.noteBox} />
        ) : null}

        {/* View Routes CTA */}
        <View style={styles.cta}>
          <Button
            variant="primary"
            fullWidth
            label={t('gymDirectory.detail.viewRoutes')}
            onPress={() => onViewRoutes(gym.id, gym.name)}
          />
        </View>
      </ScrollView>
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
    contentContainer: {
      paddingTop: theme.spacing.sm,
      paddingHorizontal: screenMargin,
      paddingBottom: bottomInset > 0 ? bottomInset : theme.spacing.xxl,
    },
    skeletonGroup: {
      gap: theme.layout.cardGap,
    },
    photo: {
      width: '100%',
      aspectRatio: 2,
      borderRadius: RADIUS.card,
      ...CONTINUOUS,
      overflow: 'hidden',
      marginBottom: theme.spacing.md,
      backgroundColor: theme.colors.surfaceAlt,
    },
    photoPlaceholder: {
      width: '100%',
      minHeight: 160,
      borderRadius: RADIUS.card,
      ...CONTINUOUS,
      backgroundColor: theme.colors.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: theme.spacing.md,
    },
    branchLabel: {
      marginTop: theme.spacing.xxs,
    },
    sectionLabel: {
      marginTop: theme.layout.sectionGap,
      marginBottom: theme.layout.sectionHeaderGap,
    },
    coordinates: {
      marginTop: theme.spacing.xs,
    },
    noteBox: {
      marginTop: theme.layout.sectionGap,
    },
    cta: {
      marginTop: theme.spacing.xl,
    },
  });
}
