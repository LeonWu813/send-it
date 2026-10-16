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
  Card,
  Chip,
  InlineError,
  TextField,
} from '../../../components/ui';
import { useLayout, useTheme } from '../../../lib/theme';
import { useAppHeader, useHideTabBar } from '@/lib/AppHeaderContext';
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
  const { screenMargin } = useLayout();
  const styles = makeStyles(theme, 0, screenMargin);

  // v2.2: nested screen in the Profile tab; form hides the TabBar.
  useAppHeader({ title: t('profile.editProfile'), onBack: onCancel });
  useHideTabBar();

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
          <Avatar size="xl" uri={avatarUri} name={displayName} />
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

        {/* Grouped form card: one Card, fields keep their own 1pt border */}
        <Card style={styles.formCard}>
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
        </Card>

        {/* Privacy setting */}
        <AppText variant="groupHeader" style={styles.sectionLabel}>
          {t('profile.privacy')}
        </AppText>
        <View style={styles.privacyToggleRow} accessibilityRole="radiogroup">
          <Chip
            variant="choice"
            label={t('profile.privacyPublic')}
            selected={privacySetting === 'public'}
            onPress={() => setPrivacySetting('public')}
            disabled={isSaving}
          />
          <Chip
            variant="choice"
            label={t('profile.privacyFollowersOnly')}
            selected={privacySetting === 'followers_only'}
            onPress={() => setPrivacySetting('followers_only')}
            disabled={isSaving}
          />
        </View>
        <AppText variant="footnote" color="textSecondary">
          {privacySetting === 'public'
            ? t('profile.privacyPublicDescription')
            : t('profile.privacyFollowersOnlyDescription')}
        </AppText>

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
              disabled={isSaving}
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
    formCard: {
      gap: theme.layout.fieldGap,
    },
    sectionLabel: {
      marginTop: theme.spacing.sm,
    },
    privacyToggleRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      columnGap: theme.spacing.sm,
      rowGap: theme.spacing.smd,
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
