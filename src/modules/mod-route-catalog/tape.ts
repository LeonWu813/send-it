/**
 * Route tape display colours (design system v1.2 section 1.5 / A.2).
 *
 * Display only: the database and API keep storing the CSS colour names (`RouteColor`).
 * Tape colours are physical colours, not palette tokens, so they live here and are the
 * only place hex values for tape are allowed. Label colours are fixed (`#1D1B15` / `#FFFFFF`)
 * and do not follow the theme.
 */

import type { RouteColor } from './types';

export interface TapeDisplayEntry {
  fill: string;
  label: string;
}

const INK = '#1D1B15';
const WHITE = '#FFFFFF';

export const TAPE_DISPLAY: {
  light: Record<RouteColor, TapeDisplayEntry>;
  dark: Record<RouteColor, TapeDisplayEntry>;
} = {
  light: {
    red: { fill: '#EB4C46', label: INK },
    orange: { fill: '#F08A24', label: INK },
    yellow: { fill: '#F2CC2E', label: INK },
    green: { fill: '#2E9B4E', label: INK },
    blue: { fill: '#2F6CD8', label: WHITE },
    purple: { fill: '#8B3FA5', label: WHITE },
    pink: { fill: '#F2A0BC', label: INK },
    white: { fill: '#C9C3B8', label: INK },
    black: { fill: '#26241F', label: WHITE },
  },
  dark: {
    red: { fill: '#EF5B4B', label: INK },
    orange: { fill: '#F59A3A', label: INK },
    yellow: { fill: '#FAE319', label: INK },
    green: { fill: '#3FAE5E', label: INK },
    blue: { fill: '#4E86EA', label: INK },
    purple: { fill: '#9A52B8', label: WHITE },
    pink: { fill: '#F4AFC6', label: INK },
    white: { fill: '#F2EFE8', label: INK },
    black: { fill: '#0B0A08', label: WHITE },
  },
};

/**
 * Resolve display values for a stored colour name. Unknown colours (bad data / new colour)
 * return `known: false`; the caller supplies `surfaceAlt` / `textPrimary` and the "Other" label.
 */
export function resolveTape(
  mode: 'light' | 'dark',
  color: string,
): { known: true; entry: TapeDisplayEntry } | { known: false } {
  const entry = (TAPE_DISPLAY[mode] as Record<string, TapeDisplayEntry | undefined>)[color];
  return entry ? { known: true, entry } : { known: false };
}
