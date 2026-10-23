/**
 * Icon dictionary (design system §9.8 / A.9). One concept -> one Ionicons glyph; every glyph
 * may appear under exactly ONE concept (outline + filled are two states of the same concept).
 * Components never write glyph strings directly: `<Ionicons name={ICON.bookmark.filled} />`.
 *
 *  - outline = default / off, filled = on / achieved (I2, I3), `on` = the toggle's other state.
 *  - Only Ionicons, only `*-outline` and filled styles (never `*-sharp`), no emoji, no custom SVG,
 *    EXCEPT the approved custom `like` icon (fist bump, §9.12): `ICON.like.custom === 'fistbump'`
 *    renders `<FistBumpIcon variant size color />` (src/components/ui/FistBumpIcon.tsx), never an Ionicon.
 *  - New concepts: follow §9.11 (UI Designer updates the spec first).
 */

import type { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

export type IoniconName = ComponentProps<typeof Ionicons>['name'];

interface IconEntry {
  outline?: IoniconName;
  filled?: IoniconName;
  /** The other state of a non-filled toggle (e.g. password visibility). */
  on?: IoniconName;
  /** Approved custom SVG glyph (§9.12). Render with the matching component, not `<Ionicons>`. */
  custom?: 'fistbump';
}

export const ICON = {
  // A. Navigation & frame
  home: { outline: 'home-outline', filled: 'home' },
  gyms: { outline: 'location-outline', filled: 'location' },
  profile: { outline: 'person-outline', filled: 'person' },
  back: { outline: 'chevron-back' },
  forward: { outline: 'chevron-forward' },
  dropdown: { outline: 'chevron-down' },
  collapse: { outline: 'chevron-up' },
  close: { outline: 'close' },
  clear: { filled: 'close-circle' },
  more: { outline: 'ellipsis-horizontal' },
  external: { outline: 'open-outline' },
  // B. Notifications & settings
  notifications: { outline: 'notifications-outline' },
  settings: { outline: 'settings-outline' },
  appearance: { outline: 'moon-outline' },
  language: { outline: 'language-outline' },
  locked: { outline: 'lock-closed-outline' },
  signOut: { outline: 'log-out-outline' },
  // C. Routes & logging
  route: { outline: 'trail-sign-outline' },
  bookmark: { outline: 'bookmark-outline', filled: 'bookmark' },
  log: { outline: 'add-circle-outline' },
  sendTop: { outline: 'checkmark-circle-outline', filled: 'checkmark-circle' },
  sendFlash: { outline: 'flash-outline', filled: 'flash' },
  /** Both states are `ellipse-outline` (I3 exception: a filled circle reads as "achieved"). */
  sendAttempt: { outline: 'ellipse-outline' },
  add: { outline: 'add' },
  /** Stepper minus (A10). */
  remove: { outline: 'remove' },
  newTopGrade: { filled: 'trophy' },
  grade: { outline: 'trending-up-outline' },
  date: { outline: 'calendar-clear-outline' },
  stats: { outline: 'bar-chart-outline' },
  sends: { outline: 'list-outline' },
  filter: { outline: 'funnel-outline' },
  search: { outline: 'search-outline' },
  // D. Beta video
  betaVideo: { outline: 'videocam-outline', filled: 'videocam' },
  play: { filled: 'play' },
  /** Beta-video count line on RouteCard (A10). */
  betaCount: { outline: 'play-circle-outline' },
  /** Missing-photo placeholder (A10). */
  image: { outline: 'image-outline' },
  upload: { outline: 'cloud-upload-outline' },
  uploaded: { outline: 'cloud-done-outline', filled: 'cloud-done' },
  library: { outline: 'images-outline' },
  camera: { outline: 'camera-outline' },
  /** Custom fist bump (§9.12): use `<FistBumpIcon variant={liked ? 'filled' : 'outline'} />`. No Ionicon. */
  like: { custom: 'fistbump' },
  report: { outline: 'flag-outline', filled: 'flag' },
  // E. Social
  follow: { outline: 'person-add-outline' },
  followers: { outline: 'people-outline' },
  share: { outline: 'share-outline' },
  edit: { outline: 'pencil-outline' },
  delete: { outline: 'trash-outline' },
  block: { outline: 'ban-outline' },
  // F. Feedback & forms
  error: { outline: 'alert-circle-outline', filled: 'alert-circle' },
  warning: { outline: 'warning-outline' },
  info: { outline: 'information-circle-outline' },
  retry: { outline: 'reload-outline' },
  selected: { outline: 'checkmark' },
  passwordVisibility: { outline: 'eye-outline', on: 'eye-off-outline' },
} as const satisfies Record<string, IconEntry>;

export type IconKey = keyof typeof ICON;

/**
 * Pick the glyph for a concept: `iconName('bookmark', true)` -> filled when on, outline when off.
 * Falls back to whichever style exists (line icons such as `chevron-back` have only one).
 */
export function iconName(key: IconKey, active = false): IoniconName {
  const entry: IconEntry = ICON[key];
  const picked = active ? (entry.filled ?? entry.on ?? entry.outline) : (entry.outline ?? entry.filled);
  return picked as IoniconName;
}
