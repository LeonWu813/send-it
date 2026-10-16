import React, { useEffect } from 'react';

import { ThemeProvider, useTheme } from '../src/lib/theme';

function Apply({ mode, children }: { mode: 'light' | 'dark'; children: React.ReactNode }): React.JSX.Element | null {
  const { override, setOverride } = useTheme();
  useEffect(() => {
    if (override !== mode) setOverride(mode);
  }, [override, mode, setOverride]);
  return override === mode ? <>{children}</> : null;
}

/**
 * Wraps children in a (nested) real ThemeProvider forced to `mode`, using the
 * provider's public setOverride(). Use it to show light AND dark side by side.
 */
export function ForcedTheme({ mode, children }: { mode: 'light' | 'dark'; children: React.ReactNode }): React.JSX.Element {
  return (
    <ThemeProvider>
      <Apply mode={mode}>{children}</Apply>
    </ThemeProvider>
  );
}
