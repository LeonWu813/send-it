import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';
import { View } from 'react-native';

import { ForcedTheme } from '../../../../.storybook/ForcedTheme';
import { AppText } from '../../../components/ui';
import { useTheme } from '../../../lib/theme';
import RouteColorBadge from '../components/RouteColorBadge';
import { ROUTE_COLORS } from '../types';

// Off-spec design tooling. Fake data only.
const SIZES = ['sm', 'md'] as const;
// 'unknown' demonstrates the "Other" fallback (surfaceAlt + hairline).
const COLOR_OPTIONS = [...ROUTE_COLORS, 'unknown'];

const meta: Meta<typeof RouteColorBadge> = {
  title: 'Route Catalog/RouteColorBadge',
  component: RouteColorBadge,
  args: { color: 'red', size: 'md' },
  argTypes: {
    color: { control: 'select', options: COLOR_OPTIONS },
    size: { control: 'inline-radio', options: [...SIZES] },
  },
};
export default meta;

type Story = StoryObj<typeof RouteColorBadge>;

/** Change colour and size with the controls; use the toolbar for theme and language. The badge is static (no press). */
export const Playground: Story = {
  render: (args) => (
    <View style={{ padding: 16 }}>
      <RouteColorBadge {...args} />
    </View>
  ),
};

function Grid(): React.JSX.Element {
  const { theme } = useTheme();
  return (
    <View style={{ gap: theme.spacing.smd }}>
      {[...ROUTE_COLORS, 'unknown'].map((c) => (
        <View key={c} style={{ flexDirection: 'row', alignItems: 'center', columnGap: theme.spacing.smd }}>
          <View style={{ width: 64 }}>
            <AppText variant="caption1" color="textSecondary">{c}</AppText>
          </View>
          {SIZES.map((s) => (
            <View key={s} style={{ width: 90 }}>
              <RouteColorBadge color={c} size={s} />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function Panel({ mode }: { mode: 'light' | 'dark' }): React.JSX.Element {
  return (
    <ForcedTheme mode={mode}>
      <PanelBody mode={mode} />
    </ForcedTheme>
  );
}

function PanelBody({ mode }: { mode: 'light' | 'dark' }): React.JSX.Element {
  const { theme } = useTheme();
  return (
    <View
      style={{
        backgroundColor: theme.colors.surface,
        padding: theme.spacing.md,
        borderRadius: theme.borderRadius.lg,
        flex: 1,
        gap: theme.spacing.sm,
      }}
    >
      <AppText variant="headline">{mode}</AppText>
      <Grid />
    </View>
  );
}

/** All 9 tapes plus the unknown fallback, sm and md, light beside dark, on a white card (hairlines show on white/yellow/pink in light, black in dark). */
export const AllTapesBySizeLightVsDark: Story = {
  render: () => (
    <View style={{ flexDirection: 'row', gap: 16, padding: 16 }}>
      <Panel mode="light" />
      <Panel mode="dark" />
    </View>
  ),
};
