import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React, { useState } from 'react';
import { View } from 'react-native';

import { Button } from '../Button';
import { SendStyleChip, SendStylePicker } from '../SendStyleChip';
import type { SendStyle, SendStyleChipProps } from '../SendStyleChip';

type Args = SendStyleChipProps & { picker: boolean };

function Demo({ picker, ...props }: Args): React.JSX.Element {
  const [value, setValue] = useState<SendStyle | undefined>(undefined);
  const [landing, setLanding] = useState(0);
  return (
    <View style={{ padding: 16, width: 375, rowGap: 16 }}>
      {picker ? (
        <SendStylePicker value={value} onChange={setValue} />
      ) : (
        <>
          <SendStyleChip {...props} landing={landing} />
          <Button variant="secondary" size="sm" label="Replay landing pop" onPress={() => setLanding((n) => n + 1)} />
        </>
      )}
    </View>
  );
}

const meta: Meta<Args> = {
  title: 'UI/SendStyleChip',
  component: Demo,
  args: { sendStyle: 'flash', attempts: 3, burst: false, picker: false },
  argTypes: {
    sendStyle: { control: 'inline-radio', options: ['top', 'flash', 'attempt'] },
    picker: { control: 'boolean', description: 'true = the log-send selector (3 choice chips)' },
  },
};
export default meta;

export const Playground: StoryObj<Args> = {};
