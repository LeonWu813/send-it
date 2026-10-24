import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';
import { View } from 'react-native';

import { Button } from '../Button';
import { CelebrationHost, useCelebration } from '../CelebrationHost';
import type { CelebrationContent } from '../CelebrationHost';

function Trigger(props: CelebrationContent): React.JSX.Element {
  const { celebrate } = useCelebration();
  return (
    <View style={{ padding: 16, flex: 1 }}>
      <Button label="Celebrate" onPress={() => celebrate(props)} />
    </View>
  );
}

function Demo(props: CelebrationContent): React.JSX.Element {
  return (
    <CelebrationHost>
      <Trigger {...props} />
    </CelebrationHost>
  );
}

const meta: Meta<CelebrationContent> = {
  title: 'Components/CelebrationHost',
  component: Demo,
  args: { title: '新的最高難度：V5', subtitle: '恭喜完攀！', actionLabel: '查看', flash: false },
  argTypes: { onAction: { action: 'view' } },
};
export default meta;

export const Playground: StoryObj<CelebrationContent> = {};
