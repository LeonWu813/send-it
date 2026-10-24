import { Ionicons } from '@expo/vector-icons';
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { AppText } from '../../../components/ui/AppText';
import { Button } from '../../../components/ui/Button';
import { FistBumpBurst, FistBumpIcon } from '../../../components/ui/FistBumpIcon';
import { PressableScale } from '../../../components/ui/PressableScale';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { TextField } from '../../../components/ui/TextField';
import { ICON } from '../../../lib/icons';
import type { IconKey, IoniconName } from '../../../lib/icons';
import { CONTINUOUS, ICON_SIZE, useTheme } from '../../../lib/theme';
import { ICON_GROUPS } from './iconGroups';

type Entry = { outline?: IoniconName; filled?: IoniconName; on?: IoniconName; custom?: 'fistbump' };
type IconSizeKey = keyof typeof ICON_SIZE;
type ColorKey = 'textPrimary' | 'textSecondary' | 'primary';
type Style = 'outline' | 'filled';
interface Props {
  size: IconSizeKey;
  color: ColorKey;
}

const ALL_KEYS = Object.keys(ICON) as IconKey[];
const STYLE_OPTIONS = [
  { value: 'outline' as const, label: '線條' },
  { value: 'filled' as const, label: '實心' },
];

function glyphNames(e: Entry): IoniconName[] {
  return [e.outline, e.filled, e.on].filter((n): n is IoniconName => n !== undefined);
}

function Glyph({ k, style, px, color }: { k: IconKey; style: Style; px: number; color: string }): React.JSX.Element {
  const e: Entry = ICON[k];
  if (e.custom === 'fistbump') return <FistBumpIcon variant={style} size={px} color={color} />;
  const name = (style === 'filled' ? e.filled : undefined) ?? e.outline ?? e.filled ?? e.on;
  return <Ionicons name={name as IoniconName} size={px} color={color} />;
}

function usageLines(k: IconKey): string[] {
  const e: Entry = ICON[k];
  if (e.custom === 'fistbump') return ['<FistBumpIcon variant={liked ? "filled" : "outline"} />'];
  return (['outline', 'filled', 'on'] as const).filter((s) => e[s] !== undefined).map((s) => `ICON.${k}.${s}`);
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function Tile({ k, style, px, color, selected, onPress }: { k: IconKey; style: Style; px: number; color: string; selected: boolean; onPress: () => void }): React.JSX.Element {
  const { theme } = useTheme();
  const isCustom = (ICON[k] as Entry).custom !== undefined;
  return (
    <View style={{ width: '25%', padding: theme.spacing.xs / 2 }}>
      <PressableScale
        onPress={onPress}
        pressedColor={theme.colors.surfacePressed}
        accessibilityRole="button"
        accessibilityLabel={k}
        accessibilityState={{ selected }}
        style={{
          alignItems: 'center',
          minHeight: 88,
          paddingVertical: theme.spacing.xs,
          paddingHorizontal: theme.spacing.xs / 2,
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radius.control,
          borderWidth: selected ? theme.stroke.emphasis : theme.stroke.hairline,
          borderColor: selected ? theme.colors.primary : theme.colors.divider,
          ...CONTINUOUS,
        }}
      >
        <View style={{ height: 40, alignItems: 'center', justifyContent: 'center' }}>
          <Glyph k={k} style={style} px={px} color={color} />
        </View>
        <AppText variant="caption2" weight="600" numberOfLines={2} style={{ textAlign: 'center', minHeight: 28 }}>
          {k.replace(/([a-z])([A-Z])/g, '$1\u200B$2')}
        </AppText>
        {isCustom ? (
          <AppText variant="caption2" color="primary">
            Custom
          </AppText>
        ) : null}
      </PressableScale>
    </View>
  );
}

function Detail({ k, color }: { k: IconKey; color: string }): React.JSX.Element {
  const { theme } = useTheme();
  const [copied, setCopied] = useState(false);
  const e: Entry = ICON[k];
  const lines = usageLines(k);
  const names = glyphNames(e);
  const big = ICON_SIZE.xl;
  const label = { color: 'textSecondary' as const, marginTop: theme.spacing.xs };
  return (
    <View
      style={{
        marginBottom: theme.spacing.md,
        padding: theme.spacing.sm,
        backgroundColor: theme.colors.surface,
        borderRadius: theme.radius.control,
        borderWidth: theme.stroke.hairline,
        borderColor: theme.colors.divider,
        ...CONTINUOUS,
      }}
    >
      <AppText variant="headline">{k}</AppText>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, marginVertical: theme.spacing.xs }}>
        <View style={{ alignItems: 'center', gap: 4 }}>
          <Glyph k={k} style="outline" px={big} color={color} />
          <AppText variant="caption2" color="textSecondary">線條</AppText>
        </View>
        <View style={{ alignItems: 'center', gap: 4 }}>
          <Glyph k={k} style="filled" px={big} color={color} />
          <AppText variant="caption2" color="textSecondary">實心</AppText>
        </View>
        {e.custom === 'fistbump' ? (
          <View style={{ alignItems: 'center', gap: 4 }}>
            <View style={{ width: big, height: big }}>
              <FistBumpIcon variant="filled" size={big} color={color} />
              <FistBumpBurst size={big} color={color} />
            </View>
            <AppText variant="caption2" color="textSecondary" style={{ marginTop: big / 4 }}>FistBumpBurst</AppText>
          </View>
        ) : null}
      </View>
      <AppText variant="caption1" {...label}>用法</AppText>
      {lines.map((l) => (
        <AppText key={l} variant="footnote" style={{ fontFamily: 'monospace' }}>
          {l}
        </AppText>
      ))}
      {names.length > 0 ? (
        <>
          <AppText variant="caption1" {...label}>Ionicons</AppText>
          <AppText variant="footnote" style={{ fontFamily: 'monospace' }}>
            {names.join(' / ')}
          </AppText>
        </>
      ) : null}
      <View style={{ marginTop: theme.spacing.xs, alignItems: 'flex-start' }}>
        <Button
          label={copied ? '已複製' : '複製程式碼'}
          variant="secondary"
          size="sm"
          icon={copied ? ICON.selected.outline : undefined}
          onPress={() => {
            void copyText(lines.join('\n')).then((ok) => {
              setCopied(ok);
              if (ok) setTimeout(() => setCopied(false), 1500);
            });
          }}
        />
      </View>
    </View>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }): React.JSX.Element {
  const { theme } = useTheme();
  return (
    <View style={{ marginBottom: theme.spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: theme.spacing.xs, marginBottom: theme.spacing.xs }}>
        <AppText variant="headline">{title}</AppText>
        <AppText variant="footnote" color="textSecondary">{String(count)}</AppText>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -theme.spacing.xs / 2 }}>{children}</View>
    </View>
  );
}

function Gallery({ size, color, only }: Props & { only?: string }): React.JSX.Element {
  const { theme } = useTheme();
  const [query, setQuery] = useState('');
  const [style, setStyle] = useState<Style>('outline');
  const [selected, setSelected] = useState<IconKey | null>(null);
  const px = ICON_SIZE[size];
  const c = theme.colors[color];
  const q = query.trim().toLowerCase();
  const matches = (k: IconKey): boolean => q === '' || k.toLowerCase().includes(q) || glyphNames(ICON[k] as Entry).some((n) => n.includes(q));
  const grouped = new Set<IconKey>(ICON_GROUPS.flatMap((g) => g.keys));
  const ungrouped = ALL_KEYS.filter((k) => !grouped.has(k) && matches(k));
  const groups = (only ? ICON_GROUPS.filter((g) => g.id === only) : ICON_GROUPS)
    .map((g) => ({ ...g, keys: g.keys.filter(matches) }))
    .filter((g) => g.keys.length > 0);
  const tile = (k: IconKey): React.JSX.Element => (
    <Tile key={k} k={k} style={style} px={px} color={c} selected={selected === k} onPress={() => setSelected(selected === k ? null : k)} />
  );
  return (
    <ScrollView contentContainerStyle={{ padding: theme.layout.screenMarginCompact + 8 }}>
      <AppText variant="title3" style={{ marginBottom: theme.spacing.xs }}>
        Icons
      </AppText>
      <AppText variant="footnote" color="textSecondary" style={{ marginBottom: theme.spacing.sm }}>
        全 App 統一使用 Ionicons；點選圖示可看用法並複製程式碼。
      </AppText>
      <View style={{ gap: theme.spacing.xs, marginBottom: theme.spacing.md }}>
        <TextField variant="search" value={query} onChangeText={setQuery} placeholder="搜尋名稱或 Ionicons 字樣" accessibilityLabel="搜尋圖示" />
        <SegmentedControl variant="compact" options={STYLE_OPTIONS} value={style} onChange={setStyle} accessibilityLabel="圖示樣式" hapticPurpose="icon-style" />
      </View>
      {selected ? <Detail key={selected} k={selected} color={c} /> : null}
      {groups.map((g) => (
        <Section key={g.id} title={g.title} count={g.keys.length}>
          {g.keys.map(tile)}
        </Section>
      ))}
      {!only && ungrouped.length > 0 ? (
        <Section title="Ungrouped" count={ungrouped.length}>
          <View style={{ width: '100%' }}>
            <AppText variant="footnote" color="error" style={{ marginBottom: theme.spacing.xs }}>
              {`Warning: add these keys to ICON_GROUPS in stories/iconGroups.ts: ${ungrouped.join(', ')}`}
            </AppText>
          </View>
          {ungrouped.map(tile)}
        </Section>
      ) : null}
      {groups.length === 0 && ungrouped.length === 0 ? (
        <AppText variant="footnote" color="textSecondary">沒有符合的圖示</AppText>
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
