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
 */

import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enCommon from '../../locales/en/common.json';
import zhTWCommon from '../../locales/zh-TW/common.json';

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

// Initialize synchronously so translations are available immediately
void i18n.use(initReactI18next).init({
  resources,
  lng: detectDeviceLanguage(),
  fallbackLng: 'zh-TW',
  defaultNS: 'common',
  ns: ['common'],
  interpolation: {
    escapeValue: false, // React handles XSS escaping
  },
  compatibilityJSON: 'v4',
});

export default i18n;
