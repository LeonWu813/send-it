/**
 * SettingsScreen.
 *
 * Allows the user to configure language and appearance preferences that take
 * effect immediately without an app restart.
 *
 * AC-091: Language toggle between English and Traditional Chinese (zh-TW).
 *   - Calls i18n.changeLanguage() immediately on selection.
 *   - Persists the selection to AsyncStorage with key 'app_language'.
 *
 * AC-092: Appearance override between System / Light / Dark.
 *   - Calls setOverride() from useTheme() immediately on selection.
 *   - Persists the selection to AsyncStorage with key 'app_theme_override'.
 *
 * AC-155: "Blocked Accounts" row navigates to BlockedAccountsScreen (sub-view state).
 *
 * AC-157: "Beta Video Privacy" toggle reads and updates users.beta_video_privacy
 *   via MOD-001's updateBetaVideoPrivacy() public service.
 *
 * AC-168: Logout button at the very bottom calls signOut() from MOD-001.
 *
 * On mount, loads persisted preferences from AsyncStorage and applies them so
 * the saved state is restored correctly on each launch.
 *
 * Layout:
 *   - Back button (top-left chevron-back icon) via onBack() prop.
 *   - Sections: Language, Appearance, Privacy (Beta Video Privacy toggle),
 *     Account (Blocked Accounts row), Logout button.
 *   - Uses useSafeAreaInsets() for top inset.
 *   - Uses useTheme() for all colors — no hardcoded hex.
 *   - Uses useTranslation('common') for all strings.
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import i18n from '../../../lib/i18n';
import type { SupportedLanguage } from '../../../lib/i18n';
import { supabase } from '../../../lib/supabase';
import { useTheme } from '../../../lib/theme';
import type { ThemeOverride } from '../../../lib/theme';
import { signOut, updateBetaVideoPrivacy } from '../../mod-auth-profile/auth-service';
import SwipeBackWrapper from '../../../components/SwipeBackWrapper';
import {
  loadLanguage,
  loadThemeOverride,
  saveLanguage,
  saveThemeOverride,
} from '../settings-storage';
import BlockedAccountsScreen from './BlockedAccountsScreen';

export interface SettingsScreenProps {
  onBack: () => void;
}

type SettingsView = 'settings' | 'blockedAccounts';

export default function SettingsScreen({ onBack }: SettingsScreenProps): React.JSX.Element {
  const [view, setView] = useState<SettingsView>('settings');
  const { t } = useTranslation('common');
  const { theme, override, setOverride } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme, insets.top);

  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>(
    (i18n.language as SupportedLanguage) ?? 'zh-TW',
  );
  const [selectedOverride, setSelectedOverride] = useState<ThemeOverride>(override);

  // AC-157: Beta Video Privacy state
  const [betaVideoPrivacy, setBetaVideoPrivacy] = useState<'public' | 'followers_only'>('public');
  const [privacyLoading, setPrivacyLoading] = useState(false);
  const [privacyFetched, setPrivacyFetched] = useState(false);

  // AC-168: Logout state
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  // On mount: load persisted preferences and apply them
  useEffect(() => {
    async function restorePreferences(): Promise<void> {
      const [savedLang, savedOverride] = await Promise.all([
        loadLanguage(),
        loadThemeOverride(),
      ]);

      if (savedLang !== null) {
        setSelectedLanguage(savedLang);
        if (i18n.language !== savedLang) {
          await i18n.changeLanguage(savedLang);
        }
      }

      if (savedOverride !== null) {
        setSelectedOverride(savedOverride);
        setOverride(savedOverride);
      }
    }

    void restorePreferences();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // AC-157: Fetch current beta_video_privacy on mount
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setPrivacyFetched(true);
        return;
      }
      const { data } = await supabase
        .from('users')
        .select('beta_video_privacy')
        .eq('id', session.user.id)
        .single();
      if (data?.beta_video_privacy) {
        setBetaVideoPrivacy(data.beta_video_privacy as 'public' | 'followers_only');
      }
      setPrivacyFetched(true);
    })();
  }, []);

  async function handleLanguageSelect(lang: SupportedLanguage): Promise<void> {
    setSelectedLanguage(lang);
    await i18n.changeLanguage(lang);
    await saveLanguage(lang);
  }

  async function handleOverrideSelect(newOverride: ThemeOverride): Promise<void> {
    setSelectedOverride(newOverride);
    setOverride(newOverride);
    await saveThemeOverride(newOverride);
  }

  // AC-157: Toggle handler
  async function handleBetaVideoPrivacyToggle(value: boolean): Promise<void> {
    const newValue = value ? 'followers_only' : 'public';
    setPrivacyLoading(true);
    try {
      await updateBetaVideoPrivacy(newValue);
      setBetaVideoPrivacy(newValue);
    } catch {
      // silently revert on error
    } finally {
      setPrivacyLoading(false);
    }
  }

  // AC-168: Logout handler
  async function handleLogout(): Promise<void> {
    setIsSigningOut(true);
    setLogoutError(null);
    try {
      await signOut();
      // AuthNavigator observes onAuthStateChange and routes back to signed-out state
    } catch (err) {
      const message = err instanceof Error ? err.message : t('auth.errors.signOutFailed');
      setLogoutError(message);
      setIsSigningOut(false);
    }
  }

  const languageOptions: Array<{ value: SupportedLanguage; label: string }> = [
    { value: 'en', label: t('settings.language.en') },
    { value: 'zh-TW', label: t('settings.language.zhTW') },
  ];

  const appearanceOptions: Array<{ value: ThemeOverride; label: string }> = [
    { value: 'system', label: t('settings.appearance.system') },
    { value: 'light', label: t('settings.appearance.light') },
    { value: 'dark', label: t('settings.appearance.dark') },
  ];

  // Sub-screen: Blocked Accounts (AC-155)
  if (view === 'blockedAccounts') {
    return <BlockedAccountsScreen onBack={() => { setView('settings'); }} />;
  }

  return (
    <SwipeBackWrapper onBack={onBack}>
      {/* Navigation bar */}
      <View style={styles.navBar}>
        <Pressable
          style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel={t('settings.back') ?? 'Back'}
        >
          <Ionicons name="chevron-back" size={20} color={theme.colors.primary} />
          <Text style={styles.backButtonText}>{t('settings.back') ?? 'Back'}</Text>
        </Pressable>
        <Text style={styles.navTitle}>{t('settings.title')}</Text>
        {/* Spacer to balance the back button */}
        <View style={styles.navSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Language section (AC-091) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.language.title')}</Text>
          <View style={styles.optionGroup}>
            {languageOptions.map(({ value, label }) => {
              const isSelected = selectedLanguage === value;
              return (
                <Pressable
                  key={value}
                  style={({ pressed }) => [
                    styles.optionRow,
                    pressed && styles.optionRowPressed,
                  ]}
                  onPress={() => { void handleLanguageSelect(value); }}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isSelected }}
                  accessibilityLabel={label}
                >
                  <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
                    {label}
                  </Text>
                  <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
                    {isSelected ? <View style={styles.radioInner} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Appearance section (AC-092) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.appearance.title')}</Text>
          <View style={styles.optionGroup}>
            {appearanceOptions.map(({ value, label }) => {
              const isSelected = selectedOverride === value;
              return (
                <Pressable
                  key={value}
                  style={({ pressed }) => [
                    styles.optionRow,
                    pressed && styles.optionRowPressed,
                  ]}
                  onPress={() => { void handleOverrideSelect(value); }}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isSelected }}
                  accessibilityLabel={label}
                >
                  <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
                    {label}
                  </Text>
                  <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
                    {isSelected ? <View style={styles.radioInner} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Account section — Blocked Accounts navigation row (AC-155) */}
        <View style={styles.section}>
          <View style={styles.optionGroup}>
            <Pressable
              style={({ pressed }) => [
                styles.optionRow,
                pressed && styles.optionRowPressed,
              ]}
              onPress={() => { setView('blockedAccounts'); }}
              accessibilityRole="button"
              accessibilityLabel={t('settings.blockedAccounts')}
            >
              <Text style={styles.optionLabel}>{t('settings.blockedAccounts')}</Text>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.textSecondary} />
            </Pressable>
          </View>
        </View>

        {/* Privacy section — Beta Video Privacy toggle (AC-157) */}
        <View style={styles.section}>
          <View style={styles.optionGroup}>
            <View style={styles.settingRow}>
              <View style={styles.settingRowContent}>
                <Text style={styles.optionLabel}>{t('settings.betaVideoPrivacy')}</Text>
                <Text style={styles.settingRowSubtext}>
                  {betaVideoPrivacy === 'followers_only'
                    ? t('settings.betaVideoPrivacyFollowersOnly')
                    : t('settings.betaVideoPrivacyPublic')}
                </Text>
              </View>
              <Switch
                value={betaVideoPrivacy === 'followers_only'}
                onValueChange={(value) => { void handleBetaVideoPrivacyToggle(value); }}
                disabled={!privacyFetched || privacyLoading}
                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                thumbColor={theme.colors.background}
              />
            </View>
          </View>
        </View>

        {/* Logout (AC-168) */}
        {logoutError ? (
          <Text style={styles.logoutError}>{logoutError}</Text>
        ) : null}
        <Pressable
          style={({ pressed }) => [
            styles.logoutButton,
            pressed && styles.logoutButtonPressed,
            isSigningOut && styles.logoutButtonDisabled,
          ]}
          onPress={() => { void handleLogout(); }}
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
    </SwipeBackWrapper>
  );
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function makeStyles(theme: ReturnType<typeof useTheme>['theme'], topInset: number) {
  return StyleSheet.create({
    navBar: {
      paddingTop: topInset + theme.spacing.md,
      paddingBottom: theme.spacing.md,
      paddingHorizontal: theme.spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      backgroundColor: theme.colors.background,
    },
    backButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      paddingVertical: theme.spacing.xs,
      paddingHorizontal: theme.spacing.xs,
      borderRadius: theme.borderRadius.md,
      minWidth: 60,
    },
    backButtonPressed: {
      backgroundColor: theme.colors.surface,
    },
    backButtonText: {
      fontSize: theme.fontSize.md,
      color: theme.colors.primary,
      fontWeight: theme.fontWeight.medium,
    },
    navTitle: {
      flex: 1,
      textAlign: 'center',
      fontSize: theme.fontSize.lg,
      fontWeight: theme.fontWeight.semibold,
      color: theme.colors.textPrimary,
    },
    navSpacer: {
      width: 40,
    },
    scrollView: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollContent: {
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.lg,
      paddingBottom: theme.spacing.xl,
    },
    section: {
      marginBottom: theme.spacing.xl,
    },
    sectionTitle: {
      fontSize: theme.fontSize.sm,
      fontWeight: theme.fontWeight.semibold,
      color: theme.colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: theme.spacing.sm,
    },
    optionGroup: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.lg,
      overflow: 'hidden',
    },
    optionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.divider,
    },
    optionRowPressed: {
      backgroundColor: theme.colors.surfaceElevated,
    },
    optionLabel: {
      fontSize: theme.fontSize.md,
      color: theme.colors.textPrimary,
    },
    optionLabelSelected: {
      fontWeight: theme.fontWeight.medium,
      color: theme.colors.primary,
    },
    radioOuter: {
      width: 20,
      height: 20,
      borderRadius: theme.borderRadius.full,
      borderWidth: 2,
      borderColor: theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioOuterSelected: {
      borderColor: theme.colors.primary,
    },
    radioInner: {
      width: 10,
      height: 10,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.primary,
    },
    // AC-157: Beta Video Privacy toggle row
    settingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
    },
    settingRowContent: {
      flex: 1,
      marginRight: theme.spacing.md,
    },
    settingRowSubtext: {
      fontSize: theme.fontSize.xs,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    // AC-168: Logout button
    logoutButton: {
      height: 44,
      marginHorizontal: theme.spacing.lg,
      marginTop: theme.spacing.lg,
      marginBottom: theme.spacing.xl,
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
    logoutError: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.error,
      marginHorizontal: theme.spacing.lg,
      marginTop: theme.spacing.md,
    },
  });
}
