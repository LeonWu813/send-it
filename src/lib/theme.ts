/**
 * Theme tokens and provider for Send It.
 *
 * Rules:
 * - All components must use tokens from this file — no hardcoded hex colors.
 * - Light and dark palettes are defined here; the active palette is chosen by
 *   useTheme() based on OS preference + any user override stored in settings.
 * - Color naming: semantic names (background, surface, text, primary, …),
 *   not descriptive hex names (blue500, gray100, …).
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Appearance, ColorSchemeName } from 'react-native';

// ─── Color palettes ───────────────────────────────────────────────────────────

const LIGHT_PALETTE = {
  // Backgrounds
  background: '#FFFFFF',
  surface: '#F5F5F5',
  surfaceElevated: '#FFFFFF',
  // Text
  textPrimary: '#111111',
  textSecondary: '#666666',
  textDisabled: '#AAAAAA',
  textInverse: '#FFFFFF',
  // Brand / action
  primary: '#1A73E8',
  primaryPressed: '#1558B0',
  primaryDisabled: '#A8C7FA',
  // Semantic
  success: '#1E8C45',
  warning: '#F9A825',
  error: '#D32F2F',
  // Borders & dividers
  border: '#E0E0E0',
  divider: '#F0F0F0',
  // Overlays
  overlay: 'rgba(0,0,0,0.4)',
  // Apple Sign-In button — must be black on white per HIG
  appleButton: '#000000',
  appleButtonText: '#FFFFFF',
};

const DARK_PALETTE = {
  // Backgrounds
  background: '#121212',
  surface: '#1E1E1E',
  surfaceElevated: '#2C2C2C',
  // Text
  textPrimary: '#F1F1F1',
  textSecondary: '#AAAAAA',
  textDisabled: '#555555',
  textInverse: '#111111',
  // Brand / action
  primary: '#4A90E2',
  primaryPressed: '#2D6CBE',
  primaryDisabled: '#1E3A5F',
  // Semantic
  success: '#4CAF50',
  warning: '#FFB300',
  error: '#EF5350',
  // Borders & dividers
  border: '#333333',
  divider: '#2A2A2A',
  // Overlays
  overlay: 'rgba(0,0,0,0.6)',
  // Apple Sign-In button — must be white on black in dark mode per HIG
  appleButton: '#FFFFFF',
  appleButtonText: '#000000',
};

export type ThemePalette = typeof LIGHT_PALETTE;

// ─── Spacing & typography scales ─────────────────────────────────────────────

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const FONT_SIZE = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  display: 32,
} as const;

export const FONT_WEIGHT = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

export const BORDER_RADIUS = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

// ─── Three-state theme override ───────────────────────────────────────────────

export type ThemeOverride = 'system' | 'light' | 'dark';

export interface Theme {
  colors: ThemePalette;
  spacing: typeof SPACING;
  fontSize: typeof FONT_SIZE;
  fontWeight: typeof FONT_WEIGHT;
  borderRadius: typeof BORDER_RADIUS;
  isDark: boolean;
}

// ─── Context ─────────────────────────────────────────────────────────────────

interface ThemeContextValue {
  theme: Theme;
  override: ThemeOverride;
  setOverride: (override: ThemeOverride) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function buildTheme(isDark: boolean): Theme {
  return {
    colors: isDark ? DARK_PALETTE : LIGHT_PALETTE,
    spacing: SPACING,
    fontSize: FONT_SIZE,
    fontWeight: FONT_WEIGHT,
    borderRadius: BORDER_RADIUS,
    isDark,
  };
}

function resolveScheme(
  override: ThemeOverride,
  systemScheme: ColorSchemeName,
): boolean {
  if (override === 'light') return false;
  if (override === 'dark') return true;
  // 'unspecified' — treat as light (safe default when OS preference is unknown)
  return systemScheme === 'dark';
}

// ─── Provider ────────────────────────────────────────────────────────────────

interface ThemeProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps): React.JSX.Element {
  const [override, setOverride] = useState<ThemeOverride>('system');
  const [systemScheme, setSystemScheme] = useState<ColorSchemeName>(
    Appearance.getColorScheme() ?? 'unspecified',
  );

  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme ?? 'unspecified');
    });
    return () => subscription.remove();
  }, []);

  const isDark = resolveScheme(override, systemScheme);
  const theme = buildTheme(isDark);

  return React.createElement(
    ThemeContext.Provider,
    { value: { theme, override, setOverride } },
    children,
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider.');
  }
  return context;
}
