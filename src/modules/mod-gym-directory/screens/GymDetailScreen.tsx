/**
 * GymDetailScreen.
 *
 * Shows the full detail record for a single gym including name, branch,
 * city/district, address, map pin coordinates, gym type, photo (when present),
 * and a note for mixed gyms (bouldering areas only).
 *
 * AC-004 (gym detail portion): gym showing name, city/district, address,
 * map pin, gym type, and (if present) photo when a user opens the gym.
 */

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

import { useTheme } from '../../../lib/theme';
import { loadGym } from '../gym-service';
import type { Gym, GymType } from '../types';

interface GymDetailScreenProps {
  gymId: string;
  onBack: () => void;
}

export default function GymDetailScreen({
  gymId,
  onBack,
}: GymDetailScreenProps): React.JSX.Element {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const styles = makeStyles(theme);

  const [gym, setGym] = useState<Gym | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchGym = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await loadGym(gymId);
      if (!data) {
        setErrorMessage(t('gymDirectory.errors.notFound'));
      } else {
        setGym(data);
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

  function gymTypeLabel(gymType: GymType): string {
    switch (gymType) {
      case 'bouldering':
        return t('gymDirectory.gymTypeBadge.bouldering');
      case 'top_rope':
        return t('gymDirectory.gymTypeBadge.topRope');
      case 'both':
        return t('gymDirectory.gymTypeBadge.both');
    }
  }

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
          <Text style={styles.backLinkText}>{t('common.back')}</Text>
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
      {/* Back navigation */}
      <Pressable
        onPress={onBack}
        style={styles.backLink}
        accessibilityRole="button"
        accessibilityLabel={t('common.back')}
      >
        <Text style={styles.backLinkText}>{t('common.back')}</Text>
      </Pressable>

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

      {/* Gym type badge */}
      <View
        style={[
          styles.badge,
          isMixed ? styles.badgeMixed : styles.badgeBouldering,
        ]}
      >
        <Text style={styles.badgeText}>{gymTypeLabel(gym.gym_type)}</Text>
      </View>

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
        {gym.city} · {gym.district}
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
    </ScrollView>
  );
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function makeStyles(theme: ReturnType<typeof useTheme>['theme']) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    contentContainer: {
      padding: theme.spacing.lg,
      paddingBottom: theme.spacing.xxl,
    },
    centeredContainer: {
      flex: 1,
      backgroundColor: theme.colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.spacing.lg,
    },
    backLink: {
      marginBottom: theme.spacing.md,
    },
    backLinkText: {
      fontSize: theme.fontSize.md,
      color: theme.colors.primary,
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
    badge: {
      alignSelf: 'flex-start',
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 3,
      borderRadius: theme.borderRadius.sm,
      marginBottom: theme.spacing.sm,
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
  });
}
