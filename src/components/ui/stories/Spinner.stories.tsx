import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';
import { View } from 'react-native';

import { useTheme } from '../../../lib/theme';
import { Spinner } from '../ProgressBar';
import type { SpinnerProps } from '../ProgressBar';

function Demo(props: SpinnerProps): React.JSX.Element {
  const { theme } = useTheme();
  return (
    <View style={{ padding: 16, width: 375 }}>
      <View style={{ padding: 16, borderRadius: theme.borderRadius.lg, alignItems: 'center', backgroundColor: props.color === 'onMedia' ? theme.colors.mediaBackground : theme.colors.surface }}>
        <Spinner {...props} />
      </View>
    </View>
  );
}

const meta: Meta<SpinnerProps> = {
  title: 'Components/Spinner',
  component: Demo,
  args: { color: 'textSecondary', size: 'small' },
  argTypes: {
    color: { control: 'inline-radio', options: ['textSecondary', 'onMedia', 'primary'] },
    size: { control: 'inline-radio', options: ['small', 'large'] },
  },
};
export default meta;

export const Playground: StoryObj<SpinnerProps> = {};
