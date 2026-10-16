import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React, { useState } from 'react';
import { View } from 'react-native';

import { AppText } from '../AppText';
import { BottomSheet } from '../BottomSheet';
import type { BottomSheetProps } from '../BottomSheet';
import { Button } from '../Button';

function Demo(props: BottomSheetProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ padding: 16 }}>
      <Button label="Open sheet" onPress={() => setOpen(true)} />
      <BottomSheet {...props} visible={open} onClose={() => setOpen(false)}>
        <AppText variant="body" color="textSecondary">Sheet content</AppText>
        <View style={{ height: 12 }} />
        <Button label={props.variant === 'confirm' ? '封鎖' : '完成'} variant={props.variant === 'confirm' ? 'destructive' : 'primary'} onPress={() => setOpen(false)} />
      </BottomSheet>
    </View>
  );
}

const meta: Meta<BottomSheetProps> = {
  title: 'UI/BottomSheet',
  component: Demo,
  args: { title: '標題', variant: 'default', loading: false },
  argTypes: { variant: { control: 'inline-radio', options: ['default', 'confirm'] } },
};
export default meta;

export const Playground: StoryObj<BottomSheetProps> = {};
