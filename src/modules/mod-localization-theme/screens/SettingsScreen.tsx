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
 * AC-168: Logout destructive row at the very bottom asks for confirmation (BottomSheet
 *   confirm), then calls signOut() from MOD-001.
 *
 * N-1 (page-review): "Notifications" row pushes Notification Preferences through the
 *   onNavigateToNotificationPreferences prop (wired in AppShell).
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
  View,
} from 'react-native';

import { AppText } from '../../../components/ui/AppText';

import { ICON } from '../../../lib/icons';
import i18n from '../../../lib/i18n';
import type { SupportedLanguage } from '../../../lib/i18n';
import { supabase } from '../../../lib/supabase';
import { useLayout, useTheme } from '../../../lib/theme';
import type { ThemeOverride } from '../../../lib/theme';
import { saveLanguage as saveDeviceLanguage, saveTheme as saveDeviceTheme } from '../../../lib/devicePrefs';
import { signOut, updateBetaVideoPrivacy } from '../../mod-auth-profile';
import { useAppHeader, useHeaderContentInset, useTabBarInset } from '@/lib/AppHeaderContext';
import SwipeBackWrapper from '../../../components/SwipeBackWrapper';
import { BottomSheet } from '../../../components/ui/BottomSheet';
import {
  loadLanguage,
  loadThemeOverride,
  saveLanguage,
  saveThemeOverride,
} from '../settings-storage';
import BlockedAccountsScreen from './BlockedAccountsScreen';

export interface SettingsScreenProps {
  onBack: () => void;
  /** Push Notification Preferences (N-1). When omitted the Notifications row is hidden. */
  onNavigateToNotificationPreferences?: () => void;
}

type SettingsView = 'settings' | 'blockedAccounts';

export default function SettingsScreen({ onBack, onNavigateToNotificationPreferences }: SettingsScreenProps): React.JSX.Element {
  const [view, setView] = useState<SettingsView>('settings');
  const { t } = useTranslation('common');
  const { theme, override, setOverride } = useTheme();
  const tabInset = useTabBarInset();
  const headerTop = useHeaderContentInset();
  const { screenMargin } = useLayout();
  const styles = makeStyles(theme, headerTop, tabInset.contentBottom, screenMargin);
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
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

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
      setLogoutConfirmOpen(false);
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
        <View>
          <AppText variant="groupHeader" style={styles.sectionTitle}>{t('settings.language.title')}</AppText>
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
                  <AppText
                    variant="body"
                    color={isSelected ? 'primary' : undefined}
                    weight={isSelected ? '500' : undefined}
                  >
                    {label}
                  </AppText>
                  <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
                    {isSelected ? <View style={styles.radioInner} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Appearance section (AC-092) */}
        <View>
          <AppText variant="groupHeader" style={styles.sectionTitle}>{t('settings.appearance.title')}</AppText>
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
                  <AppText
                    variant="body"
                    color={isSelected ? 'primary' : undefined}
                    weight={isSelected ? '500' : undefined}
                  >
                    {label}
                  </AppText>
                  <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
                    {isSelected ? <View style={styles.radioInner} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Account section: Notifications (N-1) + Blocked Accounts navigation rows (AC-155) */}
        <View style={styles.optionGroup}>
          {onNavigateToNotificationPreferences ? (
            <Pressable
              style={({ pressed }) => [
                styles.optionRow,
                pressed && styles.optionRowPressed,
              ]}
              onPress={onNavigateToNotificationPreferences}
              accessibilityRole="button"
              accessibilityLabel={t('settings.notifications')}
            >
              <AppText variant="body">{t('settings.notifications')}</AppText>
              <Ionicons name={ICON.forward.outline} size={theme.iconSize.sm} color={theme.colors.textSecondary} />
            </Pressable>
          ) : null}
          <Pressable
            style={({ pressed }) => [
              styles.optionRow,
              styles.optionRowLast,
              pressed && styles.optionRowPressed,
            ]}
            onPress={() => { setView('blockedAccounts'); }}
            accessibilityRole="button"
            accessibilityLabel={t('settings.blockedAccounts')}
          >
            <AppText variant="body">{t('settings.blockedAccounts')}</AppText>
            <Ionicons name={ICON.forward.outline} size={theme.iconSize.sm} color={theme.colors.textSecondary} />
          </Pressable>
        </View>

        {/* Privacy section: Beta Video Privacy toggle (AC-157). The subtitle always states the ON effect. */}
        <View style={styles.optionGroup}>
          <View style={styles.settingRow}>
            <View style={styles.settingRowContent}>
              <AppText variant="body">{t('settings.betaVideoPrivacy')}</AppText>
              <AppText variant="footnote" color="textSecondary" style={styles.settingRowSubtext}>
                {t('settings.betaVideoPrivacyOnEffect')}
              </AppText>
            </View>
            <Switch
              value={betaVideoPrivacy === 'followers_only'}
              onValueChange={(value) => { void handleBetaVideoPrivacyToggle(value); }}
              disabled={!privacyFetched || privacyLoading}
              trackColor={{ false: theme.colors.surfaceAlt, true: theme.colors.primary }}
              thumbColor={theme.colors.surface}
              accessibilityLabel={t('settings.betaVideoPrivacy')}
            />
          </View>
        </View>

        {/* Logout (AC-168): destructive row, confirmed in a sheet */}
        <View>
          <View style={styles.optionGroup}>
            <Pressable
              style={({ pressed }) => [
                styles.optionRow,
                styles.optionRowLast,
                styles.logoutRow,
                pressed && styles.optionRowPressed,
              ]}
              onPress={() => { setLogoutConfirmOpen(true); }}
              disabled={isSigningOut}
              accessibilityRole="button"
              accessibilityLabel={t('profile.logout')}
              accessibilityState={{ disabled: isSigningOut, busy: isSigningOut }}
            >
              <Ionicons name={ICON.signOut.outline} size={theme.iconSize.md} color={theme.colors.error} />
              <AppText variant="body" color="error">{t('profile.logout')}</AppText>
            </Pressable>
          </View>
          {logoutError ? (
            <AppText variant="footnote" color="error" style={styles.logoutError}>{logoutError}</AppText>
          ) : null}
        </View>
      </ScrollView>
      <BottomSheet
        variant="confirm"
        visible={logoutConfirmOpen}
        onClose={() => { setLogoutConfirmOpen(false); }}
        title={t('settings.logoutConfirmTitle')}
        description={t('settings.logoutConfirmBody')}
        confirmLabel={t('profile.logout')}
        confirmIcon={ICON.signOut.outline}
        loading={isSigningOut}
        onConfirm={() => {
          // The sheet stays open (confirm button loading) until signOut() finishes or fails.
          void handleLogout();
        }}
      />
    </SwipeBackWrapper>
  );
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function makeStyles(theme: ReturnType<typeof useTheme>['theme'], headerTop: number, bottomInset: number, screenMargin: number) {
  return StyleSheet.create({
    scrollView: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollContent: {
      // R0/R1/R3: the container owns the margin (screenMargin) and the gap (sectionGap); sections set none.
      paddingHorizontal: screenMargin,
      paddingTop: headerTop + theme.spacing.md,
      paddingBottom: theme.spacing.xl + bottomInset,
      gap: theme.layout.sectionGap,
    },
    sectionTitle: {
      marginBottom: theme.layout.sectionHeaderGap,
    },
    optionGroup: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.card,
      overflow: 'hidden',
    },
    optionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: theme.layout.listRowMinHeight,
      paddingVertical: theme.spacing.smd,
      paddingHorizontal: theme.spacing.md,
      borderBottomWidth: theme.stroke.hairline,
      borderBottomColor: theme.colors.divider,
    },
    optionRowLast: {
      borderBottomWidth: 0,
    },
    logoutRow: {
      justifyContent: 'flex-start',
      gap: theme.spacing.sm,
    },
    optionRowPressed: {
      backgroundColor: theme.colors.surfacePressed,
    },
    radioOuter: {
      width: 20,
      height: 20,
      borderRadius: theme.radius.full,
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
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors.primary,
    },
    // AC-157: Beta Video Privacy toggle row
    settingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: theme.layout.listRowMinHeight,
      paddingVertical: theme.spacing.smd,
      paddingHorizontal: theme.spacing.md,
    },
    settingRowContent: {
      flex: 1,
      marginRight: theme.spacing.md,
    },
    settingRowSubtext: {
      marginTop: 2,
    },
    logoutError: {
      marginTop: theme.spacing.sm,
    },
  });
}
