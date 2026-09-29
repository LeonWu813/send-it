/**
 * ProfileScreen.
 *
 * Displays the current user's profile: avatar, display name, bio.
 * Exposes an Edit Profile entry point (AC-117) and a Logout control (AC-119).
 * Embeds the MOD-008 send history surface (AC-118).
 *
 * AC-116: shows display name, avatar, bio.
 * AC-117: "Edit Profile" navigates to EditProfileScreen.
 * AC-118: send history section via MOD-008 SendHistoryProfile.
 * AC-119: Logout button ends the session and returns to signed-out state
 *          (handled by the AuthNavigator via onAuthStateChange).
 *
 * Scroll architecture: SendHistoryProfile owns the FlatList as the sole
 * scroll container. The profile header (avatar, name, bio, Edit Profile
 * button) is passed as `listHeaderComponent` and the Logout button is
 * passed as `listFooterComponent` so they scroll with the list. This
 * avoids nesting a vertical FlatList inside a vertical ScrollView, which
 * triggers the VirtualizedList-nested-in-ScrollView warning.
 */

import type { Session } from '@supabase/supabase-js';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../../lib/theme';
import { SendHistoryProfile } from '../../mod-profile-history';
import { signOut } from '../auth-service';
import { useSession } from '../hooks/useSession';

interface ProfileScreenProps {
  session: Session;
  onNavigateEditProfile: () => void;
  /** True when the Profile tab is the active tab. Used to trigger refetch on
   *  tab focus (AC-062) — the keep-alive pattern means the component never
   *  remounts on tab switch, so we increment refetchKey when isActive flips
   *  from false to true. */
  isActive?: boolean;
  /**
   * Callback invoked when the user taps a route card in the send history
   * surface. Switches to the Gyms tab and opens the route detail screen.
   */
  onNavigateToRoute?: (routeId: string) => void;
}

export default function ProfileScreen({
  session: _session,
  onNavigateEditProfile,
  isActive = false,
  onNavigateToRoute,
}: ProfileScreenProps): React.JSX.Element {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme, insets.top);

  const { profile } = useSession();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // AC-062: Increment refetchKey each time the Profile tab becomes active so
  // SendHistoryProfile re-fetches stats even though the component never
  // unmounts (keep-alive display:none pattern in AppShell).
  const [refetchKey, setRefetchKey] = useState(0);
  useEffect(() => {
    if (isActive) setRefetchKey((prev) => prev + 1);
  }, [isActive]);

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

  // ── Profile header (AC-116 + AC-117) ────────────────────────────────────────
  // Passed as listHeaderComponent to SendHistoryProfile so it scrolls with
  // the FlatList rather than requiring a wrapping ScrollView.
  const profileHeader = (
    <View style={styles.headerContainer}>
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
    </View>
  );

  // ── Profile footer (AC-119) ───────────────────────────────────────────────
  // Passed as listFooterComponent to SendHistoryProfile so the Logout button
  // appears after the send history list and scrolls with it.
  const profileFooter = (
    <View style={styles.footerContainer}>
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
    </View>
  );

  // ── Root: View (no ScrollView) — FlatList inside SendHistoryProfile scrolls ──
  return (
    <View style={styles.root}>
      {profile?.id ? (
        <SendHistoryProfile
          userId={profile.id}
          isOwnProfile
          refetchKey={refetchKey}
          listHeaderComponent={profileHeader}
          listFooterComponent={profileFooter}
          onNavigateToRoute={onNavigateToRoute}
        />
      ) : (
        // Profile not yet loaded — show header and footer without history list.
        <>
          {profileHeader}
          {profileFooter}
        </>
      )}
    </View>
  );
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function makeStyles(theme: ReturnType<typeof useTheme>['theme'], topInset: number) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    headerContainer: {
      paddingTop: topInset + theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      paddingBottom: theme.spacing.md,
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
    footerContainer: {
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.md,
      paddingBottom: theme.spacing.xl,
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
