/**
 * RequestGymScreen stories — "request a gym" form (AC-070).
 *
 * States:
 *  Default          — empty form; submit button disabled until name + city are filled
 *  Submitting       — form with the submit button in loading state
 *  Success          — confirmation card shown after a successful submission
 *  ValidationError  — form with an inline error block (failed API call)
 *
 * Navigation: this module uses custom state-machine navigation — no
 * @react-navigation/native hooks are used or mocked.
 */

import type { Session } from '@supabase/supabase-js';
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import {
  AppText,
  Button,
  Card,
  InlineError,
  TextField,
} from '../../../components/ui';
import { ICON } from '../../../lib/icons';
import { LAYOUT, useLayout, useTheme } from '../../../lib/theme';
import RequestGymScreen from '../screens/RequestGymScreen';

// ── Fake session ──────────────────────────────────────────────────────────────

const session = { user: { id: 'user-demo' } } as unknown as Session;

// ── Shared frame ──────────────────────────────────────────────────────────────

function ScreenFrame({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <View style={{ width: 390, height: 844 }}>{children}</View>;
}

// ── Meta ──────────────────────────────────────────────────────────────────────

const meta: Meta = {
  title: 'GymDirectory/RequestGymScreen',
  parameters: { layout: 'fullscreen' },
  decorators: [(Story) => <ScreenFrame><Story /></ScreenFrame>],
};
export default meta;
type Story = StoryObj;

// ── Default (empty form) ──────────────────────────────────────────────────────
// Renders the real screen. Submit button is disabled until name + city are filled.

export const Default: Story = {
  render: () => (
    <RequestGymScreen session={session} onBack={() => console.log('onBack')} />
  ),
};

// ── Submitting ────────────────────────────────────────────────────────────────
// Shows the form with the submit button in its loading/disabled state, matching
// the UI during the async API call.

function SubmittingShell(): React.JSX.Element {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const { screenMargin } = useLayout();
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: theme.spacing.sm,
          paddingHorizontal: screenMargin,
          paddingBottom: theme.spacing.xxl,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <AppText variant="largeTitle" accessibilityRole="header">
          {t('gymDirectory.requestGym.title')}
        </AppText>
        <AppText
          variant="subhead"
          color="textSecondary"
          style={{ marginTop: theme.spacing.xs, marginBottom: theme.layout.sectionGap }}
        >
          {t('gymDirectory.requestGym.subtitle')}
        </AppText>

        <Card style={{ gap: LAYOUT.fieldGap }}>
          <TextField
            label={`${t('gymDirectory.requestGym.nameLabel')} *`}
            accessibilityLabel={t('gymDirectory.requestGym.nameLabel')}
            value="RedRock 紅石攀岩"
            onChangeText={() => {}}
          />
          <TextField
            label={`${t('gymDirectory.requestGym.cityLabel')} *`}
            accessibilityLabel={t('gymDirectory.requestGym.cityLabel')}
            value="Taipei"
            onChangeText={() => {}}
          />
          <TextField
            label={t('gymDirectory.requestGym.mapsUrlLabel')}
            value=""
            onChangeText={() => {}}
          />
        </Card>

        <View style={{ marginTop: theme.spacing.lg }}>
          <Button
            variant="primary"
            fullWidth
            label={t('gymDirectory.requestGym.submit')}
            onPress={() => {}}
            disabled
            loading
          />
        </View>
      </ScrollView>
    </View>
  );
}

export const Submitting: Story = {
  render: () => <SubmittingShell />,
};

// ── Success ───────────────────────────────────────────────────────────────────
// Confirmation view shown after the gym request is submitted successfully.

function SuccessShell(): React.JSX.Element {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const { screenMargin } = useLayout();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.colors.background,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: screenMargin,
        paddingVertical: theme.spacing.xl,
      }}
    >
      <Ionicons
        name={ICON.sendTop.outline}
        size={theme.iconSize.xl}
        color={theme.colors.success}
        style={{ marginBottom: theme.spacing.smd }}
      />
      <AppText variant="title2" align="center" accessibilityRole="header">
        {t('gymDirectory.requestGym.successTitle')}
      </AppText>
      <AppText
        variant="subhead"
        color="textSecondary"
        align="center"
        style={{ marginTop: theme.spacing.xs, marginBottom: theme.spacing.xl }}
      >
        {t('gymDirectory.requestGym.successBody')}
      </AppText>
      <Button
        variant="primary"
        fullWidth
        label={t('common.done')}
        onPress={() => console.log('onBack')}
      />
    </View>
  );
}

export const Success: Story = {
  render: () => <SuccessShell />,
};

// ── Validation Error ──────────────────────────────────────────────────────────
// Form with an inline error block visible — matches what the screen shows when
// the API call fails after a submit attempt (e.g. network error).

function ValidationErrorShell(): React.JSX.Element {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const { screenMargin } = useLayout();
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: theme.spacing.sm,
          paddingHorizontal: screenMargin,
          paddingBottom: theme.spacing.xxl,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <AppText variant="largeTitle" accessibilityRole="header">
          {t('gymDirectory.requestGym.title')}
        </AppText>
        <AppText
          variant="subhead"
          color="textSecondary"
          style={{ marginTop: theme.spacing.xs, marginBottom: theme.layout.sectionGap }}
        >
          {t('gymDirectory.requestGym.subtitle')}
        </AppText>

        <Card style={{ gap: LAYOUT.fieldGap }}>
          <TextField
            label={`${t('gymDirectory.requestGym.nameLabel')} *`}
            accessibilityLabel={t('gymDirectory.requestGym.nameLabel')}
            value="RedRock 紅石攀岩"
            onChangeText={() => {}}
          />
          <TextField
            label={`${t('gymDirectory.requestGym.cityLabel')} *`}
            accessibilityLabel={t('gymDirectory.requestGym.cityLabel')}
            value="Taipei"
            onChangeText={() => {}}
          />
          <TextField
            label={t('gymDirectory.requestGym.mapsUrlLabel')}
            value=""
            onChangeText={() => {}}
          />
        </Card>

        <InlineError
          variant="block"
          message={t('gymDirectory.requestGym.errors.submitFailed')}
          style={{ marginTop: theme.spacing.md }}
        />

        <View style={{ marginTop: theme.spacing.lg }}>
          <Button
            variant="primary"
            fullWidth
            label={t('gymDirectory.requestGym.submit')}
            onPress={() => console.log('submit')}
          />
        </View>
      </ScrollView>
    </View>
  );
}

export const ValidationError: Story = {
  render: () => <ValidationErrorShell />,
};
