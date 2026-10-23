import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';
import { View } from 'react-native';

import { useTheme } from '../../../lib/theme';
import { AppText } from '../AppText';
import { FistBumpBurst, FistBumpIcon } from '../FistBumpIcon';
import type { FistBumpIconProps } from '../FistBumpIcon';
import { Row } from './_helpers';

type Surface = 'light' | 'dark' | 'onMedia';
const SIZES = [16, 28, 44] as const;

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
        Sizes 16 / 28 / 44. Minimum 16pt. Fist always faces left.
      </AppText>
    </View>
  );
}

function BurstDemo(): React.JSX.Element {
  return (
    <View style={{ padding: 16 }}>
      <Row label="FistBumpBurst over filled (1.5x size, offset -size/4); static, animation is the caller's job">
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
export const Burst: StoryObj<FistBumpIconProps> = { render: () => <BurstDemo /> };
