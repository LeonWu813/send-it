import type { IconKey } from '../../../lib/icons';

/** Story-local mirror of the category headers in src/lib/icons.ts. Keys missing here render under "Ungrouped" with a warning. */
export const ICON_GROUPS: { id: string; title: string; keys: IconKey[] }[] = [
  { id: 'Navigation', title: '導覽', keys: ['home', 'gyms', 'profile', 'back', 'forward', 'dropdown', 'collapse', 'close', 'clear', 'more', 'external'] },
  { id: 'Settings', title: '通知與設定', keys: ['notifications', 'settings', 'appearance', 'language', 'locked', 'signOut'] },
  {
    id: 'Routes',
    title: '路線與紀錄',
    keys: ['route', 'bookmark', 'log', 'sendTop', 'sendFlash', 'sendAttempt', 'add', 'remove', 'newTopGrade', 'grade', 'date', 'stats', 'sends', 'filter', 'search'],
  },
  { id: 'BetaVideo', title: 'Beta 影片', keys: ['betaVideo', 'play', 'betaCount', 'image', 'upload', 'uploaded', 'library', 'camera', 'like', 'report'] },
  { id: 'Social', title: '社群', keys: ['follow', 'followers', 'share', 'edit', 'delete', 'block'] },
  { id: 'Feedback', title: '回饋與表單', keys: ['error', 'warning', 'info', 'retry', 'selected', 'passwordVisibility'] },
];
