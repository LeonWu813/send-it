import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';

import FilterBar from '../components/FilterBar';
import { EMPTY_FILTERS } from '../types';
import type { HistoryFilters } from '../types';

const GYMS = [
  { id: 'g1', name: 'Boulder Planet' },
  { id: 'g2', name: 'Camp 4 Climbing Gym' },
  { id: 'g3', name: 'The Extremely Long Named Bouldering and Climbing Gymnasium of Greater Taipei' },
];

interface Args {
  gymId: 'none' | 'g1' | 'g2' | 'g3';
  grade: 'none' | 'V0' | 'V3' | 'V4' | 'V8';
  dateDays: 0 | 7 | 30 | 90 | 365;
  gymCount: number;
}

const daysAgo = (d: number): string => new Date(Date.now() - d * 86400000).toISOString();

function initialFilters({ gymId, grade, dateDays }: Args): HistoryFilters {
  return {
    gym_id: gymId === 'none' ? null : gymId,
    grade: grade === 'none' ? null : grade,
    date_from: dateDays ? daysAgo(dateDays) : null,
    date_to: dateDays ? daysAgo(0) : null,
  };
}

// Local state so chips and pickers react in the canvas; controls reset the selection.
function Interactive(args: Args): React.JSX.Element {
  const [filters, setFilters] = useState<HistoryFilters>(() => initialFilters(args));
  useEffect(() => {
    setFilters(initialFilters(args));
  }, [args.gymId, args.grade, args.dateDays]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <View style={{ paddingVertical: 16, maxWidth: 420 }}>
      <FilterBar filters={filters} gyms={GYMS.slice(0, args.gymCount)} onFiltersChange={setFilters} />
    </View>
  );
}

const meta: Meta<Args> = {
  title: 'Profile/FilterBar',
  render: (args) => <Interactive {...args} />,
  args: { gymId: 'none', grade: 'none', dateDays: 0, gymCount: 3 },
  argTypes: {
    gymId: { control: 'select', options: ['none', 'g1', 'g2', 'g3'], description: 'g3 has a very long name (no truncation of the value)' },
    grade: { control: 'select', options: ['none', 'V0', 'V3', 'V4', 'V8'] },
    dateDays: { control: 'select', options: [0, 7, 30, 90, 365] },
    gymCount: { control: { type: 'number', min: 0, max: 3 }, description: 'Gym list length; 0 shows only "All gyms"' },
  },
};
export default meta;

/** Tap a chip to open its sheet and pick a value; tap the separate x to clear. Set the initial selections with the controls. */
export const Playground: StoryObj<Args> = {};
