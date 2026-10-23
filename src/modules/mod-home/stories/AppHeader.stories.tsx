import type { Session } from '@supabase/supabase-js';
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';
import { Animated, View } from 'react-native';

import { setStubData } from '../../../../.storybook/stubs/supabase';
import { UnreadCountProvider } from '../../mod-notifications';
import { IconButton } from '../../../components/ui/IconButton';
import { ICON } from '../../../lib/icons';
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

type Args = React.ComponentProps<typeof AppHeader> & { unreadCount: number; scrolled: number };

/** Drives the root header's scroll binding from a Controls value. */
function Scrolled({ scrolled, ...args }: Args): React.JSX.Element {
  const y = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => y.setValue(scrolled), [scrolled, y]);
  return (
    <AppHeader
      {...args}
      scrollY={args.variant === 'root' && scrolled > 0 ? y : undefined}
      onBack={args.variant === 'nested' ? () => {} : undefined}
    />
  );
}

const meta: Meta<Args> = {
  title: 'Patterns/AppHeader',
  component: AppHeader as React.ComponentType<Args>,
  decorators: [
    (Story, ctx) => (
      <WithUnread count={(ctx.args as Args).unreadCount}>
        <View style={{ width: 375, minHeight: 160, backgroundColor: 'transparent' }}>
          <Story />
        </View>
      </WithUnread>
    ),
  ],
  render: ({ scrolled, ...args }) => <Scrolled scrolled={scrolled} {...args} />,
  args: {
    variant: 'root',
    title: 'Home',
    scrolled: 0,
    unreadCount: 3,
    topInset: 0,
    badgeLive: false,
    onNavigateToNotifications: () => {},
    onNavigateToSettings: () => {},
  },
  argTypes: {
    variant: { control: 'inline-radio', options: ['root', 'nested'], description: 'root = tab roots only (large title + bell + gear); nested = back + title + at most one trailing action' },
    title: { control: 'text', description: 'Tab name (root) or screen title (nested)' },
    scrolled: { control: { type: 'range', min: 0, max: 60 }, description: 'Root: simulated scroll offset. Small title fades in over 38 to 50' },
    onBack: { control: false },
    trailing: { control: false },
    scrollY: { control: false },
    unreadCount: { control: { type: 'number', min: 0, max: 150 }, description: '0 hides the 8pt unread dot (the count is in the bell label)' },
    topInset: { control: { type: 'number', min: 0, max: 80 }, description: 'Safe-area top (notch ~47); content height stays 44' },
    badgeLive: { control: 'boolean', description: 'On: the dot pops in (grip) like a foreground push. Off: fades in like a launch / refresh' },
  },
};
export default meta;

/** Switch root / nested, drag `scrolled` through 38-50 to see the small title fade in, set unreadCount to 0 to hide the dot, press the bell / gear, raise topInset for a notch. */
export const Playground: StoryObj<Args> = {};

/** HD-1 / ST-1: a pushed screen shows back + title only. No bell or gear, so the title gets the full width and no icon ever links to the screen you are on (Settings has no gear, the Inbox no bell). */
export const NestedTitleOnly: StoryObj<Args> = {
  args: { variant: 'nested', title: 'MegaSTONE Climbing Gym Taipei' },
};

/** A pushed screen may carry ONE contextual action in the `trailing` slot (here a bookmark). */
export const NestedWithAction: StoryObj<Args> = {
  args: {
    variant: 'nested',
    title: 'MegaSTONE Climbing Gym Taipei',
    trailing: <IconButton variant="float" name={ICON.bookmark.outline} accessibilityLabel="Save" onPress={() => {}} />,
  },
};
