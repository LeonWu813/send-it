import React from 'react';
import { View } from 'react-native';

import { useTheme } from '../../../lib/theme';
import { AppText } from '../AppText';
import type { OnSurface } from '../Button';

/** Places children on the surface named by the `on` control so pressed states can be checked. */
export function SurfaceBox({ on, children, width = 375 }: { on: OnSurface; children: React.ReactNode; width?: number }): React.JSX.Element {
  const { theme } = useTheme();
  const c = theme.colors;
  const bg = on === 'surface' ? c.surface : on === 'media' ? c.mediaBackground : on === 'tinted' ? c.errorContainer : 'transparent';
  return (
    <View style={{ padding: 16, width }}>
      <View style={{ backgroundColor: bg, padding: 16, borderRadius: theme.radius.card }}>{children}</View>
    </View>
  );
}

export const ON_OPTIONS: OnSurface[] = ['surface', 'background', 'media', 'tinted'];

/** A labelled row inside a state matrix. */
export function Row({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <View style={{ marginBottom: 16 }}>
      <AppText variant="caption1" color="textSecondary" style={{ marginBottom: 6, fontFamily: 'monospace' }}>
        {label}
      </AppText>
      {children}
    </View>
  );
}
