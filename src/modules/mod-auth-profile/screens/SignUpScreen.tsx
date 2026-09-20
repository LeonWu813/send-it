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
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useTheme } from '../../../lib/theme';
import { signUpWithEmail } from '../auth-service';

interface SignUpScreenProps {
  onNavigateSignIn: () => void;
}

export default function SignUpScreen({
  onNavigateSignIn,
}: SignUpScreenProps): React.JSX.Element {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const styles = makeStyles(theme);

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
        <Text style={styles.title}>{t('app.name')}</Text>

        {/* Display name */}
        <TextInput
          style={styles.input}
          value={displayName}
          onChangeText={setDisplayName}
          placeholder={t('auth.displayNamePlaceholder')}
          placeholderTextColor={theme.colors.textDisabled}
          autoCapitalize="words"
          autoCorrect={false}
          editable={!isLoading}
          accessibilityLabel={t('auth.displayNameLabel')}
        />

        {/* Email */}
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder={t('auth.emailPlaceholder')}
          placeholderTextColor={theme.colors.textDisabled}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!isLoading}
          accessibilityLabel={t('auth.email')}
        />

        {/* Password */}
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder={t('auth.passwordPlaceholder')}
          placeholderTextColor={theme.colors.textDisabled}
          secureTextEntry
          editable={!isLoading}
          accessibilityLabel={t('auth.password')}
        />

        {/* Confirm Password */}
        <TextInput
          style={styles.input}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder={t('auth.passwordPlaceholder')}
          placeholderTextColor={theme.colors.textDisabled}
          secureTextEntry
          editable={!isLoading}
          accessibilityLabel={t('auth.confirmPassword')}
        />

        {/* Error */}
        {errorMessage ? (
          <Text style={styles.errorText}>{errorMessage}</Text>
        ) : null}

        {/* Submit */}
        <Pressable
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.primaryButtonPressed,
            isLoading && styles.primaryButtonDisabled,
          ]}
          onPress={handleSignUp}
          disabled={isLoading}
          accessibilityRole="button"
          accessibilityLabel={t('auth.signUp')}
        >
          {isLoading ? (
            <ActivityIndicator color={theme.colors.textInverse} />
          ) : (
            <Text style={styles.primaryButtonText}>{t('auth.signUp')}</Text>
          )}
        </Pressable>

        {/* Already have account */}
        <Pressable
          onPress={onNavigateSignIn}
          disabled={isLoading}
          accessibilityRole="button"
        >
          <Text style={styles.linkText}>{t('auth.haveAccount')}</Text>
        </Pressable>

        {/* Vertical spacer for keyboard */}
        <View style={styles.spacer} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function makeStyles(theme: ReturnType<typeof useTheme>['theme']) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.xxl,
      paddingBottom: theme.spacing.xl,
      gap: theme.spacing.md,
    },
    title: {
      fontSize: theme.fontSize.display,
      fontWeight: theme.fontWeight.bold,
      color: theme.colors.textPrimary,
      textAlign: 'center',
      marginBottom: theme.spacing.lg,
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
    },
    errorText: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.error,
    },
    primaryButton: {
      backgroundColor: theme.colors.primary,
      borderRadius: theme.borderRadius.md,
      paddingVertical: theme.spacing.sm + 4,
      alignItems: 'center',
      justifyContent: 'center',
      height: 48,
    },
    primaryButtonPressed: {
      backgroundColor: theme.colors.primaryPressed,
    },
    primaryButtonDisabled: {
      backgroundColor: theme.colors.primaryDisabled,
    },
    primaryButtonText: {
      color: theme.colors.textInverse,
      fontSize: theme.fontSize.md,
      fontWeight: theme.fontWeight.semibold,
    },
    linkText: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.primary,
      textAlign: 'center',
      marginTop: theme.spacing.sm,
    },
    spacer: {
      height: theme.spacing.xl,
    },
  });
}
