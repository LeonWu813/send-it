import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Card } from '../Card';
import { TextField } from '../TextField';
import { Row } from './_helpers';
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
  title: 'Components/TextField',
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

/** Grouped form (one Card, fields keep their own 1pt border + radius 12), search capsule and every state. */
export const AllStates: StoryObj<TextFieldProps> = {
  render: () => (
    <View style={{ padding: 16, width: 375 }}>
      <Row label="grouped form: card 20, padding 16, field gap 16">
        <Card>
          <View style={{ rowGap: 16 }}>
            <TextField label="暱稱" value="小人摳點" onChangeText={() => {}} />
            <TextField label="補充說明" variant="multiline" value="" placeholder="例如：Crimpy" onChangeText={() => {}} maxLength={280} showCount />
            <TextField label="難度" value="V4" readOnly onChangeText={() => {}} helper="難度由路線決定" />
          </View>
        </Card>
      </Row>
      <Row label="error / disabled / search (44 capsule) / search + value">
        <View style={{ rowGap: 12 }}>
          <TextField label="暱稱" value="" error="請輸入暱稱" onChangeText={() => {}} />
          <TextField label="暱稱" value="停用" disabled onChangeText={() => {}} />
          <TextField variant="search" accessibilityLabel="搜尋路線" placeholder="搜尋路線" value="" onChangeText={() => {}} />
          <TextField variant="search" accessibilityLabel="搜尋路線" value="紅色" onChangeText={() => {}} />
        </View>
      </Row>
    </View>
  ),
};
