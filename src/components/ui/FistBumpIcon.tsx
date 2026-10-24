/**
 * Custom `like` icon: a single front-view fist (v5, chunky raised fist with wrist) (design system §9.12, the one approved exception to
 * "Ionicons only"). Geometry is copied verbatim from send-it-design/ux-team/icons/fistbump/v5/*.svg
 * (512 grid, stroke 32, round caps/joins). Never flip or rotate it.
 * Minimum size 16pt. Outline = not liked, filled = liked. Decorative unless `accessibilityLabel` is given
 * (the pressable normally carries the label, e.g. the existing like label).
 */

import React from 'react';
import Svg, { Path } from 'react-native-svg';

const OUTLINE_D =
  'M80 196V128A20 20 0 0 1 100 108H148A20 20 0 0 1 168 128V196M168 196V108A20 20 0 0 1 188 88H236A20 20 0 0 1 256 108V196M256 196V116A20 20 0 0 1 276 96H324A20 20 0 0 1 344 116V196M344 196V140A20 20 0 0 1 364 120H412A20 20 0 0 1 432 140V196M80 196H432M272 196A48 48 0 0 1 272 292H172M80 196V304C80 340 120 360 164 372V432H348V372C392 360 432 340 432 304V196';
const FILLED_D =
  'M64 180V120A28 28 0 0 1 92 92H114A28 28 0 0 1 142 120V180ZM166 180V100A28 28 0 0 1 194 72H216A28 28 0 0 1 244 100V180ZM268 180V108A28 28 0 0 1 296 80H318A28 28 0 0 1 346 108V180ZM370 180V132A28 28 0 0 1 398 104H420A28 28 0 0 1 448 132V180ZM72 204H272A44 44 0 0 1 272 292H168A12 12 0 0 0 168 316H272A68 68 0 0 0 340 248V212A8 8 0 0 1 348 204H440A8 8 0 0 1 448 212V304C448 350 404 372 364 384V436A12 12 0 0 1 352 448H160A12 12 0 0 1 148 436V384C108 372 64 350 64 304V212A8 8 0 0 1 72 204Z';
const BURST_D =
  'M205 32V-16M64 56L32 20M440 68L472 32';

export type FistBumpVariant = 'outline' | 'filled';

export interface FistBumpIconProps {
  variant?: FistBumpVariant;
  size: number;
  color: string;
  /** Omit for a decorative icon (hidden from screen readers). */
  accessibilityLabel?: string;
}

export function FistBumpIcon({ variant = 'outline', size, color, accessibilityLabel }: FistBumpIconProps): React.JSX.Element {
  const a11y = accessibilityLabel
    ? ({ role: 'img', 'aria-label': accessibilityLabel } as const)
    : ({ 'aria-hidden': true } as const);
  return (
    <Svg width={size} height={size} viewBox="0 0 512 512" {...a11y}>
      {variant === 'outline' ? (
        <Path d={OUTLINE_D} fill="none" stroke={color} strokeWidth={32} strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <Path d={FILLED_D} fill={color} />
      )}
    </Svg>
  );
}

export interface FistBumpBurstProps {
  /** The ICON size the burst is laid over (not the burst's own size). */
  size: number;
  color: string;
}

/**
 * The 3 like-animation ticks, radiating up from the knuckles. Rendered at 1.5x `size`, absolutely positioned at -size/4 so it centres on
 * the icon; place it inside a `position: relative` wrapper the size of the icon. The caller owns the
 * 200ms keyframes and must skip it under Reduce Motion.
 */
export function FistBumpBurst({ size, color }: FistBumpBurstProps): React.JSX.Element {
  return (
    <Svg
      width={size * 1.5}
      height={size * 1.5}
      viewBox="-128 -128 768 768"
      aria-hidden
      style={{ position: 'absolute', left: -size / 4, top: -size / 4, pointerEvents: 'none' }}
    >
      <Path d={BURST_D} fill="none" stroke={color} strokeWidth={32} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
