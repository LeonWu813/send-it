#!/usr/bin/env node
/**
 * i18n completeness check.
 *
 * Verifies that every leaf key present in locales/en/common.json has a
 * corresponding entry in locales/zh-TW/common.json, and vice versa.
 *
 * Exits 0 if all keys are present in both files.
 * Exits 1 and prints missing keys if any are absent.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const EN_FILE = path.resolve(__dirname, '../locales/en/common.json');
const ZH_TW_FILE = path.resolve(__dirname, '../locales/zh-TW/common.json');

/**
 * Recursively collect all leaf key paths from an object.
 * Returns a Set of dot-joined paths, e.g. "settings.language.en".
 *
 * @param {unknown} obj
 * @param {string} prefix
 * @returns {Set<string>}
 */
function collectLeafKeys(obj, prefix) {
  const keys = new Set();
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    // Leaf value — emit the prefix as the key path
    keys.add(prefix);
    return keys;
  }

  for (const [key, value] of Object.entries(obj)) {
    const fullPath = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // Recurse into nested object
      for (const childKey of collectLeafKeys(value, fullPath)) {
        keys.add(childKey);
      }
    } else {
      // Leaf value (string, number, array, null)
      keys.add(fullPath);
    }
  }

  return keys;
}

function loadJson(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    console.error(`Failed to load ${filePath}: ${err.message}`);
    process.exit(1);
  }
}

const enData = loadJson(EN_FILE);
const zhTWData = loadJson(ZH_TW_FILE);

const enKeys = collectLeafKeys(enData, '');
const zhTWKeys = collectLeafKeys(zhTWData, '');

/** Keys in en but missing from zh-TW */
const missingInZhTW = [...enKeys].filter((k) => !zhTWKeys.has(k));
/** Keys in zh-TW but missing from en */
const missingInEn = [...zhTWKeys].filter((k) => !enKeys.has(k));

let hasError = false;

if (missingInZhTW.length > 0) {
  hasError = true;
  console.error('Keys present in en but missing from zh-TW:');
  for (const key of missingInZhTW) {
    console.error(`  - ${key}`);
  }
}

if (missingInEn.length > 0) {
  hasError = true;
  console.error('Keys present in zh-TW but missing from en:');
  for (const key of missingInEn) {
    console.error(`  - ${key}`);
  }
}

if (hasError) {
  process.exit(1);
} else {
  console.log('i18n completeness OK');
  process.exit(0);
}
