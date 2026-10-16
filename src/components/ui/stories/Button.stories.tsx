import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';
import { View } from 'react-native';

import { ICON } from '../../../lib/icons';
import { Button } from '../Button';
import type { ButtonProps } from '../Button';
import { ON_OPTIONS, SurfaceBox } from './_helpers';

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
  title: 'UI/Button',
  component: Demo,
  args: { label: '記錄完攀', variant: 'primary', size: 'lg', on: 'surface', loading: false, disabled: false, fullWidth: false },
  argTypes: {
    variant: { control: 'inline-radio', options: ['primary', 'secondary', 'destructive', 'ghost'] },
    size: { control: 'inline-radio', options: ['lg', 'md', 'sm'], description: 'lg 50 / md 44 / sm 32 (+6 hitSlop)' },
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
