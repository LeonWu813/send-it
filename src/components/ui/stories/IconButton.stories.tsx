import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React, { useEffect, useState } from 'react';

import { ICON } from '../../../lib/icons';
import { IconButton } from '../IconButton';
import type { IconButtonProps } from '../IconButton';
import { IconButtonGroup } from '../IconButton';
import { ON_OPTIONS, Row, SurfaceBox } from './_helpers';
import { View } from 'react-native';

const glyphs = {
  notifications: [ICON.notifications.outline, undefined],
  bookmark: [ICON.bookmark.outline, ICON.bookmark.filled],
  like: [ICON.like.outline, ICON.like.filled],
  report: [ICON.report.outline, ICON.report.filled],
  password: [ICON.passwordVisibility.outline, ICON.passwordVisibility.on],
  back: [ICON.back.outline, undefined],
  more: [ICON.more.outline, undefined],
  delete: [ICON.delete.outline, undefined],
} as const;

type Args = Omit<IconButtonProps, 'name' | 'nameOn' | 'accessibilityLabel' | 'onPress'> & { glyph: keyof typeof glyphs };

function Demo({ glyph, selected, ...rest }: Args): React.JSX.Element {
  const [on, setOn] = useState(!!selected);
  useEffect(() => setOn(!!selected), [selected]);
  const [off, onGlyph] = glyphs[glyph];
  return (
    <SurfaceBox on={rest.variant === 'media' ? 'media' : (rest.on ?? 'surface')}>
      <IconButton
        {...rest}
        name={off}
        nameOn={onGlyph}
        selected={on}
        accessibilityLabel={glyph}
        onPress={() => rest.variant === 'toggle' && setOn((v) => !v)}
      />
    </SurfaceBox>
  );
}

const meta: Meta<Args> = {
  title: 'Components/IconButton',
  component: Demo,
  args: { glyph: 'notifications', variant: 'plain', on: 'surface', color: 'textPrimary', selected: false, disabled: false, badge: 0 },
  argTypes: {
    glyph: { control: 'select', options: Object.keys(glyphs), description: 'ICON.* concept (toggle uses its outline/filled pair)' },
    variant: { control: 'inline-radio', options: ['plain', 'toggle', 'media', 'tonal', 'float', 'small'] },
    on: { control: 'inline-radio', options: ON_OPTIONS },
    color: { control: 'select', options: ['textPrimary', 'textSecondary', 'primary', 'error'] },
    size: { control: 'inline-radio', options: [20, 24, 28], description: 'md / lg / xl' },
    badge: { control: { type: 'number', min: 0, max: 120 }, description: '0 hides; 100+ shows 99+' },
  },
};
export default meta;

/** Toggle: press to flip outline <-> filled (cross-fade). media: scrim disc. badge: change the count to see the roll / pop. */
export const Playground: StoryObj<Args> = {};

/** All variants, plus the 96x44 header action capsule (IconButtonGroup). */
export const AllStates: StoryObj<Args> = {
  render: () => (
    <View style={{ padding: 16, width: 420 }}>
      <Row label="plain / toggle(off, on) / tonal 44 / tonal 52 / float / small 30">
        <View style={{ flexDirection: 'row', columnGap: 12, alignItems: 'center' }}>
          <IconButton name={ICON.more.outline} accessibilityLabel="more" on="background" onPress={() => {}} />
          <IconButton variant="toggle" name={ICON.bookmark.outline} nameOn={ICON.bookmark.filled} accessibilityLabel="b" on="background" onPress={() => {}} />
          <IconButton variant="toggle" selected name={ICON.bookmark.outline} nameOn={ICON.bookmark.filled} accessibilityLabel="b2" on="background" onPress={() => {}} />
          <IconButton variant="tonal" name={ICON.share.outline} accessibilityLabel="s" onPress={() => {}} />
          <IconButton variant="tonal" diameter={52} name={ICON.share.outline} accessibilityLabel="s2" onPress={() => {}} />
          <IconButton variant="float" name={ICON.back.outline} accessibilityLabel="back" onPress={() => {}} />
          <IconButton variant="small" name={ICON.close.outline} accessibilityLabel="x" onPress={() => {}} />
        </View>
      </Row>
      <Row label="disabled / badge">
        <View style={{ flexDirection: 'row', columnGap: 12 }}>
          <IconButton disabled name={ICON.delete.outline} accessibilityLabel="d" on="background" onPress={() => {}} />
          <IconButton name={ICON.notifications.outline} badge={3} accessibilityLabel="n" on="background" onPress={() => {}} />
        </View>
      </Row>
      <Row label="IconButtonGroup 96x44">
        <IconButtonGroup
          items={[
            { name: ICON.notifications.outline, accessibilityLabel: 'n', onPress: () => {} },
            { name: ICON.settings.outline, accessibilityLabel: 's', onPress: () => {} },
          ]}
        />
      </Row>
      <Row label="media (on a dark video)">
        <View style={{ backgroundColor: '#000', padding: 12, alignSelf: 'flex-start', borderRadius: 12 }}>
          <IconButton variant="media" name={ICON.back.outline} accessibilityLabel="m" onPress={() => {}} />
        </View>
      </Row>
    </View>
  ),
};
