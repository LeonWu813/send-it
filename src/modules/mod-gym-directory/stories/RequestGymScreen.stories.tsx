/**
 * Pages/Gyms/Request Gym: "request a gym" form (AC-070). Form screen, hides the TabBar itself.
 * Renders inside PhoneFrame (real AppHeader).
 *
 * Only Default: Submitting / Success / submit-failed need a real submit interaction, and the
 * supabase stub cannot return errors, so they are not driven here.
 */

import type { Session } from '@supabase/supabase-js';
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';

import { withPhoneFrame } from '../../../../.storybook/PhoneFrame';
import { resetStubData, setStubData } from '../../../../.storybook/stubs/supabase';
import RequestGymScreen from '../screens/RequestGymScreen';

const session = { user: { id: 'story-user-me' } } as unknown as Session;

/** Seed stubs synchronously during render. */
function WithStubs({ children }: { children: React.ReactNode }): React.JSX.Element {
  resetStubData();
  setStubData('auth:session', { user: { id: 'story-user-me' } });
  return <>{children}</>;
}

const meta: Meta = {
  title: 'Pages/Gyms/Request Gym',
  component: RequestGymScreen as never,
  tags: ['!autodocs'],
  parameters: { layout: 'centered', page: { tab: 'gyms' } },
  decorators: [
    (Story) => (
      <WithStubs>
        <Story />
      </WithStubs>
    ),
    withPhoneFrame,
  ],
  render: () => <RequestGymScreen session={session} onBack={() => console.log('onBack')} />,
};
export default meta;

type Story = StoryObj;

/** Empty form; submit is disabled until name and city are filled. */
export const Default: Story = {};
