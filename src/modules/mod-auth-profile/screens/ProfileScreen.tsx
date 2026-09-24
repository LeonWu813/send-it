/**
 * ProfileScreen.
 *
 * Displays the current user's profile: avatar, display name, bio.
 * Exposes an Edit Profile entry point (AC-117) and a Logout control (AC-119).
 * Embeds a placeholder for the MOD-008 send history surface (AC-118).
 *
 * AC-116: shows display name, avatar, bio.
 * AC-117: "Edit Profile" navigates to EditProfileScreen.
 * AC-118: send history section — placeholder until MOD-008 ships.
 * AC-119: Logout button at the bottom ends the session and returns to
 *          signed-out state (handled by the AuthNavigator via onAuthStateChange).
 */

import type { Session } from '@supabase/supabase-js';
import React, { useState } from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../../lib/theme';
import { signOut } from '../auth-service';
import { useSession } from '../hooks/useSession';

interface ProfileScreenProps {
  session: Session;
  onNavigateEditProfile: () => void;
}

export default function ProfileScreen({
  session: _session,
  onNavigateEditProfile,
}: ProfileScreenProps): React.JSX.Element {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme, insets.top);

  const { profile } = useSession();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleLogout(): Promise<void> {
    setIsSigningOut(true);
    setErrorMessage(null);
    try {
      await signOut();
      // AuthNavigator observes onAuthStateChange and automatically routes
      // the user back to the signed-out state — no explicit navigation needed.
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t('auth.errors.signOutFailed');
      setErrorMessage(message);
      setIsSigningOut(false);
    }
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.scrollContent}
    >
      {/* Avatar + display name + bio (AC-116) */}
      <View style={styles.header}>
        {profile?.avatar_url ? (
          <Image
            source={{ uri: profile.avatar_url }}
            style={styles.avatar}
            accessibilityLabel={t('profile.avatar')}
          />
        ) : (
          <View style={styles.avatarPlaceholder} />
        )}
        <Text style={styles.displayName}>
          {profile?.display_name ?? ''}
        </Text>
        {profile?.bio ? (
          <Text style={styles.bio}>{profile.bio}</Text>
        ) : null}
      </View>

      {/* Edit Profile entry (AC-117) */}
      <Pressable
        style={({ pressed }) => [
          styles.editProfileButton,
          pressed && styles.editProfileButtonPressed,
        ]}
        onPress={onNavigateEditProfile}
        accessibilityRole="button"
        accessibilityLabel={t('profile.editProfile')}
      >
        <Text style={styles.editProfileButtonText}>
          {t('profile.editProfile')}
        </Text>
      </Pressable>

      {/* Send history section (AC-118) — placeholder until MOD-008 ships */}
      <View style={styles.sendHistorySection}>
        <Text style={styles.sectionTitle}>{t('profile.sendHistory')}</Text>
        {/* TODO: replace with MOD-008 SendHistoryProfile component when MOD-008 ships */}
        <Text style={styles.sendHistoryPlaceholder}>
          Send history coming soon
        </Text>
      </View>

      {/* Error message */}
      {errorMessage ? (
        <Text style={styles.errorText}>{errorMessage}</Text>
      ) : null}

      {/* Logout (AC-119) */}
      <Pressable
        style={({ pressed }) => [
          styles.logoutButton,
          pressed && styles.logoutButtonPressed,
          isSigningOut && styles.logoutButtonDisabled,
        ]}
        onPress={handleLogout}
        disabled={isSigningOut}
        accessibilityRole="button"
        accessibilityLabel={t('profile.logout')}
      >
        {isSigningOut ? (
          <ActivityIndicator color={theme.colors.error} />
        ) : (
          <Text style={styles.logoutButtonText}>{t('profile.logout')}</Text>
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
    scrollContent: {
      paddingTop: topInset + theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      paddingBottom: theme.spacing.xl,
    },
    header: {
      alignItems: 'center',
      marginBottom: theme.spacing.lg,
      gap: theme.spacing.sm,
    },
    avatar: {
      width: 96,
      height: 96,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.surface,
    },
    avatarPlaceholder: {
      width: 96,
      height: 96,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    displayName: {
      fontSize: theme.fontSize.xl,
      fontWeight: theme.fontWeight.bold,
      color: theme.colors.textPrimary,
      textAlign: 'center',
    },
    bio: {
      fontSize: theme.fontSize.md,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    editProfileButton: {
      height: 44,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: theme.spacing.lg,
    },
    editProfileButtonPressed: {
      backgroundColor: theme.colors.surface,
    },
    editProfileButtonText: {
      fontSize: theme.fontSize.md,
      fontWeight: theme.fontWeight.medium,
      color: theme.colors.primary,
    },
    sendHistorySection: {
      marginBottom: theme.spacing.lg,
    },
    sectionTitle: {
      fontSize: theme.fontSize.md,
      fontWeight: theme.fontWeight.semibold,
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing.sm,
    },
    sendHistoryPlaceholder: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.textSecondary,
    },
    errorText: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.error,
      marginBottom: theme.spacing.sm,
    },
    logoutButton: {
      height: 44,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.error,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: theme.spacing.md,
    },
    logoutButtonPressed: {
      backgroundColor: theme.colors.surface,
    },
    logoutButtonDisabled: {
      opacity: 0.5,
    },
    logoutButtonText: {
      fontSize: theme.fontSize.md,
      fontWeight: theme.fontWeight.medium,
      color: theme.colors.error,
    },
  });
}
