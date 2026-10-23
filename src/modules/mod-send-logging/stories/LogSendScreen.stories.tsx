import type { Session } from '@supabase/supabase-js';
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';

import { resetStubData, setStubData } from '../../../../.storybook/stubs/supabase';
import { withPhoneFrame } from '../../../../.storybook/PhoneFrame';
import LogSendScreen from '../screens/LogSendScreen';

// Off-spec design work. Fake data only; the supabase stub resolves the insert.
const session = { user: { id: 'story-user-me' } } as unknown as Session;

/** Seed stubs synchronously so the screen's first call sees the session. */
function WithStubs({ children }: { children: React.ReactNode }): React.JSX.Element {
  resetStubData();
  setStubData('auth:session', { user: { id: 'story-user-me' } });
  return <>{children}</>;
}

type Args = { withSummary: boolean };

const meta: Meta<Args> = {
  title: 'Pages/Home/Log Send',
  component: LogSendScreen as never, // real component; story args only toggle the route summary card
  tags: ['!autodocs'],
  parameters: { layout: 'centered', page: { chrome: false } },
  decorators: [
    (Story) => (
      <WithStubs>
        <Story />
      </WithStubs>
    ),
    withPhoneFrame,
  ],
  argTypes: { withSummary: { control: false } },
  render: ({ withSummary }) => (
    <LogSendScreen
      routeId="route-1"
      routeGrade="V4"
      routeSummary={withSummary ? { color: 'red', grade: 'V4', title: '紅色 · A 區', subtitle: '紅石攀岩館' } : undefined}
      session={session}
      onSuccess={() => {}}
      onCancel={() => {}}
    />
  ),
};
export default meta;
type Story = StoryObj<Args>;

/** Form opened from a route: compact route summary card above the style / attempts fields. */
export const Default: Story = { args: { withSummary: true } };

/** Form without the route summary card (AC-131). */
export const WithoutSummary: Story = { args: { withSummary: false }, name: 'Without Summary' };
