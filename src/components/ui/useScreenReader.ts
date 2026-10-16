import { useSyncExternalStore } from 'react';
import { AccessibilityInfo } from 'react-native';

let enabled = false;
let init = false;
const listeners = new Set<() => void>();

function start(): void {
  if (init) return;
  init = true;
  try {
    void AccessibilityInfo.isScreenReaderEnabled()
      .then((v) => {
        enabled = v;
        listeners.forEach((l) => l());
      })
      .catch(() => {});
    AccessibilityInfo.addEventListener('screenReaderChanged', (v: boolean) => {
      enabled = v;
      listeners.forEach((l) => l());
    });
  } catch {
    // unavailable
  }
}

/** True while VoiceOver/TalkBack is on (toasts and celebration cards then never auto-dismiss). */
export function useScreenReader(): boolean {
  return useSyncExternalStore(
    (l) => {
      start();
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    () => enabled,
    () => false,
  );
}
