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
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Avatar,
  BottomSheet,
  Button,
  IconButton,
  InlineError,
  TextField,
} from '../../../components/ui';
import { ICON } from '../../../lib/icons';
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
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme, 0, screenMargin, Math.max(insets.bottom, theme.spacing.md));

  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [avatarUri, setAvatarUri] = useState<string | null>(
    profile?.avatar_url ?? null,
  );
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // A failed submit (save or required-name validation) moves the screen-reader focus to the InlineError;
  // a failed avatar upload is not a submit and only announces.
  const [errorFromSubmit, setErrorFromSubmit] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Both sides are normalised the same way (what handleSave writes), so a trailing space is not a change.
  const isDirty =
    displayName.trim() !== (profile?.display_name ?? '').trim() ||
    (bio.trim() || null) !== ((profile?.bio ?? '').trim() || null) ||
    avatarUri !== (profile?.avatar_url ?? null);

  function handleBack(): void {
    if (isSaving) return;
    if (isDirty || isUploadingAvatar) setDiscardOpen(true);
    else onCancel();
  }

  // v2.2: nested screen in the Profile tab; form hides the TabBar. Save is the one contextual action (header
  // trailing float IconButton); back doubles as cancel and asks first when there is something to lose.
  useAppHeader({
    title: t('profile.editProfile'),
    onBack: handleBack,
    trailing: (
      <IconButton
        variant="float"
        name={ICON.save.outline}
        accessibilityLabel={t('profile.save')}
        onPress={() => {
          void handleSave();
        }}
        loading={isSaving}
        disabled={!isDirty || isUploadingAvatar}
      />
    ),
  });
  useHideTabBar();

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
      // Discarded while uploading: the result is not written back.
      if (mounted.current) setAvatarUri(publicUrl);
    } catch (err) {
      console.warn('Avatar upload failed', err);
      if (mounted.current) {
        setErrorFromSubmit(false);
        setErrorMessage(t('profile.errors.avatarUploadFailed'));
      }
    } finally {
      if (mounted.current) setIsUploadingAvatar(false);
    }
  }

  async function handleSave(): Promise<void> {
    Keyboard.dismiss();
    if (!displayName.trim()) {
      setErrorFromSubmit(true);
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
      console.warn('Profile save failed', err);
      setErrorFromSubmit(true);
      setErrorMessage(t('profile.errors.saveFailed'));
    } finally {
      if (mounted.current) setIsSaving(false);
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
          {/* T3: centred under the avatar, no primary button above it (A6) */}
          <Button
            label={t('profile.changeAvatar')}
            onPress={handlePickAvatar}
            variant="text"
            placement="centered"
            afterPrimary={false}
            loading={isUploadingAvatar}
            disabled={isUploadingAvatar || isSaving}
            accessibilityLabel={t('profile.changeAvatar')}
          />
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

        {/* Error: the last element of the form, nothing sits below it */}
        {errorMessage ? (
          <InlineError variant="block" message={errorMessage} focusOnAppear={errorFromSubmit} />
        ) : null}
      </ScrollView>

      <BottomSheet
        variant="confirm"
        visible={discardOpen}
        onClose={() => {
          setDiscardOpen(false);
        }}
        title={t('profile.discardConfirmTitle')}
        description={t('profile.discardConfirmBody')}
        confirmLabel={t('profile.discard')}
        confirmIcon={ICON.delete.outline}
        cancelLabel={t('profile.keepEditing')}
        onConfirm={() => {
          setDiscardOpen(false);
          onCancel();
        }}
      />
    </KeyboardAvoidingView>
  );
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function makeStyles(
  theme: ReturnType<typeof useTheme>['theme'],
  topInset: number,
  screenMargin: number,
  bottomPadding: number,
) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollContent: {
      paddingTop: topInset + theme.spacing.md,
      paddingHorizontal: screenMargin,
      paddingBottom: bottomPadding,
      gap: theme.spacing.md,
    },
    avatarContainer: {
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    form: {
      gap: theme.layout.fieldGap,
    },
  });
}
