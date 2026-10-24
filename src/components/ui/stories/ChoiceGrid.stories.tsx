import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React, { useState } from 'react';
import { View } from 'react-native';

import { TAPE_DISPLAY } from '../../../lib/tape';
import { Chip } from '../Chip';
import { ChoiceGrid } from '../ChoiceGrid';
import { Row } from './_helpers';

const GRADES = ['V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10', 'V11'];
const COLORS = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'white', 'black'] as const;
const NAMES = { red: '紅色', orange: '橙色', yellow: '黃色', green: '綠色', blue: '藍色', purple: '紫色', pink: '粉紅色', white: '白色', black: '黑色' };

function Grades(): React.JSX.Element {
  const [sel, setSel] = useState('V4');
  return (
    <ChoiceGrid accessibilityLabel="難度">
      {GRADES.map((g) => (
        <Chip key={g} label={g} size="large" selected={sel === g} onPress={() => setSel(g)} />
      ))}
    </ChoiceGrid>
  );
}

function Colors(): React.JSX.Element {
  const [sel, setSel] = useState('blue');
  return (
    <ChoiceGrid accessibilityLabel="岩點顏色">
      {COLORS.map((c) => (
        <Chip
          key={c}
          layout="tile"
          label={NAMES[c]}
          swatch={TAPE_DISPLAY.light[c].fill}
          swatchMark={TAPE_DISPLAY.light[c].label}
          selected={sel === c}
          onPress={() => setSel(c)}
        />
      ))}
    </ChoiceGrid>
  );
}

const meta: Meta = { title: 'Components/ChoiceGrid', component: ChoiceGrid as never, tags: ['!autodocs'] };
export default meta;

/** 6 equal columns, gap 8, short last row left-aligned. 393 -> 53.5pt columns. */
export const Default: StoryObj = {
  render: () => (
    <View style={{ width: 393, padding: 16 }}>
      <Row label="difficulty: Chip large (pill)">
        <Grades />
      </Row>
      <Row label="colour: Chip tile">
        <Colors />
      </Row>
    </View>
  ),
};

/** Column width < 48 (320 wide: 41pt) drops to 4 columns. */
export const NarrowFallsBackToFour: StoryObj = {
  render: () => (
    <View style={{ width: 320, padding: 16 }}>
      <Colors />
    </View>
  ),
};

/** fontScale >= 1.35 (axFontScale): 4 columns, names may wrap to two lines. */
export const AccessibilityFontScale: StoryObj = {
  render: () => (
    <View style={{ width: 393, padding: 16 }}>
      <ChoiceGrid accessibilityLabel="岩點顏色" fontScale={1.5}>
        {COLORS.map((c) => (
          <Chip key={c} layout="tile" label={NAMES[c]} swatch={TAPE_DISPLAY.light[c].fill} swatchMark={TAPE_DISPLAY.light[c].label} onPress={() => {}} />
        ))}
      </ChoiceGrid>
    </View>
  ),
};
