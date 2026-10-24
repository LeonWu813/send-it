import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Stepper } from '../Stepper';
import { Row } from './_helpers';

interface Args {
  value: number;
  locked: boolean;
  min: number;
  max: number;
}

function Demo({ value: initial, locked, min, max }: Args): React.JSX.Element {
  const [value, setValue] = useState(initial);
  useEffect(() => setValue(initial), [initial]);
  return (
    <View style={{ padding: 16, width: 375 }}>
      <Stepper
        label="嘗試次數"
        description="從第一次試到完攀"
        lockedDescription="閃攀固定 1 次"
        lockedAnnouncement="嘗試次數已固定為 1"
        valueText={(n) => `${n} 次`}
        value={locked ? 1 : value}
        onChange={setValue}
        locked={locked}
        min={min}
        max={max}
        hapticSource="stepper-story"
      />
    </View>
  );
}

const meta: Meta<Args> = {
  title: 'Components/Stepper',
  component: Demo,
  args: { value: 3, locked: false, min: 1, max: 9999 },
  argTypes: {
    value: { control: { type: 'number', min: 1, max: 9999 } },
    locked: { control: 'boolean', description: 'Flash: fixed at 1, no discs, lock + hint, 1pt border' },
  },
};
export default meta;

/** Tap -/+; hold for 500ms to auto-repeat (100ms, then 50ms after 10 steps); tap the number to type. */
export const Playground: StoryObj<Args> = {};

/** Normal at min, mid, max and locked. */
export const AllStates: StoryObj<Args> = {
  render: () => (
    <View style={{ padding: 16, width: 375 }}>
      <Row label="min (1): - disabled"><Stepper label="嘗試次數" description="從第一次試到完攀" value={1} onChange={() => {}} /></Row>
      <Row label="mid"><Stepper label="嘗試次數" description="從第一次試到完攀" value={12} onChange={() => {}} /></Row>
      <Row label="max (9999): + disabled"><Stepper label="嘗試次數" description="從第一次試到完攀" value={9999} onChange={() => {}} /></Row>
      <Row label="locked (flash)"><Stepper label="嘗試次數" lockedDescription="閃攀固定 1 次" value={1} locked onChange={() => {}} /></Row>
    </View>
  ),
};

/** Typing a number (`editing`): 1pt primary outline + inner 2pt ring, fill stays surfaceAlt. The play step taps the number. */
export const Editing: StoryObj<Args> = {
  render: () => (
    <View style={{ padding: 16, width: 375 }}>
      <Stepper label="嘗試次數" description="從第一次試到完攀" value={12} onChange={() => {}} />
    </View>
  ),
  play: async ({ canvasElement }) => {
    const number = Array.from(canvasElement.querySelectorAll<HTMLElement>('div')).find((el) => el.children.length === 0 && el.textContent === '12');
    number?.click();
  },
};
