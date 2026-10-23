/**
 * Custom `like` icon: a single side-view fist (design system §9.12, the one approved exception to
 * "Ionicons only"). Geometry is copied verbatim from send-it-design/ux-team/icons/fistbump/*.svg
 * (512 grid, stroke 32, round caps/joins). Fist faces LEFT globally; never flip or rotate it.
 * Minimum size 16pt. Outline = not liked, filled = liked. Decorative unless `accessibilityLabel` is given
 * (the pressable normally carries the label, e.g. the existing like label).
 */

import React from 'react';
import Svg, { Path } from 'react-native-svg';

const OUTLINE_D =
  'M192 402C192 402 208 408 256 408C304 408 330 392 352 376H416A64 64 0 0 0 480 312V264A64 64 0 0 0 416 200H386C362 200 354 176 344 152C334 128 312 104 272 104H144A24 24 0 0 0 120 128V150M96 215L176 213C196 211.16 208 200.6 208 183C208 165.4 194 154.16 176 153L96 149C78.4 149 64 165.4 64 183A32 32 0 0 0 96 215ZM64 280L176 278C194 277.16 208 265.59 208 248C208 230.39 194 219.14 176 218L64 216A32.1 32.1 0 0 0 32 248A32.1 32.1 0 0 0 64 280ZM80 344L176 342C195 341.16 208 329.6 208 312C208 294.4 195 283.16 176 282L80 280A32.09 32.09 0 0 0 48 312A32.09 32.09 0 0 0 80 344ZM112 408L176 405C197 403.16 208 393.6 208 376C208 358.4 193.6 346 176 346L112 344A32.09 32.09 0 0 0 80 376A32.09 32.09 0 0 0 112 408Z';
const FILLED_D =
  'M272 88H120A16 16 0 0 0 120 120H196A48 48 0 0 1 225.33 206A48 48 0 0 1 225.33 282A48 48 0 0 1 225.33 358A48 48 0 0 1 244 396A28 28 0 0 0 272 424C312 424 334 405 352 392H416A80 80 0 0 0 496 312V264A80 80 0 0 0 416 184H386C371 184 368 168 359 146C348 119 320 88 272 88ZM196 140H76A28 28 0 0 0 76 196H196A28 28 0 0 0 196 140ZM196 216H44A28 28 0 0 0 44 272H196A28 28 0 0 0 196 216ZM196 292H60A28 28 0 0 0 60 348H196A28 28 0 0 0 196 292ZM196 368H92A28 28 0 0 0 92 424H196A28 28 0 0 0 196 368Z';
const BURST_D = 'M-36 278H-84M0 178L-36 147M0 378L-36 409';

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
 * The 3 like-animation ticks. Rendered at 1.5x `size`, absolutely positioned at -size/4 so it centres on
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
