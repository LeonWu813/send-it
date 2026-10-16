import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';
import { View } from 'react-native';

import { AppText } from '../AppText';
import { Card } from '../Card';
import type { CardProps } from '../Card';

function Demo(props: CardProps): React.JSX.Element {
  return (
    <View style={{ padding: 16, width: 375 }}>
      <Card {...props} onPress={props.variant === 'pressable' ? () => {} : undefined}>
        <AppText variant="subhead" weight="600">
          紅色 V4 Crimpy 小人摳點
        </AppText>
        <AppText variant="caption1" color="textSecondary">
          紅石岩館・3 支 Beta
        </AppText>
      </Card>
    </View>
  );
}

const meta: Meta<CardProps> = {
  title: 'UI/Card',
  component: Demo,
  args: { variant: 'static', padding: 16 },
  argTypes: {
    variant: { control: 'inline-radio', options: ['static', 'pressable', 'elevated', 'tinted'] },
    padding: { control: 'inline-radio', options: [8, 16, 20], description: '16 = cardPadding; RouteCard 8; tinted prompt 20' },
  },
};
export default meta;

/** Light: shadow, no border. Dark: 1pt border, no shadow. pressable: colour only, never scales. */
export const Playground: StoryObj<CardProps> = {};
