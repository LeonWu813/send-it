import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React, { useState } from 'react';
import { View } from 'react-native';

import { Button } from '../Button';
import { SendStatus } from '../SendStatus';
import type { SendStatusProps } from '../SendStatus';
import { SendStylePicker } from '../SendStyleChip';
import type { SendStyle } from '../SendStyleChip';
import { Row } from './_helpers';

type Args = SendStatusProps & { picker: boolean };

function Demo({ picker, ...props }: Args): React.JSX.Element {
  const [value, setValue] = useState<SendStyle>('top');
  const [landing, setLanding] = useState(0);
  return (
    <View style={{ padding: 16, width: 375, rowGap: 16 }}>
      {picker ? (
        <SendStylePicker value={value} onChange={setValue} />
      ) : (
        <>
          <SendStatus {...props} landing={landing} />
          <Button variant="secondary" size="sm" label="Replay landing pop" onPress={() => setLanding((n) => n + 1)} />
        </>
      )}
    </View>
  );
}

const meta: Meta<Args> = {
  title: 'Components/SendStatus',
  component: Demo,
  args: { sendStyle: 'flash', variant: 'tag', attempts: 3, burst: false, picker: false },
  argTypes: {
    sendStyle: { control: 'inline-radio', options: ['top', 'flash', 'attempt'] },
    variant: { control: 'inline-radio', options: ['disc', 'tag'] },
    picker: { control: 'boolean', description: 'true = the log-send selector (SegmentedControl icon variant)' },
  },
};
export default meta;

export const Playground: StoryObj<Args> = {};

/** disc 28 and tag 24, tonal and equal-weight for all three styles. */
export const AllStates: StoryObj<Args> = {
  render: () => (
    <View style={{ padding: 16, width: 375 }}>
      {(['disc', 'tag'] as const).map((v) => (
        <Row key={v} label={v}>
          <View style={{ flexDirection: 'row', columnGap: 12, alignItems: 'center' }}>
            <SendStatus variant={v} sendStyle="top" />
            <SendStatus variant={v} sendStyle="flash" />
            <SendStatus variant={v} sendStyle="attempt" attempts={3} />
          </View>
        </Row>
      ))}
    </View>
  ),
};
