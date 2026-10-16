import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';
import { View } from 'react-native';

import AscentHistoryItem from '../components/AscentHistoryItem';
import type { HistoryAscent } from '../types';

interface Args {
  sendStyle: HistoryAscent['style'];
  attempts: number;
  isPrivate: boolean;
  hasSection: boolean;
  hasPhoto: boolean;
  longNames: boolean;
}

const PHOTO =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="88" height="88"><rect width="88" height="88" fill="#bbb"/></svg>');

function toItem(a: Args): HistoryAscent {
  return {
    ascent_id: 'a1',
    route_id: 'r1',
    gym_id: 'g1',
    gym_name: a.longNames
      ? 'The Extremely Long Named Bouldering and Climbing Gymnasium of Greater Taipei City'
      : 'Boulder Planet',
    grade: 'V3',
    color_tag: 'blue',
    section_label: a.hasSection
      ? a.longNames
        ? 'Overhanging North Wall Competition Training Area Section B'
        : 'Cave'
      : null,
    photo_url: a.hasPhoto ? PHOTO : null,
    style: a.sendStyle,
    attempts: a.sendStyle === 'attempt' ? a.attempts : a.sendStyle === 'flash' ? 1 : 3,
    note: null,
    logged_at: '2026-09-20T10:30:00Z',
    is_private: a.isPrivate,
  };
}

const meta: Meta<Args> = {
  title: 'Profile/AscentHistoryItem',
  render: (args) => (
    <View style={{ maxWidth: 420 }}>
      <AscentHistoryItem item={toItem(args)} />
    </View>
  ),
  args: { sendStyle: 'top', attempts: 3, isPrivate: false, hasSection: true, hasPhoto: false, longNames: false },
  argTypes: {
    sendStyle: { control: 'inline-radio', options: ['top', 'flash', 'attempt'] },
    attempts: { control: { type: 'number', min: 1, max: 20 }, description: 'Only shown for attempt' },
    isPrivate: { control: 'boolean' },
    hasSection: { control: 'boolean' },
    hasPhoto: { control: 'boolean', description: '44x44 thumbnail before the text; no gap when absent' },
    longNames: { control: 'boolean', description: 'Long gym + section: the route name stays visible' },
  },
};
export default meta;

/** Switch sendStyle, toggle private / section / photo / long names; raise font scale to see the chip move to line 2. */
export const Playground: StoryObj<Args> = {};
