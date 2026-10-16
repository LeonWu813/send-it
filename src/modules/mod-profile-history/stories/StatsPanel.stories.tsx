import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';
import { View } from 'react-native';

import StatsPanel from '../components/StatsPanel';
import { GRADE_ORDER } from '../types';
import type { ProfileStats } from '../types';

interface Args {
  empty: boolean;
  totalSends: number;
  accumulatedDays: number;
  highestGrade: string;
  /** Comma-separated counts from VB upward, e.g. "2,8,10,9,7,4,2". */
  counts: string;
}

function buildStats({ empty, totalSends, accumulatedDays, highestGrade, counts }: Args): ProfileStats {
  if (empty) {
    return { total_sends: 0, accumulated_days: 0, highest_grade: null, sends_by_grade: GRADE_ORDER.map((grade) => ({ grade, count: 0 })) };
  }
  const parsed = counts.split(',').map((n) => Math.max(0, Number(n.trim()) || 0));
  return {
    total_sends: totalSends,
    accumulated_days: accumulatedDays,
    highest_grade: highestGrade,
    sends_by_grade: GRADE_ORDER.map((grade, i) => ({ grade, count: parsed[i] ?? 0 })),
  };
}

const meta: Meta<Args> = {
  title: 'Profile/StatsPanel',
  render: (args) => (
    <View style={{ padding: 16, maxWidth: 420 }}>
      <StatsPanel stats={buildStats(args)} />
    </View>
  ),
  args: {
    empty: false,
    totalSends: 42,
    accumulatedDays: 18,
    highestGrade: 'V6',
    counts: '2,8,10,9,7,4,2,1',
  },
  argTypes: {
    empty: { control: 'boolean', description: 'Zero sends: the whole panel becomes the firstUse EmptyState' },
    totalSends: { control: { type: 'number', min: 0, max: 99999 } },
    accumulatedDays: { control: { type: 'number', min: 0, max: 9999 } },
    highestGrade: { control: 'select', options: [...GRADE_ORDER] },
    counts: { control: 'text', description: 'Sends per grade from VB upward; the last non-zero grade is the highest bar' },
  },
};
export default meta;

/** Change the numbers or counts (try "310,1450,2210,2980,2600,1800,940,430,110,38,4,1"); toggle `empty`; raise font scale for the 2-column summary. */
export const Playground: StoryObj<Args> = {};
