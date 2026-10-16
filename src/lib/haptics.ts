/**
 * Haptics stub (07 §8.3). Phase 1 does NOT install or import `expo-haptics`; the default
 * driver is a no-op. A real driver can be injected later with setHapticDriver().
 *
 * Future mapping (for whoever writes the real driver):
 *   select    -> selectionAsync
 *   toggle    -> impactAsync(Light)
 *   emphasis  -> impactAsync(Medium)
 *   success   -> notificationAsync(Success)
 *   celebrate -> notificationAsync(Success), then impactAsync(Rigid) after 120ms
 *   warning   -> notificationAsync(Warning)
 *   error     -> notificationAsync(Error)
 *
 * Every haptic moment MUST have a visual or VoiceOver counterpart: haptics only reinforce.
 * Components should not call this directly — use `useMotion().haptic(key, sourceId)`.
 */

export type HapticKey =
  | 'select'
  | 'toggle'
  | 'emphasis'
  | 'success'
  | 'celebrate'
  | 'warning'
  | 'error';

export interface HapticDriver {
  play(key: HapticKey): void;
}

export const noopHapticDriver: HapticDriver = { play: () => {} };

let current: HapticDriver = noopHapticDriver;
let enabled = true;

export function setHapticDriver(driver: HapticDriver): void {
  current = driver;
}

export function getHapticDriver(): HapticDriver {
  return current;
}

/**
 * App-level haptics preference (default true). The settings toggle is hidden until a real
 * driver exists, so nothing persists this yet.
 */
export function setHapticsEnabled(value: boolean): void {
  enabled = value;
}

export function getHapticsEnabled(): boolean {
  return enabled;
}
