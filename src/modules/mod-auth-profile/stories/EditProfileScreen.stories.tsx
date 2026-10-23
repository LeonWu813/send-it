/**
 * Stories for EditProfileScreen.
 *
 * States:
 *   Loaded      — form pre-filled with the current user's display name, bio, and avatar.
 *   Saving      — save button shows a spinner; form is disabled while the profile is being persisted.
 *   Interactive — real EditProfileScreen connected to the supabase stub; all interactions work.
 */

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { Avatar, Button, Card, TextField } from '../../../components/ui';
import { useLayout, useTheme } from '../../../lib/theme';
import EditProfileScreen from '../screens/EditProfileScreen';
import type { UserProfile } from '../types';

// ── Shared fixtures ───────────────────────────────────────────────────────────

const STUB_PROFILE: UserProfile = {
  id: 'story-user-me',
  display_name: 'Leon Wu',
  avatar_url: null,
  bio: '熱愛抱石，台北攀岩愛好者。',
  privacy_setting: 'public',
  created_at: '2026-01-15T00:00:00Z',
};

// ── Controlled Demo component ─────────────────────────────────────────────────

interface DemoArgs {
  /** Shows the save button spinner and disables all form inputs. */
  saving: boolean;
}

/**
 * Controlled Demo for the Edit Profile form.
 *
 * Renders the same visual layout as EditProfileScreen with pre-filled profile data.
 * When `saving` is true the save button shows a loading spinner and all fields are
 * disabled — matching the state between the user tapping Save and the upsert completing.
 *
 * The real interactive component (with full picker + save functionality) is in
 * the Interactive story below.
 */
function Demo({ saving }: DemoArgs): React.JSX.Element {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const { screenMargin } = useLayout();

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          paddingTop: 16,
          paddingHorizontal: screenMargin,
          paddingBottom: 32,
          gap: 16,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Avatar section */}
        <View style={{ alignItems: 'center', gap: 8 }}>
          <Avatar size="xl" uri={null} name={STUB_PROFILE.display_name} />
          <Button
            label={t('profile.changeAvatar')}
            onPress={() => {}}
            variant="ghost"
            on="background"
            disabled={saving}
          />
        </View>

        {/* Form fields */}
        <Card style={{ gap: theme.layout.fieldGap }}>
          <TextField
            label={t('profile.displayName')}
            value={STUB_PROFILE.display_name}
            onChangeText={() => {}}
            autoCapitalize="words"
            autoCorrect={false}
            disabled={saving}
          />
          <TextField
            variant="multiline"
            label={t('profile.bio')}
            value={STUB_PROFILE.bio ?? ''}
            onChangeText={() => {}}
            placeholder={t('profile.bioPlaceholder')}
            disabled={saving}
          />
        </Card>

        {/* Action row */}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
          <View style={{ flex: 1 }}>
            <Button
              label={t('profile.cancel')}
              onPress={() => {}}
              variant="secondary"
              size="lg"
              fullWidth
              disabled={saving}
            />
          </View>
          <View style={{ flex: 2 }}>
            <Button
              label={t('profile.save')}
              onPress={() => {}}
              variant="primary"
              size="lg"
              fullWidth
              loading={saving}
              disabled={saving}
            />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Meta ──────────────────────────────────────────────────────────────────────

const meta: Meta<DemoArgs> = {
  title: 'AuthProfile/EditProfileScreen',
  component: Demo,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <View style={{ width: 390, height: 780 }}>
        <Story />
      </View>
    ),
  ],
  args: { saving: false },
  argTypes: { saving: { control: 'boolean' } },
};
export default meta;

type Story = StoryObj<DemoArgs>;

/** Form loaded with the current user's profile data — ready for editing. */
export const Loaded: Story = {};

/** Save in progress — save button shows a spinner; all inputs are disabled. */
export const Saving: Story = {
  args: { saving: true },
};

/**
 * Fully interactive — the real EditProfileScreen component.
 * Change Avatar (no-op on web), edit fields, and press Save to observe the
 * loading → success transition (supabase stub resolves immediately).
 */
export const Interactive: Story = {
  render: () => (
    <EditProfileScreen
      userId={STUB_PROFILE.id}
      profile={STUB_PROFILE}
      onSaved={() => {}}
      onCancel={() => {}}
    />
  ),
};
