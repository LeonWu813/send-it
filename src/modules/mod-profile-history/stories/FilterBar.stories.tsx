import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React, { useState } from 'react';
import { View } from 'react-native';

import FilterBar from '../components/FilterBar';
import { EMPTY_FILTERS } from '../types';
import type { HistoryFilters } from '../types';

const gyms = [
  { id: 'g1', name: 'Boulder Planet' },
  { id: 'g2', name: 'Camp 4 Climbing Gym' },
  { id: 'g3', name: 'Rock Lab' },
];

const daysAgo = (d: number): string => new Date(Date.now() - d * 86400000).toISOString();

// Stateful wrapper so chips and pickers react to clicks in the canvas.
function Interactive({ filters: initial, gyms: g }: { filters: HistoryFilters; gyms: typeof gyms }): React.JSX.Element {
  const [filters, setFilters] = useState(initial);
  return (
    <View style={{ paddingVertical: 16, maxWidth: 420 }}>
      <FilterBar filters={filters} gyms={g} onFiltersChange={setFilters} />
    </View>
  );
}

const meta: Meta<typeof FilterBar> = {
  title: 'Profile/FilterBar',
  component: FilterBar,
  render: (args) => <Interactive filters={args.filters} gyms={args.gyms} />,
  args: { gyms, filters: EMPTY_FILTERS, onFiltersChange: () => {} },
};
export default meta;
type Story = StoryObj<typeof FilterBar>;

export const NoFilters: Story = {};
export const GymSelected: Story = { args: { filters: { ...EMPTY_FILTERS, gym_id: 'g2' } } };
export const GradeSelected: Story = { args: { filters: { ...EMPTY_FILTERS, grade: 'V4' } } };
export const DateSelected: Story = {
  args: { filters: { ...EMPTY_FILTERS, date_from: daysAgo(30), date_to: daysAgo(0) } },
};
export const AllSelected: Story = {
  args: { filters: { gym_id: 'g1', grade: 'V3', date_from: daysAgo(7), date_to: daysAgo(0) } },
};
export const NoGyms: Story = { args: { gyms: [] } };
