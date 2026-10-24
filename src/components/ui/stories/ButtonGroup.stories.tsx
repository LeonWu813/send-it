import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';
import { View } from 'react-native';

import { ICON } from '../../../lib/icons';
import { ButtonGroup } from '../ButtonGroup';
import type { ButtonGroupItem } from '../ButtonGroup';
import { Row } from './_helpers';

const noop = (): void => {};

function Frame({ width = 361, children }: { width?: number; children: React.ReactNode }): React.JSX.Element {
  return <View style={{ width, padding: 16 }}>{children}</View>;
}

function pair(a: string, b: string, icon = false): [ButtonGroupItem, ButtonGroupItem] {
  return [
    { label: a, onPress: noop, icon: icon ? ICON.log.outline : undefined },
    { label: b, onPress: noop, icon: icon ? ICON.upload.outline : undefined },
  ];
}

const meta: Meta = {
  title: 'Components/ButtonGroup',
  component: ButtonGroup as never,
  tags: ['!autodocs'],
};
export default meta;

type Story = StoryObj;

/** Short labels fit on one line: side by side, equal width, gap 8. */
export const SideBySide: Story = {
  render: () => (
    <Frame>
      <Row label="zh-TW 儲存 / 取消">
        <ButtonGroup buttons={pair('儲存', '取消')} />
      </Row>
      <Row label="en Save / Cancel">
        <ButtonGroup buttons={pair('Save', 'Cancel')} />
      </Row>
    </Frame>
  ),
};

/** Route Detail case: the secondary label does not fit beside the primary, so both stack, primary on top, same size. */
export const LongLabelsStack: Story = {
  render: () => (
    <Frame>
      <Row label="zh-TW 記錄攀登 / 上傳 Beta 影片 (+ icons)">
        <ButtonGroup buttons={pair('記錄攀登', '上傳 Beta 影片', true)} />
      </Row>
      <Row label="en Log climb / Upload Beta Video (+ icons)">
        <ButtonGroup buttons={pair('Log climb', 'Upload Beta Video', true)} />
      </Row>
    </Frame>
  ),
};

/** A label longer than the container wraps when stacked and is never truncated. */
export const VeryLongLabelWraps: Story = {
  render: () => (
    <Frame width={280}>
      <ButtonGroup
        buttons={pair('Save changes and continue to the next step of setup', 'Discard everything I have typed so far')}
      />
    </Frame>
  ),
};

/** fontScale >= 1.35 (accessibility sizes) always stacks, even for short labels. */
export const AccessibilityFont: Story = {
  render: () => (
    <Frame>
      <Row label="fontScale 1.2 (side by side)">
        <ButtonGroup fontScale={1.2} buttons={pair('儲存', '取消')} />
      </Row>
      <Row label="fontScale 1.35 (always stacked)">
        <ButtonGroup fontScale={1.35} buttons={pair('儲存', '取消')} />
      </Row>
      <Row label="fontScale 2 (always stacked)">
        <ButtonGroup fontScale={2} buttons={pair('Save', 'Cancel')} />
      </Row>
    </Frame>
  ),
};

/** Narrow container: the same labels stack where a wider container would not. */
export const NarrowContainer: Story = {
  render: () => (
    <View>
      <Frame width={343}>
        <Row label="343 wide: 完成 / 稍後再說">
          <ButtonGroup buttons={pair('完成', '稍後再說')} />
        </Row>
      </Frame>
      <Frame width={200}>
        <Row label="200 wide: same labels stack">
          <ButtonGroup buttons={pair('完成', '稍後再說')} />
        </Row>
      </Frame>
    </View>
  ),
};

/** A single button is always full width. */
export const Single: Story = {
  render: () => (
    <Frame>
      <ButtonGroup buttons={[{ label: '記錄攀登', onPress: noop, icon: ICON.log.outline }]} />
    </Frame>
  ),
};
