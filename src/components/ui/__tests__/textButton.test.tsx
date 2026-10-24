/** Text button (spec text-button §2): geometry, hitSlop per role, T1 baseline structure, E2 / InlineError migration. */
import '../../../lib/i18n';
import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { ActivityIndicator, Dimensions, StyleSheet, View } from 'react-native';

import { ThemeProvider } from '../../../lib/theme';
import { Button } from '../Button';
import { EmptyState } from '../EmptyState';
import { SectionHeader } from '../SectionHeader';
import { textHitSlop } from '../TextButton';

const wrap = (ui: React.ReactElement) => render(<ThemeProvider>{ui}</ThemeProvider>);
const flat = (el: { props: any }): Record<string, any> => StyleSheet.flatten(el.props?.style) ?? {};

describe('textHitSlop (spec 1.4 / 2.6)', () => {
  it.each([
    ['trailing', 22, { top: 13, bottom: 9, left: 8, right: 0 }],
    ['inline', 22, { top: 11, bottom: 11, left: 0, right: 8 }],
    ['inline', 20, { top: 12, bottom: 12, left: 0, right: 8 }],
    ['centered', 22, { top: 8, bottom: 14, left: 8, right: 8 }],
    ['bar', 22, { top: 11, bottom: 11, left: 16, right: 8 }],
    ['container', 20, { top: 12, bottom: 12, left: 8, right: 8 }],
  ] as const)('%s at line %i', (placement, line, expected) => {
    expect(textHitSlop(placement, line, 44, null)).toEqual(expected);
  });

  it('centered without a primary above splits evenly', () => {
    expect(textHitSlop('centered', 22, 44, null, false)).toEqual({ top: 11, bottom: 11, left: 8, right: 8 });
  });

  it('a short label pads the free side up to 44 (trailing: start, inline: end), never below the base slop', () => {
    expect(textHitSlop('trailing', 22, 44, 30)).toMatchObject({ left: 14, right: 0 });
    expect(textHitSlop('inline', 22, 44, 30)).toMatchObject({ left: 0, right: 14 });
    expect(textHitSlop('trailing', 22, 44, 100)).toMatchObject({ left: 8 });
  });
});

describe('Button variant="text"', () => {
  it('has no padding, minHeight, minWidth, radius or wash; hugs content', () => {
    wrap(<Button variant="text" label="View all" onPress={() => {}} />);
    const st = flat(screen.getByLabelText('View all'));
    expect(st.minHeight).toBeUndefined();
    expect(st.minWidth).toBeUndefined();
    expect(st.paddingHorizontal).toBeUndefined();
    expect(st.borderRadius).toBeUndefined();
    expect(st.backgroundColor).toBeUndefined();
    expect(st.alignSelf).toBe('flex-start');
  });

  it('md is subhead 600, sm is footnote 600', () => {
    wrap(
      <>
        <Button variant="text" label="Medium" onPress={() => {}} />
        <Button variant="text" size="sm" label="Small" onPress={() => {}} />
      </>,
    );
    expect(flat(screen.getAllByText('Medium')[0])).toMatchObject({ fontSize: 15, lineHeight: 22, fontWeight: '600' });
    expect(flat(screen.getAllByText('Small')[0])).toMatchObject({ fontSize: 13, lineHeight: 20, fontWeight: '600' });
  });

  it('presses and is inert while loading; spinner is absolute and comes after the text layer', () => {
    const onPress = jest.fn();
    const { rerender } = wrap(<Button variant="text" label="Save" onPress={onPress} />);
    fireEvent.press(screen.getByLabelText('Save'));
    expect(onPress).toHaveBeenCalledTimes(1);
    rerender(
      <ThemeProvider>
        <Button variant="text" label="Save" loading onPress={onPress} />
      </ThemeProvider>,
    );
    const btn = screen.getByLabelText('Save');
    expect(btn.props.accessibilityState).toMatchObject({ disabled: true, busy: true });
    fireEvent.press(btn);
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
  });

  it('disabled uses textDisabled', () => {
    wrap(<Button variant="text" label="Off" disabled onPress={() => {}} />);
    expect(screen.getByLabelText('Off').props.accessibilityState).toMatchObject({ disabled: true });
  });
});

describe('T1 baseline alignment (spec 2.9)', () => {
  const fontScale = (n: number) => jest.spyOn(Dimensions, 'get').mockReturnValue({ width: 393, height: 852, scale: 3, fontScale: n });
  afterEach(() => jest.restoreAllMocks());

  it('at font scale >= 1.6 the action drops under the title as an inline text button', () => {
    fontScale(1.6);
    wrap(<SectionHeader title="Sessions" action={{ label: 'View all', onPress: () => {} }} />);
    expect(flat(screen.getByTestId('section-header')).flexDirection).toBeUndefined();
    expect(flat(screen.getByLabelText('View all'))).toMatchObject({ alignSelf: 'flex-start', marginTop: 4 });
  });

  // Yoga is not available in jest; the baseline is guaranteed by structure, which is asserted here and measured in the browser story.
  it.each([false, true])('title row is a 28 baseline row and the button joins it as its first-baseline child (loading=%s)', (loading) => {
    fontScale(1);
    const { toJSON } = wrap(<SectionHeader title="Sessions" action={{ label: 'View all', onPress: () => {}, loading }} />);
    const row = flat(screen.getByTestId('section-header'));
    expect(row).toMatchObject({ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', minHeight: 28 });
    expect(row.height).toBeUndefined();

    const btn = screen.getByLabelText('View all');
    const header = toJSON() as any; // host tree only: the row's own children are the title and the button, no wrapper
    expect(header.props.testID).toBe('section-header');
    expect(header.children.map((k: any) => k.props.accessibilityLabel ?? k.type)).toEqual(['Text', 'View all']);
    expect(flat(btn)).toMatchObject({ alignSelf: 'baseline', flexShrink: 0, marginLeft: 16 });
    expect(flat(btn).minHeight).toBeUndefined();

    // first child is the text layer (no padding, no minHeight); the spinner layer is absolute and last
    const kids = (header.children[1] as any).children as { props: any }[];
    const first = kids[0];
    const textLayerStyle = StyleSheet.flatten(first.props.style) ?? {};
    expect(textLayerStyle.padding).toBeUndefined();
    expect(textLayerStyle.minHeight).toBeUndefined();
    const spinnerLayer = StyleSheet.flatten(kids[kids.length - 1].props.style);
    expect(spinnerLayer.position).toBe('absolute');
  });

  it('the title is flexShrink 1 and the header has no action slot content when none is given', () => {
    fontScale(1);
    wrap(<SectionHeader title="Sessions" />);
    expect(flat(screen.getByText('Sessions'))).toMatchObject({ flexShrink: 1 });
    expect(screen.UNSAFE_queryAllByType(View).some((v) => v.props.accessibilityRole === 'button')).toBe(false);
  });
});

describe('EmptyState section (E2)', () => {
  it('is just the sentence when there is no action', () => {
    wrap(<EmptyState variant="section" description="No sessions yet." />);
    expect(screen.getByText('No sessions yet.')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('still renders a legacy secondaryLabel as an inline text button with no negative margin', () => {
    const onSecondary = jest.fn();
    const { toJSON } = wrap(<EmptyState variant="section" description="None." secondaryLabel="Find routes" onSecondary={onSecondary} />);
    fireEvent.press(screen.getByLabelText('Find routes'));
    expect(onSecondary).toHaveBeenCalled();
    expect(JSON.stringify(toJSON())).not.toContain('"marginLeft":-14');
    expect(flat(screen.getByLabelText('Find routes'))).toMatchObject({ alignSelf: 'flex-start', marginTop: 8 });
  });

  it('page / filtered link centres itself', () => {
    wrap(<EmptyState variant="page" title="T" description="D" secondaryLabel="Add one" />);
    expect(flat(screen.getByLabelText('Add one'))).toMatchObject({ alignSelf: 'center' });
  });
});
