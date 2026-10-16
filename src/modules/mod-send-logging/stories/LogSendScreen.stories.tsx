import type { Session } from '@supabase/supabase-js';
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';
import { View } from 'react-native';

import LogSendScreen from '../screens/LogSendScreen';

// Off-spec design work. Fake data only; the supabase stub resolves the insert.
const session = { user: { id: 'user-me' } } as unknown as Session;

const meta: Meta<typeof LogSendScreen> = {
  title: 'SendLogging/LogSendScreen',
  component: LogSendScreen,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <View style={{ width: 390, height: 780 }}>
        <Story />
      </View>
    ),
  ],
  args: { routeId: 'route-1', routeGrade: 'V4', session, onSuccess: () => {}, onCancel: () => {} },
};
export default meta;
type Story = StoryObj<typeof LogSendScreen>;

/** Try: pick Flash (bolt charges, attempts cross-fades to a locked 1), then Attempt; type 0 in attempts. */
export const Playground: Story = {};
