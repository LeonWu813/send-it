import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';
import { View } from 'react-native';

import TabBar from '../components/TabBar';

// Off-spec design tooling. Fake data only.
const meta: Meta<typeof TabBar> = {
  title: 'Home/TabBar',
  component: TabBar,
  decorators: [
    (Story) => (
      <View style={{ width: 375 }}>
        <Story />
      </View>
    ),
  ],
  args: { activeTab: 'home', bottomInset: 0, onTabPress: () => {} },
  argTypes: {
    activeTab: { control: 'inline-radio', options: ['home', 'gyms', 'profile'] },
    bottomInset: { control: { type: 'number', min: 0, max: 60 } },
  },
};
export default meta;
type Story = StoryObj<typeof TabBar>;

export const HomeActive: Story = { args: { activeTab: 'home' } };
export const GymsActive: Story = { args: { activeTab: 'gyms' } };
export const ProfileActive: Story = { args: { activeTab: 'profile' } };
export const WithHomeIndicatorInset: Story = { args: { activeTab: 'home', bottomInset: 34 } };
