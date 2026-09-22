/**
 * HomeGymSelectionScreen.
 *
 * Shown immediately after signup (isOnboarding: true) or from profile edit.
 * Loads the curated gym list, supports text search, and persists the selected
 * gym to the user's profile row via setHomeGym().
 *
 * AC-002: user selects exactly one home gym from the curated directory.
 * AC-003: signup + home gym selection completes within 60 seconds of
 *         user-perceived interaction time on a normal 4G/LTE connection.
 */

import type { Session } from '@supabase/supabase-js';
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

import { supabase } from '../../../lib/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../../lib/theme';
import { setHomeGym } from '../auth-service';
import type { GymListItem } from '../types';

interface HomeGymSelectionScreenProps {
  session: Session;
  isOnboarding: boolean;
  onComplete: () => void;
}

export default function HomeGymSelectionScreen({
  session,
  isOnboarding,
  onComplete,
}: HomeGymSelectionScreenProps): React.JSX.Element {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme, insets.top);

  const [gyms, setGyms] = useState<GymListItem[]>([]);
  const [searchText, setSearchText] = useState('');
  const [selectedGymId, setSelectedGymId] = useState<string | null>(null);
  const [isLoadingGyms, setIsLoadingGyms] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load gyms from Supabase on mount
  useEffect(() => {
    async function fetchGyms(): Promise<void> {
      const { data, error } = await supabase
        .from('gyms')
        .select('id, name, city')
        .order('name', { ascending: true });

      if (error) {
        setErrorMessage(t('common.error'));
      } else {
        setGyms((data as GymListItem[]) ?? []);
      }
      setIsLoadingGyms(false);
    }
    void fetchGyms();
  }, [t]);

  // Filter gyms by search text
  const filteredGyms = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) return gyms;
    return gyms.filter(
      (gym) =>
        gym.name.toLowerCase().includes(query) ||
        (gym.city?.toLowerCase().includes(query) ?? false),
    );
  }, [gyms, searchText]);

  const handleSelect = useCallback((gymId: string) => {
    setSelectedGymId(gymId);
    setErrorMessage(null);
  }, []);

  async function handleConfirm(): Promise<void> {
    if (!selectedGymId) return;
    setIsSaving(true);
    setErrorMessage(null);
    try {
      await setHomeGym(session.user.id, selectedGymId);
      onComplete();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : t('onboarding.homeGym.errors.saveFailed');
      setErrorMessage(message);
    } finally {
      setIsSaving(false);
    }
  }

  function renderGymItem({ item }: { item: GymListItem }): React.JSX.Element {
    const isSelected = item.id === selectedGymId;
    return (
      <Pressable
        style={[styles.gymItem, isSelected && styles.gymItemSelected]}
        onPress={() => handleSelect(item.id)}
        accessibilityRole="radio"
        accessibilityState={{ checked: isSelected }}
        accessibilityLabel={item.name}
      >
        <Text
          style={[styles.gymName, isSelected && styles.gymNameSelected]}
          numberOfLines={1}
        >
          {item.name}
        </Text>
        {item.city ? (
          <Text style={styles.gymCity} numberOfLines={1}>
            {item.city}
          </Text>
        ) : null}
      </Pressable>
    );
  }

  return (
    <View style={styles.root}>
      <Text style={styles.title}>{t('onboarding.homeGym.title')}</Text>
      <Text style={styles.subtitle}>{t('onboarding.homeGym.subtitle')}</Text>

      {/* Search */}
      <TextInput
        style={styles.searchInput}
        value={searchText}
        onChangeText={setSearchText}
        placeholder={t('onboarding.homeGym.searchPlaceholder')}
        placeholderTextColor={theme.colors.textDisabled}
        autoCorrect={false}
        clearButtonMode="while-editing"
        accessibilityLabel={t('onboarding.homeGym.searchPlaceholder')}
      />

      {/* Gym list */}
      {isLoadingGyms ? (
        <ActivityIndicator
          style={styles.loadingIndicator}
          color={theme.colors.primary}
        />
      ) : (
        <FlatList
          data={filteredGyms}
          keyExtractor={(item) => item.id}
          renderItem={renderGymItem}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {t('onboarding.homeGym.noResults')}
            </Text>
          }
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
        />
      )}

      {/* Error */}
      {errorMessage ? (
        <Text style={styles.errorText}>{errorMessage}</Text>
      ) : null}

      {/* Footer actions */}
      <View style={styles.footer}>
        {isOnboarding ? (
          <Pressable
            onPress={onComplete}
            disabled={isSaving}
            accessibilityRole="button"
            accessibilityLabel={t('onboarding.homeGym.skip')}
          >
            <Text style={styles.skipText}>{t('onboarding.homeGym.skip')}</Text>
          </Pressable>
        ) : null}

        <Pressable
          style={({ pressed }) => [
            styles.confirmButton,
            !selectedGymId && styles.confirmButtonDisabled,
            pressed && selectedGymId && styles.confirmButtonPressed,
          ]}
          onPress={handleConfirm}
          disabled={!selectedGymId || isSaving}
          accessibilityRole="button"
          accessibilityLabel={t('onboarding.homeGym.confirm')}
        >
          {isSaving ? (
            <ActivityIndicator color={theme.colors.textInverse} />
          ) : (
            <Text style={styles.confirmButtonText}>
              {t('onboarding.homeGym.confirm')}
            </Text>
          )}
        </Pressable>
      </View>
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
    title: {
      fontSize: theme.fontSize.xl,
      fontWeight: theme.fontWeight.bold,
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing.xs,
    },
    subtitle: {
      fontSize: theme.fontSize.md,
      color: theme.colors.textSecondary,
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
    loadingIndicator: {
      marginTop: theme.spacing.xl,
    },
    listContent: {
      paddingBottom: theme.spacing.md,
    },
    gymItem: {
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginBottom: theme.spacing.sm,
      backgroundColor: theme.colors.surface,
    },
    gymItemSelected: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.background,
    },
    gymName: {
      fontSize: theme.fontSize.md,
      fontWeight: theme.fontWeight.medium,
      color: theme.colors.textPrimary,
    },
    gymNameSelected: {
      color: theme.colors.primary,
    },
    gymCity: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    emptyText: {
      textAlign: 'center',
      fontSize: theme.fontSize.md,
      color: theme.colors.textSecondary,
      marginTop: theme.spacing.xl,
    },
    errorText: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.error,
      marginTop: theme.spacing.sm,
    },
    footer: {
      paddingVertical: theme.spacing.md,
      gap: theme.spacing.sm,
    },
    skipText: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    confirmButton: {
      backgroundColor: theme.colors.primary,
      borderRadius: theme.borderRadius.md,
      height: 48,
      alignItems: 'center',
      justifyContent: 'center',
    },
    confirmButtonPressed: {
      backgroundColor: theme.colors.primaryPressed,
    },
    confirmButtonDisabled: {
      backgroundColor: theme.colors.primaryDisabled,
    },
    confirmButtonText: {
      color: theme.colors.textInverse,
      fontSize: theme.fontSize.md,
      fontWeight: theme.fontWeight.semibold,
    },
  });
}
