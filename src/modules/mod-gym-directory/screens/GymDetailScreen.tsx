/**
 * GymDetailScreen.
 *
 * Shows the full detail record for a single gym including name, branch,
 * city/district, address, map pin coordinates, gym type, photo (when present),
 * and a note for mixed gyms (bouldering areas only).
 *
 * AC-004 (gym detail portion): gym showing name, city/district, address,
 * map pin, gym type, and (if present) photo when a user opens the gym.
 * AC-120: bookmark icon reflecting saved state (filled yellow / gray outline).
 * AC-121: tapping the bookmark icon optimistically toggles save/unsave.
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import i18n from '../../../lib/i18n';
import { useTheme } from '../../../lib/theme';
import { fetchSavedGymIds, loadGym, saveGym, unsaveGym } from '../gym-service';
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
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme, insets.top);

  const [gym, setGym] = useState<Gym | null>(null);
  const [isLoading, setIsLoading] = useState(true);
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

  const isMixed = gym?.gym_type === 'both';

  if (isLoading) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator color={theme.colors.primary} size="large" />
      </View>
    );
  }

  if (errorMessage || !gym) {
    return (
      <View style={styles.centeredContainer}>
        <Pressable
          onPress={onBack}
          style={styles.backLink}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Ionicons name="chevron-back" size={24} color={theme.colors.primary} />
        </Pressable>
        <Text style={styles.errorText}>
          {errorMessage ?? t('common.error')}
        </Text>
        <Pressable
          style={styles.retryButton}
          onPress={fetchGym}
          accessibilityRole="button"
          accessibilityLabel={t('common.retry')}
        >
          <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.contentContainer}
    >
      {/* Header row: back navigation + bookmark toggle (AC-120, AC-121) */}
      <View style={styles.headerRow}>
        <Pressable
          onPress={onBack}
          style={styles.backLink}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Ionicons name="chevron-back" size={24} color={theme.colors.primary} />
        </Pressable>
        <Pressable
          onPress={() => { void handleBookmarkToggle(); }}
          style={styles.bookmarkButton}
          accessibilityRole="button"
          accessibilityLabel={
            isSaved
              ? t('gymDirectory.bookmark.unsave')
              : t('gymDirectory.bookmark.save')
          }
          accessibilityState={{ selected: isSaved }}
        >
          <Ionicons
            name={isSaved ? 'bookmark' : 'bookmark-outline'}
            size={28}
            color={isSaved ? theme.colors.warning : theme.colors.textSecondary}
          />
        </Pressable>
      </View>

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
          <Text style={styles.photoPlaceholderText}>
            {t('gymDirectory.detail.noPhoto')}
          </Text>
        </View>
      )}

      {/* Name + branch */}
      <Text style={styles.gymName}>{gym.name}</Text>
      <Text style={styles.gymNameZh}>{gym.name_zh}</Text>
      {gym.branch_label ? (
        <Text style={styles.branchLabel}>{gym.branch_label}</Text>
      ) : null}

      {/* Location section */}
      <Text style={styles.sectionLabel}>
        {t('gymDirectory.detail.location')}
      </Text>
      <Text style={styles.infoText}>
        {localizedCity(gym)} · {localizedDistrict(gym)}
      </Text>
      <Text style={styles.infoText}>{gym.address_text}</Text>
      <Text style={styles.coordinates}>
        {t('gymDirectory.detail.coordinates')}: {gym.lat.toFixed(4)},{' '}
        {gym.lng.toFixed(4)}
      </Text>

      {/* Grade system */}
      <Text style={styles.sectionLabel}>
        {t('gymDirectory.detail.gradingSystem')}
      </Text>
      <Text style={styles.infoText}>{gym.official_grading_system}</Text>

      {/* Mixed gym note */}
      {isMixed && gym.bouldering_only_note ? (
        <View style={styles.noteBox}>
          <Text style={styles.noteText}>{gym.bouldering_only_note}</Text>
        </View>
      ) : null}

      {/* View Routes CTA */}
      <Pressable
        style={styles.viewRoutesButton}
        onPress={() => onViewRoutes(gym.id, gym.name)}
        accessibilityRole="button"
        accessibilityLabel={t('gymDirectory.detail.viewRoutes')}
      >
        <Text style={styles.viewRoutesButtonText}>
          {t('gymDirectory.detail.viewRoutes')}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function makeStyles(theme: ReturnType<typeof useTheme>['theme'], topInset: number) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    contentContainer: {
      paddingTop: topInset + theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      paddingBottom: theme.spacing.xxl,
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
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing.md,
    },
    backLink: {
      // no extra margin — headerRow handles spacing
    },
    bookmarkButton: {
      padding: theme.spacing.xs,
    },
    photo: {
      width: '100%',
      height: 200,
      borderRadius: theme.borderRadius.lg,
      marginBottom: theme.spacing.md,
      backgroundColor: theme.colors.surface,
    },
    photoPlaceholder: {
      width: '100%',
      height: 160,
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: theme.spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    photoPlaceholderText: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.textDisabled,
    },
    gymName: {
      fontSize: theme.fontSize.xxl,
      fontWeight: theme.fontWeight.bold,
      color: theme.colors.textPrimary,
      marginBottom: 2,
    },
    gymNameZh: {
      fontSize: theme.fontSize.lg,
      fontWeight: theme.fontWeight.medium,
      color: theme.colors.textSecondary,
      marginBottom: 2,
    },
    branchLabel: {
      fontSize: theme.fontSize.md,
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing.md,
    },
    sectionLabel: {
      fontSize: theme.fontSize.sm,
      fontWeight: theme.fontWeight.semibold,
      color: theme.colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginTop: theme.spacing.lg,
      marginBottom: theme.spacing.xs,
    },
    infoText: {
      fontSize: theme.fontSize.md,
      color: theme.colors.textPrimary,
      marginBottom: 4,
    },
    coordinates: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.textSecondary,
      fontVariant: ['tabular-nums'],
      marginTop: 4,
    },
    noteBox: {
      backgroundColor: theme.colors.surface,
      borderLeftWidth: 3,
      borderLeftColor: theme.colors.warning,
      borderRadius: theme.borderRadius.sm,
      padding: theme.spacing.md,
      marginTop: theme.spacing.lg,
    },
    noteText: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.textSecondary,
      lineHeight: 20,
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
    viewRoutesButton: {
      marginTop: theme.spacing.xl,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      borderRadius: theme.borderRadius.md,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
    },
    viewRoutesButtonText: {
      fontSize: theme.fontSize.md,
      fontWeight: theme.fontWeight.semibold,
      color: theme.colors.background,
    },
  });
}
