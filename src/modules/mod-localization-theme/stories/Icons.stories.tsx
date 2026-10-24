import { Ionicons } from '@expo/vector-icons';
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';
import { ScrollView, View } from 'react-native';

import { AppText } from '../../../components/ui/AppText';
import { FistBumpBurst, FistBumpIcon } from '../../../components/ui/FistBumpIcon';
import { ICON } from '../../../lib/icons';
import type { IconKey, IoniconName } from '../../../lib/icons';
import { CONTINUOUS, ICON_SIZE, useTheme } from '../../../lib/theme';
import { ICON_GROUPS } from './iconGroups';

type Entry = { outline?: IoniconName; filled?: IoniconName; on?: IoniconName; custom?: 'fistbump' };
type IconSizeKey = keyof typeof ICON_SIZE;
type ColorKey = 'textPrimary' | 'textSecondary' | 'primary';
interface Props {
  size: IconSizeKey;
  color: ColorKey;
}

const ALL_KEYS = Object.keys(ICON) as IconKey[];

function Tile({ label, glyphs, caption, px, color }: { label: string; glyphs: React.ReactNode[]; caption: string; px: number; color: ColorKey }): React.JSX.Element {
  const { theme } = useTheme();
  return (
    <View style={{ width: '25%', padding: theme.spacing.xs / 2 }}>
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          padding: theme.spacing.xs,
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radius.control,
          borderWidth: theme.stroke.hairline,
          borderColor: theme.colors.divider,
          ...CONTINUOUS,
        }}
      >
        <View style={{ flexDirection: 'row', gap: theme.spacing.xs, alignItems: 'center', justifyContent: 'center', minHeight: 40 }}>{glyphs}</View>
        <AppText variant="caption1" weight="600" numberOfLines={1} style={{ marginTop: theme.spacing.xs }}>
          {label}
        </AppText>
        <AppText variant="caption2" color="textSecondary" style={{ textAlign: 'center' }}>
          {caption}
        </AppText>
      </View>
    </View>
  );
}

function Wide({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <View style={{ width: '100%' }}>{children}</View>;
}

function entryTile(key: IconKey, px: number, color: ColorKey, themeColor: string): React.JSX.Element {
  const e: Entry = ICON[key];
  if (e.custom === 'fistbump') {
    return (
      <Tile
        key={key}
        label={`ICON.${key}`}
        px={px}
        color={color}
        glyphs={[
          <FistBumpIcon key="o" variant="outline" size={px} color={themeColor} />,
          <FistBumpIcon key="f" variant="filled" size={px} color={themeColor} />,
        ]}
        caption="like — fist bump (custom SVG)"
      />
    );
  }
  const names = [e.outline, e.filled, e.on].filter((n): n is IoniconName => n !== undefined);
  return (
    <Tile
      key={key}
      label={`ICON.${key}`}
      px={px}
      color={color}
      glyphs={names.map((n) => (
        <Ionicons key={n} name={n} size={px} color={themeColor} />
      ))}
      caption={names.join(' / ')}
    />
  );
}

function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }): React.JSX.Element {
  const { theme } = useTheme();
  return (
    <View style={{ marginBottom: theme.spacing.md }}>
      <AppText variant="headline" style={{ marginBottom: theme.spacing.xs }}>
        {count === undefined ? title : `${title} (${count})`}
      </AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -theme.spacing.xs / 2 }}>{children}</View>
    </View>
  );
}

function Gallery({ size, color, only }: Props & { only?: string }): React.JSX.Element {
  const { theme } = useTheme();
  const px = ICON_SIZE[size];
  const c = theme.colors[color];
  const grouped = new Set<IconKey>(ICON_GROUPS.flatMap((g) => g.keys));
  const ungrouped = ALL_KEYS.filter((k) => !grouped.has(k));
  const groups = only ? ICON_GROUPS.filter((g) => g.id === only) : ICON_GROUPS;
  return (
    <ScrollView contentContainerStyle={{ padding: theme.layout.screenMarginCompact + 8 }}>
      <AppText variant="title3" style={{ marginBottom: theme.spacing.xs }}>
        {`${ALL_KEYS.length} concepts`}
      </AppText>
      <AppText variant="footnote" color="textSecondary" style={{ marginBottom: theme.spacing.md }}>
        outline = default / off, filled = on / achieved, a third glyph = a non-filled toggle's other state. Use ICON.concept.outline in code, never glyph strings.
      </AppText>
      {only ? null : (
        <Section title="Custom">
          <Tile
            label="ICON.like"
            px={px}
            color={color}
            glyphs={[
              <FistBumpIcon key="o" variant="outline" size={px} color={c} />,
              <FistBumpIcon key="f" variant="filled" size={px} color={c} />,
            ]}
            caption="like — fist bump (custom SVG)"
          />
          <Tile
            label="FistBumpBurst"
            px={px}
            color={color}
            glyphs={[
              <View key="b" style={{ width: px, height: px, margin: px / 2 }}>
                <FistBumpIcon variant="filled" size={px} color={c} />
                <FistBumpBurst size={px} color={c} />
              </View>,
            ]}
            caption="like animation ticks"
          />
        </Section>
      )}
      {groups.map((g) => (
        <Section key={g.id} title={g.title} count={g.keys.length}>
          {g.keys.map((k) => entryTile(k, px, color, c))}
        </Section>
      ))}
      {!only && ungrouped.length > 0 ? (
        <Section title="Ungrouped" count={ungrouped.length}>
          <Wide>
            <AppText variant="footnote" color="error" style={{ marginBottom: theme.spacing.xs }}>
              {`Warning: add these keys to ICON_GROUPS in stories/iconGroups.ts: ${ungrouped.join(', ')}`}
            </AppText>
          </Wide>
          {ungrouped.map((k) => entryTile(k, px, color, c))}
        </Section>
      ) : null}
    </ScrollView>
  );
}

const meta: Meta<typeof Gallery> = {
  title: 'Foundations/Icons',
  tags: ['!autodocs'],
  component: Gallery,
  args: { size: 'lg', color: 'textPrimary' },
  argTypes: {
    size: { control: 'inline-radio', options: ['xs', 'sm', 'md', 'lg', 'tab', 'xl'], description: 'ICON_SIZE token' },
    color: { control: 'inline-radio', options: ['textPrimary', 'textSecondary', 'primary'] },
    only: { table: { disable: true } },
  },
};
export default meta;

type Story = StoryObj<typeof Gallery>;

export const AllIcons: Story = {};
export const Navigation: Story = { args: { only: 'Navigation' } };
export const Settings: Story = { args: { only: 'Settings' } };
export const Routes: Story = { args: { only: 'Routes' } };
export const BetaVideo: Story = { args: { only: 'BetaVideo' } };
export const Social: Story = { args: { only: 'Social' } };
export const Feedback: Story = { args: { only: 'Feedback' } };
