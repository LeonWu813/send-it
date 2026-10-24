import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';
import { Pressable, View } from 'react-native';

import { useTheme } from '../../../lib/theme';
import { AppText } from '../AppText';
import { FistBumpBurst, FistBumpIcon } from '../FistBumpIcon';
import { FistBumpLike } from '../FistBumpLike';
import type { FistBumpIconProps } from '../FistBumpIcon';
import { Row } from './_helpers';

type Surface = 'light' | 'dark' | 'onMedia';
const SIZES = [16, 20, 28, 44] as const;

function Panel({ surface, children }: { surface: Surface; children: React.ReactNode }): React.JSX.Element {
  const bg = surface === 'light' ? '#FFFFFF' : surface === 'dark' ? '#1C1B1F' : '#3A4A5A';
  return <View style={{ backgroundColor: bg, padding: 16, borderRadius: 12, flex: 1, minWidth: 180 }}>{children}</View>;
}

function inkFor(surface: Surface, themeInk: string): string {
  return surface === 'light' ? '#1C1B1F' : surface === 'dark' ? '#FFFFFF' : surface === 'onMedia' ? '#FFFFFF' : themeInk;
}

function Matrix(): React.JSX.Element {
  const { theme } = useTheme();
  const surfaces: Surface[] = ['light', 'dark', 'onMedia'];
  return (
    <View style={{ padding: 16, gap: 16 }}>
      <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
        {surfaces.map((s) => (
          <Panel key={s} surface={s}>
            <AppText variant="footnote" style={{ color: inkFor(s, theme.colors.textPrimary), marginBottom: 8, fontFamily: 'monospace' }}>
              {s}
            </AppText>
            {(['outline', 'filled'] as const).map((variant) => (
              <View key={variant} style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 20, marginBottom: 12 }}>
                {SIZES.map((size) => (
                  <FistBumpIcon key={size} variant={variant} size={size} color={inkFor(s, theme.colors.textPrimary)} />
                ))}
              </View>
            ))}
          </Panel>
        ))}
      </View>
      <AppText variant="footnote" color="textSecondary">
        Sizes 16 / 20 / 28 / 44. Side-view right fist (v6), knuckles left; never flipped or rotated. Filled is drawn from 20pt; the 16pt filled row falls back to the outline.
      </AppText>
    </View>
  );
}

function TapDemo(): React.JSX.Element {
  const { theme } = useTheme();
  const [liked, setLiked] = React.useState(false);
  const [playKey, setPlayKey] = React.useState(0);
  const [contacts, setContacts] = React.useState(0);
  const press = (): void => {
    if (!liked) setPlayKey((k) => k + 1);
    setLiked(!liked);
  };
  const cases: { label: string; size: number; color: string; bg: string }[] = [
    { label: 'Reel 28pt onMedia', size: 28, color: '#FFFFFF', bg: '#3A4A5A' },
    { label: 'Feed 20pt textSecondary / primary', size: 20, color: liked ? theme.colors.primary : theme.colors.textSecondary, bg: '#FFFFFF' },
  ];
  return (
    <View style={{ padding: 16, gap: 16 }}>
      <AppText variant="footnote" color="textSecondary">
        Tap to like (plays the bump), tap again to unlike (cross-fade). Toolbar: Reduce Motion and slow motion apply. onContact calls: {contacts}
      </AppText>
      {cases.map((cs) => (
        <View key={cs.label} style={{ backgroundColor: cs.bg, padding: 24, borderRadius: 12, alignItems: 'flex-start' }}>
          <AppText variant="footnote" style={{ color: cs.bg === '#FFFFFF' ? '#1C1B1F' : '#FFFFFF', marginBottom: 12, fontFamily: 'monospace' }}>
            {cs.label}
          </AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: liked }}
            onPress={press}
            style={{ width: 44, height: 44, marginLeft: 48, alignItems: 'center', justifyContent: 'center' }}
          >
            <FistBumpLike liked={liked} playKey={playKey} size={cs.size} color={cs.color} onContact={() => setContacts((n) => n + 1)} />
          </Pressable>
        </View>
      ))}
    </View>
  );
}

function BurstDemo(): React.JSX.Element {
  return (
    <View style={{ padding: 16 }}>
      <Row label="FistBumpBurst (deprecated alias): both v6 tick groups over filled; static">
        <View style={{ backgroundColor: '#3A4A5A', padding: 48, borderRadius: 12, flexDirection: 'row', gap: 64, alignItems: 'center' }}>
          {[28, 44, 84].map((size) => (
            <View key={size} style={{ width: size, height: size }}>
              <FistBumpIcon variant="filled" size={size} color="#FFFFFF" />
              <FistBumpBurst size={size} color="#FFFFFF" />
            </View>
          ))}
        </View>
      </Row>
    </View>
  );
}

const meta: Meta<FistBumpIconProps> = {
  title: 'Components/FistBumpIcon',
  component: FistBumpIcon,
  args: { variant: 'outline', size: 28, color: '#1C1B1F' },
  argTypes: { variant: { control: 'inline-radio', options: ['outline', 'filled'] }, size: { control: { type: 'number', min: 16, max: 96 } }, color: { control: 'color' } },
};
export default meta;

export const Default: StoryObj<FistBumpIconProps> = {};
export const SizesAndSurfaces: StoryObj<FistBumpIconProps> = { render: () => <Matrix /> };
export const TapToLike: StoryObj<FistBumpIconProps> = { name: 'Tap to like', render: () => <TapDemo /> };
export const Burst: StoryObj<FistBumpIconProps> = { render: () => <BurstDemo /> };
