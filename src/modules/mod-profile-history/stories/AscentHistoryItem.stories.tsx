import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';
import { View } from 'react-native';

import { ForcedTheme } from '../../../../.storybook/ForcedTheme';
import AscentHistoryItem from '../components/AscentHistoryItem';
import type { HistoryAscent } from '../types';

const base: HistoryAscent = {
  ascent_id: 'a1',
  route_id: 'r1',
  gym_id: 'g1',
  gym_name: 'Boulder Planet',
  grade: 'V3',
  color_tag: 'blue',
  section_label: 'Cave',
  photo_url: null,
  style: 'top',
  attempts: 3,
  note: null,
  logged_at: '2026-09-20T10:30:00Z',
  is_private: false,
};

const meta: Meta<typeof AscentHistoryItem> = {
  title: 'Profile/AscentHistoryItem',
  component: AscentHistoryItem,
  args: { item: base },
  decorators: [(Story) => <View style={{ maxWidth: 420 }}><Story /></View>],
};
export default meta;
type Story = StoryObj<typeof AscentHistoryItem>;

// Note: the flash chip uses theme `warning` (not the flash gold) - shown as-is per design review.
export const Flash: Story = { args: { item: { ...base, style: 'flash', attempts: 1 } } };
export const Top: Story = {};
export const Attempt: Story = { args: { item: { ...base, style: 'attempt', attempts: 5 } } };
export const Private: Story = { args: { item: { ...base, is_private: true } } };
export const NoSection: Story = { args: { item: { ...base, section_label: null, grade: 'V5', color_tag: 'red' } } };
// The component does not render photo_url / video; this documents that a thumbnail makes no difference.
export const WithPhotoUrl: Story = {
  args: { item: { ...base, photo_url: 'https://example.invalid/route.jpg' } },
};
export const LongNames: Story = {
  args: {
    item: {
      ...base,
      gym_name: 'The Extremely Long Named Bouldering and Climbing Gymnasium of Greater Taipei City',
      section_label: 'Overhanging North Wall Competition Training Area Section B',
      is_private: true,
    },
  },
};

export const LightAndDark: Story = {
  render: (args) => (
    <View style={{ flexDirection: 'row', gap: 16, flexWrap: 'wrap' }}>
      {(['light', 'dark'] as const).map((mode) => (
        <ForcedTheme key={mode} mode={mode}>
          <View style={{ width: 400 }}>
            <AscentHistoryItem item={{ ...args.item, style: 'flash' }} />
            <AscentHistoryItem item={args.item} />
            <AscentHistoryItem item={{ ...args.item, style: 'attempt' }} />
          </View>
        </ForcedTheme>
      ))}
    </View>
  ),
};
