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
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import SwipeBackWrapper from '../../../components/SwipeBackWrapper';
import {
  AppText,
  Button,
  Card,
  InlineError,
  TextField,
} from '../../../components/ui';
import { ICON } from '../../../lib/icons';
import { LAYOUT, useLayout, useTheme } from '../../../lib/theme';
import { useAppHeader, useHideTabBar } from '../../mod-home/components/AppHeaderContext';
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
  const { screenMargin } = useLayout();
  const styles = makeStyles(theme, screenMargin);

  useAppHeader({ title: t('gymDirectory.requestGym.title'), onBack });
  useHideTabBar();

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
      <SwipeBackWrapper onBack={onBack}>
        <View style={styles.centeredContainer}>
          <Ionicons
            name={ICON.sendTop.outline}
            size={theme.iconSize.xl}
            color={theme.colors.success}
            style={styles.successIcon}
          />
          <AppText variant="title2" align="center" accessibilityRole="header">
            {t('gymDirectory.requestGym.successTitle')}
          </AppText>
          <AppText
            variant="subhead"
            color="textSecondary"
            align="center"
            style={styles.successBody}
          >
            {t('gymDirectory.requestGym.successBody')}
          </AppText>
          <Button
            variant="primary"
            fullWidth
            label={t('common.done')}
            onPress={onBack}
          />
        </View>
      </SwipeBackWrapper>
    );
  }

  return (
    <SwipeBackWrapper onBack={onBack} enabled={!isSubmitting}>
      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
      >
        <AppText variant="largeTitle" accessibilityRole="header">
          {t('gymDirectory.requestGym.title')}
        </AppText>
        <AppText variant="subhead" color="textSecondary" style={styles.screenSubtitle}>
          {t('gymDirectory.requestGym.subtitle')}
        </AppText>

        <Card style={styles.form}>
          {/* Gym name (required) */}
          <TextField
            label={`${t('gymDirectory.requestGym.nameLabel')} *`}
            accessibilityLabel={t('gymDirectory.requestGym.nameLabel')}
            value={name}
            onChangeText={setName}
            placeholder={t('gymDirectory.requestGym.namePlaceholder')}
            autoCorrect={false}
            returnKeyType="next"
          />

          {/* City (required) */}
          <TextField
            label={`${t('gymDirectory.requestGym.cityLabel')} *`}
            accessibilityLabel={t('gymDirectory.requestGym.cityLabel')}
            value={city}
            onChangeText={setCity}
            placeholder={t('gymDirectory.requestGym.cityPlaceholder')}
            autoCorrect={false}
            returnKeyType="next"
          />

          {/* Google Maps URL (optional) */}
          <TextField
            label={t('gymDirectory.requestGym.mapsUrlLabel')}
            value={googleMapsUrl}
            onChangeText={setGoogleMapsUrl}
            placeholder={t('gymDirectory.requestGym.mapsUrlPlaceholder')}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
          />
        </Card>

        {/* Submission error */}
        {errorMessage ? (
          <InlineError variant="block" message={errorMessage} style={styles.errorBlock} />
        ) : null}

        {/* Submit button */}
        <View style={styles.submit}>
          <Button
            variant="primary"
            fullWidth
            label={t('gymDirectory.requestGym.submit')}
            onPress={() => {
              void handleSubmit();
            }}
            disabled={!isFormValid || isSubmitting}
            loading={isSubmitting}
          />
        </View>
      </ScrollView>
    </SwipeBackWrapper>
  );
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function makeStyles(theme: ReturnType<typeof useTheme>['theme'], screenMargin: number) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    contentContainer: {
      paddingTop: theme.spacing.sm,
      paddingHorizontal: screenMargin,
      paddingBottom: theme.spacing.xxl,
    },
    centeredContainer: {
      flex: 1,
      backgroundColor: theme.colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: screenMargin,
      paddingVertical: theme.spacing.xl,
    },
    screenSubtitle: {
      marginTop: theme.spacing.xs,
      marginBottom: theme.layout.sectionGap,
    },
    form: {
      gap: LAYOUT.fieldGap,
    },
    errorBlock: {
      marginTop: theme.spacing.md,
    },
    submit: {
      marginTop: theme.spacing.lg,
    },
    successIcon: {
      marginBottom: theme.spacing.smd,
    },
    successBody: {
      marginTop: theme.spacing.xs,
      marginBottom: theme.spacing.xl,
    },
  });
}
