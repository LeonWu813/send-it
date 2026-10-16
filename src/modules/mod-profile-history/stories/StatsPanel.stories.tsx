import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';
import { View } from 'react-native';

import { ForcedTheme } from '../../../../.storybook/ForcedTheme';
import StatsPanel from '../components/StatsPanel';
import { GRADE_ORDER } from '../types';
import type { ProfileStats } from '../types';

const byGrade = (counts: number[]): ProfileStats['sends_by_grade'] =>
  GRADE_ORDER.map((grade, i) => ({ grade, count: counts[i] ?? 0 }));

const typical: ProfileStats = {
  total_sends: 42,
  accumulated_days: 18,
  highest_grade: 'V6',
  sends_by_grade: byGrade([2, 8, 10, 9, 7, 4, 2]),
};

const empty: ProfileStats = {
  total_sends: 0,
  accumulated_days: 0,
  highest_grade: null,
  sends_by_grade: byGrade([]),
};

const large: ProfileStats = {
  total_sends: 12873,
  accumulated_days: 1204,
  highest_grade: 'V10',
  sends_by_grade: byGrade([310, 1450, 2210, 2980, 2600, 1800, 940, 430, 110, 38, 4, 1]),
};

const meta: Meta<typeof StatsPanel> = {
  title: 'Profile/StatsPanel',
  component: StatsPanel,
  decorators: [(Story) => <View style={{ padding: 16, maxWidth: 420 }}><Story /></View>],
};
export default meta;
type Story = StoryObj<typeof StatsPanel>;

export const Typical: Story = { args: { stats: typical } };
export const Empty: Story = { args: { stats: empty } };
export const LargeNumbers: Story = { args: { stats: large } };

export const LightAndDark: Story = {
  args: { stats: typical },
  render: (args) => (
    <View style={{ flexDirection: 'row', gap: 16, flexWrap: 'wrap' }}>
      {(['light', 'dark'] as const).map((mode) => (
        <ForcedTheme key={mode} mode={mode}>
          <View style={{ padding: 16, width: 380 }}><StatsPanel {...args} /></View>
        </ForcedTheme>
      ))}
    </View>
  ),
};
