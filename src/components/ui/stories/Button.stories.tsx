import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';
import { View } from 'react-native';

import { ForcedTheme } from '../../../../.storybook/ForcedTheme';
import { ICON } from '../../../lib/icons';
import { AppText } from '../AppText';
import { Button } from '../Button';
import type { ButtonProps, TextPlacement } from '../Button';
import { SectionHeader } from '../SectionHeader';
import { textHitSlop } from '../TextButton';
import { useTheme } from '../../../lib/theme';
import { ON_OPTIONS, Row, SurfaceBox } from './_helpers';

const icons = { none: undefined, add: ICON.add.outline, log: ICON.log.outline, delete: ICON.delete.outline, block: ICON.block.outline, upload: ICON.upload.outline, follow: ICON.follow.outline, retry: ICON.retry.outline, forward: ICON.forward.outline, external: ICON.external.outline };

function Demo(props: ButtonProps): React.JSX.Element {
  return (
    <SurfaceBox on={props.on ?? 'surface'}>
      <View>
        <Button {...props} />
      </View>
    </SurfaceBox>
  );
}

const meta: Meta<ButtonProps> = {
  title: 'Components/Button',
  component: Demo,
  args: { label: '記錄完攀', variant: 'primary', size: 'lg', on: 'surface', loading: false, disabled: false, fullWidth: false },
  argTypes: {
    variant: { control: 'inline-radio', options: ['primary', 'secondary', 'destructive', 'destructiveTonal', 'ghost', 'text'] },
    placement: { control: 'inline-radio', options: ['trailing', 'inline', 'centered', 'bar', 'container'], description: 'text only: the role (T1 trailing / T2 inline / T3 centered / T4 bar / T5 container)' },
    afterPrimary: { control: 'boolean', description: 'text + centered: a primary button sits right above' },
    size: { control: 'inline-radio', options: ['lg', 'md', 'sm'], description: 'lg 52 / md 44 / sm 32 (+6 hitSlop). Always a capsule' },
    on: { control: 'inline-radio', options: ON_OPTIONS, description: 'Surface under the button; decides the ghost pressed colour' },
    icon: { control: 'select', options: Object.keys(icons), mapping: icons },
    trailingIcon: { control: 'select', options: Object.keys(icons), mapping: icons },
    onPress: { action: 'pressed' },
  },
};
export default meta;

/** Every state is a control: variant, size, on, loading, disabled, icon. Press to see the pressed colour. */
export const Playground: StoryObj<ButtonProps> = {};

/** Genuinely different layout: stacked full-width confirm actions (destructive on top, cancel below). */
export const ConfirmStack: StoryObj<ButtonProps> = {
  render: () => (
    <View style={{ padding: 16, width: 375 }}>
      <Button variant="destructive" size="lg" fullWidth label="封鎖" icon={ICON.block.outline} onPress={() => {}} />
      <View style={{ height: 8 }} />
      <Button variant="secondary" size="lg" fullWidth label="取消" onPress={() => {}} />
    </View>
  ),
};

/** Every variant x state (default / disabled / loading) and the three sizes. Press any button to see press / release. */
export const AllStates: StoryObj<ButtonProps> = {
  render: () => (
    <View style={{ padding: 16, width: 420 }}>
      {(['primary', 'secondary', 'destructive', 'destructiveTonal', 'ghost', 'text'] as const).map((v) => (
        <Row key={v} label={v}>
          <View style={{ flexDirection: 'row', columnGap: 8 }}>
            <Button variant={v} label="送出" onPress={() => {}} />
            <Button variant={v} label="停用" disabled onPress={() => {}} />
            <Button variant={v} label="載入" loading onPress={() => {}} />
          </View>
        </Row>
      ))}
      <Row label="lg 52 / md 44 / sm 32">
        <View style={{ flexDirection: 'row', columnGap: 8, alignItems: 'center' }}>
          <Button size="lg" label="記錄完攀" onPress={() => {}} />
          <Button size="md" label="記錄完攀" onPress={() => {}} />
          <Button size="sm" variant="secondary" label="追蹤" onPress={() => {}} />
        </View>
      </Row>
      <Row label="icon + full-width lg (press = pressWide 0.98)">
        <Button size="lg" fullWidth icon={ICON.log.outline} label="記錄完攀" onPress={() => {}} />
      </Row>
    </View>
  ),
};

/** Draws the 44pt touch target (RN-web has no hitSlop) as a dashed box around a button: `Button` is the single child. */
function SlopBox({ placement, size = 'md', afterPrimary = true, children }: { placement: TextPlacement; size?: 'md' | 'sm'; afterPrimary?: boolean; children: React.ReactNode }): React.JSX.Element {
  const { theme } = useTheme();
  const line = theme.typeScale[size === 'sm' ? 'footnote' : 'subhead'].lineHeight;
  const s = textHitSlop(placement, line, theme.layout.minTouchTarget, null, afterPrimary);
  return (
    <View style={{ alignSelf: placement === 'centered' ? 'center' : 'flex-start' }}>
      {children}
      <View
        pointerEvents="none"
        style={{ position: 'absolute', top: -(s.top ?? 0), bottom: -(s.bottom ?? 0), left: -(s.left ?? 0), right: -(s.right ?? 0), borderWidth: 1, borderStyle: 'dashed', borderColor: theme.colors.outline }}
      />
    </View>
  );
}

const ROLES: { key: string; label: string; placement: TextPlacement; size?: 'md' | 'sm'; note: string; afterPrimary?: boolean; text: string }[] = [
  { key: 'T1', label: '查看全部', placement: 'trailing', note: 'trailing, in SectionHeader (see below)', text: '' },
  { key: 'T2', label: '更多', placement: 'inline', size: 'sm', note: 'inline sm (under a footnote)', text: '這是一段備註，字級是 footnote。' },
  { key: 'T2 md', label: '找路線', placement: 'inline', note: 'inline md (E2 / list footer)', text: '還沒有完攀紀錄。' },
  { key: 'T3', label: '已有帳號？登入', placement: 'centered', note: 'centered, 8 under the primary', text: '' },
  { key: 'T4', label: '取消', placement: 'bar', note: 'bar (modal top bar)', text: '' },
  { key: 'T5', label: '重試', placement: 'container', size: 'sm', note: 'container sm, on tinted', text: '' },
];

function RoleRows(): React.JSX.Element {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <View style={{ backgroundColor: c.background, padding: 16, width: 420 }}>
      {ROLES.filter((r) => r.key !== 'T1').map((r) => (
        <Row key={r.key} label={`${r.key}  ${r.note}`}>
          <View style={{ backgroundColor: r.placement === 'container' ? c.surfaceAlt : undefined, padding: r.placement === 'container' ? 16 : 0, borderRadius: 12, paddingVertical: 14 }}>
            {r.text ? (
              <AppText variant={r.size === 'sm' ? 'footnote' : 'subhead'} color="textSecondary" style={{ marginBottom: 8 }}>
                {r.text}
              </AppText>
            ) : null}
            {r.placement === 'centered' ? (
              <View style={{ alignItems: 'center' }}>
                <Button variant="primary" size="md" label="建立帳號" onPress={() => {}} />
                <View style={{ height: 8 }} />
                <SlopBox placement="centered">
                  <Button variant="text" placement="centered" label={r.label} onPress={() => {}} />
                </SlopBox>
              </View>
            ) : (
              <SlopBox placement={r.placement} size={r.size}>
                <Button variant="text" size={r.size} placement={r.placement} on={r.placement === 'container' ? 'tinted' : 'background'} label={r.label} onPress={() => {}} />
              </SlopBox>
            )}
          </View>
        </Row>
      ))}
      <Row label="T1  trailing slot: baseline-aligned with the title; same place whatever the state">
        <SectionHeader title="最近完攀" action={{ label: '查看全部', onPress: () => {} }} />
        <View style={{ height: 8 }} />
        <SectionHeader title="今日路線" action={{ label: '瀏覽路線', onPress: () => {} }} />
        <View style={{ height: 8 }} />
        <SectionHeader title="完攀紀錄" action={{ label: '上傳中', onPress: () => {}, loading: true }} />
        <View style={{ height: 8 }} />
        <SectionHeader title="只有標題" />
      </Row>
      <Row label="states: default / disabled / loading (md and sm) + external icon (not in empty states)">
        <View style={{ flexDirection: 'row', columnGap: 24, alignItems: 'center', marginBottom: 8 }}>
          <Button variant="text" label="預設" onPress={() => {}} />
          <Button variant="text" label="停用" disabled onPress={() => {}} />
          <Button variant="text" label="載入中" loading onPress={() => {}} />
          <Button variant="text" label="開啟地圖" trailingIcon={ICON.external.outline} onPress={() => {}} />
        </View>
        <View style={{ flexDirection: 'row', columnGap: 24, alignItems: 'center' }}>
          <Button variant="text" size="sm" label="預設" onPress={() => {}} />
          <Button variant="text" size="sm" label="停用" disabled onPress={() => {}} />
          <Button variant="text" size="sm" label="載入中" loading onPress={() => {}} />
        </View>
      </Row>
    </View>
  );
}

/** Text button: all five roles (dashed box = the 44pt touch target, RN-web draws it, native uses hitSlop), T1 baseline rows and every state, light and dark. */
export const Text: StoryObj<ButtonProps> = {
  parameters: { layout: 'fullscreen' },
  render: () => (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      <ForcedTheme mode="light">
        <RoleRows />
      </ForcedTheme>
      <ForcedTheme mode="dark">
        <RoleRows />
      </ForcedTheme>
    </View>
  ),
};
