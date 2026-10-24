/** Chip: disabled + selected keeps the inverted fill and `background` text; tile layout; outer gap ring. */
import '../../../lib/i18n';
import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet, Text } from 'react-native';

import { LIGHT_PALETTE, ThemeProvider } from '../../../lib/theme';
import { Chip } from '../Chip';
import { ChoiceGrid } from '../ChoiceGrid';

type ReactTestInstance = ReturnType<ReturnType<typeof render>['UNSAFE_getByType']>;
const wrap = (ui: React.ReactElement) => render(<ThemeProvider>{ui}</ThemeProvider>);
const flat = (el: { props: any }): Record<string, any> => StyleSheet.flatten(el.props?.style) ?? {};

describe('Chip disabled + selected', () => {
  it('keeps fill opacity 1 and the selected text colour `background`', () => {
    const { UNSAFE_root } = wrap(<Chip label="V4" selected disabled />);
    const all = UNSAFE_root.findAll((n: ReactTestInstance) => typeof n.type === 'string' || !!n.props?.style);
    const fills = all.filter((n: ReactTestInstance) => {
      const s = flat(n);
      return s.backgroundColor === LIGHT_PALETTE.textPrimary && s.opacity === 1;
    });
    expect(fills.length).toBeGreaterThan(0);
    const texts = UNSAFE_root.findAllByType(Text);
    const colors = texts.map((t: ReactTestInstance) => flat(t).color);
    expect(colors).toContain(LIGHT_PALETTE.background);
  });
});

describe('Chip layout="tile"', () => {
  it('is a 12-radius, 56-high cell with a 20pt swatch and a 2pt outer ring', () => {
    const { UNSAFE_root } = wrap(<Chip layout="tile" label="Red" swatch="#E5483B" selected />);
    const all = UNSAFE_root.findAll((n: ReactTestInstance) => !!n.props?.style);
    const swatch = all.find((n: ReactTestInstance) => flat(n).backgroundColor === '#E5483B');
    expect(flat(swatch!)).toMatchObject({ width: 20, height: 20 });
    const ring = all.find((n: ReactTestInstance) => flat(n).borderWidth === 2 && flat(n).top === -2);
    expect(flat(ring!)).toMatchObject({ borderColor: LIGHT_PALETTE.background, left: -2, right: -2, bottom: -2 });
    expect(all.some((n: ReactTestInstance) => flat(n).borderRadius === 12 && flat(n).overflow === 'hidden')).toBe(true);
  });

  it('capsule swatch ring is an outer 1pt gap', () => {
    const { UNSAFE_root } = wrap(<Chip label="Red" swatch="#E5483B" selected />);
    const ring = UNSAFE_root.findAll((n: ReactTestInstance) => !!n.props?.style).find((n: ReactTestInstance) => flat(n).borderWidth === 1 && flat(n).top === -1);
    expect(ring).toBeTruthy();
  });
});

describe('ChoiceGrid', () => {
  it('is a radiogroup', () => {
    const { UNSAFE_root } = wrap(
      <ChoiceGrid accessibilityLabel="Colour">
        <Chip label="A" />
      </ChoiceGrid>,
    );
    expect(UNSAFE_root.findAll((n: ReactTestInstance) => n.props?.accessibilityRole === 'radiogroup' && n.props?.accessibilityLabel === 'Colour').length).toBeGreaterThan(0);
  });

  it.each([357, 361, 377, 393])('lays 12 choices out as 2 rows of 6 equal flex cells at width %i', (w) => {
    const labels = ['VB', 'V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10'];
    const { UNSAFE_root } = wrap(
      <ChoiceGrid accessibilityLabel="Grade" fontScale={1}>
        {labels.map((l) => (
          <Chip key={l} label={l} size="large" />
        ))}
      </ChoiceGrid>,
    );
    const group = UNSAFE_root.findAll((n: ReactTestInstance) => n.props?.accessibilityRole === 'radiogroup')[0];
    fireEvent(group, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: w, height: 100 } } });
    const rows = UNSAFE_root.findAll((n: ReactTestInstance) => typeof n.type === 'string' && flat(n).flexDirection === 'row' && flat(n).columnGap === 8 && n.children.length === 6);
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      const cells = row.children as ReactTestInstance[];
      expect(cells.every((c) => flat(c).flex === 1 && flat(c).width === undefined)).toBe(true);
    }
  });

  it('gives grid chips tight side padding and a centred label', () => {
    const { UNSAFE_root } = wrap(
      <ChoiceGrid accessibilityLabel="Grade" fontScale={1}>
        <Chip label="V10" size="large" />
      </ChoiceGrid>,
    );
    const pad = UNSAFE_root.findAll((n: ReactTestInstance) => flat(n).paddingHorizontal !== undefined);
    expect(pad.every((n: ReactTestInstance) => flat(n).paddingHorizontal <= 8)).toBe(true);
    expect(UNSAFE_root.findAllByType(Text).every((t: ReactTestInstance) => flat(t).textAlign === 'center')).toBe(true);
  });
});
