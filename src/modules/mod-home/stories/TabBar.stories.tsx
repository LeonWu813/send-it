import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';

import TabBar from '../components/TabBar';
import type { TabKey } from '../components/TabBar';

// Off-spec design tooling. Fake data only.
type Args = { activeTab: TabKey; bottomInset: number };

function Demo({ activeTab, bottomInset }: Args): React.JSX.Element {
  const [tab, setTab] = useState<TabKey>(activeTab);
  useEffect(() => setTab(activeTab), [activeTab]);
  return (
    <View style={{ width: 375 }}>
      <TabBar activeTab={tab} onTabPress={setTab} bottomInset={bottomInset} />
    </View>
  );
}

const meta: Meta<Args> = {
  title: 'Home/TabBar',
  component: Demo,
  args: { activeTab: 'home', bottomInset: 0 },
  argTypes: {
    activeTab: { control: 'inline-radio', options: ['home', 'gyms', 'profile'] },
    bottomInset: { control: { type: 'number', min: 0, max: 60 }, description: 'Home-indicator inset; padding is max(inset, 8)' },
  },
};
export default meta;

/** Tap the tabs (icon 0.9 -> 1 + colour cross-fade; changing the activeTab control does not animate), tap the active tab again, set bottomInset 34. */
export const Playground: StoryObj<Args> = {};
