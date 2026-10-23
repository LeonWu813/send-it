/**
 * EditProfileScreen.
 *
 * Allows the user to update their display name, bio, and avatar.
 * Avatar changes are uploaded to Supabase Storage first; the
 * resulting URL is then written to the profile row.
 *
 * AC-117: editable fields are display name, avatar, and bio only.
 * AC-063: privacy_setting is always 'public'; there is no user-facing toggle.
 */

import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import {
  AppText,
  Avatar,
  Button,
  InlineError,
  TextField,
} from '../../../components/ui';
import { useLayout, useTheme } from '../../../lib/theme';
import { useAppHeader, useHideTabBar } from '@/lib/AppHeaderContext';
import { uploadAvatar, upsertProfile } from '../auth-service';
import type { UserProfile } from '../types';

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
  const { screenMargin } = useLayout();
  const styles = makeStyles(theme, 0, screenMargin);

  // v2.2: nested screen in the Profile tab; form hides the TabBar.
  useAppHeader({ title: t('profile.editProfile'), onBack: onCancel });
  useHideTabBar();

  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
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
      setAvatarUri(profile.avatar_url);
    }
  }, [profile]);

  async function handlePickAvatar(): Promise<void> {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
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
    try {
      const updated = await upsertProfile(userId, {
        display_name: displayName.trim(),
        bio: bio.trim() || null,
        avatar_url: avatarUri,
      });
      // Clear any previous error only after a successful save so that an
      // avatar-upload error visible when the user tapped Save is not silently
      // erased before we know whether the profile write will also succeed.
      setErrorMessage(null);
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
          <Avatar size="xl" uri={avatarUri} name={displayName} />
          {/* Button is alignSelf flex-start; wrap so the link centres on the avatar (A6) */}
          <View style={styles.changeAvatarSlot}>
            <Button
              label={t('profile.changeAvatar')}
              onPress={handlePickAvatar}
              variant="ghost"
              on="background"
              loading={isUploadingAvatar}
              disabled={isUploadingAvatar || isSaving}
              accessibilityLabel={t('profile.changeAvatar')}
            />
          </View>
        </View>

        {/* Flat form on the page background (F4): labels on the 16 keyline */}
        <View style={styles.form}>
        {/* Display name */}
        <TextField
          label={t('profile.displayName')}
          value={displayName}
          onChangeText={setDisplayName}
          autoCapitalize="words"
          autoCorrect={false}
          disabled={isSaving}
        />

        {/* Bio */}
        <TextField
          variant="multiline"
          label={t('profile.bio')}
          value={bio}
          onChangeText={setBio}
          placeholder={t('profile.bioPlaceholder')}
          disabled={isSaving}
        />
        </View>

        {/* Error */}
        {errorMessage ? (
          <InlineError variant="block" message={errorMessage} />
        ) : null}

        {/* Actions */}
        <View style={styles.actionsRow}>
          <View style={styles.cancelSlot}>
            <Button
              label={t('profile.cancel')}
              onPress={onCancel}
              variant="secondary"
              size="lg"
              fullWidth
              disabled={isSaving}
              accessibilityLabel={t('profile.cancel')}
            />
          </View>
          <View style={styles.saveSlot}>
            <Button
              label={t('profile.save')}
              onPress={handleSave}
              variant="primary"
              size="lg"
              fullWidth
              loading={isSaving}
              disabled={isSaving || isUploadingAvatar}
              accessibilityLabel={t('profile.save')}
            />
          </View>
        </View>
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
      paddingTop: topInset + theme.spacing.md,
      paddingHorizontal: screenMargin,
      paddingBottom: theme.spacing.xl,
      gap: theme.spacing.md,
    },
    avatarContainer: {
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    changeAvatarSlot: {
      alignSelf: 'center',
    },
    form: {
      gap: theme.layout.fieldGap,
    },
    actionsRow: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
      marginTop: theme.spacing.md,
    },
    cancelSlot: {
      flex: 1,
    },
    saveSlot: {
      flex: 2,
    },
  });
}
