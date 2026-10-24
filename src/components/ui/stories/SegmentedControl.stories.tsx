import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';

import { ICON } from '../../../lib/icons';
import { SegmentedControl } from '../SegmentedControl';
import type { SegmentedOption, SegmentedVariant } from '../SegmentedControl';
import { Row } from './_helpers';

interface Args {
  variant: SegmentedVariant;
  value: string;
  disabled: boolean;
  options: 2 | 3 | 4;
}

const TEXT: SegmentedOption[] = [
  { value: 'all', label: '全部' },
  { value: '30', label: '30 天' },
  { value: 'year', label: '一年' },
  { value: 'life', label: '全部時間' },
];
const ICONS: SegmentedOption[] = [
  { value: 'top', label: '完攀', icon: ICON.sendTop.outline, iconSelected: ICON.sendTop.filled, selectedColor: 'sendTop' },
  { value: 'flash', label: '閃攀', icon: ICON.sendFlash.outline, iconSelected: ICON.sendFlash.filled, selectedColor: 'sendFlash' },
  { value: 'attempt', label: '嘗試', icon: ICON.sendAttempt.outline, iconSelected: ICON.sendAttempt.outline, selectedColor: 'sendAttempt' },
];

function Demo({ variant, value: initial, disabled, options }: Args): React.JSX.Element {
  const src = (variant === 'icon' ? ICONS : TEXT).slice(0, variant === 'icon' ? 3 : options);
  const [value, setValue] = useState(initial);
  useEffect(() => setValue(initial), [initial]);
  const safe = src.some((o) => o.value === value) ? value : src[0].value;
  return (
    <View style={{ padding: 16, width: 375 }}>
      <SegmentedControl variant={variant} options={src} value={safe} onChange={setValue} disabled={disabled} accessibilityLabel="Segmented" hapticPurpose="story" />
    </View>
  );
}

const meta: Meta<Args> = {
  title: 'Components/SegmentedControl',
  component: Demo,
  args: { variant: 'standard', value: 'all', disabled: false, options: 3 },
  argTypes: {
    variant: { control: 'inline-radio', options: ['standard', 'compact', 'icon'], description: 'standard 36 / compact 32 (draggable), icon 68 (tap only)' },
    value: { control: 'text', description: 'all / 30 / year / life, or top / flash / attempt for the icon variant' },
    options: { control: 'inline-radio', options: [2, 3, 4], description: 'text variants only' },
  },
};
export default meta;

/** Tap or drag the thumb (standard / compact). The value commits on release. Dark theme: thumb has a 1pt outline. */
export const Playground: StoryObj<Args> = {};

/** All variants and states. */
export const AllStates: StoryObj<Args> = {
  render: () => (
    <View style={{ padding: 16, width: 420 }}>
      <Row label="standard 36"><SegmentedControl options={TEXT.slice(0, 3)} value="all" onChange={() => {}} accessibilityLabel="a" /></Row>
      <Row label="compact 32"><SegmentedControl variant="compact" options={TEXT.slice(0, 3)} value="30" onChange={() => {}} accessibilityLabel="a" /></Row>
      <Row label="disabled">
        <SegmentedControl options={[{ value: 'on', label: '開' }, { value: 'off', label: '關' }]} value="on" disabled onChange={() => {}} accessibilityLabel="a" />
      </Row>
      <Row label="icon 68 (tap only): flash selected">
        <SegmentedControl variant="icon" options={ICONS} value="flash" onChange={() => {}} accessibilityLabel="a" />
      </Row>
      <Row label="icon 68: top selected">
        <SegmentedControl variant="icon" options={ICONS} value="top" onChange={() => {}} accessibilityLabel="a" />
      </Row>
    </View>
  ),
};
