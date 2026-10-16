import React from 'react';
import { View } from 'react-native';

import { useTheme } from '../../../lib/theme';
import type { OnSurface } from '../Button';

/** Places children on the surface named by the `on` control so pressed states can be checked. */
export function SurfaceBox({ on, children, width = 375 }: { on: OnSurface; children: React.ReactNode; width?: number }): React.JSX.Element {
  const { theme } = useTheme();
  const c = theme.colors;
  const bg = on === 'surface' ? c.surface : on === 'media' ? c.mediaBackground : on === 'tinted' ? c.errorContainer : 'transparent';
  return (
    <View style={{ padding: 16, width }}>
      <View style={{ backgroundColor: bg, padding: 16, borderRadius: theme.borderRadius.lg }}>{children}</View>
    </View>
  );
}

export const ON_OPTIONS: OnSurface[] = ['surface', 'background', 'media', 'tinted'];
