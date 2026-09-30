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
 * On mount, loads persisted preferences from AsyncStorage and applies them so
 * the saved state is restored correctly on each launch.
 *
 * Layout:
 *   - Back button (top-left chevron-back icon) via onBack() prop.
 *   - Two sections: Language, Appearance — each with radio-style options.
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
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import i18n from '../../../lib/i18n';
import type { SupportedLanguage } from '../../../lib/i18n';
import { useTheme } from '../../../lib/theme';
import type { ThemeOverride } from '../../../lib/theme';
import {
  loadLanguage,
  loadThemeOverride,
  saveLanguage,
  saveThemeOverride,
} from '../settings-storage';

export interface SettingsScreenProps {
  onBack: () => void;
}

export default function SettingsScreen({ onBack }: SettingsScreenProps): React.JSX.Element {
  const { t } = useTranslation('common');
  const { theme, override, setOverride } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme, insets.top);

  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>(
    (i18n.language as SupportedLanguage) ?? 'zh-TW',
  );
  const [selectedOverride, setSelectedOverride] = useState<ThemeOverride>(override);

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

  const languageOptions: Array<{ value: SupportedLanguage; label: string }> = [
    { value: 'en', label: t('settings.language.en') },
    { value: 'zh-TW', label: t('settings.language.zhTW') },
  ];

  const appearanceOptions: Array<{ value: ThemeOverride; label: string }> = [
    { value: 'system', label: t('settings.appearance.system') },
    { value: 'light', label: t('settings.appearance.light') },
    { value: 'dark', label: t('settings.appearance.dark') },
  ];

  return (
    <View style={styles.root}>
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
      </ScrollView>
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
  });
}
