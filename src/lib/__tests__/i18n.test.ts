/**
 * Tests for src/lib/i18n.ts
 *
 * Verifies that:
 * - i18n initializes successfully
 * - Both en and zh-TW catalogs are loaded
 * - All keys present in EN exist in zh-TW (key completeness check)
 */

import i18n from '../i18n';
import enCatalog from '../../../locales/en/common.json';
import zhTWCatalog from '../../../locales/zh-TW/common.json';

/**
 * Recursively collect all leaf key paths from a nested object.
 * e.g. { a: { b: 'x' } } → ['a.b']
 */
function collectKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return collectKeys(value as Record<string, unknown>, fullKey);
    }
    return [fullKey];
  });
}

describe('i18n initialization', () => {
  it('initializes without errors', () => {
    expect(i18n.isInitialized).toBe(true);
  });

  it('has English resource loaded', () => {
    expect(i18n.hasResourceBundle('en', 'common')).toBe(true);
  });

  it('has zh-TW resource loaded', () => {
    expect(i18n.hasResourceBundle('zh-TW', 'common')).toBe(true);
  });

  it('falls back to zh-TW', () => {
    const { fallbackLng } = i18n.options;
    // i18next may store fallbackLng as a string or array depending on version
    if (Array.isArray(fallbackLng)) {
      expect(fallbackLng).toContain('zh-TW');
    } else {
      expect(fallbackLng).toBe('zh-TW');
    }
  });
});

describe('i18n key completeness', () => {
  it('every English key has a zh-TW counterpart', () => {
    const enKeys = collectKeys(enCatalog as unknown as Record<string, unknown>);
    const zhTWKeys = new Set(
      collectKeys(zhTWCatalog as unknown as Record<string, unknown>),
    );

    const missingKeys = enKeys.filter((key) => !zhTWKeys.has(key));
    expect(missingKeys).toEqual([]);
  });
});
