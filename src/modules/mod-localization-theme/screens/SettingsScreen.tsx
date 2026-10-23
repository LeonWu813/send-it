/**
 * SettingsScreen.
 *
 * Allows the user to configure language and appearance preferences that take
 * effect immediately without an app restart.
 *
 * AC-091: Language toggle between English and Traditional Chinese (zh-TW).
 *   - Calls i18n.changeLanguage() immediately on selection.
 *   - Persists the selection to AsyncStorage with key 'app_language_<userId>'.
 *
 * AC-092: Appearance override between System / Light / Dark.
 *   - Calls setOverride() from useTheme() immediately on selection.
 *   - Persists the selection to AsyncStorage with key 'app_theme_override_<userId>'.
 *
 * AC-155: "Blocked Accounts" row navigates to BlockedAccountsScreen (sub-view state).
 *
 * AC-157: "Beta Video Privacy" toggle reads and updates users.beta_video_privacy
 *   via MOD-001's updateBetaVideoPrivacy() public service.
 *
 * AC-168: Logout button at the very bottom calls signOut() from MOD-001.
 *
 * AC-202 / AC-203: Just before signOut(), the current language (AC-091) and
 *   theme override (AC-092) are saved to device-level storage via
 *   saveDeviceLanguage() and saveDeviceTheme() from src/lib/devicePrefs.
 *   These device-scoped values are read at app start and after sign-out by
 *   i18n.ts and ThemeProvider so signed-out screens use the last chosen settings.
 *   A failed save is logged but does not block sign-out (INT-031). If either
 *   save throws, the user is still signed out; signed-out screens fall back to
 *   AC-090 device language / System appearance.
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
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import i18n from '../../../lib/i18n';
import type { SupportedLanguage } from '../../../lib/i18n';
import { supabase } from '../../../lib/supabase';
import { useTheme } from '../../../lib/theme';
import type { ThemeOverride } from '../../../lib/theme';
import { saveLanguage as saveDeviceLanguage, saveTheme as saveDeviceTheme } from '../../../lib/devicePrefs';
import { signOut, updateBetaVideoPrivacy } from '../../mod-auth-profile';
import { useAppHeader, useHeaderContentInset, useTabBarInset } from '@/lib/AppHeaderContext';
import SwipeBackWrapper from '../../../components/SwipeBackWrapper';
import { Button } from '../../../components/ui/Button';
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
  const tabInset = useTabBarInset();
  const headerTop = useHeaderContentInset();
  const styles = makeStyles(theme, headerTop, tabInset.contentBottom);
  useAppHeader({ title: t('settings.title'), onBack });

  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>(
    (i18n.language as SupportedLanguage) ?? 'zh-TW',
  );
  const [selectedOverride, setSelectedOverride] = useState<ThemeOverride>(override);

  // userId for per-user AsyncStorage key scoping.
  // Loaded once on mount from the Supabase session; null until resolved.
  const [userId, setUserId] = useState<string | null>(null);

  // AC-157: Beta Video Privacy state
  const [betaVideoPrivacy, setBetaVideoPrivacy] = useState<'public' | 'followers_only'>('public');
  const [privacyLoading, setPrivacyLoading] = useState(false);
  const [privacyFetched, setPrivacyFetched] = useState(false);

  // AC-168: Logout state
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  // On mount: resolve userId then load persisted preferences and apply them.
  // If userId cannot be resolved (unauthenticated), skip AsyncStorage reads —
  // the screen will show system defaults without crashing.
  useEffect(() => {
    async function restorePreferences(): Promise<void> {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return;
      }
      const resolvedUserId = session.user.id;
      setUserId(resolvedUserId);

      const [savedLang, savedOverride] = await Promise.all([
        loadLanguage(resolvedUserId),
        loadThemeOverride(resolvedUserId),
      ]);

      if (savedLang !== null) {
        setSelectedLanguage(savedLang);
        if (i18n.language !== savedLang) {
          await i18n.changeLanguage(savedLang);
        }
      }

      if (savedOverride !== null) {
        setSelectedOverride(savedOverride);
        // setOverride is now handled by ThemeProvider on init — do not call here
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
    // Only persist if userId is known; unauthenticated state is not persisted.
    if (userId !== null) {
      await saveLanguage(userId, lang);
    }
  }

  async function handleOverrideSelect(newOverride: ThemeOverride): Promise<void> {
    setSelectedOverride(newOverride);
    setOverride(newOverride);
    // Only persist if userId is known; unauthenticated state is not persisted.
    if (userId !== null) {
      await saveThemeOverride(userId, newOverride);
    }
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
  // AC-202 / AC-203: persist current language and theme to device storage just
  // before sign-out so signed-out screens can restore them (saveLanguage /
  // saveTheme are device-scoped, not per-user).
  //
  // INT-031 fix: save failures are logged but do not block sign-out. The user
  // is always signed out regardless of whether the device preference saves
  // succeeded. If a save throws, signed-out screens fall back to AC-090 device
  // language / System appearance.
  async function handleLogout(): Promise<void> {
    setIsSigningOut(true);
    setLogoutError(null);
    // Attempt both saves in parallel. allSettled never rejects, so a failure
    // in either save cannot prevent the signOut() call below.
    const saveResults = await Promise.allSettled([
      saveDeviceLanguage(selectedLanguage),
      saveDeviceTheme(selectedOverride),
    ]);
    for (const result of saveResults) {
      if (result.status === 'rejected') {
        console.error('[handleLogout] device pref save error:', result.reason);
      }
    }
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
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        scrollIndicatorInsets={{ bottom: tabInset.indicatorBottom }}
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
                thumbColor={theme.colors.surface}
              />
            </View>
          </View>
        </View>

        {/* Logout (AC-168) */}
        {logoutError ? (
          <Text style={styles.logoutError}>{logoutError}</Text>
        ) : null}
        <View style={styles.logoutWrap}>
          <Button
            variant="destructive"
            icon="log-out-outline"
            label={t('profile.logout')}
            loading={isSigningOut}
            fullWidth
            onPress={() => { void handleLogout(); }}
          />
        </View>
      </ScrollView>
    </SwipeBackWrapper>
  );
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function makeStyles(theme: ReturnType<typeof useTheme>['theme'], headerTop: number, bottomInset: number) {
  return StyleSheet.create({
    scrollView: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollContent: {
      paddingHorizontal: theme.spacing.lg,
      paddingTop: headerTop + theme.spacing.lg,
      paddingBottom: theme.spacing.xl + bottomInset,
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
      minHeight: theme.layout.minTouchTarget,
      paddingVertical: theme.layout.listRowPaddingV,
      paddingHorizontal: theme.spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.divider,
    },
    optionRowPressed: {
      backgroundColor: theme.colors.surfacePressed,
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
      borderColor: theme.colors.outline,
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
    // AC-168: Logout button wrapper (shared destructive Button)
    logoutWrap: {
      marginTop: theme.spacing.lg,
      marginBottom: theme.spacing.xl,
    },
    logoutError: {
      fontSize: theme.fontSize.sm,
      color: theme.colors.error,
      marginHorizontal: theme.spacing.lg,
      marginTop: theme.spacing.md,
    },
  });
}
