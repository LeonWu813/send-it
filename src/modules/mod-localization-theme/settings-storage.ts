/**
 * AsyncStorage persistence helpers for language and theme override preferences.
 *
 * Keys:
 *   'app_language'       — persisted SupportedLanguage ('en' | 'zh-TW')
 *   'app_theme_override' — persisted ThemeOverride ('system' | 'light' | 'dark')
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { SupportedLanguage } from '../../lib/i18n';
import type { ThemeOverride } from '../../lib/theme';

const LANGUAGE_KEY = 'app_language';
const THEME_OVERRIDE_KEY = 'app_theme_override';

const SUPPORTED_LANGUAGES: ReadonlyArray<SupportedLanguage> = ['en', 'zh-TW'];
const SUPPORTED_OVERRIDES: ReadonlyArray<ThemeOverride> = ['system', 'light', 'dark'];

/**
 * Load the persisted language preference from AsyncStorage.
 * Returns null if no preference has been saved or the stored value is invalid.
 */
export async function loadLanguage(): Promise<SupportedLanguage | null> {
  try {
    const stored = await AsyncStorage.getItem(LANGUAGE_KEY);
    if (stored !== null && (SUPPORTED_LANGUAGES as ReadonlyArray<string>).includes(stored)) {
      return stored as SupportedLanguage;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Persist the selected language preference to AsyncStorage.
 */
export async function saveLanguage(lang: SupportedLanguage): Promise<void> {
  try {
    await AsyncStorage.setItem(LANGUAGE_KEY, lang);
  } catch {
    // Non-fatal — preference will not be persisted across launches
  }
}

/**
 * Load the persisted theme override preference from AsyncStorage.
 * Returns null if no preference has been saved or the stored value is invalid.
 */
export async function loadThemeOverride(): Promise<ThemeOverride | null> {
  try {
    const stored = await AsyncStorage.getItem(THEME_OVERRIDE_KEY);
    if (stored !== null && (SUPPORTED_OVERRIDES as ReadonlyArray<string>).includes(stored)) {
      return stored as ThemeOverride;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Persist the selected theme override preference to AsyncStorage.
 */
export async function saveThemeOverride(override: ThemeOverride): Promise<void> {
  try {
    await AsyncStorage.setItem(THEME_OVERRIDE_KEY, override);
  } catch {
    // Non-fatal — preference will not be persisted across launches
  }
}
