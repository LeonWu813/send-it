import type { Session } from '@supabase/supabase-js';
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';
import { View } from 'react-native';

import { setStubData } from '../../../../.storybook/stubs/supabase';
import { UnreadCountProvider } from '../../mod-notifications/UnreadCountProvider';
import AppHeader from '../components/AppHeader';

// Off-spec design tooling. Fake data only.
// The unread count comes from UnreadCountProvider, which counts rows returned by the
// stubbed 'notifications' table. We seed N fake rows and mount the real provider with a
// fake session; the badge appears after the provider's initial (async) fetch.
const fakeSession = { user: { id: 'story-user' } } as unknown as Session;

function WithUnread({ count, children }: { count: number; children: React.ReactNode }) {
  setStubData('notifications', Array.from({ length: count }, (_, i) => ({ id: `n${i}` })));
  return (
    <UnreadCountProvider key={count} session={fakeSession}>
      {children}
    </UnreadCountProvider>
  );
}

type Args = React.ComponentProps<typeof AppHeader> & { unreadCount: number };

const meta: Meta<Args> = {
  title: 'Home/AppHeader',
  component: AppHeader as React.ComponentType<Args>,
  decorators: [
    (Story, ctx) => (
      <WithUnread count={(ctx.args as Args).unreadCount}>
        <View style={{ width: 375 }}>
          <Story />
        </View>
      </WithUnread>
    ),
  ],
  args: {
    unreadCount: 0,
    topInset: 0,
    badgeLive: false,
    onNavigateToNotifications: () => {},
    onNavigateToSettings: () => {},
  },
  argTypes: {
    unreadCount: { control: { type: 'number', min: 0, max: 150 }, description: '0 hides the badge; 100+ shows 99+' },
    topInset: { control: { type: 'number', min: 0, max: 80 }, description: 'Safe-area top (notch ~47); content height stays 44' },
    badgeLive: { control: 'boolean', description: 'On: the badge pops in (topOut) like a foreground push. Off: fades in like a launch / refresh' },
  },
};
export default meta;

/** Change unreadCount (0, 1, 7, 42, 120), toggle badgeLive, press the bell / gear (disc on the sand background), raise topInset for a notch. */
export const Playground: StoryObj<Args> = {};
