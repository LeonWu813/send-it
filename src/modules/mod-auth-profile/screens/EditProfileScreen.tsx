/**
 * EditProfileScreen.
 *
 * Allows the user to update their display name, bio, avatar, and privacy
 * setting. Avatar changes are uploaded to Supabase Storage first; the
 * resulting URL is then written to the profile row.
 *
 * AC-063: privacy_setting of 'public' | 'followers_only' is persisted here.
 */

import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../../lib/theme';
import { uploadAvatar, upsertProfile } from '../auth-service';
import type { PrivacySetting, UserProfile } from '../types';

interface EditProfileScreenProps {
  userId: string;
  profile: UserProfile | null;
  onSaved: (updated: UserProfile) => void;
  onCancel: () => void;
}

export default function EditProfileScreen({
  userId,
  profile,
  onSaved,
  onCancel,
}: EditProfileScreenProps): React.JSX.Element {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme, insets.top);

  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [privacySetting, setPrivacySetting] = useState<PrivacySetting>(
    profile?.privacy_setting ?? 'public',
  );
  const [avatarUri, setAvatarUri] = useState<string | null>(
    profile?.avatar_url ?? null,
  );
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync when profile prop changes
  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name);
      setBio(profile.bio ?? '');
      setPrivacySetting(profile.privacy_setting);
      setAvatarUri(profile.avatar_url);
    }
  }, [profile]);

  async function handlePickAvatar(): Promise<void> {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) return;

    const uri = result.assets[0].uri;
    setIsUploadingAvatar(true);
    setErrorMessage(null);
    try {
      const publicUrl = await uploadAvatar(userId, uri);
      setAvatarUri(publicUrl);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : t('profile.errors.avatarUploadFailed');
      setErrorMessage(message);
    } finally {
      setIsUploadingAvatar(false);
    }
  }

  async function handleSave(): Promise<void> {
    if (!displayName.trim()) {
      setErrorMessage(t('auth.errors.displayNameRequired'));
      return;
    }
    setIsSaving(true);
    setErrorMessage(null);
    try {
      const updated = await upsertProfile(userId, {
        display_name: displayName.trim(),
        bio: bio.trim() || null,
        avatar_url: avatarUri,
        privacy_setting: privacySetting,
      });
      onSaved(updated);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t('profile.errors.saveFailed');
      setErrorMessage(message);
    } finally {
      setIsSaving(false);
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
        {/* Avatar */}
        <View style={styles.avatarContainer}>
          {avatarUri ? (
            <Image
              source={{ uri: avatarUri }}
              style={styles.avatar}
              accessibilityLabel={t('profile.avatar')}
            />
          ) : (
            <View style={styles.avatarPlaceholder} />
          )}
          <Pressable
            onPress={handlePickAvatar}
            disabled={isUploadingAvatar || isSaving}
            accessibilityRole="button"
            accessibilityLabel={t('profile.changeAvatar')}
          >
            {isUploadingAvatar ? (
              <ActivityIndicator color={theme.colors.primary} />
            ) : (
              <Text style={styles.changeAvatarText}>
                {t('profile.changeAvatar')}
              </Text>
            )}
          </Pressable>
        </View>

        {/* Display name */}
        <Text style={styles.label}>{t('profile.displayName')}</Text>
        <TextInput
          style={styles.input}
          value={displayName}
          onChangeText={setDisplayName}
          autoCapitalize="words"
          autoCorrect={false}
          editable={!isSaving}
          accessibilityLabel={t('profile.displayName')}
        />

        {/* Bio */}
        <Text style={styles.label}>{t('profile.bio')}</Text>
        <TextInput
          style={[styles.input, styles.bioInput]}
          value={bio}
          onChangeText={setBio}
          placeholder={t('profile.bioPlaceholder')}
          placeholderTextColor={theme.colors.textDisabled}
          multiline
          numberOfLines={4}
          editable={!isSaving}
          accessibilityLabel={t('profile.bio')}
        />

        {/* Privacy setting */}
        <Text style={styles.label}>{t('profile.privacy')}</Text>
        <View style={styles.privacyToggleRow}>
          <Pressable
            style={[
              styles.privacyOption,
              privacySetting === 'public' && styles.privacyOptionSelected,
            ]}
            onPress={() => setPrivacySetting('public')}
            disabled={isSaving}
            accessibilityRole="radio"
            accessibilityState={{ checked: privacySetting === 'public' }}
            accessibilityLabel={t('profile.privacyPublic')}
          >
            <Text
              style={[
                styles.privacyOptionText,
                privacySetting === 'public' && styles.privacyOptionTextSelected,
              ]}
            >
              {t('profile.privacyPublic')}
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.privacyOption,
              privacySetting === 'followers_only' && styles.privacyOptionSelected,
            ]}
            onPress={() => setPrivacySetting('followers_only')}
            disabled={isSaving}
            accessibilityRole="radio"
            accessibilityState={{ checked: privacySetting === 'followers_only' }}
            accessibilityLabel={t('profile.privacyFollowersOnly')}
          >
            <Text
              style={[
                styles.privacyOptionText,
                privacySetting === 'followers_only' &&
                  styles.privacyOptionTextSelected,
              ]}
            >
              {t('profile.privacyFollowersOnly')}
            </Text>
          </Pressable>
        </View>
        <Text style={styles.privacyDescription}>
          {privacySetting === 'public'
            ? t('profile.privacyPublicDescription')
            : t('profile.privacyFollowersOnlyDescription')}
        </Text>

        {/* Error */}
        {errorMessage ? (
          <Text style={styles.errorText}>{errorMessage}</Text>
        ) : null}

        {/* Actions */}
        <View style={styles.actionsRow}>
          <Pressable
            style={styles.cancelButton}
            onPress={onCancel}
            disabled={isSaving}
            accessibilityRole="button"
            accessibilityLabel={t('profile.cancel')}
          >
            <Text style={styles.cancelButtonText}>{t('profile.cancel')}</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.saveButton,
              pressed && styles.saveButtonPressed,
              isSaving && styles.saveButtonDisabled,
            ]}
            onPress={handleSave}
            disabled={isSaving}
            accessibilityRole="button"
            accessibilityLabel={t('profile.save')}
          >
            {isSaving ? (
              <ActivityIndicator color={theme.colors.textInverse} />
            ) : (
              <Text style={styles.saveButtonText}>{t('profile.save')}</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
      gap: theme.spacing.sm,
    },
    avatarContainer: {
      alignItems: 'center',
      marginBottom: theme.spacing.md,
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
    changeAvatarText: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.primary,
    },
    label: {
      fontSize: theme.fontSize.sm,
      fontWeight: theme.fontWeight.medium,
      color: theme.colors.textSecondary,
      marginTop: theme.spacing.sm,
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
    bioInput: {
      height: 100,
      textAlignVertical: 'top',
    },
    privacyToggleRow: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
    privacyOption: {
      flex: 1,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
    },
    privacyOptionSelected: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.background,
    },
    privacyOptionText: {
      fontSize: theme.fontSize.sm,
      fontWeight: theme.fontWeight.medium,
      color: theme.colors.textSecondary,
    },
    privacyOptionTextSelected: {
      color: theme.colors.primary,
    },
    privacyDescription: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.textSecondary,
    },
    errorText: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.error,
    },
    actionsRow: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
      marginTop: theme.spacing.md,
    },
    cancelButton: {
      flex: 1,
      height: 48,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelButtonText: {
      fontSize: theme.fontSize.md,
      color: theme.colors.textSecondary,
    },
    saveButton: {
      flex: 2,
      height: 48,
      borderRadius: theme.borderRadius.md,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveButtonPressed: {
      backgroundColor: theme.colors.primaryPressed,
    },
    saveButtonDisabled: {
      backgroundColor: theme.colors.primaryDisabled,
    },
    saveButtonText: {
      fontSize: theme.fontSize.md,
      fontWeight: theme.fontWeight.semibold,
      color: theme.colors.textInverse,
    },
  });
}
