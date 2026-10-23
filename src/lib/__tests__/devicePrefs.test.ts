/**
 * Tests for src/lib/devicePrefs.ts (AC-202/AC-203)
 *
 * Verifies that device-level save/load helpers for language and theme:
 * - return null when nothing is stored
 * - correctly round-trip each valid value
 * - overwrite previous values
 * - return null (not throw) for unrecognized stored values
 * - propagate storage write errors
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { loadLanguage, loadTheme, saveLanguage, saveTheme } from '../devicePrefs';

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

// ─── saveLanguage / loadLanguage ─────────────────────────────────────────────

describe('saveLanguage / loadLanguage', () => {
  it('returns null when nothing is stored', async () => {
    const result = await loadLanguage();
    expect(result).toBeNull();
  });

  it('saves and loads "en"', async () => {
    await saveLanguage('en');
    const result = await loadLanguage();
    expect(result).toBe('en');
  });

  it('saves and loads "zh-TW"', async () => {
    await saveLanguage('zh-TW');
    const result = await loadLanguage();
    expect(result).toBe('zh-TW');
  });

  it('overwrites the previous value when called again', async () => {
    await saveLanguage('en');
    await saveLanguage('zh-TW');
    const result = await loadLanguage();
    expect(result).toBe('zh-TW');
  });

  it('returns null for an unrecognized stored value', async () => {
    await AsyncStorage.setItem('device_language', 'fr');
    const result = await loadLanguage();
    expect(result).toBeNull();
  });

  it('throws when AsyncStorage.setItem fails', async () => {
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('disk full'));
    await expect(saveLanguage('en')).rejects.toThrow('Failed to save language preference.');
  });
});

// ─── saveTheme / loadTheme ───────────────────────────────────────────────────

describe('saveTheme / loadTheme', () => {
  it('returns null when nothing is stored', async () => {
    const result = await loadTheme();
    expect(result).toBeNull();
  });

  it('saves and loads "light"', async () => {
    await saveTheme('light');
    const result = await loadTheme();
    expect(result).toBe('light');
  });

  it('saves and loads "dark"', async () => {
    await saveTheme('dark');
    const result = await loadTheme();
    expect(result).toBe('dark');
  });

  it('saves and loads "system"', async () => {
    await saveTheme('system');
    const result = await loadTheme();
    expect(result).toBe('system');
  });

  it('overwrites the previous value when called again', async () => {
    await saveTheme('dark');
    await saveTheme('light');
    const result = await loadTheme();
    expect(result).toBe('light');
  });

  it('returns null for an unrecognized stored value', async () => {
    await AsyncStorage.setItem('device_theme', 'custom-theme');
    const result = await loadTheme();
    expect(result).toBeNull();
  });

  it('throws when AsyncStorage.setItem fails', async () => {
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('disk full'));
    await expect(saveTheme('dark')).rejects.toThrow('Failed to save theme preference.');
  });
});
