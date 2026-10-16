import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';
import { ScrollView, Text, View } from 'react-native';

import { ForcedTheme } from '../../../../.storybook/ForcedTheme';
import { BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT, SPACING, useTheme } from '../../../lib/theme';

// LIGHT_PALETTE / DARK_PALETTE are not exported from theme.ts, so each palette is
// read through the real ThemeProvider (forced via its public setOverride).

function Section({ title, children }: { title: string; children: React.ReactNode }): React.JSX.Element {
  const { theme } = useTheme();
  return (
    <View style={{ marginBottom: theme.spacing.xl }}>
      <Text
        style={{
          color: theme.colors.textPrimary,
          fontSize: theme.fontSize.xl,
          fontWeight: theme.fontWeight.bold,
          marginBottom: theme.spacing.md,
        }}
      >
        {title}
      </Text>
      {children}
    </View>
  );
}

function Palette({ mode }: { mode: 'light' | 'dark' }): React.JSX.Element {
  return (
    <ForcedTheme mode={mode}>
      <PaletteInner mode={mode} />
    </ForcedTheme>
  );
}

function PaletteInner({ mode }: { mode: 'light' | 'dark' }): React.JSX.Element {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <View style={{ backgroundColor: c.background, padding: theme.spacing.md, borderColor: c.border, borderWidth: 1, borderRadius: theme.borderRadius.md, marginBottom: theme.spacing.md }}>
      <Text style={{ color: c.textPrimary, fontWeight: theme.fontWeight.bold, marginBottom: theme.spacing.sm }}>
        {mode === 'light' ? 'LIGHT_PALETTE' : 'DARK_PALETTE'}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {(Object.entries(c) as [string, string][]).map(([name, hex]) => (
          <View key={name} style={{ width: 150, margin: theme.spacing.xs }}>
            <View style={{ height: 48, backgroundColor: hex, borderColor: c.border, borderWidth: 1, borderRadius: theme.borderRadius.sm }} />
            <Text style={{ color: c.textPrimary, fontSize: theme.fontSize.sm }}>{name}</Text>
            <Text style={{ color: c.textSecondary, fontSize: theme.fontSize.xs }}>{hex}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function Tokens(): React.JSX.Element {
  const { theme } = useTheme();
  const text = { color: theme.colors.textPrimary };
  const muted = { color: theme.colors.textSecondary, fontSize: FONT_SIZE.sm };
  return (
    <ScrollView contentContainerStyle={{ padding: theme.spacing.lg }}>
      <Section title="Colors">
        <Palette mode="light" />
        <Palette mode="dark" />
      </Section>

      <Section title="FONT_SIZE">
        {Object.entries(FONT_SIZE).map(([name, size]) => (
          <View key={name} style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: theme.spacing.sm }}>
            <Text style={[muted, { width: 110 }]}>{`${name} (${size})`}</Text>
            <Text style={[text, { fontSize: size }]}>Send It 攀岩紀錄 The quick brown fox</Text>
          </View>
        ))}
      </Section>

      <Section title="FONT_WEIGHT">
        {Object.entries(FONT_WEIGHT).map(([name, weight]) => (
          <View key={name} style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: theme.spacing.sm }}>
            <Text style={[muted, { width: 110 }]}>{`${name} (${weight})`}</Text>
            <Text style={[text, { fontSize: FONT_SIZE.lg, fontWeight: weight }]}>Send It 攀岩紀錄 The quick brown fox</Text>
          </View>
        ))}
      </Section>

      <Section title="SPACING">
        {Object.entries(SPACING).map(([name, value]) => (
          <View key={name} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.sm }}>
            <Text style={[muted, { width: 110 }]}>{`${name} (${value})`}</Text>
            <View style={{ width: value, height: 16, backgroundColor: theme.colors.primary }} />
          </View>
        ))}
      </Section>

      <Section title="BORDER_RADIUS">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {Object.entries(BORDER_RADIUS).map(([name, value]) => (
            <View key={name} style={{ alignItems: 'center', marginRight: theme.spacing.lg, marginBottom: theme.spacing.md }}>
              <View style={{ width: 72, height: 72, backgroundColor: theme.colors.surfaceElevated, borderColor: theme.colors.primary, borderWidth: 2, borderRadius: value }} />
              <Text style={muted}>{`${name} (${value})`}</Text>
            </View>
          ))}
        </View>
      </Section>
    </ScrollView>
  );
}

const meta: Meta<typeof Tokens> = {
  title: 'Foundations/Tokens',
  component: Tokens,
};
export default meta;

export const AllTokens: StoryObj<typeof Tokens> = {};
