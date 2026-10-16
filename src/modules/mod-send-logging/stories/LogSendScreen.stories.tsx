import type { Session } from '@supabase/supabase-js';
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';
import { View } from 'react-native';

import LogSendScreen from '../screens/LogSendScreen';

// Off-spec design work. Fake data only; the supabase stub resolves the insert.
const session = { user: { id: 'user-me' } } as unknown as Session;

interface PlaygroundArgs {
  /** Compact route summary card (card 20, padding 8, thumbnail 12, tape 6). Off = the plain form (AC-131). */
  showRouteSummary: boolean;
  routeColor: 'red' | 'blue' | 'green' | 'yellow' | 'black' | 'white';
  grade: string;
}

const meta: Meta<PlaygroundArgs> = {
  title: 'SendLogging/LogSendScreen',
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <View style={{ width: 390, height: 780 }}>
        <Story />
      </View>
    ),
  ],
  args: { showRouteSummary: true, routeColor: 'red', grade: 'V4' },
  argTypes: {
    showRouteSummary: { control: 'boolean' },
    routeColor: { control: 'select', options: ['red', 'blue', 'green', 'yellow', 'black', 'white'] },
    grade: { control: 'select', options: ['V0', 'V2', 'V4', 'V6', 'V9'] },
  },
  render: ({ showRouteSummary, routeColor, grade }) => (
    <LogSendScreen
      routeId="route-1"
      routeGrade={grade}
      routeSummary={
        showRouteSummary ? { color: routeColor, grade, title: '紅色 · A 區', subtitle: '紅石攀岩館' } : undefined
      }
      session={session}
      onSuccess={() => {}}
      onCancel={() => {}}
    />
  ),
};
export default meta;
type Story = StoryObj<PlaygroundArgs>;

/**
 * Try: pick Flash (the Stepper locks to 1 and announces it), then Send again (the previous count returns);
 * press and hold - / + for auto-repeat; tap the number to type (Done accessory); toggle the summary card.
 */
export const Playground: Story = {};
