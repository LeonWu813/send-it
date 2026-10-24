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
      <View style={{ padding: 16, borderRadius: theme.borderRadius.lg, alignItems: 'center', backgroundColor: props.context === 'media' || props.context === 'mediaControl' || props.color === 'onMedia' ? theme.colors.mediaBackground : theme.colors.surface }}>
        <Spinner {...props} />
      </View>
    </View>
  );
}

const meta: Meta<SpinnerProps> = {
  title: 'Components/Spinner',
  component: Demo,
  args: { context: 'section', color: undefined, size: undefined },
  argTypes: {
    context: { control: 'inline-radio', options: ['page', 'section', 'control', 'field', 'media', 'mediaControl'], description: 'decides size and colour (page/media large; media* onMedia)' },
    color: { control: 'inline-radio', options: [undefined, 'textSecondary', 'onMedia', 'primary'], description: 'control only (the button colour); deprecated elsewhere' },
    size: { control: 'inline-radio', options: [undefined, 'small', 'large'], description: 'deprecated: use context' },
  },
};
export default meta;

export const Playground: StoryObj<SpinnerProps> = {};
