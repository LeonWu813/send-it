/**
 * Theme tokens and provider for ProjectDay.
 *
 * Rules:
 * - All components must use tokens from this file — no hardcoded hex colors.
 * - Light and dark palettes are defined here; the active palette is chosen by
 *   useTheme() based on OS preference + any user override stored in settings.
 * - Color naming: semantic names (background, surface, text, primary, …),
 *   not descriptive hex names (blue500, gray100, …).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Appearance, ColorSchemeName, StyleSheet, useWindowDimensions } from 'react-native';

import { loadTheme } from './devicePrefs';

// ─── Color palettes ───────────────────────────────────────────────────────────
//
// Source of truth: send-it-design/ux-team/design-system/send-it-design-system.md (v1.1+,
// supersedes 07-final-design-system.md). Warm sand B neutrals. 58 keys (v2.2 adds `segmentedThumb`). Both palettes MUST
// have exactly the same keys (DARK_PALETTE is typed against ThemePalette).
//
// Usage rules (07 §2.4):
//  1. Gold (`sendFlash*`) belongs to flash sends only — never bookmarks/ratings/warnings.
//  2. Purple (`accentIllustration`) is ONLY the beta-video play disc. Never buttons,
//     selection, text, particles, toasts or pressed states.
//  3. `sendFlashBright` and `decorChalk` are decoration only (particles) — never text/icons.
//  4. Selected chip = textPrimary fill + background text (inverted). secondaryContainer =
//     TabBar selected pill. primary is never a selection fill (CTAs only).
//     `toastAction` only on `toastBackground`.
//     sendTopContainer: new-row highlight, celebration disc, and SendStatus (disc/tag) container.
//  5. Brand colours are never square-cornered labels (radius 6 (RADIUS.tape) + text = route tape only).
//  6. Pressed feedback never uses opacity — swap to the matching `*Pressed` colour
//     (`surfacePressed` on surface, `surfaceAltPressed` on background / secondary buttons).
//  7. Card-less lists (notifications, settings, followers): rows sit on `surface`, not on
//     the sand `background`.
//  8. Neutral notices use surfaceAlt; noticeContainer is for real warnings only.

export const LIGHT_PALETTE = {
  // Backgrounds
  background: '#F7ECDE',
  /** White card. NOTE: no longer a grey block — use `surfaceAlt` for that. */
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  /** Inputs, secondary buttons, chart tracks, in-card skeletons. */
  surfaceAlt: '#ECE1D3',
  /** Pressed card / row / IconButton disc (on `surface`). */
  surfacePressed: '#F1E7D8',
  /** Pressed state on `background` / on `surfaceAlt` (secondary Button). Same value as `border`. */
  surfaceAltPressed: '#D1C5B1',
  /** SegmentedControl thumb (dark theme also draws a 1pt `outline` ring). */
  segmentedThumb: '#FFFFFF',
  // Text
  textPrimary: '#201B12',
  textSecondary: '#4E4637',
  textPlaceholder: '#4E4637',
  textDisabled: 'rgba(32,27,18,0.38)',
  /** @deprecated use onPrimary / onError / onSendTop / onToast / onMedia. */
  textInverse: '#FFFFFF',
  // Borders & dividers
  border: '#D1C5B1',
  divider: '#ECE1D3',
  /** >= 3:1 UI boundary: unselected chip, grabber, input outline. */
  outline: '#807665',
  // Primary (the only interactive colour)
  primary: '#576411',
  onPrimary: '#FFFFFF',
  primaryPressed: '#4B5802',
  primaryDisabled: 'rgba(32,27,18,0.12)',
  primaryContainer: '#DBEB8A',
  onPrimaryContainer: '#181E00',
  primaryContainerPressed: '#CDDD7D',
  // Selected-state fill (always with a 1.5pt primary outline)
  secondaryContainer: '#E2E5C2',
  onSecondaryContainer: '#1A1D08',
  secondaryContainerPressed: '#D3D7B5',
  // Illustration purple — ONLY the beta-video play disc (no illustrations in this app)
  accentIllustration: '#947ED6',
  onAccentIllustration: '#FFFFFF',
  // Semantic
  success: '#006C4C',
  warning: '#9C450E',
  error: '#BA1A1A',
  onError: '#FFFFFF',
  errorPressed: '#A80710',
  errorContainer: '#FFDAD6',
  onErrorContainer: '#410002',
  noticeContainer: '#FFDBCB',
  onNoticeContainer: '#341100',
  noticeBorder: '#BB5C26',
  // Send styles
  sendFlash: '#7F5600',
  sendFlashContainer: '#FFDEAE',
  /** Particles only. */
  sendFlashBright: '#DDA031',
  sendTop: '#006C4C',
  onSendTop: '#FFFFFF',
  sendTopContainer: '#94F6CA',
  sendAttempt: '#4E4637',
  sendAttemptContainer: '#F1E7D8',
  // Toast (dark HUD in both themes)
  toastBackground: '#353026',
  onToast: '#FAEFE1',
  toastAction: '#BFCF71',
  toastBorder: 'rgba(0,0,0,0)',
  /** Chalk dust / particles only. */
  decorChalk: '#B3AA9D',
  // Media (Reel)
  mediaBackground: '#000000',
  onMedia: '#FFFFFF',
  mediaScrim: 'rgba(0,0,0,0.45)',
  mediaScrimStrong: 'rgba(0,0,0,0.6)',
  /** Progress-bar track on media (Phase 2 upload cells). */
  mediaTrack: 'rgba(255,255,255,0.3)',
  // Overlays
  overlay: 'rgba(0,0,0,0.32)',
  // Apple Sign-In button — must be black on white per HIG
  appleButton: '#000000',
  appleButtonText: '#FFFFFF',
};

export type ThemePalette = typeof LIGHT_PALETTE;
export type PaletteKey = keyof ThemePalette;

export const DARK_PALETTE: ThemePalette = {
  background: '#17130A',
  surface: '#241F16',
  surfaceElevated: '#2F2920',
  surfaceAlt: '#3A342A',
  surfacePressed: '#3A342A',
  surfaceAltPressed: '#4E4637',
  segmentedThumb: '#4E4637',
  textPrimary: '#ECE1D3',
  textSecondary: '#D1C5B1',
  textPlaceholder: '#D1C5B1',
  textDisabled: 'rgba(236,225,211,0.38)',
  /** @deprecated use onPrimary / onError / onSendTop / onToast / onMedia. */
  textInverse: '#17130A',
  border: '#4E4637',
  divider: '#2F2920',
  outline: '#9A8F7E',
  primary: '#BFCF71',
  onPrimary: '#2C3400',
  primaryPressed: '#B1C164',
  primaryDisabled: 'rgba(236,225,211,0.12)',
  primaryContainer: '#404C00',
  onPrimaryContainer: '#DBEB8A',
  primaryContainerPressed: '#4B5802',
  secondaryContainer: '#45492F',
  onSecondaryContainer: '#E2E5C2',
  secondaryContainerPressed: '#51553A',
  accentIllustration: '#B49DF8',
  onAccentIllustration: '#17130A',
  success: '#78D9AF',
  warning: '#FFB692',
  error: '#FF897D',
  onError: '#690005',
  errorPressed: '#FF7164',
  errorContainer: '#93000A',
  onErrorContainer: '#FFDAD6',
  noticeContainer: '#793000',
  onNoticeContainer: '#FFDBCB',
  noticeBorder: '#DB753D',
  sendFlash: '#FFCC7D',
  sendFlashContainer: '#604100',
  sendFlashBright: '#FFCC7D',
  sendTop: '#78D9AF',
  onSendTop: '#003826',
  sendTopContainer: '#005139',
  sendAttempt: '#D1C5B1',
  sendAttemptContainer: '#3A342A',
  toastBackground: '#3E382E',
  onToast: '#FAEFE1',
  toastAction: '#BFCF71',
  toastBorder: '#9A8F7E',
  decorChalk: '#ECE1D3',
  mediaBackground: '#000000',
  onMedia: '#FFFFFF',
  mediaScrim: 'rgba(0,0,0,0.45)',
  mediaScrimStrong: 'rgba(0,0,0,0.6)',
  mediaTrack: 'rgba(255,255,255,0.3)',
  overlay: 'rgba(0,0,0,0.32)',
  // Apple Sign-In button — must be white on black in dark mode per HIG
  appleButton: '#FFFFFF',
  appleButtonText: '#000000',
};

// ─── Spacing, layout & typography scales ─────────────────────────────────────

export const SPACING = {
  xxs: 2,
  xs: 4,
  sm: 8,
  smd: 12,
  md: 16,
  mdl: 20,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const LAYOUT = {
  /** Screen side margin: 16 below `largeWidthBreakpoint`, 20 at/above it. Use useLayout(). */
  screenMarginCompact: 16,
  screenMarginLarge: 20,
  largeWidthBreakpoint: 428,
  cardPadding: 16,
  cardGap: 12,
  listRowPaddingV: 14,
  listRowMinHeight: 52,
  sectionGap: 24,
  sectionHeaderGap: 8,
  inlineGap: 8,
  iconTextGap: 4,
  iconTextGapInButton: 8,
  stackTight: 2,
  headerContentHeight: 44,
  /** Touch targets must be >= 44 (visual may be smaller; container + hitSlop >= 44, no overlap). */
  minTouchTarget: 44,
  gridColumns: 4,
  gridGutter: 12,
  mediaGridGapFull: 2,
  mediaGridGapInset: 2,
  /** RouteCard inner padding (thumbnail radius = innerRadius(card, 8)). */
  routeCardPadding: 8,
  /** Floating BottomSheet inset from the screen edges. */
  sheetInset: 8,
  /** Gap between grouped-form fields. */
  fieldGap: 16,
  /** Below this width: RouteCard thumb 64, StatsPanel 1:1. */
  compactWidthBreakpoint: 360,
} as const;

export const ICON_SIZE = {
  xs: 14,
  sm: 16,
  md: 20,
  lg: 24,
  tab: 24,
  xl: 28,
} as const;

export const COMPONENT_SIZE = {
  grabberWidth: 36,
  grabberHeight: 5,
  grabberTopOffset: 8,
  sheetDragZoneHeight: 24,
  toastMinHeight: 48,
  toastOffsetAboveTabBar: 8,
  progressBarHeight: 6,
  statsBarHeight: 6,
  badgeMinSize: 16,
  quickLogButton: 44,
  celebrationIconContainer: 44,
  playDisc: 24,
  playDiscRing: 1.5,
  /** @deprecated v2.2 chips have no outline. */
  chipSelectedBorder: 1.5,
  /** @deprecated v2.2 chips have no outline. */
  chipBorder: 1,
  chipHeight: 36,
  /** Button `md` minHeight. */
  buttonMinHeight: 44,
  /** Button `lg` minHeight. */
  buttonPrimaryMinHeight: 52,
  /** Button `sm` (hitSlop 6 top/bottom brings the touch target to 44). */
  buttonSmMinHeight: 32,
  textFieldMinHeight: 48,
  emptyStateMaxWidth: 320,
  radioSize: 20,
  radioDot: 10,
  /** InlineError block / NoticeBox left bar (a filled child View, never borderLeftWidth). */
  noticeBarWidth: 4,
  tapeSwatch: 14,
  /** @deprecated use RADIUS.minor. */
  tapeSwatchRadius: 3,
  /** TapeBadge horizontal padding per size. */
  tapePadH: { sm: 6, md: 8, lg: 10 },
  /** TapeBadge minHeight per size. */
  tapeHeight: { sm: 20, md: 24, lg: 34 },
  segmentedHeight: { compact: 32, standard: 36, icon: 68 },
  tabBarHeight: 64,
  tabItemWidth: 88,
  headerActionGroup: { width: 96, height: 44, gap: 8 },
  /** Sheet close button, FilterChip clear button. */
  smallButton: 30,
  /** Reel back button. */
  mediaButton: 32,
  sendStatusDisc: 28,
  sendStatusTag: 24,
  routeThumb: 88,
  routeThumbCompact: 64,
  listThumb: 56,
  uploadThumb: { width: 60, height: 80 },
  searchFieldHeight: 44,
  stepperHeight: 56,
  stepperMin: 1,
  stepperMax: 9999,
  unreadDot: 8,
  mediaTileAspect: 0.75,
  statsPrimaryMinHeight: 176,
  /** Floating sheet grabber toggles to bottom-attached above this share of the window height. */
  sheetFloatMaxHeightRatio: 0.6,
  /** Reel double-tap heart. */
  likeBurst: 84,
} as const;

/** Line widths. Only these three are allowed. */
export const STROKE = {
  hairline: StyleSheet.hairlineWidth,
  thin: 1,
  emphasis: 1.5,
} as const;

export const AVATAR_SIZE = {
  xs: 24,
  sm: 32,
  md: 48,
  lg: 64,
  xl: 96,
} as const;

export interface ElevationStyle {
  shadowColor: string;
  shadowOpacity: number;
  shadowRadius: number;
  shadowOffset: { width: number; height: number };
  /** Android only. */
  elevation: number;
}

const NO_SHADOW: ElevationStyle = {
  shadowColor: '#000',
  shadowOpacity: 0,
  shadowRadius: 0,
  shadowOffset: { width: 0, height: 0 },
  elevation: 0,
};

/** Light theme shadows. Dark theme uses NO shadow: use a 1px border (`border` / `toastBorder`). */
export const ELEVATION = {
  /** Toast, celebration card, floating surfaces. */
  raised: {
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  } as ElevationStyle,
  /** Very light card shadow (light theme cards use this instead of a border). */
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  } as ElevationStyle,
  /** Small floating controls: float IconButton, SegmentedControl thumb. */
  control: {
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  } as ElevationStyle,
};

export const ELEVATION_DARK: typeof ELEVATION = { raised: NO_SHADOW, card: NO_SHADOW, control: NO_SHADOW };

const FW = { w400: '400', w500: '500', w600: '600', w700: '700', w800: '800' } as const;

export interface TypeStyle {
  fontSize: number;
  lineHeight: number;
  fontWeight: '400' | '500' | '600' | '700' | '800';
  maxFontSizeMultiplier: number;
}

/** System font (SF Pro / PingFang TC). letterSpacing is always 0. CJK-safe line heights. */
export const TYPE_SCALE = {
  /** Latin digits / difficulty only (StatsPanel primary number). Always `numeric`. */
  display: { fontSize: 72, lineHeight: 76, fontWeight: FW.w700, maxFontSizeMultiplier: 1.2 },
  largeTitle: { fontSize: 34, lineHeight: 44, fontWeight: FW.w700, maxFontSizeMultiplier: 1.3 },
  /** Numbers only (StatsPanel secondary numbers). */
  numeric1: { fontSize: 34, lineHeight: 40, fontWeight: FW.w700, maxFontSizeMultiplier: 1.3 },
  title1: { fontSize: 28, lineHeight: 38, fontWeight: FW.w700, maxFontSizeMultiplier: 1.3 },
  title2: { fontSize: 22, lineHeight: 30, fontWeight: FW.w700, maxFontSizeMultiplier: 1.5 },
  title3: { fontSize: 20, lineHeight: 28, fontWeight: FW.w600, maxFontSizeMultiplier: 1.5 },
  headline: { fontSize: 17, lineHeight: 24, fontWeight: FW.w600, maxFontSizeMultiplier: 2.0 },
  body: { fontSize: 17, lineHeight: 26, fontWeight: FW.w400, maxFontSizeMultiplier: 2.0 },
  callout: { fontSize: 16, lineHeight: 24, fontWeight: FW.w400, maxFontSizeMultiplier: 2.0 },
  subhead: { fontSize: 15, lineHeight: 22, fontWeight: FW.w400, maxFontSizeMultiplier: 2.0 },
  footnote: { fontSize: 13, lineHeight: 20, fontWeight: FW.w400, maxFontSizeMultiplier: 1.6 },
  /** Smallest size for Chinese metadata. */
  caption1: { fontSize: 12, lineHeight: 18, fontWeight: FW.w400, maxFontSizeMultiplier: 1.6 },
  /** Numbers / Latin only: badges, chart axes (tape labels use caption1). */
  caption2: { fontSize: 11, lineHeight: 16, fontWeight: FW.w500, maxFontSizeMultiplier: 1.4 },
} as const satisfies Record<string, TypeStyle>;

export type TypeVariant = keyof typeof TYPE_SCALE;

const GROUP_HEADER = {
  base: 'footnote' as TypeVariant,
  fontWeight: FW.w600,
  color: 'textSecondary' as PaletteKey,
  enUppercase: true,
  enLetterSpacing: 0.5,
};

export const TYPE_VARIANT = {
  /** footnote + 600 + textSecondary; English UI also uppercases with letterSpacing 0.5 (not Chinese). Grouped-list header only. */
  groupHeader: GROUP_HEADER,
  /** @deprecated renamed `groupHeader` (v2.0). Kept one version as an alias. */
  sectionHeader: GROUP_HEADER,
  /** Page section title: title3 20/28 600 textPrimary. */
  pageSection: { base: 'title3' as TypeVariant, fontWeight: FW.w600, color: 'textPrimary' as PaletteKey },
  /** Unit next to a number: half the size of the number role, 400 textSecondary. Same Text node. */
  unit: {
    fontWeight: FW.w400,
    color: 'textSecondary' as PaletteKey,
    /** number role -> unit role (rounded to an existing role). */
    roleFor: { display: 'headline', numeric1: 'headline', title1: 'subhead' } as Record<string, TypeVariant>,
  },
  /** TapeBadge only. The one allowed non-title use of 700/800 (spec H.2 A9). */
  tapeLabel: {
    lg: { fontSize: 24, lineHeight: 30, fontWeight: FW.w800, maxFontSizeMultiplier: 1.5 },
    md: { fontSize: 13, lineHeight: 18, fontWeight: FW.w800, maxFontSizeMultiplier: 1.6 },
    sm: { fontSize: 12, lineHeight: 16, fontWeight: FW.w700, maxFontSizeMultiplier: 1.6 },
    numeric: true,
  },
  /** TextField label: subhead 600 textPrimary. */
  fieldLabel: { base: 'subhead' as TypeVariant, fontWeight: FW.w600, color: 'textPrimary' as PaletteKey },
  numeric: { fontVariant: ['tabular-nums'] as 'tabular-nums'[] },
} as const;

/** @deprecated Use TYPE_SCALE / <AppText variant>. Kept until all modules migrate. */
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
  /** TapeBadge `tapeLabel` only. */
  heavy: '800' as const,
};

/**
 * Radius ROLES (v2.2, spec section 5). One value per role. All containers >= 12 also set
 * `borderCurve: 'continuous'` (see `CONTINUOUS`).
 */
export const RADIUS = {
  /** Small parts, tape swatch, skeleton text lines, innerRadius fallback. */
  minor: 4,
  /** TapeBadge only. */
  tape: 6,
  /** Rectangular controls: TextField, stepper, notices. */
  control: 12,
  /** Media: list thumbnails, upload thumb, inset video grid outer corners. */
  media: 12,
  /** Containers: Card, grouped list, RouteCard, block error, EmptyState, upload modal. */
  card: 20,
  /** Screen-level panels (fixed value, not derived). */
  sheet: 32,
  /** Capsules and circles: buttons, chips, segmented, avatar, single-line toast, TabBar. */
  full: 9999,
} as const;

/**
 * Concentric inner radius (WWDC25 356). Use when the gap between inner and outer corner is
 * < outer / 2; otherwise the inner element uses its own role. Fallback RADIUS.minor so nested
 * corners never go square.
 */
export function innerRadius(outer: number, gap: number): number {
  return Math.max(outer - gap, RADIUS.minor);
}

/** Spread into any container with a radius >= 12. react-native-web ignores it. */
export const CONTINUOUS = { borderCurve: 'continuous' } as const;

/**
 * @deprecated Use RADIUS roles. Values stay at v1.2 until all modules migrate.
 * sm = route tape / thumbnail corners only; full = chips, avatars, badges.
 */
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
  /** @deprecated use typeScale. */
  fontSize: typeof FONT_SIZE;
  fontWeight: typeof FONT_WEIGHT;
  /** @deprecated use `radius`. */
  borderRadius: typeof BORDER_RADIUS;
  radius: typeof RADIUS;
  typeScale: typeof TYPE_SCALE;
  typeVariant: typeof TYPE_VARIANT;
  layout: typeof LAYOUT;
  iconSize: typeof ICON_SIZE;
  elevation: typeof ELEVATION;
  componentSize: typeof COMPONENT_SIZE;
  stroke: typeof STROKE;
  avatarSize: typeof AVATAR_SIZE;
  isDark: boolean;
}

// ─── Context ─────────────────────────────────────────────────────────────────

interface ThemeContextValue {
  theme: Theme;
  override: ThemeOverride;
  setOverride: (override: ThemeOverride) => void;
  /**
   * Called once the authenticated userId is known (e.g. from AppShell on mount).
   * ThemeProvider loads and persists the user-scoped theme override key
   * (app_theme_override_<userId>) from that point forward.
   * Pass null on sign-out to restore the device-level stored theme immediately
   * (AC-203). When userId is null, the provider falls back to the device-level
   * stored theme with no per-user AsyncStorage key.
   */
  setThemeUserId: (userId: string | null) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function buildTheme(isDark: boolean): Theme {
  return {
    colors: isDark ? DARK_PALETTE : LIGHT_PALETTE,
    spacing: SPACING,
    fontSize: FONT_SIZE,
    fontWeight: FONT_WEIGHT,
    borderRadius: BORDER_RADIUS,
    radius: RADIUS,
    typeScale: TYPE_SCALE,
    typeVariant: TYPE_VARIANT,
    layout: LAYOUT,
    iconSize: ICON_SIZE,
    elevation: isDark ? ELEVATION_DARK : ELEVATION,
    componentSize: COMPONENT_SIZE,
    stroke: STROKE,
    avatarSize: AVATAR_SIZE,
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
  // userId is set by AppShell once the session is known (Option B: per-user keys).
  // When null (unauthenticated), no AsyncStorage reads or writes are performed.
  const [userId, setUserId] = useState<string | null>(null);

  // When userId becomes known, load the user-scoped theme override preference.
  // When userId is null (signed-out / app start), load the device-level stored
  // theme so the signed-out experience respects the user's last chosen theme
  // (AC-203). Falls back to 'system' (device appearance) when nothing is stored.
  useEffect(() => {
    if (userId === null) {
      // Unauthenticated — apply device-level stored theme preference (AC-203).
      // If stored is 'light' or 'dark', use it. 'system' or null → follow device.
      async function loadSignedOutTheme(): Promise<void> {
        try {
          const stored = await loadTheme();
          const themeToApply: ThemeOverride =
            stored === 'light' || stored === 'dark' ? stored : 'system';
          setOverride(themeToApply);
        } catch {
          // Non-fatal — default to system (device appearance)
          setOverride('system');
        }
      }
      void loadSignedOutTheme();
      return;
    }

    async function loadSavedOverride(): Promise<void> {
      try {
        const key = `app_theme_override_${userId}`;
        const saved = await AsyncStorage.getItem(key);
        if (saved === 'light' || saved === 'dark' || saved === 'system') {
          setOverride(saved);
        }
      } catch {
        // ignore — default to system
      }
    }
    void loadSavedOverride();
  }, [userId]);

  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme ?? 'unspecified');
    });
    return () => subscription.remove();
  }, []);

  function setThemeUserId(newUserId: string | null): void {
    setUserId(newUserId);
  }

  const isDark = resolveScheme(override, systemScheme);
  const theme = buildTheme(isDark);

  return React.createElement(
    ThemeContext.Provider,
    { value: { theme, override, setOverride, setThemeUserId } },
    children,
  );
}

// ─── Hooks ──

/**
 * Responsive screen margin (16 below 428pt wide, 20 at/above). Never reads Dimensions at
 * module load time.
 */
export function useLayout(): { screenMargin: number; width: number; isLarge: boolean } {
  const { width } = useWindowDimensions();
  const isLarge = width >= LAYOUT.largeWidthBreakpoint;
  return {
    screenMargin: isLarge ? LAYOUT.screenMarginLarge : LAYOUT.screenMarginCompact,
    width,
    isLarge,
  };
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider.');
  }
  return context;
}
