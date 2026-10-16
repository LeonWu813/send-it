import React, { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';

import { setHapticDriver } from '../src/lib/haptics';
import type { HapticDriver, HapticKey } from '../src/lib/haptics';

type Listener = (key: HapticKey) => void;
const listeners = new Set<Listener>();

/** Storybook haptic driver: instead of vibrating, shows "haptic: <key>" briefly on the canvas. */
export const loggingHapticDriver: HapticDriver = {
  play: (key) => {
    // eslint-disable-next-line no-console
    console.info(`[haptic] ${key}`);
    listeners.forEach((l) => l(key));
  },
};

export function installLoggingHaptics(): void {
  setHapticDriver(loggingHapticDriver);
}

export function HapticLog(): React.JSX.Element | null {
  const [key, setKey] = useState<HapticKey | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    const l: Listener = (k) => {
      setKey(k);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setKey(null), 900);
    };
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  if (!key) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 8, right: 8, backgroundColor: '#000000', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999, zIndex: 9999 }}>
      <Text style={{ color: '#FFFFFF', fontSize: 12 }}>{`haptic: ${key}`}</Text>
    </View>
  );
}
