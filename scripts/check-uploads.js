#!/usr/bin/env node
/**
 * Checks that no service file uses fetch()+response.blob() for Supabase Storage uploads.
 * All uploads must use expo-file-system's File.bytes() instead.
 * See project-planning/production.md Shared Conventions for the full rule.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Grep all TypeScript source files for response.blob() calls
try {
  const result = execSync(
    'grep -rn "response\\.blob\\(\\)\\|\\.blob()" src/ --include="*.ts" --include="*.tsx"',
    { encoding: 'utf8', cwd: path.join(__dirname, '..') }
  );
  if (result.trim()) {
    console.error('❌ check:uploads FAILED — fetch+blob() pattern found:');
    console.error(result);
    console.error('Use expo-file-system File.bytes() instead. See production.md Shared Conventions.');
    process.exit(1);
  }
} catch (e) {
  // grep exits 1 when no matches found — that is the success case
  if (e.status === 1 && !e.stdout.trim()) {
    console.log('✅ check:uploads OK — no fetch+blob() patterns found.');
    process.exit(0);
  }
  // Any other error
  console.error('check:uploads error:', e.message);
  process.exit(1);
}
