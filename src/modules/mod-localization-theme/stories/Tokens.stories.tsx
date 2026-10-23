import { Ionicons } from '@expo/vector-icons';
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';
import { ScrollView, View } from 'react-native';

import { AppText } from '../../../components/ui/AppText';
import { MOTION } from '../../../lib/motion';
import {
  AVATAR_SIZE,
  RADIUS,
  innerRadius,
  COMPONENT_SIZE,
  DARK_PALETTE,
  ICON_SIZE,
  LAYOUT,
  LIGHT_PALETTE,
  SPACING,
  STROKE,
  TYPE_SCALE,
  useTheme,
} from '../../../lib/theme';
import type { ThemePalette } from '../../../lib/theme';

function Section({ title, children }: { title: string; children: React.ReactNode }): React.JSX.Element {
  const { theme } = useTheme();
  return (
    <View style={{ marginBottom: theme.layout.sectionGap + theme.spacing.sm }}>
      <AppText variant="title3" style={{ marginBottom: theme.spacing.md }}>
        {title}
      </AppText>
      {children}
    </View>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  const { theme } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.sm }}>
      <AppText variant="footnote" color="textSecondary" style={{ width: 170 }}>
        {label}
      </AppText>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

// Palettes are rendered from the exported constants (not the active theme), so light and dark
// are visible at the same time regardless of the toolbar.
function Palette({ name, palette }: { name: string; palette: ThemePalette }): React.JSX.Element {
  return (
    <View style={{ backgroundColor: palette.background, padding: 12, borderRadius: 8, marginBottom: 16, borderWidth: 1, borderColor: palette.border }}>
      <AppText variant="headline" style={{ color: palette.textPrimary, marginBottom: 8 }}>
        {`${name} (${Object.keys(palette).length} keys)`}
      </AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {(Object.entries(palette) as [string, string][]).map(([key, value]) => (
          <View key={key} style={{ width: 150, margin: 4 }}>
            <View style={{ height: 40, backgroundColor: value, borderColor: palette.outline, borderWidth: 1, borderRadius: 4 }} />
            <AppText variant="caption1" style={{ color: palette.textPrimary }}>
              {key}
            </AppText>
            <AppText variant="caption2" style={{ color: palette.textSecondary }}>
              {value}
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

function Tokens(): React.JSX.Element {
  const { theme } = useTheme();
  const c = theme.colors;
  const bar = (w: number, color = c.primary) => <View style={{ width: w, height: 16, backgroundColor: color, borderRadius: 2 }} />;
  return (
    <ScrollView contentContainerStyle={{ padding: theme.layout.screenMarginCompact + 8 }}>
      <Section title="Colors (light + dark)">
        <Palette name="LIGHT_PALETTE" palette={LIGHT_PALETTE} />
        <Palette name="DARK_PALETTE" palette={DARK_PALETTE} />
      </Section>

      <Section title="TYPE_SCALE">
        {(Object.entries(TYPE_SCALE) as [string, (typeof TYPE_SCALE)[keyof typeof TYPE_SCALE]][]).map(([name, s]) => (
          <Row key={name} label={`${name} ${s.fontSize}/${s.lineHeight} ${s.fontWeight} x${s.maxFontSizeMultiplier}`}>
            <AppText variant={name as keyof typeof TYPE_SCALE}>ProjectDay 攀岩紀錄 V4 Quick fox</AppText>
          </Row>
        ))}
      </Section>

      <Section title="SPACING">
        {Object.entries(SPACING).map(([name, value]) => (
          <Row key={name} label={`${name} (${value})`}>
            {bar(value)}
          </Row>
        ))}
      </Section>

      <Section title="LAYOUT">
        {Object.entries(LAYOUT).map(([name, value]) => (
          <Row key={name} label={name}>
            <AppText variant="footnote">{String(value)}</AppText>
          </Row>
        ))}
      </Section>

      <Section title="RADIUS roles (BORDER_RADIUS is deprecated)">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {Object.entries(RADIUS).map(([name, value]) => (
            <View key={name} style={{ alignItems: 'center', marginRight: 24, marginBottom: 12 }}>
              <View style={{ width: 72, height: 72, backgroundColor: c.surface, borderColor: c.primary, borderWidth: 2, borderRadius: value, borderCurve: 'continuous' }} />
              <AppText variant="footnote" color="textSecondary">{`${name} (${value})`}</AppText>
            </View>
          ))}
        </View>
        <AppText variant="subhead" style={{ marginTop: 8, marginBottom: 8 }}>
          innerRadius(outer, gap) = max(outer - gap, 4). Gap below outer / 2 must be concentric:
        </AppText>
        <View style={{ flexDirection: 'row', columnGap: 24 }}>
          {[
            [20, 8],
            [20, 16],
            [32, 20],
            [12, 6],
          ].map(([outer, gap]) => (
            <View key={`${outer}-${gap}`} style={{ alignItems: 'center' }}>
              <View style={{ width: 96, height: 96, padding: gap, borderRadius: outer, borderCurve: 'continuous', backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: c.outline }}>
                <View style={{ flex: 1, borderRadius: innerRadius(outer, gap), borderCurve: 'continuous', backgroundColor: c.primary }} />
              </View>
              <AppText variant="caption1" color="textSecondary">{`outer ${outer}, gap ${gap} -> ${innerRadius(outer, gap)}`}</AppText>
            </View>
          ))}
        </View>
      </Section>

      <Section title="ICON_SIZE">
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          {Object.entries(ICON_SIZE).map(([name, value]) => (
            <View key={name} style={{ alignItems: 'center', marginRight: 24 }}>
              <Ionicons name="bookmark" size={value} color={c.textPrimary} />
              <AppText variant="caption1" color="textSecondary">{`${name} ${value}`}</AppText>
            </View>
          ))}
        </View>
      </Section>

      <Section title="STROKE">
        {Object.entries(STROKE).map(([name, value]) => (
          <Row key={name} label={`${name} (${value === STROKE.hairline ? 'hairline' : value})`}>
            <View style={{ width: 200, height: 0, borderTopWidth: value, borderTopColor: c.outline }} />
          </Row>
        ))}
      </Section>

      <Section title="AVATAR_SIZE">
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          {Object.entries(AVATAR_SIZE).map(([name, value]) => (
            <View key={name} style={{ alignItems: 'center', marginRight: 24 }}>
              <View style={{ width: value, height: value, borderRadius: RADIUS.full, backgroundColor: c.surfaceAlt, borderWidth: STROKE.hairline, borderColor: c.border }} />
              <AppText variant="caption1" color="textSecondary">{`${name} ${value}`}</AppText>
            </View>
          ))}
        </View>
      </Section>

      <Section title="COMPONENT_SIZE">
        {Object.entries(COMPONENT_SIZE).map(([name, value]) => (
          <Row key={name} label={name}>
            <AppText variant="footnote">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</AppText>
          </Row>
        ))}
      </Section>

      <Section title="ELEVATION (current theme)">
        <View style={{ flexDirection: 'row' }}>
          {(['control', 'raised'] as const).map((k) => (
            <View
              key={k}
              style={[
                { width: 120, height: 72, margin: 12, backgroundColor: c.surface, borderRadius: RADIUS.card, alignItems: 'center', justifyContent: 'center', borderWidth: theme.isDark ? 1 : 0, borderColor: c.border },
                theme.elevation[k],
              ]}
            >
              <AppText variant="footnote">{k}</AppText>
            </View>
          ))}
        </View>
      </Section>

      <Section title="MOTION.duration (ms)">
        {Object.entries(MOTION.duration).map(([name, ms]) => (
          <Row key={name} label={`${name} (${ms})`}>
            {bar(Math.min(ms / 10, 300), c.sendTop)}
          </Row>
        ))}
      </Section>

      <Section title="MOTION.easing / spring / scale">
        {Object.entries(MOTION.easing).map(([name, v]) => (
          <Row key={name} label={`easing.${name}`}>
            <AppText variant="footnote">{`cubic-bezier(${v.join(', ')})`}</AppText>
          </Row>
        ))}
        {Object.entries(MOTION.spring).map(([name, v]) => (
          <Row key={name} label={`spring.${name}`}>
            <AppText variant="footnote">{JSON.stringify(v)}</AppText>
          </Row>
        ))}
        {Object.entries(MOTION.distance).map(([name, v]) => (
          <Row key={name} label={`distance.${name}`}>
            <AppText variant="footnote">{`${v}pt (not time-scaled; unused under Reduce Motion)`}</AppText>
          </Row>
        ))}
        {Object.entries(MOTION.scale).map(([name, v]) => (
          <Row key={name} label={`scale.${name}`}>
            <AppText variant="footnote">{String(v)}</AppText>
          </Row>
        ))}
        <Row label="shake">
          <AppText variant="footnote">{`${JSON.stringify(MOTION.shake)} (time = duration.short, linear)`}</AppText>
        </Row>
      </Section>

      <Section title="MOTION.particles">
        {Object.entries(MOTION.particles).map(([name, v]) => (
          <Row key={name} label={name}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {(v.colors as ReadonlyArray<{ key: keyof ThemePalette; n: number }>).map((col) => (
                <View key={col.key} style={{ flexDirection: 'row', alignItems: 'center', marginRight: 12 }}>
                  <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: c[col.key], marginRight: 4 }} />
                  <AppText variant="caption1">{`${col.key} x${col.n}`}</AppText>
                </View>
              ))}
            </View>
          </Row>
        ))}
      </Section>
    </ScrollView>
  );
}

const meta: Meta<typeof Tokens> = {
  title: 'Foundations/Tokens',
  tags: ['!autodocs'],
  component: Tokens,
};
export default meta;

export const AllTokens: StoryObj<typeof Tokens> = {};
