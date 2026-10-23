import React, { useMemo } from 'react';

import { buildTheme, ThemeContext, ThemeProvider, useTheme } from '../src/lib/theme';

function Force({ mode, children }: { mode: 'light' | 'dark'; children: React.ReactNode }): React.JSX.Element {
  const base = useTheme();
  // Provide the forced theme synchronously on first render. The real ThemeProvider
  // loads the stored theme asynchronously and would otherwise overwrite a forced
  // override after mount (and gating render on it blanked the story).
  const value = useMemo(
    () => ({ ...base, theme: buildTheme(mode === 'dark'), override: mode }),
    [base, mode],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * Wraps children in a theme forced to `mode` (always rendered, never blank). Use it to
 * show light AND dark side by side.
 */
export function ForcedTheme({ mode, children }: { mode: 'light' | 'dark'; children: React.ReactNode }): React.JSX.Element {
  return (
    <ThemeProvider>
      <Force mode={mode}>{children}</Force>
    </ThemeProvider>
  );
}
