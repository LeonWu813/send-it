import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';
import { Text, View } from 'react-native';

import { ForcedTheme } from '../../../../.storybook/ForcedTheme';
import { useTheme } from '../../../lib/theme';
import RouteColorBadge from '../components/RouteColorBadge';
import { ROUTE_COLORS } from '../types';

// Off-spec design tooling. Fake data only.
const SIZES = ['sm', 'md'] as const;

const meta: Meta<typeof RouteColorBadge> = {
  title: 'Route Catalog/RouteColorBadge',
  component: RouteColorBadge,
  argTypes: {
    color: { control: 'select', options: [...ROUTE_COLORS] },
    size: { control: 'inline-radio', options: [...SIZES] },
  },
};
export default meta;

type Story = StoryObj<typeof RouteColorBadge>;

export const Single: Story = { args: { color: 'red', size: 'md' } };

function Caption({ children }: { children: string }): React.JSX.Element {
  const { theme } = useTheme();
  return <Text style={{ color: theme.colors.textSecondary, fontSize: 12, width: 64 }}>{children}</Text>;
}

function Grid(): React.JSX.Element {
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ width: 64 }} />
        {SIZES.map((s) => (
          <View key={s} style={{ width: 90 }}><Caption>{s}</Caption></View>
        ))}
      </View>
      {ROUTE_COLORS.map((c) => (
        <View key={c} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Caption>{c}</Caption>
          {SIZES.map((s) => (
            <View key={s} style={{ width: 90 }}><RouteColorBadge color={c} size={s} /></View>
          ))}
        </View>
      ))}
    </View>
  );
}

export const AllColorsAndSizes: Story = { render: () => <Grid /> };

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
    <View style={{ backgroundColor: theme.colors.background, padding: 16, borderRadius: 8, flex: 1, gap: 8 }}>
      <Text style={{ color: theme.colors.textPrimary, fontWeight: '700' }}>{mode}</Text>
      <Grid />
    </View>
  );
}

/** Known issue: in dark, label contrast breaks for white/yellow/black, weak for blue/purple. */
export const LightVsDark: Story = {
  render: () => (
    <View style={{ flexDirection: 'row', gap: 16 }}>
      <Panel mode="light" />
      <Panel mode="dark" />
    </View>
  ),
};
