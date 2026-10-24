import type { IconKey } from '../../../lib/icons';

/** Story-local mirror of the category headers in src/lib/icons.ts. Keys missing here render under "Ungrouped" with a warning. */
export const ICON_GROUPS: { id: string; title: string; keys: IconKey[] }[] = [
  { id: 'Navigation', title: 'A. Navigation & frame', keys: ['home', 'gyms', 'profile', 'back', 'forward', 'dropdown', 'collapse', 'close', 'clear', 'more', 'external'] },
  { id: 'Settings', title: 'B. Notifications & settings', keys: ['notifications', 'settings', 'appearance', 'language', 'locked', 'signOut'] },
  {
    id: 'Routes',
    title: 'C. Routes & logging',
    keys: ['route', 'bookmark', 'log', 'sendTop', 'sendFlash', 'sendAttempt', 'add', 'remove', 'newTopGrade', 'grade', 'date', 'stats', 'sends', 'filter', 'search'],
  },
  { id: 'BetaVideo', title: 'D. Beta video', keys: ['betaVideo', 'play', 'betaCount', 'image', 'upload', 'uploaded', 'library', 'camera', 'like', 'report'] },
  { id: 'Social', title: 'E. Social', keys: ['follow', 'followers', 'share', 'edit', 'delete', 'block'] },
  { id: 'Feedback', title: 'F. Feedback & forms', keys: ['error', 'warning', 'info', 'retry', 'selected', 'passwordVisibility'] },
];
