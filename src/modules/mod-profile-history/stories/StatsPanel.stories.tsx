import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';
import { View } from 'react-native';

import StatsPanel from '../components/StatsPanel';
import { GRADE_ORDER } from '../types';
import type { ProfileStats } from '../types';

interface Args {
  totalSends: number;
  accumulatedDays: number;
  highestGrade: string;
  /** Comma-separated counts from VB upward, e.g. "2,8,10,9,7,4,2". */
  counts: string;
}

function buildStats({ totalSends, accumulatedDays, highestGrade, counts }: Args): ProfileStats {
  const parsed = counts.split(',').map((n) => Math.max(0, Number(n.trim()) || 0));
  return {
    total_sends: totalSends,
    accumulated_days: accumulatedDays,
    highest_grade: highestGrade,
    sends_by_grade: GRADE_ORDER.map((grade, i) => ({ grade, count: parsed[i] ?? 0 })),
  };
}

const meta: Meta<Args> = {
  title: 'Patterns/StatsPanel',
  render: (args) => (
    <View style={{ paddingVertical: 16, paddingHorizontal: 16, width: 393 }}>
      <StatsPanel stats={buildStats(args)} />
    </View>
  ),
  args: {
    totalSends: 42,
    accumulatedDays: 18,
    highestGrade: 'V6',
    counts: '2,8,10,9,7,4,2,1',
  },
  argTypes: {
    totalSends: { control: { type: 'number', min: 0, max: 99999 } },
    accumulatedDays: { control: { type: 'number', min: 0, max: 9999 } },
    highestGrade: { control: 'select', options: [...GRADE_ORDER] },
    counts: { control: 'text', description: 'Sends per grade from VB upward; the last non-zero grade is the highest bar' },
  },
};
export default meta;

/** Change the numbers or counts (try "310,1450,2210,2980,2600,1800,940,430,110,38,4,1"); raise font scale (>= 1.6) for the full-width hero with the small tiles below. */
export const Playground: StoryObj<Args> = {};

/**
 * Compact variant (page-review P-1/P-2): three tiles, gap `inlineGap` 8, `title3` numerals and `footnote` labels.
 * Tapping opens the full panel on Profile History (`onOpenDetails`).
 */
export const Compact: StoryObj<Args> = {
  render: (args) => (
    <View style={{ paddingVertical: 16, paddingHorizontal: 16, width: 393 }}>
      <StatsPanel variant="compact" stats={buildStats(args)} onOpenDetails={() => undefined} />
    </View>
  ),
};
