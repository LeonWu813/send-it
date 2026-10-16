import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';

import { TextField } from '../TextField';
import type { TextFieldProps } from '../TextField';

function Demo({ value: initial, ...rest }: TextFieldProps): React.JSX.Element {
  const [value, setValue] = useState(initial);
  useEffect(() => setValue(initial), [initial]);
  return (
    <View style={{ padding: 16, width: 375 }}>
      <TextField {...rest} value={value} onChangeText={setValue} />
    </View>
  );
}

const meta: Meta<TextFieldProps> = {
  title: 'UI/TextField',
  component: Demo,
  args: {
    variant: 'singleLine',
    label: '暱稱',
    value: '',
    placeholder: '例如：小人摳點',
    helper: '',
    error: '',
    maxLength: 280,
    showCount: false,
    readOnly: false,
    disabled: false,
    secureTextEntry: false,
    loading: false,
  },
  argTypes: {
    variant: { control: 'inline-radio', options: ['singleLine', 'multiline', 'search'] },
    error: { control: 'text', description: 'Non-empty = red 1.5pt outline + InlineError field (icon + text)' },
    readOnly: { control: 'boolean', description: 'Value stays readable (textSecondary) + lock glyph; label says "read only"' },
  },
};
export default meta;

/** Focus the field to see the 1.5pt primary outline. search: type to get the clear button; secureTextEntry: eye toggle. */
export const Playground: StoryObj<TextFieldProps> = {};
