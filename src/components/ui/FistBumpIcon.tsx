/**
 * Custom `like` icon (v6): a side-view RIGHT fist, knuckles facing left (design system §9.12, the one approved exception to
 * "Ionicons only"). Geometry is copied verbatim from send-it-design/ux-team/icons/fistbump/v6/*.svg
 * (512 grid, stroke 32, round caps/joins). Never flip or rotate it.
 * Minimum size 16pt. Outline = not liked, filled = liked. Filled is only drawn at >= 20pt; below that it renders the outline.
 * Decorative unless `accessibilityLabel` is given (the pressable normally carries the label).
 * The animated like (left fist + ticks) is `FistBumpLike` in ./FistBumpLike.
 */

import React from 'react';
import Svg, { Path } from 'react-native-svg';

export const FIST_RIGHT_OUTLINE_D =
  'M200 124H110A38 38 0 0 0 110 200H200M200 200H94A38 38 0 0 0 94 276H210A38 38 0 0 1 210 352H102A38 38 0 0 1 102 276M194 352A38 38 0 0 1 194 428H126A38 38 0 0 1 126 352H194M280 148V236A40 40 0 0 1 200 236V140C200 106 234 88 280 88C334 88 372 116 392 164H448V388H392C378 414 352 428 316 428H194';
export const FIST_RIGHT_FILLED_D =
  'M160 108H89A33 33 0 0 0 89 174H160ZM160 198H73A33 33 0 0 0 73 264H160ZM81 288H231A33 33 0 0 1 231 354H81A33 33 0 0 1 81 288ZM105 378H215A33 33 0 0 1 215 444H105A33 33 0 0 1 105 378ZM184 140C184 96 226 72 280 72C341 72 383 103 403 148H448A16 16 0 0 1 464 164V388A16 16 0 0 1 448 404H401C384 430 356 444 316 444H261.5A57 57 0 0 0 256.6 372A57 57 0 0 0 265.1 275.2A66 66 0 0 0 292 222V136A12 12 0 0 0 268 136V222A42 42 0 0 1 184 222ZM408 196V356A12 12 0 0 0 432 356V196A12 12 0 0 0 408 196Z';
export const FIST_LEFT_OUTLINE_D =
  'M312 124H402A38 38 0 0 1 402 200H312M312 200H418A38 38 0 0 1 418 276H302A38 38 0 0 0 302 352H410A38 38 0 0 0 410 276M318 352A38 38 0 0 0 318 428H386A38 38 0 0 0 386 352H318M232 148V236A40 40 0 0 0 312 236V140C312 106 278 88 232 88C178 88 140 116 120 164H64V388H120C134 414 160 428 196 428H318';
/** Tick group A: straight up and straight down from the contact point C (40, 258). */
export const TICKS_A_D = 'M40 -6L40 -54M40 522L40 570';
/** Tick group B: the four diagonals. */
export const TICKS_B_D = 'M-84 25L-106 -17M164 25L186 -17M-84 491L-106 533M164 491L186 533';

/** Filled is not legible below this size (geometry §6). */
export const FILLED_MIN_SIZE = 20;

export type FistBumpVariant = 'outline' | 'filled';

export interface FistBumpIconProps {
  variant?: FistBumpVariant;
  size: number;
  color: string;
  /** Omit for a decorative icon (hidden from screen readers). */
  accessibilityLabel?: string;
}

function a11yProps(accessibilityLabel?: string): Record<string, unknown> {
  return accessibilityLabel ? { role: 'img', 'aria-label': accessibilityLabel } : { 'aria-hidden': true };
}

export function FistBumpIcon({ variant = 'outline', size, color, accessibilityLabel }: FistBumpIconProps): React.JSX.Element {
  const filled = variant === 'filled' && size >= FILLED_MIN_SIZE;
  return (
    <Svg width={size} height={size} viewBox="0 0 512 512" {...a11yProps(accessibilityLabel)}>
      {filled ? (
        <Path d={FIST_RIGHT_FILLED_D} fill={color} />
      ) : (
        <Path d={FIST_RIGHT_OUTLINE_D} fill="none" stroke={color} strokeWidth={32} strokeLinecap="round" strokeLinejoin="round" />
      )}
    </Svg>
  );
}

/** The left (incoming) fist, outline only. Used by `FistBumpLike`; not a standalone icon. */
export function FistBumpLeftFist({ size, color }: { size: number; color: string }): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 512 512" aria-hidden>
      <Path d={FIST_LEFT_OUTLINE_D} fill="none" stroke={color} strokeWidth={32} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export interface FistBumpTicksProps {
  /** The ICON size the ticks are laid over (not the layer's own size). */
  size: number;
  color: string;
  /** `a` = up / down, `b` = four diagonals. Omit for both (static preview). */
  group?: 'a' | 'b';
}

/**
 * The deco ticks radiating from the contact point C (40, 258). Rendered at 1.5x `size`, absolutely positioned at -size/4 so
 * it shares the icon's coordinate system; place it inside a `position: relative` wrapper the size of the icon.
 * The caller owns the motion and must skip it under Reduce Motion.
 */
export function FistBumpTicks({ size, color, group }: FistBumpTicksProps): React.JSX.Element {
  const d = group === 'a' ? TICKS_A_D : group === 'b' ? TICKS_B_D : `${TICKS_A_D}${TICKS_B_D}`;
  return (
    <Svg
      width={size * 1.5}
      height={size * 1.5}
      viewBox="-128 -128 768 768"
      aria-hidden
      style={{ position: 'absolute', left: -size / 4, top: -size / 4, pointerEvents: 'none' }}
    >
      <Path d={d} fill="none" stroke={color} strokeWidth={32} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export type FistBumpBurstProps = Omit<FistBumpTicksProps, 'group'>;

/** @deprecated v5 name. Now the v6 deco ticks (both groups, static); animated use goes through `FistBumpLike`. */
export function FistBumpBurst({ size, color }: FistBumpBurstProps): React.JSX.Element {
  return <FistBumpTicks size={size} color={color} />;
}
