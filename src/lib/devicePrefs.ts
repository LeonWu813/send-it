/**
 * Device-level preference storage for language and theme (AC-202/AC-203).
 *
 * Stores and retrieves the user's language and theme choice at the device level
 * — not per-user. Read when no user is signed in (app start, after sign-out) so
 * the app preserves the last chosen settings across sign-out/sign-in cycles.
 *
 * MOD-010's SettingsScreen calls saveLanguage() and saveTheme() just before
 * signOut(). i18n.ts and ThemeProvider read the load helpers at app start and
 * after sign-out.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Supported language values that can be stored at device level. */
export type DeviceLanguage = 'en' | 'zh-TW';

/** Supported theme values that can be stored at device level. */
export type DeviceTheme = 'system' | 'light' | 'dark';

const DEVICE_LANGUAGE_KEY = 'device_language';
const DEVICE_THEME_KEY = 'device_theme';

// ─── Language helpers ─────────────────────────────────────────────────────────

/**
 * Persist the current language setting at device level.
 * MOD-010's SettingsScreen calls this just before signOut().
 */
export async function saveLanguage(lang: DeviceLanguage): Promise<void> {
  try {
    await AsyncStorage.setItem(DEVICE_LANGUAGE_KEY, lang);
  } catch (err) {
    console.error('[saveLanguage] error:', err);
    throw new Error('Failed to save language preference.');
  }
}

/**
 * Load the device-level language setting.
 * Returns the stored value, or null if nothing has been saved yet.
 */
export async function loadLanguage(): Promise<DeviceLanguage | null> {
  try {
    const stored = await AsyncStorage.getItem(DEVICE_LANGUAGE_KEY);
    if (stored === 'en' || stored === 'zh-TW') {
      return stored;
    }
    return null;
  } catch (err) {
    console.error('[loadLanguage] error:', err);
    return null;
  }
}

// ─── Theme helpers ────────────────────────────────────────────────────────────

/**
 * Persist the current theme setting at device level.
 * MOD-010's SettingsScreen calls this just before signOut().
 */
export async function saveTheme(theme: DeviceTheme): Promise<void> {
  try {
    await AsyncStorage.setItem(DEVICE_THEME_KEY, theme);
  } catch (err) {
    console.error('[saveTheme] error:', err);
    throw new Error('Failed to save theme preference.');
  }
}

/**
 * Load the device-level theme setting.
 * Returns the stored value, or null if nothing has been saved yet.
 */
export async function loadTheme(): Promise<DeviceTheme | null> {
  try {
    const stored = await AsyncStorage.getItem(DEVICE_THEME_KEY);
    if (stored === 'system' || stored === 'light' || stored === 'dark') {
      return stored;
    }
    return null;
  } catch (err) {
    console.error('[loadTheme] error:', err);
    return null;
  }
}
