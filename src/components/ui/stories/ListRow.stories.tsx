import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';

import { ICON } from '../../../lib/icons';
import { useTheme } from '../../../lib/theme';
import { Avatar } from '../Avatar';
import { ListRow } from '../ListRow';
import type { ListRowProps } from '../ListRow';

function Demo({ selected: sel, toggleValue: tv, ...rest }: ListRowProps & { withLeadingIcon: boolean; withAvatar: boolean }): React.JSX.Element {
  const { theme } = useTheme();
  const { withLeadingIcon, withAvatar, ...row } = rest as ListRowProps & { withLeadingIcon: boolean; withAvatar: boolean };
  const [selected, setSelected] = useState(!!sel);
  const [toggle, setToggle] = useState(!!tv);
  useEffect(() => setSelected(!!sel), [sel]);
  useEffect(() => setToggle(!!tv), [tv]);
  const elevated = row.on === 'elevated';
  return (
    <View style={{ padding: 16, width: 375 }}>
      <View style={{ backgroundColor: elevated ? theme.colors.surfaceElevated : theme.colors.surface, borderRadius: theme.borderRadius.lg, overflow: 'hidden' }}>
        <ListRow
          {...row}
          leadingIcon={withLeadingIcon ? ICON.language.outline : undefined}
          leading={withAvatar ? <Avatar size="md" name="小明" decorative /> : undefined}
          leadingWidth={withAvatar ? theme.avatarSize.md : undefined}
          selected={selected}
          toggleValue={toggle}
          onToggle={setToggle}
          onPress={() => (row.variant === 'selectable' || row.variant === 'radio' ? setSelected((s) => !s) : row.variant === 'toggle' ? setToggle((s) => !s) : undefined)}
        />
        <ListRow variant="navigation" title="第二列（顯示分隔線）" divider={false} on={row.on} />
      </View>
    </View>
  );
}

const meta: Meta<ListRowProps & { withLeadingIcon: boolean; withAvatar: boolean }> = {
  title: 'UI/ListRow',
  component: Demo,
  args: {
    variant: 'navigation',
    title: '語言',
    subtitle: '',
    value: '繁體中文',
    density: 'settings',
    on: 'surface',
    inset: 'grouped',
    divider: true,
    selected: false,
    toggleValue: false,
    destructive: false,
    disabled: false,
    buttonLabel: '解除封鎖',
    withLeadingIcon: false,
    withAvatar: false,
  },
  argTypes: {
    variant: { control: 'select', options: ['navigation', 'value', 'toggle', 'selectable', 'radio', 'action', 'withButton'] },
    density: { control: 'inline-radio', options: ['settings', 'content'] },
    on: { control: 'inline-radio', options: ['surface', 'elevated'], description: 'elevated = inside a BottomSheet (divider uses border)' },
    inset: { control: 'inline-radio', options: ['screen', 'grouped'] },
    buttonVariant: { control: 'inline-radio', options: ['secondary', 'primary'] },
  },
};
export default meta;

export const Playground: StoryObj<ListRowProps & { withLeadingIcon: boolean; withAvatar: boolean }> = {};
