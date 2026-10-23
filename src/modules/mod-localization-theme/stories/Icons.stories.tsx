import { Ionicons } from '@expo/vector-icons';
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';
import { ScrollView, View } from 'react-native';

import { AppText } from '../../../components/ui/AppText';
import { ICON } from '../../../lib/icons';
import type { IoniconName } from '../../../lib/icons';
import { ICON_SIZE, useTheme } from '../../../lib/theme';

type Entry = { outline?: IoniconName; filled?: IoniconName; on?: IoniconName };
type IconSizeKey = keyof typeof ICON_SIZE;

function Icons({ size, color }: { size: IconSizeKey; color: 'textPrimary' | 'textSecondary' | 'primary' }): React.JSX.Element {
  const { theme } = useTheme();
  const px = ICON_SIZE[size];
  const entries = Object.entries(ICON) as [string, Entry][];
  return (
    <ScrollView contentContainerStyle={{ padding: theme.layout.screenMarginCompact + 8 }}>
      <AppText variant="title3" style={{ marginBottom: theme.spacing.sm }}>
        {`ICON dictionary (${entries.length} concepts, one glyph per concept)`}
      </AppText>
      <AppText variant="footnote" color="textSecondary" style={{ marginBottom: theme.spacing.md }}>
        outline = default / off, filled = on / achieved, on = a non-filled toggle's other state. Use ICON.concept.outline in code, never glyph strings.
      </AppText>
      {entries.map(([key, e]) => (
        <View key={key} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: theme.spacing.xs, borderBottomWidth: theme.stroke.hairline, borderBottomColor: theme.colors.divider }}>
          <AppText variant="footnote" weight="600" style={{ width: 150 }}>
            {key}
          </AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', flex: 1 }}>
            <GlyphColored name={e.outline} size={px} caption="no outline" color={color} />
            <GlyphColored name={e.filled} size={px} caption="no filled" color={color} />
            {e.on ? <GlyphColored name={e.on} size={px} caption="" color={color} /> : null}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

function GlyphColored({ name, size, caption, color }: { name?: IoniconName; size: number; caption: string; color: 'textPrimary' | 'textSecondary' | 'primary' }): React.JSX.Element {
  const { theme } = useTheme();
  return (
    <View style={{ width: 150, alignItems: 'center' }}>
      <View style={{ height: 32, justifyContent: 'center' }}>
        {name ? <Ionicons name={name} size={size} color={theme.colors[color]} /> : <AppText variant="caption1" color="textDisabled">—</AppText>}
      </View>
      <AppText variant="caption2" color="textSecondary" numberOfLines={1}>
        {name ?? caption}
      </AppText>
    </View>
  );
}

const meta: Meta<typeof Icons> = {
  title: 'Foundations/Icons',
  tags: ['!autodocs'],
  component: Icons,
  args: { size: 'lg', color: 'textPrimary' },
  argTypes: {
    size: { control: 'inline-radio', options: ['xs', 'sm', 'md', 'lg', 'tab', 'xl'], description: 'ICON_SIZE token' },
    color: { control: 'inline-radio', options: ['textPrimary', 'textSecondary', 'primary'] },
  },
};
export default meta;

export const AllIcons: StoryObj<typeof Icons> = {};
