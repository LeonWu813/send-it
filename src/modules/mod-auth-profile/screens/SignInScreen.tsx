/**
 * SignIn screen.
 *
 * Provides three sign-in paths: Email, Apple Sign-In, Google Sign-In.
 *
 * Apple Sign-In is visually equivalent to Google Sign-In (same height, same
 * weight) per App Store review guidelines — it must never be smaller or hidden
 * when available. The button is conditionally rendered based on
 * AppleAuthentication.isAvailableAsync() so that simulator builds without the
 * Apple Sign-In entitlement (deferred until Apple Developer account is active)
 * do not show a broken button. In production/TestFlight the entitlement is
 * present and isAvailableAsync() returns true, making the button visible and
 * App Store compliant.
 *
 * No hardcoded colors — all styling uses theme tokens.
 */

import * as AppleAuthentication from 'expo-apple-authentication';
import React, { useEffect, useState } from 'react';
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
import {
  signInWithApple,
  signInWithEmail,
  signInWithGoogle,
} from '../auth-service';

interface SignInScreenProps {
  onNavigateSignUp: () => void;
}

export default function SignInScreen({
  onNavigateSignUp,
}: SignInScreenProps): React.JSX.Element {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const styles = makeStyles(theme);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Apple Sign-In is unavailable on simulator builds without the entitlement.
  // Check on mount so the button only renders when the entitlement is present.
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'ios') {
      return;
    }
    AppleAuthentication.isAvailableAsync()
      .then(setAppleAvailable)
      .catch(() => {
        // isAvailableAsync itself should not throw, but guard defensively
        setAppleAvailable(false);
      });
  }, []);

  function clearError(): void {
    setErrorMessage(null);
  }

  async function handleEmailSignIn(): Promise<void> {
    clearError();
    if (!email.trim()) {
      setErrorMessage(t('auth.errors.emailRequired'));
      return;
    }
    if (!password) {
      setErrorMessage(t('auth.errors.passwordRequired'));
      return;
    }
    setIsLoading(true);
    try {
      await signInWithEmail(email.trim(), password);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t('auth.errors.signInFailed');
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAppleSignIn(): Promise<void> {
    clearError();
    setIsLoading(true);
    try {
      await signInWithApple();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t('auth.errors.appleSignInFailed');
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleGoogleSignIn(): Promise<void> {
    clearError();
    setIsLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t('auth.errors.googleSignInFailed');
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

        {/* Email input */}
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

        {/* Password input */}
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

        {/* Error message */}
        {errorMessage ? (
          <Text style={styles.errorText}>{errorMessage}</Text>
        ) : null}

        {/* Email sign-in button */}
        <Pressable
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.primaryButtonPressed,
            isLoading && styles.primaryButtonDisabled,
          ]}
          onPress={handleEmailSignIn}
          disabled={isLoading}
          accessibilityRole="button"
          accessibilityLabel={t('auth.signIn')}
        >
          {isLoading ? (
            <ActivityIndicator color={theme.colors.textInverse} />
          ) : (
            <Text style={styles.primaryButtonText}>{t('auth.signIn')}</Text>
          )}
        </Pressable>

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>{t('auth.orDivider')}</Text>
          <View style={styles.dividerLine} />
        </View>

        {/*
          Apple Sign-In — MUST be visually equivalent to Google Sign-In when
          available. Hidden on simulator builds that lack the Apple Developer
          entitlement (isAvailableAsync returns false). Visible in
          production/TestFlight where the entitlement is present, satisfying
          App Store requirement that Apple Sign-In is not smaller or hidden.
        */}
        {appleAvailable && (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={
              AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
            }
            buttonStyle={
              AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
            }
            cornerRadius={theme.borderRadius.md}
            style={styles.appleButton}
            onPress={handleAppleSignIn}
          />
        )}

        {/* Google Sign-In — same height/weight as Apple button */}
        <Pressable
          style={({ pressed }) => [
            styles.googleButton,
            pressed && styles.googleButtonPressed,
            isLoading && styles.googleButtonDisabled,
          ]}
          onPress={handleGoogleSignIn}
          disabled={isLoading}
          accessibilityRole="button"
          accessibilityLabel={t('auth.continueWithGoogle')}
        >
          <Text style={styles.googleButtonText}>
            {t('auth.continueWithGoogle')}
          </Text>
        </Pressable>

        {/* Navigate to sign-up */}
        <Pressable
          onPress={onNavigateSignUp}
          disabled={isLoading}
          accessibilityRole="button"
        >
          <Text style={styles.linkText}>{t('auth.noAccount')}</Text>
        </Pressable>
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
    dividerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    dividerLine: {
      flex: 1,
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.colors.border,
    },
    dividerText: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.textSecondary,
    },
    // Apple Sign-In button — fixed height 48 to match Google button
    appleButton: {
      height: 48,
      width: '100%',
    },
    // Google Sign-In button — same height as Apple button
    googleButton: {
      height: 48,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.borderRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    googleButtonPressed: {
      backgroundColor: theme.colors.divider,
    },
    googleButtonDisabled: {
      opacity: 0.5,
    },
    googleButtonText: {
      fontSize: theme.fontSize.md,
      fontWeight: theme.fontWeight.medium,
      color: theme.colors.textPrimary,
    },
    linkText: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.primary,
      textAlign: 'center',
      marginTop: theme.spacing.sm,
    },
  });
}
