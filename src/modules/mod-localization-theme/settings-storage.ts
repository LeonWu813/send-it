/**
 * AsyncStorage persistence helpers for language and theme override preferences.
 *
 * Keys are per-user so that multiple users on the same device do not share
 * preferences. All public functions require a userId argument.
 *
 * Key format:
 *   'app_language_<userId>'       — persisted SupportedLanguage ('en' | 'zh-TW')
 *   'app_theme_override_<userId>' — persisted ThemeOverride ('system' | 'light' | 'dark')
 *
 * If userId is not yet known (unauthenticated), callers should NOT call these
 * functions — they should fall back to system defaults and call once auth resolves.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { SupportedLanguage } from '../../lib/i18n';
import type { ThemeOverride } from '../../lib/theme';

const languageKey = (userId: string): string => `app_language_${userId}`;
const themeOverrideKey = (userId: string): string => `app_theme_override_${userId}`;

const SUPPORTED_LANGUAGES: ReadonlyArray<SupportedLanguage> = ['en', 'zh-TW'];
const SUPPORTED_OVERRIDES: ReadonlyArray<ThemeOverride> = ['system', 'light', 'dark'];

/**
 * Load the persisted language preference for the given user from AsyncStorage.
 * Returns null if no preference has been saved or the stored value is invalid.
 */
export async function loadLanguage(userId: string): Promise<SupportedLanguage | null> {
  try {
    const stored = await AsyncStorage.getItem(languageKey(userId));
    if (stored !== null && (SUPPORTED_LANGUAGES as ReadonlyArray<string>).includes(stored)) {
      return stored as SupportedLanguage;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Persist the selected language preference for the given user to AsyncStorage.
 */
export async function saveLanguage(userId: string, lang: SupportedLanguage): Promise<void> {
  try {
    await AsyncStorage.setItem(languageKey(userId), lang);
  } catch {
    // Non-fatal — preference will not be persisted across launches
  }
}

/**
 * Load the persisted theme override preference for the given user from AsyncStorage.
 * Returns null if no preference has been saved or the stored value is invalid.
 */
export async function loadThemeOverride(userId: string): Promise<ThemeOverride | null> {
  try {
    const stored = await AsyncStorage.getItem(themeOverrideKey(userId));
    if (stored !== null && (SUPPORTED_OVERRIDES as ReadonlyArray<string>).includes(stored)) {
      return stored as ThemeOverride;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Persist the selected theme override preference for the given user to AsyncStorage.
 */
export async function saveThemeOverride(userId: string, override: ThemeOverride): Promise<void> {
  try {
    await AsyncStorage.setItem(themeOverrideKey(userId), override);
  } catch {
    // Non-fatal — preference will not be persisted across launches
  }
}

/**
 * Remove both persisted preferences for the given user from AsyncStorage.
 * Call on sign-out or account deletion to clean up per-user state.
 */
export async function clearUserPreferences(userId: string): Promise<void> {
  try {
    await AsyncStorage.multiRemove([languageKey(userId), themeOverrideKey(userId)]);
  } catch {
    // Non-fatal — stale keys will simply not be read on next launch
  }
}
