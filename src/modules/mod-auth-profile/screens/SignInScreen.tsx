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
 * No hardcoded colors — all styling uses theme tokens and ui/ components.
 */

import * as AppleAuthentication from 'expo-apple-authentication';
import React, { useEffect, useState } from 'react';
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
  const insets = useSafeAreaInsets();
  const { screenMargin } = useLayout();
  const styles = makeStyles(theme, insets.top, screenMargin);

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
        <AppText variant="largeTitle" align="center" style={styles.title}>
          {t('app.name')}
        </AppText>

        {/* Email input */}
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

        {/* Password input */}
        <TextField
          label={t('auth.password')}
          value={password}
          onChangeText={setPassword}
          placeholder={t('auth.passwordPlaceholder')}
          secureTextEntry
          disabled={isLoading}
        />

        {/* Error message */}
        {errorMessage ? (
          <InlineError variant="block" message={errorMessage} />
        ) : null}

        {/* Email sign-in button */}
        <Button
          label={t('auth.signIn')}
          onPress={handleEmailSignIn}
          variant="primary"
          size="lg"
          fullWidth
          loading={isLoading}
          disabled={isLoading}
          accessibilityLabel={t('auth.signIn')}
        />

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <AppText variant="footnote" color="textSecondary">
            {t('auth.orDivider')}
          </AppText>
          <View style={styles.dividerLine} />
        </View>

        {/*
          Apple Sign-In — MUST be visually equivalent to Google Sign-In when
          available (height 50 = Button lg). Placed above the other providers
          per design system 14.9. Hidden on simulator builds that lack the
          Apple Developer entitlement (isAvailableAsync returns false).
        */}
        {appleAvailable && (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={
              AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
            }
            buttonStyle={
              theme.isDark
                ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
            }
            cornerRadius={theme.borderRadius.lg}
            style={styles.appleButton}
            onPress={handleAppleSignIn}
          />
        )}

        {/* Google Sign-In — same height as Apple button */}
        <Button
          label={t('auth.continueWithGoogle')}
          onPress={handleGoogleSignIn}
          variant="secondary"
          size="lg"
          fullWidth
          disabled={isLoading}
          accessibilityLabel={t('auth.continueWithGoogle')}
        />

        {/* Navigate to sign-up */}
        <Button
          label={t('auth.noAccount')}
          onPress={onNavigateSignUp}
          variant="ghost"
          on="background"
          fullWidth
          disabled={isLoading}
        />
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
    dividerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    dividerLine: {
      flex: 1,
      height: theme.stroke.hairline,
      backgroundColor: theme.colors.border,
    },
    // Apple Sign-In button: height 50 = Button lg, full width (design system 14.9)
    appleButton: {
      height: theme.componentSize.buttonPrimaryMinHeight,
      width: '100%',
    },
  });
}
