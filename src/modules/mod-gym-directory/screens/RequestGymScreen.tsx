/**
 * RequestGymScreen.
 *
 * "Request a gym" form — name + city (required) + optional Google Maps link.
 * On success, inserts into `gym_requests` (status = pending) and shows a
 * confirmation state. Admin reviews via Supabase Studio.
 *
 * AC-070: accepts gym name, city, and optional Google Maps link; persists to
 * the admin-readable queue; shows confirmation on success.
 */

import type { Session } from '@supabase/supabase-js';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../../lib/theme';
import { submitGymRequest } from '../gym-service';

interface RequestGymScreenProps {
  session: Session;
  onBack: () => void;
}

type ScreenState = 'form' | 'success';

export default function RequestGymScreen({
  session,
  onBack,
}: RequestGymScreenProps): React.JSX.Element {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme, insets.top);

  const [screenState, setScreenState] = useState<ScreenState>('form');
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [googleMapsUrl, setGoogleMapsUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Validation
  const nameError = name.trim().length === 0 ? t('gymDirectory.requestGym.errors.nameRequired') : null;
  const cityError = city.trim().length === 0 ? t('gymDirectory.requestGym.errors.cityRequired') : null;
  const isFormValid = nameError === null && cityError === null;

  async function handleSubmit(): Promise<void> {
    if (!isFormValid) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await submitGymRequest(session.user.id, {
        name: name.trim(),
        city: city.trim(),
        google_maps_url: googleMapsUrl.trim() || null,
      });
      setScreenState('success');
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : t('gymDirectory.requestGym.errors.submitFailed');
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  // Success confirmation state
  if (screenState === 'success') {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.successTitle}>
          {t('gymDirectory.requestGym.successTitle')}
        </Text>
        <Text style={styles.successBody}>
          {t('gymDirectory.requestGym.successBody')}
        </Text>
        <Pressable
          style={styles.doneButton}
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel={t('common.done')}
        >
          <Text style={styles.doneButtonText}>{t('common.done')}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.contentContainer}
      keyboardShouldPersistTaps="handled"
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

      <Text style={styles.screenTitle}>{t('gymDirectory.requestGym.title')}</Text>
      <Text style={styles.screenSubtitle}>
        {t('gymDirectory.requestGym.subtitle')}
      </Text>

      {/* Gym name (required) */}
      <Text style={styles.fieldLabel}>
        {t('gymDirectory.requestGym.nameLabel')}
        <Text style={styles.required}> *</Text>
      </Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder={t('gymDirectory.requestGym.namePlaceholder')}
        placeholderTextColor={theme.colors.textDisabled}
        autoCorrect={false}
        returnKeyType="next"
        accessibilityLabel={t('gymDirectory.requestGym.nameLabel')}
      />

      {/* City (required) */}
      <Text style={styles.fieldLabel}>
        {t('gymDirectory.requestGym.cityLabel')}
        <Text style={styles.required}> *</Text>
      </Text>
      <TextInput
        style={styles.input}
        value={city}
        onChangeText={setCity}
        placeholder={t('gymDirectory.requestGym.cityPlaceholder')}
        placeholderTextColor={theme.colors.textDisabled}
        autoCorrect={false}
        returnKeyType="next"
        accessibilityLabel={t('gymDirectory.requestGym.cityLabel')}
      />

      {/* Google Maps URL (optional) */}
      <Text style={styles.fieldLabel}>
        {t('gymDirectory.requestGym.mapsUrlLabel')}
      </Text>
      <TextInput
        style={styles.input}
        value={googleMapsUrl}
        onChangeText={setGoogleMapsUrl}
        placeholder={t('gymDirectory.requestGym.mapsUrlPlaceholder')}
        placeholderTextColor={theme.colors.textDisabled}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        returnKeyType="done"
        onSubmitEditing={handleSubmit}
        accessibilityLabel={t('gymDirectory.requestGym.mapsUrlLabel')}
      />

      {/* Submission error */}
      {errorMessage ? (
        <Text style={styles.errorText}>{errorMessage}</Text>
      ) : null}

      {/* Submit button */}
      <Pressable
        style={({ pressed }) => [
          styles.submitButton,
          !isFormValid && styles.submitButtonDisabled,
          pressed && isFormValid && styles.submitButtonPressed,
        ]}
        onPress={handleSubmit}
        disabled={!isFormValid || isSubmitting}
        accessibilityRole="button"
        accessibilityLabel={t('gymDirectory.requestGym.submit')}
      >
        {isSubmitting ? (
          <ActivityIndicator color={theme.colors.textInverse} />
        ) : (
          <Text style={styles.submitButtonText}>
            {t('gymDirectory.requestGym.submit')}
          </Text>
        )}
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
      paddingHorizontal: theme.spacing.xl,
      paddingBottom: theme.spacing.xl,
    },
    backLink: {
      marginBottom: theme.spacing.md,
    },
    backLinkText: {
      fontSize: theme.fontSize.md,
      color: theme.colors.primary,
    },
    screenTitle: {
      fontSize: theme.fontSize.xxl,
      fontWeight: theme.fontWeight.bold,
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing.xs,
    },
    screenSubtitle: {
      fontSize: theme.fontSize.md,
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing.lg,
    },
    fieldLabel: {
      fontSize: theme.fontSize.sm,
      fontWeight: theme.fontWeight.medium,
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing.xs,
    },
    required: {
      color: theme.colors.error,
    },
    input: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.borderRadius.md,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm + 4,
      fontSize: theme.fontSize.md,
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing.md,
    },
    errorText: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.error,
      marginBottom: theme.spacing.md,
    },
    submitButton: {
      backgroundColor: theme.colors.primary,
      borderRadius: theme.borderRadius.md,
      height: 48,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: theme.spacing.sm,
    },
    submitButtonPressed: {
      backgroundColor: theme.colors.primaryPressed,
    },
    submitButtonDisabled: {
      backgroundColor: theme.colors.primaryDisabled,
    },
    submitButtonText: {
      color: theme.colors.textInverse,
      fontSize: theme.fontSize.md,
      fontWeight: theme.fontWeight.semibold,
    },
    successTitle: {
      fontSize: theme.fontSize.xl,
      fontWeight: theme.fontWeight.bold,
      color: theme.colors.success,
      textAlign: 'center',
      marginBottom: theme.spacing.md,
    },
    successBody: {
      fontSize: theme.fontSize.md,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginBottom: theme.spacing.xl,
      lineHeight: 22,
    },
    doneButton: {
      backgroundColor: theme.colors.primary,
      borderRadius: theme.borderRadius.md,
      paddingHorizontal: theme.spacing.xl,
      height: 48,
      alignItems: 'center',
      justifyContent: 'center',
    },
    doneButtonText: {
      color: theme.colors.textInverse,
      fontSize: theme.fontSize.md,
      fontWeight: theme.fontWeight.semibold,
    },
  });
}
