/**
 * Stories for SignInScreen.
 *
 * States:
 *   Playground  — default empty form with controlled Loading / ErrorMessage args.
 *   Loading     — button spinner, fields disabled (state after the user taps Sign In).
 *   WithError   — inline error block visible (bad credentials / network failure).
 *   Interactive — real SignInScreen component connected to the supabase stub.
 */

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Button, Card, InlineError, TextField } from '../../../components/ui';
import { useLayout, useTheme } from '../../../lib/theme';
import SignInScreen from '../screens/SignInScreen';

// ── Controlled Demo component ─────────────────────────────────────────────────

interface DemoArgs {
  /** Shows the button spinner and disables all inputs. */
  loading: boolean;
  /** When non-empty, renders an InlineError block above the sign-in button. */
  errorMessage: string;
}

function Demo({ loading, errorMessage }: DemoArgs): React.JSX.Element {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { screenMargin } = useLayout();

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: screenMargin,
          paddingTop: insets.top + 16,
          paddingBottom: 32,
          gap: 16,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <AppText variant="largeTitle" align="center" style={{ marginBottom: 16 }}>
          {t('app.name')}
        </AppText>

        <Card style={{ gap: 8 }}>
          <TextField
            label={t('auth.email')}
            value="leon@example.com"
            onChangeText={() => {}}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            disabled={loading}
          />
          <TextField
            label={t('auth.password')}
            value="password"
            onChangeText={() => {}}
            secureTextEntry
            disabled={loading}
          />
        </Card>

        {errorMessage ? (
          <InlineError variant="block" message={errorMessage} />
        ) : null}

        <Button
          label={t('auth.signIn')}
          onPress={() => {}}
          variant="primary"
          size="lg"
          fullWidth
          loading={loading}
          disabled={loading}
        />

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ flex: 1, height: 1, backgroundColor: theme.colors.border }} />
          <AppText variant="footnote" color="textSecondary">
            {t('auth.orDivider')}
          </AppText>
          <View style={{ flex: 1, height: 1, backgroundColor: theme.colors.border }} />
        </View>

        <Button
          label={t('auth.continueWithGoogle')}
          onPress={() => {}}
          variant="secondary"
          size="lg"
          fullWidth
          disabled={loading}
        />

        <Button
          label={t('auth.noAccount')}
          onPress={() => {}}
          variant="ghost"
          on="background"
          fullWidth
          disabled={loading}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Meta ──────────────────────────────────────────────────────────────────────

const meta: Meta<DemoArgs> = {
  title: 'AuthProfile/SignInScreen',
  component: Demo,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <View style={{ width: 390, height: 780 }}>
        <Story />
      </View>
    ),
  ],
  args: {
    loading: false,
    errorMessage: '',
  },
  argTypes: {
    loading: { control: 'boolean' },
    errorMessage: { control: 'text' },
  },
};
export default meta;

type Story = StoryObj<DemoArgs>;

/** Default empty form — use the controls panel to toggle Loading or enter an ErrorMessage. */
export const Playground: Story = {};

/** After the user taps Sign In — button shows a spinner; all inputs are disabled. */
export const Loading: Story = {
  args: { loading: true },
};

/** When sign-in fails — an inline error block appears above the action button. */
export const WithError: Story = {
  args: {
    loading: false,
    errorMessage: 'Sign in failed. Please check your credentials.',
  },
};

/**
 * Fully interactive — the real SignInScreen connected to the no-network supabase stub.
 * Fill the fields and press Sign In to observe the loading → error transition.
 */
export const Interactive: Story = {
  render: () => <SignInScreen onNavigateSignUp={() => {}} />,
};
