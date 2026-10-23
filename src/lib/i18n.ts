/**
 * i18n initialization.
 *
 * Sets up i18next with react-i18next for the app.
 * - Supported languages: English (en) and Traditional Chinese (zh-TW).
 * - Default language: device locale, with zh-TW fallback for any non-English locale.
 * - All user-facing strings must go through the useTranslation hook — never use
 *   inline string literals in components.
 *
 * Import this module once at the app root (App.tsx) to trigger initialization.
 *
 * Language resolution order (AC-202):
 *   Signed-out / app start:
 *     1. If a device-level language is stored (via devicePrefs.saveLanguage), use it.
 *     2. Otherwise apply AC-090 device locale detection (detectDeviceLanguage).
 *   Signed-in:
 *     loadLanguageForUser(userId) applies the per-user saved preference.
 *   Sign-out:
 *     applySignedOutLanguage() restores the device-level stored language (or
 *     device locale if nothing is stored).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enCommon from '../../locales/en/common.json';
import zhTWCommon from '../../locales/zh-TW/common.json';
import { loadLanguage } from './devicePrefs';

const SUPPORTED_LANGUAGES = ['en', 'zh-TW'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/**
 * Detect the best supported language from the device locale.
 * Falls back to zh-TW for any locale that is not English.
 */
function detectDeviceLanguage(): SupportedLanguage {
  const locales = getLocales();
  const deviceTag = locales[0]?.languageTag ?? 'zh-TW';

  if (deviceTag.startsWith('en')) {
    return 'en';
  }
  if (deviceTag === 'zh-TW' || deviceTag === 'zh-Hant') {
    return 'zh-TW';
  }
  // Fallback to zh-TW for any non-English locale
  return 'zh-TW';
}

const resources = {
  en: { common: enCommon },
  'zh-TW': { common: zhTWCommon },
} as const;

// Initialize synchronously so translations are available immediately.
// On first launch (no userId yet), the device locale is used as the language.
// Per-user language is applied later via loadLanguageForUser().
// Device-level stored language is applied after init completes (AC-202).
void i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: detectDeviceLanguage(),
    fallbackLng: 'zh-TW',
    defaultNS: 'common',
    ns: ['common'],
    interpolation: {
      escapeValue: false, // React handles XSS escaping
    },
    compatibilityJSON: 'v4',
  })
  .then(async () => {
    // After init, apply any device-level stored language; takes priority over
    // the device-locale default used at sync init time (AC-202).
    try {
      const stored = await loadLanguage();
      if (stored !== null && i18n.language !== stored) {
        await i18n.changeLanguage(stored);
      }
    } catch {
      // Non-fatal — device-locale default stays in effect
    }
  });

/**
 * Apply the persisted per-user language preference after auth resolves.
 *
 * Reads the user-scoped AsyncStorage key (`app_language_<userId>`). If a valid
 * saved language is found it calls i18n.changeLanguage() immediately. If nothing
 * is saved, the current language (set from device locale at startup) is left
 * unchanged — no crash, no fallback flip.
 *
 * Safe to call multiple times; subsequent calls with the same userId are
 * idempotent if the preference has not changed.
 */
export async function loadLanguageForUser(userId: string): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(`app_language_${userId}`);
    if (stored === 'en' || stored === 'zh-TW') {
      if (i18n.language !== stored) {
        await i18n.changeLanguage(stored);
      }
    }
  } catch {
    // Non-fatal — device-locale default stays in effect
  }
}

/**
 * Restore the correct language after a user signs out (AC-202).
 *
 * Reads the device-level stored language (written by MOD-010's SettingsScreen
 * just before signOut via devicePrefs.saveLanguage). If a language is stored,
 * applies it. If nothing is stored, falls back to AC-090 device detection so
 * the signed-out language matches what the app would have shown at first launch.
 *
 * Call this from AppShell when auth state changes to signed-out.
 */
export async function applySignedOutLanguage(): Promise<void> {
  try {
    const stored = await loadLanguage();
    const lang = stored ?? detectDeviceLanguage();
    if (i18n.language !== lang) {
      await i18n.changeLanguage(lang);
    }
  } catch {
    // Non-fatal — current language stays in effect
  }
}

export default i18n;
