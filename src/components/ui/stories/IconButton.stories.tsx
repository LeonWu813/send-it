import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React, { useEffect, useState } from 'react';

import { ICON } from '../../../lib/icons';
import { IconButton } from '../IconButton';
import type { IconButtonProps } from '../IconButton';
import { ON_OPTIONS, SurfaceBox } from './_helpers';

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
  title: 'UI/IconButton',
  component: Demo,
  args: { glyph: 'notifications', variant: 'plain', on: 'surface', color: 'textPrimary', selected: false, disabled: false, badge: 0 },
  argTypes: {
    glyph: { control: 'select', options: Object.keys(glyphs), description: 'ICON.* concept (toggle uses its outline/filled pair)' },
    variant: { control: 'inline-radio', options: ['plain', 'toggle', 'media'] },
    on: { control: 'inline-radio', options: ON_OPTIONS },
    color: { control: 'select', options: ['textPrimary', 'textSecondary', 'primary', 'error'] },
    size: { control: 'inline-radio', options: [20, 24, 28], description: 'md / lg / xl' },
    badge: { control: { type: 'number', min: 0, max: 120 }, description: '0 hides; 100+ shows 99+' },
  },
};
export default meta;

/** Toggle: press to flip outline <-> filled (cross-fade). media: scrim disc. badge: change the count to see the roll / pop. */
export const Playground: StoryObj<Args> = {};
