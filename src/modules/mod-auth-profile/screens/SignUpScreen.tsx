/**
 * SignUp screen.
 *
 * Collects email, display name, and password to create a new account.
 * On success the Supabase auth state change listener in useSession fires,
 * which causes the navigator to redirect to the home gym selection screen.
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Button, InlineError, TextField } from '../../../components/ui';
import { useLayout, useTheme } from '../../../lib/theme';
import { signUpWithEmail } from '../auth-service';

interface SignUpScreenProps {
  onNavigateSignIn: () => void;
}

export default function SignUpScreen({
  onNavigateSignIn,
}: SignUpScreenProps): React.JSX.Element {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { screenMargin } = useLayout();
  const styles = makeStyles(theme, insets.top, screenMargin);

  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function validate(): string | null {
    if (!email.trim()) return t('auth.errors.emailRequired');
    if (!displayName.trim()) return t('auth.errors.displayNameRequired');
    if (!password) return t('auth.errors.passwordRequired');
    if (password.length < 8) return t('auth.errors.passwordMinLength');
    if (password !== confirmPassword) return t('auth.errors.passwordMismatch');
    return null;
  }

  async function handleSignUp(): Promise<void> {
    setErrorMessage(null);
    const validationError = validate();
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }
    setIsLoading(true);
    try {
      await signUpWithEmail({
        email: email.trim(),
        password,
        displayName: displayName.trim(),
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t('auth.errors.signUpFailed');
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <AppText variant="largeTitle" align="center" style={styles.title}>
          {t('app.name')}
        </AppText>

        {/* Display name */}
        <TextField
          label={t('auth.displayNameLabel')}
          value={displayName}
          onChangeText={setDisplayName}
          placeholder={t('auth.displayNamePlaceholder')}
          autoCapitalize="words"
          autoCorrect={false}
          disabled={isLoading}
        />

        {/* Email */}
        <TextField
          label={t('auth.email')}
          value={email}
          onChangeText={setEmail}
          placeholder={t('auth.emailPlaceholder')}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          disabled={isLoading}
        />

        {/* Password */}
        <TextField
          label={t('auth.password')}
          value={password}
          onChangeText={setPassword}
          placeholder={t('auth.passwordPlaceholder')}
          secureTextEntry
          disabled={isLoading}
        />

        {/* Confirm Password */}
        <TextField
          label={t('auth.confirmPassword')}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder={t('auth.passwordPlaceholder')}
          secureTextEntry
          disabled={isLoading}
        />

        {/* Error */}
        {errorMessage ? (
          <InlineError variant="block" message={errorMessage} />
        ) : null}

        {/* Submit */}
        <Button
          label={t('auth.signUp')}
          onPress={handleSignUp}
          variant="primary"
          size="lg"
          fullWidth
          loading={isLoading}
          disabled={isLoading}
          accessibilityLabel={t('auth.signUp')}
        />

        {/* Already have account */}
        <Button
          label={t('auth.haveAccount')}
          onPress={onNavigateSignIn}
          variant="ghost"
          on="background"
          fullWidth
          disabled={isLoading}
        />

        {/* Vertical spacer for keyboard */}
        <View style={styles.spacer} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function makeStyles(
  theme: ReturnType<typeof useTheme>['theme'],
  topInset: number,
  screenMargin: number,
) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: screenMargin,
      paddingTop: topInset + theme.spacing.md,
      paddingBottom: theme.spacing.xl,
      gap: theme.spacing.md,
    },
    title: {
      marginBottom: theme.spacing.lg,
    },
    spacer: {
      height: theme.spacing.xl,
    },
  });
}
