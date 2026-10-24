import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';
import { View } from 'react-native';

import { useTheme } from '../../../lib/theme';
import { AppText } from '../AppText';
import { PressableScale } from '../PressableScale';
import type { PressableScaleProps } from '../PressableScale';

function Demo(props: PressableScaleProps): React.JSX.Element {
  const { theme } = useTheme();
  return (
    <View style={{ padding: 16 }}>
      <PressableScale
        {...props}
        pressedColor={theme.colors.surfacePressed}
        style={{ backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.lg, padding: 16, minHeight: 44 }}
        accessibilityLabel="Press me"
      >
        <AppText variant="subhead">Press and hold (control: scales 0.96; row: colour only)</AppText>
      </PressableScale>
    </View>
  );
}

const meta: Meta<PressableScaleProps> = {
  title: 'Components/PressableScale',
  component: Demo,
  args: { feedback: 'control', inScroll: false },
  argTypes: { feedback: { control: 'inline-radio', options: ['control', 'row'] } },
};
export default meta;

export const Playground: StoryObj<PressableScaleProps> = {};
