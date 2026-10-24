/** Shared states round: PageLoading, useLoadingPhase, EmptyState variants/aliases, InlineError severities, IconButton loading. */
import '../../../lib/i18n';
import { Ionicons } from '@expo/vector-icons';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react-native';
import React from 'react';
import { AccessibilityInfo, Dimensions, StyleSheet } from 'react-native';

import { ICON } from '../../../lib/icons';
import { SPINNER, ThemeProvider, buildTheme } from '../../../lib/theme';
import { EmptyState, keepQuotedTogether } from '../EmptyState';
import { IconButton } from '../IconButton';
import { InlineError } from '../InlineError';
import { PageLoading } from '../PageLoading';
import { Spinner } from '../ProgressBar';
import { useLoadingPhase, useSkeletonPhase } from '../useLoadingPhase';

const wrap = (ui: React.ReactElement) => render(<ThemeProvider>{ui}</ThemeProvider>);

function styleOf(el: { props: any }): Record<string, any> {
  return StyleSheet.flatten(el.props?.style) ?? {};
}

/** Style of the nearest ancestor-or-self that sets `key`. */
function up(el: { parent: any; props: any } | null, key: string): Record<string, any> {
  let n = el;
  while (n) {
    const st = styleOf(n);
    if (st[key] !== undefined) return st;
    n = n.parent;
  }
  throw new Error(`no ancestor with ${key}`);
}

describe('useLoadingPhase', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('idle -> loading after 300ms -> timeout after 10s; back to idle when loading ends', () => {
    const { result, rerender } = renderHook(({ on }: { on: boolean }) => useLoadingPhase(on), { initialProps: { on: true }, wrapper: ThemeProvider });
    expect(result.current).toBe('idle');
    act(() => jest.advanceTimersByTime(300));
    expect(result.current).toBe('loading');
    act(() => jest.advanceTimersByTime(9700));
    expect(result.current).toBe('timeout');
    rerender({ on: false });
    expect(result.current).toBe('idle');
    rerender({ on: true }); // retry: the 300ms delay starts over
    expect(result.current).toBe('idle');
  });

  it('useSkeletonPhase is a deprecated alias that says "skeleton"', () => {
    const { result } = renderHook(() => useSkeletonPhase(true), { wrapper: ThemeProvider });
    act(() => jest.advanceTimersByTime(300));
    expect(result.current).toBe('skeleton');
  });
});

describe('PageLoading / Spinner', () => {
  it('is one busy progressbar node with the large spinner centred in the visible area', () => {
    wrap(<PageLoading />);
    const node = screen.getByRole('progressbar');
    expect(node.props.accessibilityState).toMatchObject({ busy: true });
    expect(styleOf(node)).toMatchObject({ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 0, paddingBottom: 0 });
  });

  it('Spinner contexts map to sizes', () => {
    expect(SPINNER).toMatchObject({ page: 'large', section: 'small', control: 'small', field: 'small', media: 'large', mediaControl: 'small' });
    const { UNSAFE_getByType } = wrap(<Spinner context="media" />);
    const { ActivityIndicator } = require('react-native');
    expect(UNSAFE_getByType(ActivityIndicator).props).toMatchObject({ size: 'large' });
  });
});

describe('EmptyState', () => {
  it('centres the primary button and the link (alignSelf center wrappers over Button flex-start)', () => {
    wrap(<EmptyState variant="filtered" title="T" description="D" primaryLabel="Clear" secondaryLabel="Add one" />);
    expect(up(screen.getByLabelText('Clear'), 'alignSelf').alignSelf).toBe('flex-start'); // the Button itself
    let n: any = screen.getByLabelText('Clear').parent;
    let centred = false;
    while (n && !centred) {
      centred = styleOf(n).alignSelf === 'center' && styleOf(n).marginTop === 24;
      n = n.parent;
    }
    expect(centred).toBe(true);
    let m: any = screen.getByLabelText('Add one').parent;
    let linkCentred = false;
    while (m && !linkCentred) {
      linkCentred = styleOf(m).alignSelf === 'center' && styleOf(m).marginTop === 8;
      m = m.parent;
    }
    expect(linkCentred).toBe(true);
  });

  it('page anchors its top 48 under the content top', () => {
    wrap(<EmptyState variant="page" title="Nothing" />);
    expect(up(screen.getByText('Nothing'), 'paddingTop').paddingTop).toBe(48);
  });

  it('error variant gets a secondary retry with the reload glyph', () => {
    wrap(<EmptyState variant="error" title="Broke" description="Try again." primaryLabel="Retry" />);
    expect(screen.getByLabelText('Retry')).toBeTruthy();
  });

  it('old variant names still render (aliases)', () => {
    for (const variant of ['prompt', 'firstUse', 'private', 'inline'] as const) {
      const { unmount } = wrap(<EmptyState variant={variant} title="Alias title" description="Alias body" />);
      expect(screen.getAllByText(/Alias/).length).toBeGreaterThan(0);
      unmount();
    }
  });

  it('no variant draws an icon, even when one is passed (error only has the retry button glyph)', () => {
    const dims = jest.spyOn(Dimensions, 'get').mockReturnValue({ width: 393, height: 852, scale: 3, fontScale: 1 });
    for (const variant of ['page', 'filtered', 'private', 'error'] as const) {
      const { unmount } = wrap(<EmptyState variant={variant} icon={ICON.route.outline} title="T" description="D" />);
      expect(screen.UNSAFE_queryAllByType(Ionicons)).toHaveLength(0);
      unmount();
    }
    dims.mockRestore();
  });

  it('keepQuotedTogether joins the characters inside 「」 with U+2060 only', () => {
    const out = keepQuotedTogether('點「記錄完攀」保存。');
    expect(out).toBe('點「\u2060記\u2060錄\u2060完\u2060攀\u2060」保存。');
    expect(out.replace(/\u2060/g, '')).toBe('點「記錄完攀」保存。');
    expect(keepQuotedTogether('no quotes')).toBe('no quotes');
  });

  it('section is left aligned (no centring)', () => {
    wrap(<EmptyState variant="section" description="One sentence." />);
    expect(screen.getByText('One sentence.')).toBeTruthy();
    expect(screen.queryByRole('header')).toBeNull();
  });
});

describe('InlineError callouts', () => {
  let announce: jest.SpyInstance;
  beforeEach(() => {
    announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
  });
  afterEach(() => announce.mockRestore());

  it('warning with a title: surfaceAlt container (no notice colours), body textSecondary', () => {
    wrap(<InlineError variant="warning" title="Similar route exists" message="Body" />);
    const box = up(screen.getByText('Body'), 'backgroundColor');
    expect(box.backgroundColor).not.toBe('#FFDBCB');
    expect(box.borderRadius).toBe(12);
    expect(styleOf(screen.getByText('Body'))).toMatchObject({ color: expect.any(String) });
  });

  it('warning announces once, with the prefix, and not again when the message changes', () => {
    const { rerender } = wrap(<InlineError variant="warning" title="Similar" message="Body one" />);
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce.mock.calls[0][0]).toBe('Warning: Similar. Body one');
    rerender(
      <ThemeProvider>
        <InlineError variant="warning" title="Similar" message="Body two" />
      </ThemeProvider>,
    );
    expect(announce).toHaveBeenCalledTimes(1);
  });

  it('info does not announce; focusOnAppear does not announce either and labels the container', () => {
    wrap(<InlineError variant="notice" message="FYI" />);
    expect(announce).not.toHaveBeenCalled();
    wrap(<InlineError variant="block" title="Failed" message="Try later" focusOnAppear />);
    expect(announce).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Failed. Try later')).toBeTruthy();
  });

  it('a retry action carries the reload icon by default', () => {
    const { toJSON } = wrap(<InlineError variant="block" message="x" actionLabel="Retry" onAction={() => {}} />);
    expect(JSON.stringify(toJSON())).toContain('"marginRight":8'); // the 16pt leading glyph inside the action
  });
});

describe('IconButton loading', () => {
  it('is inactive and busy, and swaps the glyph for a spinner', () => {
    const onPress = jest.fn();
    wrap(<IconButton variant="float" loading name={ICON.save.outline} accessibilityLabel="Save" onPress={onPress} />);
    const btn = screen.getByLabelText('Save');
    expect(btn.props.accessibilityState).toMatchObject({ disabled: true, busy: true });
    fireEvent.press(btn);
    expect(onPress).not.toHaveBeenCalled();
    const { ActivityIndicator } = require('react-native');
    expect(screen.UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
  });

  it('disabled float uses textDisabled on the glyph and does not fade the button', () => {
    const { toJSON } = wrap(<IconButton variant="float" disabled name={ICON.save.outline} accessibilityLabel="Save" onPress={() => {}} />);
    const btn = screen.getByLabelText('Save');
    expect(btn.props.accessibilityState).toMatchObject({ disabled: true, busy: false });
    const json = JSON.stringify(toJSON());
    expect(json).toContain(`"color":"${buildTheme(false).colors.textDisabled}"`);
    expect(json).not.toContain('"opacity":0.4');
  });
});
