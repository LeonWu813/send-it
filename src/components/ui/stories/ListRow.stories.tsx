import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';

import { ICON } from '../../../lib/icons';
import { useTheme } from '../../../lib/theme';
import { Avatar } from '../Avatar';
import { ListRow } from '../ListRow';
import { SendStatus } from '../SendStatus';
import { AppText } from '../AppText';
import { Row } from './_helpers';
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
      <View style={{ backgroundColor: elevated ? theme.colors.surfaceElevated : theme.colors.surface, borderRadius: theme.radius.card, borderCurve: 'continuous', overflow: 'hidden' }}>
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
  title: 'Components/ListRow',
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
    variant: { control: 'select', options: ['navigation', 'value', 'toggle', 'selectable', 'radio', 'action', 'withButton', 'content'] },
    density: { control: 'inline-radio', options: ['settings', 'content'] },
    on: { control: 'inline-radio', options: ['surface', 'elevated'], description: 'elevated = inside a BottomSheet (divider uses border)' },
    inset: { control: 'inline-radio', options: ['screen', 'grouped'] },
    buttonVariant: { control: 'inline-radio', options: ['secondary', 'primary'] },
  },
};
export default meta;

export const Playground: StoryObj<ListRowProps & { withLeadingIcon: boolean; withAvatar: boolean }> = {};

/** Grouped container (card 20) with every variant, including the ProjectDay `content` row (thumbnail 56 + status disc). */
export const AllStates: StoryObj<ListRowProps & { withLeadingIcon: boolean; withAvatar: boolean }> = {
  render: () => <AllRows />,
};

function Thumb({ label }: { label: string }): React.JSX.Element {
  const { theme } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
      <AppText variant="headline">{label}</AppText>
    </View>
  );
}

function AllRows(): React.JSX.Element {
  const { theme } = useTheme();
  const group = { backgroundColor: theme.colors.surface, borderRadius: theme.radius.card, borderCurve: 'continuous' as const, overflow: 'hidden' as const };
  return (
    <View style={{ padding: 16, width: 375 }}>
      <Row label="content: thumbnail 56 + SendStatus disc, divider from x=84">
        <View style={group}>
          <ListRow variant="content" title="V4 紅色" subtitle="紅石岩館・昨天" thumbnail={<Thumb label="V4" />} leadingWidth={56} trailing={<SendStatus variant="disc" sendStyle="top" />} onPress={() => {}} />
          <ListRow variant="content" title="V5 藍色" subtitle="紅石岩館・3 天前" thumbnail={<Thumb label="V5" />} leadingWidth={56} trailing={<SendStatus variant="disc" sendStyle="flash" />} onPress={() => {}} />
          <ListRow variant="content" title="V3 白色" subtitle="嘗試 3 次" thumbnail={<Thumb label="V3" />} leadingWidth={56} trailing={<SendStatus variant="disc" sendStyle="attempt" />} divider={false} onPress={() => {}} />
        </View>
      </Row>
      <Row label="navigation / value / toggle / action">
        <View style={group}>
          <ListRow variant="navigation" title="通知" leadingIcon={ICON.notifications.outline} onPress={() => {}} />
          <ListRow variant="value" title="語言" value="繁體中文" onPress={() => {}} />
          <ListRow variant="toggle" title="推播通知" toggleValue onToggle={() => {}} />
          <ListRow variant="action" title="登出" divider={false} onPress={() => {}} />
        </View>
      </Row>
      <Row label="radio (selected / not) / selectable / disabled / withButton">
        <View style={group}>
          <ListRow variant="radio" title="垃圾訊息" selected onPress={() => {}} />
          <ListRow variant="radio" title="騷擾" onPress={() => {}} />
          <ListRow variant="selectable" title="V4" selected onPress={() => {}} />
          <ListRow variant="navigation" title="停用" disabled onPress={() => {}} />
          <ListRow variant="withButton" title="小明" buttonLabel="解除封鎖" onButtonPress={() => {}} divider={false} />
        </View>
      </Row>
    </View>
  );
}
