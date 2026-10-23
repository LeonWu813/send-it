/**
 * Custom `like` icon: a single front-view fist (v4, the raised-fist silhouette) (design system §9.12, the one approved exception to
 * "Ionicons only"). Geometry is copied verbatim from send-it-design/ux-team/icons/fistbump/*.svg
 * (512 grid, stroke 32, round caps/joins). Never flip or rotate it.
 * Minimum size 16pt. Outline = not liked, filled = liked. Decorative unless `accessibilityLabel` is given
 * (the pressable normally carries the label, e.g. the existing like label).
 */

import React from 'react';
import Svg, { Path } from 'react-native-svg';

const OUTLINE_D =
  'M80 216V164A44 44 0 0 1 168 164V216M168 216V124A44 44 0 0 1 256 124V216M256 216V132A44 44 0 0 1 344 132V216M344 208V172A44 44 0 0 1 432 172V208A44 44 0 0 1 344 208ZM80 216H308A36 36 0 0 1 308 288H284C252 288 236 312 236 344M80 216V302C80 392 150 432 256 432C362 432 432 392 432 302V208';
const FILLED_D =
  'M64 206V144.5A40.5 40.5 0 0 1 145 144.5V206ZM165 206V104.5A40.5 40.5 0 0 1 246 104.5V206ZM266 206V112.5A40.5 40.5 0 0 1 347 112.5V206ZM367 201.5V152.5A40.5 40.5 0 0 1 448 152.5V201.5A40.5 40.5 0 0 1 367 201.5ZM64 226H308A26 26 0 0 1 308 278H284C246 278 226 306 226 344A10 10 0 0 0 246 344C246 318 258 298 284 298H308A46 46 0 0 0 353.5 258.75A12 12 0 0 1 372.35 250.74A60.5 60.5 0 0 0 436.2 254.76A8 8 0 0 1 448 261.8V302C448 400 373 448 256 448C139 448 64 400 64 302Z';
const BURST_D =
  'M90 72L58 36M256 8L256 -40M422 72L454 36';

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
